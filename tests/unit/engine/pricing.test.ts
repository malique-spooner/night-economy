import { describe, expect, it } from "vitest";
import { priceMarket as priceSharedMarket } from "../../../supabase/functions/_shared/marketPricing";
import type { MarketProduct } from "../../../src/engine/types";

type MarketSale = { productId: string; quantity: number };

function priceMarket(products: MarketProduct[], sales: MarketSale[] = []) {
  return priceSharedMarket(
    products.map(product => ({
      id: product.id,
      pos_product_id: product.id,
      base_price_minor: product.basePriceMinor,
      current_price_minor: product.currentPriceMinor,
      floor_price_minor: product.floorPriceMinor,
      ceiling_price_minor: product.ceilingPriceMinor,
      category: product.category,
      is_live: product.isLive,
      is_sold_out: product.isSoldOut,
    })),
    sales.map(sale => ({ pos_product_id: sale.productId, quantity: sale.quantity })),
  );
}

const product = (id: string, category: string, overrides: Partial<MarketProduct> = {}): MarketProduct => ({
  id, symbol: id, name: id, category, basePriceMinor: 1000, currentPriceMinor: 1000,
  floorPriceMinor: 700, ceilingPriceMinor: 1500, salesVelocity: 0, isLive: true,
  isSoldOut: false, priority: false, ...overrides,
});

describe("zero-sum category market pricing", () => {
  it("shares one negative point across category peers for every sale", () => {
    const products = [product("espresso", "Cocktails"), product("margarita", "Cocktails"), product("negroni", "Cocktails")];
    const decisions = priceMarket(products, [
      { productId: "espresso", quantity: 3 },
      { productId: "margarita", quantity: 2 },
      { productId: "negroni", quantity: 1 },
    ]);

    expect(decisions).toMatchObject([
      { productId: "espresso", movement: "up", newPriceMinor: 1111 },
      { productId: "margarita", movement: "hold", newPriceMinor: 1000 },
      { productId: "negroni", movement: "down", newPriceMinor: 889 },
    ]);
    // The points are zero-sum. Penny rounding means the cash changes need not sum to zero exactly.
    expect(decisions.map(decision => decision.movement)).toEqual(["up", "hold", "down"]);
  });

  it("holds all products when category orders are equal", () => {
    const products = [product("one", "Cocktails"), product("two", "Cocktails"), product("three", "Cocktails")];
    const decisions = priceMarket(products, [{ productId: "one", quantity: 2 }, { productId: "two", quantity: 2 }, { productId: "three", quantity: 2 }]);
    expect(decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: "one", movement: "hold" }),
      expect.objectContaining({ productId: "two", movement: "hold" }),
      expect.objectContaining({ productId: "three", movement: "hold" }),
    ]));
  });

  it("makes a visible range-aware move for a low-priced winning drink", () => {
    const decisions = priceMarket([
      product("beer-winner", "Beer", { basePriceMinor: 600, currentPriceMinor: 600, floorPriceMinor: 480, ceilingPriceMinor: 720 }),
      product("beer-peer", "Beer", { basePriceMinor: 600, currentPriceMinor: 600, floorPriceMinor: 480, ceilingPriceMinor: 720 }),
    ], [{ productId: "beer-winner", quantity: 1 }]);

    expect(decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: "beer-winner", newPriceMinor: 650, movement: "up" }),
      expect.objectContaining({ productId: "beer-peer", newPriceMinor: 550, movement: "down" }),
    ]));
  });

  it("scales the same market signal to each drink's manager-set range", () => {
    const wideRange = priceMarket([
      product("winner", "Beer", { floorPriceMinor: 800, ceilingPriceMinor: 1200 }),
      product("peer", "Beer", { floorPriceMinor: 800, ceilingPriceMinor: 1200 }),
    ], [{ productId: "winner", quantity: 1 }]);
    const narrowRange = priceMarket([
      product("winner", "Beer", { floorPriceMinor: 900, ceilingPriceMinor: 1100 }),
      product("peer", "Beer", { floorPriceMinor: 900, ceilingPriceMinor: 1100 }),
    ], [{ productId: "winner", quantity: 1 }]);

    expect(wideRange.find(item => item.productId === "winner")?.newPriceMinor).toBe(1083);
    expect(narrowRange.find(item => item.productId === "winner")?.newPriceMinor).toBe(1042);
  });

  it("lets a sustained rush reach the manager-set ceiling", () => {
    const products = Array.from({ length: 21 }, (_, index) => product(`beer-${index}`, "Beer", { floorPriceMinor: 800, ceilingPriceMinor: 1200 }));
    const decisions = priceMarket(products, [{ productId: "beer-0", quantity: 20 }]);

    expect(decisions.find(item => item.productId === "beer-0")).toMatchObject({ movement: "up", newPriceMinor: 1200 });
  });

  it("does not let sales in one category move another category", () => {
    const products = [product("espresso", "Cocktails"), product("margarita", "Cocktails"), product("red", "Wine"), product("white", "Wine")];
    const decisions = priceMarket(products, [{ productId: "espresso", quantity: 4 }]);
    expect(decisions.find(item => item.productId === "espresso")?.movement).toBe("up");
    expect(decisions.find(item => item.productId === "margarita")?.movement).toBe("down");
    expect(decisions.find(item => item.productId === "red")).toMatchObject({ movement: "hold", newPriceMinor: 1000 });
    expect(decisions.find(item => item.productId === "white")).toMatchObject({ movement: "hold", newPriceMinor: 1000 });
  });

  it("holds a category with only one live product", () => {
    const decisions = priceMarket([product("only", "Cocktails")], [{ productId: "only", quantity: 20 }]);
    expect(decisions[0]).toMatchObject({ movement: "hold", newPriceMinor: 1000 });
  });

  it("excludes unavailable products and respects manager-set floors and ceilings", () => {
    const winner = product("winner", "Cocktails", { currentPriceMinor: 1490, ceilingPriceMinor: 1500 });
    const loser = product("loser", "Cocktails", { currentPriceMinor: 701, floorPriceMinor: 700 });
    const unavailable = product("unavailable", "Cocktails", { isSoldOut: true });
    const decisions = priceMarket([winner, loser, unavailable], [{ productId: "winner", quantity: 100 }]);
    expect(decisions).toMatchObject([
      { productId: "winner", movement: "up", newPriceMinor: 1500 },
      { productId: "loser", movement: "down", newPriceMinor: 700 },
      { productId: "unavailable", movement: "hold", newPriceMinor: 1000 },
    ]);
  });
});
