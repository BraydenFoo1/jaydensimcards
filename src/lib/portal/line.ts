/**
 * A customer's fictional SIM line. Every function takes the acting user and
 * checks its capability itself, so these stay safe even if a future caller
 * forgets the action-level gate. The user id always comes from the session,
 * never from request input.
 */
import { recentActionCount, recordAudit } from "../audit";
import { assertCan } from "../authz";
import { pool } from "../db";
import { planById, type LineRecord, type Plan } from "../plans";
import type { RoleName } from "../permissions";

export type Actor = { id: string; email: string; role: RoleName | null };

/** New lines start with a little usage: Jayden tested the line before handing it over. */
export const INITIAL_USED_GB = 0.67;

/** Plan switches allowed per actor per minute. Stops a script flooding the audit log. */
export const SWITCH_LIMIT_PER_MINUTE = 10;

type Row = { plan_id: string | null; used_gb: number; allowance_override_gb: number | null };

const toRecord = (row: Row): LineRecord => ({
  planId: row.plan_id,
  usedGb: Number(row.used_gb),
  allowanceOverrideGb: row.allowance_override_gb === null ? null : Number(row.allowance_override_gb),
});

/** Returns the customer's line, creating it on first visit. Staff accounts never get one. */
export async function getCustomerLine(actor: Actor): Promise<LineRecord> {
  assertCan(actor, "line:read");
  await pool.query(`INSERT INTO sim_line (user_id, used_gb) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`, [actor.id, INITIAL_USED_GB]);
  const { rows } = await pool.query<Row>(`SELECT plan_id, used_gb, allowance_override_gb FROM sim_line WHERE user_id = $1`, [actor.id]);
  return toRecord(rows[0]);
}

export type SwitchResult = { ok: true; plan: Plan } | { ok: false; reason: "invalid-plan" | "unchanged" | "throttled" };

export async function switchPlan(actor: Actor, requestedPlanId: unknown): Promise<SwitchResult> {
  assertCan(actor, "line:switch-plan");
  const plan = planById(requestedPlanId);
  if (!plan) return { ok: false, reason: "invalid-plan" };
  if ((await recentActionCount(actor.id, "plan.switch", 60)) >= SWITCH_LIMIT_PER_MINUTE) {
    return { ok: false, reason: "throttled" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO sim_line (user_id, used_gb) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`, [actor.id, INITIAL_USED_GB]);
    const { rows } = await client.query<{ plan_id: string | null }>(`SELECT plan_id FROM sim_line WHERE user_id = $1 FOR UPDATE`, [actor.id]);
    const previous = rows[0]?.plan_id ?? null;
    if (previous === plan.id) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unchanged" };
    }
    // A new plan brings its own allowance; any staff override is cleared.
    await client.query(
      `UPDATE sim_line SET plan_id = $2, allowance_override_gb = NULL, updated_at = now() WHERE user_id = $1`,
      [actor.id, plan.id],
    );
    await recordAudit({ actor, action: "plan.switch", detail: `${previous ?? "none"} -> ${plan.id}` }, client);
    await client.query("COMMIT");
    return { ok: true, plan };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
