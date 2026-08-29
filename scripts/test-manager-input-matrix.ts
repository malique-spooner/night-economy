import fs from "node:fs";
import { tljCatalogue } from "../pos-simulator/src/tljCatalogue.mjs";
import { buildInstantSimulation, type InstantSimulationProduct } from "../supabase/functions/_shared/instantSimulation.ts";
import {
  applyCategoryCrash,
  momentumFromDecisions,
  priceMarket,
  selectAdaptiveMarketSales,
  type MarketMomentum,
  type MarketPriceDecision,
} from "../supabase/functions/_shared/marketPricing.ts";
import { activeMarketCrash, parseMarketCrashSettings, type MarketCrashSettings } from "../supabase/functions/_shared/marketCrash.ts";
import { marketCycleMinutes, simulationProgress } from "../supabase/functions/_shared/simulationClock.ts";

type Product = InstantSimulationProduct & { name: string };
type Scenario = {
  id: string;
  label: string;
  dimension: string;
  expectedRevenueMinor: number;
  serviceMinutes?: number;
  products?: (source: Product[]) => Product[];
  priceElasticity?: number;
  crashSettings?: MarketCrashSettings;
};
type ServiceMetrics = {
  actualRevenueRatioPct: number;
  totalUnits: number;
  averageRoundMovePct: number;
  averageProductRangePct: number;
  maximumProductRangePct: number;
  movingDecisionRatePct: number;
  movedBy60MinutesPct: number;
  nearLimitDecisionRatePct: number;
  maximumRoundMovePct: number;
  boundsBreaches: number;
  roundCapBreaches: number;
  ineligiblePriceChanges: number;
  crashRoundCount: number;
  categoryShares: Record<string, number>;
};
type ConfidenceMetric = {
  mean: number;
  standardDeviation: number;
  ci95Low: number;
  ci95High: number;
  ci95Margin: number;
  p05: number;
  p50: number;
  p95: number;
};

const runCount = positiveInteger(argument("runs"), 400);
const seedPrefix = argument("seed-prefix") ?? "primary";
const outputPath = argument("output") ?? "analysis/manager-input-matrix-primary.json";
const progress = argument("progress") !== "false";
const baselineProducts = catalogueProducts();
const scenarioFilter = new Set((argument("scenario") ?? "").split(",").map(value => value.trim()).filter(Boolean));
const scenarios = scenarioMatrix().filter(scenario => !scenarioFilter.size || scenarioFilter.has(scenario.id));
const scenarioResults = [];

for (const [scenarioIndex, scenario] of scenarios.entries()) {
  const products = (scenario.products?.(baselineProducts) ?? baselineProducts).map(product => ({ ...product }));
  const samples: ServiceMetrics[] = [];
  const effectiveRuns = scenario.expectedRevenueMinor === 0 ? Math.min(runCount, 25) : runCount;
  for (let run = 1; run <= effectiveRuns; run += 1) {
    const simulation = buildInstantSimulation(
      products,
      scenario.expectedRevenueMinor,
      scenario.serviceMinutes ?? 360,
      scenario.crashSettings,
      { seed: `${seedPrefix}:${scenario.id}:${run}`, priceElasticity: scenario.priceElasticity },
    );
    samples.push(analyseService(products, scenario, simulation));
  }
  scenarioResults.push(summariseScenario(scenario, products, samples));
  if (progress) console.error(`[${scenarioIndex + 1}/${scenarios.length}] ${scenario.id}: ${effectiveRuns} services complete`);
}

const deterministicChecks = runDeterministicChecks();
const publicationChecks = inspectPublicationSafety();
const result = {
  generatedAt: new Date().toISOString(),
  method: {
    engine: "The exact shared buildInstantSimulation, simulateDemandMinute, priceMarket, crash and simulation-clock modules used by the Supabase Edge Functions",
    seedPrefix,
    requestedServicesPerScenario: runCount,
    stochasticScenarios: scenarios.length,
    totalSimulatedServices: scenarioResults.reduce((total, scenario) => total + scenario.runs, 0),
    confidence: "Two-sided 95% normal confidence intervals over independent seeded services; zero-failure upper bounds use the exact rule-of-three approximation (3/n).",
    serviceDefinition: "A service is an independent seeded customer night with five-minute production price rounds.",
    scenarioDesign: "One-factor-at-a-time manager settings plus deliberately adverse combined availability and category-mix cases.",
  },
  deterministicChecks,
  publicationChecks,
  scenarios: scenarioResults,
};

