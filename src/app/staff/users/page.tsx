import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { can } from "@/lib/authz";
import { ROLE_NAMES, type RoleName } from "@/lib/permissions";
import { firstParam } from "@/lib/redirects";
import { countAdmins, listDirectory } from "@/lib/staff/data";
import { SEARCH_MAX, type DirectoryScope } from "@/lib/staff/query";
import { decideStaffOperation } from "@/lib/staff-policy";
import { requireStaff } from "@/lib/session";
import { ConsoleSkeleton, Pager, StaffHeading } from "../ui";
import styles from "../staff.module.css";
import { StaffDirectory, type DirectoryRowView } from "./StaffDirectory";

export const metadata: Metadata = { title: "Directory" };

const date = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeZone: "Asia/Singapore" });

const ROLE_LABEL: Record<RoleName, string> = { customer: "Customer", employee: "Employee", admin: "Administrator" };

export default function DirectoryPage({ searchParams }: PageProps<"/staff/users">) {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <Directory searchParams={searchParams} />
    </Suspense>
  );
}

async function Directory({ searchParams }: Pick<PageProps<"/staff/users">, "searchParams">) {
  const actor = await requireStaff();
  const params = await searchParams;
  const [{ query, total, pageCount, entries }, adminCount] = await Promise.all([
    listDirectory(actor, { q: firstParam(params.q), scope: firstParam(params.scope), page: firstParam(params.page) }),
    countAdmins(),
  ]);
  const viewStaff = can(actor.role, "staff:view-staff");

  // Which controls to show. A hint for the UI only: every action re-checks on the server.
  const rows: DirectoryRowView[] = entries.map((e) => {
    const target = { id: e.id, role: e.role, banned: e.suspended };
    const allowed = (operation: "suspend" | "reinstate" | "delete") => decideStaffOperation({ actor, target, operation }).allowed;
    return {
      id: e.id,
      name: e.name,
      email: e.email,
      roleLabel: e.role ? ROLE_LABEL[e.role] : "Unrecognised role",
      suspended: e.suspended,
      suspensionReason: e.suspensionReason,
      verified: e.verified,
      planName: e.planName,
      joined: date.format(e.joinedAt),
      can: {
        suspend: allowed("suspend"),
        reinstate: allowed("reinstate"),
        delete: allowed("delete"),
        roles: ROLE_NAMES.filter((r) => decideStaffOperation({ actor, target, operation: "set-role", newRole: r, adminCount }).allowed),
      },
    };
  });

  const href = (page: number, q: string = query.q) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (query.scope !== "customers") sp.set("scope", query.scope);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return `/staff/users${s ? `?${s}` : ""}`;
  };
  const scopes: { value: DirectoryScope; label: string }[] = [
    { value: "customers", label: "Customers" },
    { value: "staff", label: "Staff" },
    { value: "all", label: "Everyone" },
  ];

  return (
    <>
      <StaffHeading
        eyebrow="Directory"
        title={viewStaff ? "Accounts" : "Customers"}
        lede={
          viewStaff
            ? "Manage customers and staff. You can't act on your own account, and administrators can't be suspended or deleted."
            : "Customer accounts you can support. You can suspend and reinstate customers; nothing else."
        }
      />

      <section aria-labelledby="search-title" className={styles.panel}>
        <h2 id="search-title" className="sr-only">
          Search
        </h2>
        <form method="get" action="/staff/users" className={styles.searchForm} role="search">
          <div className={styles.searchField}>
            <label htmlFor="staff-q">Search name or email</label>
            <input id="staff-q" name="q" type="search" defaultValue={query.q} maxLength={SEARCH_MAX} autoComplete="off" />
          </div>
          {viewStaff && (
            <div className={styles.searchField}>
              <label htmlFor="staff-scope">Show</label>
              <select id="staff-scope" name="scope" defaultValue={query.scope}>
                {scopes.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className={styles.buttonPrimary}>
            Search
          </button>
        </form>
        <p className={styles.muted} role="status">
          {total === 0 ? "No accounts match." : `${total} account${total === 1 ? "" : "s"}${query.q ? ` matching “${query.q}”` : ""}.`}
          {query.q && (
            <>
              {" "}
              <Link href={href(1, "")} className={styles.textLink}>
                Clear search
              </Link>
            </>
          )}
        </p>
      </section>

      <StaffDirectory rows={rows} />
      <Pager page={query.page} pageCount={pageCount} href={href} />
    </>
  );
}
