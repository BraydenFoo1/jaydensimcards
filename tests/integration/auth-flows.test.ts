/**
 * Server behaviour the Phase 3B pages rely on: callback/redirect validation,
 * link error routing, and privacy-preserving resend.
 */
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { verifyCallbackURL } from "@/lib/redirects";
import { CookieJar, call, cleanupTestUsers, countMail, createVerifiedUser, strongPassword, uniqueEmail, waitForMail } from "./helpers";

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});

const locationOf = (res: Response) => new URL(res.headers.get("location") ?? "", "http://localhost:3000");

describe("redirect targets are validated server-side", () => {
  it("rejects a sign-up whose verification callback points to another site", async () => {
    const res = await call("/sign-up/email", {
      body: { name: "X", email: uniqueEmail("cb-evil"), password: strongPassword(), callbackURL: "https://evil.example/steal" },
    });
    expect(res.status).toBe(403);
    expect(res.json?.code).toBe("INVALID_CALLBACK_URL");
  });

  it("rejects a password-reset request that would redirect to another site", async () => {
    const { email } = await createVerifiedUser("redirect-evil");
    const res = await call("/request-password-reset", { body: { email, redirectTo: "https://evil.example/reset" } });
    expect(res.status).toBe(403);
    await new Promise((r) => setTimeout(r, 300));
    expect(await countMail(email, "reset-password")).toBe(0);
  });

  it("rejects a sign-in callback that points to another site", async () => {
    const { email, password } = await createVerifiedUser("signin-evil");
    const res = await call("/sign-in/email", { body: { email, password, callbackURL: "//evil.example" } });
    expect(res.status).toBe(403);
  });

  it("returns the safe callback for the client to follow after sign-in", async () => {
    const { email, password } = await createVerifiedUser("signin-cb");
    const res = await call("/sign-in/email", { body: { email, password, callbackURL: "/portal?plan=ultra" } });
    expect(res.status).toBe(200);
    expect(res.json?.redirect).toBe(true);
    expect(res.json?.url).toBe("/portal?plan=ultra");
  });
});

describe("verification links", () => {
  it("embeds the confirmation page and destination in the emailed link", async () => {
    const email = uniqueEmail("cb-keep");
    await call("/sign-up/email", {
      body: { name: "K", email, password: strongPassword(), callbackURL: verifyCallbackURL("/portal?plan=ultra", true) },
    });
    const mail = await waitForMail(email, "verify-email");
    const callback = new URL(mail.link!).searchParams.get("callbackURL");
    expect(callback).toBe("/verify-email?next=%2Fportal%3Fplan%3Dultra&confirmed=1");
  });

  it("lands on the confirmation page signed in after a valid link", async () => {
    const email = uniqueEmail("cb-ok");
    await call("/sign-up/email", { body: { name: "K", email, password: strongPassword(), callbackURL: verifyCallbackURL("/portal", true) } });
    const mail = await waitForMail(email, "verify-email");
    const jar = new CookieJar();
    const res = await call(mail.link!, { jar, origin: null });
    expect(res.status).toBe(302);
    expect(locationOf(res.res).pathname).toBe("/verify-email");
    expect(locationOf(res.res).searchParams.get("confirmed")).toBe("1");
    expect(jar.has("jsc.session_token")).toBe(true);
  });

  it("routes a tampered link to the verify page with an error and no session", async () => {
    const callbackURL = encodeURIComponent(verifyCallbackURL("/portal", true));
    const jar = new CookieJar();
    const res = await call(`/verify-email?token=not-a-real-token&callbackURL=${callbackURL}`, { jar, origin: null });
    expect(res.status).toBe(302);
    const location = locationOf(res.res);
    expect(location.pathname).toBe("/verify-email");
    expect(location.searchParams.get("error")).toBe("INVALID_TOKEN");
    expect(location.searchParams.get("next")).toBe("/portal");
    expect(jar.has("jsc.session_token")).toBe(false);
  });

  it("re-sends a link when an unverified user tries to sign in, keeping their destination", async () => {
    const email = uniqueEmail("signin-resend");
    const password = strongPassword();
    await call("/sign-up/email", { body: { name: "R", email, password } });
    await waitForMail(email, "verify-email");

    const res = await call("/sign-in/email", { body: { email, password, callbackURL: "/portal?plan=exam" } });
    expect(res.status).toBe(403);
    await new Promise((r) => setTimeout(r, 300));
    expect(await countMail(email, "verify-email")).toBe(2);
  });
});

describe("resending verification does not reveal accounts", () => {
  it("answers identically for unknown, unverified and verified addresses", async () => {
    const unknown = uniqueEmail("resend-unknown");
    const unverified = uniqueEmail("resend-unverified");
    await call("/sign-up/email", { body: { name: "U", email: unverified, password: strongPassword() } });
    await waitForMail(unverified, "verify-email");
    const { email: verified } = await createVerifiedUser("resend-verified");

    const responses = [];
    for (const email of [unknown, unverified, verified]) {
      responses.push(await call("/send-verification-email", { body: { email, callbackURL: verifyCallbackURL("/portal", true) } }));
    }
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ status: true });
    }

    await new Promise((r) => setTimeout(r, 500));
    expect(await countMail(unknown, "verify-email")).toBe(0);
    expect(await countMail(verified, "verify-email")).toBe(1); // only the original sign-up email
    expect(await countMail(unverified, "verify-email")).toBe(2);
  });
});

describe("password reset links", () => {
  it("sends an invalid link to the reset page with an error", async () => {
    const res = await call(`/reset-password/not-a-token?callbackURL=${encodeURIComponent("/reset-password")}`, { origin: null });
    expect(res.status).toBe(302);
    const location = locationOf(res.res);
    expect(location.pathname).toBe("/reset-password");
    expect(location.searchParams.get("error")).toBe("INVALID_TOKEN");
    expect(location.searchParams.has("token")).toBe(false);
  });

  it("hands a valid token to the reset page in a format the page accepts", async () => {
    const { email } = await createVerifiedUser("reset-format");
    await call("/request-password-reset", { body: { email, redirectTo: "/reset-password" } });
    const mail = await waitForMail(email, "reset-password");
    const res = await call(mail.link!, { origin: null });
    const token = locationOf(res.res).searchParams.get("token");
    // Mirrors the format check in src/app/(auth)/reset-password/page.tsx.
    expect(token).toMatch(/^[A-Za-z0-9_-]{8,256}$/);
  });
});
