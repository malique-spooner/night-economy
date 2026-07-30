# Night Economy

Production-shaped migration repo for the Night Economy pilot.

The visible app now runs through the React/Vite/TypeScript entrypoint at `index.html`. The old static prototype runtime has been removed.

## Stack

- React + Vite + TypeScript
- Cloudflare Pages for frontend hosting
- Supabase Postgres/Auth for backend, data, and login
- Supabase Edge Functions for market jobs
- Vitest for pricing engine tests

See [docs/deployment.md](docs/deployment.md) for the ordered Supabase and Cloudflare deployment checklist.
See [docs/pos-integration-contract.md](docs/pos-integration-contract.md) for the boundary between a POS and Night Economy.
See [docs/friday-service-acceptance.md](docs/friday-service-acceptance.md) for the accelerated local POS acceptance run.
See [docs/testing.md](docs/testing.md) for the required Chromium button-testing contract and test commands.

## Repository Map

- `src/` — the Cloudflare Pages React app, grouped into API access, reusable components, market logic, and route-level pages.
- `pos-simulator/` — the standalone Friday-service POS simulator and its local browser UI.
- `supabase/functions/` — deployed scheduler, simulator, and pricing Edge Functions; shared scheduler logic lives in `_shared/`.
- `supabase/migrations/` — immutable database history in application order. Do not squash migrations already applied to a project.
- `scripts/` — local verification, setup, and operational commands exposed through `package.json`.
- `tests/unit/` and `tests/integration/` — deterministic logic and service-contract coverage.
- `tests/e2e/` — Chromium user workflows for the site, portal, market surfaces, and local POS simulator.

## Run Locally

```bash
npm install
npm run dev
```

Run the local POS Simulator in a second terminal:

```bash
npm run simulator:dev
```

It provides the Friday-night service GUI and POS API at `http://127.0.0.1:3002`.

With real Supabase credentials, the simulator automatically starts its local connector. It polls every 3.75 seconds, imports sales, asks the protected Supabase `market-cycle` function to calculate each five-minute market round, then publishes the resulting prices back to the local POS.

`npm run simulator:market` remains available only when you need to run that connector separately. Use Node.js 22 or newer. `.nvmrc` is set to `22` for local shells that use `nvm`.

Open the app:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/?view=tv
http://127.0.0.1:5173/?view=mobile
http://127.0.0.1:5173/?view=site
http://127.0.0.1:5173/?view=portal
http://127.0.0.1:5173/tv/demo-venue
http://127.0.0.1:5173/menu/demo-venue
http://127.0.0.1:5173/app/demo-venue
```

`?view=` routes are local shortcuts. Production-shaped venue routes use `/venue/:slug`, `/tv/:slug`, `/menu/:slug`, and `/app/:slug`.

## Environment

Create `.env.local` from `.env.example`:

```text
VITE_SUPABASE_URL=https://ghhfmsmmwyycuwauvppg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Only use these in local setup scripts or Supabase Edge Function secrets:

```text
SUPABASE_SERVICE_ROLE_KEY=...
SCHEDULER_SECRET=...
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser or Cloudflare Pages frontend variables.
`npm run check:env` rejects service-role JWTs and Supabase secret keys in any `VITE_` browser variable.

## Cloudflare Pages

Cloudflare Pages config lives in `wrangler.jsonc`:

```text
name: night-econemy
pages_build_output_dir: ./dist
```

Build command:

```bash
npm run build:production
```

Build output directory:

```text
dist
```

Frontend variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Local builds can use `npm run build`. Production deploys should use `npm run build:production` so missing Supabase config fails before Cloudflare publishes the site.

`public/_redirects` sends all app routes to `index.html`, the React entrypoint.

Local `npm run check` verifies the Cloudflare config with `npm run cloudflare:config`.

## Pre-Deploy Check

Run this before pushing a deploy branch:

```bash
npm run smoke:preview
```

It builds the app, starts Vite's production preview server, and checks the React root, local view shortcuts, and production venue routes.
It also validates the Cloudflare Pages redirect rule so production venue routes hit the React app.
