import Link from "next/link";
import formStyles from "@/components/forms/forms.module.css";
import { formatMoney, PLANS, PRICING_COPY, type Plan } from "@/lib/plans";
import styles from "./PlanCards.module.css";

/**
 * The pricing table from the original homepage, with its original wording.
 * Everything comes from src/lib/plans.ts, so it renders statically and never
 * waits on, or fails with, the database.
 */
export function PlanCards() {
  return (
    <section id="plans" className={styles.section} aria-labelledby="plans-title">
      <header className={styles.head}>
        <p className={`${styles.eyebrow} mono`}>{PRICING_COPY.eyebrow}</p>
        <h2 id="plans-title" className={styles.title}>
          {PRICING_COPY.title}
        </h2>
        <p className={styles.lede}>{PRICING_COPY.lede}</p>
      </header>

      <ul className={styles.grid} role="list">
        {PLANS.map((plan) => (
          <li key={plan.id}>
            <PlanCard plan={plan} />
          </li>
        ))}
      </ul>

      <p className={styles.footnote}>{PRICING_COPY.footnote}</p>
    </section>
  );
}

const CTA_STYLE: Record<NonNullable<Plan["variant"]> | "default", string> = {
  default: `${formStyles.button} ${formStyles.secondary} ${formStyles.block}`,
  danger: `${formStyles.button} ${formStyles.secondary} ${formStyles.block}`,
  hero: `${formStyles.button} ${formStyles.block}`,
  tuffest: `${formStyles.button} ${formStyles.block} ${styles.gold}`,
};

function PlanCard({ plan }: { plan: Plan }) {
  // "$6,700.67" -> "6,700" and "67", shown as $6,700.67/mo like the original.
  const [whole, cents] = formatMoney(plan.price).slice(1).split(".");
  const nameId = `plan-${plan.id}`;

  return (
    <article className={[styles.card, plan.variant && styles[plan.variant]].filter(Boolean).join(" ")} aria-labelledby={nameId}>
      {plan.flag && <p className={styles.flag}>{plan.flag}</p>}
      <div className={styles.top}>
        <span className={styles.bars} aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={n <= plan.bars ? styles.barOn : undefined} />
          ))}
        </span>
        <p className={`${styles.kicker} mono`}>{plan.kicker}</p>
        <h3 id={nameId} className={styles.name}>
          {plan.name}
        </h3>
        <p className={styles.pitch}>{plan.pitch}</p>
        <p className={styles.price}>
          <span className={styles.cur}>$</span>
          {whole}
          <span className={styles.cents}>.{cents}</span>
          <span className={styles.per}>/mo</span>
        </p>
        <Link href={`/register?plan=${plan.id}`} className={`${CTA_STYLE[plan.variant ?? "default"]} ${styles.cta}`}>
          Choose plan<span className="sr-only">: {plan.name}</span>
        </Link>
      </div>
      <dl className={styles.spec}>
        {plan.specs.map((spec) => (
          <div key={spec.label}>
            <dt>{spec.label}</dt>
            <dd>{spec.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
