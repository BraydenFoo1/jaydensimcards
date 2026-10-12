"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, PasswordField, useFieldIds } from "@/components/forms/Field";
import { ErrorSummary, Notice, SubmitButton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { authClient } from "@/lib/auth-client";
import { callAuth } from "@/lib/auth-call";
import { DEFAULT_AFTER_LOGIN } from "@/lib/redirects";
import { hasErrors, validateSignIn, type FieldErrors } from "@/lib/validation";
import { ResendVerification } from "../ResendVerification";

export type LoginNotice = { variant: "success" | "info"; text: string };

export function LoginForm({ next, notice }: { next: string; notice: LoginNotice | null }) {
  const ids = useFieldIds("email", "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [failure, setFailure] = useState<{ message: string; code?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const fieldErrors = validateSignIn({ email, password });
    setErrors(fieldErrors);
    setFailure(null);
    setAttempt((a) => a + 1);
    if (hasErrors(fieldErrors)) return;

    setPending(true);
    // On success Better Auth's client follows callbackURL with a full page load,
    // so the destination renders fresh with the new session.
    const result = await callAuth("sign-in", (fetchOptions) =>
      authClient.signIn.email({ email: email.trim(), password, callbackURL: next, fetchOptions }),
    );
    if (result.ok) return;

    setPending(false);
    setPassword("");
    setFailure({ message: result.message, code: result.error?.code });
  }

  const registerHref = next === DEFAULT_AFTER_LOGIN ? "/register" : `/register?next=${encodeURIComponent(next)}`;
  const unverified = failure?.code === "EMAIL_NOT_VERIFIED";

  return (
    <div className={formStyles.form}>
      <form className={formStyles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
        {notice && !failure && !hasErrors(errors) && (
          <Notice variant={notice.variant} focusOnMount={false}>
            <p>{notice.text}</p>
          </Notice>
        )}
        {hasErrors(errors) ? (
          <ErrorSummary
            key={attempt}
            errors={errors}
            labels={{ email: { id: ids.email, label: "Email address" }, password: { id: ids.password, label: "Password" } }}
          />
        ) : (
          failure && (
            <Notice key={attempt} variant="error" title={unverified ? "Email not confirmed" : "Sign-in failed"}>
              <p>{failure.message}</p>
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
          error={errors.email}
          required
        />
        <PasswordField
          id={ids.password}
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
          labelAside={<Link href="/forgot-password">Forgot password?</Link>}
        />
        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      {unverified && <ResendVerification email={email.trim()} next={next} startCooledDown />}

      <p className={formStyles.links}>
        <span>New to the network?</span>
        <Link href={registerHref}>Create an account</Link>
      </p>
    </div>
  );
}
