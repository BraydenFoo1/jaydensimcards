/**
 * Better Auth admin-plugin roles, cut to the minimum the app's own staff
 * operations need. These only matter for server-side auth.api calls: the
 * plugin's /admin/* HTTP endpoints are blocked, and every server-side call is
 * re-checked against staff-policy.ts (actor, target and operation).
 *
 * customer  nothing
 * employee  ban/unban (suspend and reinstate customers)
 * admin     ban/unban, set-role, delete
 *
 * Nobody holds list, get, create, update, set-password, impersonate or any
 * session permission: those plugin endpoints expose data (including raw
 * session tokens) the staff console never needs.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const customer = ac.newRole({});

export const employee = ac.newRole({
  user: ["ban"],
});

export const admin = ac.newRole({
  user: ["ban", "set-role", "delete"],
});

export const roles = { customer, employee, admin };

export const ROLE_NAMES = ["customer", "employee", "admin"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === "string" && (ROLE_NAMES as readonly string[]).includes(value);
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "employee" || role === "admin";
}
