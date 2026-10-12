import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { ForbiddenError, parseRole } from "@/lib/authz";
import { pool } from "@/lib/db";
import { currentConsent } from "@/lib/legal";
import { getStaffStats, listActivity, listDirectory, loadStaffTarget, type StaffActor } from "@/lib/staff/data";
import { call, CookieJar, cleanupTestUsers, createUserWithRole, createVerifiedUser, strongPassword, uniqueEmail, waitForMail } from "./helpers";

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});

/** Background writes (audit, consent) land shortly after the response. */
async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!done(value) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    value = await read();
  }
  return value;
}

const auditActions = (userId: string) =>
  pool.query<{ action: string }>(`SELECT action FROM audit_log WHERE actor_id = $1 ORDER BY id`, [userId]).then((r) => r.rows.map((x) => x.action));

const idOf = async (email: string) => (await pool.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email])).rows[0]?.id;

const staffActor = (u: { id: string }, role: string): StaffActor => ({ id: u.id, role: parseRole(role) });

describe("registration consent is enforced by the server", () => {
  it.each([
    ["missing", null],
    ["a bare boolean", true],
    ["an outdated version", { terms: "2020-01-01", privacy: "2020-01-01" }],
    ["only the terms", { terms: currentConsent().terms }],
  ])("refuses sign-up with %s consent and creates nothing", async (_label, legalConsent) => {
    const email = uniqueEmail("no-consent");
    const res = await call("/sign-up/email", { body: { name: "N", email, password: strongPassword(), legalConsent } });
    expect(res.status).toBe(400);
    expect(res.json?.code).toBe("CONSENT_REQUIRED");
    expect(await idOf(email)).toBeUndefined();
  });

  it("gives an existing address the same answer, so consent checks reveal no accounts", async () => {
    const { email } = await createVerifiedUser("consent-existing");
    const res = await call("/sign-up/email", { body: { name: "N", email, password: strongPassword(), legalConsent: null } });
    expect(res.status).toBe(400);
    expect(res.json?.code).toBe("CONSENT_REQUIRED");
  });

  it("records exactly which versions were agreed to, and nothing else", async () => {
    const email = uniqueEmail("consent-ok");
    const res = await call("/sign-up/email", { body: { name: "C", email, password: strongPassword(), legalConsent: currentConsent() } });
    expect(res.status).toBe(200);
    const id = (await idOf(email))!;
    const rows = await eventually(
      () => pool.query(`SELECT document, version FROM consent_record WHERE user_id = $1 ORDER BY document`, [id]).then((r) => r.rows),
      (r) => r.length === 2,
    );
    expect(rows).toEqual([
      { document: "privacy", version: currentConsent().privacy },
      { document: "terms", version: currentConsent().terms },
    ]);
    const columns = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'consent_record' ORDER BY column_name`)).rows.map((r) => r.column_name);
    expect(columns).toEqual(["accepted_at", "document", "id", "user_id", "version"]);
  });

  it("refuses role and status fields smuggled into the sign-up body", async () => {
    const email = uniqueEmail("role-inject");
    const res = await call("/sign-up/email", { body: { name: "R", email, password: strongPassword(), role: "admin", banned: false } });
    expect(res.status).toBe(400);
    expect(await idOf(email)).toBeUndefined();
  });
});

describe("security events are audited, without sensitive data", () => {
  it("records sign-up, confirmation, sign-in, failure, password change and sign-out", async () => {
    const { email, password } = await createVerifiedUser("audit-trail");
    const id = (await idOf(email))!;

    await call("/sign-in/email", { body: { email, password: strongPassword() } }); // wrong password
    const jar = new CookieJar();
    await call("/sign-in/email", { body: { email, password }, jar });
    const newPassword = strongPassword();
    await call("/change-password", { body: { currentPassword: password, newPassword, revokeOtherSessions: true }, jar });
    await call("/sign-out", { method: "POST", body: {}, jar });

    const expected = ["account.created", "auth.email-verified", "auth.sign-in-failed", "auth.sign-in", "auth.password-change", "auth.sign-out"];
    const actions = await eventually(() => auditActions(id), (a) => expected.every((e) => a.includes(e)));
    for (const e of expected) expect(actions, e).toContain(e);

    const dump = JSON.stringify((await pool.query(`SELECT * FROM audit_log WHERE actor_id = $1 OR target_id = $1`, [id])).rows);
    expect(dump).not.toContain(password);
    expect(dump).not.toContain(newPassword);
    expect(dump).not.toContain(email);
    const tokens = (await pool.query<{ token: string }>(`SELECT token FROM session WHERE "userId" = $1`, [id])).rows;
    for (const t of tokens) expect(dump).not.toContain(t.token);
  });

  it("records a password reset", async () => {
    const { email } = await createVerifiedUser("audit-reset");
    const id = (await idOf(email))!;
    await call("/request-password-reset", { body: { email, redirectTo: "/reset-password" } });
    const mail = await waitForMail(email, "reset-password");
    const landing = await call(mail.link!, { origin: null });
    const token = new URL(landing.res.headers.get("location")!, "http://x").searchParams.get("token");
    await call("/reset-password", { body: { newPassword: strongPassword(), token } });
    const actions = await eventually(() => auditActions(id), (a) => a.includes("auth.password-reset"));
    expect(actions).toContain("auth.password-reset");
  });

  it("never stores the address typed in a failed sign-in for an unknown account", async () => {
    const typed = uniqueEmail("ghost");
    await call("/sign-in/email", { body: { email: typed, password: strongPassword() } });
    await new Promise((r) => setTimeout(r, 500));
    const columns = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_log'`)).rows.map((r) => r.column_name);
    expect(columns.sort()).toEqual(["action", "actor_id", "created_at", "detail", "id", "target_id"]);
    const hits = await pool.query(`SELECT count(*)::int AS n FROM audit_log WHERE detail LIKE $1`, [`%${typed}%`]);
    expect(hits.rows[0].n).toBe(0);
  });
});

