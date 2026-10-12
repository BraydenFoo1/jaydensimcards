import Link from "next/link";
import { FAQ, FAQ_COPY, type RichText } from "@/lib/home-content";
import styles from "./home.module.css";

function Rich({ parts }: { parts: RichText }) {
  return parts.map((part, i) =>
    typeof part === "string" ? (
      part
    ) : (
      <Link key={i} href={part.href}>
        {part.text}
      </Link>
    ),
  );
}

/**
 * The original FAQ. Native <details> work without JavaScript; the shared
 * name closes the others when one opens, as the original script did.
 */
export function Faq() {
  return (
    <section id="faq" className={styles.band} aria-labelledby="faq-title">
      <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
        <header className={styles.head}>
          <p className={`${styles.eyebrow} mono`}>{FAQ_COPY.eyebrow}</p>
          <h2 id="faq-title" className={styles.title}>
            {FAQ_COPY.title}
          </h2>
          <p className={styles.lede}>{FAQ_COPY.lede}</p>
        </header>

        <div className={styles.qa}>
          {FAQ.map((item) => (
            <details key={item.q} name="faq" className={styles.qaItem}>
              <summary className={styles.qaQ}>
                {item.q}
                <span className={styles.qaIcon} aria-hidden="true" />
              </summary>
              <div className={styles.qaA}>
                <p>
                  <Rich parts={item.a} />
                </p>
              </div>
            </details>
          ))}
        </div>

        <p className={styles.faqCta}>
          {FAQ_COPY.stuck} <a href={`mailto:${FAQ_COPY.email}`}>{FAQ_COPY.email}</a>
        </p>
      </div>
    </section>
  );
}
