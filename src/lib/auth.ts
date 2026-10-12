/**
 * Better Auth server configuration.
 *
 * Imports are relative (not "@/...") so the Better Auth CLI can load this
 * file directly when generating the schema.
 */
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { admin as adminPlugin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { dash } from "@better-auth/infra";
import { waitUntil } from "@vercel/functions";
import { afterAuthHook, auditInBackground, beforeAuthHook } from "./auth-hooks";
import { BreachCheckUnavailableError, isBreachedPassword } from "./breached-password";
import { pool } from "./db";
import { resolveBaseURL, serverEnv } from "./env";
import { sendMail, type MailKind } from "./mail/send";
import { existingAccountEmail, resetPasswordEmail, verificationEmail, type EmailContent } from "./mail/templates";
import { ac, roles } from "./permissions";

const env = serverEnv();

/**
 * Better Auth only hashes when a password is being set (sign-up, including
 * the decoy hash for an existing email, change and reset), so checking here
 * covers every path with identical behaviour. Storage is Better Auth's own
 * default scrypt hashing, unchanged.
 */
async function hashUnbreachedPassword(password: string): Promise<string> {
  try {
    if (await isBreachedPassword(password)) {
      throw APIError.from("BAD_REQUEST", {
        code: "PASSWORD_COMPROMISED",
        message: "That password has appeared in a known data breach. Please choose a different one.",
      });
    }
  } catch (err) {
    if (err instanceof BreachCheckUnavailableError) {
      // Fail closed: never accept a password we could not check.
      throw APIError.from("SERVICE_UNAVAILABLE", {
        code: "BREACH_CHECK_UNAVAILABLE",
        message: "We couldn't check that password against known breaches just now. Please try again in a moment.",
      });
    }
    throw err;
  }
  return hashPassword(password);
}
const baseURL = resolveBaseURL(env);

/**
 * Mail is sent in the background so response time does not reveal whether an
 * address has an account. waitUntil keeps the send alive after the response
 * on Vercel, and simply lets the promise run anywhere else.
 */
function queueMail(to: string, kind: MailKind, content: EmailContent) {
  waitUntil(
    sendMail(to, kind, content).catch((err: unknown) => {
      console.error(`[mail] ${kind} failed:`, err instanceof Error ? err.message : err);
    }),
  );
}

export const auth = betterAuth({
  appName: "Jayden SIM Cards",
  baseURL,
  secret: env.BETTER_AUTH_SECRET,
  database: pool,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    password: { hash: hashUnbreachedPassword, verify: verifyPassword },
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      auditInBackground({ actor: { id: user.id }, action: "auth.password-reset" });
    },
    sendResetPassword: async ({ user, url }) => {
      queueMail(user.email, "reset-password", resetPasswordEmail(user.name, url));
    },
    onExistingUserSignUp: async ({ user }) => {
      queueMail(user.email, "existing-account", existingAccountEmail(user.name, `${baseURL}/login`));
    },
    // Sign-up for an existing email returns a convincing fake user. It must
    // carry the admin plugin's fields too, or the response shape gives it away.
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      role: "customer",
      banned: false,
      banReason: null,
      banExpires: null,
      ...additionalFields,
      id,
    }),
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    afterEmailVerification: async (user) => {
      auditInBackground({ actor: { id: user.id }, action: "auth.email-verified" });
    },
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      queueMail(user.email, "verify-email", verificationEmail(user.name, url));
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  hooks: {
    before: beforeAuthHook,
    after: afterAuthHook,
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 15, max: 5 },
      "/reset-password": { window: 60 * 15, max: 10 },
      "/send-verification-email": { window: 60 * 15, max: 5 },
      "/change-password": { window: 60 * 15, max: 10 },
    },
  },

  advanced: {
    // Better Auth skips origin/CSRF checks when NODE_ENV=test or any TEST env
    // var is set. Pin them on so a stray variable can never disable them.
    disableOriginCheck: false,
    disableCSRFCheck: false,
    cookiePrefix: "jsc",
    ipAddress: {
      // Set by Vercel's edge from the real client address; clients cannot spoof it.
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
    },
    // Better Auth's runtime schema check connects to the database as soon as
    // this module loads, including during `next build`. The schema is owned by
    // the checksummed migrations in db/migrations, so the check is off: nothing
    // connects until the first real query (tests/unit/auth-import.test.ts).
    database: { validateSchema: false },
    ...(env.VERCEL ? { backgroundTasks: { handler: waitUntil } } : {}),
  },

  plugins: [
    adminPlugin({
      ac,
      roles,
      defaultRole: "customer",
      bannedUserMessage: "This line has been suspended. Contact support if you think this is a mistake.",
    }),
    // Only connect to Better Auth Infrastructure when a key is configured, so
    // local development never sends user events to a third party.
    ...(env.BETTER_AUTH_API_KEY ? [dash({ apiKey: env.BETTER_AUTH_API_KEY })] : []),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
