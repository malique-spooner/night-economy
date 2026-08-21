/**
 * Seeded customer-and-basket demand for venue rehearsals.
 *
 * Revenue is an expectation used to size footfall, never a forced outcome.
 * Each group chooses a basket from time-of-night category preference, stable
 * product popularity, smooth run-specific trends, recent social proof and the
 * live price relative to base. The same seed is reproducible; each run ID gives
 * a different night.
 */

export type DemandProduct = {
  id: string;
  pos_product_id: string | null;
  category: string;
  base_price_minor: number;
  current_price_minor: number;
  is_live: boolean;
  is_sold_out: boolean;
  demand_weight?: number;
};

export type DemandHistorySale = {
  minute: number;
  posProductId: string;
  quantity: number;
};

export type SimulatedBasketLine = DemandHistorySale & {
  sequence: number;
  basketId: string;
  unitPriceMinor: number;
};

export type DemandMinuteOptions = {
  seed: string | number;
  serviceMinutes?: number;
  eventMultiplier?: number;
  priceElasticity?: number;
};

export const PUB_CATEGORY_UNIT_SHARES: Record<string, number> = {
  beer: 0.45,
  wine: 0.18,
  cocktails: 0.16,
  spirits: 0.13,
  "other drinks": 0.08,
};

const EXPECTED_BASKET_UNITS = 2.55;
const GROUP_SIZE_WEIGHTS = [
  { size: 1, weight: 0.14 },
  { size: 2, weight: 0.38 },
  { size: 3, weight: 0.21 },
  { size: 4, weight: 0.16 },
  { size: 5, weight: 0.07 },
  { size: 6, weight: 0.04 },
] as const;

export function pubCategoryOrderShares<T extends Pick<DemandProduct, "category">>(products: T[]) {
  const categories = [...new Set(products.map(product => product.category))];
  const weights = categories.map(category => ({ category, share: PUB_CATEGORY_UNIT_SHARES[category.toLowerCase()] ?? 0.08 }));
  const total = weights.reduce((sum, item) => sum + item.share, 0);
  return weights.map(item => ({ ...item, share: total ? item.share / total : 0 }));
}

/**
 * Deterministic single-item sampler used by demand-mix checks and lightweight
 * previews. Full services use simulateDemandMinute so basket and price effects
 * are considered together.
 */
export function selectPubOrderProduct<T extends Pick<DemandProduct, "id" | "category">>(products: T[], minute: number, sequence: number): T {
  if (!products.length) throw new Error("Cannot select a drink from an empty catalogue");
  const random = seededRandom(hashString(`pub-order:${minute}:${sequence}`));
  const category = weightedChoice(pubCategoryOrderShares(products), item => item.share, random)?.category ?? products[0].category;
  const choices = products.filter(product => product.category === category);
  return weightedChoice(choices.length ? choices : products, product => stablePopularity(product.id), random) ?? products[0];
}

export function expectedBaseOrderValue<T extends Pick<DemandProduct, "category" | "base_price_minor" | "demand_weight" | "id">>(products: T[]) {
  const groups = groupByCategory(products);
  return Math.max(1, pubCategoryOrderShares(products).reduce((total, item) => {
    const categoryProducts = groups.get(item.category) ?? [];
    const average = weightedAverage(categoryProducts, product => Math.max(1, product.base_price_minor), product => product.demand_weight ?? stablePopularity(product.id));
    return total + item.share * average;
  }, 0));
}

export function simulateDemandMinute(
  sourceProducts: DemandProduct[],
  targetRevenueMinor: number,
  minute: number,
  history: DemandHistorySale[],
  options: DemandMinuteOptions,
): SimulatedBasketLine[] {
  const products = sourceProducts.filter(product => product.is_live && !product.is_sold_out && product.pos_product_id);
  if (!products.length || targetRevenueMinor <= 0) return [];

  const serviceMinutes = options.serviceMinutes ?? 360;
  const random = seededRandom(hashString(`${options.seed}:${minute}`));
  const expectedUnits = targetRevenueMinor / expectedBaseOrderValue(products);
  const expectedGroups = expectedUnits / EXPECTED_BASKET_UNITS * Math.max(0, options.eventMultiplier ?? 1);
  const groupCount = samplePoisson(expectedGroups, random);
  const recentUnits = recentUnitsByProduct(history, minute);
  const boardPriceRatio = weightedAverage(products, product => product.current_price_minor / Math.max(1, product.base_price_minor), product => stablePopularity(product.id));
  const purchaseProbability = clamp(Math.exp(-(options.priceElasticity ?? 2.4) * (boardPriceRatio - 1)), 0.5, 1);
  const lines: SimulatedBasketLine[] = [];

  for (let group = 0; group < groupCount; group += 1) {
    if (random() > purchaseProbability) continue;
    const basketSize = weightedChoice(GROUP_SIZE_WEIGHTS, item => item.weight, random)?.size ?? 2;
    const anchorCategory = chooseCategory(products, minute, serviceMinutes, random, options.priceElasticity ?? 2.4);
    const quantities = new Map<string, { product: DemandProduct; quantity: number }>();
    for (let unit = 0; unit < basketSize; unit += 1) {
      const category = unit === 0 || random() < 0.72
        ? anchorCategory
        : chooseCategory(products, minute, serviceMinutes, random, options.priceElasticity ?? 2.4);
      const product = chooseProduct(products, category, minute, options.seed, recentUnits, random, options.priceElasticity ?? 2.4);
      if (!product?.pos_product_id) continue;
      const current = quantities.get(product.pos_product_id) ?? { product, quantity: 0 };
      current.quantity += 1;
      quantities.set(product.pos_product_id, current);
      recentUnits.set(product.pos_product_id, (recentUnits.get(product.pos_product_id) ?? 0) + 1);
    }
    for (const [posProductId, item] of quantities) {
      lines.push({
        minute,
        sequence: lines.length,
        basketId: `${String(options.seed)}:${minute}:${group}`,
        posProductId,
        quantity: item.quantity,
        unitPriceMinor: item.product.current_price_minor,
      });
    }
  }
  return lines;
}

