/**
 * Checks new passwords against Have I Been Pwned's Pwned Passwords range API.
 *
 * Privacy: only the first 5 hex characters of the password's SHA-1 hash leave
 * the server (k-anonymity), and responses are padded so their size reveals
 * nothing. The password itself is never sent or logged.
 *
 * Replaces Better Auth's haveIBeenPwned plugin, which has no request timeout:
 * a stalled response could hang sign-up and password changes for minutes.
 * This version gives up after a few seconds and fails closed.
 */
import { createHash } from "node:crypto";

export const BREACH_CHECK_TIMEOUT_MS = 4000;

export class BreachCheckUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("The breached-password service could not be reached.");
    this.name = "BreachCheckUnavailableError";
    this.cause = cause;
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** True when the password appears in at least one known breach. Throws BreachCheckUnavailableError otherwise-undecidable. */
export async function isBreachedPassword(
  password: string,
  { fetchImpl = fetch as FetchLike, timeoutMs = BREACH_CHECK_TIMEOUT_MS }: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<boolean> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  let body: string;
  try {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "JaydenSIMCards-PasswordCheck" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = await response.text();
  } catch (err) {
    throw new BreachCheckUnavailableError(err);
  }

  for (const line of body.split("\n")) {
    const [hashSuffix, count] = line.trim().split(":");
    // Padding entries have a count of 0 and never match a real password.
    if (hashSuffix === suffix && Number(count) > 0) return true;
  }
  return false;
}
