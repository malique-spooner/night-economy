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
  let roundLineCount = 0;

  for (let minute = 0; minute < serviceMinutes; minute += 1) {
    const revenueMultiplier = Math.max(0.2, targetRevenueMinor / 1_500_000);
    const orders = Math.max(1, Math.round((2 + 8 * Math.sin((minute / serviceMinutes) * Math.PI)) * revenueMultiplier));
    for (let sequence = 0; sequence < orders; sequence += 1) {
      const product = active[(minute * 17 + sequence * 7) % active.length];
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
