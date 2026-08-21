# Archived concept: Market Pulse presenter

Status: parked — not in production scope.

## The idea

During the TV's market-data view, an animated Night Economy presenter enters briefly to deliver a short insider tip drawn from a real market movement, then exits without interrupting the board.

Example: “Guinness is heating up — 5.4% above its opening price.”

## Why it is parked

The current priority is making the core TV views useful and visually resolved. A presenter needs a settled character design, motion direction, audio/accessibility decisions, and carefully defined data rules. Adding it now would create a feature shell before those foundations exist.

## Rules if revisited

- Keep it separate from the pricing engine and normal TV rendering path.
- Show only a verified, explainable data signal; never invent urgency or advice.
- Appear sparingly, for about 6–8 seconds, and never block a price, chart, or the live ticker.
- Make motion optional and respect reduced-motion preferences.
- Build it as an isolated TV overlay component, behind a feature flag, only after the character artwork and motion treatment are approved.

## Revisit when

1. The final Market View 2 direction is approved.
2. The Night Economy character and its visual style are defined.
3. We have agreed the precise signals and wording it can use.
