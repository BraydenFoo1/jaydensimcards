"use client";

import { useState } from "react";
import { TICKER } from "@/lib/home-content";
import styles from "./home.module.css";

/**
 * The original scrolling network-status ticker, word for word. The moving
 * copy is hidden from screen readers (they get one plain copy), and it can be
 * paused, since moving text must not run on without a way to stop it.
 */
export function NetworkTicker() {
  const [paused, setPaused] = useState(false);

  return (
    <div className={`${styles.ticker} ${paused ? styles.tickerPaused : ""}`}>
      <p className="sr-only">{TICKER.map((item) => `${item.label}: ${item.value}.`).join(" ")}</p>
      <div className={styles.tickerViewport} aria-hidden="true">
        <div className={styles.tickerTrack}>
          {[0, 1].map((copy) => (
            <span key={copy} className={styles.tickerSet}>
              {TICKER.map((item) => (
                <span key={item.label} className={styles.tickerItem}>
                  <b>{item.label}</b>
                  {"warn" in item && <i className={styles.dotWarn} />}
                  {item.value}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <button type="button" className={styles.tickerToggle} onClick={() => setPaused((p) => !p)}>
        {paused ? "Play" : "Pause"}
        <span className="sr-only"> network status ticker</span>
      </button>
    </div>
  );
}
