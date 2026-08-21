import { describe, expect, it } from "vitest";
import { marketCycleMinutes, simulationProgress } from "../../../supabase/functions/_shared/simulationClock";

describe("simulationProgress", () => {
  const startedAt = "2026-07-30T18:00:00.000Z";

  it("advances a 20x quick start in fifteen-second, five-minute rounds", () => {
    const progress = simulationProgress(0, startedAt, new Date("2026-07-30T18:00:15.000Z"), 20, 360, true);

    expect(progress).toEqual({ minute: 5, lastTickAt: "2026-07-30T18:00:15.000Z" });
  });

  it("does not instantly finish a quick start after a delayed tick", () => {
    const progress = simulationProgress(0, startedAt, new Date("2026-07-30T18:10:00.000Z"), 20, 360, true);

    expect(progress).toEqual({ minute: 5, lastTickAt: "2026-07-30T18:10:00.000Z" });
  });

  it("never publishes a partial four-minute quick-start round", () => {
    const early = simulationProgress(0, startedAt, new Date("2026-07-30T18:00:11.900Z"), 20, 360, true);
    const due = simulationProgress(0, startedAt, new Date("2026-07-30T18:00:14.700Z"), 20, 360, true);

    expect(early).toEqual({ minute: 0, lastTickAt: startedAt });
    expect(due).toEqual({ minute: 5, lastTickAt: "2026-07-30T18:00:14.700Z" });
  });

  it("preserves ordinary elapsed-time progress for scheduled services", () => {
    const progress = simulationProgress(20, startedAt, new Date("2026-07-30T18:03:00.000Z"), 1, 360, false);

    expect(progress).toEqual({ minute: 23, lastTickAt: "2026-07-30T18:03:00.000Z" });
  });

  it("completes an instant run and includes all 72 five-minute rounds", () => {
    const cycles = marketCycleMinutes(0, 360);
    expect(cycles).toHaveLength(72);
    expect(cycles[0]).toBe(5);
    expect(cycles.at(-1)).toBe(360);
  });
});
