import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = "supabase/migrations";
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
];

const migrationFiles = readdirSync(migrationsDir)
  .filter(file => file.endsWith(".sql"))
  .sort();

const migrationSql = Object.fromEntries(
  expectedMigrations.map(file => [file, readFileSync(join(migrationsDir, file), "utf8")]),
);
const allSql = expectedMigrations.map(file => migrationSql[file]).join("\n\n");
const failures = [];

checkMigrationOrder();
checkRequiredPatterns();
checkForbiddenPatterns();

if (failures.length) {
  console.error("Supabase SQL verification failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Supabase SQL verification passed.");

function checkMigrationOrder() {
  const missing = expectedMigrations.filter(file => !migrationFiles.includes(file));
  const unexpected = migrationFiles.filter(file => !expectedMigrations.includes(file));

  if (missing.length) failures.push(`Missing migrations: ${missing.join(", ")}`);
  if (unexpected.length) failures.push(`Unexpected migrations: ${unexpected.join(", ")}`);
}

function checkRequiredPatterns() {
  const required = [
    {
      label: "platform admin access is private to the signed-in admin",
      source: migrationSql["20260729200000_add_platform_admins.sql"],
      pattern: /alter table public\.platform_admins enable row level security[\s\S]+grant select on public\.platform_admins to authenticated[\s\S]+for select[\s\S]+to authenticated[\s\S]+using \(\(select auth\.uid\(\)\) = user_id\)/i,
    },
    {
      label: "venues RLS enabled",
      source: migrationSql["001_initial.sql"],
      pattern: /alter table public\.venues enable row level security/i,
    },
    {
      label: "market products RLS enabled",
      source: migrationSql["001_initial.sql"],
      pattern: /alter table public\.market_products enable row level security/i,
    },
    {
      label: "market logo uploads are restricted to venue admins",
      source: migrationSql["20260729220000_add_market_product_logos.sql"],
      pattern: /create policy "venue admins can upload market logos"[\s\S]+for insert[\s\S]+to authenticated[\s\S]+bucket_id = 'market-logos'[\s\S]+venue_members[\s\S]+role in \('owner', 'admin'\)/i,
    },
    {
      label: "site leads RLS enabled",
      source: migrationSql["004_site_leads.sql"],
      pattern: /alter table public\.site_leads enable row level security/i,
    },
    {
      label: "site leads public insert policy only",
      source: migrationSql["004_site_leads.sql"],
      pattern: /create policy "public can create site leads"[\s\S]+for insert[\s\S]+to anon, authenticated[\s\S]+with check \(source = 'site_signup'\)/i,
    },
    {
      label: "venue members can read only their memberships",
      source: migrationSql["002_auth_rls.sql"],
      pattern: /create policy "members can read their memberships"[\s\S]+for select[\s\S]+to authenticated[\s\S]+using \(\(select auth\.uid\(\)\) = user_id\)/i,
    },
    {
      label: "venue update policy has using and with check",
      source: migrationSql["002_auth_rls.sql"],
      pattern: /create policy "venue members can update their venues"[\s\S]+for update[\s\S]+to authenticated[\s\S]+using[\s\S]+with check[\s\S]+role in \('owner', 'admin'\)/i,
    },
    {
      label: "market product update policy has using and with check",
      source: migrationSql["002_auth_rls.sql"],
      pattern: /create policy "venue members can update market products"[\s\S]+for update[\s\S]+to authenticated[\s\S]+using[\s\S]+with check[\s\S]+role in \('owner', 'admin', 'staff'\)/i,
    },
    {
      label: "market product insert policy checks venue membership",
      source: migrationSql["007_market_product_inserts.sql"],
      pattern: /create policy "venue members can insert market products"[\s\S]+for insert[\s\S]+to authenticated[\s\S]+with check[\s\S]+venue_members[\s\S]+role in \('owner', 'admin', 'staff'\)/i,
    },
    {
      label: "market product insert grant excludes anon",
      source: migrationSql["007_market_product_inserts.sql"],
      pattern: /grant insert[\s\S]+on public\.market_products to authenticated/i,
    },
    {
      label: "venue market settings columns",
      source: migrationSql["006_venue_market_settings.sql"],
      pattern: /add column if not exists market_live[\s\S]+add column if not exists crash_interval_minutes[\s\S]+add column if not exists launch_date[\s\S]+add column if not exists launch_start_time[\s\S]+add column if not exists launch_end_time/i,
    },
    {
      label: "venue crash interval constraint",
      source: migrationSql["006_venue_market_settings.sql"],
      pattern: /venues_crash_interval_minutes_check[\s\S]+check \(crash_interval_minutes in \(15, 30, 60, 120\)\)/i,
    },
    {
      label: "venue market settings update grant excludes anon",
      source: migrationSql["006_venue_market_settings.sql"],
      pattern: /grant update \([\s\S]+market_live[\s\S]+crash_interval_minutes[\s\S]+launch_date[\s\S]+launch_start_time[\s\S]+launch_end_time[\s\S]+updated_at[\s\S]+\) on public\.venues to authenticated/i,
    },
    {
      label: "POS catalogue ownership tables",
      source: migrationSql["008_pos_catalog_and_publications.sql"],
      pattern: /create table if not exists public\.pos_connections[\s\S]+create table if not exists public\.pos_products[\s\S]+add column if not exists pos_product_id/i,
    },
    {
      label: "POS sales and publication audit tables",
      source: migrationSql["008_pos_catalog_and_publications.sql"],
      pattern: /create table if not exists public\.pos_sales_events[\s\S]+create table if not exists public\.price_publications[\s\S]+create table if not exists public\.price_publication_lines/i,
    },
    {
      label: "POS products are read-only for browser clients",
      source: migrationSql["008_pos_catalog_and_publications.sql"],
      pattern: /grant select on public\.pos_connections, public\.pos_products to authenticated/i,
    },
    {
      label: "market product configuration requires a mapped POS product",
      source: migrationSql["009_pos_owned_catalogue_portal_rules.sql"],
      pattern: /create policy "venue members can configure POS products for the market"[\s\S]+pos_product_id is not null[\s\S]+from public\.pos_products pp[\s\S]+pp\.venue_id = market_products\.venue_id/i,
    },
    {
      label: "browser cannot directly change POS-owned prices or availability",
      source: migrationSql["009_pos_owned_catalogue_portal_rules.sql"],
      pattern: /revoke update \([\s\S]+base_price_minor[\s\S]+current_price_minor[\s\S]+is_sold_out[\s\S]+\) on public\.market_products from authenticated/i,
    },
  ];

  for (const check of required) {
    if (!check.pattern.test(check.source)) failures.push(`Missing ${check.label}.`);
  }
}

function checkForbiddenPatterns() {
  const forbidden = [
    {
      label: "deprecated auth.role() policy checks",
      pattern: /auth\.role\(\)/i,
    },
    {
      label: "security definer code in exposed migrations",
      pattern: /security\s+definer/i,
    },
    {
      label: "public read grant on site leads",
      pattern: /grant\s+select[^;]+on public\.site_leads\s+to\s+anon/i,
    },
    {
      label: "anonymous market product writes",
      pattern: /grant\s+(insert|update|delete)[^;]+on public\.market_products\s+to\s+anon/i,
    },
    {
      label: "anonymous venue writes",
      pattern: /grant\s+(insert|update|delete)[^;]+on public\.venues\s+to\s+anon/i,
    },
  ];

  for (const check of forbidden) {
    if (check.pattern.test(allSql)) failures.push(`Found ${check.label}.`);
  }
}
