import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NetworkStatusPanel } from "@/app/portal/components";
import { networkStatus } from "@/lib/network-status";
import { getStaffStats, listActivity } from "@/lib/staff/data";
import { ACTION_LABELS } from "@/lib/staff/query";
import { requireStaff } from "@/lib/session";
import { ConsoleSkeleton, StaffHeading } from "./ui";
import styles from "./staff.module.css";

export const metadata: Metadata = { title: "Overview" };

const time = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" });

export default function StaffOverviewPage() {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await requireStaff();
  const [stats, activity] = await Promise.all([getStaffStats(user), listActivity(user, "1")]);
  const status = networkStatus(new Date());
  const maxPlan = Math.max(1, ...stats.plans.map((p) => p.count));

  return (
    <>
      <StaffHeading
        eyebrow={user.role === "admin" ? "Administrator" : "Employee"}
        title="Network operations centre"
        lede={`Signed in as ${user.email}. One tower, one engineer, and now you.`}
      />

      <section aria-labelledby="stats-title" className={styles.panel}>
        <h2 id="stats-title" className={styles.panelTitle}>
          Customer lines
        </h2>
        <dl className={styles.tiles}>
          <div>
            <dt>Customers</dt>
            <dd>{stats.customers}</dd>
          </div>
          <div>
            <dt>Suspended</dt>
            <dd className={stats.suspendedCustomers > 0 ? styles.alertValue : undefined}>{stats.suspendedCustomers}</dd>
          </div>
          <div>
            <dt>Email not confirmed</dt>
            <dd>{stats.unverifiedCustomers}</dd>
          </div>
          <div>
            <dt>New this week</dt>
            <dd>{stats.newThisWeek}</dd>
          </div>
        </dl>
        {stats.staff && (
          <dl className={styles.tiles}>
            <div>
              <dt>Employees</dt>
              <dd>{stats.staff.employees}</dd>
            </div>
            <div>
              <dt>Administrators</dt>
              <dd>{stats.staff.admins}</dd>
            </div>
            <div>
              <dt>Unrecognised roles</dt>
              <dd className={stats.staff.unrecognised > 0 ? styles.alertValue : undefined}>{stats.staff.unrecognised}</dd>
            </div>
          </dl>
        )}
      </section>

      <div className={styles.split}>
        <NetworkStatusPanel status={status} />

        <section aria-labelledby="plans-title" className={styles.panel}>
          <h2 id="plans-title" className={styles.panelTitle}>
            Plans in use
          </h2>
          {stats.plans.length === 0 ? (
            <p className={styles.muted}>No customers yet. Jayden is refreshing the page.</p>
          ) : (
            <ul className={styles.planBars}>
              {stats.plans.map((p) => (
                <li key={p.name}>
                  <span className={styles.planBarLabel}>
                    {p.name} <span className={styles.mono}>{p.count}</span>
                  </span>
                  <span className={styles.planBarTrack} aria-hidden="true">
                    <span style={{ width: `${(p.count / maxPlan) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="recent-title" className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 id="recent-title" className={styles.panelTitle}>
            Recent activity
          </h2>
          <Link href="/staff/activity" className={styles.textLink}>
            Full activity log
          </Link>
        </div>
        {activity.entries.length === 0 ? (
          <p className={styles.muted}>Nothing logged yet.</p>
        ) : (
          <ol className={styles.log}>
            {activity.entries.slice(0, 6).map((e) => (
              <li key={e.id}>
                <span className={styles.logTime}>{time.format(e.at)}</span>
                <span>
                  <strong>{ACTION_LABELS[e.action] ?? e.action}</strong> · {e.actor}
                  {e.target && <> → {e.target}</>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
