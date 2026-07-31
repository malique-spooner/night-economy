import { priceMarket, type MarketPriceDecision } from "./marketPricing.ts";

export type InstantSimulationProduct = {
  id: string;
  category: string;
  base_price_minor: number;
  current_price_minor: number;
  floor_price_minor: number;
  ceiling_price_minor: number;
  pos_product_id: string | null;
  is_live: boolean;
  is_sold_out: boolean;
};

export type InstantSimulationSale = {
  minute: number;
  sequence: number;
  posProductId: string;
  quantity: number;
  unitPriceMinor: number;
};

export type InstantSimulationRound = {
  minute: number;
  importedLines: number;
  decisions: MarketPriceDecision[];
};

const REFERENCE_SERVICE_MINUTES = 360;

// London Friday prior for 18:00–00:00. Public evidence does not expose
// product-level till data by hour, so these shares combine the GLA's 3-hour
// night-time pattern with CGA/Zonal's stronger 18:00–20:00 trading window.
// Keep this as a prior until a venue has enough of its own Friday POS history.
export const LONDON_FRIDAY_HOURLY_ORDER_SHARES = [0.16, 0.19, 0.19, 0.18, 0.17, 0.11] as const;

export function buildLondonFridayRevenuePlan(
  targetRevenueMinor: number,
  serviceMinutes = REFERENCE_SERVICE_MINUTES,
): number[] {
  if (serviceMinutes <= 0) return [];
  const targetRevenue = Math.max(0, Math.round(targetRevenueMinor));
  const minuteShares = Array.from({ length: serviceMinutes }, () => 0);

  for (let hour = 0; hour < LONDON_FRIDAY_HOURLY_ORDER_SHARES.length; hour += 1) {
    const start = Math.floor((hour * serviceMinutes) / LONDON_FRIDAY_HOURLY_ORDER_SHARES.length);
    const end = Math.floor(((hour + 1) * serviceMinutes) / LONDON_FRIDAY_HOURLY_ORDER_SHARES.length);
    const pulses = Array.from({ length: end - start }, (_, offset) => {
      const minute = start + offset;
      // Two overlapping rhythms avoid an implausibly flat number of orders per
      // minute while remaining deterministic for repeatable run histories.
      return 1 + 0.13 * Math.sin(((minute + 3) * 2 * Math.PI) / 17) + 0.07 * Math.sin(((minute + 1) * 2 * Math.PI) / 7);
    });
    const pulseTotal = pulses.reduce((total, pulse) => total + pulse, 0);
    for (let offset = 0; offset < pulses.length; offset += 1) {
      minuteShares[start + offset] = LONDON_FRIDAY_HOURLY_ORDER_SHARES[hour] * pulses[offset] / pulseTotal;
    }
  }

  let allocated = 0;
  let cumulativeShare = 0;
  return minuteShares.map((share, minute) => {
    cumulativeShare += share;
    const cumulativeRevenue = minute === serviceMinutes - 1 ? targetRevenue : Math.round(cumulativeShare * targetRevenue);
    const minuteRevenue = cumulativeRevenue - allocated;
    allocated = cumulativeRevenue;
    return minuteRevenue;
  });
}

export function selectTargetedMinuteProducts<
  T extends Pick<InstantSimulationProduct, "category" | "base_price_minor" | "current_price_minor">
>(products: T[], minute: number, startingRevenueMinor: number, cumulativeTargetRevenueMinor: number): T[] {
  if (!products.length) return [];
  const selected: T[] = [];
  let revenueMinor = startingRevenueMinor;

  // A drink is discrete, so the closest achievable result may differ from the
  // target by a few pounds. The demand-model choice is used normally; only the
  // final drink near a cumulative target may switch to the closest menu price.
  for (let sequence = 0; sequence < 10_000; sequence += 1) {
    const currentGap = Math.abs(cumulativeTargetRevenueMinor - revenueMinor);
    let product = selectPubOrderProduct(products, minute, sequence);
    let nextGap = Math.abs(cumulativeTargetRevenueMinor - revenueMinor - Math.max(1, product.current_price_minor));
    if (nextGap >= currentGap) {
      product = products.reduce((closest, candidate) => {
        const closestGap = Math.abs(cumulativeTargetRevenueMinor - revenueMinor - Math.max(1, closest.current_price_minor));
        const candidateGap = Math.abs(cumulativeTargetRevenueMinor - revenueMinor - Math.max(1, candidate.current_price_minor));
        return candidateGap < closestGap ? candidate : closest;
      }, products[0]);
      nextGap = Math.abs(cumulativeTargetRevenueMinor - revenueMinor - Math.max(1, product.current_price_minor));
    }
    if (nextGap >= currentGap) break;
    selected.push(product);
    revenueMinor += Math.max(1, product.current_price_minor);
  }
  return selected;
}

