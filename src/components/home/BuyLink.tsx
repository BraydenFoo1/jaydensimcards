"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { BUY_LINES } from "@/lib/home-content";
import { showToast } from "./Toaster";

/**
 * A sign-up link with the original parting joke: a toast naming the plan,
 * then navigation after a beat so the joke can be read. Clicks that open a
 * new tab, and visitors who prefer reduced motion, are not held up.
 */
export function BuyLink({ href, planName, className, children }: { href: string; planName: string; className?: string; children: ReactNode }) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showToast(`${planName} — ${BUY_LINES[Math.floor(Math.random() * BUY_LINES.length)]}`);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
    // As the original did: a plain navigation once the joke has been on screen.
    setTimeout(() => window.location.assign(href), delay);
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
