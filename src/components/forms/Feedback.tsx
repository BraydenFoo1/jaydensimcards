"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./forms.module.css";

type Variant = "error" | "success" | "info";

const VARIANT_CLASS: Record<Variant, string> = {
  error: styles.noticeError,
  success: styles.noticeSuccess,
  info: styles.noticeInfo,
};

/**
 * A message block. Errors use role="alert" and take focus so keyboard and
 * screen-reader users land on them; successes are polite status messages.
 *
 * Focus moves only on mount. Give the Notice a `key` that changes per submit
 * attempt to re-announce it; re-renders while typing never steal focus.
 */
export function Notice({
  variant,
  title,
  children,
  focusOnMount = variant === "error",
}: {
  variant: Variant;
  title?: string;
  children: ReactNode;
  focusOnMount?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <div
      ref={ref}
      className={`${styles.notice} ${VARIANT_CLASS[variant]}`}
      role={variant === "error" ? "alert" : "status"}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      {title && <p className={styles.noticeTitle}>{title}</p>}
      {children}
    </div>
  );
}

/** Lists every field error with a link that jumps to the field. */
export function ErrorSummary({ errors, labels }: { errors: Partial<Record<string, string>>; labels: Record<string, { id: string; label: string }> }) {
  const entries = Object.entries(errors).filter(([, message]) => Boolean(message));
  if (entries.length === 0) return null;
  return (
    <Notice variant="error" title={entries.length === 1 ? "There is 1 problem" : `There are ${entries.length} problems`}>
      <ul className={styles.summaryList}>
        {entries.map(([key, message]) => {
          const field = labels[key];
          return (
            <li key={key}>
              {field ? (
                <a
                  href={`#${field.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(field.id)?.focus();
                  }}
                >
                  {field.label}: {message}
                </a>
              ) : (
                message
              )}
            </li>
          );
        })}
      </ul>
    </Notice>
  );
}

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  variant = "primary",
  disabled = false,
  describedBy,
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <button
      type="submit"
      className={`${styles.button} ${styles.block} ${variant === "secondary" ? styles.secondary : ""}`}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      aria-describedby={describedBy}
    >
      {pending && <span className={styles.spinner} aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormSkeleton({ fields = 2, label = "Loading form" }: { fields?: number; label?: string }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className={styles.field} aria-hidden="true">
          <div className={`${styles.skeletonBar} ${styles.skeletonLabel}`} />
          <div className={styles.skeletonBar} />
        </div>
      ))}
      <div className={styles.skeletonBar} aria-hidden="true" />
    </div>
  );
}
