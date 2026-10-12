/**
 * The plan catalogue: single source of truth for prices, allowances, terms
 * and the pricing-table copy. Ported from the original plans.php and the
 * homepage, wording preserved. Every plan is fictional.
 *
 * allowanceGb === null means unlimited. Safe to import in client components.
 */
const GB = 1;
const TB = 1024;
const PB = 1024 * 1024;

export type PlanId =
  | "broke"
  | "exam"
  | "steam0"
  | "special4g"
  | "voiddeck"
  | "freedom5g"
  | "ultra"
  | "extreme5g"
  | "tuffest67g";

export type Plan = {
  id: PlanId;
  name: string;
  tier: string;
  generation: string;
  kicker: string;
  pitch: string;
  price: number;
  bars: 0 | 1 | 2 | 3 | 4;
  dataLabel: string;
  allowanceGb: number | null;
  excessPerKb: number | null;
  excessCurrency: "USD" | "SGD";
  terms: string[];
  specs: { label: string; value: string }[];
  flag?: string;
  variant?: "danger" | "hero" | "tuffest";
};

export const PLANS: readonly Plan[] = [
  {
    id: "broke", name: "I'm Broke", tier: "Cheapest", generation: "—", kicker: "Cheapest",
    pitch: "For when the wallet says no and the SIM says maybe.",
    price: 0.67, bars: 0, dataLabel: "0.0000000000000000000000000000001 GB", allowanceGb: 1e-31,
    excessPerKb: 67.0, excessCurrency: "USD", variant: "danger",
    terms: [
      "The SIM may explode approximately 67 seconds after activation.",
      "Any usage beyond the allowance is charged at $67.00 USD per KB.",
    ],
    specs: [
      { label: "Data", value: "0.0000000000000000000000000000001 GB" },
      { label: "Excess", value: "$67.00 USD per KB" },
      { label: "Lifespan", value: "May explode after 67 seconds" },
      { label: "Privacy", value: "We take 67% of your data. Thank you." },
      { label: "Speed", value: "Whatever survives the explosion" },
      { label: "Contract", value: "Shorter than the SIM" },
    ],
  },
  {
    id: "exam", name: "The Exam Throttler", tier: "Student", generation: "4G", kicker: "Student",
    pitch: "For students who need to be saved from themselves.",
    price: 4.9, bars: 1, dataLabel: "500 GB", allowanceGb: 500 * GB,
    excessPerKb: null, excessCurrency: "SGD",
    terms: [
      "Full speed until your exam period. Then 2 kbps, for your own good.",
      "Unlimited talktime to your mother. Everyone else is metered.",
      "Contract runs until you graduate.",
    ],
    specs: [
      { label: "Data", value: "500 GB" },
      { label: "Speed", value: "Full speed, until your exam period. Then 2 kbps." },
      { label: "Talktime", value: "Unlimited to your mother" },
      { label: "SMS", value: "1,000 (they will not reply)" },
      { label: "Roaming", value: "Library level 3 only" },
      { label: "Contract", value: "Until you graduate" },
    ],
  },
  {
    id: "steam0", name: "STEAM0", tier: "Cheapest", generation: "4G", kicker: "Cheapest",
    pitch: "Cheap, mostly stable, quietly helping itself to your data.",
    price: 6.7, bars: 1, dataLabel: "0.01 TB", allowanceGb: 0.01 * TB,
    excessPerKb: 6.7, excessCurrency: "SGD",
    terms: [
      "Each hour there is a 6.7% chance the SIM takes 0.67% of your data and gives it to us.",
      "Allowance is 0.01 TB, which is 10 GB, which is less than it sounds.",
      "Any usage beyond the allowance is charged at $6.70 SGD per KB.",
    ],
    specs: [
      { label: "Data", value: "0.01 TB, which is 10 GB" },
      { label: "Excess", value: "$6.70 SGD per KB" },
      { label: "Skimming", value: "6.7% chance per hour of taking 0.67%" },
      { label: "Speed", value: "Steady, the way a queue is steady" },
      { label: "Roaming", value: "Anywhere the skimming reaches" },
      { label: "Contract", value: "Rolling, like the losses" },
    ],
  },
  {
    id: "special4g", name: "The Jayden Special", tier: "Flagship", generation: "4G", kicker: "4G",
    pitch: "Our flagship 4G. Privacy protected. Leaks not our problem.",
    price: 16.7, bars: 2, dataLabel: "6.7 TB", allowanceGb: 6.7 * TB,
    excessPerKb: null, excessCurrency: "SGD",
    terms: [
      "Your privacy is protected. If a leak happens, we are not responsible.",
      "This plan takes 6.7% of your data and gives it to us.",
      "Run out of data and you can refill it for $6.70.",
    ],
    specs: [
      { label: "Data", value: "6.7 TB" },
      { label: "Top-up", value: "$6.70 to refill when empty" },
      { label: "Skimming", value: "Flat 6.7%, no hourly nonsense" },
      { label: "Privacy", value: "Protected. Leaks are unprotected." },
      { label: "Speed", value: "Real 4G, most afternoons" },
      { label: "Contract", value: "6.7 months" },
    ],
  },
  {
    id: "voiddeck", name: "The Void Deck Roamer", tier: "Heartland", generation: "4G", kicker: "Heartland",
    pitch: "For aunties, uncles, and people who sit downstairs.",
    price: 18.8, bars: 2, dataLabel: "88 GB", allowanceGb: 88 * GB,
    excessPerKb: null, excessCurrency: "SGD",
    terms: ["88 GB. Huat.", "Signal is fastest near the mama shop.", "Contract renews whenever you play chess downstairs."],
    specs: [
      { label: "Data", value: "88 GB, huat" },
      { label: "Speed", value: "Fast near the mama shop" },
      { label: "Talktime", value: "4 hours of gossip nightly" },
      { label: "SMS", value: "Forwarded chain messages only" },
      { label: "Roaming", value: "Every void deck island-wide" },
      { label: "Contract", value: "Renews when you play chess" },
    ],
  },
  {
    id: "freedom5g", name: "The Freedom Plan", tier: "Freedom", generation: "5G", kicker: "5G",
    pitch: "67 TB and nobody watching. Do what you like with it.",
    price: 67.0, bars: 3, dataLabel: "67 TB", allowanceGb: 67 * TB,
    excessPerKb: null, excessCurrency: "SGD",
    terms: [
      "67 TB, and you are free to do anything with it. Privacy is ensured.",
      "Gaming is locked at 1,000 FPS.",
      "Your SIM has a 0.00000000000000000000000000067% chance of giving you 10 cents.",
    ],
    specs: [
      { label: "Data", value: "67 TB" },
      { label: "Privacy", value: "Ensured. Actually ensured." },
      { label: "Gaming", value: "Locked at 1,000 FPS" },
      { label: "Skimming", value: "None. We are trying something new." },
      { label: "Bonus", value: "0.00000000000000000000000000067% chance of 10 cents" },
      { label: "Contract", value: "Free to leave, free to come back" },
    ],
  },
  {
    id: "ultra", name: "The Ultra Jayden 5G", tier: "Ultra", generation: "5G", kicker: "5G",
    pitch: "Maximum bars. Minimum accountability.",
    price: 69.9, bars: 4, dataLabel: "Unlimited*", allowanceGb: null,
    excessPerKb: null, excessCurrency: "SGD", flag: "Chosen by 9 out of 10 Jaydens", variant: "hero",
    terms: [
      "Unlimited means unlimited up to a limit. The limit is unlimited until we limit it.",
      "5G is guaranteed within 1.5 m of Jayden.",
      "Contract is spiritual, and runs 24 months.",
    ],
    specs: [
      { label: "Data", value: "Unlimited*" },
      { label: "Speed", value: "5G within 1.5 m of Jayden" },
      { label: "Talktime", value: "Unlimited, screened" },
      { label: "SMS", value: "Unlimited, unread" },
      { label: "Roaming", value: "All 5 MRT lines, above ground" },
      { label: "Contract", value: "Spiritual, 24 months" },
    ],
  },
  {
    id: "extreme5g", name: "The Extreme Tuff", tier: "Extreme", generation: "5G", kicker: "5G",
    pitch: "The Freedom Plan, but the number got out of hand.",
    price: 167.0, bars: 4, dataLabel: "67 PB", allowanceGb: 67 * PB,
    excessPerKb: null, excessCurrency: "SGD",
    terms: [
      "67 PB of data. Every property of the Freedom Plan applies.",
      "Privacy ensured, 1,000 FPS gaming, same 10 cent lottery.",
      "The only difference is that the number is bigger.",
    ],
    specs: [
      { label: "Data", value: "67 PB" },
      { label: "Privacy", value: "Ensured, same as Freedom" },
      { label: "Gaming", value: "1,000 FPS, same as Freedom" },
      { label: "Bonus", value: "The same 10 cent lottery" },
      { label: "Difference", value: "The number is bigger" },
      { label: "Contract", value: "You will not finish this data" },
    ],
  },
  {
    id: "tuffest67g", name: "The Tuffest Plan", tier: "Tuffest", generation: "67G", kicker: "67G",
    pitch: "67G. Do not ask what the G stands for.",
    price: 6700.67, bars: 4, dataLabel: "6.7 QB", allowanceGb: 6.7e21,
    excessPerKb: null, excessCurrency: "SGD", flag: "67G · The tuffest plan", variant: "tuffest",
    terms: [
      "6.7 QB of data, ultimate privacy, and no internet delays.",
      "Infinite FPS. Your device gains the capabilities of a gaming PC.",
      "Jayden SIM Cards is not responsible for any crappy device damages.",
    ],
    specs: [
      { label: "Data", value: "6.7 QB" },
      { label: "Latency", value: "None. Delays have been removed." },
      { label: "Privacy", value: "Ultimate" },
      { label: "Gaming", value: "Infinite FPS. Your phone becomes a gaming PC." },
      { label: "Warning", value: "Device damage is your own business" },
      { label: "Contract", value: "The contract holds you" },
    ],
  },
];

