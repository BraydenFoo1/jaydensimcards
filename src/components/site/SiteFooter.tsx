import Link from "next/link";
import styles from "./SiteFooter.module.css";

/** The site-wide footer: legal links in plain sight, plus the parody disclaimer. */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav aria-label="Legal" className={styles.legalNav}>
          <ul>
            <li>
              <Link href="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms">Terms of Service</Link>
            </li>
          </ul>
        </nav>
        <p className={styles.disclaimer}>
          Jayden SIM Cards is a fictional parody created for entertainment. It is not a licensed telecommunications
          provider and does not sell real SIM cards, mobile plans or any other service.
        </p>
      </div>
    </footer>
  );
}