fs.mkdirSync(outputPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath,
  totalSimulatedServices: result.method.totalSimulatedServices,
  deterministicChecks: deterministicChecks.length,
  deterministicFailures: deterministicChecks.filter(check => !check.passed).length,
  invariantFailures: scenarioResults.reduce((total, scenario) => total + scenario.invariants.totalFailures, 0),
}, null, 2));

function scenarioMatrix(): Scenario[] {
  const normal = 1_000_000;
  const baseline: Scenario = { id: "baseline", label: "Standard manager setup", dimension: "baseline", expectedRevenueMinor: normal };
  return [
    baseline,
    { id: "turnover-zero", label: "No expected takings", dimension: "expected takings", expectedRevenueMinor: 0 },
    { id: "turnover-micro", label: "£500 expected takings", dimension: "expected takings", expectedRevenueMinor: 50_000 },
    { id: "turnover-quiet", label: "£2,500 expected takings", dimension: "expected takings", expectedRevenueMinor: 250_000 },
    { id: "turnover-busy", label: "£25,000 expected takings", dimension: "expected takings", expectedRevenueMinor: 2_500_000 },
    { id: "turnover-extreme", label: "£50,000 expected takings", dimension: "expected takings", expectedRevenueMinor: 5_000_000 },
    { id: "range-tight", label: "Symmetric ±5% price range", dimension: "manager price range", expectedRevenueMinor: normal, products: source => setPriceRanges(source, 0.05, 0.05) },
    { id: "range-narrow", label: "Symmetric ±10% price range", dimension: "manager price range", expectedRevenueMinor: normal, products: source => setPriceRanges(source, 0.1, 0.1) },
    { id: "range-wide", label: "Symmetric ±40% price range", dimension: "manager price range", expectedRevenueMinor: normal, products: source => setPriceRanges(source, 0.4, 0.4) },
    { id: "range-upside", label: "Asymmetric −10% / +30% range", dimension: "manager price range", expectedRevenueMinor: normal, products: source => setPriceRanges(source, 0.1, 0.3) },
    { id: "range-downside", label: "Asymmetric −30% / +10% range", dimension: "manager price range", expectedRevenueMinor: normal, products: source => setPriceRanges(source, 0.3, 0.1) },
    ...[1, 2, 5, 10].map(count => ({
      id: `live-${count}`,
      label: `${count} live drink${count === 1 ? "" : "s"} per category`,
      dimension: "live drinks per category",
      expectedRevenueMinor: normal,
      products: (source: Product[]) => takePerCategory(source, { Beer: count, Cocktails: count, Spirits: count, Wine: count }),
    })),
    { id: "mix-beer-heavy", label: "Beer-heavy live range", dimension: "category mix", expectedRevenueMinor: normal, products: source => takePerCategory(source, { Beer: 10, Cocktails: 2, Spirits: 2, Wine: 2 }) },
    { id: "mix-cocktail-heavy", label: "Cocktail-heavy live range", dimension: "category mix", expectedRevenueMinor: normal, products: source => takePerCategory(source, { Beer: 2, Cocktails: 10, Spirits: 2, Wine: 2 }) },
    { id: "mix-sparse-wine", label: "Only one live wine", dimension: "category mix", expectedRevenueMinor: normal, products: source => takePerCategory(source, { Beer: 10, Cocktails: 10, Spirits: 10, Wine: 1 }) },
    { id: "mix-no-wine", label: "No live wine category", dimension: "category mix", expectedRevenueMinor: normal, products: source => takePerCategory(source, { Beer: 10, Cocktails: 10, Spirits: 10, Wine: 0 }) },
    { id: "demand-even", label: "Equal product popularity", dimension: "demand shape", expectedRevenueMinor: normal, products: source => source.map(product => ({ ...product, demand_weight: 1 })) },
    { id: "demand-runaway", label: "One 12× favourite per category", dimension: "demand shape", expectedRevenueMinor: normal, products: source => source.map((product, index) => ({ ...product, demand_weight: index % 12 === 0 ? 12 : 1 })) },
    { id: "availability-sold-out", label: "20% of drinks sold out", dimension: "availability", expectedRevenueMinor: normal, products: source => flagEveryFifth(source, "sold-out") },
    { id: "availability-paused", label: "20% of drinks paused", dimension: "availability", expectedRevenueMinor: normal, products: source => flagEveryFifth(source, "paused") },
    { id: "availability-unmapped", label: "20% of drinks missing POS mapping", dimension: "availability", expectedRevenueMinor: normal, products: source => flagEveryFifth(source, "unmapped") },
    { id: "availability-combined", label: "Mixed sold-out, paused and unmapped drinks", dimension: "availability", expectedRevenueMinor: normal, products: source => source.map((product, index) => ({
      ...product,
      is_sold_out: index % 12 === 0,
      is_live: index % 12 === 1 ? false : product.is_live,
      pos_product_id: index % 12 === 2 ? null : product.pos_product_id,
    })) },
    { id: "elasticity-low", label: "Low customer price sensitivity", dimension: "customer behaviour", expectedRevenueMinor: normal, priceElasticity: 0.5 },
    { id: "elasticity-high", label: "High customer price sensitivity", dimension: "customer behaviour", expectedRevenueMinor: normal, priceElasticity: 5 },
    { id: "service-one-hour", label: "One-hour service", dimension: "service duration", expectedRevenueMinor: normal / 6, serviceMinutes: 60 },
    { id: "service-three-hour", label: "Three-hour service", dimension: "service duration", expectedRevenueMinor: normal / 2, serviceMinutes: 180 },
    { id: "crash-one-5", label: "One five-minute cocktail crash", dimension: "market crash", expectedRevenueMinor: normal, crashSettings: { durationMinutes: 5, categoryCrashCounts: { Cocktails: 1 } } },
    { id: "crash-one-10", label: "One ten-minute cocktail crash", dimension: "market crash", expectedRevenueMinor: normal, crashSettings: { durationMinutes: 10, categoryCrashCounts: { Cocktails: 1 } } },
    { id: "crash-four", label: "Four mixed category crashes", dimension: "market crash", expectedRevenueMinor: normal, crashSettings: { durationMinutes: 10, categoryCrashCounts: { Beer: 1, Cocktails: 1, Spirits: 1, Wine: 1 } } },
  ];
}

