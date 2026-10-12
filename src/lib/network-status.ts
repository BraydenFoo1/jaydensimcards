/**
 * The Jayden network's status, derived from what Jayden is probably doing at
 * this moment in Singapore. Entirely fictional, entirely deterministic.
 */

export type NetworkLevel = "online" | "degraded" | "congested" | "unstable" | "offline";

export type NetworkStatus = {
  level: NetworkLevel;
  label: string;
  reason: string;
  towersOnline: string;
  backupTowers: string;
  engineers: string;
  latency: string;
  uptime: string;
  coverage: string;
};

type Rule = { from: number; to: number; level: NetworkLevel; reason: string; latency: string };

// Minutes since midnight, Singapore time. First match wins.
const WEEKDAY: Rule[] = [
  { from: 0, to: 7 * 60, level: "offline", reason: "Jayden is asleep", latency: "∞" },
  { from: 7 * 60, to: 7 * 60 + 45, level: "degraded", reason: "Jayden is on the bus", latency: "2,900ms" },
  { from: 7 * 60 + 45, to: 15 * 60, level: "degraded", reason: "Jayden is in class", latency: "4,200ms" },
  { from: 15 * 60, to: 18 * 60, level: "online", reason: "Jayden is free", latency: "67ms" },
  { from: 18 * 60, to: 22 * 60, level: "congested", reason: "Jayden is gaming", latency: "1,670ms" },
  { from: 22 * 60, to: 24 * 60, level: "unstable", reason: "Jayden's phone is at 4%", latency: "6,700ms" },
];

const WEEKEND: Rule[] = [
  { from: 0, to: 11 * 60, level: "offline", reason: "Jayden is sleeping in", latency: "∞" },
  { from: 11 * 60, to: 18 * 60, level: "online", reason: "Jayden is at the void deck", latency: "88ms" },
  { from: 18 * 60, to: 23 * 60, level: "congested", reason: "Jayden is gaming", latency: "1,670ms" },
  { from: 23 * 60, to: 24 * 60, level: "unstable", reason: "Jayden's phone is at 4%", latency: "6,700ms" },
];

const LABELS: Record<NetworkLevel, string> = {
  online: "ONLINE",
  degraded: "DEGRADED",
  congested: "CONGESTED",
  unstable: "UNSTABLE",
  offline: "OFFLINE",
};

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Singapore",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function networkStatus(at: Date): NetworkStatus {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]));
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  const weekend = p.weekday === "Sat" || p.weekday === "Sun";
  const rule = (weekend ? WEEKEND : WEEKDAY).find((r) => minutes >= r.from && minutes < r.to) ?? WEEKDAY[0];
  const asleep = rule.level === "offline";

  return {
    level: rule.level,
    label: LABELS[rule.level],
    reason: rule.reason,
    towersOnline: asleep ? "0 / 1" : "1 / 1",
    backupTowers: "0 / 0",
    engineers: asleep ? "0 / 1" : "1 / 1",
    latency: rule.latency,
    uptime: "41.8%",
    coverage: "Wherever Jayden is",
  };
}
