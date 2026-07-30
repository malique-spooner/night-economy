import { describe, expect, it } from "vitest";
import { formatRemainingTime, getNextMarket } from "../../../../src/components/market/nextMarket";

describe("getNextMarket", () => {
  it("selects the nearest enabled weekly opening", () => {
    const next = getNextMarket([
      { day: "Friday", start: "18:00", end: "00:00", enabled: true },
      { day: "Saturday", start: "17:00", end: "00:00", enabled: true },
    ], new Date("2026-07-27T12:00:00Z"), "UTC");

    expect(next).toEqual({ day: "Friday", start: "18:00", remainingMs: 4 * 86_400_000 + 6 * 3_600_000 });
  });

  it("moves an already passed opening to the following week", () => {
    const next = getNextMarket([
      { day: "Monday", start: "09:00", end: "15:00", enabled: true },
    ], new Date("2026-07-27T12:00:00Z"), "UTC");

    expect(next?.remainingMs).toBe(6 * 86_400_000 + 21 * 3_600_000);
  });

  it("formats a countdown into readable blocks", () => {
    expect(formatRemainingTime(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
  });
});