function analyseService(products: Product[], scenario: Scenario, simulation: ReturnType<typeof buildInstantSimulation>): ServiceMetrics {
  const byId = new Map(products.map(product => [product.id, product]));
  const categoryByPos = new Map(products.filter(product => product.pos_product_id).map(product => [product.pos_product_id!, product.category]));
  const current = new Map(products.map(product => [product.id, product.base_price_minor]));
  const minimum = new Map(current);
  const maximum = new Map(current);
  const movedBy60 = new Set<string>();
  let decisionCount = 0;
  let movingDecisions = 0;
  let absoluteRoundMove = 0;
  let nearLimitDecisions = 0;
  let maximumRoundMovePct = 0;
  let boundsBreaches = 0;
  let roundCapBreaches = 0;
  let ineligiblePriceChanges = 0;

  for (const round of simulation.rounds) for (const decision of round.decisions) {
    const product = byId.get(decision.productId)!;
    const movement = Math.abs(decision.newPriceMinor - decision.oldPriceMinor) / Math.max(1, decision.oldPriceMinor) * 100;
    const range = decision.newPriceMinor >= product.base_price_minor
      ? product.ceiling_price_minor - product.base_price_minor
      : product.base_price_minor - product.floor_price_minor;
    decisionCount += 1;
    absoluteRoundMove += movement;
    maximumRoundMovePct = Math.max(maximumRoundMovePct, movement);
    if (decision.newPriceMinor !== decision.oldPriceMinor) movingDecisions += 1;
    if (range > 0 && Math.abs(decision.newPriceMinor - product.base_price_minor) / range >= 0.9) nearLimitDecisions += 1;
    if (decision.newPriceMinor < product.floor_price_minor || decision.newPriceMinor > product.ceiling_price_minor) boundsBreaches += 1;
    const permittedRoundMoveMinor = Math.max(1, Math.round(decision.oldPriceMinor * 0.05));
    if (!round.crash && Math.abs(decision.newPriceMinor - decision.oldPriceMinor) > permittedRoundMoveMinor) roundCapBreaches += 1;
    if ((!product.is_live || product.is_sold_out || !product.pos_product_id) && decision.newPriceMinor !== decision.oldPriceMinor) ineligiblePriceChanges += 1;
    current.set(product.id, decision.newPriceMinor);
    minimum.set(product.id, Math.min(minimum.get(product.id)!, decision.newPriceMinor));
    maximum.set(product.id, Math.max(maximum.get(product.id)!, decision.newPriceMinor));
    if (round.minute <= 60 && product.is_live && !product.is_sold_out && product.pos_product_id && decision.newPriceMinor !== product.base_price_minor) movedBy60.add(product.id);
  }

  const eligible = products.filter(product => product.is_live && !product.is_sold_out && product.pos_product_id);
  const productRanges = eligible.map(product => (maximum.get(product.id)! - minimum.get(product.id)!) / product.base_price_minor * 100);
  const actualRevenue = simulation.sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceMinor, 0);
  const categoryUnits: Record<string, number> = {};
  for (const sale of simulation.sales) {
    const category = categoryByPos.get(sale.posProductId) ?? "Unknown";
    categoryUnits[category] = (categoryUnits[category] ?? 0) + sale.quantity;
  }
  const totalUnits = Object.values(categoryUnits).reduce((total, units) => total + units, 0);
  return {
    actualRevenueRatioPct: scenario.expectedRevenueMinor ? actualRevenue / scenario.expectedRevenueMinor * 100 : actualRevenue === 0 ? 100 : Infinity,
    totalUnits,
    averageRoundMovePct: absoluteRoundMove / Math.max(1, decisionCount),
    averageProductRangePct: average(productRanges),
    maximumProductRangePct: Math.max(0, ...productRanges),
    movingDecisionRatePct: movingDecisions / Math.max(1, decisionCount) * 100,
    movedBy60MinutesPct: movedBy60.size / Math.max(1, eligible.length) * 100,
    nearLimitDecisionRatePct: nearLimitDecisions / Math.max(1, decisionCount) * 100,
    maximumRoundMovePct,
    boundsBreaches,
    roundCapBreaches,
    ineligiblePriceChanges,
    crashRoundCount: simulation.rounds.filter(round => round.crash).length,
    categoryShares: Object.fromEntries(Object.entries(categoryUnits).map(([category, units]) => [category, totalUnits ? units / totalUnits * 100 : 0])),
  };
}

