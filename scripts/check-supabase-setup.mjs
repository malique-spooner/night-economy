import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const expectedMigrations = [
  "001_initial.sql",
  "002_auth_rls.sql",
  "003_realtime_market.sql",
  "004_site_leads.sql",
  "005_market_sales_velocity.sql",
  "006_venue_market_settings.sql",
  "007_market_product_inserts.sql",
  "008_pos_catalog_and_publications.sql",
  "009_pos_owned_catalogue_portal_rules.sql",
  "010_server_runner_privileges.sql",
  "011_link_demo_market_products_to_pos_products.sql",
  "012_align_demo_catalogue_with_simulator_product_ids.sql",
  "013_tlj_menu_catalogue.sql",
  "014_hide_legacy_demo_catalogue.sql",
  "015_pos_catalogue_grouping.sql",
  "016_configure_wine_market_variants.sql",
  "20260726084640_add_market_schedule.sql",
  "20260726084653_normalize_market_schedule_midnight.sql",
  "20260727062059_curate_live_tv_menu.sql",
  "20260727062121_clear_curated_priority.sql",
  "20260727062930_limit_category_tv_priorities.sql",
  "20260727063247_fill_live_tv_categories.sql",
  "20260728090000_add_venue_test_services.sql",
  "20260728100000_add_internal_venue_simulator_setup.sql",
  "20260729090000_add_cloud_service_scheduler.sql",
  "20260729110000_add_night_economy_dev_venue.sql",
  "20260729120000_add_market_run_history.sql",
  "20260729121000_grant_service_role_market_run_access.sql",
  "20260729130000_reset_stale_market_live_flags.sql",
  "20260729170000_add_platform_admin_memberships.sql",
  "20260729180000_remove_development_venue.sql",
  "20260729190000_rename_demo_venue.sql",
  "20260729200000_add_platform_admins.sql",
  "20260729210000_add_cloud_simulator_controls.sql",
  "20260729220000_add_market_product_logos.sql",
  "20260730092640_grant_market_product_logo_updates.sql",
  "20260730100120_grant_market_schedule_updates.sql",
  "20260730101346_authenticate_service_scheduler_cron.sql",
  "20260730102448_expose_run_sales_to_venue_members.sql",
  "20260730134436_pace_quick_start_ticks.sql",
  "20260730135157_link_run_price_history.sql",
];

const env = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...process.env,
};

const checks = [];

checkMigrations();
checkPublicEnv();
checkPrivateEnv();
checkSupabaseCli();

const failed = checks.filter(check => check.status === "fail");
const warned = checks.filter(check => check.status === "warn");

console.log("Supabase setup status:");
for (const check of checks) {
  const marker = check.status === "pass" ? "ok" : check.status;
  console.log(`- ${marker}: ${check.message}`);
}

if (warned.length) {
  console.log("");
  console.log("Warnings do not block local frontend work, but fix them before deployment.");
}

if (failed.length) {
  console.log("");
  console.log("Next step: add the missing values to .env.local, then rerun npm run supabase:status.");
  process.exit(1);
}

function checkMigrations() {
  const migrationsDir = "supabase/migrations";
  if (!existsSync(migrationsDir)) {
    fail("Supabase migrations folder is missing.");
    return;
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith(".sql"))
    .sort();

  const missing = expectedMigrations.filter(file => !migrationFiles.includes(file));
  const unexpected = migrationFiles.filter(file => !expectedMigrations.includes(file));

  if (missing.length || unexpected.length) {
    fail(
      [
        "Supabase migration list does not match the expected apply order.",
        missing.length ? `Missing: ${missing.join(", ")}.` : "",
        unexpected.length ? `Unexpected: ${unexpected.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    return;
  }

  pass(`Found ${expectedMigrations.length} reviewed migrations in apply order.`);
}

function checkPublicEnv() {
  const url = env.VITE_SUPABASE_URL?.trim() ?? "";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (!url || url === "...") {
    fail("VITE_SUPABASE_URL is missing.");
  } else if (!isValidSupabaseUrl(url)) {
    fail("VITE_SUPABASE_URL must look like https://your-project.supabase.co.");
  } else {
    pass("VITE_SUPABASE_URL is configured.");
  }

  if (!key || key === "..." || key === "your_publishable_key_here") {
    fail("VITE_SUPABASE_PUBLISHABLE_KEY is missing or still a placeholder.");
  } else if (looksLikeSecretKey(key) || hasServiceRoleJwtClaim(key)) {
    fail("VITE_SUPABASE_PUBLISHABLE_KEY appears to be a secret/service-role key.");
  } else {
    pass("VITE_SUPABASE_PUBLISHABLE_KEY is configured and does not look like a service secret.");
  }
}

function checkPrivateEnv() {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const schedulerSecret = env.SCHEDULER_SECRET?.trim() ?? "";

  if (!serviceRoleKey || serviceRoleKey === "your_service_role_key_here") {
    warn("SUPABASE_SERVICE_ROLE_KEY is not set locally. That is fine for frontend work; set it only for Edge Function work.");
  } else {
    pass("SUPABASE_SERVICE_ROLE_KEY is present for server-only setup work.");
  }

  if (!schedulerSecret || schedulerSecret === "your_random_scheduler_secret_here") {
    warn("SCHEDULER_SECRET is not set locally. Set it before deploying or invoking market-cycle.");
  } else {
    pass("SCHEDULER_SECRET is present for market-cycle calls.");
  }
}

function checkSupabaseCli() {
  const result = spawnSync("supabase", ["--version"], { encoding: "utf8" });
  if (result.error) {
    warn("Supabase CLI is not installed or not on PATH. Frontend work can continue; Edge Function deploys need it.");
    return;
  }

  pass(`Supabase CLI is available (${result.stdout.trim() || "version detected"}).`);
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#") && line.includes("="))
      .map(line => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        return [key, stripQuotes(rawValue)];
      }),
  );
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function looksLikeSecretKey(value) {
  return /^sb_secret_/i.test(value) || /service_role/i.test(value);
}

function hasServiceRoleJwtClaim(value = "") {
  const parts = String(value).split(".");
  if (parts.length < 2) return false;

  try {
    const payload = JSON.parse(Buffer.from(toBase64(parts[1]), "base64").toString("utf8"));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function toBase64(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
}

function pass(message) {
  checks.push({ status: "pass", message });
}

function warn(message) {
  checks.push({ status: "warn", message });
}

function fail(message) {
  checks.push({ status: "fail", message });
}
