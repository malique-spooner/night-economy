import { describe, expect, it } from "vitest";
import type { MarketRun } from "../../../../src/api/runs";
import { buildRunDashboard } from "../../../../src/components/portal/runDashboard";
import type { MarketProduct } from "../../../../src/engine/types";

const run: MarketRun = { id: "run_1", kind: "quick", status: "completed", startedAt: "2026-07-25T12:00:00Z", endedAt: "2026-07-25T12:10:00Z", simulatedMinutes: 360, salesCount: 4, revenueMinor: 4700 };
const products = [{ id: "mp_1", posProductId: "pos_1", symbol: "ESP", name: "Espresso Martini", category: "Cocktails", basePriceMinor: 1200, currentPriceMinor: 1200, floorPriceMinor: 900, ceilingPriceMinor: 1500, salesVelocity: 0, isLive: true, isSoldOut: false, priority: true }] satisfies MarketProduct[];

describe("buildRunDashboard", () => {
  it("aggregates event totals, products, categories, and half-hour trading periods", () => {
    const dashboard = buildRunDashboard(run, [
      { posProductId: "pos_1", quantity: 2, unitPriceMinor: 1200, occurredAt: "2026-07-25T18:00:00Z" },
      { posProductId: "pos_1", quantity: 1, unitPriceMinor: 1300, occurredAt: "2026-07-25T18:31:00Z" },
      { posProductId: "missing", quantity: 1, unitPriceMinor: 1000, occurredAt: "2026-07-25T18:35:00Z" },
    ], products);

    expect(dashboard.unitsSold).toBe(4);
    expect(dashboard.revenueMinor).toBe(4700);
    expect(dashboard.averageUnitPriceMinor).toBe(1175);
    expect(dashboard.timeline.slice(0, 2).map(point => point.quantity)).toEqual([2, 2]);
    expect(dashboard.products[0]).toMatchObject({ name: "Espresso Martini", quantity: 3, revenueMinor: 3700 });
    expect(dashboard.categories.map(category => category.name)).toEqual(["Cocktails", "Other"]);
    expect(dashboard.recentSales[0].productName).toBe("Unlisted product");
  });
});
