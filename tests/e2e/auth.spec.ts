import AxeBuilder from "@axe-core/playwright";
import { apiSignUp, BASE_URL, CONSENT_CHECKBOX, expect, mailLink, randomIp, signInViaUI, strongPassword, test, uniqueEmail } from "./support";

test.describe("registration and email verification", () => {
  test("register, confirm by email, reach the portal, then sign out @responsive", async ({ page }) => {
    const email = uniqueEmail("journey");
    const password = strongPassword();

    await page.goto("/register?plan=ultra");
    await expect(page.getByRole("heading", { level: 1, name: "Join the network" })).toBeVisible();
    await page.getByLabel("Full name").fill("Ah Beng Tan");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page.getByRole("checkbox", { name: /fictional parody/ }).check();
    await page.getByRole("checkbox", { name: CONSENT_CHECKBOX }).check();
    await page.getByRole("button", { name: "Create account" }).click();

    const sent = page.getByRole("main").getByRole("status").filter({ hasText: "Check your email" });
    await expect(sent).toBeVisible();
    await expect(sent).toContainText(email);
    await expect(sent).toBeFocused();
    await expect(page.getByRole("button", { name: /Send another link in \d+s/ })).toBeDisabled();

    const link = await mailLink(email, "verify-email");
    await page.goto(link);
    await expect(page).toHaveURL(/\/verify-email\?.*confirmed=1/);
    await expect(page.getByRole("heading", { level: 1, name: "Email confirmed" })).toBeVisible();

    await page.getByRole("link", { name: "Continue to your account" }).click();
    await expect(page).toHaveURL(/\/portal\?plan=ultra$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hello, Ah" })).toBeVisible();
    // Next keeps the previous page mounted but hidden; scope to the visible <main>.
    // The overview shows the holder on the SIM card and the plan chosen at sign-up;
    // the email address lives on the account page.
    await expect(page.getByRole("main").getByText("Ah Beng Tan", { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("radio", { name: /The Ultra Jayden 5G/ })).toBeChecked();
    await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Account & security" }).click();
    await expect(page.getByRole("main").getByText(email)).toBeVisible();

    await page.getByRole("banner").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login\?signedout=1$/);
    await expect(page.getByRole("main").getByRole("status")).toContainText("signed out");

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login\?next=%2Fportal$/);
  });

  test("summarises every validation problem and links each to its field", async ({ page }) => {
    await page.goto("/register");
    // Disabled until the Terms/Privacy box is ticked, with the reason announced.
    const submit = page.getByRole("button", { name: "Create account" });
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAccessibleDescription(/Tick .I agree to the Terms of Service and Privacy Policy/);
    await page.getByRole("checkbox", { name: CONSENT_CHECKBOX }).check();
    await submit.click();

    const summary = page.getByRole("main").getByRole("alert").filter({ hasText: "There are 5 problems" });
    await expect(summary).toBeFocused();
    for (const label of ["Full name", "Email address", "Confirm password"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("aria-invalid", "true");
    }
    await summary.getByRole("link", { name: /^Email address:/ }).click();
    await expect(page.getByLabel("Email address")).toBeFocused();
  });

  test("rejects a password that appears in a known breach", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Breach Test");
    await page.getByLabel("Email address").fill(uniqueEmail("breach"));
    await page.getByLabel("Password", { exact: true }).fill("password123456");
    await page.getByLabel("Confirm password", { exact: true }).fill("password123456");
    await page.getByRole("checkbox", { name: /fictional parody/ }).check();
    await page.getByRole("checkbox", { name: CONSENT_CHECKBOX }).check();
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText("known data breach");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  });

  test("an invalid verification link explains itself and offers a new one", async ({ page }) => {
    await page.goto("/verify-email?error=INVALID_TOKEN&next=%2Fportal");
    await expect(page.getByRole("heading", { level: 1, name: "Link not valid" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("invalid or has already been used");

    await page.getByLabel("Email address").fill(uniqueEmail("nobody"));
    await page.getByRole("button", { name: "Send a new confirmation link" }).click();
    // Same answer for any address: it never reveals whether an account exists.
    await expect(page.getByRole("main").getByRole("status")).toContainText("If that address still needs confirming");
  });
});

test.describe("sign-in", () => {
  test("uses the same message for a wrong password and an unknown account", async ({ page }) => {
    const { email } = await apiSignUp(page, { verify: true, label: "generic" });
    await page.context().clearCookies();

    await page.goto("/login");
    await signInViaUI(page, email, strongPassword());
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("Email or password is incorrect.");
    await expect(alert).toBeFocused();
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");

    await signInViaUI(page, uniqueEmail("unknown"), strongPassword());
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Email or password is incorrect.");
  });

  test("tells an unverified user to confirm their email and resends the link", async ({ page }) => {
    const { email, password } = await apiSignUp(page, { verify: false, label: "unverified" });
    await page.goto("/login");
    await signInViaUI(page, email, password);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("confirm your email address first");
    await expect(page.getByRole("button", { name: /Send another link in \d+s/ })).toBeDisabled();
    // Signing in re-sent the link (the sign-up one plus this one).
    await mailLink(email, "verify-email", 2);
  });

  test("shows a rate-limit message with the wait time", async ({ page }) => {
    await page.goto("/login");
    const email = uniqueEmail("ratelimit");
    for (let i = 0; i < 5; i++) {
      await signInViaUI(page, email, strongPassword());
      await expect(page.getByRole("main").getByRole("alert")).toContainText("Email or password is incorrect.");
    }
    await signInViaUI(page, email, strongPassword());
    await expect(page.getByRole("main").getByRole("alert")).toContainText(/Too many attempts\. Please wait ([1-9]|[1-5]\d|60) seconds? and try again\./);
  });

  test("returns to the protected page that was requested @responsive", async ({ page }) => {
    const { email, password } = await apiSignUp(page, { verify: true, label: "return" });
    await page.context().clearCookies();

    await page.goto("/portal?plan=exam");
    await expect(page).toHaveURL(/\/login\?next=%2Fportal%3Fplan%3Dexam$/);
    await signInViaUI(page, email, password);
    await expect(page).toHaveURL(/\/portal\?plan=exam$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hello");
  });

  for (const evil of ["https://evil.example/phish", "//evil.example", "/\\evil.example", "/api/auth/sign-out"]) {
    test(`ignores an unsafe next parameter: ${evil}`, async ({ page }) => {
      const { email, password } = await apiSignUp(page, { verify: true, label: "openredirect" });
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(evil)}`);
      await signInViaUI(page, email, password);
      await expect(page).toHaveURL(`${BASE_URL}/portal`);
    });
  }

  test("sends signed-in visitors away from the sign-in and registration pages", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "signedin" }); // verifying signs this context in
    await page.goto("/login");
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto("/register");
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/\/portal$/);
  });

  test("the password visibility toggle is keyboard operable and announced", async ({ page }) => {
    await page.goto("/login");
    const input = page.getByLabel("Password", { exact: true });
    const toggle = page.getByRole("button", { name: "Show password" });
    await input.fill("secret-value");
    await expect(input).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("password reset", () => {
  test("reset by email, revoke other sessions, sign in with the new password @responsive", async ({ page, browser }) => {
    const { email, password } = await apiSignUp(page, { verify: true, label: "reset" });
    // `page` now holds a live session: the "other device".
    await page.goto("/portal");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hello");

    const other = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const resetPage = await other.newPage();
    await resetPage.goto("/forgot-password");
    await resetPage.getByLabel("Email address").fill(email);
    await resetPage.getByRole("button", { name: "Send reset link" }).click();
    await expect(resetPage.getByRole("main").getByRole("status")).toContainText(`If there’s an account for ${email}`);

    await resetPage.goto(await mailLink(email, "reset-password"));
    await expect(resetPage.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeVisible();
    // The token is dropped from the address bar once the page has it.
    await expect(resetPage).toHaveURL(`${BASE_URL}/reset-password`);

    const newPassword = strongPassword();
    await resetPage.getByLabel("New password", { exact: true }).fill(newPassword);
    await resetPage.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await resetPage.getByRole("button", { name: "Save new password" }).click();
    await expect(resetPage).toHaveURL(/\/login\?reset=1$/);
    await expect(resetPage.getByRole("main").getByRole("status")).toContainText("Password updated");

    await signInViaUI(resetPage, email, password);
    await expect(resetPage.getByRole("main").getByRole("alert")).toContainText("Email or password is incorrect.");
    await signInViaUI(resetPage, email, newPassword);
    await expect(resetPage).toHaveURL(/\/portal$/);

    // The first device's session was revoked by the reset.
    await page.reload();
    await expect(page).toHaveURL(/\/login\?next=%2Fportal$/);
    await other.close();
  });

  test("an invalid or used reset link offers a fresh one", async ({ page }) => {
    for (const url of ["/reset-password?error=INVALID_TOKEN", "/reset-password", "/reset-password?token=%3Cscript%3E"]) {
      await page.goto(url);
      await expect(page.getByRole("main").getByRole("alert")).toContainText("This reset link is invalid");
      await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    }
  });

  test("the request form answers the same way for unknown addresses", async ({ page }) => {
    await page.goto("/forgot-password");
    const email = uniqueEmail("nobody");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(`If there’s an account for ${email}`);
  });
});

test.describe("accessibility and layout", () => {
  const pages = ["/login", "/register", "/forgot-password", "/reset-password?error=INVALID_TOKEN", "/verify-email"];

  for (const path of pages) {
    test(`${path} has no axe violations and no horizontal scroll @responsive`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the signed-in portal has no axe violations @responsive", async ({ page }) => {
    await apiSignUp(page, { verify: true, label: "axe-portal" });
    await page.goto("/portal");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hello");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test("the skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });
});
