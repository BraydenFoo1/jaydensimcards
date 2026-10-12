/**
 * Drives the real Better Auth handler in-process against the local database,
 * exactly as the /api/auth route would, without needing a running server.
 */
import { randomInt, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { assertSafeTestEnvironment } from "@/lib/db-target";
import { currentConsent } from "@/lib/legal";

// Second check behind vitest.config.ts, in case a test file is run some other
// way; every integration test imports this file. It runs only after the imports
// above (and any a test file makes before this one) have loaded. Loading them
// opens no connection: the pg pool connects on its first query, and Better
// Auth's start-up schema check is off in auth.ts (tests/unit/auth-import.test.ts
// proves both). So the first connection comes from a test, after this check.
assertSafeTestEnvironment(process.env);

export const ORIGIN = "http://localhost:3000";
export const TEST_DOMAIN = "jsc-test.example.com";

export const uniqueEmail = (label: string) => `${label}-${randomUUID().slice(0, 8)}@${TEST_DOMAIN}`;
export const strongPassword = () => `Jsc-${randomUUID()}`;
/** A fresh client IP per test keeps rate-limit buckets independent. */
export const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

export class CookieJar {
  private cookies = new Map<string, string>();

  store(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "" || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  has(name: string) {
    return this.cookies.has(name);
  }
}

/** The parts of Better Auth's JSON responses the tests inspect. */
export type AuthJson = {
  code?: string;
  message?: string;
  user?: { email?: string; role?: string; emailVerified?: boolean; [key: string]: unknown };
  [key: string]: unknown;
};

type CallOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  jar?: CookieJar;
  ip?: string;
  origin?: string | null;
};

export async function call(pathOrUrl: string, opts: CallOptions = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${ORIGIN}/api/auth${pathOrUrl}`;
  // Sign-up needs agreement to the current legal documents, as the real form sends.
  // Tests of the consent rule itself set legalConsent explicitly (including to null).
  if (pathOrUrl === "/sign-up/email" && typeof opts.body === "object" && opts.body !== null && !("legalConsent" in opts.body)) {
    opts = { ...opts, body: { ...opts.body, legalConsent: currentConsent() } };
  }
  const headers = new Headers({ "x-forwarded-for": opts.ip ?? randomIp() });
  if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const cookie = opts.jar?.header();
  if (cookie) headers.set("cookie", cookie);

  const res = await auth.handler(
    new Request(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      redirect: "manual",
    }),
  );
  opts.jar?.store(res);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // redirects and HTML responses are not JSON
  }
  return { res, status: res.status, json: json as AuthJson | null };
}

const OUTBOX = path.join(process.cwd(), ".dev-mail");

/** Waits for the dev outbox to contain a message of `kind` for `to`, and returns its first auth link. */
export async function waitForMail(to: string, kind: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await readdir(OUTBOX).catch(() => [] as string[]);
    for (const file of files.filter((f) => f.includes(`-${kind}-`)).sort().reverse()) {
      const mail = JSON.parse(await readFile(path.join(OUTBOX, file), "utf8"));
      if (mail.to === to) {
        const link = String(mail.text).match(/https?:\/\/\S+/)?.[0] ?? null;
        return { ...mail, link } as { to: string; subject: string; text: string; link: string | null };
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No ${kind} email for ${to} within ${timeoutMs}ms`);
}

export async function countMail(to: string, kind: string) {
  const files = await readdir(OUTBOX).catch(() => [] as string[]);
  let n = 0;
  for (const file of files.filter((f) => f.includes(`-${kind}-`))) {
    const mail = JSON.parse(await readFile(path.join(OUTBOX, file), "utf8"));
    if (mail.to === to) n++;
  }
  return n;
}

/** Signs up and verifies a user; returns a jar holding their session. */
export async function createVerifiedUser(label: string) {
  const email = uniqueEmail(label);
  const password = strongPassword();
  const signUp = await call("/sign-up/email", { body: { name: `Test ${label}`, email, password } });
  if (signUp.status !== 200) throw new Error(`sign-up failed: ${signUp.status} ${JSON.stringify(signUp.json)}`);
  const mail = await waitForMail(email, "verify-email");
  const jar = new CookieJar();
  await call(mail.link!, { jar, origin: null });
  return { email, password, jar };
}

export async function cleanupTestUsers() {
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%@${TEST_DOMAIN}`]);
}

/** A verified, signed-in user whose stored role is set directly (any string, to test bad values too). */
export async function createUserWithRole(label: string, role: string) {
  const created = await createVerifiedUser(label);
  await pool.query(`UPDATE "user" SET role = $2 WHERE email = $1`, [created.email, role]);
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [created.email]);
  return { ...created, id: rows[0].id, headers: new Headers({ cookie: created.jar.header() }) };
}

/** Runs a server-side Better Auth call and reports its outcome instead of throwing. */
export async function outcome(run: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; status: unknown; code: unknown }> {
  try {
    await run();
    return { ok: true };
  } catch (err) {
    const e = err as { status?: unknown; body?: { code?: unknown } };
    return { ok: false, status: e.status, code: e.body?.code };
  }
}
