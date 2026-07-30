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

export type InstantPriceDecision = {
  productId: string;
  oldPriceMinor: number;
  newPriceMinor: number;
  movement: "up" | "down" | "hold";
  reason: string;
};

export type InstantSimulationRound = {
  minute: number;
  importedLines: number;
  decisions: InstantPriceDecision[];
};

const MARKET_INTENSITY = 1.25;
const REFERENCE_SERVICE_MINUTES = 360;
const REFERENCE_NIGHT_ORDERS = 2_560;

// London Friday prior for 18:00–00:00. Public evidence does not expose
// product-level till data by hour, so these shares combine the GLA's 3-hour
// night-time pattern with CGA/Zonal's stronger 18:00–20:00 trading window.
// Keep this as a prior until a venue has enough of its own Friday POS history.
export const LONDON_FRIDAY_HOURLY_ORDER_SHARES = [0.16, 0.19, 0.19, 0.18, 0.17, 0.11] as const;

export function buildLondonFridayOrderPlan(
  targetRevenueMinor: number,
  serviceMinutes = REFERENCE_SERVICE_MINUTES,
): number[] {
  if (serviceMinutes <= 0) return [];
  const revenueMultiplier = Math.max(0.2, targetRevenueMinor / 1_500_000);
  const targetOrders = Math.max(1, Math.round(REFERENCE_NIGHT_ORDERS * (serviceMinutes / REFERENCE_SERVICE_MINUTES) * revenueMultiplier));
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
    const cumulativeOrders = minute === serviceMinutes - 1 ? targetOrders : Math.round(cumulativeShare * targetOrders);
    const orders = cumulativeOrders - allocated;
    allocated = cumulativeOrders;
    return orders;
  });
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
  const orderPlan = buildLondonFridayOrderPlan(targetRevenueMinor, serviceMinutes);
  let roundLineCount = 0;

  for (let minute = 0; minute < serviceMinutes; minute += 1) {
    const orders = orderPlan[minute];
    for (let sequence = 0; sequence < orders; sequence += 1) {
      const product = selectPubOrderProduct(active, minute, sequence);
      sales.push({ minute, sequence, posProductId: product.pos_product_id!, quantity: 1, unitPriceMinor: product.current_price_minor });
      roundSales.set(product.id, (roundSales.get(product.id) ?? 0) + 1);
      roundLineCount += 1;
    }

    if ((minute + 1) % 5 !== 0) continue;
    const decisions = priceMarket(products, roundSales);
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

function priceMarket(products: InstantSimulationProduct[], sold: Map<string, number>): InstantPriceDecision[] {
  const active = products.filter(product => product.is_live && !product.is_sold_out);
  const groups = new Map<string, InstantSimulationProduct[]>();
  for (const product of active) groups.set(product.category, [...(groups.get(product.category) ?? []), product]);

  return products.map(product => {
    if (!product.is_live || product.is_sold_out) return hold(product, "Product is not currently tradable.");
    const peers = groups.get(product.category) ?? [product];
    if (peers.length === 1) return hold(product, "This is the only live product in its category, so the price held.");
    const categoryUnits = peers.reduce((total, peer) => total + (sold.get(peer.id) ?? 0), 0);
    if (!categoryUnits) return hold(product, "No orders were recorded in this category, so the price held.");
    const ownUnits = sold.get(product.id) ?? 0;
    const marketPoints = peers.length * ownUnits - categoryUnits;
    const marketSignal = marketPoints / (peers.length * categoryUnits);
    const activityFactor = categoryUnits / (categoryUnits + peers.length);
    const allowedRange = (product.ceiling_price_minor - product.floor_price_minor) / Math.max(1, product.base_price_minor);
    const percentageChange = MARKET_INTENSITY * allowedRange * activityFactor * marketSignal;
    const newPriceMinor = Math.max(product.floor_price_minor, Math.min(product.ceiling_price_minor, Math.round(product.current_price_minor * (1 + percentageChange))));
    const movement = newPriceMinor > product.current_price_minor ? "up" : newPriceMinor < product.current_price_minor ? "down" : "hold";
    return {
      productId: product.id,
      oldPriceMinor: product.current_price_minor,
      newPriceMinor,
      movement,
      reason: movement === "hold" ? "Orders were evenly balanced within this category, so the price held." : `This drink ${movement === "up" ? "gained" : "lost"} market points against its category peers.`,
    };
  });
}

function hold(product: InstantSimulationProduct, reason: string): InstantPriceDecision {
  return { productId: product.id, oldPriceMinor: product.current_price_minor, newPriceMinor: product.current_price_minor, movement: "hold", reason };
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
