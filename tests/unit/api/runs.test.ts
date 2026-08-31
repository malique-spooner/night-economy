import { describe, expect, it } from "vitest";
import { publicDemoDailyRuns, type MarketRun } from "../../../src/api/runs";

const run = (patch: Partial<MarketRun>): MarketRun => ({
  id: "run",
  kind: "scheduled",
  status: "running",
  startedAt: "2026-08-31T00:00:00.000Z",
  endedAt: null,
  simulatedMinutes: 10,
  salesCount: 2,
  revenueMinor: 1200,
  ...patch,
});

describe("publicDemoDailyRuns", () => {
  it("keeps the live daily market but excludes rehearsals and empty legacy placeholders", () => {
    expect(publicDemoDailyRuns([
      run({ id: "today" }),
      run({ id: "yesterday", status: "completed", endedAt: "2026-08-30T23:00:00.000Z" }),
      run({ id: "legacy", status: "completed", salesCount: 0, revenueMinor: 0 }),
      run({ id: "rehearsal", kind: "quick", status: "completed" }),
    ]).map(item => item.id)).toEqual(["today", "yesterday"]);
  });
});
