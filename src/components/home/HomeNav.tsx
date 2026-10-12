"use client";

import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import formStyles from "@/components/forms/forms.module.css";
import styles from "./home.module.css";

const LINKS = [
  { href: "#plans", label: "Plans" },
  { href: "#customiser", label: "Build your own" },
  { href: "#faq", label: "Support" },
];

/** The original homepage navigation. On small screens the links fold into a menu. */
export function HomeNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className={styles.nav} id="top">
      <div className={styles.navInner}>
        <a className={styles.navBrand} href="#top" aria-label="Jayden SIM Cards, home" onClick={close}>
          <Wordmark />
        </a>

        <nav id="home-nav-links" className={`${styles.navLinks} ${open ? styles.navOpen : ""}`} aria-label="Main">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={close}>
              {link.label}
            </a>
          ))}
          <Link href="/login" onClick={close}>
            My account
          </Link>
          <Link href="/register" className={`${formStyles.button} ${styles.navCta}`} onClick={close}>
            Get a SIM
          </Link>
        </nav>

        <button
          type="button"
          className={styles.navToggle}
          aria-expanded={open}
          aria-controls="home-nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true" className={styles.navToggleBars} />
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
    </header>
  );
}
