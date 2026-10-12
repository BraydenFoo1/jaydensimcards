"use server";

/**
 * Staff console mutations. Each one:
 *  1. authenticates and checks staff access (authorizeAction)
 *  2. validates the input (ids, reasons, roles are parsed, never trusted)
 *  3. loads the target's role and status from the database
 *  4. runs the shared staff policy (actor x target x operation)
 *  5. calls Better Auth server-side, whose hook re-runs the same policy
 *  6. audits the outcome and returns only a short message
 */
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { countAdmins, loadStaffTarget } from "@/lib/staff/data";
import { BAN_REASONS, parseBanReason } from "@/lib/staff/query";
import { decideStaffOperation, DENY_MESSAGES, type StaffOperation } from "@/lib/staff-policy";
import { authorizeAction, type ActionGate } from "@/lib/session";

export type StaffActionState = { status: "idle" | "success" | "error"; message: string; at: number };

const done = (status: "success" | "error", message: string): StaffActionState => ({ status, message, at: Date.now() });

const GENERIC_FAILURE = "Something went wrong and nothing was changed. Please try again.";

type Gate = Extract<ActionGate, { ok: true }>;
type Target = NonNullable<Awaited<ReturnType<typeof loadStaffTarget>>>;

/** Shared steps 1, 3 and 4. Returns either a ready target or the response to send. */
async function prepare(
  formData: FormData,
  operation: StaffOperation,
  newRole?: unknown,
): Promise<{ gate: Gate; target: Target; newRole?: string } | { response: StaffActionState }> {
  const gate = await authorizeAction("staff:access");
  if (!gate.ok) return { response: done("error", gate.message) };

  const target = await loadStaffTarget(formData.get("userId"));
  const adminCount = operation === "set-role" ? await countAdmins() : undefined;

  const decision = decideStaffOperation({ actor: gate.user, target, operation, newRole, adminCount });
  if (!decision.allowed) {
    await recordAudit({ actor: gate.user, action: "authz.denied", target: target ?? undefined, detail: `staff.${operation}:${decision.reason}` });
    return { response: done("error", DENY_MESSAGES[decision.reason]) };
  }
  return { gate, target: target!, newRole: decision.newRole };
}

/** Policy denials from the Better Auth hook carry a safe message; anything else is reported generically. */
function failure(err: unknown): StaffActionState {
  const body = (err as { body?: { code?: unknown; message?: unknown } }).body;
  if (body?.code === "STAFF_POLICY_DENIED" && typeof body.message === "string") return done("error", body.message);
  console.error("[staff] action failed:", (err as { name?: string }).name ?? "Error", typeof body?.code === "string" ? body.code : "");
  return done("error", GENERIC_FAILURE);
}

export async function suspendUserAction(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const reason = parseBanReason(formData.get("reason"));
  if (!reason) return done("error", "Choose a reason for the suspension.");
  const ready = await prepare(formData, "suspend");
  if ("response" in ready) return ready.response;
  try {
    await auth.api.banUser({ headers: await headers(), body: { userId: ready.target.id, banReason: BAN_REASONS[reason] } });
  } catch (err) {
    return failure(err);
  }
  await recordAudit({ actor: ready.gate.user, action: "staff.suspend", target: ready.target, detail: reason });
  refresh();
  return done("success", `${ready.target.email} is suspended and has been signed out everywhere.`);
}

export async function reinstateUserAction(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const ready = await prepare(formData, "reinstate");
  if ("response" in ready) return ready.response;
  try {
    await auth.api.unbanUser({ headers: await headers(), body: { userId: ready.target.id } });
  } catch (err) {
    return failure(err);
  }
  await recordAudit({ actor: ready.gate.user, action: "staff.reinstate", target: ready.target });
  refresh();
  return done("success", `${ready.target.email} is active again.`);
}

export async function setRoleAction(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const ready = await prepare(formData, "set-role", formData.get("role"));
  if ("response" in ready) return ready.response;
  const newRole = ready.newRole as "customer" | "employee" | "admin";
  try {
    await auth.api.setRole({ headers: await headers(), body: { userId: ready.target.id, role: newRole } });
  } catch (err) {
    return failure(err);
  }
  await recordAudit({ actor: ready.gate.user, action: "staff.role-change", target: ready.target, detail: `${ready.target.role ?? "unrecognised"} -> ${newRole}` });
  refresh();
  return done("success", `${ready.target.email} is now ${newRole === "admin" ? "an admin" : `a ${newRole}`}.`);
}

export async function deleteUserAction(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  if (formData.get("confirm") !== "DELETE") return done("error", 'Type DELETE to confirm. This can\'t be undone.');
  const ready = await prepare(formData, "delete");
  if ("response" in ready) return ready.response;
  try {
    // Cascades to sessions, sign-in methods, the SIM line and consent records.
    await auth.api.removeUser({ headers: await headers(), body: { userId: ready.target.id } });
  } catch (err) {
    return failure(err);
  }
  await recordAudit({ actor: ready.gate.user, action: "staff.delete", target: ready.target });
  refresh();
  return done("success", "The account and its data have been deleted.");
}
