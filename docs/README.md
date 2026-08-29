# Project documentation

This folder holds the notes that explain how Night Economy runs, plus visual reference material used when designing the experience.

## Guides

- [Deployment checklist](deployment.md) — how the frontend and Supabase services are released.
- [Testing guide](testing.md) — the checks to run before publishing changes.
- [Pricing engine rules](pricing-engine-rules.md) — how drink prices are calculated and kept fair.
- [Simulation engine](simulation-engine.md) — how rehearsal customers, baskets, trends, and price response are generated.
- [POS integration contract](pos-integration-contract.md) — how a point-of-sale system connects to Night Economy.
- [Friday service acceptance](friday-service-acceptance.md) — a short local end-to-end service test.
- [Manager-input validation](manager-input-market-engine-validation.md) — evidence and checks for the manager-input pricing matrix.
- [Showcase drink image sources](showcase-drink-image-sources.md) — provenance for the image URLs used by Showcase and The Last Judgment.

## Maintenance rules

- Keep one source of truth for shared pricing and demand logic; use the sync checks rather than copying logic between services.
- Treat Supabase migrations as immutable history. Add a migration, then update the SQL verifier when a new migration becomes part of the supported production schema.
- Run `npm run check` before a release. It includes type checks, source-reachability checks, unit/E2E coverage, configuration validation, SQL safety checks, and a production-preview smoke test.

## Visual references

`visual-references/` keeps brand and drink imagery together. These files are reference material rather than live website assets, so it is safe to browse them without affecting the app.
