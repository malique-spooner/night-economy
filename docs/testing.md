# Testing Policy

Night Economy uses three complementary test layers:

- Vitest unit tests for pricing, scheduling, mapping, and other deterministic logic.
- Playwright Chromium tests for user-visible workflows and every new or changed button.
- Read-only live cloud verification for deployed Supabase schema, functions, and synchronized data.

## Required button contract

A button is not complete until a Chromium test clicks it and verifies its desired outcome. Rendering the button, taking a screenshot, testing only its handler, or asserting only that a request occurred is insufficient when the product outcome can also be observed.

Examples of acceptable outcomes include:

- The expected page or tab opens.
- A dialog opens, closes, confirms, or cancels correctly.
- The visible service state changes to running, paused, resumed, or ended.
- The exact persistence or Edge Function payload is sent and the saved state appears.
- A disabled or unauthorized action produces the expected safe behavior and no write.

Tests should use accessible roles and names first. If a control cannot be selected that way, fix its accessibility before adding a weaker selector.

## Commands

```bash
npm run test:unit
npm run test:e2e
npm run test:all
npm run source:verify
npm run check
```

To validate the deployed Cloudflare Pages build without mutating production Supabase data:

```bash
E2E_BASE_URL=https://night-econemy.pages.dev npx playwright test
```

The Playwright suite mocks write boundaries deterministically. Real cloud state is checked separately with:

```bash
npm run supabase:verify-cloud-sync
```

`source:verify` fails when an application file is no longer reachable from `src/main.tsx`, preventing abandoned components and helpers from accumulating unnoticed.

Local Playwright runs also start the standalone Friday POS simulator and click its event and sold-out controls. Deployed runs skip only that local-only page because it is not hosted on Cloudflare Pages.