describe("staff data access is scoped and minimal", () => {
  it("employees see customers only, whatever scope they ask for", async () => {
    const employee = await createUserWithRole("dir-employee", "employee");
    await createUserWithRole("dir-admin", "admin");
    for (const scope of ["staff", "all", "customers", "admin"]) {
      const { entries, query } = await listDirectory(staffActor(employee, "employee"), { scope, q: "jsc-test.example.com" });
      expect(query.scope).toBe("customers");
      expect(entries.every((e) => e.role === "customer")).toBe(true);
    }
  });

  it("admins can list staff", async () => {
    const admin = await createUserWithRole("dir-admin2", "admin");
    const { entries } = await listDirectory(staffActor(admin, "admin"), { scope: "staff", q: "dir-admin2" });
    expect(entries.map((e) => e.role)).toEqual(["admin"]);
  });

  it("directory entries carry only display fields: no hashes, tokens, IPs or usage", async () => {
    const admin = await createUserWithRole("dir-fields", "admin");
    const { entries } = await listDirectory(staffActor(admin, "admin"), { scope: "all", q: "dir-fields" });
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(Object.keys(e).sort()).toEqual(["email", "id", "joinedAt", "name", "planName", "role", "suspended", "suspensionReason", "verified"]);
    }
  });

  it.each([["' OR 1=1 --"], ["%"], ["_"], ["\\"], ["'; DROP TABLE \"user\"; --"], ["<script>alert(1)</script>"], ["x".repeat(1000)]])(
    "treats the search %j as literal text",
    async (q) => {
      const admin = await createUserWithRole("dir-sqli", "admin");
      const { entries, total } = await listDirectory(staffActor(admin, "admin"), { scope: "all", q });
      expect(entries).toEqual([]);
      expect(total).toBe(0);
      const { rows } = await pool.query(`SELECT to_regclass('public.user') AS t`);
      expect(rows[0].t).not.toBeNull();
    },
  );

  it("customers and unrecognised roles cannot read staff data at all", async () => {
    for (const role of ["customer", "superadmin", "admin,customer"]) {
      const u = await createUserWithRole(`dir-${role.replace(/\W/g, "")}`, role);
      const a = staffActor(u, role);
      await expect(listDirectory(a, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getStaffStats(a)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listActivity(a, "1")).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("employees see only customer suspensions in the activity log; admins see everything", async () => {
    const employee = await createUserWithRole("act-employee", "employee");
    const admin = await createUserWithRole("act-admin", "admin");
    const customer = await createUserWithRole("act-customer", "customer");
    await auth.api.banUser({ headers: employee.headers, body: { userId: customer.id } });
    await pool.query(`INSERT INTO audit_log (actor_id, action, target_id) VALUES ($1, 'staff.suspend', $2)`, [employee.id, customer.id]);

    const asEmployee = await listActivity(staffActor(employee, "employee"), "1");
    expect(asEmployee.scope).toBe("customer-actions");
    expect(asEmployee.entries.every((e) => e.action === "staff.suspend" || e.action === "staff.reinstate")).toBe(true);

    const asAdmin = await listActivity(staffActor(admin, "admin"), "1");
    expect(asAdmin.scope).toBe("all");
    expect(new Set(asAdmin.entries.map((e) => e.action)).size).toBeGreaterThan(1);
  });

  it("staff statistics hide staff counts from employees", async () => {
    const employee = await createUserWithRole("stat-employee", "employee");
    const admin = await createUserWithRole("stat-admin", "admin");
    expect((await getStaffStats(staffActor(employee, "employee"))).staff).toBeNull();
    expect((await getStaffStats(staffActor(admin, "admin"))).staff).toMatchObject({ admins: expect.any(Number) });
  });

  it("target lookups ignore malformed ids", async () => {
    for (const junk of ["' OR 1=1 --", "", "x".repeat(200), null, 7, { id: "x" }]) expect(await loadStaffTarget(junk)).toBeNull();
  });
});

describe("deleting an account removes its personal data", () => {
  it("cascades to sessions, sign-in details, SIM line and consent; the log keeps only an anonymous id", async () => {
    const admin = await createUserWithRole("del-admin", "admin");
    const victim = await createUserWithRole("del-victim", "customer");
    await pool.query(`INSERT INTO sim_line (user_id, plan_id) VALUES ($1, 'exam')`, [victim.id]);
    await pool.query(`INSERT INTO audit_log (actor_id, action) VALUES ($1, 'auth.sign-in')`, [victim.id]);

    await auth.api.removeUser({ headers: admin.headers, body: { userId: victim.id } });

    for (const [table, column] of [["user", "id"], ["session", "userId"], ["account", "userId"], ["sim_line", "user_id"], ["consent_record", "user_id"]]) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "${table}" WHERE "${column}" = $1`, [victim.id]);
      expect(rows[0].n, table).toBe(0);
    }
    const log = await listActivity(staffActor(admin, "admin"), "1");
    const entry = log.entries.find((e) => e.action === "auth.sign-in" && e.actor === "Deleted account");
    expect(entry).toBeTruthy();
    expect(JSON.stringify(log.entries)).not.toContain(victim.email);
  });
});

describe("retention", () => {
  it("deletes email-throttle records older than a day when mail is sent", async () => {
    await pool.query(`INSERT INTO email_log (address_hash, kind, sent_at) VALUES ('old-hash', 'verify-email', now() - interval '2 days')`);
    const { email } = await createVerifiedUser("retention");
    expect(email).toBeTruthy();
    const { rows } = await eventually(
      () => pool.query(`SELECT count(*)::int AS n FROM email_log WHERE address_hash = 'old-hash'`),
      (r) => r.rows[0].n === 0,
    );
    expect(rows[0].n).toBe(0);
  });
});
