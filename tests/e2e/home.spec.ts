import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./support";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// As the original homepage (index.php) showed them.
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

/** How far the page can scroll sideways (0 means it fits). */
const sidewaysScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("homepage", () => {
  test("shows all nine original plans, with their prices and sign-up links @responsive", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("#plans article");
    await expect(cards).toHaveCount(9);
    for (const [i, plan] of ORIGINAL_PLANS.entries()) {
      const card = cards.nth(i);
      await expect(card.getByRole("heading", { level: 3 })).toHaveText(plan.name);
      await expect(card).toContainText(plan.price);
      await expect(card.getByRole("link", { name: `Choose plan: ${plan.name}` })).toHaveAttribute("href", `/register?plan=${plan.id}`);
    }
  });

  test("a plan's Choose plan link opens sign-up for that plan @responsive", async ({ page }) => {
    await page.goto("/");
    await page.locator("#plans").getByRole("link", { name: "Choose plan: The Exam Throttler" }).click();
    await expect(page).toHaveURL(/\/register\?plan=exam$/);
    await expect(page.getByRole("heading", { level: 1, name: "Join the network" })).toBeVisible();
  });

  test("the footer links reach the Privacy Policy and Terms of Service @responsive", async ({ page }) => {
    await page.goto("/");
    const legal = page.getByRole("contentinfo").getByRole("navigation", { name: "Legal" });
    await legal.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();

    await page.goto("/");
    await legal.getByRole("link", { name: "Terms of Service" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
  });

  test("fits the screen: the right number of columns, working navigation, no sideways scrolling @responsive", async ({ page }) => {
    await page.goto("/");
    expect(await sidewaysScroll(page)).toBe(0);

    const lefts = await page.locator("#plans article").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    const columns = new Set(lefts).size;
    const phone = page.viewportSize()!.width < 700;

    if (phone) {
      expect(columns).toBe(1);
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.getByRole("link", { name: "Plans" })).toBeHidden();
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(nav.getByRole("link", { name: "Plans" })).toBeVisible();
      expect(await sidewaysScroll(page)).toBe(0);
      await nav.getByRole("link", { name: "Plans" }).click();
      await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    } else {
      expect(columns).toBe(3);
      await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
      const nav = page.getByRole("navigation", { name: "Main" });
      for (const name of ["Plans", "Build your own", "Support", "My account", "Get a SIM"]) {
        await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
      }
    }

    // The plans heading must land below the sticky navigation, not under it.
    await page.goto("/#plans");
    const headingTop = await page.locator("#plans-title").evaluate((el) => el.getBoundingClientRect().top);
    const navBottom = await page.locator("#top").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(headingTop).toBeGreaterThanOrEqual(navBottom);
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("has no WCAG 2.2 A/AA violations @responsive", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });
});
