import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import styles from "./status-page.module.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <main id="main" className={styles.page}>
        <p className={styles.code}>404 · No signal</p>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.lede}>This page doesn&rsquo;t exist, or Jayden walked out of range while it was loading.</p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>
            Go to the homepage
          </Link>
          <Link href="/portal" className={styles.secondary}>
            My account
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
