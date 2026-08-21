import { readFileSync } from "node:fs";

const functionFiles = ["supabase/functions/market-cycle/index.ts"];
const sharedPricingSource = readFileSync("supabase/functions/_shared/marketPricing.ts", "utf8");
const checks = [
  {
    label: "requires scheduler secret header support",
    pattern: /x-night-economy-scheduler-secret/,
  },
  {
    label: "reads a modern server key only inside Edge Function",
    pattern: /SUPABASE_SECRET_KEYS[\s\S]+SUPABASE_SERVICE_ROLE_KEY/,
  },
  {
    label: "uses modern key authentication without a Bearer secret",
    pattern: /apikey: serviceRoleKey/,
  },
  {
    label: "requires scheduler secret configuration",
    pattern: /SCHEDULER_SECRET is not configured/,
  },
  {
    label: "wraps handler errors as JSON",
    pattern: /catch \(error\)[\s\S]+return json\(\{ error:/,
  },
  {
    label: "checks Supabase REST response status",
    pattern: /if \(!response\.ok\)/,
  },
  {
    label: "writes market price snapshots",
    pattern: /market_price_snapshots/,
  },
  { label: "imports the canonical pricing engine", pattern: /_shared\/marketPricing\.ts/ },
  {
    label: "uses a five-minute POS sales round",
    pattern: /cycleEnd\.getTime\(\) - MARKET_CYCLE_MS/,
  },
  {
    label: "respects venue market live state",
    pattern: /market_live[\s\S]+Market is paused for this venue/,
  },
  {
    label: "deduplicates repeated five-minute rounds",
    pattern: /latestSnapshots[\s\S]+snapshot\?\.roundEnd === cycleEnd\.toISOString\(\)[\s\S]+duplicate: true/,
  },
];

const forbiddenPatterns = [
  {
    label: "hard-coded Supabase service key",
    pattern: /eyJhbGciOi|service_role_[a-z0-9]{16,}/i,
  },
  {
    label: "local Supabase URL in deployed function",
    pattern: /localhost:54321|127\.0\.0\.1:54321/,
  },
];

for (const file of functionFiles) {
  const source = readFileSync(file, "utf8");
  const failures = [
    ...checks
      .filter(check => !check.pattern.test(source))
      .map(check => `${file}: missing ${check.label}`),
    ...forbiddenPatterns
      .filter(check => check.pattern.test(source))
      .map(check => `${file}: contains ${check.label}`),
  ];

  if (failures.length) {
    console.error("Supabase function verification failed:");
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
  }
}

if (!/MOMENTUM_RETENTION = 0\.75[\s\S]+SALES_SIGNAL_WEIGHT = 0\.45[\s\S]+TARGET_RANGE_UTILISATION = 0\.75[\s\S]+TARGET_APPROACH_RATE = 0\.7[\s\S]+MAX_ROUND_MOVE_PERCENT = 0\.05[\s\S]+SALES_SIGNAL_CURVE_EXPONENT = 0\.5[\s\S]+SALES_CONFIDENCE_SALES = 8/.test(sharedPricingSource)) {
  console.error("Supabase function verification failed:\n- shared pricing engine is missing its buffered momentum calculation");
  process.exit(1);
}

const simulatorSource = readFileSync("supabase/functions/venue-simulator/index.ts", "utf8");
const simulatorChecks = [
  ["keeps service state per venue", /venue_test_services\?venue_id=eq/],
  ["writes sales with the venue ID", /venue_id: venueId/],
  ["runs the protected market engine", /functions\/v1\/market-cycle/],
  ["resets each venue's prices through the server-only RPC", /reset_venue_test_prices/],
  ["resets prices when a venue is paused", /action === "pause"[\s\S]+resetPrices/],
  ["uses direct server-key REST calls rather than a browser-style client", /apikey: key/],
  ["returns per-run sales graph data", /action === "summary"[\s\S]+salesGraph[\s\S]+pos_sales_events\?run_id=eq/],
  ["returns the complete venue catalogue to the protected simulator", /simulatorProducts[\s\S]+market_products\?venue_id=eq[\s\S]+isLive/],
  ["publishes calculated prices to the internal POS catalogue", /publishInternalPrices[\s\S]+price_publications[\s\S]+price_publication_lines[\s\S]+pos_products/],
  ["keeps running run-history totals current", /syncRunProgress[\s\S]+sales_count[\s\S]+revenue_minor/],
  ["keeps public state reads separate from scheduler-owned ticks", /action === "state"[\s\S]+action === "tick" && state\.status === "running"/],
  ["anchors service simulation time in the venue timezone", /simulationStart\(venue\.timezone/],
  ["writes basket sales before each elapsed market round", /simulateDemandMinute[\s\S]+pendingSalesRows\.push[\s\S]+writeRowsInChunks[\s\S]+runMarketCycle/],
  ["seeds each simulated night from its run ID", /seed: state\.active_run_id \?\? venueId/],
  ["feeds published prices back into later customer choices", /runMarketCycle[\s\S]+product\.current_price_minor = decision\.newPriceMinor/],
  ["applies rush and slowdown to expected arrivals", /eventMultiplier[\s\S]+simulateDemandMinute/],
  ["runs every elapsed five-minute price round", /marketCycleMinutes\(state\.simulated_minute, nextMinute\)/],
  ["links each price round to the active run", /runMarketCycle\(venueSlug[\s\S]+state\.active_run_id[\s\S]+JSON\.stringify\(\{ venueSlug, reason: "venue_test_service", cycleEnd, runId, serviceMinute \}\)/],
  ["completes an instant run in batched local computation", /action === "instant_run"[\s\S]+completeInstantRun[\s\S]+buildInstantSimulation[\s\S]+writeRowsInChunks/],
  ["locks the scheduler out while an instant run is built", /status: action === "instant_run" \? "paused" : "running"/],
  ["paces quick-start progress through the shared simulation clock", /simulationProgress\(state\.simulated_minute[\s\S]+last_tick_at: progress\.lastTickAt/],
  ["paginates complete run totals beyond the Data API row limit", /loadRunSales[\s\S]+limit=\$\{pageSize\}&offset=\$\{offset\}/],
  ["closes the public market when automatic progress completes", /if \(status === "ended"\) \{[\s\S]+setMarketLive\(url, headers, venueId, false\)[\s\S]+finishRun/],
  ["requires signed-in venue administrators before returning simulator data", /authenticatedUserId[\s\S]+venue_members[\s\S]+Only venue owners or admins/],
  ["handles browser CORS preflight requests", /request\.method === "OPTIONS"[\s\S]+corsHeaders/],
];
const simulatorFailures = simulatorChecks
  .filter(([, pattern]) => !pattern.test(simulatorSource))
  .map(([label]) => `supabase/functions/venue-simulator/index.ts: missing ${label}`);

if (simulatorFailures.length) {
  console.error("Supabase function verification failed:");
  simulatorFailures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

const schedulerSource = readFileSync("supabase/functions/service-scheduler/index.ts", "utf8");
const schedulerChecks = [
  ["requires the scheduler secret", /x-night-economy-scheduler-secret/],
  ["loads every venue schedule", /\/venues\?select=id,slug,timezone,market_schedule/],
  ["uses each venue's timezone", /activeSlot\(venue\.market_schedule.*venue\.timezone/],
  ["starts a scheduled service", /action: "scheduled_start"/],
  ["ticks running services", /action: "tick"/],
  ["ends services outside their schedule", /action: "scheduled_end"/],
  ["ticks quick-start services without an open Portal", /serviceAction\(slot, service\)[\s\S]+action === "tick"[\s\S]+action: "tick"/],
];
const schedulerFailures = schedulerChecks
  .filter(([, pattern]) => !pattern.test(schedulerSource))
  .map(([label]) => `supabase/functions/service-scheduler/index.ts: missing ${label}`);

if (schedulerFailures.length) {
  console.error("Supabase function verification failed:");
  schedulerFailures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Supabase function verification passed.");
