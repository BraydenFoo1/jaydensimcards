"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, PasswordField, useFieldIds } from "@/components/forms/Field";
import { ErrorSummary, Notice, SubmitButton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { authClient } from "@/lib/auth-client";
import { callAuth } from "@/lib/auth-call";
import { currentConsent } from "@/lib/legal";
import { DEFAULT_AFTER_LOGIN, verifyCallbackURL } from "@/lib/redirects";
import { hasErrors, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, validateRegistration, type FieldErrors, type RegistrationInput } from "@/lib/validation";
import styles from "../auth.module.css";
import { ResendVerification } from "../ResendVerification";

type Fields = keyof RegistrationInput;

const EMPTY: RegistrationInput = { name: "", email: "", password: "", confirm: "", acknowledged: false, agreed: false };

export function RegisterForm({ next }: { next: string }) {
  const ids = useFieldIds("name", "email", "password", "confirm", "acknowledged", "agreed", "submitHint");
  const [values, setValues] = useState<RegistrationInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = <K extends Fields>(key: K, value: RegistrationInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const fieldErrors = validateRegistration(values);
    setErrors(fieldErrors);
    setFailure(null);
    setAttempt((a) => a + 1);
    if (hasErrors(fieldErrors)) return;

    setPending(true);
    const email = values.email.trim();
    // Extra body field (not part of Better Auth's typed client): the server refuses
    // sign-up unless it names the current Terms and Privacy Policy versions.
    const consent = { legalConsent: currentConsent() };
    const result = await callAuth("sign-up", (fetchOptions) =>
      authClient.signUp.email({
        ...consent,
        name: values.name.trim(),
        email,
        password: values.password,
        callbackURL: verifyCallbackURL(next, true),
        fetchOptions,
      }),
    );
    setPending(false);

    if (result.ok) {
      // Identical whether the address was new or already registered: the
      // existing owner gets a heads-up email instead of a second account.
      setValues(EMPTY);
      setSentTo(email);
      return;
    }
    setValues((v) => ({ ...v, password: "", confirm: "" }));
    setFailure(result.message);
  }

  if (sentTo) {
    return <CheckEmail email={sentTo} next={next} onRestart={() => setSentTo(null)} />;
  }

  const labels = {
    name: { id: ids.name, label: "Full name" },
    email: { id: ids.email, label: "Email address" },
    password: { id: ids.password, label: "Password" },
    confirm: { id: ids.confirm, label: "Confirm password" },
    acknowledged: { id: ids.acknowledged, label: "Fictional service" },
    agreed: { id: ids.agreed, label: "Terms and Privacy Policy" },
  };
  const loginHref = next === DEFAULT_AFTER_LOGIN ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className={formStyles.form}>
      <form className={formStyles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
        {hasErrors(errors) ? (
          <ErrorSummary key={attempt} errors={errors} labels={labels} />
        ) : (
          failure && (
            <Notice key={attempt} variant="error" title="Account not created">
              <p>{failure}</p>
            </Notice>
          )
        )}

        <Field
          id={ids.name}
          label="Full name"
          autoComplete="name"
          maxLength={NAME_MAX}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
          required
        />
        <Field
          id={ids.email}
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
          hint="We'll send a link to confirm it's yours."
          required
        />
        <PasswordField
          id={ids.password}
          label="Password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters. A few unrelated words make a strong, memorable password. We'll reject any password found in a known data breach.`}
          required
        />
        <PasswordField
          id={ids.confirm}
          label="Confirm password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={values.confirm}
          onChange={(e) => set("confirm", e.target.value)}
          error={errors.confirm}
          required
        />

        <div className={formStyles.field}>
          {errors.acknowledged && (
            <p id={`${ids.acknowledged}-error`} className={formStyles.error}>
              {errors.acknowledged}
            </p>
          )}
          <label className={formStyles.checkbox} htmlFor={ids.acknowledged}>
            <input
              id={ids.acknowledged}
              type="checkbox"
              checked={values.acknowledged}
              onChange={(e) => set("acknowledged", e.target.checked)}
              aria-invalid={errors.acknowledged ? true : undefined}
              aria-describedby={errors.acknowledged ? `${ids.acknowledged}-error` : undefined}
              required
            />
            <span>
              I understand Jayden SIM Cards is a fictional parody. No real SIM card, mobile service or billing is
              involved.
            </span>
          </label>
        </div>

        <div className={formStyles.field}>
          {errors.agreed && (
            <p id={`${ids.agreed}-error`} className={formStyles.error}>
              {errors.agreed}
            </p>
          )}
          <label className={formStyles.checkbox} htmlFor={ids.agreed}>
            <input
              id={ids.agreed}
              type="checkbox"
              checked={values.agreed}
              onChange={(e) => set("agreed", e.target.checked)}
              aria-invalid={errors.agreed ? true : undefined}
              aria-describedby={errors.agreed ? `${ids.agreed}-error` : undefined}
              required
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" rel="noopener">
                Terms of Service<span className="sr-only"> (opens in a new tab)</span>
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" rel="noopener">
                Privacy Policy<span className="sr-only"> (opens in a new tab)</span>
              </Link>
              .
            </span>
          </label>
        </div>

        {!values.agreed && (
          <p id={ids.submitHint} className={formStyles.hint}>
            Tick &ldquo;I agree to the Terms of Service and Privacy Policy&rdquo; to create your account.
          </p>
        )}
        <SubmitButton pending={pending} pendingLabel="Creating account…" disabled={!values.agreed} describedBy={values.agreed ? undefined : ids.submitHint}>
          Create account
        </SubmitButton>
      </form>

      <p className={formStyles.links}>
        <span>Already on the network?</span>
        <Link href={loginHref}>Sign in</Link>
      </p>
    </div>
  );
}

function CheckEmail({ email, next, onRestart }: { email: string; next: string; onRestart: () => void }) {
  return (
    <div className={styles.stack}>
      {/* Takes focus so keyboard and screen-reader users land on the outcome. */}
      <Notice variant="success" title="Check your email" focusOnMount>
        <p>
          We&rsquo;ve sent a confirmation link to <span className={styles.email}>{email}</span>. Open it to activate your
          account. The link expires in 1 hour.
        </p>
        <p>Can&rsquo;t find it? Check your spam folder. Jayden&rsquo;s emails get mistaken for spam a lot.</p>
      </Notice>
      <ResendVerification email={email} next={next} startCooledDown />
      <p className={formStyles.links}>
        <button type="button" className={`${formStyles.button} ${formStyles.secondary}`} onClick={onRestart}>
          Use a different email
        </button>
        <Link href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
