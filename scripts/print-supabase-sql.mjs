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
  "20260730092640_grant_market_product_logo_updates.sql",
  "20260730100120_grant_market_schedule_updates.sql",
  "20260730101346_authenticate_service_scheduler_cron.sql",
  "20260730102448_expose_run_sales_to_venue_members.sql",
  "20260730134436_pace_quick_start_ticks.sql",
  "20260730135157_link_run_price_history.sql",
];

const migrationFiles = readdirSync(migrationsDir)
  .filter(file => file.endsWith(".sql"))
  .sort();

const missing = expectedMigrations.filter(file => !migrationFiles.includes(file));
const unexpected = migrationFiles.filter(file => !expectedMigrations.includes(file));

if (missing.length || unexpected.length) {
  console.error("Supabase migration list does not match the expected apply order.");
  if (missing.length) console.error(`Missing: ${missing.join(", ")}`);
  if (unexpected.length) console.error(`Unexpected: ${unexpected.join(", ")}`);
  process.exit(1);
}

console.log("-- Night Economy Supabase setup SQL");
console.log("-- Apply this in the Supabase SQL editor for the target project.");
console.log("-- Review each section before running in production.");

for (const file of expectedMigrations) {
  const path = join(migrationsDir, file);
  const sql = readFileSync(path, "utf8").trim();

  console.log("");
  console.log(`-- ============================================================================`);
  console.log(`-- ${file}`);
  console.log(`-- ============================================================================`);
  console.log(sql);
  console.log("");
}
