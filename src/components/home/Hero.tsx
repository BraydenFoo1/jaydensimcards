import { TowerMark } from "@/components/brand/Wordmark";
import formStyles from "@/components/forms/forms.module.css";
import { HERO } from "@/lib/home-content";
import { CoverageMap } from "./CoverageMap";
import styles from "./home.module.css";

/** The original hero: slogan, stats, the novelty SIM card and the coverage-map button. */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={`${styles.eyebrow} mono`}>
            <i className={styles.dotLive} aria-hidden="true" /> {HERO.eyebrow}
          </p>

          <h1 id="hero-title" className={styles.slogan}>
            When there is a{" "}
            <span className={styles.tag}>
              sim<em>(will)</em>
            </span>
            ,<br />
            There is a{" "}
            <span className={`${styles.tag} ${styles.tagAlt}`}>
              card<em>(way)</em>
            </span>
          </h1>

          <p className={styles.heroSub}>{HERO.sub}</p>

          <div className={styles.heroActions}>
            <a className={formStyles.button} href="#plans">
              See the plans
            </a>
            <CoverageMap />
          </div>

          <dl className={styles.stats}>
            {HERO.stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.heroFootnote}>{HERO.footnote}</p>
        </div>

        {/* The signature object: a novelty SIM card, decorative only. */}
        <div className={styles.heroCard} aria-hidden="true">
          <div className={styles.sim}>
            <div className={styles.simChip}>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <div className={styles.simMeta}>
              <p className="mono">{HERO.simIccid}</p>
              <p className="mono">{HERO.simHolder}</p>
            </div>
            <div className={styles.simBrand}>
              <span className={styles.simMark}>
                <TowerMark />
              </span>
              <span>
                Jayden<em>SIM</em>
              </span>
            </div>
          </div>
          {HERO.chips.map((chip, i) => (
            <div key={chip} className={`${styles.heroChip} ${styles[`heroChip${i + 1}`]} mono`}>
              {i === 0 && <i className={styles.dotLive} />} {chip}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
