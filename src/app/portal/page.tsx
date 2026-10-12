import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { can } from "@/lib/authz";
import { fictionalIccid } from "@/lib/iccid";
import { networkStatus } from "@/lib/network-status";
import { describeLine, planById } from "@/lib/plans";
import { getCustomerLine } from "@/lib/portal/line";
import { firstParam } from "@/lib/redirects";
import { requireSession, type CurrentUser } from "@/lib/session";
import { NetworkStatusPanel, PageHeading, PlanTerms, SimCard, UsagePanel } from "./components";
import { PlanSwitcher } from "./PlanSwitcher";
import styles from "./portal.module.css";

export const metadata: Metadata = { title: "My account" };

export default function PortalOverviewPage({ searchParams }: PageProps<"/portal">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

/** The security boundary for this page: a database-backed session check on every request. */
async function Overview({ searchParams }: Pick<PageProps<"/portal">, "searchParams">) {
  const { user } = await requireSession("/portal");
  const status = networkStatus(new Date());
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  if (!can(user.role, "line:read")) {
    return <NonCustomerOverview user={user} firstName={firstName} status={status} />;
  }

  const line = describeLine(await getCustomerLine(user));
  const params = await searchParams;
  const preselect = planById(firstParam(params.plan))?.id ?? null;

  return (
    <>
      <PageHeading
        eyebrow="My account"
        title={`Hello, ${firstName}`}
        lede={line.plan ? "Here is what the network thinks it owes you." : "Your line is ready. It just needs a plan, and Jayden needs a reason to get up."}
      />

      <div className={styles.topGrid}>
        <SimCard holder={user.name} iccid={fictionalIccid(user.id)} plan={line.plan} />
        <NetworkStatusPanel status={status} />
      </div>

      {line.plan && <UsagePanel line={{ ...line, plan: line.plan }} />}
      {/* PlanSwitcher keeps the same position whether or not a plan exists, so
          React preserves its action state (and success message) across the
          refresh that follows the first activation. */}
      <div className={line.plan ? styles.splitGrid : undefined}>
        {line.plan && <PlanTerms plan={line.plan} />}
        <PlanSwitcher currentPlanId={line.plan?.id ?? null} preselect={preselect} />
      </div>
    </>
  );
}

function NonCustomerOverview({ user, firstName, status }: { user: CurrentUser; firstName: string; status: ReturnType<typeof networkStatus> }) {
  const recognised = user.role !== null;
  return (
    <>
      <PageHeading
        eyebrow={recognised ? "Staff account" : "Account"}
        title={`Hello, ${firstName}`}
        lede={
          recognised
            ? "Staff accounts don't carry a SIM line. Jayden insisted: someone has to stay off the network."
            : "Your account type isn't recognised, so account features are switched off. Contact support."
        }
      />
      <div className={styles.topGrid}>
        <NetworkStatusPanel status={status} />
        <section className={styles.card} aria-labelledby="next-title">
          <h2 id="next-title" className={styles.cardTitle}>
            Your account
          </h2>
          <p className={styles.cardLede}>Change your password and see where you&rsquo;re signed in.</p>
          <p>
            <Link className={styles.textLink} href="/portal/account">
              Go to account &amp; security
            </Link>
          </p>
          {recognised && (
            <p>
              <Link className={styles.textLink} href="/staff">
                Open the staff console
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className={styles.skeleton}>
      <span className="sr-only">Loading your account…</span>
      <div aria-hidden="true" className={styles.skeletonTitle} />
      <div aria-hidden="true" className={styles.topGrid}>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
      </div>
      <div aria-hidden="true" className={styles.skeletonBlock} />
    </div>
  );
}
