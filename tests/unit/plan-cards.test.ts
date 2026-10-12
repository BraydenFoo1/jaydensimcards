/**
 * The homepage pricing section must show all nine original plans, with their
 * original names and prices, without any database.
 *
 * The expected names, prices and section copy are written out here as the
 * original homepage (index.php) displayed them, not read from src/lib/plans.ts,
 * so an accidental edit to the catalogue fails this test. A fake Postgres
 * listener on 127.0.0.1 (also behind DATABASE_URL and PGHOST/PGPORT) proves
 * that rendering the page opens no database connection.
 */
import net from "node:net";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";

const ORIGINAL_PLANS = [
  { id: "broke", name: "I'm Broke", price: "$0.67/mo" },
  { id: "exam", name: "The Exam Throttler", price: "$4.90/mo" },
  { id: "steam0", name: "STEAM0", price: "$6.70/mo" },
  { id: "special4g", name: "The Jayden Special", price: "$16.70/mo" },
  { id: "voiddeck", name: "The Void Deck Roamer", price: "$18.80/mo" },
  { id: "freedom5g", name: "The Freedom Plan", price: "$67.00/mo" },
  { id: "ultra", name: "The Ultra Jayden 5G", price: "$69.90/mo" },
  { id: "extreme5g", name: "The Extreme Tuff", price: "$167.00/mo" },
  { id: "tuffest67g", name: "The Tuffest Plan", price: "$6,700.67/mo" },
];

const ORIGINAL_COPY = {
  eyebrow: "Postpaid plans",
  title: "Pick a plan. Regret it monthly.",
  lede: "No contract, because we would not honour it anyway. Prices shown before GST, after GST, and after Jayden changes his mind.",
  footnote:
    "*Unlimited means unlimited up to a limit. The limit is unlimited until we limit it. Speeds measured under laboratory conditions, in a lab we do not have. Excess usage is billed per KB and rounded up generously. Plans that skim your data do so as advertised, which we consider full disclosure. Explosions, leaks and device damage are the responsibility of the customer, the customer's family, and the customer's estate.",
};

const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** Visible-ish text: tags removed, entities decoded, whitespace collapsed. */
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
/** Text with tags removed but nothing inserted between them, as a browser would join inline spans. */
const joined = (html: string) => decode(html.replace(/<[^>]+>/g, ""));

const ENV_KEYS = ["DATABASE_URL", "PGHOST", "PGPORT"];
let server: net.Server;
let connections = 0;
let savedEnv: Record<string, string | undefined> = {};
let html = "";
/** Just the pricing section: the homepage has other sections (and another sign-up link) too. */
let section = "";
let cards: string[] = [];

beforeAll(async () => {
  server = net.createServer((socket) => {
    connections++;
    socket.on("error", () => {});
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    DATABASE_URL: `postgresql://probe:probe@127.0.0.1:${port}/probe`,
    PGHOST: "127.0.0.1",
    PGPORT: String(port),
  });

  const { default: Home } = await import("@/app/page");
  html = renderToStaticMarkup(createElement(Home));
  const start = html.indexOf('<section id="plans"');
  section = start === -1 ? "" : html.slice(start, html.indexOf("</section>", start));
  cards = section.split("<article").slice(1).map((part) => part.slice(0, part.indexOf("</article>")));
  // Give any connection the render might have started time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("homepage pricing section", () => {
  it("renders without opening any database connection", () => {
    expect(html.length).toBeGreaterThan(0);
    expect(connections).toBe(0);
  });

  it("shows the original section heading, introduction and footnote verbatim", () => {
    expect(section).not.toBe("");
    const copyText = text(section);
    for (const copy of Object.values(ORIGINAL_COPY)) expect(copyText).toContain(copy);
  });

  it("shows exactly nine plan cards, in the original order", () => {
    expect(cards).toHaveLength(9);
    expect(cards.map((card) => text(card.match(/<h3[^>]*>(.*?)<\/h3>/)![1]))).toEqual(ORIGINAL_PLANS.map((p) => p.name));
  });

  it.each(ORIGINAL_PLANS.map((p, i) => [p.name, p, i] as const))("%s: original name and price, and a Choose plan link to /register?plan=<id>", (_name, original, i) => {
    const card = cards[i];
    expect(text(card.match(/<h3[^>]*>(.*?)<\/h3>/)![1])).toBe(original.name);
    expect(joined(card)).toContain(original.price);
    const links = [...card.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(decode(links[0][1])).toBe(`/register?plan=${original.id}`);
    // Visible label "Choose plan", plus the plan name for screen readers.
    expect(joined(links[0][2])).toBe(`Choose plan: ${original.name}`);
  });

  it("keeps every catalogue detail on each card: kicker, pitch, flag and all specification rows", () => {
    PLANS.forEach((plan, i) => {
      const card = text(cards[i]);
      expect(card).toContain(plan.kicker);
      expect(card).toContain(plan.pitch);
      if (plan.flag) expect(card).toContain(plan.flag);
      expect(plan.specs).toHaveLength(6);
      for (const spec of plan.specs) expect(card).toContain(`${spec.label} ${spec.value}`);
    });
  });

  it("uses each plan's own id in its link, and only ids from the catalogue", () => {
    const hrefs = [...section.matchAll(/href="\/register\?plan=([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(PLANS.map((p) => p.id));
  });
});
