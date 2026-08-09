import { useEffect, useMemo, useState } from "react";
import type { MarketProduct, Venue } from "../../engine/types";
import { formatMoney } from "../format";
import { defaultDrinkImage, formatChangePercent, getStoryProducts, movementLabel, productTrend } from "./tvHelpers";

type Props = {
  products: MarketProduct[];
  venue: Venue;
};

export function TvStoryPanel({ products, venue }: Props) {
  const [storyIndex, setStoryIndex] = useState(0);
  const storyProducts = useMemo(
    () => getStoryProducts(products.filter(product => venue.tvStoryCategories.includes(product.category))),
    [products, venue.tvStoryCategories],
  );

  useEffect(() => {
    setStoryIndex(index => index % Math.max(storyProducts.length, 1));
  }, [storyProducts.length]);

  useEffect(() => {
    if (storyProducts.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setStoryIndex(index => (index + 1) % storyProducts.length);
    }, 7_000);
    return () => window.clearInterval(timer);
  }, [storyProducts.length]);

  const storyProduct = storyProducts[storyIndex] ?? null;
  const trend = storyProduct ? productTrend(storyProduct) : "dn";

  return (
    <div className={`rpanel story-${trend} ${storyProduct?.isSoldOut ? "story-sold-out" : ""}`}>
      <div className="pview active" id="pv0" key={storyProduct?.id ?? "market-bulletin"}>
        {storyProduct ? <img alt="" className="story-product-art" src={storyProduct.logoUrl ?? defaultDrinkImage(storyProduct.category)} /> : <div className="bulletin-art" aria-hidden="true"></div>}
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
