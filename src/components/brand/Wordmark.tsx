import styles from "./Wordmark.module.css";

/** The network's entire infrastructure, rendered as one tower. */
export function TowerMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 13 L10.5 30 M16 13 L21.5 30 M12.2 24.5 H19.8 M13.6 19.5 H18.4" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="square" />
      <circle cx="16" cy="11" r="2.6" fill="currentColor" />
      <path d="M10.6 5.6 A7.6 7.6 0 0 0 10.6 16.4 M21.4 5.6 A7.6 7.6 0 0 1 21.4 16.4" stroke="currentColor" strokeWidth="2.2" fill="none" />
    </svg>
  );
}

export function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className={`${styles.wordmark} ${tone === "light" ? styles.light : ""}`}>
      <span className={styles.badge}>
        <TowerMark className={styles.tower} />
      </span>
      <span className={styles.text}>
        Jayden <em>SIM</em> Cards
      </span>
    </span>
  );
}
