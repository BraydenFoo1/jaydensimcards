/**
 * Who may do what to whom: the single decision function for every staff
 * operation. Used by the staff server actions AND by the Better Auth hook that
 * guards /admin/* calls, so the two layers can never disagree.
 *
 * Deny by default. Actor and target roles must come from the database, never
 * from the request. Rules:
 *   - nobody acts on their own account
 *   - nobody suspends or deletes an admin (demote first, as an admin)
 *   - employees may suspend/reinstate customers only; nothing else
 *   - only admins change roles or delete accounts
 *   - the last admin can never be demoted
 */
import { can, parseRole, type Capability } from "./authz";
import type { RoleName } from "./permissions";

export type StaffOperation = "suspend" | "reinstate" | "set-role" | "delete";

export type PolicyActor = { id: string; role: RoleName | null };
export type PolicyTarget = { id: string; role: RoleName | null; banned: boolean };

export type DenyReason =
  | "not-permitted"
  | "target-not-found"
  | "self"
  | "target-protected"
  | "invalid-role"
  | "unchanged"
  | "last-admin"
  | "already-suspended"
  | "not-suspended";

export type Decision = { allowed: true; newRole?: RoleName } | { allowed: false; reason: DenyReason };

const deny = (reason: DenyReason): Decision => ({ allowed: false, reason });

/** The capability each operation needs, by the target's current role. */
function requiredCapability(operation: StaffOperation, targetRole: RoleName | null): Capability {
  switch (operation) {
    case "suspend":
    case "reinstate":
      return targetRole === "customer" ? "staff:suspend-customers" : "staff:suspend-employees";
    case "set-role":
      return "staff:manage-roles";
    case "delete":
      return "staff:delete-users";
  }
}

export function decideStaffOperation(input: {
  actor: PolicyActor;
  target: PolicyTarget | null;
  operation: StaffOperation;
  newRole?: unknown;
  adminCount?: number;
}): Decision {
  const { actor, target, operation } = input;

  // Unknown or multi-role actors hold no capabilities at all.
  if (!can(actor.role, "staff:access")) return deny("not-permitted");
  if (!target) return deny("target-not-found");
  if (target.id === actor.id) return deny("self");
  if (!can(actor.role, requiredCapability(operation, target.role))) return deny("not-permitted");

  switch (operation) {
    case "suspend":
      if (target.role === "admin") return deny("target-protected");
      if (target.banned) return deny("already-suspended");
      return { allowed: true };

    case "reinstate":
      if (target.role === "admin") return deny("target-protected");
      if (!target.banned) return deny("not-suspended");
      return { allowed: true };

    case "delete":
      if (target.role === "admin") return deny("target-protected");
      return { allowed: true };

    case "set-role": {
      const newRole = parseRole(input.newRole);
      if (!newRole) return deny("invalid-role");
      if (newRole === target.role) return deny("unchanged");
      if (target.role === "admin" && (input.adminCount ?? 0) <= 1) return deny("last-admin");
      return { allowed: true, newRole };
    }
  }
}

export const DENY_MESSAGES: Record<DenyReason, string> = {
  "not-permitted": "Your account isn't allowed to do that.",
  "target-not-found": "That account no longer exists.",
  self: "You can't do that to your own account.",
  "target-protected": "Administrator accounts can't be suspended or deleted. Change their role first.",
  "invalid-role": "Choose customer, employee or admin.",
  unchanged: "That account already has that role.",
  "last-admin": "That's the last administrator. Promote someone else first.",
  "already-suspended": "That account is already suspended.",
  "not-suspended": "That account isn't suspended.",
};
