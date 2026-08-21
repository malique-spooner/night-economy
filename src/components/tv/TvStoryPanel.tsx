import { useEffect, useMemo, useState } from "react";
import type { MarketProduct, Venue } from "../../engine/types";
import { formatMoney } from "../format";
import { categoryLabel, defaultDrinkImage, formatChangePercent, getStoryProducts, productChangePercent, productTrend } from "./tvHelpers";
import { storyArticle } from "./storyArticles";

type Props = {
  category: string | null;
  products: MarketProduct[];
  roundSequence: number;
  venue: Venue;
};

export function TvStoryPanel({ category, products, roundSequence, venue }: Props) {
  const [articleIndex, setArticleIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const storyProducts = useMemo(
    () => getStoryProducts(products.filter(product => product.category === category)),
    [category, products],
  );

  useEffect(() => {
    setStoryIndex(index => index % Math.max(storyProducts.length, 1));
  }, [storyProducts.length]);

  useEffect(() => {
    if (!roundSequence || !storyProducts.length) return;
    setStoryIndex(index => (index + 1) % storyProducts.length);
    setArticleIndex(index => index + 1);
  }, [roundSequence, storyProducts.length]);

  const storyProduct = storyProducts[storyIndex] ?? null;
  const trend = storyProduct ? productTrend(storyProduct) : "dn";
  const story = storyProduct ? storyArticle(storyProduct, articleIndex, venue.currency, categoryPosition(storyProduct, storyProducts), relativeDemand(storyProduct, storyProducts)) : null;

  return (
    <div className={`rpanel story-${trend} ${storyProduct?.isSoldOut ? "story-sold-out" : ""}`}>
      <div className="pview active" id="pv0" key={storyProduct?.id ?? "market-bulletin"}>
        {storyProduct ? <img alt="" className="story-product-art" src={storyProduct.logoUrl ?? defaultDrinkImage(storyProduct.category, storyProduct.id)} /> : <div className="bulletin-art" aria-hidden="true"></div>}
        <div className="panel-tag tag-market">{story ? `${categoryLabel(category ?? "Market")} desk` : "Market bulletin"}</div>
        <div className="bulletin-layout">
          <div className="bulletin-stack">
            <div className="story-a-kicker">{story?.kicker ?? "Room signal"}</div>
            <div className="story-a-headline">{story?.headline ?? "This part of the market is finding its pace."}</div>
            <div className="story-a-copy">{story?.copy ?? "The board will begin reporting as soon as drinks are live in this category."}</div>
            {story && <div className="story-a-fact"><span>{story.factLabel}</span><strong>{story.factValue}</strong></div>}
          </div>
        </div>
        <div className="bulletin-price">
          <span>{story ? "Trading at" : "Current price"}</span>
          <strong>{storyProduct ? formatMoney(storyProduct.currentPriceMinor, venue.currency) : "£—"}</strong>
        </div>
      </div>
    </div>
  );
}

function categoryPosition(product: MarketProduct, products: MarketProduct[]) {
  const rank = products.findIndex(item => item.id === product.id) + 1;
  return rank === 1 ? "at the front of the category" : `#${rank} in the current category read`;
}

function relativeDemand(product: MarketProduct, products: MarketProduct[]) {
  if (products.length < 2) return "The room is still setting the early pace";
  const average = products.reduce((total, item) => total + item.salesVelocity, 0) / products.length;
  if (product.salesVelocity > average * 1.2) return "Demand is running above the category average";
  if (product.salesVelocity < average * 0.8) return "Demand is quieter than the category average";
  return "Demand is tracking with the rest of the category";
}
