"use server";

/**
 * Portal mutations. Each one:
 *  1. passes authorizeAction(), a fresh database-backed session read plus an
 *     explicit capability check, before touching anything;
 *  2. takes the user id from the session only, never from the form;
 *  3. calls a data-access function that re-checks the same capability.
 * Next.js additionally rejects server-action POSTs whose Origin doesn't match.
 */
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { switchPlan } from "@/lib/portal/line";
import { findOwnSessionToken } from "@/lib/portal/sessions";
import { authorizeAction } from "@/lib/session";

export type ActionState = { status: "idle" | "success" | "error"; message: string; at: number };

const done = (status: "success" | "error", message: string): ActionState => ({ status, message, at: Date.now() });

export async function switchPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await authorizeAction("line:switch-plan");
  if (!gate.ok) return done("error", gate.message);

  const result = await switchPlan(gate.user, formData.get("planId"));
  if (!result.ok) {
    const messages = {
      "invalid-plan": "Choose one of the plans listed.",
      unchanged: "You're already on that plan. Jayden appreciates the loyalty.",
      throttled: "That's a lot of switching. Give it a minute, the network needs to catch up.",
    } as const;
    return done("error", messages[result.reason]);
  }
  refresh();
  return done("success", `Switched to ${result.plan.name}. Switching is instant. Regret is monthly.`);
}

export async function revokeSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await authorizeAction("account:manage-sessions");
  if (!gate.ok) return done("error", gate.message);

  const sessionId = formData.get("sessionId");
  if (sessionId === gate.sessionId) {
    return done("error", "That's the device you're using. Use Sign out instead.");
  }
  const token = await findOwnSessionToken(gate.user, sessionId);
  if (!token) return done("error", "That device is already signed out.");

  // Better Auth re-checks that the token belongs to the caller before deleting it.
  await auth.api.revokeSession({ headers: await headers(), body: { token } });
  await recordAudit({ actor: gate.user, action: "session.revoke" });
  refresh();
  return done("success", "That device has been signed out.");
}

export async function revokeOtherSessionsAction(): Promise<ActionState> {
  const gate = await authorizeAction("account:manage-sessions");
  if (!gate.ok) return done("error", gate.message);

  await auth.api.revokeOtherSessions({ headers: await headers() });
  await recordAudit({ actor: gate.user, action: "session.revoke-others" });
  refresh();
  return done("success", "Every other device has been signed out.");
}
