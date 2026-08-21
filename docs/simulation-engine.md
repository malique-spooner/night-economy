# Simulation engine

The rehearsal simulator creates plausible POS demand; it does not alter the pricing rules used for real venues. Quick Start, instant runs, scheduled demonstrations, and the standalone local POS simulator all use the shared customer-demand implementation in `supabase/functions/_shared/customerDemand.ts`.

## One simulated minute

1. The configured takings figure and Friday time-of-night curve determine expected footfall.
2. A seeded Poisson arrival model creates a variable number of customer groups, including naturally quiet minutes and short clusters.
3. Each group receives a weighted party size from one to six and orders a basket of drinks.
4. Category choice starts with the pub unit-demand prior and changes gradually through the evening.
5. Product choice combines stable popularity, smooth run-specific trends, recent 30-minute social proof, availability, and current price relative to base.
6. A higher overall board can lose discretionary groups; cheaper comparable products become more attractive.
7. Generated basket lines are stored as normal POS sales. Every five minutes the production pricing engine calculates and publishes the next prices.
8. Those prices feed back into the next customers' choices.

## Reproducibility

The run ID is the random seed. Different runs create different nights, while replaying the same seed produces the same result for testing. Trends evolve through overlapping smooth waves; there is no declared hourly winner or abrupt scheduled popularity switch.

## Interpretation

The takings setting is an expected-trade input, not a promised total. Realised sales and revenue can finish above or below it because arrivals, baskets, live prices, rushes, slowdowns, and customer choices are outcomes of the model.

This is a demonstration model, not a revenue forecast. Category mix, price elasticity, party sizes, and popularity should eventually be calibrated from anonymised venue POS history.
