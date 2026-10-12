/**
 * The signed-in user's own sessions ("devices"). Session tokens never leave
 * the server: the page only ever sees ids and display fields, and every
 * lookup is scoped to the acting user's id.
 */
import { assertCan } from "../authz";
import { pool } from "../db";
import { describeUserAgent, maskIp } from "../user-agent";
import type { Actor } from "./line";

export type SessionView = {
  id: string;
  device: string;
  location: string;
  signedInAt: Date;
  lastActiveAt: Date;
  current: boolean;
};

type Row = { id: string; createdAt: Date; updatedAt: Date; ipAddress: string | null; userAgent: string | null };

export async function listOwnSessions(actor: Actor, currentSessionId: string): Promise<SessionView[]> {
  assertCan(actor, "account:manage-sessions");
  const { rows } = await pool.query<Row>(
    `SELECT id, "createdAt", "updatedAt", "ipAddress", "userAgent" FROM session
      WHERE "userId" = $1 AND "expiresAt" > now()
      ORDER BY (id = $2) DESC, "updatedAt" DESC
      LIMIT 50`,
    [actor.id, currentSessionId],
  );
  return rows.map((r) => ({
    id: r.id,
    device: describeUserAgent(r.userAgent),
    location: maskIp(r.ipAddress),
    signedInAt: new Date(r.createdAt),
    lastActiveAt: new Date(r.updatedAt),
    current: r.id === currentSessionId,
  }));
}

/**
 * The token for one of the actor's own sessions, for handing to Better Auth's
 * revoke endpoint. Another user's session id resolves to nothing.
 */
export async function findOwnSessionToken(actor: Actor, sessionId: unknown): Promise<string | null> {
  assertCan(actor, "account:manage-sessions");
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 128) return null;
  const { rows } = await pool.query<{ token: string }>(
    `SELECT token FROM session WHERE id = $1 AND "userId" = $2 AND "expiresAt" > now()`,
    [sessionId, actor.id],
  );
  return rows[0]?.token ?? null;
}
