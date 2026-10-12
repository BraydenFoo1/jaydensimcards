import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import {
  CookieJar,
  call,
  cleanupTestUsers,
  countMail,
  createVerifiedUser,
  randomIp,
  strongPassword,
  uniqueEmail,
  waitForMail,
} from "./helpers";

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});

describe("registration and email verification", () => {
  it("creates an unverified customer and emails a verification link", async () => {
    const email = uniqueEmail("signup");
    const res = await call("/sign-up/email", { body: { name: "Ah Beng", email, password: strongPassword() } });
    expect(res.status).toBe(200);

    const { rows } = await pool.query(`SELECT "emailVerified", role FROM "user" WHERE email = $1`, [email]);
    expect(rows[0]).toEqual({ emailVerified: false, role: "customer" });

    const mail = await waitForMail(email, "verify-email");
    expect(mail.link).toMatch(/^http:\/\/localhost:3000\/api\/auth\/verify-email\?token=/);
  });

  it("stores a password hash, never the password", async () => {
    const email = uniqueEmail("hash");
    const password = strongPassword();
    await call("/sign-up/email", { body: { name: "Hash", email, password } });
    const { rows } = await pool.query(
      `SELECT a.password FROM account a JOIN "user" u ON u.id = a."userId" WHERE u.email = $1`,
      [email],
    );
    expect(rows[0].password).toBeTruthy();
    expect(rows[0].password).not.toContain(password);
  });

  it("blocks sign-in until the email is verified", async () => {
    const email = uniqueEmail("unverified");
    const password = strongPassword();
    await call("/sign-up/email", { body: { name: "U", email, password } });
    const res = await call("/sign-in/email", { body: { email, password } });
    expect(res.status).toBe(403);
    expect(res.json?.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("verifies the email from the link and signs the user in", async () => {
    const { email, jar } = await createVerifiedUser("verify");
    const session = await call("/get-session", { jar });
    expect(session.json?.user?.email).toBe(email);
    expect(session.json?.user?.emailVerified).toBe(true);
    expect(session.json?.user?.role).toBe("customer");
  });

  it("does not reveal whether an email is already registered", async () => {
    const { email } = await createVerifiedUser("enum");
    const fresh = await call("/sign-up/email", { body: { name: "X", email: uniqueEmail("enum-new"), password: strongPassword() } });
    const dupe = await call("/sign-up/email", { body: { name: "X", email, password: strongPassword() } });

    expect(dupe.status).toBe(fresh.status);
    expect(Object.keys(dupe.json ?? {}).sort()).toEqual(Object.keys(fresh.json ?? {}).sort());
    expect(Object.keys(dupe.json?.user ?? {}).sort()).toEqual(Object.keys(fresh.json?.user ?? {}).sort());
    // The real owner is told someone tried.
    await waitForMail(email, "existing-account");
  });

  it("rejects passwords found in known breaches", async () => {
    const res = await call("/sign-up/email", { body: { name: "P", email: uniqueEmail("pwned"), password: "password123456" } });
    expect(res.status).toBe(400);
    expect(res.json?.message).toMatch(/data breach/);
  });

  it("enforces the minimum password length", async () => {
    const res = await call("/sign-up/email", { body: { name: "S", email: uniqueEmail("short"), password: "Abc12345" } });
    expect(res.status).toBe(400);
  });
});

describe("sign-in, sessions and sign-out", () => {
  it("uses one generic error for a wrong password and an unknown account", async () => {
    const { email } = await createVerifiedUser("generic");
    const wrong = await call("/sign-in/email", { body: { email, password: strongPassword() } });
    const unknown = await call("/sign-in/email", { body: { email: uniqueEmail("nobody"), password: strongPassword() } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json?.message).toBe(unknown.json?.message);
  });

  it("sets an HttpOnly, SameSite=Lax session cookie and clears it on sign-out", async () => {
    const { email, password } = await createVerifiedUser("cookie");
    const jar = new CookieJar();
    const res = await call("/sign-in/email", { body: { email, password }, jar });
    expect(res.status).toBe(200);
    const cookie = res.res.headers.getSetCookie().find((c) => c.startsWith("jsc.session_token="));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    expect((await call("/get-session", { jar })).json?.user?.email).toBe(email);
    await call("/sign-out", { method: "POST", body: {}, jar });
    expect((await call("/get-session", { jar })).json).toBeNull();
  });

  it("rejects a cookie-bearing request from a foreign origin", async () => {
    const { jar } = await createVerifiedUser("csrf");
    const res = await call("/sign-out", { method: "POST", body: {}, jar, origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect((await call("/get-session", { jar })).json?.user).toBeTruthy();
  });

  it("rate limits repeated sign-in attempts from one address", async () => {
    const ip = randomIp();
    const email = uniqueEmail("ratelimit");
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await call("/sign-in/email", { body: { email, password: strongPassword() }, ip })).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
    // Regression: bigint timestamps used to come back as strings and corrupt this header.
    const limited = await call("/sign-in/email", { body: { email, password: strongPassword() }, ip });
    const retryAfter = Number(limited.res.headers.get("X-Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    // A different address is unaffected.
    expect((await call("/sign-in/email", { body: { email, password: strongPassword() } })).status).toBe(401);
  });
});

describe("password reset", () => {
  it("resets via the emailed link and revokes every existing session", async () => {
    const { email, password, jar: oldSession } = await createVerifiedUser("reset");

    const request = await call("/request-password-reset", { body: { email, redirectTo: "/reset-password" } });
    expect(request.status).toBe(200);
    const mail = await waitForMail(email, "reset-password");

    const landing = await call(mail.link!, { origin: null });
    expect(landing.status).toBe(302);
    const token = new URL(landing.res.headers.get("location")!, "http://x").searchParams.get("token");
    expect(token).toBeTruthy();

    const newPassword = strongPassword();
    expect((await call("/reset-password", { body: { newPassword, token } })).status).toBe(200);

    expect((await call("/get-session", { jar: oldSession })).json).toBeNull();
    expect((await call("/sign-in/email", { body: { email, password } })).status).toBe(401);
    expect((await call("/sign-in/email", { body: { email, password: newPassword } })).status).toBe(200);
  });

  it("answers identically for unknown addresses and sends nothing", async () => {
    const email = uniqueEmail("reset-unknown");
    const res = await call("/request-password-reset", { body: { email, redirectTo: "/reset-password" } });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 500));
    expect(await countMail(email, "reset-password")).toBe(0);
  });

  it("refuses a reused reset token", async () => {
    const { email } = await createVerifiedUser("reset-reuse");
    await call("/request-password-reset", { body: { email, redirectTo: "/reset-password" } });
    const mail = await waitForMail(email, "reset-password");
    const landing = await call(mail.link!, { origin: null });
    const token = new URL(landing.res.headers.get("location")!, "http://x").searchParams.get("token");
    expect((await call("/reset-password", { body: { newPassword: strongPassword(), token } })).status).toBe(200);
    expect((await call("/reset-password", { body: { newPassword: strongPassword(), token } })).status).toBe(400);
  });

  it("throttles reset emails to one address", async () => {
    const { email } = await createVerifiedUser("reset-flood");
    for (let i = 0; i < 6; i++) {
      await call("/request-password-reset", { body: { email, redirectTo: "/reset-password" } });
    }
    await new Promise((r) => setTimeout(r, 1000));
    expect(await countMail(email, "reset-password")).toBe(3);
  });
});

describe("suspension", () => {
  it("lets an admin suspend a customer, which ends their sessions and blocks sign-in", async () => {
    const adminUser = await createVerifiedUser("admin");
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [adminUser.email]);
    const adminJar = new CookieJar();
    await call("/sign-in/email", { body: { email: adminUser.email, password: adminUser.password }, jar: adminJar });

    const target = await createVerifiedUser("suspend-me");
    const { rows } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [target.email]);

    // Suspension is a server-side operation (the staff console's action calls this
    // after its own checks); the admin plugin is not reachable over HTTP.
    await auth.api.banUser({ headers: new Headers({ cookie: adminJar.header() }), body: { userId: rows[0].id, banReason: "test" } });

    expect((await call("/get-session", { jar: target.jar })).json).toBeNull();
    const signIn = await call("/sign-in/email", { body: { email: target.email, password: target.password } });
    expect(signIn.status).toBe(403);
    expect(signIn.json?.message).toMatch(/suspended/);
  });

  it("does not let a customer call admin endpoints", async () => {
    const customer = await createVerifiedUser("not-admin");
    // Over HTTP the admin plugin does not exist at all...
    const res = await call("/admin/list-users", { jar: customer.jar });
    expect(res.status).toBe(404);
    // ...and server-side the customer's session holds no admin permission.
    await expect(auth.api.banUser({ headers: new Headers({ cookie: customer.jar.header() }), body: { userId: "anyone" } })).rejects.toMatchObject({ status: "FORBIDDEN" });
  });
});
