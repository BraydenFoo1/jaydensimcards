/**
 * Server environment, validated once on first use.
 *
 * Errors name the offending variables but never print their values, so a
 * misconfigured deploy cannot leak a secret into build or function logs.
 */
import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().url("must be a postgres:// connection string"),
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters (openssl rand -base64 32)"),
    BETTER_AUTH_URL: z.string().url().optional(),
    /** Optional. When unset, the Better Auth Infrastructure dash() plugin is not loaded at all. */
    BETTER_AUTH_API_KEY: z.string().min(1).optional(),

    /** "smtp" sends real mail. "outbox" writes to .dev-mail/ and is refused on Vercel. */
    MAIL_TRANSPORT: z.enum(["smtp", "outbox"]).default("smtp"),
    MAIL_FROM: z.string().min(3).optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),

    VERCEL: z.string().optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    VERCEL_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === "outbox" && env.VERCEL) {
      ctx.addIssue({ code: "custom", path: ["MAIL_TRANSPORT"], message: '"outbox" is for local development only' });
    }
    if (env.MAIL_TRANSPORT === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: 'required when MAIL_TRANSPORT is "smtp"' });
      }
    }
  });

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${problems}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * The public origin Better Auth uses for cookies and email links.
 * An explicit BETTER_AUTH_URL wins; Vercel previews fall back to their own URL.
 */
export function resolveBaseURL(env: ServerEnv = serverEnv()): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}
