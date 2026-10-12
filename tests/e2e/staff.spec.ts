import AxeBuilder from "@axe-core/playwright";
import { request as playwrightRequest, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { currentConsent } from "../../src/lib/legal";
import {
  apiSignUp,
  BASE_URL,
  captureServerAction,
  cookieHeader,
  expect,
  mailLink,
  randomIp,
  setRole,
  strongPassword,
  test,
  uniqueEmail,
  type CapturedAction,
} from "./support";

const main = (page: Page) => page.getByRole("main");
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function userIdOf(db: pg.Pool, email: string) {
  return (await db.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email])).rows[0]?.id;
}
async function rowOf(db: pg.Pool, email: string) {
  return (await db.query<{ role: string | null; banned: boolean | null }>(`SELECT role, banned FROM "user" WHERE email = $1`, [email])).rows[0];
}

/** A signed-in user with a role, in its own browser context. */
async function signedIn(browser: Browser, db: pg.Pool, label: string, role: string) {
  const context = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  await context.addCookies([{ name: "jsc_cookie_choice", value: "essential", url: BASE_URL }]);
  const page = await context.newPage();
  const user = await apiSignUp(page, { verify: true, label });
  await setRole(db, user.email, role);
  return { ...user, context, page, id: (await userIdOf(db, user.email))! };
}

async function replay(action: CapturedAction, opts: { cookie?: string; body?: string }) {
  const ctx = await playwrightRequest.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const res = await ctx.post(action.url, {
    headers: { ...action.headers, origin: BASE_URL, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    data: opts.body ?? action.body,
    maxRedirects: 0,
  });
  const out = { status: res.status(), text: await res.text() };
  await ctx.dispose();
  return out;
}

async function findCard(page: Page, email: string) {
  await page.goto(`/staff/users?scope=all&q=${encodeURIComponent(email)}`);
  return main(page).getByRole("listitem").filter({ hasText: email });
}

test.describe("access to the staff console", () => {
  test("customers are sent back to their own portal", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "staff-customer" });
    for (const path of ["/staff", "/staff/users", "/staff/activity"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/portal$/);
    }
  });

  test("an unrecognised role is treated as a customer-less, staff-less account", async ({ page, db }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "staff-multirole" });
    await setRole(db, email, "admin,customer");
    await page.goto("/staff");
    await expect(page).toHaveURL(/\/portal$/);
  });

  test("signed-out visitors are asked to sign in", async ({ page }) => {
    await page.goto("/staff/users");
    await expect(page).toHaveURL(/\/login\?next=%2Fstaff%2Fusers$/);
  });
});

