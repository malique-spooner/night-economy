import { describe, expect, it } from "vitest";
import { pubCategoryOrderShares, simulateDemandMinute, type DemandHistorySale } from "../../../supabase/functions/_shared/instantSimulation";

const catalogue = [
  ...products("Beer", 12, 680),
  ...products("Wine", 12, 3_900),
  ...products("Spirits", 12, 530),
  ...products("Cocktails", 12, 1_110),
];

describe("UK pub demand mix", () => {
  it("uses unit demand without suppressing expensive categories", () => {
    const shares = Object.fromEntries(pubCategoryOrderShares(catalogue).map(item => [item.category, item.share]));
    expect(shares.Beer).toBeCloseTo(0.489, 2);
    expect(shares.Wine).toBeCloseTo(0.196, 2);
    expect(shares.Cocktails).toBeCloseTo(0.174, 2);
    expect(shares.Spirits).toBeCloseTo(0.141, 2);
  });

  it("generates a seeded full-night mix without pricing bottles out of demand", () => {
    const history: DemandHistorySale[] = [];
    for (let minute = 0; minute < 360; minute += 1) {
      history.push(...simulateDemandMinute(catalogue, 5_000, minute, history, { seed: "pub-mix", serviceMinutes: 360 }));
    }
    const categoryByProduct = new Map(catalogue.map(product => [product.pos_product_id, product.category]));
    const counts = history.reduce<Record<string, number>>((totals, sale) => {
      const category = categoryByProduct.get(sale.posProductId)!;
      totals[category] = (totals[category] ?? 0) + sale.quantity;
      return totals;
    }, {});
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    expect(counts.Beer / total).toBeGreaterThan(0.38);
    expect(counts.Beer / total).toBeLessThan(0.54);
    expect(counts.Wine / total).toBeGreaterThan(0.13);
    expect(counts.Wine / total).toBeLessThan(0.27);
  });

  it("shifts demand away from a category when all of its prices rise", () => {
    const base = simulateNight(catalogue, "category-price");
    const expensiveWine = simulateNight(catalogue.map(product => product.category === "Wine"
      ? { ...product, current_price_minor: Math.round(product.base_price_minor * 1.2) }
      : product), "category-price");
    const wineUnits = (sales: DemandHistorySale[]) => sales
      .filter(sale => sale.posProductId.startsWith("Wine-"))
      .reduce((total, sale) => total + sale.quantity, 0);
    expect(wineUnits(expensiveWine)).toBeLessThan(wineUnits(base));
  });

  it("makes a rush busier and a slowdown quieter without forcing totals", () => {
    const totalUnits = (multiplier: number) => Array.from({ length: 60 }, (_, minute) => simulateDemandMinute(
      catalogue,
      4_000,
      minute,
      [],
      { seed: "event-volume", serviceMinutes: 360, eventMultiplier: multiplier },
    )).flat().reduce((total, sale) => total + sale.quantity, 0);
    expect(totalUnits(2.1)).toBeGreaterThan(totalUnits(1));
    expect(totalUnits(0.38)).toBeLessThan(totalUnits(1));
  });
});

function simulateNight(source: typeof catalogue, seed: string) {
  const history: DemandHistorySale[] = [];
  for (let minute = 0; minute < 360; minute += 1) {
    history.push(...simulateDemandMinute(source, 5_000, minute, history, { seed, serviceMinutes: 360 }));
  }
  return history;
}

function products(category: string, count: number, basePrice: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${category}-${index}`,
    category,
    base_price_minor: basePrice,
    current_price_minor: basePrice,
    pos_product_id: `${category}-${index}`,
    is_live: true,
    is_sold_out: false,
  }));
}
