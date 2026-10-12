import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { SiteFooter } from "@/components/site/SiteFooter";
import styles from "./legal.module.css";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href="/" aria-label="Jayden SIM Cards home">
            <Wordmark tone="light" />
          </Link>
          <Link href="/" className={styles.back}>
            ← Back<span className={styles.backLong}>&nbsp;to site</span>
          </Link>
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
