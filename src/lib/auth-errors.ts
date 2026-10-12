/**
 * Turns Better Auth error responses into messages people can act on.
 *
 * Deliberately coarse: sign-in never says which of email or password was
 * wrong, and nothing here reveals whether an account exists.
 */

export type AuthErrorLike = {
  status?: number;
  code?: string;
  message?: string;
};

export type AuthAction = "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "resend-verification" | "sign-out" | "change-password";

export const NETWORK_ERROR = "We couldn't reach the network. Ironic, we know. Check your connection and try again.";

/** No rate-limit window is longer than this; anything bigger is a bad header. */
const MAX_PLAUSIBLE_RETRY_SECONDS = 60 * 60;

export function rateLimitMessage(retryAfterSeconds?: number): string {
  if (
    retryAfterSeconds &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds > 0 &&
    retryAfterSeconds <= MAX_PLAUSIBLE_RETRY_SECONDS
  ) {
    const s = Math.ceil(retryAfterSeconds);
    const wait = s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} second${s === 1 ? "" : "s"}`;
    return `Too many attempts. Please wait ${wait} and try again.`;
  }
  return "Too many attempts. Please wait a few minutes and try again.";
}

export function authErrorMessage(error: AuthErrorLike | null | undefined, action: AuthAction, retryAfterSeconds?: number): string {
  if (!error) return NETWORK_ERROR;
  if (error.status === 429) return rateLimitMessage(retryAfterSeconds);

  // Already signed in, so naming the wrong field reveals nothing.
  if (action === "change-password" && error.code === "INVALID_PASSWORD") {
    return "Your current password is incorrect.";
  }

  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
      return action === "sign-in" ? "Email or password is incorrect." : GENERIC[action];
    case "EMAIL_NOT_VERIFIED":
      return "Please confirm your email address first. We've sent a new confirmation link to your inbox.";
    case "BANNED_USER":
      return "This line has been suspended. Contact support if you think this is a mistake.";
    case "PASSWORD_COMPROMISED":
      return "That password has appeared in a known data breach. Please choose a different one.";
    case "CONSENT_REQUIRED":
      return "Please agree to the Terms of Service and Privacy Policy. If you already ticked the box, reload the page: the documents may have been updated.";
    case "BREACH_CHECK_UNAVAILABLE":
      return "We couldn't check that password against known breaches just now. Please try again in a moment.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 10 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "Use 128 characters or fewer for your password.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "This link is invalid or has expired. Request a new one.";
    case "INVALID_ORIGIN":
    case "MISSING_OR_NULL_ORIGIN":
    case "INVALID_CALLBACK_URL":
    case "INVALID_REDIRECT_URL":
    case "CROSS_SITE_NAVIGATION_LOGIN_BLOCKED":
      return "This request was blocked for your security. Reload the page and try again.";
  }

  if (error.status && error.status >= 500) {
    return "Something went wrong on our side. Jayden has been notified. Please try again shortly.";
  }
  return GENERIC[action];
}

const GENERIC: Record<AuthAction, string> = {
  "sign-in": "We couldn't sign you in. Please try again.",
  "sign-up": "We couldn't create your account. Please check the form and try again.",
  "forgot-password": "We couldn't send a reset link just now. Please try again.",
  "reset-password": "We couldn't update your password. Please try again.",
  "resend-verification": "We couldn't send a new link just now. Please try again.",
  "sign-out": "We couldn't sign you out. Please try again.",
  "change-password": "We couldn't change your password. Please try again.",
};

/** Messages for the ?error= codes Better Auth appends when a link fails. */
export function linkErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "TOKEN_EXPIRED") return "That link has expired. Request a new one below.";
  return "That link is invalid or has already been used. Request a new one below.";
}
