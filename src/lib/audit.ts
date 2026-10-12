/**
 * Writes to the staff-visible activity log. A failed write is logged but
 * never breaks the action being audited.
 *
 * Only opaque account ids are stored (no names, emails, IPs, passwords or
 * tokens); `detail` must be server-generated text such as plan ids or reason
 * codes, never raw user input.
 */
import type { PoolClient } from "pg";
import { pool } from "./db";

type Party = { id: string } | null | undefined;

export type AuditEntry = {
  actor: Party;
  action: string;
  target?: Party;
  detail?: string;
};

export async function recordAudit(entry: AuditEntry, client: Pick<PoolClient, "query"> = pool): Promise<void> {
  try {
    await client.query(
      `INSERT INTO audit_log (actor_id, action, target_id, detail) VALUES ($1, $2, $3, $4)`,
      [entry.actor?.id ?? null, entry.action, entry.target?.id ?? null, entry.detail?.slice(0, 200) ?? null],
    );
  } catch (err) {
    console.error("[audit] write failed:", err instanceof Error ? err.message : err);
  }
}

/** How many times this actor performed `action` in the last `seconds`. */
export async function recentActionCount(actorId: string, action: string, seconds: number): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_log
      WHERE actor_id = $1 AND action = $2 AND created_at > now() - make_interval(secs => $3)`,
    [actorId, action, seconds],
  );
  return rows[0]?.n ?? 0;
}
