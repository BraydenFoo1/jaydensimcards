import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { currentConsent } from "../../src/lib/legal";
import { apiSignUp, BASE_URL, CONSENT_CHECKBOX, expect, randomIp, setRole, strongPassword, test, uniqueEmail } from "./support";

const main = (page: Page) => page.getByRole("main");
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("legal pages and footer", () => {
  test("the footer links to the Privacy Policy and Terms from every kind of page @responsive", async ({ page, db }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "footer" });
    await setRole(db, email, "admin");
    for (const path of ["/", "/login", "/portal", "/portal/account", "/staff", "/privacy", "/terms", "/nope-not-a-page"]) {
      await page.goto(path);
      const legal = page.getByRole("contentinfo").getByRole("navigation", { name: "Legal" });
      await expect(legal.getByRole("link", { name: "Privacy Policy" }), path).toHaveAttribute("href", "/privacy");
      await expect(legal.getByRole("link", { name: "Terms of Service" }), path).toHaveAttribute("href", "/terms");
    }
    await page.goto("/login");
    await page.getByRole("contentinfo").getByRole("link", { name: "Terms of Service" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" }).click();
    await expect(main(page).getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  });

  for (const path of ["/privacy", "/terms"]) {
    test(`${path} is complete, honest about what needs review, and makes no forbidden claims`, async ({ page }) => {
      await page.goto(path);
      await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
      await expect(main(page).getByText(/This is a draft that has not yet been reviewed by a lawyer/)).toBeVisible();
      expect(await main(page).locator("mark").count()).toBeGreaterThan(3);
      const text = (await main(page).innerText()).toLowerCase();
      for (const claim of ["fully gdpr compliant", "fully ccpa compliant", "fully pdpa compliant", "100% secure", "unhackable", "zero risk", "military-grade", "fully compliant"]) {
        expect(text, claim).not.toContain(claim);
      }
      // Contents links jump to their sections.
      const first = main(page).getByRole("navigation", { name: "Contents" }).getByRole("link").first();
      const href = await first.getAttribute("href");
      await first.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
    });
  }

  test("the privacy policy covers the required topics", async ({ page }) => {
    await page.goto("/privacy");
    for (const heading of ["Information we collect", "Cookies", "Who we share information with", "How long we keep information", "How we protect information", "Your rights", "Making a privacy request"]) {
      await expect(main(page).getByRole("heading", { level: 2, name: new RegExp(heading) })).toBeVisible();
    }
    for (const framework of ["GDPR", "CCPA", "PDPA"]) await expect(main(page).getByRole("heading", { name: new RegExp(framework) })).toBeVisible();
    await expect(main(page).getByText("There is no self-service")).toBeVisible();
  });

  test("the terms flag governing law for legal review instead of choosing one", async ({ page }) => {
    await page.goto("/terms");
    await expect(main(page).getByText("[LEGAL REVIEW REQUIRED: governing law]")).toBeVisible();
    await expect(main(page).getByText(/not.{0,10}a licensed\s+telecommunications provider/)).toBeVisible();
    await expect(main(page).getByRole("heading", { name: /Limitation of liability/ })).toBeVisible();
  });

  test("legal pages fit every target width with no axe violations", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sizes are set explicitly");
    for (const width of [390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/privacy", "/terms"]) {
        await page.goto(path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${path} ${width}`).toBeLessThanOrEqual(0);
        const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(results.violations.map((v) => v.id), `${path} ${width}`).toEqual([]);
      }
    }
  });
});

test.describe("cookie notice", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies({ name: "jsc_cookie_choice" });
  });

  test("explains essential-only cookies and remembers 'Essential only' @responsive", async ({ page, context }) => {
    await page.goto("/login");
    const notice = page.getByRole("region", { name: "Cookie notice" });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("essential cookies only");
    await expect(notice).toContainText("no analytics, advertising or tracking cookies");
    await expect(notice.getByRole("link", { name: "Cookie details" })).toHaveAttribute("href", "/privacy#cookies");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    for (const button of await notice.getByRole("button").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    // Keyboard only.
    await notice.getByRole("button", { name: "Essential only" }).focus();
    await page.keyboard.press("Enter");
    await expect(notice).toHaveCount(0);
    expect((await context.cookies()).find((c) => c.name === "jsc_cookie_choice")?.value).toBe("essential");

    await page.reload();
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Cookie notice" })).toHaveCount(0);
  });

  test("'Accept all' is recorded separately and the choice is not a sign-in", async ({ page, context }) => {
    await page.goto("/privacy");
    await page.getByRole("region", { name: "Cookie notice" }).getByRole("button", { name: "Accept all" }).click();
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "jsc_cookie_choice")?.value).toBe("all");
    expect(cookies.find((c) => c.name.includes("session_token"))).toBeUndefined();
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the site sets no cookies besides the session and this choice", async ({ page, context }) => {
    const { email, password } = await apiSignUp(page, { verify: true, label: "cookie-audit" });
    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/portal$/);
    await page.getByRole("region", { name: "Cookie notice" }).getByRole("button", { name: "Essential only" }).click();
    const names = (await context.cookies()).map((c) => c.name).sort();
    expect(names).toEqual(["jsc.session_token", "jsc_cookie_choice"]);
    const session = (await context.cookies()).find((c) => c.name === "jsc.session_token")!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe("Lax");
  });
});

test.describe("registration consent", () => {
  test("the agreement links to both documents and gates the button", async ({ page }) => {
    await page.goto("/register");
    const consent = page.getByRole("checkbox", { name: CONSENT_CHECKBOX });
    const label = page.locator("label").filter({ has: consent });
    await expect(label.getByRole("link", { name: /Terms of Service/ })).toHaveAttribute("href", "/terms");
    await expect(label.getByRole("link", { name: /Privacy Policy/ })).toHaveAttribute("href", "/privacy");
    const submit = page.getByRole("button", { name: "Create account" });
    await expect(submit).toBeDisabled();
    await consent.check();
    await expect(submit).toBeEnabled();
    await consent.uncheck();
    await expect(submit).toBeDisabled();
  });

  test("the server refuses a sign-up without consent, whatever the browser does", async ({ page, db }) => {
    for (const legalConsent of [undefined, null, true, { terms: "old", privacy: "old" }]) {
      const email = uniqueEmail("api-noconsent");
      const res = await page.request.post("/api/auth/sign-up/email", {
        data: { name: "No Consent", email, password: strongPassword(), ...(legalConsent === undefined ? {} : { legalConsent }) },
        headers: { origin: BASE_URL },
      });
      expect(res.status(), JSON.stringify(legalConsent)).toBe(400);
      expect(((await res.json()) as { code?: string }).code).toBe("CONSENT_REQUIRED");
      expect((await db.query(`SELECT count(*)::int AS n FROM "user" WHERE email = $1`, [email])).rows[0].n).toBe(0);
    }
    const ok = await page.request.post("/api/auth/sign-up/email", {
      data: { name: "Consented", email: uniqueEmail("api-consent"), password: strongPassword(), legalConsent: currentConsent() },
      headers: { origin: BASE_URL },
    });
    expect(ok.status()).toBe(200);
  });
});

test.describe("security headers and policies", () => {
  test("HTML pages and the auth API send the security headers, and no framework banner", async ({ page }) => {
    for (const path of ["/login", "/privacy", "/api/auth/ok"]) {
      const res = await page.request.get(path);
      const h = res.headers();
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"], path).toContain("object-src 'none'");
      expect(h["content-security-policy"], path).not.toContain("unsafe-eval");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["permissions-policy"]).toContain("camera=()");
      expect(h["x-powered-by"]).toBeUndefined();
    }
  });

  test("the policy blocks eval and scripts from other origins", async ({ browser }) => {
    // Separate context: the CSP violations below are expected and would trip the console guard.
    const context = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const page = await context.newPage();
    const violations: string[] = [];
    await page.exposeFunction("__reportViolation", (v: string) => violations.push(v));

    // Inject a payload into the real HTML response, the way stored XSS would arrive.
    // (Scripts added through page.evaluate are exempt from CSP, so they can't test it.)
    await page.route(`${BASE_URL}/login`, async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        "</body>",
        `<script>document.addEventListener("securitypolicyviolation",function(e){window.__reportViolation(e.violatedDirective+" "+e.blockedURI)});try{eval("1")}catch(e){}</script><script src="https://evil.example/steal.js"></script></body>`,
      );
      await route.fulfill({ response, body: html, headers: response.headers() });
    });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible(); // the page itself still works
    await expect.poll(() => violations.length).toBeGreaterThanOrEqual(2);
    expect(violations).toContain("script-src eval");
    expect(violations.some((v) => v.startsWith("script-src-elem https://evil.example/steal.js"))).toBe(true);
    await context.close();
  });

  test("the admin API is not reachable from the browser", async ({ page, db }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "api-admin" });
    await setRole(db, email, "admin");
    for (const path of ["/api/auth/admin/list-users", "/api/auth/admin/ban-user", "/api/auth/get-session", "/api/auth/list-sessions"]) {
      const res = path.endsWith("list-users") || path.endsWith("session") || path.endsWith("sessions")
        ? await page.request.get(path)
        : await page.request.post(path, { data: { userId: "x" }, headers: { origin: BASE_URL } });
      expect(res.status(), path).toBe(404);
    }
  });

  test("nothing a browser downloads contains server secrets", async ({ page }) => {
    const secrets = [process.env.BETTER_AUTH_SECRET, process.env.DATABASE_URL].filter((v): v is string => Boolean(v && v.length > 8));
    expect(secrets.length).toBe(2);
    const bodies: string[] = [];
    page.on("response", async (res) => {
      if (res.url().startsWith(BASE_URL)) bodies.push(await res.text().catch(() => ""));
    });
    for (const path of ["/", "/login", "/register", "/privacy", "/terms"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(bodies.length).toBeGreaterThan(5);
    for (const body of bodies) {
      for (const secret of secrets) expect(body.includes(secret)).toBe(false);
      expect(body).not.toMatch(/postgres(ql)?:\/\//);
    }
  });

  test("unknown pages get a plain 404 without internals", async ({ page }) => {
    const res = await page.goto("/definitely-not-here");
    expect(res?.status()).toBe(404);
    await expect(main(page).getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/at \w+ \(|\.tsx:\d+|node_modules|ENOENT/);
  });
});
