"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

const EVENT = "jsc:toast";
const VISIBLE_MS = 4200;

/** Shows a short message in the homepage's toast (rendered by <Toaster />). */
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

/** The one polite live region for the homepage's jokes, as on the original site. */
export function Toaster() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onToast = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), VISIBLE_MS);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`${styles.toast} ${message ? styles.toastShow : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
