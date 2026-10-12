import { describe, expect, it, vi } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";
import { isExposedAuthPath } from "@/lib/auth-http-surface";
import { BreachCheckUnavailableError, isBreachedPassword } from "@/lib/breached-password";
import { optionalCookiesAllowed, readCookieChoice, serializeCookieChoice } from "@/lib/cookie-consent";
import { currentConsent, isCurrentConsent, LEGAL_VERSIONS } from "@/lib/legal";
import type { RoleName } from "@/lib/permissions";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";
import { decideStaffOperation, type StaffOperation } from "@/lib/staff-policy";
import { escapeLike, normalizeDirectoryQuery, parseBanReason, parsePage, parseSearch, parseUserId } from "@/lib/staff/query";

/* ------------------------------------------------------------------ */
/* Staff policy                                                        */
/* ------------------------------------------------------------------ */

type R = RoleName | null;
const actor = (role: R) => ({ id: "actor", role });
const target = (role: R, banned = false) => ({ id: "target", role, banned });

function decide(actorRole: R, targetRole: R, operation: StaffOperation, opts: { banned?: boolean; newRole?: unknown; adminCount?: number } = {}) {
  return decideStaffOperation({
    actor: actor(actorRole),
    target: target(targetRole, opts.banned ?? operation === "reinstate"),
    operation,
    newRole: opts.newRole,
    adminCount: opts.adminCount ?? 2,
  });
}

describe("staff policy: who may do what to whom", () => {
  const ACTORS: R[] = ["customer", "employee", "admin", null];
  const TARGETS: R[] = ["customer", "employee", "admin", null];

  // Written out in full: every allowed combination. Everything else must be denied.
  const ALLOWED = new Set([
    "employee suspend customer",
    "employee reinstate customer",
    "admin suspend customer",
    "admin reinstate customer",
    "admin suspend employee",
    "admin reinstate employee",
    "admin suspend null",
    "admin reinstate null",
    "admin delete customer",
    "admin delete employee",
    "admin delete null",
  ]);

  for (const a of ACTORS) {
    for (const t of TARGETS) {
      for (const op of ["suspend", "reinstate", "delete"] as const) {
        const key = `${a} ${op} ${t}`;
        it(`${ALLOWED.has(key) ? "allows" : "denies"}: ${key}`, () => {
          expect(decide(a, t, op).allowed).toBe(ALLOWED.has(key));
        });
      }
    }
  }

  it("never lets anyone act on their own account", () => {
    for (const role of ["employee", "admin"] as const) {
      for (const op of ["suspend", "reinstate", "delete", "set-role"] as const) {
        const d = decideStaffOperation({ actor: { id: "me", role }, target: { id: "me", role, banned: op === "reinstate" }, operation: op, newRole: "admin", adminCount: 5 });
        expect(d).toEqual({ allowed: false, reason: "self" });
      }
    }
  });

  it("only admins change roles, and only to a real single role", () => {
    expect(decide("employee", "customer", "set-role", { newRole: "employee" }).allowed).toBe(false);
    expect(decide("customer", "customer", "set-role", { newRole: "employee" }).allowed).toBe(false);
    expect(decide(null, "customer", "set-role", { newRole: "employee" }).allowed).toBe(false);
    expect(decide("admin", "customer", "set-role", { newRole: "employee" })).toEqual({ allowed: true, newRole: "employee" });
    expect(decide("admin", "employee", "set-role", { newRole: "admin" })).toEqual({ allowed: true, newRole: "admin" });
    expect(decide("admin", null, "set-role", { newRole: "customer" })).toEqual({ allowed: true, newRole: "customer" });
    for (const bad of ["superadmin", "admin,customer", "Admin", " admin", "", ["admin"], { role: "admin" }, null, undefined, 1]) {
      expect(decide("admin", "customer", "set-role", { newRole: bad })).toEqual({ allowed: false, reason: "invalid-role" });
    }
    expect(decide("admin", "employee", "set-role", { newRole: "employee" })).toEqual({ allowed: false, reason: "unchanged" });
  });

  it("protects the last administrator", () => {
    expect(decide("admin", "admin", "set-role", { newRole: "employee", adminCount: 1 })).toEqual({ allowed: false, reason: "last-admin" });
    expect(decide("admin", "admin", "set-role", { newRole: "employee", adminCount: 2 }).allowed).toBe(true);
  });

  it("refuses missing targets and pointless state changes", () => {
    expect(decideStaffOperation({ actor: actor("admin"), target: null, operation: "suspend" })).toEqual({ allowed: false, reason: "target-not-found" });
    expect(decide("employee", "customer", "suspend", { banned: true })).toEqual({ allowed: false, reason: "already-suspended" });
    expect(decide("employee", "customer", "reinstate", { banned: false })).toEqual({ allowed: false, reason: "not-suspended" });
  });

  it("never protects-by-default fail open for a staff-looking but unrecognised actor", () => {
    for (const op of ["suspend", "reinstate", "delete", "set-role"] as const) {
      expect(decide(null, "customer", op, { newRole: "employee" })).toEqual({ allowed: false, reason: "not-permitted" });
    }
  });
});

