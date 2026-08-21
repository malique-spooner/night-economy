/**
 * Category pricing with persistent, zero-sum demand momentum.
 *
 * Each sale still awards positive points to the selected drink and equal
 * negative points to its peers. We retain a proportion of that relative signal
 * between rounds so a genuine winner or loser can travel through its permitted
 * range instead of resetting back to base after every five minutes.
 */

export type PriceableMarketProduct = {
  id: string;
  pos_product_id: string | null;
  base_price_minor: number;
  current_price_minor: number;
  floor_price_minor: number;
  ceiling_price_minor: number;
  category: string;
  is_live: boolean;
  is_sold_out: boolean;
};

export type MarketPricingSale = { pos_product_id: string; quantity: number };
export type TimedMarketPricingSale = MarketPricingSale & { minutesAgo: number };
export type MarketMomentum = Record<string, number>;
export type AdaptiveMarketWindow = 5 | 15 | 30;

export type AdaptiveMarketSales = {
  signalSales: MarketPricingSale[];
  freshSales: MarketPricingSale[];
  categoryWindows: Record<string, AdaptiveMarketWindow>;
};

/** Tunable controls used by the pricing engine and revenue experiment. */
export type MarketPricingOptions = Partial<{
  momentumRetention: number;
  salesSignalWeight: number;
  targetRangeUtilisation: number;
  targetApproachRate: number;
  maxRoundMovePercent: number;
}>;

export type MarketPriceDecision = {
  productId: string;
  oldPriceMinor: number;
  newPriceMinor: number;
  movement: "up" | "down" | "hold";
  reason: string;
  momentum: number;
  targetPriceMinor: number;
};

export const MOMENTUM_RETENTION = 0.75;
export const SALES_SIGNAL_WEIGHT = 0.45;
export const TARGET_RANGE_UTILISATION = 0.75;
export const TARGET_APPROACH_RATE = 0.7;
export const MAX_ROUND_MOVE_PERCENT = 0.05;
export const CRASH_RANGE_UTILISATION = 0.75;
/** Makes a clear leader matter without amplifying a one-off sale. */
export const SALES_SIGNAL_CURVE_EXPONENT = 0.5;
/** Category sales required before the sales signal has most of its strength. */
export const SALES_CONFIDENCE_SALES = 8;
/** Avoids treating one or two isolated orders as a verdict on every peer. */
export const MIN_CATEGORY_UNITS_FOR_PEER_REPRICING = 3;
/** Untraded peers respond, but much less strongly than drinks with sales. */
export const UNTRADED_PEER_SIGNAL_WEIGHT = 0.25;

/**
 * Selects the shortest evidence window containing a confident category sample.
 * Older sales supply context only; freshSales remains the newest five minutes
 * so historic orders cannot be counted again as new demand every round.
 */
export function selectAdaptiveMarketSales(
  products: PriceableMarketProduct[],
  sales: TimedMarketPricingSale[],
): AdaptiveMarketSales {
  const active = products.filter(product => product.is_live && !product.is_sold_out && product.pos_product_id);
  const categoryByPosId = new Map(active.map(product => [product.pos_product_id!, product.category]));
  const categories = [...new Set(active.map(product => product.category))];
  const categoryWindows = Object.fromEntries(categories.map(category => {
    const categorySales = sales.filter(sale => categoryByPosId.get(sale.pos_product_id) === category && sale.quantity > 0);
    const fiveMinuteUnits = categorySales.reduce((total, sale) => total + (sale.minutesAgo <= 5 ? sale.quantity : 0), 0);
    const fifteenMinuteUnits = categorySales.reduce((total, sale) => total + (sale.minutesAgo <= 15 ? sale.quantity : 0), 0);
    const window: AdaptiveMarketWindow = fiveMinuteUnits >= SALES_CONFIDENCE_SALES
      ? 5
      : fifteenMinuteUnits >= SALES_CONFIDENCE_SALES ? 15 : 30;
    return [category, window];
  })) as Record<string, AdaptiveMarketWindow>;

  return {
    signalSales: aggregateSales(sales.filter(sale => {
      const category = categoryByPosId.get(sale.pos_product_id);
      return category !== undefined && sale.minutesAgo <= categoryWindows[category];
    })),
    freshSales: aggregateSales(sales.filter(sale => sale.minutesAgo <= 5 && categoryByPosId.has(sale.pos_product_id))),
    categoryWindows,
  };
}

