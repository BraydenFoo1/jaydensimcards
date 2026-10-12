import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Wordmark } from "@/components/brand/Wordmark";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PortalNav } from "./PortalNav";
import styles from "./portal.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href="/" className={styles.brand} aria-label="Jayden SIM Cards home">
            <Wordmark tone="light" />
          </Link>
          <SignOutButton className={styles.signOut} />
        </div>
        <PortalNav />
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
