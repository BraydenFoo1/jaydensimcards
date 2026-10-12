"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./forms.module.css";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  labelAside?: ReactNode;
};

/** Label, input, hint and error wired together for assistive technology. */
export function Field({ id, label, error, hint, labelAside, ...input }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {labelAside}
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      <input id={id} className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

type PasswordFieldProps = Omit<FieldProps, "type">;

/** A password input with a show/hide toggle that announces its state. */
export function PasswordField({ id, label, error, hint, labelAside, ...input }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {labelAside}
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.inputWrap}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`${styles.input} ${styles.withToggle}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...input}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-controls={id}
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Stable unique prefix so two forms on one page never share field ids. */
export function useFieldIds<K extends string>(...names: K[]): Record<K, string> {
  const base = useId();
  return Object.fromEntries(names.map((n) => [n, `${base}-${n}`])) as Record<K, string>;
}
