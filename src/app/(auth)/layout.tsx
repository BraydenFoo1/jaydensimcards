import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { SiteFooter } from "@/components/site/SiteFooter";
import styles from "./auth.module.css";

export const metadata: Metadata = {
  // Account pages have nothing for search engines and some carry tokens in the URL.
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label="Jayden SIM Cards home">
          <Wordmark tone="light" />
        </Link>
        <div className={styles.barMeta}>
          <span className={styles.tag}>Fictional parody network</span>
          <Link href="/" className={styles.back}>
            ← Back<span className={styles.backLong}>&nbsp;to site</span>
          </Link>
        </div>
      </header>

      <main id="main" className={styles.main}>
        <section className={styles.panel}>{children}</section>

        <aside className={styles.status} aria-labelledby="auth-status-title">
          <div>
            <p className={styles.kicker}>Jayden SIM Cards · Portal access</p>
            <h2 id="auth-status-title" className={styles.statusTitle}>
              Network authentication
            </h2>
            <p className={styles.statusLede}>Every account is verified by our entire engineering department.</p>
          </div>

          <dl className={styles.readout}>
            <div>
              <dt>Authentication server</dt>
              <dd>JAYDEN</dd>
            </div>
            <div>
              <dt>Backup auth server</dt>
              <dd>JAYDEN&rsquo;S OTHER PHONE</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={styles.warn}>
                <span className={styles.dot} aria-hidden="true" />
                PROBABLY ONLINE
              </dd>
            </div>
            <div>
              <dt>Engineers on duty</dt>
              <dd>1 / 1</dd>
            </div>
          </dl>

          <p className={styles.assure}>
            <strong>The one part that isn&rsquo;t a joke:</strong> passwords are hashed and never stored, sign-in attempts
            are rate limited, and we check new passwords against known data breaches.
          </p>
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}