export function buildInstantSimulation(
  sourceProducts: InstantSimulationProduct[],
  targetRevenueMinor: number,
  serviceMinutes = 360,
): { sales: InstantSimulationSale[]; rounds: InstantSimulationRound[] } {
  const products = sourceProducts.map(product => ({ ...product }));
  const active = products.filter(product => product.is_live && !product.is_sold_out && product.pos_product_id);
  if (!active.length) return { sales: [], rounds: [] };

  const sales: InstantSimulationSale[] = [];
  const rounds: InstantSimulationRound[] = [];
  const roundSales = new Map<string, number>();
  const revenuePlan = buildLondonFridayRevenuePlan(targetRevenueMinor, serviceMinutes);
  let roundLineCount = 0;
  let cumulativeTargetRevenueMinor = 0;
  let revenueMinor = 0;

  for (let minute = 0; minute < serviceMinutes; minute += 1) {
    cumulativeTargetRevenueMinor += revenuePlan[minute];
    const minuteProducts = selectTargetedMinuteProducts(active, minute, revenueMinor, cumulativeTargetRevenueMinor);
    for (let sequence = 0; sequence < minuteProducts.length; sequence += 1) {
      const product = minuteProducts[sequence];
      sales.push({ minute, sequence, posProductId: product.pos_product_id!, quantity: 1, unitPriceMinor: product.current_price_minor });
      roundSales.set(product.id, (roundSales.get(product.id) ?? 0) + 1);
      roundLineCount += 1;
      revenueMinor += product.current_price_minor;
    }

    if ((minute + 1) % 5 !== 0) continue;
    const decisions = priceMarket(products, [...roundSales.entries()].flatMap(([productId, quantity]) => {
      const posProductId = products.find(product => product.id === productId)?.pos_product_id;
      return posProductId ? [{ pos_product_id: posProductId, quantity }] : [];
    }));
    rounds.push({ minute: minute + 1, importedLines: roundLineCount, decisions });
    for (const decision of decisions) {
      const product = products.find(item => item.id === decision.productId);
      if (product) product.current_price_minor = decision.newPriceMinor;
    }
    roundSales.clear();
    roundLineCount = 0;
  }

  return { sales, rounds };
}

// Defra Family Food FYE 2024, UK alcohol purchased outside the home. Cider is
// included with Beer because that is how this venue's catalogue is organised.
// Wine is sold by the bottle here, so spend share is converted to order share
// using the average menu price for each live category.
const UK_PUB_SPEND_WEIGHTS: Record<string, number> = {
  beer: 0.80,
  wine: 0.103,
  cocktails: 0.045,
  spirits: 0.04,
};

export function pubCategoryOrderShares<T extends Pick<InstantSimulationProduct, "category" | "base_price_minor">>(products: T[]) {
  const groups = groupByCategory(products);
  const demandWeights = [...groups.entries()].map(([category, categoryProducts]) => {
    const averagePriceMinor = categoryProducts.reduce((total, product) => total + Math.max(1, product.base_price_minor), 0) / categoryProducts.length;
    const spendWeight = UK_PUB_SPEND_WEIGHTS[category.toLowerCase()] ?? 0.02;
    return { category, share: spendWeight / averagePriceMinor };
  });
  const total = demandWeights.reduce((sum, item) => sum + item.share, 0);
  return demandWeights.map(item => ({ ...item, share: total ? item.share / total : 0 }));
}

export function selectPubOrderProduct<T extends Pick<InstantSimulationProduct, "category" | "base_price_minor">>(products: T[], minute: number, sequence: number): T {
  const groups = groupByCategory(products);
  const shares = pubCategoryOrderShares(products);
  const draw = deterministicDraw(minute, sequence);
  let cumulative = 0;
  let selectedCategory = shares.at(-1)?.category ?? products[0].category;
  for (const item of shares) {
    cumulative += item.share;
    if (draw < cumulative) {
      selectedCategory = item.category;
      break;
    }
  }
  const categoryProducts = groups.get(selectedCategory) ?? products;
  return categoryProducts[(minute * 13 + sequence * 7) % categoryProducts.length];
}

function groupByCategory<T extends Pick<InstantSimulationProduct, "category" | "base_price_minor">>(products: T[]) {
  const groups = new Map<string, T[]>();
  for (const product of products) groups.set(product.category, [...(groups.get(product.category) ?? []), product]);
  return groups;
}

function deterministicDraw(minute: number, sequence: number) {
  let value = Math.imul(minute + 1, 0x9e3779b1) ^ Math.imul(sequence + 1, 0x85ebca6b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}
