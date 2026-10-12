"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Field, useFieldIds } from "@/components/forms/Field";
import { Notice, SubmitButton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { authClient } from "@/lib/auth-client";
import { callAuth } from "@/lib/auth-call";
import { verifyCallbackURL } from "@/lib/redirects";
import { emailError } from "@/lib/validation";

const COOLDOWN_SECONDS = 60;

/**
 * Requests a fresh verification link. The answer is the same whether or not
 * the address has an account, so this can't be used to probe for accounts.
 */
export function ResendVerification({ email: fixedEmail, next, startCooledDown = false }: { email?: string; next: string; startCooledDown?: boolean }) {
  const ids = useFieldIds("email");
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [fieldError, setFieldError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cooldown, setCooldown] = useState(startCooledDown ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || cooldown > 0) return;
    const problem = fixedEmail ? undefined : emailError(email);
    setFieldError(problem);
    setAttempt((a) => a + 1);
    if (problem) return;

    setPending(true);
    const res = await callAuth("resend-verification", (fetchOptions) =>
      authClient.sendVerificationEmail({ email: email.trim(), callbackURL: verifyCallbackURL(next, true), fetchOptions }),
    );
    setPending(false);
    if (res.ok) {
      setResult({ ok: true, message: "If that address still needs confirming, a new link is on its way. It expires in 1 hour." });
      setCooldown(COOLDOWN_SECONDS);
    } else {
      setResult({ ok: false, message: res.message });
    }
  }

  return (
    <form className={formStyles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
      {result && (
        <Notice key={attempt} variant={result.ok ? "success" : "error"}>
          <p>{result.message}</p>
        </Notice>
      )}
      {!fixedEmail && (
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
      )}
      {cooldown > 0 ? (
        <button type="button" className={`${formStyles.button} ${formStyles.secondary} ${formStyles.block}`} disabled aria-disabled>
          Send another link in {cooldown}s
        </button>
      ) : (
        <SubmitButton pending={pending} pendingLabel="Sending…" variant="secondary">
          Send a new confirmation link
        </SubmitButton>
      )}
    </form>
  );
}
