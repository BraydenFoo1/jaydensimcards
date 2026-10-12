/**
 * The "Signal Calibration Console" plan customiser from the original homepage.
 * Formulas, perks and notes are ported line for line from the original
 * script.js, so every slider position gives the same speed, latency, bars,
 * price, note and perks as before. All of it is a joke: nothing here is a
 * real plan or a real price, and it never touches an account.
 */

export const CONSOLE_START = 18;
export const METER_BARS = 16;

const PERKS = [
  { at: 5, text: "SMS to people who will not reply" },
  { at: 15, text: "Data works indoors, sometimes" },
  { at: 28, text: "Priority signal at the void deck" },
  { at: 40, text: "Free roaming inside MRT tunnels" },
  { at: 52, text: "Jayden replies within 3 to 5 working days" },
  { at: 63, text: "Your phone buzzes when Jayden thinks about you" },
  { at: 74, text: "Weather control, indoors only" },
  { at: 84, text: "You may text people from 2019" },
  { at: 92, text: "Speed so high your phone becomes warm and proud" },
  { at: 100, text: "Full ownership of the network, and its debts" },
] as const;

const NOTES = [
  { at: 0, text: "No network requested. Enjoy the silence and the birds." },
  { at: 12, text: "Reasonable. Suspiciously reasonable." },
  { at: 30, text: "A sensible plan for a sensible person. Jayden is watching you." },
  { at: 50, text: "You are now using more network than Jayden himself." },
  { at: 70, text: "Finance has been notified. Finance is Jayden." },
  { at: 86, text: "This plan requires a co-signer. Ideally a wealthy one." },
  { at: 96, text: "Approaching the physical limit of the network and your bank." },
  { at: 100, text: "Bill exceeds available currency. Payable in 12 installments of infinity." },
] as const;

/** The most perks listed at once; the rest are summarised in one line. */
const PERK_LIMIT = 6;

export const NO_PERKS = "None yet. Move the slider, be brave.";
export const MAX_REACHED_TOAST = "Plan submitted. Our billing system has fainted.";

function money(n: number): string {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function speedLabel(v: number): string {
  if (v === 0) return "0 kbps";
  if (v < 10) return (v * 0.9 + 0.4).toFixed(1) + " Mbps";
  if (v < 60) return Math.round(Math.pow(v, 1.9) / 4) + " Mbps";
  if (v < 100) return (Math.pow(v, 2.2) / 900).toFixed(1) + " Gbps";
  return "9,001 Gbps";
}

function pingLabel(v: number): string {
  if (v === 0) return "∞ ms";
  if (v >= 100) return "0.0001 ms";
  return Math.max(1, Math.round(900 / (v * 0.35 + 1))) + " ms";
}

/** null means infinite. */
function priceFor(v: number): number | null {
  if (v >= 100) return null;
  return 0 + Math.pow(v, 2.35) / 26 + v * 0.35;
}

function noteFor(v: number): string {
  let out: string = NOTES[0].text;
  for (const note of NOTES) if (v >= note.at) out = note.text;
  return out;
}

/** Height of each meter bar, from 18% up to 100%. */
export const METER_HEIGHTS = Array.from({ length: METER_BARS }, (_, i) => 18 + (i / (METER_BARS - 1)) * 82);

export type ConsoleReading = {
  speed: string;
  ping: string;
  barsShown: string;
  barsReal: string;
  price: string;
  infinite: boolean;
  note: string;
  /** Newest unlock first, at most six. */
  perks: string[];
  /** "+N more, buried in the terms", or null. */
  morePerks: string | null;
  litBars: number;
};

/** Everything the console shows for a slider value (0 to 100). */
export function readConsole(value: number): ConsoleReading {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  const price = priceFor(v);
  const unlocked = PERKS.filter((p) => v >= p.at).map((p) => p.text);
  return {
    speed: speedLabel(v),
    ping: pingLabel(v),
    barsShown: Math.min(4, Math.ceil(v / 25)) + " of 4",
    barsReal: Math.max(0, Math.min(4, Math.ceil(v / 25) - 1)) + " of 4",
    price: price === null ? "∞" : money(price) + "/mo",
    infinite: price === null,
    note: noteFor(v),
    perks: unlocked.slice(-PERK_LIMIT).reverse(),
    morePerks: unlocked.length > PERK_LIMIT ? `+${unlocked.length - PERK_LIMIT} more, buried in the terms` : null,
    litBars: Math.round((v / 100) * METER_BARS),
  };
}
