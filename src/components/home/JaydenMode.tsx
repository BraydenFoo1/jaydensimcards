"use client";

import { useEffect } from "react";
import { JAYDEN_MODE } from "@/lib/home-content";
import { showToast } from "./Toaster";

/** The original Easter egg: type "jayden" anywhere on the homepage. */
export function JaydenMode() {
  useEffect(() => {
    let typed = "";
    const onKey = (event: KeyboardEvent) => {
      if (event.key.length !== 1) return;
      typed = (typed + event.key.toLowerCase()).slice(-JAYDEN_MODE.word.length);
      if (typed === JAYDEN_MODE.word) {
        document.documentElement.style.setProperty("--signal", JAYDEN_MODE.colour);
        showToast(JAYDEN_MODE.toast);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Jayden mode belongs to the homepage; other pages keep the normal colours.
      document.documentElement.style.removeProperty("--signal");
    };
  }, []);
  return null;
}
