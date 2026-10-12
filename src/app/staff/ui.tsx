import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./staff.module.css";

export function StaffHeading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: ReactNode }) {
  return (
    <header className={styles.heading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {lede && <p className={styles.lede}>{lede}</p>}
    </header>
  );
}

export function ConsoleSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className={styles.skeleton}>
      <span className="sr-only">Loading the console…</span>
      <div aria-hidden="true" className={styles.skeletonTitle} />
      <div aria-hidden="true" className={styles.skeletonBlock} />
      <div aria-hidden="true" className={styles.skeletonBlock} />
    </div>
  );
}

/** Previous/next links that keep the other query parameters. */
export function Pager({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className={styles.pager}>
      {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span aria-hidden="true" />}
      <span className={styles.mono}>
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? <Link href={href(page + 1)}>Next →</Link> : <span aria-hidden="true" />}
    </nav>
  );
}
