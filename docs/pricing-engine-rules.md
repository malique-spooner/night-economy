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
- If a category has **N** live products, each sale gives the sold product **+(N−1) market points**.
- That same sale gives every other live product in the category **−1 point**.
- This makes every sale exactly zero-sum: the category’s total points always equal zero.
- Example: with three live cocktails, one Espresso Martini sale gives Espresso Martini `+2`, and each other cocktail `−1`.
- If all products sell equally, their positive and negative points cancel out, so every price holds.
- A product falls only when its peers collectively earn more points. There is no separate low-sales penalty.
- A category with one live product does not move: it has nobody to compete with.
- A category with no orders does not move.
- Points are cleared after each round. Old service does not keep influencing the current market.

## How a price changes

- At the end of a round, the engine normalises each drink's points against the number of live category peers and drinks sold in that category.
- More category sales make the signal more confident; one isolated purchase has less effect than a sustained rush.
- The movement is scaled to that drink's own manager-set floor-to-ceiling range. A wider permitted range creates a more mobile market; a tighter range creates a calmer one.
- There is no artificial per-round cap. The manager-set floor and ceiling are the only hard limits.
- The percentage is applied to the current price, then rounded to the nearest penny.
- Every product also has a configured minimum and maximum price. A price cannot cross either limit.

## Operational safeguards

- The POS is the source of sales and availability. Night Economy only reacts to correctly mapped POS products.
- A product must be paused when it is unavailable, otherwise it could lose points without being purchasable.
- The new price is published to the POS before Night Economy presents it as live.
- If sales cannot be read or publication fails, the current price holds and the failure is recorded.

## Customer explanation

> Drinks compete only with comparable options in their own category. Each purchase gives that drink market points and shares an equal amount of negative pressure across its competitors. Equal demand holds prices steady; stronger demand makes a drink more expensive and weaker demand makes it better value. Every price remains within the venue’s set limits.
