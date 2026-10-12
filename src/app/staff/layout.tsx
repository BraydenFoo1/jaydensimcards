import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Wordmark } from "@/components/brand/Wordmark";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StaffNav } from "./StaffNav";
import styles from "./staff.module.css";

export const metadata: Metadata = {
  title: { default: "Staff console", template: "%s | Staff console" },
  robots: { index: false, follow: false },
};

/** Static shell only: every page below checks the session and role itself. */
export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href="/" className={styles.brand} aria-label="Jayden SIM Cards home">
            <Wordmark tone="light" />
          </Link>
          <p className={styles.barTag}>Network operations</p>
          <SignOutButton className={styles.signOut} />
        </div>
        <StaffNav />
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
