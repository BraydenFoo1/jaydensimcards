/**
 * Better Auth request hooks: the app's rules applied inside Better Auth itself,
 * so they hold no matter which code path reaches an endpoint.
 *
 * Imports are relative so the Better Auth CLI can load this file.
 */
import { waitUntil } from "@vercel/functions";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { recordAudit, type AuditEntry } from "./audit";
import { parseRole } from "./authz";
import { pool } from "./db";
import { isCurrentConsent, LEGAL_VERSIONS } from "./legal";
import { countAdmins } from "./staff/data";
import { decideStaffOperation, DENY_MESSAGES, type StaffOperation } from "./staff-policy";

/** The only Better Auth admin operations the app uses, and the policy operation each maps to. */
export const ALLOWED_ADMIN_OPERATIONS: Readonly<Record<string, StaffOperation>> = {
  "/admin/ban-user": "suspend",
  "/admin/unban-user": "reinstate",
  "/admin/set-role": "set-role",
  "/admin/remove-user": "delete",
};

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Admin-plugin endpoints are server-only. A request that arrived over the
 * network (ctx.request is set) is refused outright, whoever sent it. A
 * server-side call must be one of the allowed operations, and the policy is
 * re-evaluated against the target as stored in the database.
 */
async function enforceAdminPolicy(ctx: HookContext): Promise<void> {
  if (ctx.request) {
    throw APIError.from("NOT_FOUND", { code: "NOT_FOUND", message: "Not found." });
  }

  const operation = ALLOWED_ADMIN_OPERATIONS[ctx.path];
  if (!operation) {
    throw APIError.from("FORBIDDEN", { code: "OPERATION_NOT_AVAILABLE", message: "That operation isn't available." });
  }

  const session = await getSessionFromCtx(ctx);
  if (!session) {
    throw APIError.from("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "Sign in again to continue." });
  }

  const body = (ctx.body ?? {}) as { userId?: unknown; role?: unknown };
  const targetId = typeof body.userId === "string" && body.userId.length > 0 && body.userId.length <= 128 ? body.userId : null;
  const targetUser = targetId ? await ctx.context.internalAdapter.findUserById(targetId) : null;

  const adminCount = operation === "set-role" ? await countAdmins() : undefined;

  const decision = decideStaffOperation({
    actor: { id: session.user.id, role: parseRole(session.user.role) },
    target: targetUser
      ? { id: targetUser.id, role: parseRole((targetUser as { role?: unknown }).role), banned: Boolean((targetUser as { banned?: unknown }).banned) }
      : null,
    operation,
    newRole: body.role,
    adminCount,
  });

  if (!decision.allowed) {
    throw APIError.from("FORBIDDEN", { code: "STAFF_POLICY_DENIED", message: DENY_MESSAGES[decision.reason] });
  }
}

/**
 * Audit and consent writes never run inside Better Auth's own request: they are
 * queued to run afterwards. That keeps response timing identical whether or not
 * an account exists, and never holds a database lock while Better Auth works.
 */
export function inBackground(task: () => Promise<unknown>): void {
  waitUntil(
    task().catch((err: unknown) => {
      console.error("[auth-hooks] background task failed:", err instanceof Error ? err.message : err);
    }),
  );
}

export function auditInBackground(entry: AuditEntry): void {
  inBackground(() => recordAudit(entry));
}

/**
 * Registration requires agreement to the current Terms and Privacy Policy.
 * Checked before Better Auth looks up the email, so a new address and an
 * existing one get the same answer and nothing about accounts is revealed.
 */
function enforceConsent(ctx: HookContext): void {
  const body = (ctx.body ?? {}) as { legalConsent?: unknown };
  if (!isCurrentConsent(body.legalConsent)) {
    throw APIError.from("BAD_REQUEST", {
      code: "CONSENT_REQUIRED",
      message: "Please agree to the Terms of Service and Privacy Policy to create an account.",
    });
  }
}

export const beforeAuthHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path.startsWith("/admin/")) await enforceAdminPolicy(ctx);
  if (ctx.path === "/sign-up/email") enforceConsent(ctx);
  if (ctx.path === "/sign-out") {
    // Read before Better Auth deletes the session.
    const session = await getSessionFromCtx(ctx);
    if (session) auditInBackground({ actor: { id: session.user.id }, action: "auth.sign-out" });
  }
});