function summariseScenario(scenario: Scenario, products: Product[], samples: ServiceMetrics[]) {
  const numericKeys: Array<keyof Omit<ServiceMetrics, "categoryShares" | "boundsBreaches" | "roundCapBreaches" | "ineligiblePriceChanges">> = [
    "actualRevenueRatioPct", "totalUnits", "averageRoundMovePct", "averageProductRangePct", "maximumProductRangePct",
    "movingDecisionRatePct", "movedBy60MinutesPct", "nearLimitDecisionRatePct", "maximumRoundMovePct", "crashRoundCount",
  ];
  const categories = [...new Set(samples.flatMap(sample => Object.keys(sample.categoryShares)))].sort();
  const boundsBreaches = sum(samples.map(sample => sample.boundsBreaches));
  const roundCapBreaches = sum(samples.map(sample => sample.roundCapBreaches));
  const ineligiblePriceChanges = sum(samples.map(sample => sample.ineligiblePriceChanges));
  const totalFailures = boundsBreaches + roundCapBreaches + ineligiblePriceChanges;
  return {
    id: scenario.id,
    label: scenario.label,
    dimension: scenario.dimension,
    runs: samples.length,
    expectedRevenueGbp: scenario.expectedRevenueMinor / 100,
    serviceMinutes: scenario.serviceMinutes ?? 360,
    activeProducts: products.filter(product => product.is_live && !product.is_sold_out && product.pos_product_id).length,
    configuredProducts: products.length,
    priceRange: describeRange(products),
    metrics: Object.fromEntries(numericKeys.map(key => [key, confidence(samples.map(sample => sample[key] as number))])),
    categoryUnitSharePct: Object.fromEntries(categories.map(category => [category, confidence(samples.map(sample => sample.categoryShares[category] ?? 0))])),
    invariants: {
      boundsBreaches,
      roundCapBreaches,
      ineligiblePriceChanges,
      totalFailures,
      observedServices: samples.length,
      zeroFailureUpper95Pct: totalFailures === 0 ? 300 / samples.length : null,
    },
  };
}

