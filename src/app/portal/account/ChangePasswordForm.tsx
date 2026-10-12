"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField, useFieldIds } from "@/components/forms/Field";
import { ErrorSummary, Notice, SubmitButton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { authClient } from "@/lib/auth-client";
import { callAuth } from "@/lib/auth-call";
import { hasErrors, PASSWORD_MAX, PASSWORD_MIN, validateChangePassword, type ChangePasswordInput, type FieldErrors } from "@/lib/validation";

const EMPTY: ChangePasswordInput = { current: "", password: "", confirm: "" };

/**
 * Goes through Better Auth's /change-password endpoint, so it keeps that
 * endpoint's rate limit, origin check and breached-password check.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const ids = useFieldIds("current", "password", "confirm", "revoke");
  const [values, setValues] = useState<ChangePasswordInput>(EMPTY);
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [errors, setErrors] = useState<FieldErrors<keyof ChangePasswordInput>>({});
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);

  const set = (key: keyof ChangePasswordInput, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const fieldErrors = validateChangePassword(values);
    setErrors(fieldErrors);
    setResult(null);
    setAttempt((a) => a + 1);
    if (hasErrors(fieldErrors)) return;

    setPending(true);
    const res = await callAuth("change-password", (fetchOptions) =>
      authClient.changePassword({ currentPassword: values.current, newPassword: values.password, revokeOtherSessions: revokeOthers, fetchOptions }),
    );
    setPending(false);
    setValues(EMPTY);
    if (res.ok) {
      setResult({
        ok: true,
        message: revokeOthers ? "Password changed. Every other device has been signed out." : "Password changed.",
      });
      router.refresh(); // the device list may have changed
    } else {
      setResult({ ok: false, message: res.message });
    }
  }

  return (
    <form className={formStyles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
      {hasErrors(errors) ? (
        <ErrorSummary
          key={attempt}
          errors={errors}
          labels={{
            current: { id: ids.current, label: "Current password" },
            password: { id: ids.password, label: "New password" },
            confirm: { id: ids.confirm, label: "Confirm new password" },
          }}
        />
      ) : (
        result && (
          <Notice key={attempt} variant={result.ok ? "success" : "error"} title={result.ok ? "Password updated" : "Password not changed"} focusOnMount>
            <p>{result.message}</p>
          </Notice>
        )
      )}
      <PasswordField id={ids.current} label="Current password" autoComplete="current-password" value={values.current} onChange={(e) => set("current", e.target.value)} error={errors.current} required />
      <PasswordField
        id={ids.password}
        label="New password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        value={values.password}
        onChange={(e) => set("password", e.target.value)}
        error={errors.password}
        hint={`At least ${PASSWORD_MIN} characters.`}
        required
      />
      <PasswordField
        id={ids.confirm}
        label="Confirm new password"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        value={values.confirm}
        onChange={(e) => set("confirm", e.target.value)}
        error={errors.confirm}
        required
      />
      <label className={formStyles.checkbox} htmlFor={ids.revoke}>
        <input id={ids.revoke} type="checkbox" checked={revokeOthers} onChange={(e) => setRevokeOthers(e.target.checked)} />
        <span>Sign out of every other device</span>
      </label>
      <SubmitButton pending={pending} pendingLabel="Changing password…">
        Change password
      </SubmitButton>
    </form>
  );
}
