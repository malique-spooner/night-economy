# Pricing experiment

Run the revenue experiment with:

```bash
npm run pricing:experiment
```

It screens 81 combinations of momentum retention, sales-signal weight, buffered target range, and target approach rate. The five most promising combinations are then compared across 1,000 matched simulated services each.

The simulator uses a £10,000 base-price service as the demand reference. It does **not** force a revenue result. Customers prefer cheaper comparable drinks and a higher overall board loses a proportion of discretionary orders. The same seeded services are reused for every configuration, so a busy or quiet night cannot choose the winner.

Candidates are rejected when more than 5% of their price decisions sit in the final 10% of a manager-set floor or ceiling.

## 17 August 2026 result

After adding confidence-weighted leadership scoring, the 8,050-service experiment identified a revenue-positive default:

- 75% momentum retention
- 45% new sales-signal weight
- 75% target-range use
- 70% target approach rate

It averaged £10,105.64 per service versus £10,037.00 for the base-price control: **+0.68% revenue**, with 0% of decisions near a price limit.

This supports the new default in simulation, but it is not a substitute for real POS evidence. Calibrate price elasticity and substitution from venue data, then repeat the experiment before treating the uplift as a production forecast.
