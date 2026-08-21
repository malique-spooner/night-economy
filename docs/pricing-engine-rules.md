# Night Economy pricing rules

## The idea

- Night Economy is a live drinks market: prices respond to what customers choose during service.
- It does not need historic sales or a target for what counts as “a lot” of sales.
- Every main category is its own independent market. Cocktail sales never affect Wine prices, for example.

## Menu structure

- Every product has one main category and may have a subcategory. These organise the Portal; they do not change the POS product.
- Alcohol-free cocktails belong in `Cocktails` under `Alcohol-free`.
- Beer uses `Draft`, `Cask`, and `0%` subcategories.
- Wine serves are separate POS products because they have separate sell prices. The Portal groups 125ml, 175ml, 250ml, and bottle serves under the wine name.
- Only products that are live and available take part in the market. Sold-out, disabled, or inactive products are excluded.

## The market points rule

- The whole market updates every 5 minutes.
- Each update uses only the previous 5 minutes of POS sales.
- All live categories update together; each drink still competes only with its own category peers.
- If a category has **N** live products, each sale gives the sold product **+(N−1) market points** and creates **−1 point** of relative pressure for each peer. This is the zero-sum comparison used to score drinks that sold in that round.
- If all products sell equally, their positive and negative points cancel out, so every price holds.
- A drink with no sale in a round does not receive a new negative score. It holds, except that any previous upward momentum gently fades. This prevents one popular drink turning an entire TV board red.
- A drink falls only when it did sell but its peers that also sold did relatively better. There is no separate low-sales penalty.
- A category with one live product does not move: it has nobody to compete with.
- A category with no orders does not move.
- Sales points are cleared after each round. Positive market momentum carries forward at 75%, so sustained demand can make a genuine winner travel; a dry round lets that momentum fade.

## How a price changes

- At the end of a round, the engine normalises each drink's relative sales score against live category peers and drinks sold in that category.
- The current default adds 45% of the new sales score to 75% of existing momentum. Clear leaders receive a stronger, curved sales signal; the signal gains confidence as a category records more sales, so a lone order remains small.
- A normal price targets up to 75% of that drink's manager-set range, rather than sitting on a floor or ceiling. It then moves 70% of the way toward that target, capped at 5% of its current price per five-minute round.
- Crashes are separate: the selected category drops to 75% of each drink's available downward range for the configured crash window.
- Prices are rounded to the nearest penny and cannot cross the configured floor or ceiling.
- Every product also has a configured minimum and maximum price. A price cannot cross either limit.

## Operational safeguards

- The POS is the source of sales and availability. Night Economy only reacts to correctly mapped POS products.
- A product must be paused when it is unavailable, otherwise it could lose points without being purchasable.
- The new price is published to the POS before Night Economy presents it as live.
- If sales cannot be read or publication fails, the current price holds and the failure is recorded.

## Demonstration simulator

- The simulator's takings figure is a planning reference used to estimate customer volume. It is not an exact cash total that can override which drinks customers chose.
- Demonstration orders use category **unit-demand shares**. Higher prices can reduce discretionary arrivals and shift customers toward better-value comparable drinks.
- The default Friday-night mix is 45% Beer, 18% Wine, 16% Cocktails, 13% Spirits, and 8% Other Drinks, renormalised across whichever categories the venue actually has live.
- Actual revenue is calculated from the selected drinks and their current market prices, so it may finish above or below the planning reference.
- Real services do not use this demand prior. Their market is driven only by the venue's mapped POS orders.
- See [simulation-engine.md](simulation-engine.md) for the complete rehearsal-demand model.

## Customer explanation

> Drinks compete only with comparable options in their own category. Each purchase gives that drink market points and shares an equal amount of negative pressure across its competitors. Equal demand holds prices steady; stronger demand makes a drink more expensive and weaker demand makes it better value. Every price remains within the venue’s set limits.
# Volume-adaptive demand window

Each category uses the shortest recent window with at least eight sold units: the latest 5 minutes first, then 15 minutes, otherwise 30 minutes. Categories therefore shorten automatically as demand builds and widen again when trade becomes sparse.

Only orders from the newest five minutes trigger a fresh category revaluation. Orders from the wider 15- or 30-minute window provide category-share context: leaders can rise and laggards can fall. After three category orders, untraded peers receive a 25%-strength lack-of-demand signal; one or two isolated orders cannot pull an entire category down. Existing positive and negative momentum then fades naturally through quiet rounds instead of disappearing abruptly.
