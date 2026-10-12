"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Notice } from "@/components/forms/Feedback";
import type { RoleName } from "@/lib/permissions";
import { BAN_REASONS } from "@/lib/staff/query";
import { deleteUserAction, reinstateUserAction, setRoleAction, suspendUserAction, type StaffActionState } from "../actions";
import styles from "../staff.module.css";

export type DirectoryRowView = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  suspended: boolean;
  suspensionReason: string | null;
  verified: boolean;
  planName: string | null;
  joined: string;
  /** Display hints only. Every action is re-authorized on the server. */
  can: { suspend: boolean; reinstate: boolean; delete: boolean; roles: RoleName[] };
};

const INITIAL: StaffActionState = { status: "idle", message: "", at: 0 };
const ROLE_LABEL: Record<RoleName, string> = { customer: "Customer", employee: "Employee", admin: "Administrator" };

function Submit({ children, pendingLabel, variant = "primary" }: { children: string; pendingLabel: string; variant?: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={variant === "danger" ? styles.buttonDanger : styles.buttonPrimary} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * One component owns every action's state, so the outcome message survives
 * the refresh that changes (or removes) the row it came from.
 */
export function StaffDirectory({ rows }: { rows: DirectoryRowView[] }) {
  const [suspendState, suspend] = useActionState(suspendUserAction, INITIAL);
  const [reinstateState, reinstate] = useActionState(reinstateUserAction, INITIAL);
  const [roleState, setRole] = useActionState(setRoleAction, INITIAL);
  const [deleteState, remove] = useActionState(deleteUserAction, INITIAL);
  const latest = [suspendState, reinstateState, roleState, deleteState].reduce((a, b) => (b.at > a.at ? b : a));

  return (
    <section aria-labelledby="directory-title" className={styles.directory}>
      <h2 id="directory-title" className="sr-only">
        Accounts
      </h2>
      {latest.status !== "idle" && (
        <Notice key={latest.at} variant={latest.status === "success" ? "success" : "error"} focusOnMount>
          <p>{latest.message}</p>
        </Notice>
      )}
      <ul className={styles.cards}>
        {rows.map((row) => (
          <li key={row.id} className={styles.card}>
            <AccountCard row={row} actions={{ suspend, reinstate, setRole, remove }} />
          </li>
        ))}
      </ul>
    </section>
  );
}

type Actions = {
  suspend: (formData: FormData) => void;
  reinstate: (formData: FormData) => void;
  setRole: (formData: FormData) => void;
  remove: (formData: FormData) => void;
};

function AccountCard({ row, actions }: { row: DirectoryRowView; actions: Actions }) {
  const ids = useId();
  const manageable = row.can.suspend || row.can.reinstate || row.can.delete || row.can.roles.length > 0;

  return (
    <article aria-labelledby={`${ids}-name`}>
      <div className={styles.cardHead}>
        <h3 id={`${ids}-name`} className={styles.cardName}>
          {row.name}
        </h3>
        <span className={row.suspended ? styles.pillBad : styles.pillGood}>{row.suspended ? "Suspended" : "Active"}</span>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Email</dt>
          <dd>
            {row.email} {!row.verified && <span className={styles.pillWarn}>Not confirmed</span>}
          </dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{row.roleLabel}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{row.planName ?? "None"}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{row.joined}</dd>
        </div>
        {row.suspended && row.suspensionReason && (
          <div>
            <dt>Suspension reason</dt>
            <dd>{row.suspensionReason}</dd>
          </div>
        )}
      </dl>

      {manageable && (
        <details className={styles.manage}>
          <summary>
            Manage <span className="sr-only">{row.email}</span>
          </summary>
          <div className={styles.manageBody}>
            {row.can.suspend && (
              <form action={actions.suspend} className={styles.inlineForm}>
                <input type="hidden" name="userId" value={row.id} />
                <label htmlFor={`${ids}-reason`}>Suspension reason</label>
                <select id={`${ids}-reason`} name="reason" defaultValue="" required>
                  <option value="" disabled>
                    Choose a reason…
                  </option>
                  {Object.entries(BAN_REASONS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <Submit pendingLabel="Suspending…" variant="danger">
                  Suspend account
                </Submit>
              </form>
            )}
            {row.can.reinstate && (
              <form action={actions.reinstate} className={styles.inlineForm}>
                <input type="hidden" name="userId" value={row.id} />
                <Submit pendingLabel="Reinstating…">Reinstate account</Submit>
              </form>
            )}
            {row.can.roles.length > 0 && (
              <form action={actions.setRole} className={styles.inlineForm}>
                <input type="hidden" name="userId" value={row.id} />
                <label htmlFor={`${ids}-role`}>New role</label>
                <select id={`${ids}-role`} name="role" defaultValue="" required>
                  <option value="" disabled>
                    Choose a role…
                  </option>
                  {row.can.roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <Submit pendingLabel="Changing…">Change role</Submit>
              </form>
            )}
            {row.can.delete && (
              <form action={actions.remove} className={styles.inlineForm}>
                <input type="hidden" name="userId" value={row.id} />
                <label htmlFor={`${ids}-confirm`}>
                  Type <span className={styles.mono}>DELETE</span> to permanently delete this account and its data
                </label>
                <input id={`${ids}-confirm`} name="confirm" autoComplete="off" required pattern="DELETE" />
                <Submit pendingLabel="Deleting…" variant="danger">
                  Delete account
                </Submit>
              </form>
            )}
          </div>
        </details>
      )}
    </article>
  );
}
