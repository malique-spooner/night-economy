import { describe, expect, it } from "vitest";
import { createFridayNightSimulation } from "../../pos-simulator/src/fridayNight.mjs";

describe("Friday-night POS simulation", () => {
  it("replays the same service deterministically from the same seed", () => {
    const first = createFridayNightSimulation({ seed: 42 });
    const second = createFridayNightSimulation({ seed: 42 });

    first.advance(300);
    second.advance(300);

    expect(first.getSales()).toEqual(second.getSales());
    expect(first.getSales().length).toBeGreaterThan(0);
  });

  it("accepts a price publication and exposes the new POS price", () => {
    const simulation = createFridayNightSimulation();
    const result = simulation.publishPrices({
      publicationId: "publication_test",
      lines: [{ productId: "pos_tlj_cocktails_classic_espresso", newPriceMinor: 1150 }],
    });

    expect(result).toMatchObject({ publicationId: "publication_test", status: "published" });
    expect(simulation.getProducts().find(product => product.id === "pos_tlj_cocktails_classic_espresso")).toMatchObject({ currentPriceMinor: 1150 });
  });

  it("stops creating sales for a product marked sold out", () => {
    const simulation = createFridayNightSimulation({ seed: 7 });
    simulation.injectEvent({ type: "sold_out", productId: "pos_tlj_cocktails_classic_espresso" });
    simulation.advance(480);

    expect(simulation.getProducts().find(product => product.id === "pos_tlj_cocktails_classic_espresso")).toMatchObject({ isAvailable: false });
    expect(simulation.getSales().some(sale => sale.productId === "pos_tlj_cocktails_classic_espresso")).toBe(false);
  });

  it("completes the six-hour 18:00–00:00 service in eleven minutes at 32x", () => {
    const simulation = createFridayNightSimulation({ seed: 9 });
    simulation.control({ action: "start", speed: 32 });
    simulation.tick(15 * 60_000);

    expect(simulation.getState().service).toMatchObject({ isComplete: true, minute: 360, running: false });
    expect(simulation.getSales().length).toBeGreaterThan(0);
  });

  it("quick starts a fresh 18:00 service while keeping the simulator settings", () => {
    const simulation = createFridayNightSimulation({ seed: 9 });
    simulation.control({ speed: 60, targetRevenueMinor: 850_000 });
    simulation.advance(120);

    simulation.control({ action: "quick_start" });

    expect(simulation.getState().service).toMatchObject({ minute: 0, running: true, speed: 60, targetRevenueMinor: 850_000, simulatedTime: "2026-07-17T17:00:00.000Z" });
  });

  it("keeps the simulated clock moving while paused, without adding sales", () => {
    const simulation = createFridayNightSimulation({ seed: 12 });
    simulation.control({ action: "quick_start" });
    simulation.advance(20);
    const saleCount = simulation.getSales().length;
    const product = simulation.getProducts().find(item => item.id === "pos_tlj_cocktails_classic_espresso");
    simulation.publishPrices({ publicationId: "pause_price", lines: [{ productId: product.id, newPriceMinor: product.basePriceMinor + 100 }] });

    simulation.control({ action: "pause" });
    simulation.control({ speed: 1 });
    simulation.tick(10 * 60_000);

    expect(simulation.getState().service).toMatchObject({ minute: 30, running: false, paused: true, isOpen: true });
    expect(simulation.getSales()).toHaveLength(saleCount);
    expect(simulation.getProducts().find(item => item.id === product.id)?.currentPriceMinor).toBe(product.basePriceMinor);
  });

  it("ends a service and resets prices to base", () => {
    const simulation = createFridayNightSimulation({ seed: 13 });
    simulation.control({ action: "quick_start" });
    const product = simulation.getProducts().find(item => item.id === "pos_tlj_cocktails_classic_espresso");
    simulation.publishPrices({ publicationId: "end_price", lines: [{ productId: product.id, newPriceMinor: product.basePriceMinor + 100 }] });

    simulation.control({ action: "end" });

    expect(simulation.getState().service).toMatchObject({ running: false, ended: true, isOpen: false });
    expect(simulation.getProducts().find(item => item.id === product.id)?.currentPriceMinor).toBe(product.basePriceMinor);
  });

  it("identifies a fresh reset so the market runner can clear the previous demo service", () => {
    const simulation = createFridayNightSimulation({ seed: 11 });
    simulation.control({ action: "start", speed: 32 });
    simulation.advance(30);
    simulation.control({ action: "reset" });

    expect(simulation.getState().service).toMatchObject({ minute: 0, resetId: 1, running: false });
    expect(simulation.getSales()).toEqual([]);
  });

  it("models a £10k Friday evening with beer as the largest order category", () => {
    const simulation = createFridayNightSimulation({ seed: 20260717 });
    simulation.advance(360);

    const products = simulation.getProducts();
    const sales = simulation.getSales();
    const unitsFor = category => {
      const productIds = new Set(products.filter(product => product.category === category).map(product => product.id));
      return sales.filter(sale => productIds.has(sale.productId)).reduce((total, sale) => total + sale.quantity, 0);
    };

    expect(simulation.getState().totals.revenueMinor).toBeGreaterThanOrEqual(990_000);
    expect(simulation.getState().totals.revenueMinor).toBeLessThanOrEqual(1_010_000);
    expect(unitsFor("Beer")).toBeGreaterThan(unitsFor("Cocktails"));
  });
});
