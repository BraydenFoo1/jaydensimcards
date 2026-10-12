/**
 * Post-login redirect targets come from the URL (?next=...), so they are
 * attacker-controlled. Only same-site page paths survive; anything else
 * (other hosts, protocol-relative URLs, backslash tricks, API routes) falls
 * back to the default.
 */
export const DEFAULT_AFTER_LOGIN = "/portal";

const PROBE_ORIGIN = "http://same-origin.invalid";

export function safeNextPath(input: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof input !== "string") return fallback;
  const value = input.trim();
  if (value.length === 0 || value.length > 512) return fallback;
  // Must be a root-relative path. "//host" and "/\host" are treated as hosts by browsers.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // Control characters can be stripped by browsers into something else entirely.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return fallback;
  // Sending a signed-in user back to an auth page would just bounce.
  if (/^\/(login|register|forgot-password|reset-password)(\/|$)/.test(url.pathname)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** First value of a search param that Next.js may hand over as a string or an array. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Carries a chosen plan from the pricing table through sign-up to the portal. */
export function planNextPath(plan: unknown): string | undefined {
  if (typeof plan !== "string" || !/^[a-z0-9]{2,24}$/.test(plan)) return undefined;
  return `/portal?plan=${plan}`;
}

/**
 * Where Better Auth sends people after a verification link. With `confirmed`
 * the page shows an "email confirmed" screen; without it (the sign-in flow)
 * a signed-in visitor is sent straight on to `next`.
 */
export function verifyCallbackURL(next: string, confirmed = false): string {
  return `/verify-email?next=${encodeURIComponent(next)}${confirmed ? "&confirmed=1" : ""}`;
}
