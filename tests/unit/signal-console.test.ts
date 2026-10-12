/**
 * The Signal Calibration Console must behave exactly as the original
 * script.js did. Expected values were produced by the original formulas;
 * at the starting value they also match the original page's markup (except
 * the price, which the original script recalculated on load: see below).
 */
import { describe, expect, it } from "vitest";
import { CONSOLE_START, METER_HEIGHTS, NO_PERKS, readConsole } from "@/lib/signal-console";

describe("Signal Calibration Console", () => {
  it("starts at 18, like the original slider", () => {
    expect(CONSOLE_START).toBe(18);
  });

  it("shows the original page's starting readout at 18", () => {
    const r = readConsole(18);
    expect(r.speed).toBe("61 Mbps");
    expect(r.ping).toBe("123 ms");
    expect(r.barsShown).toBe("1 of 4");
    expect(r.barsReal).toBe("0 of 4");
    expect(r.note).toBe("Reasonable. Suspiciously reasonable.");
    expect(r.perks).toEqual(["Data works indoors, sometimes", "SMS to people who will not reply"]);
    expect(r.litBars).toBe(3);
    // The original HTML said $40.55/mo, but its script replaced that on load with the
    // formula's $40.57/mo, which is what visitors saw.
    expect(r.price).toBe("$40.57/mo");
  });

  it.each([
    [0, "0 kbps", "∞ ms", "0 of 4", "0 of 4", "$0.00/mo", 0],
    [5, "4.9 Mbps", "327 ms", "1 of 4", "0 of 4", "$3.44/mo", 1],
    [9, "8.5 Mbps", "217 ms", "1 of 4", "0 of 4", "$9.87/mo", 1],
    [10, "20 Mbps", "200 ms", "1 of 4", "0 of 4", "$12.11/mo", 2],
    [50, "423 Mbps", "49 ms", "2 of 4", "1 of 4", "$395.60/mo", 8],
    [59, "579 Mbps", "42 ms", "3 of 4", "2 of 4", "$578.51/mo", 9],
    [60, "9.1 Gbps", "41 ms", "3 of 4", "2 of 4", "$601.34/mo", 10],
    [75, "14.8 Gbps", "33 ms", "3 of 4", "2 of 4", "$1,006.69/mo", 12],
    [99, "27.3 Gbps", "25 ms", "4 of 4", "3 of 4", "$1,917.30/mo", 16],
    [100, "9,001 Gbps", "0.0001 ms", "4 of 4", "3 of 4", "∞", 16],
  ])("at %i the readout matches the original formulas", (v, speed, ping, shown, real, price, lit) => {
    const r = readConsole(v);
    expect([r.speed, r.ping, r.barsShown, r.barsReal, r.price, r.litBars]).toEqual([speed, ping, shown, real, price, lit]);
    expect(r.infinite).toBe(v === 100);
  });

  it("uses the original notes at each threshold", () => {
    expect(readConsole(0).note).toBe("No network requested. Enjoy the silence and the birds.");
    expect(readConsole(11).note).toBe("No network requested. Enjoy the silence and the birds.");
    expect(readConsole(30).note).toBe("A sensible plan for a sensible person. Jayden is watching you.");
    expect(readConsole(50).note).toBe("You are now using more network than Jayden himself.");
    expect(readConsole(70).note).toBe("Finance has been notified. Finance is Jayden.");
    expect(readConsole(86).note).toBe("This plan requires a co-signer. Ideally a wealthy one.");
    expect(readConsole(96).note).toBe("Approaching the physical limit of the network and your bank.");
    expect(readConsole(100).note).toBe("Bill exceeds available currency. Payable in 12 installments of infinity.");
  });

  it("lists perks newest first, at most six, then summarises the rest", () => {
    expect(readConsole(4).perks).toEqual([]);
    expect(NO_PERKS).toBe("None yet. Move the slider, be brave.");
    const max = readConsole(100);
    expect(max.perks).toEqual([
      "Full ownership of the network, and its debts",
      "Speed so high your phone becomes warm and proud",
      "You may text people from 2019",
      "Weather control, indoors only",
      "Your phone buzzes when Jayden thinks about you",
      "Jayden replies within 3 to 5 working days",
    ]);
    expect(max.morePerks).toBe("+4 more, buried in the terms");
    expect(readConsole(63).morePerks).toBeNull();
  });

  it("draws 16 meter bars rising from 18% to 100%, as the original did", () => {
    expect(METER_HEIGHTS).toHaveLength(16);
    expect(METER_HEIGHTS[0]).toBe(18);
    expect(METER_HEIGHTS[15]).toBe(100);
  });

  it("keeps out-of-range values inside 0 to 100", () => {
    expect(readConsole(-5)).toEqual(readConsole(0));
    expect(readConsole(250)).toEqual(readConsole(100));
  });
});
