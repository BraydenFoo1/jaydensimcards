"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Notice } from "@/components/forms/Feedback";
import formStyles from "@/components/forms/forms.module.css";
import { revokeOtherSessionsAction, revokeSessionAction, type ActionState } from "../actions";
import styles from "../portal.module.css";

export type DeviceRow = {
  id: string;
  device: string;
  location: string;
  signedIn: string;
  lastActive: string;
  current: boolean;
};

const INITIAL: ActionState = { status: "idle", message: "", at: 0 };

function Submit({ children, pendingLabel, label }: { children: string; pendingLabel: string; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${formStyles.button} ${formStyles.secondary} ${styles.smallButton}`}
      disabled={pending}
      aria-disabled={pending}
      aria-label={pending ? undefined : label}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * The device list and its sign-out controls. One component owns both action
 * states so the outcome message survives the refresh that removes the row
 * (or the whole "sign out others" control) it came from.
 */
export function DevicesPanel({ devices }: { devices: DeviceRow[] }) {
  const [oneState, revokeOne] = useActionState(revokeSessionAction, INITIAL);
  const [othersState, revokeOthers] = useActionState(revokeOtherSessionsAction, INITIAL);
  const latest = oneState.at >= othersState.at ? oneState : othersState;
  const others = devices.filter((d) => !d.current).length;

  return (
    <>
      <p className={styles.cardLede}>
        {others === 0 ? "Only this device is signed in." : `This device and ${others} other${others === 1 ? "" : "s"}.`}
      </p>
      {latest.status !== "idle" && (
        <div className={styles.devicesNotice}>
          <Notice key={latest.at} variant={latest.status === "success" ? "success" : "error"} focusOnMount>
            <p>{latest.message}</p>
          </Notice>
        </div>
      )}
      <ul className={styles.devices}>
        {devices.map((d) => (
          <li key={d.id} className={styles.device}>
            <div>
              <p className={styles.deviceName}>
                {d.device}
                {d.current && <span className={styles.currentBadge}>This device</span>}
              </p>
              <p className={styles.deviceMeta}>
                {d.location} · signed in {d.signedIn} · last active {d.lastActive}
              </p>
            </div>
            {!d.current && (
              <form action={revokeOne}>
                <input type="hidden" name="sessionId" value={d.id} />
                <Submit pendingLabel="Signing out…" label={`Sign out ${d.device}, signed in ${d.signedIn}`}>
                  Sign out
                </Submit>
              </form>
            )}
          </li>
        ))}
      </ul>
      {others > 0 && (
        <form action={revokeOthers}>
          <Submit pendingLabel="Signing out others…">Sign out all other devices</Submit>
        </form>
      )}
    </>
  );
}
