import { afterAll, describe, expect, it } from "vitest";
import { ForbiddenError, parseRole } from "@/lib/authz";
import { pool } from "@/lib/db";
import type { RoleName } from "@/lib/permissions";
import { getCustomerLine, INITIAL_USED_GB, switchPlan, SWITCH_LIMIT_PER_MINUTE, type Actor } from "@/lib/portal/line";
import { findOwnSessionToken, listOwnSessions } from "@/lib/portal/sessions";
import { CookieJar, call, cleanupTestUsers, createVerifiedUser, strongPassword } from "./helpers";

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});

/** A verified user with the given role, as the data-access layer sees them. */
async function actor(label: string, role: string = "customer") {
  const created = await createVerifiedUser(label);
  await pool.query(`UPDATE "user" SET role = $2 WHERE email = $1`, [created.email, role]);
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [created.email]);
  const a: Actor = { id: rows[0].id, email: created.email, role: parseRole(role) as RoleName | null };
  return { ...created, actor: a };
}

const lineRow = async (userId: string) =>
  (await pool.query(`SELECT plan_id, used_gb, allowance_override_gb FROM sim_line WHERE user_id = $1`, [userId])).rows[0];

const currentSessionId = async (jar: CookieJar) => {
  const json = (await call("/get-session", { jar })).json as { session?: { id: string } } | null;
  return json?.session?.id ?? "";
};

describe("customer lines", () => {
  it("creates a line with Jayden's test usage on first read, once", async () => {
    const { actor: a } = await actor("line-create");
    const first = await getCustomerLine(a);
    const second = await getCustomerLine(a);
    expect(first).toEqual({ planId: null, usedGb: INITIAL_USED_GB, allowanceOverrideGb: null });
    expect(second).toEqual(first);
    expect((await pool.query(`SELECT count(*)::int AS n FROM sim_line WHERE user_id = $1`, [a.id])).rows[0].n).toBe(1);
  });

  it("switches plan, clears any staff override and writes an audit entry", async () => {
    const { actor: a } = await actor("line-switch");
    await getCustomerLine(a);
    await pool.query(`UPDATE sim_line SET plan_id = 'exam', allowance_override_gb = 5 WHERE user_id = $1`, [a.id]);

    const result = await switchPlan(a, "ultra");
    expect(result).toMatchObject({ ok: true, plan: { id: "ultra" } });
    expect(await lineRow(a.id)).toMatchObject({ plan_id: "ultra", allowance_override_gb: null });

    const audit = await pool.query(`SELECT action, detail FROM audit_log WHERE actor_id = $1 ORDER BY id DESC LIMIT 1`, [a.id]);
    expect(audit.rows[0]).toEqual({ action: "plan.switch", detail: "exam -> ultra" });
  });

  it("reports an unchanged plan without writing anything", async () => {
    const { actor: a } = await actor("line-same");
    await switchPlan(a, "exam");
    expect(await switchPlan(a, "exam")).toEqual({ ok: false, reason: "unchanged" });
  });

  it.each([["../admin"], [""], ["ULTRA"], ["__proto__"], ["toString"], ["x".repeat(10_000)], [123], [null], [undefined], [{ id: "ultra" }]])(
    "rejects the plan id %j and leaves the line untouched",
    async (planId) => {
      const { actor: a } = await actor("line-bad");
      await switchPlan(a, "exam");
      expect(await switchPlan(a, planId)).toEqual({ ok: false, reason: "invalid-plan" });
      expect((await lineRow(a.id)).plan_id).toBe("exam");
    },
  );

  it("throttles rapid plan switching", async () => {
    const { actor: a } = await actor("line-throttle");
    const ids = ["exam", "ultra"];
    for (let i = 0; i < SWITCH_LIMIT_PER_MINUTE; i++) {
      expect((await switchPlan(a, ids[i % 2])).ok).toBe(true);
    }
    expect(await switchPlan(a, "broke")).toEqual({ ok: false, reason: "throttled" });
  });

  it("only ever changes the acting customer's own line", async () => {
    const { actor: alice } = await actor("line-alice");
    const { actor: bob } = await actor("line-bob");
    await switchPlan(bob, "voiddeck");
    await switchPlan(alice, "tuffest67g");
    expect((await lineRow(bob.id)).plan_id).toBe("voiddeck");
  });
});

