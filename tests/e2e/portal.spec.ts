import AxeBuilder from "@axe-core/playwright";
import { request as playwrightRequest, type Page } from "@playwright/test";
import {
  apiSignUp,
  BASE_URL,
  captureServerAction,
  cookieHeader,
  expect,
  lineOf,
  randomIp,
  setRole,
  signInViaUI,
  strongPassword,
  test,
  type CapturedAction,
} from "./support";

const main = (page: Page) => page.getByRole("main");
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function choosePlan(page: Page, name: RegExp) {
  await main(page).getByRole("radio", { name }).check();
  await main(page).getByRole("button", { name: /Activate plan|Switch plan/ }).click();
}

/** Replays a captured server action with different credentials / origin / body. */
async function replay(action: CapturedAction, opts: { cookie?: string; origin?: string; body?: string }) {
  const ctx = await playwrightRequest.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const res = await ctx.post(action.url, {
    headers: { ...action.headers, origin: opts.origin ?? BASE_URL, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    data: opts.body ?? action.body,
    maxRedirects: 0,
  });
  const result = { status: res.status(), text: await res.text() };
  await ctx.dispose();
  return result;
}

test.describe("customer overview", () => {
  test("a new customer activates a plan and sees the SIM, usage, terms and network status @responsive", async ({ page, db }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "portal-new" });
    await page.goto("/portal");

    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText(/^Hello, E2E$/);
    await expect(main(page).getByText("Awaiting activation")).toBeVisible();
    await expect(main(page).getByText(/^ICCID 8965 \d{4} \d{4} \d{4} \d{3}$/)).toBeVisible();
    await expect(main(page).getByText("Novelty SIM. Not a real SIM card")).toBeVisible();
    await expect(main(page).getByRole("heading", { name: /^(ONLINE|DEGRADED|CONGESTED|UNSTABLE|OFFLINE) Jayden/ })).toBeVisible();
    await expect(main(page).getByRole("heading", { level: 2, name: "Choose your plan" })).toBeVisible();
    expect((await lineOf(db, email))?.plan_id).toBeNull();

    await choosePlan(page, /The Exam Throttler/);
    const notice = main(page).getByRole("status").filter({ hasText: "Switched to The Exam Throttler" });
    await expect(notice).toBeVisible();
    await expect(notice).toBeFocused();

    await expect(main(page).getByRole("meter", { name: "Data used this month" })).toHaveAttribute("aria-valuetext", "686.1 MB used of 500 GB");
    await expect(main(page).getByText("Contract runs until you graduate.")).toBeVisible();
    await expect(main(page).getByText("never billed")).toBeVisible();
    await expect(main(page).getByRole("radio", { name: /The Exam Throttler.*Current/ })).toBeChecked();
    expect((await lineOf(db, email))?.plan_id).toBe("exam");
  });

  test("the plan picked on the pricing table is preselected", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "portal-preselect" });
    await page.goto("/portal?plan=ultra");
    await expect(main(page).getByRole("radio", { name: /The Ultra Jayden 5G/ })).toBeChecked();
    await page.goto("/portal?plan=not-a-plan");
    await expect(main(page).getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("I'm Broke goes straight over its allowance; re-picking the current plan is refused", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "portal-broke" });
    await page.goto("/portal");
    await choosePlan(page, /I'm Broke/);
    await expect(main(page).getByRole("note")).toContainText("You are over your allowance.");
    await expect(main(page).getByRole("note")).toContainText("$67.00 USD per KB");
    await expect(main(page).getByRole("meter")).toHaveAttribute("aria-valuenow", "100");

    await main(page).getByRole("button", { name: "Switch plan" }).click();
    await expect(main(page).getByRole("alert")).toContainText("already on that plan");
  });

  test("an unlimited plan shows no meter", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "portal-unlimited" });
    await page.goto("/portal");
    await choosePlan(page, /The Ultra Jayden 5G/);
    await expect(main(page).getByText("The asterisk is doing a lot of work.")).toBeVisible();
    await expect(main(page).getByRole("meter")).toHaveCount(0);
  });

  test("plans can be chosen and switched with the keyboard alone", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "portal-keys" });
    await page.goto("/portal?plan=exam");
    await main(page).getByRole("radio", { name: /The Exam Throttler/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(main(page).getByRole("radio", { name: /STEAM0/ })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(main(page).getByRole("button", { name: "Activate plan" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(main(page).getByRole("status").filter({ hasText: "Switched to STEAM0" })).toBeVisible();
  });
});

test.describe("staff accounts", () => {
  for (const role of ["employee", "admin"]) {
    test(`an ${role} gets no SIM line and no plan controls @responsive`, async ({ page, db }) => {
      const { email } = await apiSignUp(page, { verify: true, label: `portal-${role}` });
      await setRole(db, email, role);
      await page.goto("/portal");
      await expect(main(page).getByText("Staff accounts don't carry a SIM line.")).toBeVisible();
      await expect(main(page).getByRole("radio")).toHaveCount(0);
      await expect(main(page).getByRole("button", { name: /Switch plan|Activate plan/ })).toHaveCount(0);
      expect(await lineOf(db, email)).toBeUndefined();
    });
  }
});

test.describe("malicious and unauthorised requests", () => {
  test("a captured plan-switch request is refused for staff, signed-out, cross-site and tampered replays", async ({ page, browser, db }) => {
    const customer = await apiSignUp(page, { verify: true, label: "replay-customer" });
    await page.goto("/portal");
    const action = await captureServerAction(page, () => choosePlan(page, /The Freedom Plan/));
    await expect(main(page).getByRole("status").filter({ hasText: "Switched to The Freedom Plan" })).toBeVisible();
    expect(action.body).toContain("freedom5g");

    // 1. A staff account replays it with its own session.
    const staffContext = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const staffPage = await staffContext.newPage();
    const staff = await apiSignUp(staffPage, { verify: true, label: "replay-staff" });
    await setRole(db, staff.email, "admin");
    const asStaff = await replay(action, { cookie: await cookieHeader(staffContext) });
    expect(asStaff.text).toContain("That action isn't available for your account.");
    expect(await lineOf(db, staff.email)).toBeUndefined();
    const denied = await db.query(
      `SELECT a.detail FROM audit_log a JOIN "user" u ON u.id = a.actor_id WHERE u.email = $1 AND a.action = 'authz.denied'`,
      [staff.email],
    );
    expect(denied.rows.map((r) => r.detail)).toContain("line:switch-plan");
    await staffContext.close();

    // 2a. No cookie: the proxy turns it away before the action runs.
    const anonymous = await replay(action, {});
    expect(anonymous.status).toBe(307);
    expect(anonymous.text).toContain("/login?next=%2Fportal");
    // 2b. A forged cookie gets past the proxy's presence check, so the action's
    //     own database-backed session check is what refuses it.
    const forgedCookie = await replay(action, { cookie: "jsc.session_token=forged.signature" });
    expect(forgedCookie.text).toContain("Your session has ended.");

    // 3. The customer's own cookie, sent from another site.
    await page.goto("/portal");
    await choosePlan(page, /The Exam Throttler/);
    await expect(main(page).getByRole("status").filter({ hasText: "Switched to The Exam Throttler" })).toBeVisible();
    const crossSite = await replay(action, { cookie: await cookieHeader(page.context()), origin: "https://evil.example" });
    expect(crossSite.text).not.toContain("Switched to");
    expect((await lineOf(db, customer.email))?.plan_id).toBe("exam");

    // 4. The customer's own session with a forged plan id.
    const tampered = await replay(action, { cookie: await cookieHeader(page.context()), body: action.body.replaceAll("freedom5g", "../../admin") });
    expect(tampered.text).toContain("Choose one of the plans listed.");
    expect((await lineOf(db, customer.email))?.plan_id).toBe("exam");
  });

  test("a customer cannot sign out someone else's device by forging a session id", async ({ page, browser, db }) => {
    const attacker = await apiSignUp(page, { verify: true, label: "idor-attacker" });
    // Give the attacker a second device so the "Sign out" device button exists.
    const second = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const secondPage = await second.newPage();
    await secondPage.goto("/login");
    await signInViaUI(secondPage, attacker.email, attacker.password);
    await expect(secondPage).toHaveURL(/\/portal$/);

    const victimContext = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const victimPage = await victimContext.newPage();
    const victim = await apiSignUp(victimPage, { verify: true, label: "idor-victim" });
    const { rows } = await db.query(`SELECT s.id FROM session s JOIN "user" u ON u.id = s."userId" WHERE u.email = $1`, [victim.email]);
    const victimSessionId = rows[0].id as string;

    // Read the attacker's session ids before the click revokes one of them.
    const ownSessionIds = (await db.query(`SELECT s.id FROM session s JOIN "user" u ON u.id = s."userId" WHERE u.email = $1`, [attacker.email])).rows.map((r) => r.id as string);
    await page.goto("/portal/account");
    const action = await captureServerAction(page, () => main(page).getByRole("button", { name: /^Sign out .*signed in/ }).click());
    const target = ownSessionIds.find((id) => action.body.includes(id));
    expect(target).toBeTruthy();

    const forged = await replay(action, { cookie: await cookieHeader(page.context()), body: action.body.replaceAll(target!, victimSessionId) });
    expect(forged.text).toContain("That device is already signed out.");

    await victimPage.goto("/portal");
    await expect(main(victimPage).getByRole("heading", { level: 1 })).toContainText("Hello");
    await second.close();
    await victimContext.close();
  });
});

test.describe("account & security", () => {
  test("shows account details and changes the password, signing out other devices @responsive", async ({ page, browser }) => {
    const { email, password } = await apiSignUp(page, { verify: true, label: "account-cp" });
    const other = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const otherPage = await other.newPage();
    await otherPage.goto("/login");
    await signInViaUI(otherPage, email, password);
    await expect(otherPage).toHaveURL(/\/portal$/);

    await page.goto("/portal/account");
    await expect(main(page).getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
    await expect(main(page).getByText(email)).toBeVisible();
    await expect(main(page).getByText("Customer", { exact: true })).toBeVisible();
    await expect(main(page).getByText("This device and 1 other.")).toBeVisible();

    const form = main(page).getByRole("region", { name: "Change password" });
    await form.getByLabel("Current password", { exact: true }).fill(strongPassword());
    const newPassword = strongPassword();
    await form.getByLabel("New password", { exact: true }).fill(newPassword);
    await form.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(form.getByRole("alert")).toContainText("Your current password is incorrect.");

    await form.getByLabel("Current password", { exact: true }).fill(password);
    await form.getByLabel("New password", { exact: true }).fill(newPassword);
    await form.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(form.getByRole("status")).toContainText("Every other device has been signed out.");
    await expect(main(page).getByText("Only this device is signed in.")).toBeVisible();

    await otherPage.goto("/portal/account");
    await expect(otherPage).toHaveURL(/\/login\?next=%2Fportal%2Faccount$/);
    await other.close();
  });

  test("signs out one other device, then all others", async ({ page, browser }) => {
    const { email, password } = await apiSignUp(page, { verify: true, label: "account-devices" });
    const devices = [];
    for (let i = 0; i < 2; i++) {
      const ctx = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
      const p = await ctx.newPage();
      await p.goto("/login");
      await signInViaUI(p, email, password);
      await expect(p).toHaveURL(/\/portal$/);
      devices.push({ ctx, p });
    }

    await page.goto("/portal/account");
    await expect(main(page).getByText("This device and 2 others.")).toBeVisible();
    await main(page).getByRole("button", { name: /^Sign out .*signed in/ }).first().click();
    await expect(main(page).getByText("This device and 1 other.")).toBeVisible();

    await main(page).getByRole("button", { name: "Sign out all other devices" }).click();
    await expect(main(page).getByRole("status").filter({ hasText: "Every other device has been signed out." })).toBeVisible();
    await expect(main(page).getByText("Only this device is signed in.")).toBeVisible();

    for (const { p, ctx } of devices) {
      await p.goto("/portal");
      await expect(p).toHaveURL(/\/login/);
      await ctx.close();
    }
    await page.goto("/portal");
    await expect(main(page).getByRole("heading", { level: 1 })).toContainText("Hello");
  });

  test("staff can manage their own account too", async ({ page, db }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "account-staff" });
    await setRole(db, email, "employee");
    await page.goto("/portal/account");
    await expect(main(page).getByText("Staff (employee)")).toBeVisible();
    await expect(main(page).getByRole("region", { name: "Change password" })).toBeVisible();
  });

  test("an unrecognised role gets no account features", async ({ page, db }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "account-unknown" });
    await setRole(db, email, "superadmin");
    await page.goto("/portal/account");
    await expect(main(page).getByRole("alert")).toContainText("isn’t recognised");
    await expect(main(page).getByRole("region", { name: "Change password" })).toHaveCount(0);
    await page.goto("/portal");
    await expect(main(page).getByRole("radio")).toHaveCount(0);
  });
});

