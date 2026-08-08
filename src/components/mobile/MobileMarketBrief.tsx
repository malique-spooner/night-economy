import type { MarketProduct, Venue } from "../../engine/types";
import { defaultDrinkImage, formatChangePercent, getStoryProduct, mobilePriceStatusLabel, productTrend } from "../tv/tvHelpers";

type Props = {
  products: MarketProduct[];
  venue: Venue;
};

export function MobileMarketBrief({ products, venue }: Props) {
  const upCount = products.filter(product => productTrend(product) === "up").length;
  const downCount = products.length - upCount;
  const highestMover = getStoryProduct(products);

  return (
    <section className="mobile-market-brief" aria-label="Live market summary">
      <div>
        <span className="mobile-kicker">{mobilePriceStatusLabel(venue)}</span>
        <h1>Tonight&apos;s market</h1>
      </div>
      <div className="mobile-market-tape">
        <span>{upCount} up · {downCount} down</span>
        <strong>
          {highestMover ? (
            <img
              alt=""
              className="mobile-market-tape-art"
              src={highestMover.logoUrl ?? defaultDrinkImage(highestMover.category)}
            />
          ) : null}
          {highestMover ? formatChangePercent(highestMover).replace("+", "▲ ") : "▲ 0.0%"}
        </strong>
      </div>
    </section>
  );
}