function runDeterministicChecks() {
  const checks: Array<{ id: string; label: string; passed: boolean; observed: unknown; expected: string }> = [];
  const record = (id: string, label: string, passed: boolean, observed: unknown, expected: string) => checks.push({ id, label, passed, observed, expected });
  const products = exactProducts(4);

  const noSales = priceMarket(products, []);
  record("no-sales", "No orders hold every price", noSales.every(decision => decision.newPriceMinor === 1_000), noSales.map(decision => decision.newPriceMinor), "All prices remain at 1000");

  const equalSales = priceMarket(products, products.map(product => ({ pos_product_id: product.pos_product_id!, quantity: 4 })));
  record("equal-sales", "Equal demand is zero-sum and holds", equalSales.every(decision => decision.newPriceMinor === 1_000), equalSales.map(decision => decision.newPriceMinor), "All prices remain at 1000");

  const isolated = priceMarket(products, [{ pos_product_id: "exact-0", quantity: 1 }]);
  record("isolated-order", "One isolated order does not punish untouched peers", isolated[0].movement === "up" && isolated.slice(1).every(decision => decision.movement === "hold"), isolated.map(decision => decision.movement), "Winner rises; peers hold");

  const winner = runExactRounds(products, 16, round => [{ pos_product_id: "exact-0", quantity: round % 2 ? 10 : 12 }, { pos_product_id: "exact-1", quantity: 1 }]);
  record("sustained-winner", "A sustained favourite travels through the buffered range", winner.products[0].current_price_minor >= 1_140 && winner.products[0].current_price_minor < 1_200, winner.products.map(product => product.current_price_minor), "Winner reaches at least 1140 without touching 1200 ceiling");

  const reversal = runExactRounds(products, 16, round => round < 8
    ? [{ pos_product_id: "exact-0", quantity: 10 }, { pos_product_id: "exact-1", quantity: 1 }]
    : [{ pos_product_id: "exact-0", quantity: 1 }, { pos_product_id: "exact-1", quantity: 10 }]);
  const firstHalf = reversal.history[7].find(decision => decision.productId === "exact-0")!;
  const final = reversal.history.at(-1)!.find(decision => decision.productId === "exact-0")!;
  record("demand-reversal", "A former winner reverses after demand switches", firstHalf.newPriceMinor > 1_000 && final.newPriceMinor < firstHalf.newPriceMinor, { peak: firstHalf.newPriceMinor, final: final.newPriceMinor }, "Price rises first, then falls after the switch");

  const rotating = runExactRounds(products, 20, round => [{ pos_product_id: `exact-${round % 4}`, quantity: 8 }]);
  record("rotating-leaders", "Rotating leaders remain inside manager bounds", rotating.products.every(product => product.current_price_minor >= 800 && product.current_price_minor <= 1_200), rotating.products.map(product => product.current_price_minor), "Every price stays within 800–1200");

  const adaptive = selectAdaptiveMarketSales([
    ...exactProducts(2, "Beer"), ...exactProducts(2, "Cocktails", "cocktail"), ...exactProducts(2, "Wine", "wine"),
  ], [
    { pos_product_id: "exact-0", quantity: 8, minutesAgo: 4 },
    { pos_product_id: "cocktail-0", quantity: 3, minutesAgo: 4 },
    { pos_product_id: "cocktail-1", quantity: 5, minutesAgo: 12 },
    { pos_product_id: "wine-0", quantity: 2, minutesAgo: 4 },
  ]);
  record("adaptive-windows", "Busy, medium and quiet categories use 5/15/30-minute evidence", JSON.stringify(adaptive.categoryWindows) === JSON.stringify({ Beer: 5, Cocktails: 15, Wine: 30 }), adaptive.categoryWindows, "Beer 5, Cocktails 15, Wine 30");

  const crashProducts = exactProducts(2);
  const crash = applyCategoryCrash(priceMarket(crashProducts, []), crashProducts, "Cocktails", true);
  record("crash-target", "Crash uses 75% of the manager's downward range", crash.every(decision => decision.newPriceMinor === 850), crash.map(decision => decision.newPriceMinor), "Both prices become 850");

  const fiveMinuteSettings = parseMarketCrashSettings({ durationMinutes: 5, categoryCrashCounts: { Cocktails: 1 } });
  const tenMinuteSettings = parseMarketCrashSettings({ durationMinutes: 10, categoryCrashCounts: { Cocktails: 1 } });
  const fiveActive = marketCycleMinutes(0, 360).filter(minute => activeMarketCrash(minute, fiveMinuteSettings));
  const tenActive = marketCycleMinutes(0, 360).filter(minute => activeMarketCrash(minute, tenMinuteSettings));
  record("crash-duration", "Five- and ten-minute crashes occupy one and two price rounds", fiveActive.length === 1 && tenActive.length === 2, { fiveMinuteRounds: fiveActive, tenMinuteRounds: tenActive }, "1 and 2 rounds respectively");

  const quickStart = simulationProgress(0, "2026-07-30T18:00:00.000Z", new Date("2026-07-30T18:00:15.000Z"), 20, 360, true);
  const delayed = simulationProgress(0, "2026-07-30T18:00:00.000Z", new Date("2026-07-30T18:10:00.000Z"), 20, 360, true);
  const early = simulationProgress(0, "2026-07-30T18:00:00.000Z", new Date("2026-07-30T18:00:11.900Z"), 20, 360, true);
  record("quick-start-clock", "Quick Start advances exactly one five-minute round per 15 seconds", quickStart.minute === 5 && delayed.minute === 5 && early.minute === 0, { quickStart, delayed, early }, "15s => 5m; delayed tick => only 5m; early tick => 0m");

  const unmapped = exactProducts(3).map((product, index) => index === 2 ? { ...product, pos_product_id: null } : product);
  const unmappedDecision = priceMarket(unmapped, [{ pos_product_id: "exact-0", quantity: 8 }]).at(-1)!;
  record("unmapped-hold", "A drink without a POS mapping cannot reprice", unmappedDecision.newPriceMinor === unmappedDecision.oldPriceMinor, unmappedDecision, "Unmapped drink holds");

  return checks;
}