/* ------------------------------------------------------------------ */
/* Staff console input parsing                                         */
/* ------------------------------------------------------------------ */

describe("staff console input parsing", () => {
  it("escapes LIKE wildcards so searches are literal", () => {
    expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });

  it.each([
    [undefined, 1], ["", 1], ["0", 1], ["-3", 1], ["2", 2], ["1e5", 1], ["2abc", 1], ["99999999", 1], ["10001", 10000], [["3"], 1], [{}, 1],
  ])("parsePage(%j) = %i", (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });

  it("cleans and caps search text", () => {
    expect(parseSearch("  ah \t beng  ")).toBe("ah beng");
    expect(parseSearch("x\u0000y\u001fz")).toBe("x y z");
    expect(parseSearch("a".repeat(500))).toHaveLength(100);
    expect(parseSearch(["a"])).toBe("");
  });

  it("forces employees to the customer list whatever the URL says", () => {
    for (const scope of ["staff", "all", "customers", "admin", undefined]) {
      expect(normalizeDirectoryQuery({ scope }, false).scope).toBe("customers");
    }
    expect(normalizeDirectoryQuery({ scope: "staff" }, true).scope).toBe("staff");
    expect(normalizeDirectoryQuery({ scope: "all" }, true).scope).toBe("all");
    expect(normalizeDirectoryQuery({ scope: "everyone" }, true).scope).toBe("customers");
  });

  it("accepts only listed suspension reasons", () => {
    expect(parseBanReason("security")).toBe("security");
    for (const bad of ["", "Security", "__proto__", "toString", "<script>", null, 1]) expect(parseBanReason(bad)).toBeNull();
  });

  it("accepts only id-shaped user ids", () => {
    expect(parseUserId("Ab3_x-9")).toBe("Ab3_x-9");
    for (const bad of ["' OR 1=1 --", "a b", "../x", "x".repeat(129), "", "é", null, 42, ["id"]]) expect(parseUserId(bad)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* HTTP surface                                                        */
/* ------------------------------------------------------------------ */

describe("auth HTTP surface allowlist", () => {
  const open = (m: string, p: string, dash = false) => isExposedAuthPath(m, p, { dashEnabled: dash });

  it("exposes exactly the endpoints the pages use", () => {
    for (const p of ["/sign-up/email", "/sign-in/email", "/sign-out", "/request-password-reset", "/reset-password", "/send-verification-email", "/change-password"]) {
      expect(open("POST", p), p).toBe(true);
    }
    for (const p of ["/verify-email", "/ok", "/error", "/reset-password/abcDEF123_-"]) expect(open("GET", p), p).toBe(true);
  });

  it.each([
    ["POST", "/admin/ban-user"], ["GET", "/admin/list-users"], ["POST", "/admin/impersonate-user"], ["GET", "/get-session"],
    ["GET", "/list-sessions"], ["POST", "/update-user"], ["POST", "/delete-user"], ["POST", "/revoke-sessions"],
    ["POST", "/sign-in/email/"], ["POST", "/Sign-In/Email"], ["POST", "/%61dmin/ban-user"], ["GET", "/sign-in/email"],
    ["PUT", "/sign-in/email"], ["DELETE", "/sign-out"], ["GET", "/reset-password/../admin"], ["GET", "/reset-password/"],
    ["POST", "/dash/user/ban"], ["GET", "/events/list"],
  ])("refuses %s %s", (method, path) => {
    expect(open(method, path)).toBe(false);
  });

  it("exposes Better Auth Infrastructure endpoints only when it is configured", () => {
    expect(open("POST", "/dash/user/ban", true)).toBe(true);
    expect(open("GET", "/events/list", true)).toBe(true);
    expect(open("POST", "/dash/../admin/ban-user", true)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Consent                                                             */
/* ------------------------------------------------------------------ */

describe("registration consent", () => {
  it("accepts only explicit agreement to the current versions", () => {
    expect(isCurrentConsent(currentConsent())).toBe(true);
    expect(isCurrentConsent({ ...currentConsent(), extra: true })).toBe(true);
    for (const bad of [
      true, "yes", null, undefined, {}, [], [LEGAL_VERSIONS.terms, LEGAL_VERSIONS.privacy],
      { terms: LEGAL_VERSIONS.terms }, { privacy: LEGAL_VERSIONS.privacy },
      { terms: "2020-01-01", privacy: LEGAL_VERSIONS.privacy }, { terms: true, privacy: true },
    ]) {
      expect(isCurrentConsent(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("explains a missing consent and an unavailable breach check", () => {
    expect(authErrorMessage({ status: 400, code: "CONSENT_REQUIRED" }, "sign-up")).toMatch(/Terms of Service and Privacy Policy/);
    expect(authErrorMessage({ status: 503, code: "BREACH_CHECK_UNAVAILABLE" }, "sign-up")).toMatch(/try again in a moment/);
  });
});

describe("cookie notice choice", () => {
  it("reads only valid choices from the cookie header", () => {
    expect(readCookieChoice("a=1; jsc_cookie_choice=essential; b=2")).toBe("essential");
    expect(readCookieChoice("jsc_cookie_choice=all")).toBe("all");
    for (const bad of ["", null, undefined, "jsc_cookie_choice=yes", "jsc_cookie_choice=", "other=all", "xjsc_cookie_choice=all"]) {
      expect(readCookieChoice(bad)).toBeNull();
    }
  });

  it("keeps optional cookies off unless the visitor accepted all", () => {
    expect(optionalCookiesAllowed(null)).toBe(false);
    expect(optionalCookiesAllowed("essential")).toBe(false);
    expect(optionalCookiesAllowed("all")).toBe(true);
  });

  it("writes a first-party cookie, Secure on HTTPS", () => {
    expect(serializeCookieChoice("essential", false)).toBe("jsc_cookie_choice=essential; Max-Age=15552000; Path=/; SameSite=Lax");
    expect(serializeCookieChoice("all", true)).toMatch(/; Secure$/);
  });
});

/* ------------------------------------------------------------------ */
/* Security headers                                                    */
/* ------------------------------------------------------------------ */

describe("security headers", () => {
  const prod = contentSecurityPolicy({ dev: false, httpsOnly: true });

  it("blocks framing, plugins, base hijacking, foreign forms and foreign script origins", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toMatch(/script-src 'self' 'unsafe-inline'(;|$)/);
    expect(prod).toContain("connect-src 'self';");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("never allows eval outside development", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ dev: true, httpsOnly: false })).toContain("'unsafe-eval'");
  });

  it("sends HSTS and upgrade-insecure-requests only on HTTPS deployments", () => {
    const local = securityHeaders({ dev: false, httpsOnly: false });
    expect(local.find((h) => h.key === "Strict-Transport-Security")).toBeUndefined();
    expect(local.find((h) => h.key === "Content-Security-Policy")?.value).not.toContain("upgrade-insecure-requests");
    const live = securityHeaders({ dev: false, httpsOnly: true });
    expect(live.find((h) => h.key === "Strict-Transport-Security")?.value).toBe("max-age=63072000; includeSubDomains");
    const keys = live.map((h) => h.key);
    for (const k of ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy", "Cross-Origin-Opener-Policy"]) expect(keys).toContain(k);
  });
});

/* ------------------------------------------------------------------ */
/* Breached-password check                                             */
/* ------------------------------------------------------------------ */

describe("breached-password check", () => {
  // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  const PREFIX = "5BAA6";
  const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

  it("sends only the 5-character hash prefix, never the password or full hash", async () => {
    const fetchImpl = vi.fn(async () => new Response(`${SUFFIX}:3861493\r\nAAAA:0`));
    expect(await isBreachedPassword("password", { fetchImpl })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    // The only caller-supplied part of the request is the 5-character prefix.
    expect(new URL(url).pathname.split("/").pop()).toBe(PREFIX);
    expect(url).not.toContain(SUFFIX);
    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });

  it("ignores padding entries and non-matching hashes", async () => {
    expect(await isBreachedPassword("password", { fetchImpl: async () => new Response(`${SUFFIX}:0\r\nFFFF:12`) })).toBe(false);
    expect(await isBreachedPassword("password", { fetchImpl: async () => new Response("FFFF:12") })).toBe(false);
  });

  it("fails closed when the service errors or times out", async () => {
    await expect(isBreachedPassword("password", { fetchImpl: async () => new Response("down", { status: 503 }) })).rejects.toBeInstanceOf(BreachCheckUnavailableError);
    await expect(isBreachedPassword("password", { fetchImpl: async () => { throw new TypeError("network"); } })).rejects.toBeInstanceOf(BreachCheckUnavailableError);
    const hang = (_: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    await expect(isBreachedPassword("password", { fetchImpl: hang, timeoutMs: 50 })).rejects.toBeInstanceOf(BreachCheckUnavailableError);
  });
});
