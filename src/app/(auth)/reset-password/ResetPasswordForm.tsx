"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PasswordField, useFieldIds } from "@/components/forms/Field";
import { ErrorSummary, Notice, SubmitButton } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { authClient } from "@/lib/auth-client";
import { callAuth } from "@/lib/auth-call";
import { hasErrors, PASSWORD_MAX, PASSWORD_MIN, validateNewPassword, type FieldErrors } from "@/lib/validation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const ids = useFieldIds("password", "confirm");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"password" | "confirm">>({});
  const [failure, setFailure] = useState<{ message: string; expired: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);

  // Keep the token in memory only: drop it from the address bar and history.
  useEffect(() => {
    window.history.replaceState(null, "", "/reset-password");
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const fieldErrors = validateNewPassword({ password, confirm });
    setErrors(fieldErrors);
    setFailure(null);
    setAttempt((a) => a + 1);
    if (hasErrors(fieldErrors)) return;

    setPending(true);
    const result = await callAuth("reset-password", (fetchOptions) => authClient.resetPassword({ newPassword: password, token, fetchOptions }));
    if (result.ok) {
      // Every session was revoked, including any on this device.
      router.replace("/login?reset=1");
      return;
    }
    setPending(false);
    setPassword("");
    setConfirm("");
    setFailure({ message: result.message, expired: result.error?.code === "INVALID_TOKEN" });
  }

  return (
    <form className={formStyles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
      {hasErrors(errors) ? (
        <ErrorSummary
          key={attempt}
          errors={errors}
          labels={{ password: { id: ids.password, label: "New password" }, confirm: { id: ids.confirm, label: "Confirm new password" } }}
        />
      ) : (
        failure && (
          <Notice key={attempt} variant="error" title="Password not changed">
            <p>{failure.message}</p>
            {failure.expired && (
              <p>
                <Link href="/forgot-password">Request a new reset link</Link>
              </p>
            )}
          </Notice>
        )
      )}
      <PasswordField
        id={ids.password}
        label="New password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint={`At least ${PASSWORD_MIN} characters. Changing it signs you out on every device.`}
        required
      />
      <PasswordField
        id={ids.confirm}
        label="Confirm new password"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirm}
        required
      />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
