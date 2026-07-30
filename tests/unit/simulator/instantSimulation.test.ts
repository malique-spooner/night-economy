import { describe, expect, it } from "vitest";
import { buildInstantSimulation, buildLondonFridayOrderPlan, LONDON_FRIDAY_HOURLY_ORDER_SHARES, type InstantSimulationProduct } from "../../../supabase/functions/_shared/instantSimulation";

const products: InstantSimulationProduct[] = [
  { id: "espresso", category: "Cocktails", base_price_minor: 1200, current_price_minor: 1200, floor_price_minor: 900, ceiling_price_minor: 1500, pos_product_id: "pos_espresso", is_live: true, is_sold_out: false },
  { id: "margarita", category: "Cocktails", base_price_minor: 1100, current_price_minor: 1100, floor_price_minor: 850, ceiling_price_minor: 1400, pos_product_id: "pos_margarita", is_live: true, is_sold_out: false },
  { id: "offline", category: "Cocktails", base_price_minor: 1000, current_price_minor: 1000, floor_price_minor: 800, ceiling_price_minor: 1200, pos_product_id: "pos_offline", is_live: false, is_sold_out: false },
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

  it("uses the London Friday timing prior without changing the target night volume", () => {
    const plan = buildLondonFridayOrderPlan(1_500_000);
    const hourlyOrders = LONDON_FRIDAY_HOURLY_ORDER_SHARES.map((_, hour) => plan.slice(hour * 60, (hour + 1) * 60).reduce((total, orders) => total + orders, 0));
    const totalOrders = plan.reduce((total, orders) => total + orders, 0);

    expect(totalOrders).toBe(2_560);
    expect(hourlyOrders.map(orders => orders / totalOrders)).toEqual(
      LONDON_FRIDAY_HOURLY_ORDER_SHARES.map(share => expect.closeTo(share, 2)),
    );
    expect(hourlyOrders.slice(0, 3).reduce((total, orders) => total + orders, 0) / totalOrders).toBeCloseTo(0.54, 2);
    expect(hourlyOrders[1]).toBeGreaterThan(hourlyOrders[0]);
    expect(hourlyOrders[2]).toBeGreaterThan(hourlyOrders[4]);
    expect(hourlyOrders[5]).toBeLessThan(hourlyOrders[4]);
    expect(new Set(plan.slice(60, 120)).size).toBeGreaterThan(1);
  });

  it("scales the timing plan with the revenue target while keeping its shape", () => {
    const quieterPlan = buildLondonFridayOrderPlan(750_000);
    expect(quieterPlan.reduce((total, orders) => total + orders, 0)).toBe(1_280);
    expect(quieterPlan.slice(300).reduce((total, orders) => total + orders, 0) / 1_280).toBeCloseTo(0.11, 2);
  });

  it("returns an empty completed plan when no product can trade", () => {
    expect(buildInstantSimulation(products.map(product => ({ ...product, is_live: false })), 1_500_000)).toEqual({ sales: [], rounds: [] });
  });
});