function chooseCategory(products: DemandProduct[], minute: number, serviceMinutes: number, random: () => number, elasticity: number) {
  const progress = clamp(minute / Math.max(1, serviceMinutes - 1), 0, 1);
  const categories = pubCategoryOrderShares(products).map(item => ({
    category: item.category,
    weight: item.share
      * timeOfNightMultiplier(item.category, progress)
      * Math.exp(-elasticity * 0.45 * (categoryPriceRatio(products, item.category) - 1)),
  }));
  return weightedChoice(categories, item => item.weight, random)?.category ?? products[0].category;
}

function categoryPriceRatio(products: DemandProduct[], category: string) {
  const categoryProducts = products.filter(product => product.category === category);
  return weightedAverage(categoryProducts, product => product.current_price_minor / Math.max(1, product.base_price_minor), product => stablePopularity(product.id));
}

function timeOfNightMultiplier(category: string, progress: number) {
  const key = category.toLowerCase();
  if (key === "beer") return lerp(1.12, 0.92, progress);
  if (key === "wine") return lerp(1.14, 0.82, progress);
  if (key === "cocktails") return 0.86 + 0.32 * Math.sin(Math.PI * progress);
  if (key === "spirits") return lerp(0.82, 1.25, progress);
  return 1;
}

function chooseProduct(
  products: DemandProduct[],
  category: string,
  minute: number,
  seed: string | number,
  recentUnits: Map<string, number>,
  random: () => number,
  elasticity: number,
) {
  const choices = products.filter(product => product.category === category);
  const pool = choices.length ? choices : products;
  return weightedChoice(pool, product => {
    const popularity = product.demand_weight ?? stablePopularity(product.id);
    const priceResponse = Math.exp(-elasticity * (product.current_price_minor / Math.max(1, product.base_price_minor) - 1));
    const socialProof = 1 + Math.min(0.55, (recentUnits.get(product.pos_product_id ?? "") ?? 0) * 0.055);
    const trend = smoothTrend(product.id, seed, minute);
    return popularity * priceResponse * socialProof * trend;
  }, random);
}

function smoothTrend(productId: string, seed: string | number, minute: number) {
  const first = hashFraction(`${seed}:${productId}:trend-a`);
  const second = hashFraction(`${seed}:${productId}:trend-b`);
  const firstPeriod = 80 + first * 100;
  const secondPeriod = 45 + second * 70;
  const wave = 0.34 * Math.sin((minute / firstPeriod + first) * Math.PI * 2)
    + 0.13 * Math.sin((minute / secondPeriod + second) * Math.PI * 2);
  return Math.exp(wave);
}

function stablePopularity(productId: string) {
  return 0.65 + hashFraction(`popularity:${productId}`) * 1.1;
}

function recentUnitsByProduct(history: DemandHistorySale[], minute: number) {
  const units = new Map<string, number>();
  for (const sale of history) {
    if (minute - sale.minute > 30 || sale.minute > minute) continue;
    units.set(sale.posProductId, (units.get(sale.posProductId) ?? 0) + sale.quantity);
  }
  return units;
}

function groupByCategory<T extends Pick<DemandProduct, "category">>(products: T[]) {
  const groups = new Map<string, T[]>();
  for (const product of products) groups.set(product.category, [...(groups.get(product.category) ?? []), product]);
  return groups;
}

function weightedChoice<T>(items: readonly T[], weightOf: (item: T) => number, random: () => number): T | undefined {
  const total = items.reduce((sum: number, item) => sum + Math.max(0, weightOf(item)), 0);
  if (!total) return items[0];
  let point = random() * total;
  for (const item of items) {
    point -= Math.max(0, weightOf(item));
    if (point <= 0) return item;
  }
  return items.at(-1);
}

function weightedAverage<T>(items: T[], value: (item: T) => number, weight: (item: T) => number) {
  const totalWeight = items.reduce((total, item) => total + Math.max(0, weight(item)), 0);
  return totalWeight ? items.reduce((total, item) => total + value(item) * Math.max(0, weight(item)), 0) / totalWeight : 0;
}

function samplePoisson(mean: number, random: () => number) {
  if (mean <= 0) return 0;
  const threshold = Math.exp(-mean);
  let probability = 1;
  let count = 0;
  do { count += 1; probability *= random(); } while (probability > threshold);
  return count - 1;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashFraction(value: string) { return hashString(value) / 4_294_967_296; }
function lerp(start: number, end: number, progress: number) { return start + (end - start) * progress; }
function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, value)); }
