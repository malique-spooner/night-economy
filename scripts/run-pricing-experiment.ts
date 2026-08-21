import { tljCatalogue } from "../pos-simulator/src/tljCatalogue.mjs";
import { buildPriceSensitiveSimulation, type InstantSimulationProduct } from "../supabase/functions/_shared/instantSimulation.ts";
import type { MarketPricingOptions } from "../supabase/functions/_shared/marketPricing.ts";

type Candidate = Required<Pick<MarketPricingOptions, "momentumRetention" | "salesSignalWeight" | "targetRangeUtilisation" | "targetApproachRate">> & { name: string };
type Result = Candidate & { averageRevenue: number; upliftPercent: number; averageOrders: number; averageAbsChangePercent: number; nearLimitRate: number; eligible: boolean };

const parsedRuns = Number(process.argv.find(argument => argument.startsWith("--runs="))?.split("=")[1] ?? 1_000);
const runs = Number.isInteger(parsedRuns) && parsedRuns > 0 ? parsedRuns : 1_000;
const parsedScreeningRuns = Number(process.argv.find(argument => argument.startsWith("--screen-runs="))?.split("=")[1] ?? 25);
const screeningRuns = Number.isInteger(parsedScreeningRuns) && parsedScreeningRuns > 0 ? parsedScreeningRuns : 25;
const referenceRevenueMinor = 1_000_000;
const serviceMinutes = 360;

const products: InstantSimulationProduct[] = tljCatalogue
  .filter((product: { initiallyLive: boolean }) => product.initiallyLive)
  .map((product: { id: string; category: string; basePriceMinor: number; demandWeight: number }) => ({
    id: product.id,
    category: product.category,
    base_price_minor: product.basePriceMinor,
    current_price_minor: product.basePriceMinor,
    floor_price_minor: Math.round(product.basePriceMinor * 0.8),
    ceiling_price_minor: Math.round(product.basePriceMinor * 1.2),
    pos_product_id: product.id,
    is_live: true,
    is_sold_out: false,
    demand_weight: product.demandWeight,
  }));

const candidates: Candidate[] = [0.6, 0.75, 0.85].flatMap(momentumRetention =>
  [0.25, 0.35, 0.45].flatMap(salesSignalWeight =>
    [0.65, 0.75, 0.85].flatMap(targetRangeUtilisation =>
      [0.4, 0.55, 0.7].map(targetApproachRate => ({
        name: `r${momentumRetention}-s${salesSignalWeight}-t${targetRangeUtilisation}-a${targetApproachRate}`,
        momentumRetention,
        salesSignalWeight,
        targetRangeUtilisation,
        targetApproachRate,
      })),
    ),
  ),
);

// Screening makes the broad 81-setting search practical. The best five then
// receive the full 1,000-service comparison, paired against the same seeded
// base-price nights so random busy/quiet services cannot decide the winner.
const screeningBaseline = baselineFor(screeningRuns);
const shortlisted = candidates
  .map(candidate => evaluate(candidate, screeningBaseline, screeningRuns))
  .filter(result => result.eligible)
  .sort((left, right) => right.averageRevenue - left.averageRevenue)
  .slice(0, 5);
const baselineRevenue = baselineFor(runs);
const results = shortlisted.map(candidate => evaluate(candidate, baselineRevenue, runs));
const winner = results.sort((left, right) => right.averageRevenue - left.averageRevenue)[0];

console.log(JSON.stringify({
  method: {
    screeningServicesPerCandidate: screeningRuns,
    finalistServicesPerCandidate: runs,
    screenedCandidates: candidates.length,
    finalists: shortlisted.length,
    totalServices: screeningRuns * (candidates.length + 1) + runs * (shortlisted.length + 1),
    referenceRevenueAtBase: pounds(average(baselineRevenue)),
    demand: "Price-sensitive choice model: customers substitute toward cheaper comparable drinks and some discretionary orders are lost as the overall board rises.",
    guardrail: "Candidates are ineligible when more than 5% of observed price decisions are within the final 10% of a manager-set floor or ceiling.",
  },
  winner: serialise(winner),
  topFive: results.sort((left, right) => right.averageRevenue - left.averageRevenue).slice(0, 5).map(serialise),
}, null, 2));

function baselineFor(runCount: number) {
  return Array.from({ length: runCount }, (_, index) => revenueFor({ targetRangeUtilisation: 0, targetApproachRate: 0 }, index + 1).revenue);
}

function evaluate(candidate: Candidate, baseline: number[], runCount: number): Result {
  let revenueTotal = 0;
  let ordersTotal = 0;
  let absoluteChangeTotal = 0;
  let decisionCount = 0;
  let nearLimitCount = 0;
  for (let index = 0; index < runCount; index += 1) {
    const outcome = revenueFor(candidate, index + 1);
    revenueTotal += outcome.revenue;
    ordersTotal += outcome.orders;
    absoluteChangeTotal += outcome.absoluteChangePercent;
    decisionCount += outcome.decisionCount;
    nearLimitCount += outcome.nearLimitCount;
  }
  const averageRevenue = revenueTotal / runCount;
  const nearLimitRate = nearLimitCount / Math.max(1, decisionCount);
  return {
    ...candidate,
    averageRevenue,
    upliftPercent: ((averageRevenue - average(baseline)) / average(baseline)) * 100,
    averageOrders: ordersTotal / runCount,
    averageAbsChangePercent: absoluteChangeTotal / Math.max(1, decisionCount),
    nearLimitRate,
    eligible: nearLimitRate <= 0.05,
  };
}

function revenueFor(pricing: MarketPricingOptions, seed: number) {
  const simulation = buildPriceSensitiveSimulation(products, referenceRevenueMinor, serviceMinutes, undefined, { seed, pricing });
  const baseById = new Map(products.map(product => [product.id, product]));
  let absoluteChangePercent = 0;
  let decisionCount = 0;
  let nearLimitCount = 0;
  for (const round of simulation.rounds) for (const decision of round.decisions) {
    const product = baseById.get(decision.productId)!;
    const change = (decision.newPriceMinor - product.base_price_minor) / product.base_price_minor;
    absoluteChangePercent += Math.abs(change) * 100;
    decisionCount += 1;
    const range = decision.newPriceMinor >= product.base_price_minor
      ? (product.ceiling_price_minor - product.base_price_minor)
      : (product.base_price_minor - product.floor_price_minor);
    if (range > 0 && Math.abs(decision.newPriceMinor - product.base_price_minor) / range >= 0.9) nearLimitCount += 1;
  }
  return {
    revenue: simulation.sales.reduce((total, sale) => total + sale.unitPriceMinor * sale.quantity, 0),
    orders: simulation.sales.length,
    absoluteChangePercent,
    decisionCount,
    nearLimitCount,
  };
}

function average(values: number[]) { return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length); }
function pounds(minor: number) { return `£${(minor / 100).toFixed(2)}`; }
function serialise(result: Result) {
  return {
    settings: { momentumRetention: result.momentumRetention, salesSignalWeight: result.salesSignalWeight, targetRangeUtilisation: result.targetRangeUtilisation, targetApproachRate: result.targetApproachRate },
    revenue: pounds(result.averageRevenue),
    revenueUplift: `${result.upliftPercent.toFixed(2)}%`,
    averageOrders: Number(result.averageOrders.toFixed(1)),
    averagePriceMovement: `${result.averageAbsChangePercent.toFixed(2)}%`,
    nearLimitRate: `${(result.nearLimitRate * 100).toFixed(2)}%`,
    eligible: result.eligible,
  };
}