function pricingOptions(options: MarketPricingOptions = {}) {
  return {
    momentumRetention: options.momentumRetention ?? MOMENTUM_RETENTION,
    salesSignalWeight: options.salesSignalWeight ?? SALES_SIGNAL_WEIGHT,
    targetRangeUtilisation: options.targetRangeUtilisation ?? TARGET_RANGE_UTILISATION,
    targetApproachRate: options.targetApproachRate ?? TARGET_APPROACH_RATE,
    maxRoundMovePercent: options.maxRoundMovePercent ?? MAX_ROUND_MOVE_PERCENT,
  };
}

export function priceMarket(
  products: PriceableMarketProduct[],
  sales: MarketPricingSale[],
  previousMomentum: MarketMomentum = {},
  options: MarketPricingOptions = {},
  freshSales: MarketPricingSale[] = sales,
): MarketPriceDecision[] {
  const active = products.filter(product => product.is_live && !product.is_sold_out);
  const groups = new Map<string, PriceableMarketProduct[]>();
  const sold = new Map<string, number>();
  const freshlySold = new Map<string, number>();
  for (const product of active) groups.set(product.category, [...(groups.get(product.category) ?? []), product]);
  for (const sale of sales) if (sale.quantity > 0) sold.set(sale.pos_product_id, (sold.get(sale.pos_product_id) ?? 0) + sale.quantity);
  for (const sale of freshSales) if (sale.quantity > 0) freshlySold.set(sale.pos_product_id, (freshlySold.get(sale.pos_product_id) ?? 0) + sale.quantity);
  const controls = pricingOptions(options);
  return products.map(product => priceProduct(product, groups.get(product.category) ?? [], sold, freshlySold, previousMomentum[product.id], controls));
}

export function momentumFromDecisions(decisions: MarketPriceDecision[]): MarketMomentum {
  return Object.fromEntries(decisions.map(decision => [decision.productId, decision.momentum]));
}

/** A crash uses 75% of the manager's available downward range, never the floor itself. */
export function applyCategoryCrash(
  decisions: MarketPriceDecision[],
  products: PriceableMarketProduct[],
  category: string,
  startsThisRound: boolean,
): MarketPriceDecision[] {
  const byId = new Map(products.map(product => [product.id, product]));
  return decisions.map(decision => {
    const product = byId.get(decision.productId);
    if (!product || product.category !== category || !product.is_live || product.is_sold_out) return decision;
    const crashTarget = Math.round(product.base_price_minor - (product.base_price_minor - product.floor_price_minor) * CRASH_RANGE_UTILISATION);
    const newPriceMinor = startsThisRound ? Math.min(product.current_price_minor, crashTarget) : product.current_price_minor;
    return {
      ...decision,
      oldPriceMinor: product.current_price_minor,
      newPriceMinor,
      movement: newPriceMinor < product.current_price_minor ? "down" : "hold",
      reason: startsThisRound
        ? `Market crash: ${category} moved to 75% of its available downward range.`
        : `Market crash: ${category} remains at its crash price for this limited window.`,
    };
  });
}

