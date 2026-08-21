import { describe, expect, it } from "vitest";
import { featuredNameSize, priceBars } from "../../../../src/components/tv/FeaturedProductTile";
import type { MarketPriceHistoryPoint } from "../../../../src/api/market";
import type { MarketProduct } from "../../../../src/engine/types";

const product: MarketProduct = {
  id: "drink_1",
  symbol: "DRK",
  name: "Test Drink",
  category: "Cocktails",
  basePriceMinor: 1000,
  currentPriceMinor: 950,
  floorPriceMinor: 700,
  ceilingPriceMinor: 1400,
  salesVelocity: 4,
  isLive: true,
  isSoldOut: false,
  priority: true,
};

function point(priceMinor: number, index: number): MarketPriceHistoryPoint {
  return { at: `2026-08-18T18:${String(index * 5).padStart(2, "0")}:00Z`, oldPriceMinor: 1000, priceMinor, movement: priceMinor > 1000 ? "up" : priceMinor < 1000 ? "down" : "hold" };
}

describe("featured price bars", () => {
  it("steps long featured names down instead of truncating them", () => {
    expect(featuredNameSize("Guinness Pint")).toBe("short");
    expect(featuredNameSize("Cloud Island Sauvignon Blanc")).toBe("medium");
    expect(featuredNameSize("Cloud Island Sauvignon Blanc Bottle")).toBe("long");
    expect(featuredNameSize("Cloud Island Sauvignon Blanc, New Zealand Bottle")).toBe("very-long");
  });

  it("uses the base price as a centred zero line with bars on either side", () => {
    const chart = priceBars({ ...product, currentPriceMinor: 950 }, [point(1100, 0), point(950, 1)]);

    expect(chart.zeroY).toBe(80);
    expect(chart.bars[0]).toMatchObject({ price: 1100, trend: "up" });
    expect(chart.bars[0].y).toBeLessThan(chart.zeroY);
    expect(chart.bars[1]).toMatchObject({ price: 950, trend: "dn", y: chart.zeroY });
  });

  it("labels every sparse round and only the latest bar once a shape has formed", () => {
    const sparse = priceBars(product, [point(1020, 0), point(980, 1)]);
    expect(sparse.bars.every(bar => bar.showLabel)).toBe(true);
    expect(sparse.bars.every(bar => bar.height >= 34)).toBe(true);
    expect(sparse.bars.every(bar => bar.width >= 80)).toBe(true);
    expect(Math.max(...sparse.bars.map(bar => bar.height))).toBeGreaterThan(58);
    expect(sparse.bars[1].x - sparse.bars[0].x).toBeGreaterThan(150);

    const mature = priceBars(product, Array.from({ length: 8 }, (_, index) => point(920 + index * 20, index)));
    expect(mature.bars.filter(bar => bar.showLabel)).toHaveLength(1);
    expect(mature.bars.at(-1)?.showLabel).toBe(true);
    expect(mature.bars[0].width).toBeLessThan(sparse.bars[0].width);
  });

  it("shows no completed bars before the first five-minute round", () => {
    const opening = priceBars({ ...product, currentPriceMinor: 1000 }, []);

    expect(opening.bars).toHaveLength(0);
  });

  it("keeps one bar per visible five-minute round and caps the window at eighteen", () => {
    const history = Array.from({ length: 24 }, (_, index) => point(900 + index * 10, index));
    const chart = priceBars({ ...product, currentPriceMinor: 1130 }, history);

    expect(chart.bars).toHaveLength(18);
    expect(chart.bars.at(-1)?.price).toBe(1130);
  });
});
