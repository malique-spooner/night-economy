import { readFileSync } from "node:fs";

const functionFiles = ["supabase/functions/market-cycle/index.ts"];
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
  {
    label: "uses the range-aware market setting",
    pattern: /MARKET_INTENSITY = 1\.25[\s\S]+activityFactor[\s\S]+allowedRange/,
  },
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