/** Responses that may carry the raw session token; the HttpOnly cookie is the only place it belongs. */
const TOKEN_BEARING_PATHS = new Set(["/sign-in/email", "/sign-up/email", "/change-password"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Response) && !(value instanceof Error);
}

/**
 * Records the agreement and the creation once Better Auth has committed the
 * user. For an existing email Better Auth returns a decoy user whose id does
 * not exist, so the EXISTS guard writes nothing and reveals nothing.
 */
function recordSignUp(userId: string): void {
  inBackground(async () => {
    await pool.query(
      `INSERT INTO consent_record (user_id, document, version)
       SELECT $1, d.document, d.version FROM (VALUES ('terms', $2), ('privacy', $3)) AS d(document, version)
        WHERE EXISTS (SELECT 1 FROM "user" WHERE id = $1)
          AND NOT EXISTS (SELECT 1 FROM consent_record WHERE user_id = $1)`,
      [userId, LEGAL_VERSIONS.terms, LEGAL_VERSIONS.privacy],
    );
    await pool.query(
      `INSERT INTO audit_log (actor_id, action) SELECT $1, 'account.created'
        WHERE EXISTS (SELECT 1 FROM "user" WHERE id = $1)
          AND NOT EXISTS (SELECT 1 FROM audit_log WHERE actor_id = $1 AND action = 'account.created')`,
      [userId],
    );
  });
}

/**
 * Failed sign-ins are logged only against accounts that exist, so attacker-typed
 * addresses are never stored. The lookup runs in the background so it adds no
 * timing difference between known and unknown addresses.
 */
function recordFailedSignIn(email: unknown, code: unknown): void {
  if (typeof email !== "string" || (code !== "INVALID_EMAIL_OR_PASSWORD" && code !== "BANNED_USER")) return;
  const normalized = email.trim().toLowerCase();
  inBackground(async () => {
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [normalized]);
    if (rows[0]) await recordAudit({ actor: { id: rows[0].id }, action: code === "BANNED_USER" ? "auth.sign-in-blocked" : "auth.sign-in-failed" });
  });
}

const errorCode = (value: unknown) => (value instanceof APIError ? (value.body as { code?: unknown } | undefined)?.code : undefined);

export const afterAuthHook = createAuthMiddleware(async (ctx) => {
  const returned = ctx.context.returned;
  const failed = returned instanceof Error;

  if (ctx.path === "/sign-in/email") {
    if (ctx.context.newSession) auditInBackground({ actor: { id: ctx.context.newSession.user.id }, action: "auth.sign-in" });
    else if (failed) recordFailedSignIn((ctx.body as { email?: unknown } | undefined)?.email, errorCode(returned));
  }
  if (ctx.path === "/sign-up/email" && !failed && isPlainObject(returned)) {
    const user = returned.user as { id?: unknown } | undefined;
    if (typeof user?.id === "string") recordSignUp(user.id);
  }
  if (ctx.path === "/change-password" && !failed) {
    const actor = ctx.context.newSession?.user ?? ctx.context.session?.user;
    if (actor) auditInBackground({ actor: { id: actor.id }, action: "auth.password-change" });
  }

  // Keep the session token out of page JavaScript: an XSS bug could read it from a response body.
  if (TOKEN_BEARING_PATHS.has(ctx.path) && isPlainObject(returned) && "token" in returned) {
    return ctx.json({ ...returned, token: null });
  }
});