function priceProduct(product: PriceableMarketProduct, peers: PriceableMarketProduct[], sold: Map<string, number>, freshlySold: Map<string, number>, previous: number | undefined, controls: ReturnType<typeof pricingOptions>): MarketPriceDecision {
  if (!product.is_live || product.is_sold_out || peers.length < 2) return hold(product, "Product is not currently competing in a live category.");
  const categoryUnits = peers.reduce((total, peer) => total + (peer.pos_product_id ? sold.get(peer.pos_product_id) ?? 0 : 0), 0);
  const ownUnits = product.pos_product_id ? sold.get(product.pos_product_id) ?? 0 : 0;
  const freshCategoryUnits = peers.reduce((total, peer) => total + (peer.pos_product_id ? freshlySold.get(peer.pos_product_id) ?? 0 : 0), 0);
  // One or two isolated orders cannot pull a whole category down. Once there
  // is a credible category sample, untraded peers receive a deliberately weak
  // lack-of-demand signal while traded drinks retain the full relative score.
  const peerRepricingAllowed = categoryUnits >= MIN_CATEGORY_UNITS_FOR_PEER_REPRICING;
  const rawSalesScore = categoryUnits ? relativeSalesScore(ownUnits, categoryUnits, peers.length) : 0;
  const salesScore = ownUnits > 0 ? rawSalesScore : peerRepricingAllowed ? rawSalesScore * UNTRADED_PEER_SIGNAL_WEIGHT : 0;
  const startingMomentum = previous ?? momentumForCurrentPrice(product);
  const momentum = freshCategoryUnits > 0 && (ownUnits > 0 || peerRepricingAllowed)
    ? clamp(startingMomentum * controls.momentumRetention + salesScore * controls.salesSignalWeight, -1, 1)
    : startingMomentum * controls.momentumRetention;
  const targetPriceMinor = momentum >= 0
    ? Math.round(product.base_price_minor + (product.ceiling_price_minor - product.base_price_minor) * controls.targetRangeUtilisation * momentum)
    : Math.round(product.base_price_minor + (product.base_price_minor - product.floor_price_minor) * controls.targetRangeUtilisation * momentum);
  const desiredChange = Math.round((targetPriceMinor - product.current_price_minor) * controls.targetApproachRate);
  const maxRoundMove = Math.max(1, Math.round(product.current_price_minor * controls.maxRoundMovePercent));
  const rawNextPrice = product.current_price_minor + clamp(desiredChange, -maxRoundMove, maxRoundMove);
  const newPriceMinor = clamp(rawNextPrice, product.floor_price_minor, product.ceiling_price_minor);
  const movement = newPriceMinor > product.current_price_minor ? "up" : newPriceMinor < product.current_price_minor ? "down" : "hold";
  return {
    productId: product.id,
    oldPriceMinor: product.current_price_minor,
    newPriceMinor,
    movement,
    momentum,
    targetPriceMinor,
    reason: movement === "hold"
      ? "Momentum is neutral, so the price held."
      : `Category sales built ${momentum > 0 ? "upward" : "downward"} momentum toward a buffered market target.`,
  };
}

/**
 * Keeps the zero-sum comparison, then expands meaningful category leadership.
 * For example, a sustained 20% share in a 12-drink market should not behave
 * like a 1% price twitch merely because equal share is 8.3%. The confidence
 * multiplier keeps a lone sale deliberately small.
 */
function relativeSalesScore(ownUnits: number, categoryUnits: number, peerCount: number) {
  const marketPoints = peerCount * ownUnits - categoryUnits;
  const pointsPerSale = marketPoints / categoryUnits;
  const relativeShare = pointsPerSale >= 0 ? pointsPerSale / Math.max(1, peerCount - 1) : pointsPerSale;
  const expandedSignal = Math.sign(relativeShare) * Math.pow(Math.abs(relativeShare), SALES_SIGNAL_CURVE_EXPONENT);
  const confidence = 1 - Math.exp(-categoryUnits / SALES_CONFIDENCE_SALES);
  return expandedSignal * confidence;
}

function hold(product: PriceableMarketProduct, reason: string): MarketPriceDecision {
  return { productId: product.id, oldPriceMinor: product.current_price_minor, newPriceMinor: product.current_price_minor, movement: "hold", reason, momentum: 0, targetPriceMinor: product.current_price_minor };
}

function momentumForCurrentPrice(product: PriceableMarketProduct) {
  if (product.current_price_minor >= product.base_price_minor) {
    return clamp((product.current_price_minor - product.base_price_minor) / Math.max(1, (product.ceiling_price_minor - product.base_price_minor) * TARGET_RANGE_UTILISATION), 0, 1);
  }
  return clamp((product.current_price_minor - product.base_price_minor) / Math.max(1, (product.base_price_minor - product.floor_price_minor) * TARGET_RANGE_UTILISATION), -1, 0);
}

function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, value)); }

function aggregateSales(sales: MarketPricingSale[]): MarketPricingSale[] {
  const quantities = new Map<string, number>();
  for (const sale of sales) if (sale.quantity > 0) quantities.set(sale.pos_product_id, (quantities.get(sale.pos_product_id) ?? 0) + sale.quantity);
  return [...quantities].map(([pos_product_id, quantity]) => ({ pos_product_id, quantity }));
}