describe("staff and unrecognised roles never touch customer-only lines", () => {
  for (const role of ["employee", "admin", "superadmin", "admin,customer"]) {
    it(`${role}: reading or switching a line is forbidden and creates nothing`, async () => {
      const { actor: a } = await actor(`staff-${role.replace(/\W/g, "")}`, role);
      await expect(getCustomerLine(a)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(switchPlan(a, "ultra")).rejects.toBeInstanceOf(ForbiddenError);
      expect(await lineRow(a.id)).toBeUndefined();
    });
  }

  it("an unrecognised role cannot even manage its own sessions", async () => {
    const { actor: a, jar } = await actor("unknown-role", "superadmin");
    await expect(listOwnSessions(a, await currentSessionId(jar))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("own sessions", () => {
  it("lists only the actor's sessions, marks the current one, and never exposes tokens", async () => {
    const { actor: a, jar, email, password } = await actor("sessions-list");
    const other = new CookieJar();
    await call("/sign-in/email", { body: { email, password }, jar: other });
    await actor("sessions-noise");

    const sessions = await listOwnSessions(a, await currentSessionId(jar));
    expect(sessions).toHaveLength(2);
    expect(sessions[0].current).toBe(true);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    for (const s of sessions) {
      expect(Object.keys(s).sort()).toEqual(["current", "device", "id", "lastActiveAt", "location", "signedInAt"]);
    }
  });

  it("works for staff too, since every role manages its own sessions", async () => {
    const { actor: a, jar } = await actor("sessions-staff", "employee");
    expect(await listOwnSessions(a, await currentSessionId(jar))).toHaveLength(1);
  });

  it("resolves a token only for the actor's own session id", async () => {
    const { actor: alice, jar: aliceJar } = await actor("sessions-alice");
    const { jar: bobJar } = await actor("sessions-bob");
    const aliceSession = await currentSessionId(aliceJar);
    const bobSession = await currentSessionId(bobJar);

    expect(await findOwnSessionToken(alice, aliceSession)).toEqual(expect.any(String));
    expect(await findOwnSessionToken(alice, bobSession)).toBeNull();
    for (const junk of [null, 42, "", "' OR 1=1 --", "x".repeat(500), { id: bobSession }]) {
      expect(await findOwnSessionToken(alice, junk)).toBeNull();
    }
  });
});

describe("change password (Better Auth endpoint the portal uses)", () => {
  it("requires a session", async () => {
    const res = await call("/change-password", { body: { currentPassword: "x", newPassword: strongPassword() } });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong current password", async () => {
    const { jar } = await createVerifiedUser("cp-wrong");
    const res = await call("/change-password", { body: { currentPassword: strongPassword(), newPassword: strongPassword() }, jar });
    expect(res.status).toBe(400);
    expect(res.json?.code).toBe("INVALID_PASSWORD");
  });

  it("rejects a breached new password", async () => {
    const { jar, password } = await createVerifiedUser("cp-pwned");
    const res = await call("/change-password", { body: { currentPassword: password, newPassword: "password123456" }, jar });
    expect(res.status).toBe(400);
  });

  it("rejects a cross-site request", async () => {
    const { jar, password } = await createVerifiedUser("cp-csrf");
    const res = await call("/change-password", { body: { currentPassword: password, newPassword: strongPassword() }, jar, origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("changes the password and, when asked, signs out every other device but keeps this one", async () => {
    const { jar, email, password } = await createVerifiedUser("cp-ok");
    const otherDevice = new CookieJar();
    await call("/sign-in/email", { body: { email, password }, jar: otherDevice });

    const newPassword = strongPassword();
    const res = await call("/change-password", { body: { currentPassword: password, newPassword, revokeOtherSessions: true }, jar });
    expect(res.status).toBe(200);

    expect((await call("/get-session", { jar })).json?.user?.email).toBe(email);
    expect((await call("/get-session", { jar: otherDevice })).json).toBeNull();
    expect((await call("/sign-in/email", { body: { email, password } })).status).toBe(401);
    expect((await call("/sign-in/email", { body: { email, password: newPassword } })).status).toBe(200);
  });
});
