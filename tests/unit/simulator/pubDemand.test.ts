import { describe, expect, it } from "vitest";
import { pubCategoryOrderShares, selectPubOrderProduct } from "../../../supabase/functions/_shared/instantSimulation";

const catalogue = [
  ...Array.from({ length: 12 }, (_, index) => ({ id: `beer-${index}`, category: "Beer", base_price_minor: 680 })),
  ...Array.from({ length: 12 }, (_, index) => ({ id: `wine-${index}`, category: "Wine", base_price_minor: 3_900 })),
  ...Array.from({ length: 12 }, (_, index) => ({ id: `spirit-${index}`, category: "Spirits", base_price_minor: 530 })),
  ...Array.from({ length: 12 }, (_, index) => ({ id: `cocktail-${index}`, category: "Cocktails", base_price_minor: 1_110 })),
];

describe("UK pub demand mix", () => {
  it("converts published spend shares into bottle-aware order shares", () => {
    const shares = Object.fromEntries(pubCategoryOrderShares(catalogue).map(item => [item.category, item.share]));
    expect(shares.Beer).toBeGreaterThan(0.87);
    expect(shares.Wine).toBeGreaterThan(0.015);
    expect(shares.Wine).toBeLessThan(0.03);
    expect(shares.Spirits).toBeGreaterThan(shares.Cocktails);
  });

  it("selects a deterministic full-night mix led by beer with few wine bottles", () => {
    const selected = Array.from({ length: 10_000 }, (_, index) => selectPubOrderProduct(catalogue, Math.floor(index / 30), index % 30));
    const counts = selected.reduce<Record<string, number>>((totals, product) => ({ ...totals, [product.category]: (totals[product.category] ?? 0) + 1 }), {});
    expect(counts.Beer / selected.length).toBeGreaterThan(0.87);
    expect(counts.Wine / selected.length).toBeGreaterThan(0.015);
    expect(counts.Wine / selected.length).toBeLessThan(0.03);
  });
});