function inspectPublicationSafety() {
  const source = fs.readFileSync("supabase/functions/market-cycle/index.ts", "utf8");
  const duplicateGuard = source.indexOf("snapshot?.roundEnd === cycleEnd.toISOString()") >= 0;
  const updateStart = source.indexOf("await Promise.all(");
  const snapshotStart = source.indexOf("const snapshot =", updateStart);
  const snapshotWrite = source.indexOf("write market snapshot", snapshotStart);
  const throwsOnFailure = source.includes("if (!response.ok)") && source.includes("throw new Error(`Supabase REST failed");
  return {
    duplicateCycleGuard: { passed: duplicateGuard, detail: "The same run/cycle-end returns before price updates." },
    snapshotAfterProductUpdates: { passed: updateStart >= 0 && snapshotStart > updateStart && snapshotWrite > snapshotStart, detail: "A published snapshot is written only after all product PATCH promises resolve." },
    restFailuresPropagate: { passed: throwsOnFailure, detail: "Non-2xx Supabase/POS REST calls throw instead of being recorded as successful." },
    atomicityRisk: { passed: false, detail: "Product PATCH calls run concurrently and are not wrapped in one database transaction. If one PATCH fails after another succeeds, a partial price update can exist without a snapshot. This requires an RPC/transaction to eliminate, not more random simulation." },
  };
}

