"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { readCookieChoice, serializeCookieChoice, type CookieChoice } from "@/lib/cookie-consent";
import styles from "./CookieNotice.module.css";

const subscribe = () => () => {};
const UNKNOWN = "unknown" as const;

/**
 * A sticky notice shown until the visitor makes a choice. Not a modal: it
 * never traps focus or blocks the page, and it sits at the end of the
 * document so it never covers the footer.
 */
export function CookieNotice() {
  // Read on the client only; the server renders nothing, so there is no flash for returning visitors.
  const stored = useSyncExternalStore(subscribe, () => readCookieChoice(document.cookie), () => UNKNOWN);
  const [chosen, setChosen] = useState(false);

  if (stored !== null || chosen) return null;

  const choose = (choice: CookieChoice) => {
    document.cookie = serializeCookieChoice(choice, window.location.protocol === "https:");
    setChosen(true);
  };

  return (
    <section className={styles.notice} aria-labelledby="cookie-notice-title">
      <div className={styles.inner}>
        <div className={styles.text}>
          <h2 id="cookie-notice-title" className={styles.title}>
            Cookie notice
          </h2>
          <p>
            We use essential cookies only: one keeps you signed in and secure, and one remembers this choice. There are no
            analytics, advertising or tracking cookies. Optional cookies: none in use today, and any added later stay off
            unless you accept them. <Link href="/privacy#cookies">Cookie details</Link>
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => choose("essential")}>
            Essential only
          </button>
          <button type="button" className={styles.primary} onClick={() => choose("all")}>
            Accept all
          </button>
        </div>
      </div>
    </section>
  );
}
