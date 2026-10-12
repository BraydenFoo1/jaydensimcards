/**
 * The Better Auth endpoints reachable over HTTP. Everything else under
 * /api/auth returns 404, including the admin plugin, session listing and
 * account-update endpoints: the app performs those server-side, after its
 * own authorization checks, through auth.api.
 *
 * An allowlist (rather than blocking known-bad paths) means encoding tricks,
 * new plugin endpoints and trailing-slash variants are refused by default.
 */
const POST_PATHS = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/sign-out",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/change-password",
]);

const GET_PATHS = new Set(["/verify-email", "/ok", "/error"]);

// GET /reset-password/<token> validates an emailed link and redirects to the reset page.
const RESET_LINK = /^\/reset-password\/[A-Za-z0-9_-]{1,256}$/;

export function isExposedAuthPath(method: string, authPath: string, opts: { dashEnabled: boolean }): boolean {
  // Better Auth Infrastructure calls these itself, authenticated by a signed JWT tied to the API key.
  if (opts.dashEnabled && /^\/(dash|events)\/[A-Za-z0-9/_-]+$/.test(authPath)) return true;
  if (method === "POST") return POST_PATHS.has(authPath);
  if (method === "GET") return GET_PATHS.has(authPath) || RESET_LINK.test(authPath);
  return false;
}
