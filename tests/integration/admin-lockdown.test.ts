/**
 * Regression suite for the Phase 3D finding: an employee could call Better
 * Auth's admin plugin directly to ban an admin and read raw session tokens.
 */
import { afterAll, describe, expect, it } from "vitest";
import { GET as routeGET, POST as routePOST } from "@/app/api/auth/[...all]/route";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { call, cleanupTestUsers, createUserWithRole, createVerifiedUser, ORIGIN, outcome, randomIp, strongPassword } from "./helpers";

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});

const userRow = async (id: string) =>
  (await pool.query<{ role: string | null; banned: boolean | null }>(`SELECT role, banned FROM "user" WHERE id = $1`, [id])).rows[0];

/** Calls the real Next.js route handler, i.e. exactly what a browser or script reaches. */
async function viaRoute(method: "GET" | "POST", authPath: string, opts: { cookie?: string; body?: unknown } = {}) {
  const headers = new Headers({ origin: ORIGIN, "x-forwarded-for": randomIp() });
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const handler = method === "GET" ? routeGET : routePOST;
  return handler(
    new Request(`${ORIGIN}/api/auth${authPath}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
  );
}

const ADMIN_PLUGIN_PATHS = [
  "/admin/set-role", "/admin/get-user", "/admin/create-user", "/admin/update-user", "/admin/list-users",
  "/admin/list-user-sessions", "/admin/unban-user", "/admin/ban-user", "/admin/impersonate-user",
  "/admin/stop-impersonating", "/admin/revoke-user-session", "/admin/revoke-user-sessions",
  "/admin/remove-user", "/admin/set-user-password", "/admin/has-permission",
];

describe("HTTP surface: the auth route only exposes what the pages use", () => {
  it("returns 404 for every admin-plugin endpoint, even to an administrator", async () => {
    const admin = await createUserWithRole("http-admin", "admin");
    const victim = await createUserWithRole("http-victim", "customer");
    for (const path of ADMIN_PLUGIN_PATHS) {
      for (const method of ["GET", "POST"] as const) {
        const res = await viaRoute(method, path, { cookie: admin.jar.header(), body: method === "POST" ? { userId: victim.id, role: "admin" } : undefined });
        expect(res.status, `${method} ${path}`).toBe(404);
      }
    }
    expect(await userRow(victim.id)).toEqual({ role: "customer", banned: false });
  });

  it.each([
    ["GET", "/get-session"], ["GET", "/list-sessions"], ["POST", "/revoke-session"], ["POST", "/revoke-sessions"],
    ["POST", "/revoke-other-sessions"], ["POST", "/update-user"], ["POST", "/delete-user"], ["POST", "/change-email"],
    ["POST", "/admin%2Fban-user"], ["POST", "/%61dmin/ban-user"], ["POST", "/sign-in/email/"], ["POST", "/SIGN-IN/EMAIL"],
    ["PUT", "/sign-in/email"], ["GET", "/sign-in/email"], ["POST", "/verify-email"], ["GET", "/reset-password/../admin/list-users"],
  ])("refuses %s %s", async (method, path) => {
    const res = await (method === "GET" ? viaRoute("GET", path) : method === "POST" ? viaRoute("POST", path, { body: {} }) : routePOST(new Request(`${ORIGIN}/api/auth${path}`, { method })));
    expect(res.status).toBe(404);
  });

  it("still serves the endpoints the pages use", async () => {
    expect((await viaRoute("GET", "/ok")).status).toBe(200);
    const signIn = await viaRoute("POST", "/sign-in/email", { body: { email: "nobody@jsc-test.example.com", password: strongPassword() } });
    expect(signIn.status).toBe(401);
    const reset = await viaRoute("POST", "/request-password-reset", { body: { email: "nobody@jsc-test.example.com", redirectTo: "/reset-password" } });
    expect(reset.status).toBe(200);
  });
});

describe("Better Auth itself refuses admin endpoints that arrive over the network", () => {
  it("answers 404 for an administrator's direct request", async () => {
    const admin = await createUserWithRole("hook-admin", "admin");
    const customer = await createUserWithRole("hook-customer", "customer");
    const res = await call("/admin/ban-user", { body: { userId: customer.id }, jar: admin.jar });
    expect(res.status).toBe(404);
    expect((await userRow(customer.id)).banned).toBe(false);
  });

  it("the original exploit is closed: an employee can no longer ban an admin or read session tokens", async () => {
    const employee = await createUserWithRole("exploit-employee", "employee");
    const admin = await createUserWithRole("exploit-admin", "admin");
    const sessions = await call("/admin/list-user-sessions", { body: { userId: admin.id }, jar: employee.jar });
    expect(sessions.status).toBe(404);
    expect(JSON.stringify(sessions.json)).not.toContain("token");
    const ban = await call("/admin/ban-user", { body: { userId: admin.id }, jar: employee.jar });
    expect(ban.status).toBe(404);
    expect((await userRow(admin.id)).banned).toBe(false);
  });
});

describe("server-side admin calls are re-checked against the staff policy", () => {
  it("employee: may suspend and reinstate a customer, nothing else", async () => {
    const employee = await createUserWithRole("pol-employee", "employee");
    const customer = await createUserWithRole("pol-customer", "customer");
    const otherEmployee = await createUserWithRole("pol-employee2", "employee");
    const admin = await createUserWithRole("pol-admin", "admin");
    const h = employee.headers;

    expect(await outcome(() => auth.api.banUser({ headers: h, body: { userId: customer.id } }))).toEqual({ ok: true });
    expect((await userRow(customer.id)).banned).toBe(true);
    expect(await outcome(() => auth.api.unbanUser({ headers: h, body: { userId: customer.id } }))).toEqual({ ok: true });

    const denied = { ok: false, status: "FORBIDDEN", code: "STAFF_POLICY_DENIED" };
    expect(await outcome(() => auth.api.banUser({ headers: h, body: { userId: admin.id } }))).toEqual(denied);
    expect(await outcome(() => auth.api.banUser({ headers: h, body: { userId: otherEmployee.id } }))).toEqual(denied);
    expect(await outcome(() => auth.api.banUser({ headers: h, body: { userId: employee.id } }))).toEqual(denied);
    expect(await outcome(() => auth.api.removeUser({ headers: h, body: { userId: admin.id } }))).toEqual(denied);
    expect(await outcome(() => auth.api.removeUser({ headers: h, body: { userId: customer.id } }))).toEqual(denied);
    expect(await outcome(() => auth.api.setRole({ headers: h, body: { userId: employee.id, role: "admin" } }))).toEqual(denied);
    expect(await outcome(() => auth.api.setRole({ headers: h, body: { userId: customer.id, role: "admin" } }))).toEqual(denied);
    expect(await outcome(() => auth.api.setRole({ headers: h, body: { userId: admin.id, role: "customer" } }))).toEqual(denied);

    expect(await userRow(admin.id)).toEqual({ role: "admin", banned: false });
    expect(await userRow(employee.id)).toEqual({ role: "employee", banned: false });
    expect((await userRow(customer.id)).role).toBe("customer");
  });

  it("customer and unrecognised roles: every admin operation is refused", async () => {
    const target = await createUserWithRole("pol-target", "customer");
    for (const role of ["customer", "superadmin", "admin,customer", "Admin", ""]) {
      const actor = await createUserWithRole(`pol-${role.replace(/\W/g, "").toLowerCase() || "empty"}`, role);
      for (const run of [
        () => auth.api.banUser({ headers: actor.headers, body: { userId: target.id } }),
        () => auth.api.setRole({ headers: actor.headers, body: { userId: actor.id, role: "admin" } }),
        () => auth.api.removeUser({ headers: actor.headers, body: { userId: target.id } }),
      ]) {
        const result = await outcome(run);
        expect(result.ok, `role ${JSON.stringify(role)}`).toBe(false);
      }
      expect((await userRow(actor.id)).role).toBe(role);
    }
    expect(await userRow(target.id)).toEqual({ role: "customer", banned: false });
  });

  it("admin: the defined operations work; admins themselves stay protected", async () => {
    const admin = await createUserWithRole("pol-admin-a", "admin");
    const otherAdmin = await createUserWithRole("pol-admin-b", "admin");
    const employee = await createUserWithRole("pol-staff", "employee");
    const customer = await createUserWithRole("pol-cust", "customer");
    const h = admin.headers;

    expect(await outcome(() => auth.api.banUser({ headers: h, body: { userId: employee.id } }))).toEqual({ ok: true });
    expect(await outcome(() => auth.api.unbanUser({ headers: h, body: { userId: employee.id } }))).toEqual({ ok: true });
    expect(await outcome(() => auth.api.setRole({ headers: h, body: { userId: customer.id, role: "employee" } }))).toEqual({ ok: true });
    expect((await userRow(customer.id)).role).toBe("employee");
    expect(await outcome(() => auth.api.setRole({ headers: h, body: { userId: customer.id, role: "customer" } }))).toEqual({ ok: true });

    const denied = { ok: false, status: "FORBIDDEN", code: "STAFF_POLICY_DENIED" };
    expect(await outcome(() => auth.api.banUser({ headers: h, body: { userId: otherAdmin.id } }))).toEqual(denied);
    expect(await outcome(() => auth.api.removeUser({ headers: h, body: { userId: otherAdmin.id } }))).toEqual(denied);
    expect(await outcome(() => auth.api.setRole({ headers: h, body: { userId: admin.id, role: "employee" } }))).toEqual(denied);
    for (const role of ["superadmin", "admin,customer", ["admin"], "", null]) {
      // Deliberately invalid values, as a forged request would send them.
      const forged = { userId: customer.id, role } as unknown as { userId: string; role: "customer" };
      expect(await outcome(() => auth.api.setRole({ headers: h, body: forged })), JSON.stringify(role)).toMatchObject({ ok: false });
    }

    expect(await outcome(() => auth.api.removeUser({ headers: h, body: { userId: customer.id } }))).toEqual({ ok: true });
    expect(await userRow(customer.id)).toBeUndefined();
    expect(await userRow(otherAdmin.id)).toEqual({ role: "admin", banned: false });
  });

  it("operations the app never defined are refused even for an admin", async () => {
    const admin = await createUserWithRole("undef-admin", "admin");
    const customer = await createUserWithRole("undef-customer", "customer");
    const h = admin.headers;
    const unavailable = { ok: false, status: "FORBIDDEN", code: "OPERATION_NOT_AVAILABLE" };
    expect(await outcome(() => auth.api.impersonateUser({ headers: h, body: { userId: customer.id } }))).toEqual(unavailable);
    expect(await outcome(() => auth.api.setUserPassword({ headers: h, body: { userId: customer.id, newPassword: strongPassword() } }))).toEqual(unavailable);
    expect(await outcome(() => auth.api.listUserSessions({ headers: h, body: { userId: customer.id } }))).toEqual(unavailable);
    expect(await outcome(() => auth.api.listUsers({ headers: h, query: {} }))).toEqual(unavailable);
    expect(await outcome(() => auth.api.revokeUserSessions({ headers: h, body: { userId: customer.id } }))).toEqual(unavailable);
    expect(await outcome(() => auth.api.createUser({ headers: h, body: { email: "made@jsc-test.example.com", password: strongPassword(), name: "Made" } }))).toEqual(unavailable);
  });

  it("forged or malformed target ids find nothing", async () => {
    const admin = await createUserWithRole("junk-admin", "admin");
    for (const junk of ["' OR 1=1 --", "x".repeat(500), "../../user", "", "<script>alert(1)</script>"]) {
      expect(await outcome(() => auth.api.banUser({ headers: admin.headers, body: { userId: junk } }))).toMatchObject({ ok: false });
    }
    const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" WHERE banned = true AND email LIKE '%@jsc-test.example.com'`);
    expect(rows[0].n).toBe(0);
  });

  it("refuses a signed-out server-side call", async () => {
    const customer = await createUserWithRole("anon-target", "customer");
    expect(await outcome(() => auth.api.banUser({ headers: new Headers(), body: { userId: customer.id } }))).toMatchObject({ ok: false });
  });
});