test.describe("protected routes and sessions", () => {
  test("signed-out visitors are sent to sign in and returned afterwards", async ({ page }) => {
    const { email, password } = await apiSignUp(page, { verify: true, label: "protect" });
    await page.context().clearCookies();
    await page.goto("/portal/account");
    await expect(page).toHaveURL(/\/login\?next=%2Fportal%2Faccount$/);
    await signInViaUI(page, email, password);
    await expect(page).toHaveURL(/\/portal\/account$/);
  });

  test("a forged session cookie gets no further than the sign-in page", async ({ page }) => {
    await page.context().addCookies([{ name: "jsc.session_token", value: "forged.value", url: BASE_URL }]);
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login\?next=%2Fportal$/);
  });

  test("after signing out, going back does not reveal the portal", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "back-button" });
    await page.goto("/portal");
    await expect(main(page).getByRole("heading", { level: 1 })).toContainText("Hello");
    await page.getByRole("banner").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login\?signedout=1$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Hello, E2E")).toHaveCount(0);
  });

  test("the account tabs are a labelled navigation with the current page marked", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "nav" });
    await page.goto("/portal/account");
    const nav = page.getByRole("navigation", { name: "Account" });
    await expect(nav.getByRole("link", { name: "Account & security" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/portal$/);
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("layout and accessibility", () => {
  const WIDTHS = [390, 768, 1280, 1440];

  test("portal pages fit every target width with no axe violations", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sizes are set explicitly");
    await apiSignUp(page, { verify: true, label: "layout" });
    await page.goto("/portal");
    await choosePlan(page, /I'm Broke/);
    await expect(main(page).getByRole("note")).toBeVisible();

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/portal", "/portal/account"]) {
        await page.goto(path);
        await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
        expect(await horizontalOverflow(page), `${path} at ${width}px`).toBeLessThanOrEqual(0);
        expect(await axeViolations(page), `${path} at ${width}px`).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`${path.replace(/\//g, "_")}-${width}.png`), fullPage: true });
      }
    }
  });

  test("the empty-plan state and staff state are accessible @responsive", async ({ page, db }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "axe-states" });
    await page.goto("/portal");
    await expect(main(page).getByText("Awaiting activation")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await setRole(db, email, "admin");
    await page.goto("/portal");
    await expect(main(page).getByText("Staff accounts don't carry a SIM line.")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
