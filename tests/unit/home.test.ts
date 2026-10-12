/**
 * The rebuilt homepage: the original sections and wording are present, the
 * Phase 2 removals stay removed, every link has a real destination, and the
 * page renders with no database. A fake Postgres listener on 127.0.0.1 (also
 * behind DATABASE_URL and PGHOST/PGPORT) proves no connection is opened.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COVERAGE, CTA_COPY, FAQ, FAQ_COPY, HERO, TICKER } from "@/lib/home-content";

const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const joined = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ");

/** Every page route in src/app, with route groups like (auth) removed. */
function appRoutes(dir = path.join(process.cwd(), "src/app"), prefix = ""): Set<string> {
  const routes = new Set<string>();
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      const segment = name.startsWith("(") ? "" : `/${name}`;
      for (const route of appRoutes(full, prefix + segment)) routes.add(route);
    } else if (name === "page.tsx") {
      routes.add(prefix || "/");
    }
  }
  return routes;
}

let server: net.Server;
let connections = 0;
let savedEnv: Record<string, string | undefined> = {};
let html = "";
let pageText = "";

beforeAll(async () => {
  server = net.createServer((socket) => {
    connections++;
    socket.on("error", () => {});
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  savedEnv = { DATABASE_URL: process.env.DATABASE_URL, PGHOST: process.env.PGHOST, PGPORT: process.env.PGPORT };
  Object.assign(process.env, { DATABASE_URL: `postgresql://probe:probe@127.0.0.1:${port}/probe`, PGHOST: "127.0.0.1", PGPORT: String(port) });

  const { default: Home } = await import("@/app/page");
  html = renderToStaticMarkup(createElement(Home));
  pageText = joined(html);
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("rebuilt homepage", () => {
  it("renders without opening any database connection", () => {
    expect(html.length).toBeGreaterThan(0);
    expect(connections).toBe(0);
  });

  it("no longer shows the placeholder introduction", () => {
    expect(pageText).not.toContain("The full site arrives in Phase 3E");
    expect(pageText).not.toContain("A fictional parody mobile network. The full site");
  });

  it("has one h1, the original slogan", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/)![1].replace(/<br\s*\/?>/g, " ");
    expect(joined(h1)).toBe("When there is a sim(will), There is a card(way)");
  });

  it("shows the original network-status ticker, every item", () => {
    for (const item of TICKER) {
      expect(pageText).toContain(item.label);
      expect(pageText).toContain(item.value);
    }
  });

  it("shows the hero copy, stats and footnote", () => {
    expect(pageText).toContain(HERO.eyebrow);
    expect(pageText).toContain(HERO.sub);
    for (const stat of HERO.stats) expect(text(html)).toContain(`${stat.label} ${stat.value}`);
    expect(pageText).toContain(HERO.footnote);
    for (const chip of HERO.chips) expect(pageText).toContain(chip);
  });

  it("shows every section in the original order", () => {
    const order = ['id="top"', 'id="hero-title"', 'id="plans"', 'id="customiser"', 'id="faq"', 'id="cta-title"'].map((marker) => html.indexOf(marker));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("starts the customiser at its original value and readout", () => {
    expect(html).toMatch(/type="range"[^>]*value="18"/);
    expect(pageText).toContain("Flagship Cell Towers usable");
    expect(pageText).toContain("$40.57/mo");
    expect(pageText).toContain("Reasonable. Suspiciously reasonable.");
  });

  it("shows all ten FAQ questions and answers, in one exclusive group", () => {
    expect(FAQ).toHaveLength(10);
    for (const item of FAQ) {
      expect(pageText).toContain(item.q);
      expect(pageText).toContain(item.a.map((part) => (typeof part === "string" ? part : part.text)).join(""));
    }
    expect(html.match(/<details[^>]*name="faq"/g)).toHaveLength(10);
    expect(pageText).toContain(`${FAQ_COPY.stuck} ${FAQ_COPY.email}`);
  });

  it("shows the closing banner, signing up for The Ultra Jayden 5G", () => {
    expect(pageText).toContain(CTA_COPY.title);
    expect(pageText).toContain(CTA_COPY.sub);
    expect(html).toContain(`href="/register?plan=${CTA_COPY.planId}"`);
  });

  it("includes the coverage map dialog, closed until asked for", () => {
    expect(pageText).toContain("Check coverage map");
    expect(html).toMatch(/<dialog[^>]*aria-labelledby="coverage-title"/);
    expect(html).not.toMatch(/<dialog[^>]*\sopen/);
    expect(pageText).toContain(COVERAGE.title);
    for (const label of Object.values(COVERAGE.legend)) expect(pageText).toContain(label);
  });

  it("keeps the Phase 2 removals removed", () => {
    for (const banned of ["ABE ONG", "Braden", "Real SIM cards, real prices", "No artificial intelligence", "forms.gle", "Bill payment"]) {
      expect(pageText).not.toContain(banned);
      expect(html).not.toContain(banned);
    }
  });

  it("gives every link a real destination", () => {
    const routes = appRoutes();
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => decode(m[1]));
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      if (href.startsWith("#")) {
        expect(html, `anchor ${href}`).toContain(`id="${href.slice(1)}"`);
      } else if (href.startsWith("mailto:")) {
        expect(href, "mailto").toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
      } else {
        expect(href.startsWith("/"), `internal link ${href}`).toBe(true);
        const pathname = new URL(href, "http://site.invalid").pathname;
        expect(routes.has(pathname), `route for ${href}`).toBe(true);
      }
    }
  });

  it("only links to plans that exist in the catalogue", async () => {
    const { planById } = await import("@/lib/plans");
    for (const [, id] of html.matchAll(/href="\/register\?plan=([^"]+)"/g)) expect(planById(id), id).not.toBeNull();
  });

  it("makes every button a non-submitting button", () => {
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).toContain('type="button"');
  });

  it("app routes used here all exist on disk", () => {
    for (const route of ["/", "/login", "/register", "/portal", "/forgot-password", "/privacy", "/terms"]) {
      expect(appRoutes().has(route), route).toBe(true);
    }
    expect(existsSync(path.join(process.cwd(), "src/app/page.tsx"))).toBe(true);
  });
});
