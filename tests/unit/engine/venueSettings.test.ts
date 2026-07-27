import { describe, expect, it } from "vitest";
import { defaultVenueMarketSettings, isCrashIntervalMinutes, normalizeTimeInput } from "../../../src/engine/venueSettings";

describe("defaultVenueMarketSettings", () => {
  it("creates input-ready defaults from a date", () => {
    expect(defaultVenueMarketSettings(new Date(2026, 6, 8, 20, 15))).toEqual({
      marketLive: false,
      marketSchedule: [{ day: "Friday", start: "18:00", end: "00:00", enabled: true }],
      crashIntervalMinutes: 30,
      launchDate: "2026-07-08",
      launchStartTime: "20:15",
      launchEndTime: "21:15",
    });
  });
});

describe("isCrashIntervalMinutes", () => {
  it("accepts supported crash intervals", () => {
    expect(isCrashIntervalMinutes(15)).toBe(true);
    expect(isCrashIntervalMinutes(30)).toBe(true);
    expect(isCrashIntervalMinutes(45)).toBe(false);
  });
});

describe("normalizeTimeInput", () => {
  it("normalizes Supabase time values for time inputs", () => {
    expect(normalizeTimeInput("20:00:00", "18:00")).toBe("20:00");
    expect(normalizeTimeInput(null, "18:00")).toBe("18:00");
  });
});
