/**
 * Parsing for staff-console inputs (search, scope, paging, reasons). Pure, so
 * every edge case is unit-tested. Everything coming from a URL or form is
 * treated as hostile: unknown values fall back to the safest default.
 */

export const DIRECTORY_PAGE_SIZE = 25;
export const ACTIVITY_PAGE_SIZE = 50;
export const SEARCH_MAX = 100;
const MAX_PAGE = 10_000;

export type DirectoryScope = "customers" | "staff" | "all";

export type DirectoryQuery = { q: string; scope: DirectoryScope; page: number };

/** Escapes LIKE wildcards so a search for "100%" matches literally. Values are still bound as parameters. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function parsePage(value: unknown): number {
  const n = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(n, 1), MAX_PAGE);
}

export function parseSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  // Strip control characters and collapse whitespace; cap the length.
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
}

/** Employees always see customers only, whatever the URL asks for. */
export function normalizeDirectoryQuery(raw: { q?: unknown; scope?: unknown; page?: unknown }, canViewStaff: boolean): DirectoryQuery {
  const requested = raw.scope === "staff" || raw.scope === "all" ? raw.scope : "customers";
  return {
    q: parseSearch(raw.q),
    scope: canViewStaff ? requested : "customers",
    page: parsePage(raw.page),
  };
}

/** Suspension reasons are a fixed list: no free text, so no personal data or markup in ban reasons. */
export const BAN_REASONS = {
  abuse: "Abuse of the service",
  security: "Security concern",
  request: "Requested by the account holder",
  other: "Other",
} as const;

export type BanReasonCode = keyof typeof BAN_REASONS;

export function parseBanReason(value: unknown): BanReasonCode | null {
  return typeof value === "string" && Object.hasOwn(BAN_REASONS, value) ? (value as BanReasonCode) : null;
}

/** Better Auth user ids are short random strings; anything else is not an id. */
export function parseUserId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}

/** Actions an employee may read in the activity log: the customer-status changes they make themselves. */
export const EMPLOYEE_VISIBLE_ACTIONS = ["staff.suspend", "staff.reinstate"] as const;

export const ACTION_LABELS: Record<string, string> = {
  "account.created": "Account created",
  "auth.sign-in": "Signed in",
  "auth.sign-in-failed": "Failed sign-in",
  "auth.sign-in-blocked": "Sign-in blocked (suspended)",
  "auth.sign-out": "Signed out",
  "auth.password-change": "Changed password",
  "auth.password-reset": "Reset password",
  "auth.email-verified": "Confirmed email",
  "plan.switch": "Switched plan",
  "session.revoke": "Signed out a device",
  "session.revoke-others": "Signed out other devices",
  "authz.denied": "Action refused",
  "staff.suspend": "Suspended account",
  "staff.reinstate": "Reinstated account",
  "staff.role-change": "Changed role",
  "staff.delete": "Deleted account",
};
