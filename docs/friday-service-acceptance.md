# Friday Service Acceptance Run

Use this run after applying all Supabase migrations and configuring a real Supabase project. It proves the POS boundary and the cloud market engine across one accelerated service.

The deterministic simulator/runner integration suite can run without Supabase credentials:

```bash
npm run simulator:verify
```

## Start the local apps

```bash
npm run dev
npm run simulator:dev
```

Open:

```text
Night Economy Portal: http://127.0.0.1:5173/app/demo-venue
Night Economy TV:     http://127.0.0.1:5173/tv/demo-venue
POS Simulator:        http://127.0.0.1:3002
```

`npm run simulator:dev` starts the local connector automatically. It imports simulated sales, calls the protected Supabase `market-cycle` function for each virtual five-minute round, and applies its returned prices to the simulated POS. Server credentials must remain in `.env` or `.env.local`; never expose them to the browser.

## Run the service

1. In the POS Simulator, set the pace and start the 18:00–00:00 Friday service.
2. Optionally trigger a rush, a slowdown, or one sold-out product during service.
3. Let the simulator reach midnight. At 32x the six-hour service takes about 11 real minutes.

## Pass criteria

- The POS Simulator owns every product and records all sales.
- The Portal shows the live market price and only permits market configuration fields to be edited.
- Imported rows appear in `pos_sales_events` without duplicate sale IDs.
- Price publications appear in `price_publications` and `price_publication_lines`.
- Every published market price matches the simulator's current POS price.
- No price crosses its configured floor or ceiling.
- Portal, TV, and Mobile reflect the published Supabase market price after each cloud market cycle.
