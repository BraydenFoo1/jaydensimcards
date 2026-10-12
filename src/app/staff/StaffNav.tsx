"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./staff.module.css";

const LINKS = [
  { href: "/staff", label: "Overview" },
  { href: "/staff/users", label: "Directory" },
  { href: "/staff/activity", label: "Activity log" },
  { href: "/portal/account", label: "My account" },
] as const;

export function StaffNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Staff console">
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
