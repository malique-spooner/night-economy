import fs from "node:fs";
import { tljCatalogue } from "../pos-simulator/src/tljCatalogue.mjs";
import { buildInstantSimulation, type InstantSimulationProduct } from "../supabase/functions/_shared/instantSimulation.ts";

type ProductRecord = InstantSimulationProduct & { name: string };
type Scenario = { id: string; label: string; targetRevenueMinor: number };
type Accumulator = {
  runs: number;
  productRuns: number;
  salesUnits: number;
  orderLines: number;
  decisions: number;
  movingDecisions: number;
  absoluteRoundMove: number;
  absoluteDeviation: number;
  span: number;
  peakAbove: number;
  peakBelow: number;
  reversals: number;
  nearLimitDecisions: number;
  movedAt15: number;
  movedAt30: number;
  movedAt60: number;
  untradedAt60: number;
  untradedMovedAt60: number;
  roundMoves: number[];
  productRanges: number[];
  finalSignedDeviations: number[];
};

const runCount = positiveInteger(argument("runs"), 120);
const seedPrefix = argument("seed-prefix") ?? "primary";
const serviceMinutes = 360;
const scenarios: Scenario[] = [
  { id: "quiet", label: "Quiet service", targetRevenueMinor: 250_000 },
  { id: "normal", label: "Normal service", targetRevenueMinor: 1_000_000 },
  { id: "busy", label: "Busy service", targetRevenueMinor: 2_000_000 },
];
const products: ProductRecord[] = tljCatalogue
  .filter((product: { initiallyLive: boolean }) => product.initiallyLive)
  .map((product: { id: string; name: string; category: string; basePriceMinor: number; demandWeight: number }) => ({
    id: product.id,
    name: product.name,
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
const categories = [...new Set(products.map(product => product.category))].sort();
const productsByCategory = new Map(categories.map(category => [category, products.filter(product => product.category === category)]));
const accumulators = new Map<string, Accumulator>();
const timeSeries = new Map<string, { sum: number; count: number }>();

for (const scenario of scenarios) {
  for (let run = 1; run <= runCount; run += 1) analyseRun(scenario, run);
}

const categorySummary = scenarios.flatMap(scenario => categories.map(category => {
  const value = accumulator(scenario.id, category);
  return {
    scenario: scenario.id,
    scenarioLabel: scenario.label,
    expectedRevenueGbp: scenario.targetRevenueMinor / 100,
    category,
    products: productsByCategory.get(category)!.length,
    averageUnitsPerService: round(value.salesUnits / value.runs, 1),
    averageOrderLinesPerService: round(value.orderLines / value.runs, 1),
    movingRoundRatePct: percent(value.movingDecisions, value.decisions),
    averageRoundMovePct: round(value.absoluteRoundMove / value.decisions, 2),
    p95RoundMovePct: round(quantile(value.roundMoves, 0.95), 2),
    averageDistanceFromBasePct: round(value.absoluteDeviation / value.decisions, 2),
    averageProductNightRangePct: round(value.span / value.productRuns, 2),
    p90ProductNightRangePct: round(quantile(value.productRanges, 0.9), 2),
    maximumObservedProductNightRangePct: round(Math.max(...value.productRanges), 2),
    averageFinalPriceVsBasePct: round(average(value.finalSignedDeviations), 2),
    averagePeakAboveBasePct: round(value.peakAbove / value.productRuns, 2),
    averagePeakBelowBasePct: round(value.peakBelow / value.productRuns, 2),
    productsMovedBy15MinutesPct: percent(value.movedAt15, value.productRuns),
    productsMovedBy30MinutesPct: percent(value.movedAt30, value.productRuns),
    productsMovedBy60MinutesPct: percent(value.movedAt60, value.productRuns),
    untradedProductsMovedBy60MinutesPct: percent(value.untradedMovedAt60, value.untradedAt60),
    untradedProductRunsAt60: value.untradedAt60,
    averageReversalsPerProduct: round(value.reversals / value.productRuns, 2),
    nearPriceLimitDecisionRatePct: percent(value.nearLimitDecisions, value.decisions),
  };
}));

const serviceSummary = scenarios.map(scenario => {
  const rows = categorySummary.filter(row => row.scenario === scenario.id);
  const values = categories.map(category => accumulator(scenario.id, category));
  return {
    scenario: scenario.id,
    scenarioLabel: scenario.label,
    expectedRevenueGbp: scenario.targetRevenueMinor / 100,
    simulatedServices: runCount,
    averageUnitsPerService: round(rows.reduce((sum, row) => sum + row.averageUnitsPerService, 0), 1),
    movingRoundRatePct: percent(sum(values, "movingDecisions"), sum(values, "decisions")),
    averageRoundMovePct: round(sum(values, "absoluteRoundMove") / sum(values, "decisions"), 2),
    p95RoundMovePct: round(quantile(values.flatMap(value => value.roundMoves), 0.95), 2),
    averageDistanceFromBasePct: round(sum(values, "absoluteDeviation") / sum(values, "decisions"), 2),
    averageProductNightRangePct: round(sum(values, "span") / sum(values, "productRuns"), 2),
    p90ProductNightRangePct: round(quantile(values.flatMap(value => value.productRanges), 0.9), 2),
    averageFinalPriceVsBasePct: round(average(values.flatMap(value => value.finalSignedDeviations)), 2),
    productsMovedBy60MinutesPct: percent(sum(values, "movedAt60"), sum(values, "productRuns")),
    untradedProductsMovedBy60MinutesPct: percent(sum(values, "untradedMovedAt60"), sum(values, "untradedAt60")),
    untradedProductRunsAt60: sum(values, "untradedAt60"),
    nearPriceLimitDecisionRatePct: percent(sum(values, "nearLimitDecisions"), sum(values, "decisions")),
  };
});

const timeSeriesRows = [...timeSeries.entries()].map(([key, value]) => {
  const [scenario, category, minute] = key.split("|");
  return { scenario, category, minute: Number(minute), averageDistanceFromBasePct: round(value.sum / value.count, 2) };
}).sort((left, right) => left.scenario.localeCompare(right.scenario) || left.category.localeCompare(right.category) || left.minute - right.minute);

const result = {
  generatedAt: new Date().toISOString(),
  method: {
    engine: "buildInstantSimulation using shared customer demand and production market pricing",
    servicesPerScenario: runCount,
    totalServices: runCount * scenarios.length,
    serviceMinutes,
    priceRoundsPerService: serviceMinutes / 5,
    seedPrefix,
    activeProducts: products.length,
    productsPerCategory: Object.fromEntries(categories.map(category => [category, productsByCategory.get(category)!.length])),
    priceBounds: "80% to 120% of base; normal pricing targets 75% of the available range",
    crashes: "Disabled to isolate normal demand-driven fluctuation",
  },
  serviceSummary,
  categorySummary,
  timeSeries: timeSeriesRows,
};

const outputPath = argument("output");
if (outputPath) fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, outputPath ? 0 : 2));

function analyseRun(scenario: Scenario, run: number) {
  const simulation = buildInstantSimulation(products, scenario.targetRevenueMinor, serviceMinutes, undefined, { seed: `${seedPrefix}-${scenario.id}-${run}` });
  const baseById = new Map(products.map(product => [product.id, product.base_price_minor]));
  const categoryById = new Map(products.map(product => [product.id, product.category]));
  const posCategory = new Map(products.map(product => [product.pos_product_id!, product.category]));
  const currentById = new Map(products.map(product => [product.id, product.base_price_minor]));
  const minById = new Map(currentById);
  const maxById = new Map(currentById);
  const lastDirection = new Map<string, number>();
  const reversals = new Map<string, number>();
  const firstHourSales = new Map<string, number>();
  const movedAt = new Map<number, Set<string>>([[15, new Set()], [30, new Set()], [60, new Set()]]);

  for (const category of categories) accumulator(scenario.id, category).runs += 1;
  for (const sale of simulation.sales) {
    const category = posCategory.get(sale.posProductId)!;
    const value = accumulator(scenario.id, category);
    value.salesUnits += sale.quantity;
    value.orderLines += 1;
    if (sale.minute < 60) firstHourSales.set(sale.posProductId, (firstHourSales.get(sale.posProductId) ?? 0) + sale.quantity);
  }

  for (const roundResult of simulation.rounds) {
    for (const decision of roundResult.decisions) {
      const category = categoryById.get(decision.productId)!;
      const value = accumulator(scenario.id, category);
      const base = baseById.get(decision.productId)!;
      const roundMove = (decision.newPriceMinor - decision.oldPriceMinor) / decision.oldPriceMinor * 100;
      const deviation = (decision.newPriceMinor - base) / base * 100;
      value.decisions += 1;
      value.absoluteRoundMove += Math.abs(roundMove);
      value.roundMoves.push(Math.abs(roundMove));
      value.absoluteDeviation += Math.abs(deviation);
      if (decision.newPriceMinor !== decision.oldPriceMinor) value.movingDecisions += 1;
      const availableRange = decision.newPriceMinor >= base
        ? products.find(product => product.id === decision.productId)!.ceiling_price_minor - base
        : base - products.find(product => product.id === decision.productId)!.floor_price_minor;
      if (availableRange > 0 && Math.abs(decision.newPriceMinor - base) / availableRange >= 0.9) value.nearLimitDecisions += 1;
      const direction = Math.sign(decision.newPriceMinor - decision.oldPriceMinor);
      const previousDirection = lastDirection.get(decision.productId) ?? 0;
      if (direction && previousDirection && direction !== previousDirection) reversals.set(decision.productId, (reversals.get(decision.productId) ?? 0) + 1);
      if (direction) lastDirection.set(decision.productId, direction);
      currentById.set(decision.productId, decision.newPriceMinor);
      minById.set(decision.productId, Math.min(minById.get(decision.productId)!, decision.newPriceMinor));
      maxById.set(decision.productId, Math.max(maxById.get(decision.productId)!, decision.newPriceMinor));
    }

    for (const checkpoint of [15, 30, 60]) {
      if (roundResult.minute !== checkpoint) continue;
      for (const product of products) if (currentById.get(product.id) !== product.base_price_minor) movedAt.get(checkpoint)!.add(product.id);
    }
    // Keep every five-minute pricing round so the report can show whether the
    // engine settles, drifts, or becomes noisy between the headline checkpoints.
    {
      for (const category of categories) {
        const categoryProducts = productsByCategory.get(category)!;
        const mean = categoryProducts.reduce((sum, product) => sum + Math.abs(currentById.get(product.id)! - product.base_price_minor) / product.base_price_minor * 100, 0) / categoryProducts.length;
        const key = `${scenario.id}|${category}|${roundResult.minute}`;
        const value = timeSeries.get(key) ?? { sum: 0, count: 0 };
        value.sum += mean;
        value.count += 1;
        timeSeries.set(key, value);
      }
    }
  }

  for (const product of products) {
    const value = accumulator(scenario.id, product.category);
    const base = product.base_price_minor;
    const minimum = minById.get(product.id)!;
    const maximum = maxById.get(product.id)!;
    value.productRuns += 1;
    value.span += (maximum - minimum) / base * 100;
    value.productRanges.push((maximum - minimum) / base * 100);
    value.finalSignedDeviations.push((currentById.get(product.id)! - base) / base * 100);
    value.peakAbove += Math.max(0, maximum - base) / base * 100;
    value.peakBelow += Math.max(0, base - minimum) / base * 100;
    value.reversals += reversals.get(product.id) ?? 0;
    if (movedAt.get(15)!.has(product.id)) value.movedAt15 += 1;
    if (movedAt.get(30)!.has(product.id)) value.movedAt30 += 1;
    if (movedAt.get(60)!.has(product.id)) value.movedAt60 += 1;
    if (!firstHourSales.has(product.pos_product_id!)) {
      value.untradedAt60 += 1;
      if (movedAt.get(60)!.has(product.id)) value.untradedMovedAt60 += 1;
    }
  }
}

function accumulator(scenario: string, category: string) {
  const key = `${scenario}|${category}`;
  if (!accumulators.has(key)) accumulators.set(key, {
    runs: 0, productRuns: 0, salesUnits: 0, orderLines: 0, decisions: 0, movingDecisions: 0,
    absoluteRoundMove: 0, absoluteDeviation: 0, span: 0, peakAbove: 0, peakBelow: 0,
    reversals: 0, nearLimitDecisions: 0, movedAt15: 0, movedAt30: 0, movedAt60: 0,
    untradedAt60: 0, untradedMovedAt60: 0,
    roundMoves: [], productRanges: [], finalSignedDeviations: [],
  });
  return accumulators.get(key)!;
}

function argument(name: string) { return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3); }
function positiveInteger(value: string | undefined, fallback: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
function round(value: number, places: number) { const factor = 10 ** places; return Math.round(value * factor) / factor; }
function percent(numerator: number, denominator: number) { return denominator ? round(numerator / denominator * 100, 1) : 0; }
function average(values: number[]) { return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length); }
function sum(values: Accumulator[], key: keyof Accumulator) { return values.reduce((total, value) => total + Number(value[key]), 0); }
function quantile(values: number[], probability: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
