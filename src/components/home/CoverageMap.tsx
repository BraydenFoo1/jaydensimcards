"use client";

import { useRef, useState } from "react";
import formStyles from "@/components/forms/forms.module.css";
import { COVERAGE } from "@/lib/home-content";
import styles from "./home.module.css";

type Cell = "good" | "ok" | "bad" | null;

/** The original random scan: one excellent hotspot, a few patchy cells, plenty of prayer. */
function scan(): { cells: Cell[]; verdict: string } {
  const hotspot = Math.floor(Math.random() * COVERAGE.cells);
  const cells = Array.from({ length: COVERAGE.cells }, (_, i): Cell => {
    if (i === hotspot) return "good";
    const roll = Math.random();
    if (roll > 0.9) return "ok";
    if (roll > 0.55) return "bad";
    return null;
  });
  return { cells, verdict: COVERAGE.verdicts[Math.floor(Math.random() * COVERAGE.verdicts.length)] };
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The "Check coverage map" button and the coverage map dialog it opens.
 * A native modal <dialog> provides the focus trap, Escape to close and an
 * inert page behind it; focus returns to the button on close.
 */
export function CoverageMap() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<{ cells: Cell[]; verdict: string }>({ cells: [], verdict: COVERAGE.scanning });

  function open() {
    setResult(scan());
    dialogRef.current?.showModal();
    closeRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  function rescan() {
    setResult((current) => ({ ...current, verdict: COVERAGE.scanning }));
    setTimeout(() => setResult(scan()), reducedMotion() ? 0 : 550);
  }

  return (
    <>
      <button ref={triggerRef} type="button" className={`${formStyles.button} ${formStyles.secondary}`} onClick={open}>
        <span className={styles.ping} aria-hidden="true" /> Check coverage map
      </button>

      <dialog
        ref={dialogRef}
        className={styles.modal}
        aria-labelledby="coverage-title"
        // A click on the dialog element itself (not its panel) is a click on the backdrop.
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        // The page behind stops scrolling through CSS while the dialog is open (home.module.css).
        onClose={() => triggerRef.current?.focus()}
      >
        <div className={styles.modalPanel}>
          <button ref={closeRef} type="button" className={styles.modalClose} onClick={close} aria-label="Close coverage map">
            ×
          </button>
          <p className={`${styles.eyebrow} mono`}>
            <i className={styles.dotLive} aria-hidden="true" /> {COVERAGE.eyebrow}
          </p>
          <h2 id="coverage-title" className={styles.modalTitle}>
            {COVERAGE.title}
          </h2>

          <div className={styles.map} aria-hidden="true">
            {result.cells.map((cell, i) => (
              <i key={i} className={cell ? styles[`cell_${cell}`] : undefined} />
            ))}
          </div>

          <ul className={`${styles.legend} mono`}>
            <li>
              <i className={`${styles.swatch} ${styles.cell_good}`} aria-hidden="true" /> {COVERAGE.legend.good}
            </li>
            <li>
              <i className={`${styles.swatch} ${styles.cell_ok}`} aria-hidden="true" /> {COVERAGE.legend.ok}
            </li>
            <li>
              <i className={`${styles.swatch} ${styles.cell_bad}`} aria-hidden="true" /> {COVERAGE.legend.bad}
            </li>
          </ul>

          <p className={styles.verdict} aria-live="polite">
            {result.verdict}
          </p>

          <div className={styles.modalActions}>
            <button type="button" className={`${formStyles.button} ${formStyles.secondary}`} onClick={rescan}>
              Scan again
            </button>
            <a href="#plans" className={formStyles.button} onClick={close}>
              See the plans
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
