/**
 * Canonical zero-sum pricing engine used by every Supabase simulation path.
 *
 * Products compete only with live peers in the same category. Each sale gives
 * the purchased product positive market points and distributes an equal total
 * negative signal across its peers. The manager's floor and ceiling define the
 * maximum range; activity controls how strongly a five-minute round explores it.
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

export type MarketPricingSale = {
  pos_product_id: string;
  quantity: number;
};

export type MarketPriceDecision = {
  productId: string;
  oldPriceMinor: number;
  newPriceMinor: number;
  movement: "up" | "down" | "hold";
  reason: string;
};

const MARKET_INTENSITY = 1.25;

export function priceMarket(products: PriceableMarketProduct[], sales: MarketPricingSale[]): MarketPriceDecision[] {
  const active = products.filter(product => product.is_live && !product.is_sold_out);
  const groups = new Map<string, PriceableMarketProduct[]>();
  const sold = new Map<string, number>();

  for (const product of active) {
    groups.set(product.category, [...(groups.get(product.category) ?? []), product]);
  }
  for (const sale of sales) {
    if (sale.quantity > 0) sold.set(sale.pos_product_id, (sold.get(sale.pos_product_id) ?? 0) + sale.quantity);
  }

  return products.map(product => priceProduct(product, groups, sold));
}

function priceProduct(
  product: PriceableMarketProduct,
  groups: Map<string, PriceableMarketProduct[]>,
  sold: Map<string, number>,
): MarketPriceDecision {
  if (!product.is_live || product.is_sold_out) return hold(product, "Product is not currently tradable.");

  const peers = groups.get(product.category) ?? [product];
  if (peers.length === 1) return hold(product, "This is the only live product in its category, so the price held.");

  const categoryUnits = peers.reduce(
    (total, peer) => total + (peer.pos_product_id ? sold.get(peer.pos_product_id) ?? 0 : 0),
    0,
  );
  if (!categoryUnits) return hold(product, "No orders were recorded in this category, so the price held.");

  const ownUnits = product.pos_product_id ? sold.get(product.pos_product_id) ?? 0 : 0;
  const marketPoints = peers.length * ownUnits - categoryUnits;
  const marketSignal = marketPoints / (peers.length * categoryUnits);
  const activityFactor = categoryUnits / (categoryUnits + peers.length);
  const allowedRange = (product.ceiling_price_minor - product.floor_price_minor) / Math.max(1, product.base_price_minor);
  const percentageChange = MARKET_INTENSITY * allowedRange * activityFactor * marketSignal;
  const rawNextPrice = Math.round(product.current_price_minor * (1 + percentageChange));
  const newPriceMinor = Math.max(product.floor_price_minor, Math.min(product.ceiling_price_minor, rawNextPrice));
  const movement = newPriceMinor > product.current_price_minor ? "up" : newPriceMinor < product.current_price_minor ? "down" : "hold";

  return {
    productId: product.id,
    oldPriceMinor: product.current_price_minor,
    newPriceMinor,
    movement,
    reason: movement === "hold"
      ? "Orders were evenly balanced within this category, so the price held."
      : `This drink ${movement === "up" ? "gained" : "lost"} market points against its category peers.`,
  };
}

function hold(product: PriceableMarketProduct, reason: string): MarketPriceDecision {
  return {
    productId: product.id,
    oldPriceMinor: product.current_price_minor,
    newPriceMinor: product.current_price_minor,
    movement: "hold",
    reason,
  };
}