test.describe("employee", () => {
  test("sees customers only and can suspend and reinstate one @responsive", async ({ browser, db }) => {
    const employee = await signedIn(browser, db, "emp-ops", "employee");
    const customer = await signedIn(browser, db, "emp-target", "customer");
    const admin = await signedIn(browser, db, "emp-admin", "admin");
    const page = employee.page;

    await page.goto("/staff");
    await expect(main(page).getByRole("heading", { level: 1, name: "Network operations centre" })).toBeVisible();
    await expect(main(page).getByText("Administrators")).toHaveCount(0);

    await page.goto("/staff/users");
    await expect(main(page).getByLabel("Show")).toHaveCount(0); // no scope selector for employees
    expect(await (await findCard(page, admin.email)).count()).toBe(0);

    const card = await findCard(page, customer.email);
    await expect(card).toHaveCount(1);
    await card.getByText(/^Manage/).click();
    await expect(card.getByLabel("New role")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Delete account" })).toHaveCount(0);
    await card.getByLabel("Suspension reason").selectOption("security");
    await card.getByRole("button", { name: "Suspend account" }).click();
    await expect(main(page).getByRole("status").filter({ hasText: "is suspended" })).toBeVisible();
    expect((await rowOf(db, customer.email)).banned).toBe(true);

    // The suspended customer's session has ended.
    await customer.page.goto("/portal");
    await expect(customer.page).toHaveURL(/\/login/);

    const suspended = await findCard(page, customer.email);
    await expect(suspended.getByText("Suspended", { exact: true })).toBeVisible();
    await suspended.getByText(/^Manage/).click();
    await suspended.getByRole("button", { name: "Reinstate account" }).click();
    await expect(main(page).getByRole("status").filter({ hasText: "is active again" })).toBeVisible();
    expect((await rowOf(db, customer.email)).banned).toBe(false);

    await page.goto("/staff/activity");
    await expect(main(page).getByText("Suspended account").first()).toBeVisible();
    await expect(main(page).getByText("Signed in")).toHaveCount(0); // auth events are admin-only

    for (const u of [employee, customer, admin]) await u.context.close();
  });
});

test.describe("administrator", () => {
  test("changes roles and deletes accounts; administrators stay protected", async ({ browser, db }) => {
    const admin = await signedIn(browser, db, "adm-ops", "admin");
    const otherAdmin = await signedIn(browser, db, "adm-other", "admin");
    const customer = await signedIn(browser, db, "adm-target", "customer");
    const page = admin.page;

    await page.goto("/staff");
    await expect(main(page).getByText("Administrators")).toBeVisible();

    let card = await findCard(page, customer.email);
    await card.getByText(/^Manage/).click();
    const roleOptions = await card.getByLabel("New role").locator("option").allTextContents();
    expect(roleOptions).toEqual(["Choose a role…", "Employee", "Administrator"]);
    await card.getByLabel("New role").selectOption("employee");
    await card.getByRole("button", { name: "Change role" }).click();
    await expect(main(page).getByRole("status").filter({ hasText: "is now a employee" }).or(main(page).getByRole("status").filter({ hasText: "is now an employee" }))).toBeVisible();
    expect((await rowOf(db, customer.email)).role).toBe("employee");

    // Another administrator can only have their role changed: no suspend or delete.
    const adminCard = await findCard(page, otherAdmin.email);
    await adminCard.getByText(/^Manage/).click();
    await expect(adminCard.getByLabel("New role")).toBeVisible();
    await expect(adminCard.getByRole("button", { name: "Suspend account" })).toHaveCount(0);
    await expect(adminCard.getByRole("button", { name: "Delete account" })).toHaveCount(0);

    // No controls at all on your own account.
    const own = await findCard(page, admin.email);
    await expect(own.getByText(/^Manage/)).toHaveCount(0);

    card = await findCard(page, customer.email);
    await card.getByText(/^Manage/).click();
    await card.getByLabel(/Type DELETE/).fill("DELETE");
    await card.getByRole("button", { name: "Delete account" }).click();
    await expect(main(page).getByRole("status").filter({ hasText: "have been deleted" })).toBeVisible();
    expect(await rowOf(db, customer.email)).toBeUndefined();

    await page.goto("/staff/activity");
    await expect(main(page).getByText("Deleted account").first()).toBeVisible();
    await expect(main(page).getByText("Changed role").first()).toBeVisible();

    for (const u of [admin, otherAdmin, customer]) await u.context.close();
  });
});

test.describe("replayed and forged staff requests", () => {
  test("role changes cannot be replayed by employees, customers or the signed-out", async ({ browser, db }) => {
    const admin = await signedIn(browser, db, "rp-admin", "admin");
    const employee = await signedIn(browser, db, "rp-employee", "employee");
    const customer = await signedIn(browser, db, "rp-customer", "customer");
    const target = await signedIn(browser, db, "rp-target", "customer");

    const card = await findCard(admin.page, target.email);
    await card.getByText(/^Manage/).click();
    await card.getByLabel("New role").selectOption("employee");
    const action = await captureServerAction(admin.page, () => card.getByRole("button", { name: "Change role" }).click());
    await expect(main(admin.page).getByRole("status").filter({ hasText: "is now" })).toBeVisible();
    expect(action.body).toContain(target.id);

    // The form encodes fields as `_1_userId`, `_1_role`, ...
    const withRole = (body: string, role: string) => body.replace(/(name="_\d+_role"\r\n\r\n)\w+/, `$1${role}`);
    expect(withRole(action.body, "admin")).not.toBe(action.body);

    // Employee promoting themselves to admin.
    const selfPromote = await replay(action, { cookie: await cookieHeader(employee.context), body: withRole(action.body.replaceAll(target.id, employee.id), "admin") });
    expect(selfPromote.text).toContain("You can't do that to your own account.");
    expect((await rowOf(db, employee.email)).role).toBe("employee");

    // Employee promoting someone else to admin.
    const promoteOther = await replay(action, { cookie: await cookieHeader(employee.context), body: withRole(action.body, "admin") });
    expect(promoteOther.text).toContain("Your account isn't allowed to do that.");
    expect((await rowOf(db, target.email)).role).toBe("employee"); // unchanged from the admin's legitimate change

    // Employee demoting the admin.
    const demote = await replay(action, { cookie: await cookieHeader(employee.context), body: action.body.replaceAll(target.id, admin.id) });
    expect(demote.text).not.toContain("is now");
    expect((await rowOf(db, admin.email)).role).toBe("admin");

    // A customer replaying the admin's request as-is.
    const asCustomer = await replay(action, { cookie: await cookieHeader(customer.context) });
    expect(asCustomer.text).toContain("isn't available");

    // A forged cookie, and no cookie at all.
    expect((await replay(action, { cookie: "jsc.session_token=forged.value" })).text).toContain("Your session has ended.");
    expect((await replay(action, {})).status).toBe(307);

    const denied = await db.query(`SELECT count(*)::int AS n FROM audit_log WHERE actor_id = $1 AND action = 'authz.denied'`, [employee.id]);
    expect(denied.rows[0].n).toBeGreaterThan(0);
    for (const u of [admin, employee, customer, target]) await u.context.close();
  });

  test("an employee cannot point a captured suspension at an administrator", async ({ browser, db }) => {
    const employee = await signedIn(browser, db, "rs-employee", "employee");
    const admin = await signedIn(browser, db, "rs-admin", "admin");
    const customer = await signedIn(browser, db, "rs-customer", "customer");

    const card = await findCard(employee.page, customer.email);
    await card.getByText(/^Manage/).click();
    await card.getByLabel("Suspension reason").selectOption("abuse");
    const action = await captureServerAction(employee.page, () => card.getByRole("button", { name: "Suspend account" }).click());
    await expect(main(employee.page).getByRole("status").filter({ hasText: "is suspended" })).toBeVisible();

    const forged = await replay(action, { cookie: await cookieHeader(employee.context), body: action.body.replaceAll(customer.id, admin.id) });
    // Refused at the capability check (employees may only act on customers).
    expect(forged.text).toContain("Your account isn't allowed to do that.");
    expect((await rowOf(db, admin.email)).banned).toBeFalsy();

    const ownAccount = await replay(action, { cookie: await cookieHeader(employee.context), body: action.body.replaceAll(customer.id, employee.id) });
    expect(ownAccount.text).toContain("your own account");
    expect((await rowOf(db, employee.email)).banned).toBeFalsy();

    const badReason = await replay(action, { cookie: await cookieHeader(employee.context), body: action.body.replace(/abuse/g, "<script>alert(1)</script>") });
    expect(badReason.text).toContain("Choose a reason");

    for (const u of [employee, admin, customer]) await u.context.close();
  });
});

test.describe("hostile input", () => {
  test("a script-shaped display name is shown as text everywhere, never run", async ({ browser, db }) => {
    const payload = `<img src=x onerror=alert(1)><script>alert(2)</script>"'&`;
    const context = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    await context.addCookies([{ name: "jsc_cookie_choice", value: "essential", url: BASE_URL }]);
    const page = await context.newPage();
    const dialogs: string[] = [];
    page.on("dialog", async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });
    const email = uniqueEmail("xss");
    const res = await page.request.post("/api/auth/sign-up/email", {
      data: { name: payload, email, password: strongPassword(), legalConsent: currentConsent() },
      headers: { origin: BASE_URL },
    });
    expect(res.status()).toBe(200);
    await page.request.get(await mailLink(email, "verify-email"), { maxRedirects: 0 });

    await page.goto("/portal");
    await expect(main(page).getByRole("heading", { level: 1 })).toContainText("<img");
    await page.goto("/portal/account");
    await expect(main(page).getByText(payload, { exact: true })).toBeVisible();

    const admin = await signedIn(browser, db, "xss-admin", "admin");
    const card = await findCard(admin.page, email);
    await expect(card.getByRole("heading", { name: payload })).toBeVisible();
    await expect(card.locator("img")).toHaveCount(0);
    expect(dialogs).toEqual([]);
    await admin.context.close();
    await context.close();
  });

  test("search terms are treated as literal text", async ({ browser, db }) => {
    const admin = await signedIn(browser, db, "search-admin", "admin");
    for (const q of [`<script>alert(1)</script>`, `' OR 1=1 --`, `%`, `"><img src=x onerror=alert(3)>`]) {
      await admin.page.goto(`/staff/users?scope=all&q=${encodeURIComponent(q)}`);
      await expect(main(admin.page).getByText("No accounts match.")).toBeVisible();
      await expect(main(admin.page).getByLabel("Search name or email")).toHaveValue(q);
    }
    await admin.context.close();
  });
});

test.describe("layout and accessibility", () => {
  test("staff pages fit every target width with no axe violations", async ({ browser, db }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sizes are set explicitly");
    for (const role of ["employee", "admin"]) {
      const u = await signedIn(browser, db, `layout-${role}`, role);
      for (const width of [390, 768, 1280, 1440]) {
        await u.page.setViewportSize({ width, height: 900 });
        for (const path of ["/staff", "/staff/users", "/staff/activity"]) {
          await u.page.goto(path);
          await expect(main(u.page).getByRole("heading", { level: 1 })).toBeVisible();
          const overflow = await u.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, `${role} ${path} at ${width}px`).toBeLessThanOrEqual(0);
          const results = await new AxeBuilder({ page: u.page }).withTags(WCAG).analyze();
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), `${role} ${path} at ${width}px`).toEqual([]);
          if (width === 390 || width === 1440) await u.page.screenshot({ path: testInfo.outputPath(`${role}${path.replace(/\//g, "_")}-${width}.png`), fullPage: true });
        }
      }
      await u.context.close();
    }
  });
});