describe("session tokens stay out of response bodies", () => {
  it("sign-in and change-password responses carry no token, yet the cookie session works", async () => {
    const { email, password } = await createVerifiedUser("no-token");
    const signIn = await viaRoute("POST", "/sign-in/email", { body: { email, password } });
    expect(signIn.status).toBe(200);
    const body = (await signIn.json()) as Record<string, unknown>;
    expect(body.token).toBeNull();
    const cookie = signIn.headers.getSetCookie().find((c) => c.startsWith("jsc.session_token="))!.split(";")[0];

    const change = await viaRoute("POST", "/change-password", { cookie, body: { currentPassword: password, newPassword: strongPassword(), revokeOtherSessions: true } });
    expect(change.status).toBe(200);
    expect(((await change.json()) as Record<string, unknown>).token).toBeNull();
  });

  it("a raw session token without its signature is not accepted as a cookie", async () => {
    const { email } = await createVerifiedUser("raw-token");
    const { rows } = await pool.query<{ token: string }>(`SELECT s.token FROM session s JOIN "user" u ON u.id = s."userId" WHERE u.email = $1`, [email]);
    const res = await call("/get-session", { jar: undefined, origin: null });
    expect(res.json).toBeNull();
    const forged = await auth.api.getSession({ headers: new Headers({ cookie: `jsc.session_token=${rows[0].token}` }) });
    expect(forged).toBeNull();
  });
});
