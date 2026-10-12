/**
 * Read access for the staff console. Every function takes the acting user and
 * checks its capability itself. Queries name their columns explicitly: no
 * password hashes, session tokens, IP addresses, user agents or usage figures
 * are ever selected for staff views.
 *
 * SQL is built only from fixed fragments plus numbered placeholders; no user
 * input is ever concatenated into a query string.
 */
import { assertCan, can, parseRole } from "../authz";
import { pool } from "../db";
import type { RoleName } from "../permissions";
import { planById } from "../plans";
import type { PolicyTarget } from "../staff-policy";
import {
  ACTIVITY_PAGE_SIZE,
  DIRECTORY_PAGE_SIZE,
  EMPLOYEE_VISIBLE_ACTIONS,
  escapeLike,
  normalizeDirectoryQuery,
  parsePage,
  parseUserId,
  type DirectoryQuery,
} from "./query";

export type StaffActor = { id: string; role: RoleName | null };

export type DirectoryEntry = {
  id: string;
  name: string;
  email: string;
  role: RoleName | null;
  suspended: boolean;
  suspensionReason: string | null;
  verified: boolean;
  planName: string | null;
  joinedAt: Date;
};

type DirectoryRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  emailVerified: boolean;
  createdAt: Date;
  plan_id: string | null;
};

