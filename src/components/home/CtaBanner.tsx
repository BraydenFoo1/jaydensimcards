import formStyles from "@/components/forms/forms.module.css";
import { CTA_COPY } from "@/lib/home-content";
import { planById } from "@/lib/plans";
import { BuyLink } from "./BuyLink";
import styles from "./home.module.css";

/** The original closing banner. Its button signs up for The Ultra Jayden 5G, as before. */
export function CtaBanner() {
  const plan = planById(CTA_COPY.planId);
  if (!plan) throw new Error(`Unknown plan in the call to action: ${CTA_COPY.planId}`);

  return (
    <section className={styles.cta} aria-labelledby="cta-title">
      <div className={styles.ctaInner}>
        <h2 id="cta-title" className={styles.ctaTitle}>
          {CTA_COPY.title}
        </h2>
        <p className={styles.ctaSub}>{CTA_COPY.sub}</p>
        <BuyLink href={`/register?plan=${plan.id}`} planName={plan.name} className={`${formStyles.button} ${styles.ctaButton}`}>
          {CTA_COPY.button}
        </BuyLink>
      </div>
    </section>
  );
}
