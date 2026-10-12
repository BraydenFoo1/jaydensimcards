import type { ReactNode } from "react";
import styles from "./legal.module.css";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** A readable legal page: title, version, a contents list and numbered sections. */
export function LegalDocument({ title, version, intro, sections }: { title: string; version: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className={styles.doc}>
      <header className={styles.docHead}>
        <p className={styles.eyebrow}>Jayden SIM Cards · Legal</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.version}>Version {version}</p>
        <div className={styles.intro}>{intro}</div>
      </header>

      <nav aria-labelledby="contents-title" className={styles.toc}>
        <h2 id="contents-title" className={styles.tocTitle}>
          Contents
        </h2>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={styles.section}>
          <h2 id={`${s.id}-title`} className={styles.sectionTitle}>
            <span className={styles.number}>{String(i + 1).padStart(2, "0")}</span> {s.title}
          </h2>
          <div className={styles.body}>{s.body}</div>
        </section>
      ))}
    </article>
  );
}

/** A visible marker for facts only the operator or a lawyer can supply. Never filled in with guesses. */
export function Review({ children }: { children: ReactNode }) {
  return <mark className={styles.review}>[LEGAL REVIEW REQUIRED: {children}]</mark>;
}
