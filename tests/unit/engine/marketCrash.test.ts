import { describe, expect, it } from "vitest";
import { activeMarketCrash, crashCategoryQueue, marketCrashCapacity } from "../../../src/engine/marketCrash";

const settings = { durationMinutes: 10 as const, categoryCrashCounts: { Cocktails: 2, Beer: 1, Wine: 1 } };

describe("market crash schedule", () => {
  it("limits a six-hour service to four responsibly spaced crashes", () => {
    expect(marketCrashCapacity(360, settings)).toBe(4);
  });

  it("interleaves category quotas so one category cannot repeat before another configured category", () => {
    expect(crashCategoryQueue(settings)).toEqual(["Beer", "Cocktails", "Wine", "Cocktails"]);
  });

  it("only exposes a crash for its configured five-minute pricing rounds", () => {
    const first = activeMarketCrash(360, 85, settings);
    expect(first?.category).toBe("Beer");
    expect(activeMarketCrash(360, 90, settings)?.category).toBe("Beer");
    expect(activeMarketCrash(360, 95, settings)).toBeNull();
  });
});
