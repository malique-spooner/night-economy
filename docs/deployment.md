# Deployment Checklist

Use this order for both first-time setup and routine production deployments.

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

Apply the output in the Supabase SQL editor for the target project. The bundle
contains every file in `supabase/migrations/`, in lexicographic order. Those
files are immutable production history: add a migration for a schema change;
never edit, delete, or squash one already applied to a project.

`npm run supabase:verify-sql` checks ordering, security guardrails, and expected
migration coverage without maintaining a second, stale filename list here.

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

Create `.env.local` with the public project URL/key for frontend builds and the
server-only values for operational scripts. Never put a service or scheduler
secret in a `VITE_*` variable.

Before applying the SQL bundle, store the scheduler's private header secret and
the project's legacy anonymous JWT in Supabase Vault. The anonymous JWT only
passes the Edge Function gateway; `service-scheduler` still requires the
separate private scheduler secret.

```sql
select vault.create_secret('<SCHEDULER_SECRET>', 'night_economy_scheduler_secret');
select vault.create_secret('<legacy anon JWT from Project Settings -> API>', 'night_economy_scheduler_anon_key');
```

Deploy the cloud jobs:

```bash
supabase functions deploy market-cycle
supabase functions deploy venue-simulator
supabase functions deploy service-scheduler
```

`service-scheduler` runs every minute in Supabase Cron. It reads every prepared
venue's own weekly schedule in its configured timezone, starts/stops its cloud
simulator, and triggers the pricing engine every five minutes while open. It
continues running when no Portal, TV, or venue computer is open.

After importing each venue menu, prepare its default cloud simulator once:

```bash
NIGHT_ECONOMY_VENUE_SLUG=your-venue-slug npm run supabase:prepare-test-service
```

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

Finally verify that the deployed scheduler, simulator state, run history, and
mapped POS prices all use the same cloud data:

```bash
npm run supabase:verify-cloud-sync
```
