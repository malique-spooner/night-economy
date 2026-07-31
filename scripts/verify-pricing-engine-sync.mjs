import { readFileSync } from "node:fs";

const sharedEngineSource = readFileSync("supabase/functions/_shared/marketPricing.ts", "utf8");
const edgeFunctionSource = readFileSync("supabase/functions/market-cycle/index.ts", "utf8");
const instantSimulationSource = readFileSync("supabase/functions/_shared/instantSimulation.ts", "utf8");
const simulatorRunnerSource = readFileSync("pos-simulator/src/marketPricing.mjs", "utf8");

const sharedSnippets = [
  {
    label: "range-aware market intensity setting",
    pattern: /const MARKET_INTENSITY = 1\.25;/,
  },
  {
    label: "zero-sum market points",
    pattern: /marketPoints = .*ownUnits - categoryUnits/,
  },
  {
    label: "activity-aware range movement",
    pattern: /activityFactor[\s\S]+allowedRange[\s\S]+percentageChange/,
  },
  {
    label: "non-tradable hold reason",
    pattern: /Product is not currently tradable\./,
  },
  {
    label: "category peer reason",
    pattern: /category peers/,
  },
  {
    label: "balanced hold reason",
    pattern: /Orders were evenly balanced within this category, so the price held\./,
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
