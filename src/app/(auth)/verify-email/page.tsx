import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { linkErrorMessage } from "@/lib/auth-errors";
import { firstParam, safeNextPath } from "@/lib/redirects";
import { getCurrentUser } from "@/lib/session";
import { AuthHeading } from "../AuthHeading";
import styles from "../auth.module.css";
import { ResendVerification } from "../ResendVerification";

export const metadata: Metadata = { title: "Confirm your email" };

/**
 * Better Auth lands people here after a verification link:
 *   ?error=CODE          the link failed (expired, invalid, already used)
 *   ?confirmed=1         the link worked and the user is now signed in
 *   (neither)            reached directly, or the sign-in flow's callback
 */
export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={<FormSkeleton fields={1} label="Checking your link" />}>
      <VerifyOutcome searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyOutcome({ searchParams }: Pick<PageProps<"/verify-email">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const error = linkErrorMessage(firstParam(params.error));
  const user = error ? null : await getCurrentUser();

  if (user && firstParam(params.confirmed) === "1") {
    return (
      <>
        <AuthHeading eyebrow="Line activated" title="Email confirmed" lede="Your account is ready. Welcome to the network." />
        <div className={styles.stack}>
          <div className={`${formStyles.notice} ${formStyles.noticeSuccess}`} role="status">
            <p className={formStyles.noticeTitle}>Signal acquired</p>
            <p>
              You&rsquo;re signed in as <span className={styles.email}>{user.email}</span>. Coverage is wherever Jayden is
              standing.
            </p>
          </div>
          <Link className={`${formStyles.button} ${formStyles.block}`} href={next}>
            Continue to your account
          </Link>
        </div>
      </>
    );
  }

  if (user) redirect(next);

  return (
    <>
      <AuthHeading
        eyebrow="Account activation"
        title={error ? "Link not valid" : "Confirm your email"}
        lede={error ? undefined : "Need a new confirmation link? Enter your email and we'll send one."}
      />
      <div className={styles.stack}>
        {error && (
          <div className={`${formStyles.notice} ${formStyles.noticeError}`} role="alert">
            <p className={formStyles.noticeTitle}>Confirmation failed</p>
            <p>{error}</p>
          </div>
        )}
        <ResendVerification next={next} />
        <p className={formStyles.links}>
          <span>Already confirmed?</span>
          <Link href={next === "/portal" ? "/login" : `/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </div>
    </>
  );
}
