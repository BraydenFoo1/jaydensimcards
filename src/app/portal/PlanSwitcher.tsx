"use client";

import { useActionState } from "react";
import { Notice, SubmitButton } from "@/components/forms/Feedback";
import { formatMoney, PLANS, type PlanId } from "@/lib/plans";
import { switchPlanAction, type ActionState } from "./actions";
import styles from "./portal.module.css";

const INITIAL: ActionState = { status: "idle", message: "", at: 0 };

export function PlanSwitcher({ currentPlanId, preselect }: { currentPlanId: PlanId | null; preselect: PlanId | null }) {
  const [state, formAction, pending] = useActionState(switchPlanAction, INITIAL);
  const activating = currentPlanId === null;

  return (
    <section className={styles.card} aria-labelledby="switch-title">
      <h2 id="switch-title" className={styles.cardTitle}>
        {activating ? "Choose your plan" : "Change your plan"}
      </h2>
      <p className={styles.cardLede}>Switching is instant. Regret is monthly. All plans are fictional.</p>

      <form action={formAction} className={styles.switchForm} aria-busy={pending}>
        {state.status !== "idle" && (
          <Notice key={state.at} variant={state.status === "success" ? "success" : "error"} focusOnMount>
            <p>{state.message}</p>
          </Notice>
        )}
        <fieldset className={styles.planGrid}>
          <legend className="sr-only">Plans</legend>
          {PLANS.map((plan) => (
            <label key={plan.id} className={styles.planOption}>
              <input type="radio" name="planId" value={plan.id} defaultChecked={plan.id === (preselect ?? currentPlanId)} required />
              <span className={styles.planText}>
                <span className={styles.planName}>
                  {plan.name}
                  {plan.id === currentPlanId && <span className={styles.currentBadge}>Current</span>}
                </span>
                <span className={styles.planMeta}>
                  {formatMoney(plan.price)}/mo · {plan.dataLabel} · {plan.generation}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className={styles.switchActions}>
          <SubmitButton pending={pending} pendingLabel="Switching…">
            {activating ? "Activate plan" : "Switch plan"}
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
