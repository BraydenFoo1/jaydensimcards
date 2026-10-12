import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import formStyles from "@/components/forms/forms.module.css";
import { can } from "@/lib/authz";
import type { RoleName } from "@/lib/permissions";
import { listOwnSessions } from "@/lib/portal/sessions";
import { requireSession } from "@/lib/session";
import { PageHeading } from "../components";
import styles from "../portal.module.css";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DevicesPanel } from "./DevicesPanel";

export const metadata: Metadata = { title: "Account & security" };

const ROLE_LABEL: Record<RoleName, string> = {
  customer: "Customer",
  employee: "Staff (employee)",
  admin: "Staff (administrator)",
};

const dateTime = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" });
const dateOnly = new Intl.DateTimeFormat("en-SG", { dateStyle: "long", timeZone: "Asia/Singapore" });

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const { user, sessionId } = await requireSession("/portal/account");

  if (!can(user.role, "account:read")) {
    return (
      <>
        <PageHeading eyebrow="Account & security" title="Account unavailable" />
        <div className={`${formStyles.notice} ${formStyles.noticeError}`} role="alert">
          <p>Your account type isn&rsquo;t recognised, so account features are switched off. Contact support.</p>
        </div>
        <SignOutButton />
      </>
    );
  }

  const devices = (await listOwnSessions(user, sessionId)).map((s) => ({
    id: s.id,
    device: s.device,
    location: s.location,
    // Formatted on the server in Singapore time so the client renders the same text.
    signedIn: dateTime.format(s.signedInAt),
    lastActive: dateTime.format(s.lastActiveAt),
    current: s.current,
  }));

  return (
    <>
      <PageHeading eyebrow="Account & security" title="Your account" lede="Details, password and the devices you're signed in on." />

      <section className={styles.card} aria-labelledby="details-title">
        <h2 id="details-title" className={styles.cardTitle}>
          Account details
        </h2>
        <dl className={styles.details}>
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              {user.email} <span className={styles.pill}>{user.emailVerified ? "Confirmed" : "Not confirmed"}</span>
            </dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>{user.role ? ROLE_LABEL[user.role] : "Unrecognised"}</dd>
          </div>
          <div>
            <dt>On the network since</dt>
            <dd>{dateOnly.format(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.splitGrid}>
        <section className={styles.card} aria-labelledby="password-title">
          <h2 id="password-title" className={styles.cardTitle}>
            Change password
          </h2>
          <p className={styles.cardLede}>You&rsquo;ll need your current password. New passwords are checked against known data breaches.</p>
          <ChangePasswordForm />
        </section>

        <section className={styles.card} aria-labelledby="devices-title">
          <h2 id="devices-title" className={styles.cardTitle}>
            Signed-in devices
          </h2>
          <DevicesPanel devices={devices} />
        </section>
      </div>

      <section className={styles.card} aria-labelledby="signout-title">
        <h2 id="signout-title" className={styles.cardTitle}>
          Sign out
        </h2>
        <p className={styles.cardLede}>Signs out this device only. The network will cope.</p>
        <SignOutButton />
      </section>
    </>
  );
}

function AccountSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className={styles.skeleton}>
      <span className="sr-only">Loading your account…</span>
      <div aria-hidden="true" className={styles.skeletonTitle} />
      <div aria-hidden="true" className={styles.skeletonBlock} />
      <div aria-hidden="true" className={styles.skeletonBlock} />
    </div>
  );
}
