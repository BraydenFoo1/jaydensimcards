/**
 * Versions of the legal documents a new account agrees to. Bump a version
 * whenever the corresponding page changes materially; sign-ups made against
 * an older page are then refused and asked to reload, so every consent record
 * names the exact text that was agreed to.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-10-08",
  privacy: "2026-10-08",
} as const;

export type LegalConsent = { terms: string; privacy: string };

/** What the registration form sends once the box is ticked. */
export function currentConsent(): LegalConsent {
  return { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy };
}

/** The server's check: an explicit agreement to the current version of both documents, nothing looser. */
export function isCurrentConsent(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.terms === LEGAL_VERSIONS.terms && v.privacy === LEGAL_VERSIONS.privacy;
}
