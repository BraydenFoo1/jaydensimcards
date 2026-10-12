"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./portal.module.css";

const LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/account", label: "Account & security" },
] as const;

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Account">
      <ul>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
