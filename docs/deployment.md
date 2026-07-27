# Deployment Checklist

Use this order when taking the React app toward a real deployment.

For the detailed Supabase connection flow, see [supabase-handoff.md](./supabase-handoff.md).

## 1. Local Gates

```bash
npm install
npm run check
npm run launch:readiness
```

`npm run check` includes a Supabase SQL/RLS verifier so migration guardrails are checked before deployment.
The preview smoke test also verifies the Cloudflare redirect map for `/tv/*`, `/menu/*`, `/app/*`, and `/venue/*`.
`npm run launch:readiness` summarizes runtime, Cloudflare, Supabase SQL, function, env, and live-readiness status.

For a production build, also verify the real public Supabase variables:

```bash
npm run setup:env
npm run supabase:status
npm run build:production
```

`build:production` requires:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Never put `SUPABASE_SERVICE_ROLE_KEY` or `SCHEDULER_SECRET` in Cloudflare Pages frontend variables.

## 2. Supabase SQL

Print the reviewed SQL bundle:

```bash
npm run supabase:sql
```

Apply the output in the Supabase SQL editor for the target project. The bundle includes:

```text
001_initial.sql
002_auth_rls.sql
003_realtime_market.sql
004_site_leads.sql
005_market_sales_velocity.sql
006_venue_market_settings.sql
007_market_product_inserts.sql
008_pos_catalog_and_publications.sql
009_pos_owned_catalogue_portal_rules.sql
010_server_runner_privileges.sql
011_link_demo_market_products_to_pos_products.sql
012_align_demo_catalogue_with_simulator_product_ids.sql
013_tlj_menu_catalogue.sql
014_hide_legacy_demo_catalogue.sql
015_pos_catalogue_grouping.sql
016_configure_wine_market_variants.sql
20260726084640_add_market_schedule.sql
20260726084653_normalize_market_schedule_midnight.sql
20260727062059_curate_live_tv_menu.sql
20260727062121_clear_curated_priority.sql
20260727062930_limit_category_tv_priorities.sql
20260727063247_fill_live_tv_categories.sql
```

After applying SQL, create a Supabase Auth operator user and print the venue access grant:

```bash
npm run supabase:grant-operator -- --email=operator@example.com --role=owner --venue=ven_demo
```

Copy the printed SQL into the Supabase SQL editor.

Then verify the public app can read venue data:

```bash
npm run supabase:smoke-live
```

## 3. Supabase Edge Function

Set Supabase function secrets:

```text
SUPABASE_SERVICE_ROLE_KEY
SCHEDULER_SECRET
```

Deploy the market job from an environment with the Supabase CLI and Deno available:

```bash
supabase functions deploy market-cycle
```

Schedule the deployed function every **5 minutes**. Each run updates every live category from the previous five minutes of POS sales.

Invoke it only with the scheduler header:

```text
x-night-economy-scheduler-secret: <SCHEDULER_SECRET>
```

## 4. Cloudflare Pages

Cloudflare Pages config is in `wrangler.jsonc`.

Use:

```text
Build command: npm run build:production
Build output: dist
Node.js: 22+
```

Set only these frontend variables in Cloudflare Pages:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

`public/_redirects` sends all routes to `index.html`, the React app entrypoint.

## 5. Post-Deploy Smoke

Check:

```text
/
/?view=site
/?view=tv
/?view=mobile
/?view=portal
/tv/demo-venue
/menu/demo-venue
/app/demo-venue
/venue/demo-venue
```

Then test one real signup lead and one portal product edit against Supabase.
