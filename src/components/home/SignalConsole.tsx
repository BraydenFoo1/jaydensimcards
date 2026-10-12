"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CONSOLE_COPY } from "@/lib/home-content";
import { CONSOLE_START, MAX_REACHED_TOAST, METER_HEIGHTS, NO_PERKS, readConsole } from "@/lib/signal-console";
import styles from "./home.module.css";
import { showToast } from "./Toaster";

/** The original plan customiser. Purely for fun: it never creates or changes a plan. */
export function SignalConsole() {
  const [value, setValue] = useState(CONSOLE_START);
  const inputRef = useRef<HTMLInputElement>(null);
  const reading = readConsole(value);

  // The original reacted to the native "change" event (on release), not to every step.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onChange = () => {
      if (Number(input.value) === 100) showToast(MAX_REACHED_TOAST);
    };
    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, []);

  return (
    <section id="customiser" className={`${styles.band} ${styles.bandAlt}`} aria-labelledby="customiser-title">
      <div className={styles.wrap}>
        <header className={styles.head}>
          <p className={`${styles.eyebrow} mono`}>{CONSOLE_COPY.eyebrow}</p>
          <h2 id="customiser-title" className={styles.title}>
            {CONSOLE_COPY.title}
          </h2>
          <p className={styles.lede}>{CONSOLE_COPY.lede}</p>
        </header>

        <div className={styles.console}>
          <div className={styles.consoleControl}>
            <div className={styles.meter} aria-hidden="true">
              {METER_HEIGHTS.map((height, i) => (
                <i key={i} className={i < reading.litBars ? styles.meterLit : undefined} style={{ height: `${height}%` }} />
              ))}
            </div>

            <label className={styles.consoleLabel} htmlFor="jayden-units">
              {CONSOLE_COPY.label}{" "}
              <output className="mono" htmlFor="jayden-units">
                {value}
              </output>
            </label>
            <input
              ref={inputRef}
              className={styles.range}
              type="range"
              id="jayden-units"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(event) => setValue(Number(event.target.value))}
              aria-describedby="console-readout"
              style={{ "--fill": `${value}%` } as CSSProperties}
            />
            <div className={`${styles.rangeScale} mono`} aria-hidden="true">
              {CONSOLE_COPY.scale.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <ul className={`${styles.readout} mono`} id="console-readout">
              <li>
                <span>Download</span>
                <b>{reading.speed}</b>
              </li>
              <li>
                <span>Latency</span>
                <b>{reading.ping}</b>
              </li>
              <li>
                <span>Bars shown</span>
                <b>{reading.barsShown}</b>
              </li>
              <li>
                <span>Bars real</span>
                <b>{reading.barsReal}</b>
              </li>
            </ul>
          </div>

          <div className={styles.consolePrice}>
            <p className={`${styles.priceLabel} mono`}>Your monthly bill</p>
            <p className={`${styles.amount} ${reading.infinite ? styles.amountInfinite : ""}`}>{reading.price}</p>
            <p className={styles.note}>{reading.note}</p>

            <p className={`${styles.perkHead} mono`}>Perks unlocked</p>
            <ul className={styles.perks}>
              {reading.perks.length === 0 && <li className={styles.perkMuted}>{NO_PERKS}</li>}
              {reading.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
              {reading.morePerks && <li className={styles.perkMuted}>{reading.morePerks}</li>}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
