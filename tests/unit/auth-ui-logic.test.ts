import { describe, expect, it } from "vitest";
import { authErrorMessage, linkErrorMessage, rateLimitMessage } from "@/lib/auth-errors";
import { firstParam, planNextPath, safeNextPath, verifyCallbackURL } from "@/lib/redirects";
import { validateNewPassword, validateRegistration, validateSignIn } from "@/lib/validation";

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["/portal", "/portal"],
    ["/portal?plan=ultra", "/portal?plan=ultra"],
    ["/staff/people#top", "/staff/people#top"],
    ["  /portal  ", "/portal"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/\r\nSet-Cookie:x",
    "/\u0000/evil",
    "/\tevil",
    "portal",
    "",
    "/api/auth/sign-out",
    "/api",
    "/login",
    "/register?next=/portal",
    "/reset-password?token=abc",
    "/" + "a".repeat(600),
  ])("rejects %j", (input) => {
    expect(safeNextPath(input)).toBe("/portal");
  });

  it("rejects non-strings and honours a custom fallback", () => {
    expect(safeNextPath(undefined)).toBe("/portal");
    expect(safeNextPath(["/portal"])).toBe("/portal");
    expect(safeNextPath("https://evil.example", "/")).toBe("/");
  });

  it("normalises dot segments without escaping the origin", () => {
    expect(safeNextPath("/portal/../staff")).toBe("/staff");
    expect(safeNextPath("/../../etc/passwd")).toBe("/etc/passwd");
  });

  it("decodes encoded CRLF safely rather than passing it to a header", () => {
    // %0d%0a stays percent-encoded in the path; it can never split a header.
    expect(safeNextPath("/portal%0d%0aLocation:https://evil.example")).toBe("/portal%0d%0aLocation:https://evil.example");
  });
});

describe("redirect helpers", () => {
  it("takes the first value of array params", () => {
    expect(firstParam(["/a", "/b"])).toBe("/a");
    expect(firstParam("/a")).toBe("/a");
    expect(firstParam(undefined)).toBeUndefined();
  });

  it("accepts only plain plan ids", () => {
    expect(planNextPath("ultra")).toBe("/portal?plan=ultra");
    expect(planNextPath("tuffest67g")).toBe("/portal?plan=tuffest67g");
    expect(planNextPath("../admin")).toBeUndefined();
    expect(planNextPath("ULTRA")).toBeUndefined();
    expect(planNextPath(undefined)).toBeUndefined();
  });

  it("builds a verification callback that keeps the destination", () => {
    expect(verifyCallbackURL("/portal?plan=ultra")).toBe("/verify-email?next=%2Fportal%3Fplan%3Dultra");
    expect(verifyCallbackURL("/portal", true)).toBe("/verify-email?next=%2Fportal&confirmed=1");
  });
});

describe("auth error messages", () => {
  it("uses one message for a wrong password and an unknown account", () => {
    const a = authErrorMessage({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }, "sign-in");
    const b = authErrorMessage({ status: 401, code: "USER_NOT_FOUND" }, "sign-in");
    const c = authErrorMessage({ status: 401, code: "INVALID_PASSWORD" }, "sign-in");
    expect(a).toBe("Email or password is incorrect.");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("never says an account does not exist outside sign-in either", () => {
    for (const action of ["forgot-password", "resend-verification", "sign-up"] as const) {
      expect(authErrorMessage({ status: 400, code: "USER_NOT_FOUND" }, action)).not.toMatch(/not found|no account|doesn.t exist/i);
    }
  });

  it("explains rate limits with the wait time", () => {
    expect(authErrorMessage({ status: 429 }, "sign-in", 42)).toBe("Too many attempts. Please wait 42 seconds and try again.");
    expect(rateLimitMessage(1)).toMatch(/1 second and/);
    expect(rateLimitMessage(600)).toMatch(/10 minutes/);
    expect(rateLimitMessage()).toMatch(/a few minutes/);
  });

  it("ignores implausible retry-after values instead of printing them", () => {
    // Regression: a corrupted header once produced "wait 2985615581750 minutes".
    expect(rateLimitMessage(179138725376860)).toBe("Too many attempts. Please wait a few minutes and try again.");
    expect(rateLimitMessage(Number.NaN)).toMatch(/a few minutes/);
    expect(rateLimitMessage(-5)).toMatch(/a few minutes/);
  });

  it("maps verification, suspension, breach and token errors", () => {
    expect(authErrorMessage({ status: 403, code: "EMAIL_NOT_VERIFIED" }, "sign-in")).toMatch(/confirm your email/);
    expect(authErrorMessage({ status: 403, code: "BANNED_USER" }, "sign-in")).toMatch(/suspended/);
    expect(authErrorMessage({ status: 400, code: "PASSWORD_COMPROMISED" }, "sign-up")).toMatch(/data breach/);
    expect(authErrorMessage({ status: 400, code: "INVALID_TOKEN" }, "reset-password")).toMatch(/invalid or has expired/);
    expect(authErrorMessage({ status: 403, code: "INVALID_ORIGIN" }, "sign-in")).toMatch(/blocked for your security/);
  });

  it("falls back to friendly generic and network messages", () => {
    expect(authErrorMessage({ status: 500 }, "sign-up")).toMatch(/our side/);
    expect(authErrorMessage({ status: 400, code: "SOMETHING_NEW" }, "reset-password")).toMatch(/couldn't update your password/);
    expect(authErrorMessage(null, "sign-in")).toMatch(/couldn't reach the network/);
  });

  it("describes failed verification and reset links", () => {
    expect(linkErrorMessage(undefined)).toBeNull();
    expect(linkErrorMessage("TOKEN_EXPIRED")).toMatch(/expired/);
    expect(linkErrorMessage("INVALID_TOKEN")).toMatch(/invalid/);
    expect(linkErrorMessage("USER_NOT_FOUND")).toMatch(/invalid/);
  });
});

describe("form validation", () => {
  const ok = { name: "Ah Beng", email: "ah.beng@example.com", password: "a-long-passphrase", confirm: "a-long-passphrase", acknowledged: true, agreed: true };

  it("accepts a valid registration", () => {
    expect(validateRegistration(ok)).toEqual({});
  });

  it("reports every registration problem at once", () => {
    const errors = validateRegistration({ name: " ", email: "nope", password: "short", confirm: "different", acknowledged: false, agreed: false });
    expect(Object.keys(errors).sort()).toEqual(["acknowledged", "agreed", "confirm", "email", "name", "password"]);
  });

  it("enforces the server's password length limits", () => {
    expect(validateRegistration({ ...ok, password: "123456789", confirm: "123456789" }).password).toMatch(/at least 10/);
    const long = "x".repeat(129);
    expect(validateRegistration({ ...ok, password: long, confirm: long }).password).toMatch(/128/);
  });

  it("only checks presence of the password at sign-in", () => {
    expect(validateSignIn({ email: "a@b.co", password: "x" })).toEqual({});
    expect(validateSignIn({ email: "", password: "" })).toEqual({ email: expect.any(String), password: expect.any(String) });
  });

  it("validates a new password and its confirmation", () => {
    expect(validateNewPassword({ password: "a-long-passphrase", confirm: "a-long-passphrase" })).toEqual({});
    expect(validateNewPassword({ password: "a-long-passphrase", confirm: "nope" }).confirm).toMatch(/don't match/);
  });
});
