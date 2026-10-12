import { afterEach, describe, expect, it, vi } from "vitest";
import { verificationEmail, resetPasswordEmail } from "@/lib/mail/templates";
import { isRoleName, isStaffRole, roles } from "@/lib/permissions";

const VALID = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  MAIL_TRANSPORT: "outbox",
};

async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const key of ["BETTER_AUTH_URL", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) {
    vi.stubEnv(key, undefined);
  }
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import("@/lib/env");
}

afterEach(() => vi.unstubAllEnvs());

describe("server environment", () => {
  it("accepts a minimal local configuration", async () => {
    const { serverEnv } = await loadEnv(VALID);
    expect(serverEnv().MAIL_TRANSPORT).toBe("outbox");
  });

  it("names missing variables without echoing secret values", async () => {
    const { serverEnv } = await loadEnv({ ...VALID, BETTER_AUTH_SECRET: "too-short-secret-value" });
    expect(() => serverEnv()).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => serverEnv()).not.toThrow(/too-short-secret-value/);
  });

  it("requires SMTP settings when sending real mail", async () => {
    const { serverEnv } = await loadEnv({ ...VALID, MAIL_TRANSPORT: "smtp" });
    expect(() => serverEnv()).toThrow(/SMTP_HOST[\s\S]*SMTP_PASS[\s\S]*MAIL_FROM/);
  });

  it("refuses the dev outbox on Vercel", async () => {
    const { serverEnv } = await loadEnv({ ...VALID, VERCEL: "1" });
    expect(() => serverEnv()).toThrow(/MAIL_TRANSPORT/);
  });
});

describe("base URL", () => {
  it("prefers BETTER_AUTH_URL and strips a trailing slash", async () => {
    const { resolveBaseURL } = await loadEnv({ ...VALID, BETTER_AUTH_URL: "https://jaydensimcards.vercel.app/" });
    expect(resolveBaseURL()).toBe("https://jaydensimcards.vercel.app");
  });

  it("uses the preview deployment's own URL on Vercel previews", async () => {
    const { resolveBaseURL } = await loadEnv({ ...VALID, MAIL_TRANSPORT: "smtp", SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p", MAIL_FROM: "a@b.c", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_URL: "jsc-abc123.vercel.app" });
    expect(resolveBaseURL()).toBe("https://jsc-abc123.vercel.app");
  });

  it("falls back to localhost", async () => {
    const { resolveBaseURL } = await loadEnv(VALID);
    expect(resolveBaseURL()).toBe("http://localhost:3000");
  });
});

describe("email templates", () => {
  it("escapes user-controlled names in HTML", () => {
    const mail = verificationEmail('<img src=x onerror="alert(1)">', "https://example.com/verify?token=a&b=c");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(mail.html).toContain("https://example.com/verify?token=a&amp;b=c");
  });

  it("states the fictional disclaimer and the expiry", () => {
    const mail = resetPasswordEmail("Ah Beng", "https://example.com/reset");
    expect(mail.text).toContain("fictional parody brand");
    expect(mail.text).toContain("30 minutes");
  });
});

describe("roles", () => {
  it("recognises exactly three roles", () => {
    expect(Object.keys(roles)).toEqual(["customer", "employee", "admin"]);
    expect(isRoleName("admin")).toBe(true);
    expect(isRoleName("superadmin")).toBe(false);
  });

  it("treats only employees and admins as staff", () => {
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole("employee")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole(undefined)).toBe(false);
  });

  it("gives customers no admin permissions and employees no destructive ones", () => {
    expect(roles.customer.authorize({ user: ["list"] }).success).toBe(false);
    expect(roles.employee.authorize({ user: ["ban"] }).success).toBe(true);
    expect(roles.employee.authorize({ user: ["delete"] }).success).toBe(false);
    expect(roles.employee.authorize({ user: ["set-role"] }).success).toBe(false);
    expect(roles.admin.authorize({ user: ["delete", "set-role"] }).success).toBe(true);
    expect(roles.admin.authorize({ user: ["impersonate"] }).success).toBe(false);
  });
});