export async function listDirectory(
  actor: StaffActor,
  raw: { q?: unknown; scope?: unknown; page?: unknown },
): Promise<{ query: DirectoryQuery; total: number; pageCount: number; entries: DirectoryEntry[] }> {
  assertCan(actor, "staff:view-customers");
  const query = normalizeDirectoryQuery(raw, can(actor.role, "staff:view-staff"));

  const where: string[] = [];
  const params: unknown[] = [];
  if (query.scope === "customers") where.push(`u.role = 'customer'`);
  else if (query.scope === "staff") where.push(`u.role IN ('employee', 'admin')`);
  if (query.q) {
    params.push(`%${escapeLike(query.q)}%`);
    where.push(`(u.name ILIKE $${params.length} ESCAPE '\\' OR u.email ILIKE $${params.length} ESCAPE '\\')`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: countRows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" u ${whereSql}`, params);
  const total = countRows[0]?.n ?? 0;

  const { rows } = await pool.query<DirectoryRow>(
    `SELECT u.id, u.name, u.email, u.role, u.banned, u."banReason", u."emailVerified", u."createdAt", l.plan_id
       FROM "user" u LEFT JOIN sim_line l ON l.user_id = u.id
       ${whereSql}
      ORDER BY u."createdAt" DESC, u.id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, DIRECTORY_PAGE_SIZE, (query.page - 1) * DIRECTORY_PAGE_SIZE],
  );

  return {
    query,
    total,
    pageCount: Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE)),
    entries: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: parseRole(r.role),
      suspended: Boolean(r.banned),
      suspensionReason: r.banned ? r.banReason : null,
      verified: r.emailVerified,
      planName: planById(r.plan_id)?.name ?? null,
      joinedAt: new Date(r.createdAt),
    })),
  };
}

/** The target of a staff action, as stored: role and status are never taken from the request. */
export async function loadStaffTarget(rawId: unknown): Promise<(PolicyTarget & { email: string }) | null> {
  const id = parseUserId(rawId);
  if (!id) return null;
  const { rows } = await pool.query<{ id: string; email: string; role: string | null; banned: boolean | null }>(
    `SELECT id, email, role, banned FROM "user" WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? { id: row.id, email: row.email, role: parseRole(row.role), banned: Boolean(row.banned) } : null;
}

/** Used by the last-admin rule in the staff policy. */
export async function countAdmins(): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" WHERE role = 'admin'`);
  return rows[0]?.n ?? 0;
}

export type StaffStats = {
  customers: number;
  suspendedCustomers: number;
  unverifiedCustomers: number;
  newThisWeek: number;
  plans: { name: string; count: number }[];
  staff: { employees: number; admins: number; unrecognised: number } | null;
};

export async function getStaffStats(actor: StaffActor): Promise<StaffStats> {
  assertCan(actor, "staff:view-customers");
  const { rows: c } = await pool.query<{ total: number; suspended: number; unverified: number; recent: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE banned)::int AS suspended,
            count(*) FILTER (WHERE NOT "emailVerified")::int AS unverified,
            count(*) FILTER (WHERE "createdAt" > now() - interval '7 days')::int AS recent
       FROM "user" WHERE role = 'customer'`,
  );
  const { rows: planRows } = await pool.query<{ plan_id: string | null; n: number }>(
    `SELECT l.plan_id, count(*)::int AS n FROM "user" u LEFT JOIN sim_line l ON l.user_id = u.id
      WHERE u.role = 'customer' GROUP BY l.plan_id ORDER BY n DESC`,
  );

  let staff: StaffStats["staff"] = null;
  if (can(actor.role, "staff:view-staff")) {
    const { rows: s } = await pool.query<{ employees: number; admins: number; unrecognised: number }>(
      `SELECT count(*) FILTER (WHERE role = 'employee')::int AS employees,
              count(*) FILTER (WHERE role = 'admin')::int AS admins,
              count(*) FILTER (WHERE role IS NULL OR role NOT IN ('customer', 'employee', 'admin'))::int AS unrecognised
         FROM "user"`,
    );
    staff = s[0];
  }

  return {
    customers: c[0].total,
    suspendedCustomers: c[0].suspended,
    unverifiedCustomers: c[0].unverified,
    newThisWeek: c[0].recent,
    plans: planRows.map((r) => ({ name: planById(r.plan_id)?.name ?? "No plan yet", count: r.n })),
    staff,
  };
}

export type ActivityEntry = {
  id: number;
  at: Date;
  action: string;
  detail: string | null;
  actor: string;
  target: string | null;
};

/**
 * Admins read the whole log. Employees read only customer suspensions and
 * reinstatements; sign-ins, role changes, deletions and refusals stay admin-only.
 */
export async function listActivity(actor: StaffActor, rawPage: unknown): Promise<{ page: number; pageCount: number; entries: ActivityEntry[]; scope: "all" | "customer-actions" }> {
  const all = can(actor.role, "audit:read-all");
  if (!all) assertCan(actor, "audit:read-customer-actions");
  const page = parsePage(rawPage);

  const filter = all ? "" : "WHERE a.action = ANY($1::text[])";
  const filterParams: unknown[] = all ? [] : [EMPLOYEE_VISIBLE_ACTIONS];

  const { rows: countRows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_log a ${filter}`, filterParams);
  const total = countRows[0]?.n ?? 0;

  const { rows } = await pool.query<{
    id: number;
    created_at: Date;
    action: string;
    detail: string | null;
    actor_id: string | null;
    target_id: string | null;
    actor_email: string | null;
    target_email: string | null;
  }>(
    `SELECT a.id, a.created_at, a.action, a.detail, a.actor_id, a.target_id,
            au.email AS actor_email, tu.email AS target_email
       FROM audit_log a
       LEFT JOIN "user" au ON au.id = a.actor_id
       LEFT JOIN "user" tu ON tu.id = a.target_id
       ${filter}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
    [...filterParams, ACTIVITY_PAGE_SIZE, (page - 1) * ACTIVITY_PAGE_SIZE],
  );

  const label = (id: string | null, email: string | null) => email ?? (id ? "Deleted account" : null);
  return {
    page,
    pageCount: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)),
    scope: all ? "all" : "customer-actions",
    entries: rows.map((r) => ({
      id: Number(r.id),
      at: new Date(r.created_at),
      action: r.action,
      detail: r.detail,
      actor: label(r.actor_id, r.actor_email) ?? "System",
      target: label(r.target_id, r.target_email),
    })),
  };
}
