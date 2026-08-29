# Manager input and market-engine validation

## Decision

The price calculation is safe across the tested manager settings, but the complete market workflow is **not ready to call production-safe** until two integration defects are fixed:

1. A drink that remains marked live after losing its POS mapping can still be repriced. This directly breaks the rule that every live drink must be connected to the POS.
2. Publishing one market round is not atomic. Product price updates run concurrently; if one update fails after another succeeds, the database can contain a partial round without its matching published snapshot.

The simulator also needs turnover calibration before “expected takings” can be presented as an unbiased forecast. The standard £10,000 setup averages £10,588, a **+5.89% bias** (95% CI: +5.50% to +6.28%).

## What was tested

- 32 stochastic configurations covering expected takings from £0 to £50,000, symmetric and asymmetric manager price ranges, 1/2/5/10 live drinks per category, imbalanced category menus, equal and runaway demand, sold-out/paused/unmapped products, low/high customer price sensitivity, one-/three-/six-hour services, and 5-/10-minute plus four-crash schedules.
- 62,025 primary services and 15,525 independently seeded holdout services: **77,550 services in total**.
- Exact checks for no sales, equal sales, one isolated order, a sustained winner, a demand reversal, rotating leaders, adaptive 5/15/30-minute windows, crash target and duration, Quick Start timing, and an unmapped product.
- Source-path checks for duplicate-cycle protection, failure propagation, snapshot ordering and publication atomicity.

Primary estimates use two-sided 95% confidence intervals over independent seeded services. The holdout uses different seeds. Across 64 primary-versus-holdout comparisons, three fell outside the nominal 95% interval—almost exactly the 3.2 expected by chance—with a largest absolute standardized difference of 2.32. The findings therefore reproduce out of sample.

## Safety results

Across **72,550 services that did not deliberately include the known mapping defect**, there were:

- zero manager floor or ceiling breaches;
- zero normal rounds above the exact 5% penny-rounded cap;
- zero price changes for paused or sold-out drinks;
- zero near-limit decisions, confirming that the 75%-of-range target buffer is working.

With zero failures, the aggregate rule-of-three upper 95% bound is 0.0042% of tested services. This is strong simulation evidence, not a guarantee about untested production infrastructure.

The mapping failure is severe and systematic: **2,313,693 of 2,520,000 possible unmapped-product decisions changed price (91.81%)** across the primary and holdout samples. The exact three-drink check reproduces the issue immediately: a mapped winner causes the unmapped peer to fall from 1000 to 992.

## How the market moves

| Manager setup | Mean actual takings vs target | Mean product night range | Moving price rounds |
|---|---:|---:|---:|
| £500 expected takings | 108.16% ± 1.87% | 1.00% | 19.19% |
| £2,500 expected takings | 106.52% ± 0.77% | 4.01% | 68.55% |
| £10,000 standard setup | 105.89% ± 0.39% | 9.70% | 94.01% |
| £25,000 expected takings | 105.00% ± 0.25% | 12.65% | 97.10% |
| £50,000 stress case | 103.62% ± 0.17% | 13.64% | 98.05% |

The adaptive window solves the original “quiet wine never moves” problem without manufacturing movement at zero volume: a £500 service moves only 19% of decisions and averages a 1% night range, while normal and busy nights become progressively more active.

However, the standard setup changes a price in 94% of product-round decisions. That is a product choice, not a safety failure. Before launch, define an acceptable movement-cadence target from real venue data; otherwise the engine can be mathematically correct yet visually too busy.

## Manager ranges and menu size

| Configuration | Mean product night range | Mean round move | Moving rounds |
|---|---:|---:|---:|
| ±5% manager range | 2.44% | 0.18% | 82.65% |
| ±10% manager range | 4.86% | 0.36% | 89.83% |
| ±20% standard range | 9.70% | 0.72% | 94.01% |
| ±40% manager range | 18.96% | 1.45% | 96.07% |
| 1 live drink/category | 0.00% | 0.00% | 0.00% |
| 2 live drinks/category | 15.29% | 1.14% | 94.89% |
| 5 live drinks/category | 13.81% | 1.03% | 94.52% |
| 10 live drinks/category | 10.71% | 0.79% | 94.19% |

One drink correctly produces no market because there is no peer comparison. Two-drink categories are the most volatile: the same demand difference is concentrated across fewer competitors. A launch rule of at least three live mapped drinks per category, or a peer-count dampener, should be considered if 15% average night ranges are too aggressive.

## Crash behaviour

- One five-minute crash: 12.21% mean night range.
- One ten-minute crash: 12.22% mean night range.
- Four mixed crashes: 19.19% mean night range.
- Exact schedule checks confirm that a five-minute crash occupies one pricing round and a ten-minute crash occupies two.
- Crash prices use 75% of the manager’s downward range and never crossed a floor in the experiment.

The similar five- and ten-minute ranges are expected: duration holds the crash price longer but the initial crash depth is the same.

## Simulator calibration finding

The configured expected basket size is 2.55 units, but the weighted mean of the simulator’s own party-size distribution is 2.76 units—an **8.24% internal mismatch**. Price response and abandoned purchases reduce the final effect, leaving the observed +3.62% to +8.16% takings bias depending on volume.

This is a model-calibration issue, not random noise. Recalculate the expected basket denominator from the actual party-size distribution, then rerun the same matrix before using expected takings as a planning figure.

## Required next actions

1. Filter `priceMarket` competitors on `pos_product_id` as well as live/sold-out state, and add the exact unmapped regression check to the normal unit suite.
2. Move a market round into one transactional database RPC: validate mappings, update all prices, create the snapshot and create publication records atomically.
3. Recalibrate expected basket units, rerun the 2,000 + 500 service samples, and require the turnover CI to include 100% or remain within an agreed tolerance.
4. Choose launch acceptance bands for movement cadence and two-drink-category volatility using real venue sales. The simulation cannot prove human realism without production demand data.
5. Run connector-sandbox fault injection for timeouts, partial provider rejection and retry/idempotency before enabling external POS writes.

## Reproducibility

- Harness: `scripts/test-manager-input-matrix.ts`
- Primary data: `analysis/manager-input-matrix-primary.json`
- Holdout data: `analysis/manager-input-matrix-holdout.json`
- Corrected availability rows: `analysis/manager-input-matrix-primary-correction.json` and `analysis/manager-input-matrix-holdout-correction.json`
- Executed analysis: `analysis/manager-input-validation.ipynb`

The tests execute the production shared pricing, demand, crash and simulation-clock modules directly. They do not replace a Supabase transaction test or a real POS connector certification.
