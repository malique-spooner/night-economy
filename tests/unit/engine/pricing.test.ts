import { describe, expect, it } from "vitest";
import { applyCategoryCrash, momentumFromDecisions, priceMarket, selectAdaptiveMarketSales } from "../../../supabase/functions/_shared/marketPricing";

const product = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id, pos_product_id: id, base_price_minor: 1000, current_price_minor: 1000,
  floor_price_minor: 800, ceiling_price_minor: 1200, category: "Cocktails", is_live: true, is_sold_out: false, ...overrides,
});

describe("momentum market pricing", () => {
  it("selects 5, 15, and 30 minute evidence windows by category volume", () => {
    const products = [
      product("busy", { category: "Beer" }),
      product("busy-peer", { category: "Beer" }),
      product("medium", { category: "Cocktails" }),
      product("medium-peer", { category: "Cocktails" }),
      product("quiet", { category: "Wine" }),
      product("quiet-peer", { category: "Wine" }),
    ];
    const result = selectAdaptiveMarketSales(products, [
      { pos_product_id: "busy", quantity: 8, minutesAgo: 4 },
      { pos_product_id: "medium", quantity: 3, minutesAgo: 4 },
      { pos_product_id: "medium-peer", quantity: 5, minutesAgo: 12 },
      { pos_product_id: "quiet", quantity: 1, minutesAgo: 4 },
      { pos_product_id: "quiet-peer", quantity: 1, minutesAgo: 22 },
    ]);
    expect(result.categoryWindows).toEqual({ Beer: 5, Cocktails: 15, Wine: 30 });
    expect(result.signalSales).toEqual(expect.arrayContaining([
      { pos_product_id: "busy", quantity: 8 },
      { pos_product_id: "medium-peer", quantity: 5 },
      { pos_product_id: "quiet-peer", quantity: 1 },
    ]));
  });

  it("automatically shortens a quiet category window as new orders accumulate", () => {
    const products = [product("wine"), product("wine-peer")];
    expect(selectAdaptiveMarketSales(products, [{ pos_product_id: "wine", quantity: 2, minutesAgo: 4 }]).categoryWindows.Cocktails).toBe(30);
    expect(selectAdaptiveMarketSales(products, [
      { pos_product_id: "wine", quantity: 3, minutesAgo: 4 },
      { pos_product_id: "wine-peer", quantity: 5, minutesAgo: 12 },
    ]).categoryWindows.Cocktails).toBe(15);
    expect(selectAdaptiveMarketSales(products, [{ pos_product_id: "wine", quantity: 8, minutesAgo: 4 }]).categoryWindows.Cocktails).toBe(5);
  });

  it("uses older orders as context without replaying them as fresh demand", () => {
    const products = [product("winner"), product("peer")];
    const noFreshOrder = priceMarket(products, [{ pos_product_id: "winner", quantity: 8 }], {}, {}, []);
    expect(noFreshOrder[0].movement).toBe("hold");
    const freshOrder = priceMarket(products, [{ pos_product_id: "winner", quantity: 8 }], {}, {}, [{ pos_product_id: "winner", quantity: 1 }]);
    expect(freshOrder[0].movement).toBe("up");
  });

  it("revalues the category after enough evidence while weighting untouched peers gently", () => {
    const products = [product("winner"), product("laggard"), product("untouched")];
    const decisions = priceMarket(products, [
      { pos_product_id: "winner", quantity: 5 },
      { pos_product_id: "laggard", quantity: 1 },
    ], {}, {}, [{ pos_product_id: "winner", quantity: 1 }]);
    expect(decisions.map(item => item.movement)).toEqual(["up", "down", "down"]);
    expect(Math.abs(decisions[2].newPriceMinor - decisions[2].oldPriceMinor)).toBeLessThan(
      Math.abs(decisions[1].newPriceMinor - decisions[1].oldPriceMinor),
    );
  });

  it("lets negative momentum fade naturally instead of deleting it after one quiet round", () => {
    const products = [product("winner"), product("laggard")];
    const decisions = priceMarket(products, [], { laggard: -0.4 });
    expect(decisions[1].momentum).toBeCloseTo(-0.3);
    expect(decisions[1].movement).toBe("down");
  });

  it("keeps the category zero-sum sales ledger", () => {
    const decisions = priceMarket([product("winner"), product("neutral"), product("loser")], [
      { pos_product_id: "winner", quantity: 3 }, { pos_product_id: "neutral", quantity: 2 }, { pos_product_id: "loser", quantity: 1 },
    ]);
    expect(decisions.map(item => item.movement)).toEqual(["up", "hold", "down"]);
    expect(decisions[0].momentum).toBeCloseTo(0.12, 2);
    expect(decisions[1].momentum).toBe(0);
    expect(decisions[2].momentum).toBeCloseTo(-0.17, 2);
  });

  it("builds momentum across consecutive winning rounds", () => {
    const products = [product("winner"), product("loser")];
    const first = priceMarket(products, [{ pos_product_id: "winner", quantity: 4 }]);
    const nextProducts = products.map(item => ({ ...item, current_price_minor: first.find(decision => decision.productId === item.id)!.newPriceMinor }));
    const second = priceMarket(nextProducts, [{ pos_product_id: "winner", quantity: 4 }], momentumFromDecisions(first));
    expect(second.find(item => item.productId === "winner")!.momentum).toBeGreaterThan(first.find(item => item.productId === "winner")!.momentum);
    expect(second.find(item => item.productId === "winner")!.newPriceMinor).toBeGreaterThan(first.find(item => item.productId === "winner")!.newPriceMinor);
  });

  it("holds unsold peers steady instead of making a whole category fall", () => {
    const decisions = priceMarket([product("winner"), product("untouched-one"), product("untouched-two")], [
      { pos_product_id: "winner", quantity: 1 },
    ]);
    expect(decisions.map(item => item.movement)).toEqual(["up", "hold", "hold"]);
  });

  it("uses buffered ranges for both a sustained winner and its ignored peer", () => {
    let products = [product("winner"), product("loser")];
    let momentum = {};
    for (let round = 0; round < 20; round += 1) {
      const decisions = priceMarket(products, [{ pos_product_id: "winner", quantity: 10 }], momentum);
      momentum = momentumFromDecisions(decisions);
      products = products.map(item => ({ ...item, current_price_minor: decisions.find(decision => decision.productId === item.id)!.newPriceMinor }));
    }
    expect(products[0].current_price_minor).toBeGreaterThanOrEqual(1145);
    expect(products[0].current_price_minor).toBeLessThan(1200);
    expect(products[1].current_price_minor).toBeLessThan(1000);
    expect(products[1].current_price_minor).toBeGreaterThanOrEqual(940);
  });

  it("lets a sustained category leader travel through most of its allowed range", () => {
    let products = Array.from({ length: 12 }, (_, index) => product(`drink-${index}`));
    let momentum = {};
    for (let round = 0; round < 8; round += 1) {
      const sales = products.map((item, index) => ({ pos_product_id: item.pos_product_id!, quantity: index === 0 ? 12 : index < 4 ? 1 : 0 }));
      const decisions = priceMarket(products, sales, momentum);
      momentum = momentumFromDecisions(decisions);
      products = products.map(item => ({ ...item, current_price_minor: decisions.find(decision => decision.productId === item.id)!.newPriceMinor }));
    }
    expect(products[0].current_price_minor).toBeGreaterThanOrEqual(1125);
    expect(products[0].current_price_minor).toBeLessThan(1200);
  });

  it("keeps an isolated order small even in a large category", () => {
    const products = Array.from({ length: 12 }, (_, index) => product(`drink-${index}`));
    const winner = priceMarket(products, [{ pos_product_id: "drink-0", quantity: 1 }])[0];
    expect(winner.newPriceMinor - winner.oldPriceMinor).toBeLessThan(10);
  });

  it("never exceeds the manager-set floor or ceiling", () => {
    const decisions = priceMarket([product("winner", { current_price_minor: 1199 }), product("loser", { current_price_minor: 801 })], [{ pos_product_id: "winner", quantity: 100 }], { winner: 1, loser: -1 });
    expect(decisions[0].newPriceMinor).toBeLessThanOrEqual(1200);
    expect(decisions[1].newPriceMinor).toBeGreaterThanOrEqual(800);
  });

  it("uses 75% of a drink's downward range during a crash", () => {
    const products = [product("cocktail", { floor_price_minor: 900 }), product("peer", { floor_price_minor: 900 })];
    const decisions = applyCategoryCrash(priceMarket(products, []), products, "Cocktails", true);
    expect(decisions[0]).toMatchObject({ newPriceMinor: 925, movement: "down" });
    expect(decisions[1]).toMatchObject({ newPriceMinor: 925, movement: "down" });
  });
});
