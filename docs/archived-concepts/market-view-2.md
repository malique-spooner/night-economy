# Archived concept: TV Market View 2

Status: parked — removed from production on 15 August 2026.

## What was explored

An alternate TV screen showing a category of drinks as a 4 × 3 market-chart screener. It progressed through a centred-base-price chart treatment and a TradingView-inspired chart-screener treatment.

## Why it is parked

Neither treatment made the TV more useful or compelling than the existing live market board. The feature added a second navigation state, a heavy charting dependency, and a large amount of visual logic without a clear guest-facing purpose.

## What has been removed from production

- The Market View switch in the TV header.
- The graph-screen component and its client-side chart dependency.
- The dedicated TV history query and database function.

## How to revisit safely

Start with the job of the screen, not a chart layout. Define the audience, the single action or feeling it should create, and a visual reference that fits Night Economy. Build it as an isolated prototype first; only introduce a second production TV view once that prototype is approved.

The implementation was intentionally not retained as dormant application source. This note preserves the decision and the design direction needed to start a future prototype cleanly.
