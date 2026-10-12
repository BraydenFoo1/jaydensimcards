/**
 * Outbound mail.
 *
 * smtp    real delivery through any SMTP server (Gmail App Password by default)
 * outbox  local development only: writes each message to .dev-mail/ as JSON so
 *         the browser tests can follow verification and reset links
 *
 * Every address is throttled per message kind so a flood of sign-up or reset
 * requests cannot be turned into an email bomb against one inbox. Addresses
 * are stored only as a SHA-256 hash in the throttle log.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { pool } from "../db";
import { serverEnv } from "../env";
import type { EmailContent } from "./templates";

export type MailKind = "verify-email" | "reset-password" | "existing-account";

/** At most this many messages of one kind to one address per window. */
const THROTTLE = { max: 3, windowMinutes: 30 } as const;

let transporter: Transporter | undefined;

function smtp(): Transporter {
  if (transporter) return transporter;
  const env = serverEnv();
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

function hashAddress(address: string): string {
  return createHash("sha256").update(address.trim().toLowerCase()).digest("hex");
}

/** Records the attempt and reports whether it is within the per-address budget. */
async function withinThrottle(address: string, kind: MailKind): Promise<boolean> {
  const hash = hashAddress(address);
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM email_log
      WHERE address_hash = $1 AND kind = $2 AND sent_at > now() - make_interval(mins => $3)`,
    [hash, kind, THROTTLE.windowMinutes],
  );
  if (Number(rows[0]?.n ?? 0) >= THROTTLE.max) return false;
  await pool.query(`INSERT INTO email_log (address_hash, kind) VALUES ($1, $2)`, [hash, kind]);
  // Retention: throttle records are only needed for the throttle window. Keep a day, then delete.
  await pool.query(`DELETE FROM email_log WHERE sent_at < now() - interval '1 day'`);
  return true;
}

export async function sendMail(to: string, kind: MailKind, content: EmailContent): Promise<void> {
  if (!(await withinThrottle(to, kind))) {
    console.warn(`[mail] throttled ${kind} (address hash ${hashAddress(to).slice(0, 12)})`);
    return;
  }

  const env = serverEnv();
  if (env.MAIL_TRANSPORT === "outbox") {
    const dir = path.join(process.cwd(), ".dev-mail");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${kind}-${randomUUID().slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify({ to, kind, ...content }, null, 2));
    console.info(`[mail:outbox] ${kind} -> ${to} (${path.basename(file)})`);
    return;
  }

  await smtp().sendMail({
    from: env.MAIL_FROM,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
