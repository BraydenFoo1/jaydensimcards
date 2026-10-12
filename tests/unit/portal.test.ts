import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";
import { assertCan, can, ForbiddenError, parseRole, type Capability } from "@/lib/authz";
import { fictionalIccid } from "@/lib/iccid";
import { networkStatus } from "@/lib/network-status";
import { describeLine, formatData, formatMoney, PLANS, planById, usagePercent } from "@/lib/plans";
import { planNextPath } from "@/lib/redirects";
import { describeUserAgent, maskIp } from "@/lib/user-agent";
import { validateChangePassword } from "@/lib/validation";

describe("authorization boundary", () => {
  const ALL: Capability[] = [
    "account:read", "account:change-password", "account:manage-sessions",
    "line:read", "line:switch-plan",
    "staff:access", "staff:view-customers", "staff:view-staff",
    "staff:suspend-customers", "staff:suspend-employees", "staff:manage-roles", "staff:delete-users",
    "audit:read-customer-actions", "audit:read-all",
  ];
  // The full matrix, written out so any change to grants is a visible test change.
  const EXPECTED: Record<"customer" | "employee" | "admin", Capability[]> = {
    customer: ["account:read", "account:change-password", "account:manage-sessions", "line:read", "line:switch-plan"],
    employee: [
      "account:read", "account:change-password", "account:manage-sessions",
      "staff:access", "staff:view-customers", "staff:suspend-customers", "audit:read-customer-actions",
    ],
    admin: [
      "account:read", "account:change-password", "account:manage-sessions",
      "staff:access", "staff:view-customers", "staff:view-staff",
      "staff:suspend-customers", "staff:suspend-employees", "staff:manage-roles", "staff:delete-users",
      "audit:read-customer-actions", "audit:read-all",
    ],
  };

  for (const role of ["customer", "employee", "admin"] as const) {
    for (const capability of ALL) {
      const allowed = EXPECTED[role].includes(capability);
      it(`${role} ${allowed ? "may" : "may not"} ${capability}`, () => {
        expect(can(role, capability)).toBe(allowed);
      });
    }
  }

  it("never gives staff a customer-only line action", () => {
    for (const role of ["employee", "admin"] as const) {
      expect(can(role, "line:read")).toBe(false);
      expect(can(role, "line:switch-plan")).toBe(false);
    }
  });

  it("denies everything to missing, unknown and multi-role values", () => {
    for (const role of [null, undefined]) {
      for (const capability of ALL) expect(can(role, capability)).toBe(false);
    }
    for (const raw of ["user", "superadmin", "admin,customer", "Admin", " admin", "", "__proto__", "constructor", "toString", 1, null, {}]) {
      expect(parseRole(raw)).toBeNull();
    }
  });

  it("throws a typed error when a capability is missing", () => {
    expect(() => assertCan({ role: "employee" }, "line:switch-plan")).toThrow(ForbiddenError);
    expect(() => assertCan({ role: null }, "account:read")).toThrow(/account:read/);
    expect(() => assertCan({ role: "customer" }, "line:switch-plan")).not.toThrow();
  });
});

describe("plan catalogue", () => {
  it("keeps all nine original plans with unique, URL-safe ids", () => {
    expect(PLANS.map((p) => p.name)).toEqual([
      "I'm Broke", "The Exam Throttler", "STEAM0", "The Jayden Special", "The Void Deck Roamer",
      "The Freedom Plan", "The Ultra Jayden 5G", "The Extreme Tuff", "The Tuffest Plan",
    ]);
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(9);
    for (const plan of PLANS) {
      expect(planNextPath(plan.id)).toBe(`/portal?plan=${plan.id}`);
      expect(plan.terms.length).toBeGreaterThan(0);
      expect(plan.specs).toHaveLength(6);
    }
  });

  it("preserves the original wording", () => {
    expect(planById("broke")?.terms[0]).toBe("The SIM may explode approximately 67 seconds after activation.");
    expect(planById("ultra")?.terms[0]).toBe("Unlimited means unlimited up to a limit. The limit is unlimited until we limit it.");
    expect(planById("voiddeck")?.terms[0]).toBe("88 GB. Huat.");
  });

  it("only resolves exact catalogue ids", () => {
    for (const bad of ["", "ULTRA", "ultra ", "../ultra", "__proto__", "toString", "constructor", 1, null, undefined, {}]) {
      expect(planById(bad)).toBeNull();
    }
  });
});

describe("formatting", () => {
  it.each([
    [null, "Unlimited"],
    [0, "0 GB"],
    [Number.NaN, "—"],
    [1e-31, "1.00 × 10⁻³¹ GB"],
    [6.7e21, "6.70 × 10²¹ GB"],
    [67 * 1024 * 1024, "67 PB"],
    [6.7 * 1024, "6.7 TB"],
    [0.01 * 1024, "10.24 GB"],
    [88, "88 GB"],
    [0.67, "686.1 MB"],
    [0.5, "512 MB"],
  ])("formatData(%s) = %s", (input, expected) => {
    expect(formatData(input)).toBe(expected);
  });

  it("formats money with separators", () => {
    expect(formatMoney(6700.67)).toBe("$6,700.67");
    expect(formatMoney(0.67)).toBe("$0.67");
    expect(formatMoney(67)).toBe("$67.00");
  });

  it("clamps usage percentages and skips unlimited allowances", () => {
    expect(usagePercent(50, 100)).toBe(50);
    expect(usagePercent(500, 100)).toBe(100);
    expect(usagePercent(-1, 100)).toBe(0);
    expect(usagePercent(5, null)).toBeNull();
    expect(usagePercent(5, 0)).toBeNull();
  });
});

