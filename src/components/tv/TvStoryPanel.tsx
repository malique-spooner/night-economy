import type { MarketProduct, Venue } from "../../engine/types";
import { formatMoney } from "../format";
import { formatChangePercent, getStoryProduct, movementLabel, productTrend } from "./tvHelpers";

type Props = {
  products: MarketProduct[];
  venue: Venue;
};

export function TvStoryPanel({ products, venue }: Props) {
  const storyProduct = getStoryProduct(products);
  const trend = storyProduct ? productTrend(storyProduct) : "dn";

  return (
    <div className={`rpanel story-${trend} ${storyProduct?.isSoldOut ? "story-sold-out" : ""}`}>
      <div className="pview active" id="pv0">
        {storyProduct?.logoUrl ? <img alt="" className="story-product-art" src={storyProduct.logoUrl} /> : storyProduct ? <div aria-hidden="true" className={`story-product-fallback ${trend}`}><i></i><i></i><i></i></div> : <div className="bulletin-art" aria-hidden="true"></div>}
        <div className="panel-tag tag-market">Breaking News</div>
        <div className="bulletin-layout">
          <div className="bulletin-stack">
            <div className="story-a-kicker">{storyProduct ? movementLabel(storyProduct) : "Room signal"}</div>
            <div className="story-a-headline">
              {storyProduct ? `${storyProduct.name} is setting the pace.` : "Cocktails are setting the pace."}
            </div>
            <div className="story-a-copy">
              {storyProduct
                ? `${formatChangePercent(storyProduct)} from the base price as the room leans into the board.`
                : "A short read on where the room is leaning next."}
            </div>
          </div>
        </div>
        <div className="bulletin-price">
          <span>Current price</span>
          <strong>{storyProduct ? formatMoney(storyProduct.currentPriceMinor, venue.currency) : "£—"}</strong>
        </div>
      </div>
    </div>
  );
}
