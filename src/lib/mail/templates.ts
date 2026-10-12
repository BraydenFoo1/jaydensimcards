/**
 * Transactional email copy. The jokes stay in the margins: the action, the
 * link and the expiry must read as clearly as any real provider's email.
 */

export type EmailContent = { subject: string; text: string; html: string };

const DISCLAIMER =
  "Jayden SIM Cards is a fictional parody brand made for entertainment. It is not a telecommunications provider and does not sell mobile services.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(opts: { heading: string; paragraphs: string[]; action?: { label: string; url: string }; footnote: string }) {
  const { heading, paragraphs, action, footnote } = opts;
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p)}</p>`).join("");
  const button = action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#111;color:#ffd400;padding:12px 20px;font-weight:700;text-decoration:none;border:2px solid #111">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:13px;color:#555;line-height:1.5">If the button does not work, paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f0;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:520px;margin:0 auto;background:#fff;border:2px solid #111">
<div style="background:#111;color:#ffd400;padding:14px 20px;font-weight:800;letter-spacing:.08em">JAYDEN SIM CARDS</div>
<div style="padding:22px 20px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
${body}${button}
<p style="margin:18px 0 0;font-size:13px;color:#555;line-height:1.5">${escapeHtml(footnote)}</p>
</div>
<div style="border-top:1px solid #ddd;padding:12px 20px;font-size:11px;color:#777;line-height:1.5">${escapeHtml(DISCLAIMER)}</div>
</div></body></html>`;
}

function textVersion(heading: string, paragraphs: string[], footnote: string, url?: string) {
  return [heading, "", ...paragraphs, ...(url ? ["", url] : []), "", footnote, "", "--", DISCLAIMER].join("\n");
}

export function verificationEmail(name: string, url: string): EmailContent {
  const heading = "Confirm your email address";
  const paragraphs = [
    `Hi ${name || "there"},`,
    "Confirm this address to activate your Jayden SIM Cards account. The link expires in 1 hour.",
  ];
  const footnote = "If you did not sign up, ignore this email and nothing will happen. Jayden will not even notice.";
  return {
    subject: "Confirm your email - Jayden SIM Cards",
    text: textVersion(heading, paragraphs, footnote, url),
    html: layout({ heading, paragraphs, action: { label: "Confirm email", url }, footnote }),
  };
}

export function resetPasswordEmail(name: string, url: string): EmailContent {
  const heading = "Reset your password";
  const paragraphs = [
    `Hi ${name || "there"},`,
    "Someone asked to reset the password on your Jayden SIM Cards account. The link expires in 30 minutes, which is shorter than most of our outages.",
    "Resetting your password signs you out everywhere else.",
  ];
  const footnote = "If this was not you, ignore this email. Your password stays exactly as it is.";
  return {
    subject: "Reset your password - Jayden SIM Cards",
    text: textVersion(heading, paragraphs, footnote, url),
    html: layout({ heading, paragraphs, action: { label: "Choose a new password", url }, footnote }),
  };
}

export function existingAccountEmail(name: string, signInUrl: string): EmailContent {
  const heading = "You already have an account";
  const paragraphs = [
    `Hi ${name || "there"},`,
    "Someone tried to create a new Jayden SIM Cards account with this email address. You already have one, so nothing was changed.",
    "If that was you, sign in instead. If you have forgotten your password, use \"Forgot password\" on the sign-in page.",
  ];
  const footnote = "If this was not you, you can ignore this email. Your account is unchanged.";
  return {
    subject: "Sign-up attempt on your account - Jayden SIM Cards",
    text: textVersion(heading, paragraphs, footnote, signInUrl),
    html: layout({ heading, paragraphs, action: { label: "Sign in", url: signInUrl }, footnote }),
  };
}
