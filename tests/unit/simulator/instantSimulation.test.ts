import { describe, expect, it } from "vitest";
import { buildInstantSimulation, buildLondonFridayRevenuePlan, buildPriceSensitiveSimulation, LONDON_FRIDAY_HOURLY_ORDER_SHARES, type InstantSimulationProduct } from "../../../supabase/functions/_shared/instantSimulation";

const products: InstantSimulationProduct[] = [
  { id: "espresso", category: "Cocktails", base_price_minor: 1200, current_price_minor: 1200, floor_price_minor: 900, ceiling_price_minor: 1500, pos_product_id: "pos_espresso", is_live: true, is_sold_out: false },
  { id: "margarita", category: "Cocktails", base_price_minor: 1100, current_price_minor: 1100, floor_price_minor: 850, ceiling_price_minor: 1400, pos_product_id: "pos_margarita", is_live: true, is_sold_out: false },
  { id: "offline", category: "Cocktails", base_price_minor: 1000, current_price_minor: 1000, floor_price_minor: 800, ceiling_price_minor: 1200, pos_product_id: "pos_offline", is_live: false, is_sold_out: false },
];

const liveLikeCatalogue: InstantSimulationProduct[] = [
  ...catalogueProducts("Beer", 12, 650),
  ...catalogueProducts("Cocktails", 12, 1175),
  ...catalogueProducts("Spirits", 12, 492),
  ...catalogueProducts("Wine", 12, 3925),
  ...catalogueProducts("Uncategorized", 2, 875),
];

