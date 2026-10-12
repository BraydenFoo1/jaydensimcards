"use client";

import { useState } from "react";
import formStyles from "@/components/forms/forms.module.css";
import { authClient } from "@/lib/auth-client";
import { callAuth } from "@/lib/auth-call";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await callAuth("sign-out", (fetchOptions) => authClient.signOut({ fetchOptions }));
    if (result.ok) {
      // Deliberately a full page load rather than router.push: it discards the
      // client router cache, so no signed-in page can be restored afterwards.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?signedout=1");
      return;
    }
    setPending(false);
    setError(result.message);
  }

  return (
    <>
      <button type="button" className={className ?? `${formStyles.button} ${formStyles.secondary}`} onClick={signOut} disabled={pending} aria-disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <span role="alert" className={formStyles.error}>
          {error}
        </span>
      )}
    </>
  );
}
