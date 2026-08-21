const MOMENTUM_RETENTION = 0.75;
const SALES_SIGNAL_WEIGHT = 0.45;
const TARGET_RANGE_UTILISATION = 0.75;
const TARGET_APPROACH_RATE = 0.7;
const MAX_ROUND_MOVE_PERCENT = 0.05;
const SALES_SIGNAL_CURVE_EXPONENT = 0.5;
const SALES_CONFIDENCE_SALES = 8;
const MIN_CATEGORY_UNITS_FOR_PEER_REPRICING = 3;
const UNTRADED_PEER_SIGNAL_WEIGHT = 0.25;

export function selectAdaptiveMarketSales(products, sales) {
  const active = products.filter(product => isLive(product) && !isSoldOut(product) && posId(product));
  const categoryByPosId = new Map(active.map(product => [posId(product), product.category]));
  const categories = [...new Set(active.map(product => product.category))];
  const categoryWindows = Object.fromEntries(categories.map(category => {
    const categorySales = sales.filter(sale => categoryByPosId.get(sale.pos_product_id) === category && sale.quantity > 0);
    const fiveMinuteUnits = categorySales.reduce((total, sale) => total + (sale.minutesAgo <= 5 ? sale.quantity : 0), 0);
    const fifteenMinuteUnits = categorySales.reduce((total, sale) => total + (sale.minutesAgo <= 15 ? sale.quantity : 0), 0);
    return [category, fiveMinuteUnits >= SALES_CONFIDENCE_SALES ? 5 : fifteenMinuteUnits >= SALES_CONFIDENCE_SALES ? 15 : 30];
  }));
  return {
    signalSales: aggregateSales(sales.filter(sale => {
      const category = categoryByPosId.get(sale.pos_product_id);
      return category !== undefined && sale.minutesAgo <= categoryWindows[category];
    })),
    freshSales: aggregateSales(sales.filter(sale => sale.minutesAgo <= 5 && categoryByPosId.has(sale.pos_product_id))),
    categoryWindows,
  };
}

export function priceMarket(products, sales, previousMomentum = {}, options = {}, freshSales = sales) {
  const controls = {
    momentumRetention: options.momentumRetention ?? MOMENTUM_RETENTION,
    salesSignalWeight: options.salesSignalWeight ?? SALES_SIGNAL_WEIGHT,
    targetRangeUtilisation: options.targetRangeUtilisation ?? TARGET_RANGE_UTILISATION,
    targetApproachRate: options.targetApproachRate ?? TARGET_APPROACH_RATE,
    maxRoundMovePercent: options.maxRoundMovePercent ?? MAX_ROUND_MOVE_PERCENT,
  };
  const active = products.filter(product => isLive(product) && !isSoldOut(product));
  const byCategory = new Map();
  const sold = new Map();
  const freshlySold = new Map();
  for (const product of active) byCategory.set(product.category, [...(byCategory.get(product.category) ?? []), product]);
  for (const sale of sales) if (sale.quantity > 0) sold.set(sale.pos_product_id, (sold.get(sale.pos_product_id) ?? 0) + sale.quantity);
  for (const sale of freshSales) if (sale.quantity > 0) freshlySold.set(sale.pos_product_id, (freshlySold.get(sale.pos_product_id) ?? 0) + sale.quantity);
  return products.map(product => priceProduct(product, byCategory.get(product.category) ?? [], sold, freshlySold, previousMomentum[product.id], controls));
}