describe("describeLine", () => {
  it("reports no plan for a new line", () => {
    expect(describeLine({ planId: null, usedGb: 0.67, allowanceOverrideGb: null })).toMatchObject({ plan: null, isOver: false });
  });

  it("puts the I'm Broke plan over its allowance immediately", () => {
    const line = describeLine({ planId: "broke", usedGb: 0.67, allowanceOverrideGb: null });
    expect(line.isOver).toBe(true);
    expect(line.percent).toBe(100);
    expect(line.remainingGb).toBe(0);
  });

  it("treats unlimited plans as never over", () => {
    expect(describeLine({ planId: "ultra", usedGb: 1e9, allowanceOverrideGb: null })).toMatchObject({ isOver: false, percent: null, remainingGb: null });
  });

  it("lets a staff override replace the plan allowance", () => {
    const line = describeLine({ planId: "exam", usedGb: 10, allowanceOverrideGb: 20 });
    expect(line.allowanceGb).toBe(20);
    expect(line.percent).toBe(50);
  });

  it("ignores an unknown stored plan id", () => {
    expect(describeLine({ planId: "deleted-plan", usedGb: 1, allowanceOverrideGb: null }).plan).toBeNull();
  });
});

describe("fictional ICCID", () => {
  it("is stable per account and different between accounts", () => {
    expect(fictionalIccid("user-a")).toBe(fictionalIccid("user-a"));
    expect(fictionalIccid("user-a")).not.toBe(fictionalIccid("user-b"));
  });

  it("looks like a grouped 19-digit number starting 8965", () => {
    expect(fictionalIccid("user-a")).toMatch(/^8965 \d{4} \d{4} \d{4} \d{3}$/);
  });
});

describe("network status (Singapore time)", () => {
  // 2026-10-07 is a Wednesday; SGT is UTC+8.
  const sgt = (iso: string) => new Date(`${iso}+08:00`);

  it.each([
    ["2026-10-07T03:00:00", "offline", "Jayden is asleep"],
    ["2026-10-07T07:15:00", "degraded", "Jayden is on the bus"],
    ["2026-10-07T10:00:00", "degraded", "Jayden is in class"],
    ["2026-10-07T16:00:00", "online", "Jayden is free"],
    ["2026-10-07T20:00:00", "congested", "Jayden is gaming"],
    ["2026-10-07T23:30:00", "unstable", "Jayden's phone is at 4%"],
    ["2026-10-10T09:00:00", "offline", "Jayden is sleeping in"],
    ["2026-10-10T13:00:00", "online", "Jayden is at the void deck"],
  ])("%s SGT is %s", (iso, level, reason) => {
    expect(networkStatus(sgt(iso))).toMatchObject({ level, reason });
  });

  it("takes the tower offline while the engineer sleeps", () => {
    expect(networkStatus(sgt("2026-10-07T03:00:00"))).toMatchObject({ towersOnline: "0 / 1", engineers: "0 / 1", backupTowers: "0 / 0" });
    expect(networkStatus(sgt("2026-10-07T16:00:00"))).toMatchObject({ towersOnline: "1 / 1", engineers: "1 / 1" });
  });
});

describe("device descriptions", () => {
  it.each([
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36", "Chrome on macOS"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari on iOS"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0", "Edge on Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0", "Firefox on Linux"],
    ["Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0 Mobile Safari/537.36", "Chrome on Android"],
    [null, "Unknown device"],
  ])("%s", (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected);
  });

  it("masks IP addresses", () => {
    expect(maskIp("203.116.45.9")).toBe("203.116.x.x");
    expect(maskIp("2001:db8:85a3::8a2e:370:7334")).toBe("2001:db8:…");
    expect(maskIp(null)).toBe("Unknown location");
    expect(maskIp("garbage")).toBe("Unknown location");
  });
});

describe("change password", () => {
  it("validates the form", () => {
    expect(validateChangePassword({ current: "old-password-1", password: "new-password-12", confirm: "new-password-12" })).toEqual({});
    expect(Object.keys(validateChangePassword({ current: "", password: "short", confirm: "x" })).sort()).toEqual(["confirm", "current", "password"]);
    expect(validateChangePassword({ current: "same-password-1", password: "same-password-1", confirm: "same-password-1" }).password).toMatch(/different/);
  });

  it("names a wrong current password, since the user is already signed in", () => {
    expect(authErrorMessage({ status: 400, code: "INVALID_PASSWORD" }, "change-password")).toBe("Your current password is incorrect.");
    // ...but sign-in still never distinguishes.
    expect(authErrorMessage({ status: 401, code: "INVALID_PASSWORD" }, "sign-in")).toBe("Email or password is incorrect.");
  });
});
