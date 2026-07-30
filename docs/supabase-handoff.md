# Supabase Handoff

Use this when connecting the local app to the real Supabase project.

## 1. Public Frontend Key

Create the ignored local env file:

```bash
npm run setup:env
```

In Supabase, open the target project and copy:

```text
Project Settings -> API -> Project URL
Project Settings -> API -> Publishable key
```

Paste them into `.env.local`:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Do not put `SUPABASE_SERVICE_ROLE_KEY`, `SCHEDULER_SECRET`, `sb_secret_*`, or any service-role JWT in a `VITE_*` variable.

Verify local config:

```bash
npm run supabase:status
npm run launch:readiness
```

## 2. Database Setup

Create the two scheduler Vault entries first. Use the legacy anonymous JWT for
the gateway credential, never a service-role key:

```sql
select vault.create_secret('<SCHEDULER_SECRET>', 'night_economy_scheduler_secret');
select vault.create_secret('<legacy anon JWT from Project Settings -> API>', 'night_economy_scheduler_anon_key');
```

Print the reviewed SQL bundle:

```bash
npm run supabase:sql
```

Paste the output into the Supabase SQL editor and run it once. Then verify the public app can read seeded data:

```bash
npm run supabase:smoke-live
```

This smoke check reads the same venue and product columns used by the React pages and market job, so it catches missing migrations before deployment.

## 3. Operator Access

Create the operator in Supabase Auth, then print the access grant:

```bash
npm run supabase:grant-operator -- --email=operator@example.com --role=owner --venue=ven_demo
```

Paste the printed SQL into the SQL editor. Expected affected rows: `1`.

Roles:

```text
owner/admin: venue settings and product edits
staff: product edits only
```

## 4. Edge Function

Set these as Supabase Edge Function secrets only:

```text
SUPABASE_SERVICE_ROLE_KEY
SCHEDULER_SECRET
```

Deploy:

```bash
supabase functions deploy market-cycle
```

The function skips price updates while the venue is paused.
