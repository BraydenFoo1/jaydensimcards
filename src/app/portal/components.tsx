/**
 * Server-rendered pieces of the customer portal. All data is fictional.
 */
import type { ReactNode } from "react";
import type { NetworkStatus } from "@/lib/network-status";
import { formatData, formatMoney, type LineView, type Plan } from "@/lib/plans";
import styles from "./portal.module.css";

export function PageHeading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: ReactNode }) {
  return (
    <header className={styles.heading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {lede && <p className={styles.lede}>{lede}</p>}
    </header>
  );
}

export function SignalBars({ lit, label }: { lit: number; label: string }) {
  return (
    <span className={styles.bars} role="img" aria-label={label}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={n <= lit ? styles.barOn : undefined} />
      ))}
    </span>
  );
}

export function SimCard({ holder, iccid, plan }: { holder: string; iccid: string; plan: Plan | null }) {
  return (
    <figure className={styles.simWrap} aria-labelledby="sim-caption">
      <div className={styles.sim}>
        <div className={styles.simTop}>
          <span className={styles.simBrand}>
            JAYDEN <em>SIM</em>
          </span>
          <span className={styles.simGen}>{plan ? plan.generation : "NO PLAN"}</span>
        </div>
        <div className={styles.chip} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={styles.simBottom}>
          <p className={styles.simPlan}>{plan ? plan.name : "Awaiting activation"}</p>
          <p className={styles.simIccid}>ICCID {iccid}</p>
          <p className={styles.simHolder}>{holder}</p>
        </div>
      </div>
      <figcaption id="sim-caption" className={styles.simCaption}>
        Novelty SIM. Not a real SIM card, and no real network sits behind it.
      </figcaption>
    </figure>
  );
}

export function NetworkStatusPanel({ status }: { status: NetworkStatus }) {
  return (
    <section className={styles.console} aria-labelledby="network-status-title">
      <p className={styles.consoleKicker}>Live network status · fictional</p>
      <h2 id="network-status-title" className={styles.consoleTitle}>
        <span className={`${styles.level} ${styles[`level_${status.level}`]}`}>{status.label}</span>
        <span className={styles.consoleReason}>{status.reason}</span>
      </h2>
      <dl className={styles.readout}>
        <div>
          <dt>Towers online</dt>
          <dd>{status.towersOnline}</dd>
        </div>
        <div>
          <dt>Backup towers</dt>
          <dd>{status.backupTowers}</dd>
        </div>
        <div>
          <dt>Engineers</dt>
          <dd>{status.engineers}</dd>
        </div>
        <div>
          <dt>Peak latency</dt>
          <dd>{status.latency}</dd>
        </div>
        <div>
          <dt>Uptime</dt>
          <dd>{status.uptime}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{status.coverage}</dd>
        </div>
      </dl>
    </section>
  );
}

export function UsagePanel({ line }: { line: LineView & { plan: Plan } }) {
  const { plan, usedGb, allowanceGb, percent, remainingGb, isOver } = line;
  const fill = isOver ? 100 : percent === null ? 0 : Math.max(percent, 0.6);
  const valueText =
    allowanceGb === null ? `${formatData(usedGb)} used of an unlimited allowance` : `${formatData(usedGb)} used of ${formatData(allowanceGb)}`;

  return (
    <section className={styles.card} aria-labelledby="usage-title">
      <div className={styles.cardHead}>
        <h2 id="usage-title" className={styles.cardTitle}>
          Data this month
        </h2>
        <SignalBars lit={plan.bars} label={`Signal: ${plan.bars} of 4 bars`} />
      </div>

      <p className={styles.usageBig}>
        {formatData(usedGb)} <span>of {formatData(allowanceGb)}</span>
      </p>

      {allowanceGb === null ? (
        <p className={styles.unlimited}>Unlimited*. The asterisk is doing a lot of work.</p>
      ) : (
        <div
          className={`${styles.gauge} ${isOver ? styles.gaugeOver : percent !== null && percent >= 80 ? styles.gaugeWarn : ""}`}
          role="meter"
          aria-label="Data used this month"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(isOver ? 100 : (percent ?? 0))}
          aria-valuetext={valueText}
        >
          <span className={styles.gaugeFill} style={{ width: `${fill}%` }} />
        </div>
      )}

      {isOver && (
        <div className={styles.overAlert} role="note">
          <strong>You are over your allowance.</strong>{" "}
          {plan.excessPerKb !== null
            ? `Excess is billed at ${formatMoney(plan.excessPerKb)} ${plan.excessCurrency} per KB. We did warn you, in point two. (Fictional. Nobody is billed.)`
            : "Jayden has been notified. Jayden is in class."}
        </div>
      )}

      <dl className={styles.stats}>
        <div>
          <dt>Remaining</dt>
          <dd>{remainingGb === null ? "Unlimited" : formatData(remainingGb)}</dd>
        </div>
        <div>
          <dt>Monthly price</dt>
          <dd>
            {formatMoney(plan.price)}
            <small> /mo, never billed</small>
          </dd>
        </div>
        <div>
          <dt>Bars shown</dt>
          <dd>{plan.bars} of 4</dd>
        </div>
        <div>
          <dt>Bars real</dt>
          <dd>{Math.max(0, plan.bars - 1)} of 4</dd>
        </div>
        <div>
          <dt>Line status</dt>
          <dd>
            <span className={styles.pill}>Active</span>
          </dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>
            {plan.generation} · {plan.tier}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function PlanTerms({ plan }: { plan: Plan }) {
  return (
    <section className={styles.card} aria-labelledby="terms-title">
      <h2 id="terms-title" className={styles.cardTitle}>
        Your plan terms
      </h2>
      <p className={styles.cardLede}>Binding, in spirit.</p>
      <ol className={styles.terms}>
        {plan.terms.map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ol>
    </section>
  );
}
