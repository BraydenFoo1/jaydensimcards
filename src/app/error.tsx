"use client";

import Link from "next/link";
import styles from "./status-page.module.css";

/**
 * Shown when a page fails. Never shows the error message or stack: server
 * errors reach the browser only as an opaque reference (digest) that matches
 * the server log.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className={styles.page}>
      <p className={styles.code}>Signal lost</p>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.lede}>Nothing you did caused this. Please try again in a moment.</p>
      {error.digest && <p className={styles.reference}>Reference: {error.digest}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className={styles.secondary}>
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
