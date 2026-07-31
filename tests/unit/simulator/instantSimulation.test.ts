import { describe, expect, it } from "vitest";
import { buildInstantSimulation, buildLondonFridayRevenuePlan, LONDON_FRIDAY_HOURLY_ORDER_SHARES, type InstantSimulationProduct } from "../../../supabase/functions/_shared/instantSimulation";

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
    const plan = buildInstantSimulation(products, 1_500_000);

    expect(plan.rounds).toHaveLength(72);
    expect(plan.rounds[0].minute).toBe(5);
    expect(plan.rounds.at(-1)?.minute).toBe(360);
    expect(plan.sales.length).toBeGreaterThan(1_000);
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

  it("finishes within one cheapest drink of different target takings", () => {
    for (const targetRevenueMinor of [250_000, 750_000, 1_500_000, 3_000_000]) {
      const plan = buildInstantSimulation(products, targetRevenueMinor);
      const actualRevenueMinor = plan.sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceMinor, 0);
      expect(Math.abs(actualRevenueMinor - targetRevenueMinor)).toBeLessThan(Math.min(...products.filter(product => product.is_live).map(product => product.current_price_minor)));
    }
  });

  it("hits target takings with a live-like pub catalogue while retaining a beer-led mix", () => {
    const targetRevenueMinor = 1_000_000;
    const plan = buildInstantSimulation(liveLikeCatalogue, targetRevenueMinor);
    const actualRevenueMinor = plan.sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceMinor, 0);
    const categories = plan.sales.reduce<Record<string, number>>((totals, sale) => {
      const category = sale.posProductId.split("-")[0];
      totals[category] = (totals[category] ?? 0) + 1;
      return totals;
    }, {});

    expect(Math.abs(actualRevenueMinor - targetRevenueMinor)).toBeLessThan(492);
    expect(categories.Beer / plan.sales.length).toBeGreaterThan(0.84);
    expect(categories.Wine / plan.sales.length).toBeLessThan(0.03);
  });

  it("allows a zero takings target without inventing sales", () => {
    expect(buildInstantSimulation(products, 0).sales).toHaveLength(0);
  });

  it("returns an empty completed plan when no product can trade", () => {
    expect(buildInstantSimulation(products.map(product => ({ ...product, is_live: false })), 1_500_000)).toEqual({ sales: [], rounds: [] });
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
