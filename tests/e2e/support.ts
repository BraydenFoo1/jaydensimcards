import { randomInt, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import { assertSafeTestEnvironment } from "../../src/lib/db-target";
import { currentConsent } from "../../src/lib/legal";

/**
 * Loads .env.local unless DATABASE_URL is already set, then refuses anything
 * but the local database and the dev outbox. The test server, the test
 * fixtures and the teardown all use this same environment.
 */
export function loadTestEnvironment() {
  if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
  return assertSafeTestEnvironment(process.env);
}

// The tests inspect the database directly (roles, lines, audit entries).
loadTestEnvironment();

/** Must match the port in playwright.config.ts. */
export const BASE_URL = "http://localhost:3100";
export const TEST_DOMAIN = "jsc-e2e.example.com";
export const uniqueEmail = (label: string) => `${label}-${randomUUID().slice(0, 8)}@${TEST_DOMAIN}`;
export const strongPassword = () => `Jsc-${randomUUID()}`;
export const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

/**
 * Every test gets:
 *  - its own client IP, so rate-limit buckets never leak between tests
 *  - a guard that fails the test on uncaught page errors, console errors
 *    (expected 4xx responses from auth calls are allowed) or any JS dialog
 *  - the cookie notice already answered, as for a returning visitor
 */
export const test = base.extend<{ guard: void }, { db: pg.Pool }>({
  db: [
    // Playwright requires the destructuring pattern even with no dependencies.
    async ({}, use) => {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
      await use(pool);
      await pool.end();
    },
    { scope: "worker" },
  ],
  guard: [
    async ({ context, page }, use) => {
      await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
      // A returning visitor has already answered the cookie notice; its own tests clear this.
      await context.addCookies([{ name: "jsc_cookie_choice", value: "essential", url: BASE_URL }]);
      const problems: string[] = [];
      page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
      page.on("response", (res) => {
        if (res.status() === 404 && res.request().resourceType() !== "document") problems.push(`missing asset: ${res.url()}`);
      });
      // No page may ever open alert/confirm/prompt: a dialog here means injected script ran.
      page.on("dialog", async (dialog) => {
        problems.push(`dialog: ${dialog.type()} ${dialog.message()}`);
        await dialog.dismiss();
      });
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        // Expected answers: auth rejections and rate limits, and 404 page loads (asset 404s are caught below).
        if (/Failed to load resource: the server responded with a status of (400|401|403|404|429)/.test(text)) return;
        problems.push(`console: ${text}`);
      });
      await use();
      expect(problems, "page errors / console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

const OUTBOX = path.join(process.cwd(), ".dev-mail");

export async function mailLink(to: string, kind: "verify-email" | "reset-password", occurrence = 1): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const files = (await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.includes(`-${kind}-`)).sort();
    const matches: string[] = [];
    for (const file of files) {
      const mail = JSON.parse(await readFile(path.join(OUTBOX, file), "utf8"));
      if (mail.to === to) matches.push(String(mail.text).match(/https?:\/\/\S+/)?.[0] ?? "");
    }
    if (matches.length >= occurrence) return matches[occurrence - 1];
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no ${kind} email #${occurrence} for ${to}`);
}

/** Creates a user through the real API (not the UI) for tests that need one. */
export async function apiSignUp(page: Page, opts: { verify: boolean; label: string }) {
  const email = uniqueEmail(opts.label);
  const password = strongPassword();
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { name: `E2E ${opts.label}`, email, password, legalConsent: currentConsent() },
    headers: { origin: BASE_URL },
  });
  expect(res.status()).toBe(200);
  if (opts.verify) {
    const link = await mailLink(email, "verify-email");
    const verify = await page.request.get(link, { maxRedirects: 0 });
    expect(verify.status()).toBe(302);
  }
  return { email, password };
}

/**
 * Field and message lookups in these tests are scoped to <main> and use exact
 * labels: Next.js adds a role="alert" route announcer outside <main>, and the
 * password toggles are labelled "Show password" etc.
 */
export async function signInViaUI(page: Page, email: string, password: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function setRole(db: pg.Pool, email: string, role: string) {
  await db.query(`UPDATE "user" SET role = $2 WHERE email = $1`, [email, role]);
}

export async function lineOf(db: pg.Pool, email: string) {
  const { rows } = await db.query(
    `SELECT l.plan_id, l.used_gb FROM sim_line l JOIN "user" u ON u.id = l.user_id WHERE u.email = $1`,
    [email],
  );
  return rows[0] as { plan_id: string | null; used_gb: number } | undefined;
}

export async function cookieHeader(context: BrowserContext) {
  return (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
}

/** A raw server-action POST captured from the browser, for replaying with other credentials. */
export type CapturedAction = { url: string; headers: Record<string, string>; body: string };

export async function captureServerAction(page: Page, trigger: () => Promise<void>): Promise<CapturedAction> {
  const requestPromise = page.waitForRequest((r) => r.method() === "POST" && "next-action" in r.headers());
  await trigger();
  const request = await requestPromise;
  const all = await request.allHeaders();
  const keep = ["next-action", "next-router-state-tree", "content-type", "accept"];
  return {
    url: request.url(),
    headers: Object.fromEntries(Object.entries(all).filter(([k]) => keep.includes(k))),
    body: request.postData() ?? "",
  };
}

/** The consent box's accessible name includes "(opens in a new tab)" after each link. */
export const CONSENT_CHECKBOX = /I agree to the Terms of Service.*and Privacy Policy/;
