/**
 * The cookie-notice choice. Deliberately separate from authentication: it is a
 * plain preference cookie, readable by page scripts, and grants nothing.
 *
 * The site currently sets essential cookies only. Any optional cookie or
 * script added in future must check optionalCookiesAllowed() first and stay
 * off until the visitor has chosen "all".
 */
export const COOKIE_CHOICE_NAME = "jsc_cookie_choice";
export const COOKIE_CHOICE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export type CookieChoice = "essential" | "all";

export function readCookieChoice(cookieHeader: string | null | undefined): CookieChoice | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_CHOICE_NAME) {
      const value = rest.join("=");
      return value === "essential" || value === "all" ? value : null;
    }
  }
  return null;
}

export function serializeCookieChoice(choice: CookieChoice, secure: boolean): string {
  return `${COOKIE_CHOICE_NAME}=${choice}; Max-Age=${COOKIE_CHOICE_MAX_AGE}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** No choice, or "essential only", means optional cookies stay off. */
export function optionalCookiesAllowed(choice: CookieChoice | null): boolean {
  return choice === "all";
}