function catalogueProducts(): Product[] {
  return tljCatalogue
    .filter((product: { initiallyLive: boolean; category: string }) => product.initiallyLive && ["Beer", "Cocktails", "Spirits", "Wine"].includes(product.category))
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
}

function exactProducts(count: number, category = "Cocktails", prefix = "exact"): Product[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`, name: `${prefix}-${index}`, category, base_price_minor: 1_000, current_price_minor: 1_000,
    floor_price_minor: 800, ceiling_price_minor: 1_200, pos_product_id: `${prefix}-${index}`, is_live: true, is_sold_out: false, demand_weight: 1,
  }));
}

function runExactRounds(source: Product[], count: number, salesFor: (round: number) => Array<{ pos_product_id: string; quantity: number }>) {
  let products = source.map(product => ({ ...product }));
  let momentum: MarketMomentum = {};
  const history: MarketPriceDecision[][] = [];
  for (let round = 0; round < count; round += 1) {
    const decisions = priceMarket(products, salesFor(round), momentum);
    history.push(decisions);
    momentum = momentumFromDecisions(decisions);
    products = products.map(product => ({ ...product, current_price_minor: decisions.find(decision => decision.productId === product.id)!.newPriceMinor }));
  }
  return { products, history };
}

function setPriceRanges(products: Product[], down: number, up: number) {
  return products.map(product => ({ ...product, floor_price_minor: Math.round(product.base_price_minor * (1 - down)), ceiling_price_minor: Math.round(product.base_price_minor * (1 + up)) }));
}

function takePerCategory(products: Product[], counts: Record<string, number>) {
  const seen = new Map<string, number>();
  return products.filter(product => {
    const count = seen.get(product.category) ?? 0;
    seen.set(product.category, count + 1);
    return count < (counts[product.category] ?? 0);
  });
}

function flagEveryFifth(products: Product[], state: "sold-out" | "paused" | "unmapped") {
  return products.map((product, index) => index % 5 !== 0 ? { ...product } : {
    ...product,
    ...(state === "sold-out" ? { is_sold_out: true } : {}),
    ...(state === "paused" ? { is_live: false } : {}),
    ...(state === "unmapped" ? { pos_product_id: null } : {}),
  });
}

function confidence(values: number[]): ConfidenceMetric {
  const mean = average(values);
  const standardDeviation = sampleStandardDeviation(values);
  const margin = values.length > 1 ? 1.96 * standardDeviation / Math.sqrt(values.length) : 0;
  return {
    mean: round(mean, 4),
    standardDeviation: round(standardDeviation, 4),
    ci95Low: round(mean - margin, 4),
    ci95High: round(mean + margin, 4),
    ci95Margin: round(margin, 4),
    p05: round(quantile(values, 0.05), 4),
    p50: round(quantile(values, 0.5), 4),
    p95: round(quantile(values, 0.95), 4),
  };
}

function describeRange(products: Product[]) {
  const down = products.map(product => (product.base_price_minor - product.floor_price_minor) / product.base_price_minor * 100);
  const up = products.map(product => (product.ceiling_price_minor - product.base_price_minor) / product.base_price_minor * 100);
  return { averageDownPct: round(average(down), 2), averageUpPct: round(average(up), 2) };
}

function argument(name: string) { return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3); }
function positiveInteger(value: string | undefined, fallback: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
function average(values: number[]) { return values.length ? sum(values) / values.length : 0; }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function sampleStandardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1));
}
function quantile(values: number[], probability: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
function round(value: number, places: number) { const factor = 10 ** places; return Math.round(value * factor) / factor; }
