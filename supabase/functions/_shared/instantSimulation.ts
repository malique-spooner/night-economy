import { applyCategoryCrash, momentumFromDecisions, priceMarket, selectAdaptiveMarketSales, type MarketMomentum, type MarketPriceDecision, type MarketPricingOptions, type PriceableMarketProduct } from "./marketPricing.ts";
import { activeMarketCrash, type MarketCrashSettings } from "./marketCrash.ts";
import { simulateDemandMinute } from "./customerDemand.ts";

export { expectedBaseOrderValue, pubCategoryOrderShares, selectPubOrderProduct, simulateDemandMinute } from "./customerDemand.ts";
export type { DemandHistorySale, DemandMinuteOptions, SimulatedBasketLine } from "./customerDemand.ts";

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
  demand_weight?: number;
};

export type InstantSimulationSale = {
  minute: number;
  sequence: number;
  basketId: string;
  posProductId: string;
  quantity: number;
  unitPriceMinor: number;
};

export type InstantSimulationRound = {
  minute: number;
  importedLines: number;
  decisions: MarketPriceDecision[];
  momentum: MarketMomentum;
  crash?: { category: string; startMinute: number; endMinute: number };
};

export type CustomerSimulationOptions = {
  seed?: string | number;
  priceElasticity?: number;
  pricing?: MarketPricingOptions;
};

export type PriceSensitiveSimulationOptions = CustomerSimulationOptions;

const REFERENCE_SERVICE_MINUTES = 360;

// Expected Friday trade by hour. Minute-level customer arrivals remain
// stochastic, so this shapes footfall without forcing exact revenue.
export const LONDON_FRIDAY_HOURLY_ORDER_SHARES = [0.16, 0.19, 0.19, 0.18, 0.17, 0.11] as const;

export function buildLondonFridayRevenuePlan(targetRevenueMinor: number, serviceMinutes = REFERENCE_SERVICE_MINUTES): number[] {
  if (serviceMinutes <= 0) return [];
  const targetRevenue = Math.max(0, Math.round(targetRevenueMinor));
  const minuteShares = Array.from({ length: serviceMinutes }, () => 0);

  for (let hour = 0; hour < LONDON_FRIDAY_HOURLY_ORDER_SHARES.length; hour += 1) {
    const start = Math.floor((hour * serviceMinutes) / LONDON_FRIDAY_HOURLY_ORDER_SHARES.length);
    const end = Math.floor(((hour + 1) * serviceMinutes) / LONDON_FRIDAY_HOURLY_ORDER_SHARES.length);
    const pulses = Array.from({ length: end - start }, (_, offset) => {
      const minute = start + offset;
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

export function buildInstantSimulation(
  sourceProducts: InstantSimulationProduct[],
  expectedRevenueMinor: number,
  serviceMinutes = REFERENCE_SERVICE_MINUTES,
  crashSettings?: MarketCrashSettings,
  options: CustomerSimulationOptions = {},
): { sales: InstantSimulationSale[]; rounds: InstantSimulationRound[] } {
  return buildCustomerSimulation(sourceProducts, expectedRevenueMinor, serviceMinutes, crashSettings, options);
}

/** Backwards-compatible experiment entry point; production now uses the same customer engine. */
export function buildPriceSensitiveSimulation(
  sourceProducts: InstantSimulationProduct[],
  expectedRevenueMinor: number,
  serviceMinutes = REFERENCE_SERVICE_MINUTES,
  crashSettings?: MarketCrashSettings,
  options: PriceSensitiveSimulationOptions = {},
): { sales: InstantSimulationSale[]; rounds: InstantSimulationRound[] } {
  return buildCustomerSimulation(sourceProducts, expectedRevenueMinor, serviceMinutes, crashSettings, options);
}

function buildCustomerSimulation(
  sourceProducts: InstantSimulationProduct[],
  expectedRevenueMinor: number,
  serviceMinutes: number,
  crashSettings: MarketCrashSettings | undefined,
  options: CustomerSimulationOptions,
) {
  const products = sourceProducts.map(product => ({ ...product }));
  const active = products.filter(product => product.is_live && !product.is_sold_out && product.pos_product_id);
  if (!active.length || serviceMinutes <= 0) return { sales: [], rounds: [] };

  const sales: InstantSimulationSale[] = [];
  const rounds: InstantSimulationRound[] = [];
  const revenuePlan = buildLondonFridayRevenuePlan(expectedRevenueMinor, serviceMinutes);
  const seed = options.seed ?? "night-economy-default";
  let roundLineCount = 0;
  let momentum: MarketMomentum = {};

  for (let minute = 0; minute < serviceMinutes; minute += 1) {
    const minuteSales = simulateDemandMinute(active, revenuePlan[minute], minute, sales, {
      seed,
      serviceMinutes,
      priceElasticity: options.priceElasticity,
    });
    sales.push(...minuteSales);
    roundLineCount += minuteSales.length;

    if ((minute + 1) % 5 !== 0) continue;
    const adaptiveSales = simulationAdaptiveSales(products, sales, minute + 1);
    const normalDecisions = priceMarket(products, adaptiveSales.signalSales, momentum, options.pricing, adaptiveSales.freshSales);
    const crash = crashSettings ? activeMarketCrash(minute + 1, crashSettings, serviceMinutes) : null;
    const decisions = crash
      ? applyCategoryCrash(normalDecisions, products, crash.category, minute + 1 === crash.startMinute)
      : normalDecisions;
    momentum = momentumFromDecisions(decisions);
    rounds.push({ minute: minute + 1, importedLines: roundLineCount, decisions, momentum, ...(crash ? { crash } : {}) });
    for (const decision of decisions) {
      const product = products.find(item => item.id === decision.productId);
      if (product) product.current_price_minor = decision.newPriceMinor;
    }
    roundLineCount = 0;
  }

  return { sales, rounds };
}

function simulationAdaptiveSales(products: InstantSimulationProduct[], sales: InstantSimulationSale[], roundEndMinute: number) {
  return selectAdaptiveMarketSales(products as PriceableMarketProduct[], sales
    .filter(sale => roundEndMinute - sale.minute <= 30)
    .map(sale => ({ pos_product_id: sale.posProductId, quantity: sale.quantity, minutesAgo: roundEndMinute - sale.minute })));
}
