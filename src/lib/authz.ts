/**
 * The application's authorization boundary.
 *
 * Every portal and staff capability is granted to roles explicitly here,
 * deny-by-default. Server actions and data-access functions both check it;
 * hiding a button is never the control. Who an operation may *target* is
 * decided separately in staff-policy.ts.
 *
 * Better Auth's admin-plugin permissions (src/lib/permissions.ts) are kept to
 * the minimum the defined staff operations need, and its /admin/* endpoints
 * are unreachable over HTTP (see auth-hooks.ts and the auth route).
 */
import { isRoleName, type RoleName } from "./permissions";

export type Capability =
  // every signed-in role
  | "account:read"
  | "account:change-password"
  | "account:manage-sessions"
  // customers only: a staff account never owns or changes a SIM line
  | "line:read"
  | "line:switch-plan"
  // staff console
  | "staff:access"
  | "staff:view-customers"
  | "staff:view-staff"
  | "staff:suspend-customers"
  | "staff:suspend-employees"
  | "staff:manage-roles"
  | "staff:delete-users"
  // activity log
  | "audit:read-customer-actions"
  | "audit:read-all";

const ACCOUNT: Capability[] = ["account:read", "account:change-password", "account:manage-sessions"];
const EMPLOYEE: Capability[] = ["staff:access", "staff:view-customers", "staff:suspend-customers", "audit:read-customer-actions"];

const GRANTS: Record<RoleName, ReadonlySet<Capability>> = {
  customer: new Set<Capability>([...ACCOUNT, "line:read", "line:switch-plan"]),
  employee: new Set<Capability>([...ACCOUNT, ...EMPLOYEE]),
  admin: new Set<Capability>([
    ...ACCOUNT,
    ...EMPLOYEE,
    "staff:view-staff",
    "staff:suspend-employees",
    "staff:manage-roles",
    "staff:delete-users",
    "audit:read-all",
  ]),
};

/**
 * Parses the role column. Better Auth allows comma-separated multiple roles;
 * this app assigns exactly one, so anything else is treated as unrecognised
 * and receives no capabilities at all.
 */
export function parseRole(value: unknown): RoleName | null {
  return isRoleName(value) ? value : null;
}

export function can(role: RoleName | null | undefined, capability: Capability): boolean {
  if (!role || !Object.hasOwn(GRANTS, role)) return false;
  return GRANTS[role].has(capability);
}

export class ForbiddenError extends Error {
  constructor(readonly capability: Capability) {
    super(`Missing capability: ${capability}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(subject: { role: RoleName | null }, capability: Capability): void {
  if (!can(subject.role, capability)) throw new ForbiddenError(capability);
}