function priceProduct(product, peers, sold, freshlySold, previous, controls) {
  const currentPriceMinor = currentPrice(product);
  if (!isLive(product) || isSoldOut(product) || peers.length < 2) return decision(product, currentPriceMinor, "hold", "Product is not currently competing in a live category.", 0, currentPriceMinor);
  const posId = item => item.posProductId ?? item.pos_product_id;
  const categoryUnits = peers.reduce((sum, peer) => sum + (sold.get(posId(peer)) ?? 0), 0);
  const ownUnits = sold.get(posId(product)) ?? 0;
  const freshCategoryUnits = peers.reduce((sum, peer) => sum + (freshlySold.get(posId(peer)) ?? 0), 0);
  const marketPoints = categoryUnits ? peers.length * ownUnits - categoryUnits : 0;
  const pointsPerSale = categoryUnits ? marketPoints / categoryUnits : 0;
  const relativeShare = pointsPerSale >= 0 ? pointsPerSale / Math.max(1, peers.length - 1) : pointsPerSale;
  const expandedSignal = Math.sign(relativeShare) * Math.pow(Math.abs(relativeShare), SALES_SIGNAL_CURVE_EXPONENT);
  const confidence = 1 - Math.exp(-categoryUnits / SALES_CONFIDENCE_SALES);
  const peerRepricingAllowed = categoryUnits >= MIN_CATEGORY_UNITS_FOR_PEER_REPRICING;
  const rawSalesScore = expandedSignal * confidence;
  const salesScore = ownUnits > 0 ? rawSalesScore : peerRepricingAllowed ? rawSalesScore * UNTRADED_PEER_SIGNAL_WEIGHT : 0;
  const startingMomentum = previous ?? momentumForCurrentPrice(product);
  const momentum = freshCategoryUnits > 0 && (ownUnits > 0 || peerRepricingAllowed)
    ? clamp(startingMomentum * controls.momentumRetention + salesScore * controls.salesSignalWeight, -1, 1)
    : startingMomentum * controls.momentumRetention;
  const target = momentum >= 0
    ? Math.round(basePrice(product) + (ceilingPrice(product) - basePrice(product)) * controls.targetRangeUtilisation * momentum)
    : Math.round(basePrice(product) + (basePrice(product) - floorPrice(product)) * controls.targetRangeUtilisation * momentum);
  const desiredChange = Math.round((target - currentPriceMinor) * controls.targetApproachRate);
  const maxMove = Math.max(1, Math.round(currentPriceMinor * controls.maxRoundMovePercent));
  const next = clamp(currentPriceMinor + clamp(desiredChange, -maxMove, maxMove), floorPrice(product), ceilingPrice(product));
  const movement = next > currentPriceMinor ? "up" : next < currentPriceMinor ? "down" : "hold";
  return decision(product, next, movement, movement === "hold" ? "Momentum is neutral, so the price held." : `Category sales built ${momentum > 0 ? "upward" : "downward"} momentum toward a buffered market target.`, momentum, target);
}

function decision(product, newPriceMinor, movement, reason, momentum, targetPriceMinor) { return { productId: product.id, oldPriceMinor: currentPrice(product), newPriceMinor, movement, reason, momentum, targetPriceMinor }; }
function posId(product) { return product.posProductId ?? product.pos_product_id; }
function isLive(product) { return product.isLive ?? product.is_live; }
function isSoldOut(product) { return product.isSoldOut ?? product.is_sold_out; }
function currentPrice(product) { return product.currentPriceMinor ?? product.current_price_minor; }
function basePrice(product) { return product.basePriceMinor ?? product.base_price_minor ?? currentPrice(product); }
function floorPrice(product) { return product.floorPriceMinor ?? product.floor_price_minor; }
function ceilingPrice(product) { return product.ceilingPriceMinor ?? product.ceiling_price_minor; }
function momentumForCurrentPrice(product) {
  const current = currentPrice(product);
  const base = basePrice(product);
  if (current >= base) return clamp((current - base) / Math.max(1, (ceilingPrice(product) - base) * TARGET_RANGE_UTILISATION), 0, 1);
  return clamp((current - base) / Math.max(1, (base - floorPrice(product)) * TARGET_RANGE_UTILISATION), -1, 0);
}
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function aggregateSales(sales) {
  const quantities = new Map();
  for (const sale of sales) if (sale.quantity > 0) quantities.set(sale.pos_product_id, (quantities.get(sale.pos_product_id) ?? 0) + sale.quantity);
  return [...quantities].map(([pos_product_id, quantity]) => ({ pos_product_id, quantity }));
}
