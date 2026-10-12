"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, useFieldIds } from "@/components/forms/Field";
import { ErrorSummary, Notice, SubmitButton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { authClient } from "@/lib/auth-client";
import { callAuth } from "@/lib/auth-call";
import { emailError } from "@/lib/validation";
import styles from "../auth.module.css";

export function ForgotPasswordForm() {
  const ids = useFieldIds("email");
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const problem = emailError(email);
    setFieldError(problem);
    setFailure(null);
    setAttempt((a) => a + 1);
    if (problem) return;

    setPending(true);
    const address = email.trim();
    const result = await callAuth("forgot-password", (fetchOptions) =>
      authClient.requestPasswordReset({ email: address, redirectTo: "/reset-password", fetchOptions }),
    );
    setPending(false);
    if (result.ok) setSentTo(address);
    else setFailure(result.message);
  }

  if (sentTo) {
    return (
      <div className={styles.stack}>
        <Notice variant="success" title="Check your email" focusOnMount>
          <p>
            If there&rsquo;s an account for <span className={styles.email}>{sentTo}</span>, we&rsquo;ve sent a link to
            reset its password. The link expires in 30 minutes.
          </p>
          <p>Nothing arrived? Check your spam folder, or try again in a few minutes.</p>
        </Notice>
        <p className={formStyles.links}>
          <Link href="/login">Back to sign in</Link>
          <button type="button" className={`${formStyles.button} ${formStyles.secondary}`} onClick={() => setSentTo(null)}>
            Try a different email
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={formStyles.form}>
      <form className={formStyles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
        {fieldError ? (
          <ErrorSummary key={attempt} errors={{ email: fieldError }} labels={{ email: { id: ids.email, label: "Email address" } }} />
        ) : (
          failure && (
            <Notice key={attempt} variant="error" title="Link not sent">
              <p>{failure}</p>
            </Notice>
          )
        )}
        <Field
          id={ids.email}
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
          required
        />
        <SubmitButton pending={pending} pendingLabel="Sending link…">
          Send reset link
        </SubmitButton>
      </form>
      <p className={formStyles.links}>
        <span>Remembered it?</span>
        <Link href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