/** The pricing section's own copy, verbatim from the original homepage's #plans section. */
export const PRICING_COPY = {
  eyebrow: "Postpaid plans",
  title: "Pick a plan. Regret it monthly.",
  lede: "No contract, because we would not honour it anyway. Prices shown before GST, after GST, and after Jayden changes his mind.",
  footnote:
    "*Unlimited means unlimited up to a limit. The limit is unlimited until we limit it. Speeds measured under laboratory conditions, in a lab we do not have. Excess usage is billed per KB and rounded up generously. Plans that skim your data do so as advertised, which we consider full disclosure. Explosions, leaks and device damage are the responsibility of the customer, the customer's family, and the customer's estate.",
} as const;

const BY_ID = new Map<string, Plan>(PLANS.map((p) => [p.id, p]));

/** Looks up a plan by id. Anything that isn't an exact catalogue id is null. */
export function planById(id: unknown): Plan | null {
  return typeof id === "string" ? (BY_ID.get(id) ?? null) : null;
}

/* ---------------------------------------------------------
   Formatting
   --------------------------------------------------------- */

const SUPERSCRIPT: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

function trimZeros(fixed: string): string {
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

/** Human-readable data size, from 10⁻³¹ GB to 10²¹ GB. */
export function formatData(gb: number | null): string {
  if (gb === null) return "Unlimited";
  if (!Number.isFinite(gb)) return "—";
  if (gb === 0) return "0 GB";
  if (gb < 1e-6 || gb >= 1e9) {
    const [mantissa, exponent] = gb.toExponential(2).split("e");
    const exp = String(Number(exponent)).replace(/[-0-9]/g, (c) => SUPERSCRIPT[c]);
    return `${mantissa} × 10${exp} GB`;
  }
  if (gb >= PB) return `${trimZeros((gb / PB).toFixed(2))} PB`;
  if (gb >= TB) return `${trimZeros((gb / TB).toFixed(2))} TB`;
  if (gb >= 1) return `${trimZeros(gb.toFixed(2))} GB`;
  return `${trimZeros((gb * 1024).toFixed(1))} MB`;
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 0–100, or null when the allowance is unlimited or not positive. */
export function usagePercent(usedGb: number, allowanceGb: number | null): number | null {
  if (allowanceGb === null || allowanceGb <= 0) return null;
  return Math.min(100, Math.max(0, (usedGb / allowanceGb) * 100));
}

/* ---------------------------------------------------------
   A customer's line, as shown in the portal
   --------------------------------------------------------- */

export type LineRecord = { planId: string | null; usedGb: number; allowanceOverrideGb: number | null };

export type LineView = {
  plan: Plan | null;
  usedGb: number;
  allowanceGb: number | null;
  percent: number | null;
  remainingGb: number | null;
  isOver: boolean;
};

export function describeLine(line: LineRecord): LineView {
  const plan = planById(line.planId);
  if (!plan) return { plan: null, usedGb: line.usedGb, allowanceGb: null, percent: null, remainingGb: null, isOver: false };
  const allowanceGb = line.allowanceOverrideGb ?? plan.allowanceGb;
  const isOver = allowanceGb !== null && line.usedGb > allowanceGb;
  return {
    plan,
    usedGb: line.usedGb,
    allowanceGb,
    percent: usagePercent(line.usedGb, allowanceGb),
    remainingGb: allowanceGb === null ? null : Math.max(0, allowanceGb - line.usedGb),
    isOver,
  };
}
