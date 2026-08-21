import { readFileSync } from "node:fs";

const sharedEngineSource = readFileSync("supabase/functions/_shared/marketPricing.ts", "utf8");
const edgeFunctionSource = readFileSync("supabase/functions/market-cycle/index.ts", "utf8");
const instantSimulationSource = readFileSync("supabase/functions/_shared/instantSimulation.ts", "utf8");
const simulatorRunnerSource = readFileSync("pos-simulator/src/marketPricing.mjs", "utf8");

const sharedSnippets = [
  {
    label: "persistent momentum settings",
    pattern: /MOMENTUM_RETENTION = 0\.75[\s\S]+SALES_SIGNAL_WEIGHT = 0\.45/,
  },
  {
    label: "zero-sum market points",
    pattern: /marketPoints = .*ownUnits - categoryUnits/,
  },
  {
    label: "buffered range target and capped round movement",
    pattern: /TARGET_RANGE_UTILISATION = 0\.75[\s\S]+TARGET_APPROACH_RATE = 0\.7[\s\S]+MAX_ROUND_MOVE_PERCENT = 0\.05/,
  },
  {
    label: "confidence-weighted leadership signal",
    pattern: /SALES_SIGNAL_CURVE_EXPONENT = 0\.5[\s\S]+SALES_CONFIDENCE_SALES = 8[\s\S]+expandedSignal[\s\S]+confidence/,
  },
  {
    label: "volume-adaptive evidence windows",
    pattern: /fiveMinuteUnits >= SALES_CONFIDENCE_SALES[\s\S]+fifteenMinuteUnits >= SALES_CONFIDENCE_SALES[\s\S]+categoryWindows/,
  },
  {
    label: "fresh-demand gate",
    pattern: /freshCategoryUnits > 0 && \(ownUnits > 0 \|\| peerRepricingAllowed\)/,
  },
  {
    label: "guarded untraded-peer response",
    pattern: /MIN_CATEGORY_UNITS_FOR_PEER_REPRICING = 3[\s\S]+UNTRADED_PEER_SIGNAL_WEIGHT = 0\.25/,
  },
  {
    label: "two-sided momentum retention",
    pattern: /startingMomentum \* controls\.momentumRetention/,
  },
  {
    label: "non-tradable hold reason",
    pattern: /Product is not currently competing in a live category\./,
  },
  {
    label: "momentum-driven movement reason",
    pattern: /Momentum is neutral[\s\S]+buffered market target/,
  },
];

const failures = sharedSnippets.flatMap(({ label, pattern }) => {
  const missing = [];
  if (!pattern.test(sharedEngineSource)) missing.push(`supabase/functions/_shared/marketPricing.ts missing ${label}.`);
  if (!pattern.test(simulatorRunnerSource)) missing.push(`pos-simulator/src/marketPricing.mjs missing ${label}.`);
  return missing;
});

if (!/from "\.\.\/_shared\/marketPricing\.ts"/.test(edgeFunctionSource)) {
  failures.push("supabase/functions/market-cycle/index.ts must import the shared pricing engine.");
}
if (!/from "\.\/marketPricing\.ts"/.test(instantSimulationSource)) {
  failures.push("supabase/functions/_shared/instantSimulation.ts must import the shared pricing engine.");
}

if (failures.length) {
  console.error("Pricing engine sync verification failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Pricing engine sync verification passed.");