describe("buildInstantSimulation", () => {
  it("builds the full night locally with all orders and 72 price rounds", () => {
    const plan = buildInstantSimulation(products, 1_500_000, 360, undefined, { seed: "full-night" });
    const units = plan.sales.reduce((total, sale) => total + sale.quantity, 0);

    expect(plan.rounds).toHaveLength(72);
    expect(plan.rounds[0].minute).toBe(5);
    expect(plan.rounds.at(-1)?.minute).toBe(360);
    expect(units).toBeGreaterThan(1_000);
    expect(plan.sales.every(sale => sale.minute >= 0 && sale.minute < 360)).toBe(true);
    expect(plan.rounds.some(round => round.decisions.some(decision => decision.movement !== "hold"))).toBe(true);
    expect(new Set(plan.sales.map(sale => sale.unitPriceMinor)).size).toBeGreaterThan(2);
  });

  it("uses the London Friday timing prior to distribute the exact revenue target", () => {
    const plan = buildLondonFridayRevenuePlan(1_500_000);
    const hourlyRevenue = LONDON_FRIDAY_HOURLY_ORDER_SHARES.map((_, hour) => plan.slice(hour * 60, (hour + 1) * 60).reduce((total, revenue) => total + revenue, 0));
    const totalRevenue = plan.reduce((total, revenue) => total + revenue, 0);

    expect(totalRevenue).toBe(1_500_000);
    expect(hourlyRevenue.map(revenue => revenue / totalRevenue)).toEqual(
      LONDON_FRIDAY_HOURLY_ORDER_SHARES.map(share => expect.closeTo(share, 2)),
    );
    expect(hourlyRevenue.slice(0, 3).reduce((total, revenue) => total + revenue, 0) / totalRevenue).toBeCloseTo(0.54, 2);
    expect(hourlyRevenue[1]).toBeGreaterThan(hourlyRevenue[0]);
    expect(hourlyRevenue[2]).toBeGreaterThan(hourlyRevenue[4]);
    expect(hourlyRevenue[5]).toBeLessThan(hourlyRevenue[4]);
    expect(new Set(plan.slice(60, 120)).size).toBeGreaterThan(1);
  });

  it("uses the target as expected trade rather than forcing an exact result", () => {
    for (const targetRevenueMinor of [250_000, 750_000, 1_500_000, 3_000_000]) {
      const plan = buildInstantSimulation(products, targetRevenueMinor, 360, undefined, { seed: `target-${targetRevenueMinor}` });
      const actualRevenueMinor = plan.sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceMinor, 0);
      expect(actualRevenueMinor).not.toBe(targetRevenueMinor);
      expect(Math.abs(actualRevenueMinor - targetRevenueMinor) / targetRevenueMinor).toBeLessThan(0.3);
    }
  });

  it("stays near target takings with a balanced live-like category mix", () => {
    const targetRevenueMinor = 1_000_000;
    const plan = buildInstantSimulation(liveLikeCatalogue, targetRevenueMinor, 360, undefined, { seed: "balanced-night" });
    const actualRevenueMinor = plan.sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceMinor, 0);
    const categories = plan.sales.reduce<Record<string, number>>((totals, sale) => {
      const category = sale.posProductId.split("-")[0];
      totals[category] = (totals[category] ?? 0) + sale.quantity;
      return totals;
    }, {});
    const totalUnits = plan.sales.reduce((total, sale) => total + sale.quantity, 0);
    const productsById = new Map(liveLikeCatalogue.map(product => [product.id, product]));
    const maximumMovementByCategory = plan.rounds.flatMap(round => round.decisions).reduce<Record<string, number>>((maximums, decision) => {
      const product = productsById.get(decision.productId)!;
      const movementPercent = Math.abs(decision.newPriceMinor - product.base_price_minor) / product.base_price_minor * 100;
      maximums[product.category] = Math.max(maximums[product.category] ?? 0, movementPercent);
      return maximums;
    }, {});

    expect(Math.abs(actualRevenueMinor - targetRevenueMinor) / targetRevenueMinor).toBeLessThan(0.3);
    expect(categories.Beer / totalUnits).toBeGreaterThan(0.36);
    expect(categories.Beer / totalUnits).toBeLessThan(0.54);
    expect(categories.Wine / totalUnits).toBeGreaterThan(0.12);
    expect(categories.Wine / totalUnits).toBeLessThan(0.28);
    expect(categories.Cocktails / totalUnits).toBeGreaterThan(0.1);
    expect(categories.Cocktails / totalUnits).toBeLessThan(0.25);
    expect(categories.Spirits / totalUnits).toBeGreaterThan(0.09);
    expect(categories.Spirits / totalUnits).toBeLessThan(0.23);
    for (const category of ["Beer", "Wine", "Cocktails", "Spirits"]) expect(maximumMovementByCategory[category]).toBeGreaterThan(4);
  });

  it("allows a zero takings target without inventing sales", () => {
    expect(buildInstantSimulation(products, 0).sales).toHaveLength(0);
  });

  it("returns an empty completed plan when no product can trade", () => {
    expect(buildInstantSimulation(products.map(product => ({ ...product, is_live: false })), 1_500_000)).toEqual({ sales: [], rounds: [] });
  });

  it("keeps price-sensitive experimental services reproducible by seed", () => {
    const first = buildPriceSensitiveSimulation(products, 500_000, 120, undefined, { seed: 42 });
    const second = buildPriceSensitiveSimulation(products, 500_000, 120, undefined, { seed: 42 });
    expect(second).toEqual(first);
  });

  it("uses different seeds to create genuinely different nights", () => {
    const first = buildInstantSimulation(liveLikeCatalogue, 750_000, 180, undefined, { seed: "friday-a" });
    const second = buildInstantSimulation(liveLikeCatalogue, 750_000, 180, undefined, { seed: "friday-b" });
    expect(second.sales).not.toEqual(first.sales);
  });

  it("creates baskets, quiet minutes, and natural order clusters", () => {
    const plan = buildInstantSimulation(liveLikeCatalogue, 385_787, 360, undefined, { seed: "quiet-service" });
    const unitsByMinute = Array.from({ length: 360 }, (_, minute) => plan.sales
      .filter(sale => sale.minute === minute)
      .reduce((total, sale) => total + sale.quantity, 0));
    expect(plan.sales.some(sale => sale.quantity > 1)).toBe(true);
    expect(unitsByMinute.some(units => units === 0)).toBe(true);
    expect(Math.max(...unitsByMinute)).toBeGreaterThanOrEqual(5);
  });

  it("lets higher prices reduce orders instead of forcing the revenue target", () => {
    const base = buildPriceSensitiveSimulation(products, 500_000, 180, undefined, {
      seed: 17,
      pricing: { targetRangeUtilisation: 0, targetApproachRate: 0 },
    });
    const expensive = buildPriceSensitiveSimulation(products.map(product => ({ ...product, current_price_minor: Math.round(product.base_price_minor * 1.2) })), 500_000, 180, undefined, {
      seed: 17,
      pricing: { targetRangeUtilisation: 0, targetApproachRate: 0 },
    });
    expect(expensive.sales.length).toBeLessThan(base.sales.length);
  });
});

function catalogueProducts(category: string, count: number, priceMinor: number): InstantSimulationProduct[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${category}-${index}`,
    category,
    base_price_minor: priceMinor,
    current_price_minor: priceMinor,
    floor_price_minor: Math.round(priceMinor * 0.75),
    ceiling_price_minor: Math.round(priceMinor * 1.25),
    pos_product_id: `${category}-${index}`,
    is_live: true,
    is_sold_out: false,
  }));
}
