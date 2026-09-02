import { useEffect, useMemo, useState } from "react";
import type { MarketProduct, Venue } from "../../engine/types";
import { formatMoney } from "../format";
import { categoryLabel, defaultDrinkImage, formatChangePercent, productChangePercent, productTrend } from "./tvHelpers";
import { storyArticle } from "./storyArticles";

type Props = {
  category: string | null;
  products: MarketProduct[];
  roundSequence: number;
  venue: Venue;
};

export function TvStoryPanel({ category, products, roundSequence, venue }: Props) {
  const [articleIndex, setArticleIndex] = useState(0);
  const storyProduct = useMemo(
    () => weightedStoryProduct(products.filter(product => product.category === category), roundSequence),
    [category, products, roundSequence],
  );

  useEffect(() => {
    if (!roundSequence || !storyProduct) return;
    setArticleIndex(index => index + 1);
  }, [roundSequence, storyProduct]);

  const trend = storyProduct ? productTrend(storyProduct) : "dn";
  const story = storyProduct ? storyArticle(storyProduct, articleIndex, venue.currency, marketPosition(storyProduct), demandSignal(storyProduct), venue.tvStoryArticleIds) : null;

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

const storyStateRotation = ["easing", "easing", "easing", "easing", "featured", "featured", "featured", "steady", "steady", "rising"] as const;

// The right-hand TV story is editorial, not a report of whichever movement
// happens to be largest. Its ten-round cycle deliberately gives easing four
// slots, featured three, steady two and rising one. Missing states fall back
// to the next available slot, so the panel always has a relevant drink.
export function weightedStoryProduct(products: MarketProduct[], roundSequence: number) {
  const liveProducts = products.filter(product => product.isLive && !product.isSoldOut);
  const byState = {
    easing: liveProducts.filter(product => !product.priority && productTrend(product) === "dn"),
    featured: liveProducts.filter(product => product.priority),
    steady: liveProducts.filter(product => !product.priority && productTrend(product) === "hold"),
    rising: liveProducts.filter(product => !product.priority && productTrend(product) === "up"),
  };
  const ordered = (items: MarketProduct[]) => [...items].sort((left, right) => {
    const movement = Math.abs(productChangePercent(right)) - Math.abs(productChangePercent(left));
    return movement || left.name.localeCompare(right.name);
  });
  const start = Math.max(0, roundSequence) % storyStateRotation.length;

  for (let offset = 0; offset < storyStateRotation.length; offset += 1) {
    const state = storyStateRotation[(start + offset) % storyStateRotation.length];
    const candidates = ordered(byState[state]);
    if (!candidates.length) continue;
    const stateTurns = storyStateRotation.slice(0, Math.max(0, roundSequence) + 1).filter(item => item === state).length;
    return candidates[(Math.max(0, stateTurns - 1)) % candidates.length];
  }
  return ordered(liveProducts)[0] ?? null;
}

function marketPosition(product: MarketProduct) {
  if (product.priority) return "firmly in the spotlight";
  if (productTrend(product) === "up") return "making its move on the board";
  if (productTrend(product) === "dn") return "at a tempting price";
  return "holding steady on the board";
}

function demandSignal(product: MarketProduct) {
  if (product.salesVelocity >= 2) return "Orders are landing quickly";
  if (product.salesVelocity >= 0.75) return "It is getting a steady run of orders";
  if (product.salesVelocity > 0) return "It is still very much in the mix";
  return "The room is just getting started";
}
