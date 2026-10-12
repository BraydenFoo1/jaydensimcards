import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { firstParam } from "@/lib/redirects";
import { AuthHeading } from "../AuthHeading";
import styles from "../auth.module.css";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  // The reset token is in this page's URL; never send it to another site.
  referrer: "no-referrer",
};

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <>
      <AuthHeading eyebrow="Account recovery" title="Choose a new password" />
      <Suspense fallback={<FormSkeleton fields={2} label="Loading form" />}>
        <ResetGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ResetGate({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const params = await searchParams;
  const token = firstParam(params.token);
  const error = firstParam(params.error);

  if (error || !token || !/^[A-Za-z0-9_-]{8,256}$/.test(token)) {
    return (
      <div className={styles.stack}>
        <div className={`${formStyles.notice} ${formStyles.noticeError}`} role="alert">
          <p className={formStyles.noticeTitle}>Link not valid</p>
          <p>This reset link is invalid, has expired or has already been used. Reset links last 30 minutes and work once.</p>
        </div>
        <p className={formStyles.links}>
          <Link className={formStyles.button} href="/forgot-password">
            Request a new link
          </Link>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
