import type { Metadata } from "next";
import { Suspense } from "react";
import { listActivity } from "@/lib/staff/data";
import { ACTION_LABELS } from "@/lib/staff/query";
import { firstParam } from "@/lib/redirects";
import { requireStaff } from "@/lib/session";
import { ConsoleSkeleton, Pager, StaffHeading } from "../ui";
import styles from "../staff.module.css";

export const metadata: Metadata = { title: "Activity log" };

const time = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Singapore" });

export default function ActivityPage({ searchParams }: PageProps<"/staff/activity">) {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({ searchParams }: Pick<PageProps<"/staff/activity">, "searchParams">) {
  const user = await requireStaff();
  const params = await searchParams;
  const { entries, page, pageCount, scope } = await listActivity(user, firstParam(params.page));

  return (
    <>
      <StaffHeading
        eyebrow="Activity log"
        title="Who did what"
        lede={
          scope === "all"
            ? "Every recorded account and staff event. Entries store account ids only; names appear while the account exists."
            : "Customer suspensions and reinstatements. Sign-ins, role changes and other security events are visible to administrators only."
        }
      />

      <section aria-labelledby="log-title" className={styles.panel}>
        <h2 id="log-title" className="sr-only">
          Entries
        </h2>
        {entries.length === 0 ? (
          <p className={styles.muted}>Nothing logged yet.</p>
        ) : (
          <ol className={styles.log}>
            {entries.map((e) => (
              <li key={e.id}>
                <span className={styles.logTime}>{time.format(e.at)}</span>
                <span>
                  <strong>{ACTION_LABELS[e.action] ?? e.action}</strong> · {e.actor}
                  {e.target && <> → {e.target}</>}
                  {e.detail && <span className={styles.logDetail}> ({e.detail})</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        <Pager page={page} pageCount={pageCount} href={(p) => `/staff/activity?page=${p}`} />
      </section>
    </>
  );
}
