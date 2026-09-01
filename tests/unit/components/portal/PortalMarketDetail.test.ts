import { describe, expect, it } from "vitest";
import { priceChart } from "../../../../src/components/portal/PortalMarketDetail";

describe("expanded portal price chart", () => {
  it("keeps the opening price on the graph's centre line", () => {
    const chart = priceChart([1_000, 1_100, 900], 1_000);

    expect(chart.zeroY).toBe(52);
    expect(chart.path).toContain("M8.0,52.0");
    expect(chart.last.y).toBeGreaterThan(chart.zeroY);
  });

  it("includes every recorded price point instead of a four-window preview", () => {
    const chart = priceChart(Array.from({ length: 72 }, (_, index) => 1_000 + index), 1_000);

    expect((chart.path.match(/[ML]/g) ?? [])).toHaveLength(72);
  });
});
