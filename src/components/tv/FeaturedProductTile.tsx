import { useEffect, useMemo, useState } from "react";
import type { MarketProduct } from "../../engine/types";
import { getMarketProductPriceHistory, type MarketPriceHistoryPoint } from "../../api/market";
import { formatMoney } from "../format";
import { defaultDrinkImage, formatChangePercent, movementLabel, productTrend } from "./tvHelpers";

type Props = {
  activeRunId?: string;
  currency: string;
  historyRunReady: boolean;
  product: MarketProduct;
  rank: number;
  venueId: string;
};

export function FeaturedProductTile({ activeRunId, currency, historyRunReady, product, rank, venueId }: Props) {
  const trend = productTrend(product);
  const nameSize = featuredNameSize(product.name);
  const [history, setHistory] = useState<MarketPriceHistoryPoint[]>([]);

  useEffect(() => {
    let active = true;
    setHistory([]);
    if (!historyRunReady) return () => { active = false; };
    void getMarketProductPriceHistory(venueId, product.id, activeRunId)
      .then(points => { if (active) setHistory(points.slice(-30)); })
      .catch(() => { if (active) setHistory([]); });
    return () => { active = false; };
  }, [activeRunId, historyRunReady, product.id, product.currentPriceMinor, venueId]);

  const chart = useMemo(() => priceBars(product, history), [history, product]);
  const chartId = `feature-chart-${product.id.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <article className={`feature-tile ${trend} ${product.isSoldOut ? "sold-out" : ""}`}>
      <img alt="" className="feature-art" src={product.logoUrl ?? defaultDrinkImage(product.category, product.id)} />
      <div className="feature-shade" aria-hidden="true" />
      <div className="feature-identity">
        <span className="feature-rank">Featured · 0{rank}</span>
        <strong className={`feature-name ${nameSize}`}>{product.name}</strong>
        <span className="feature-cat">{movementLabel(product)}</span>
      </div>
      <div className="feature-chart" aria-label="Recent price movement">
        <svg viewBox="0 0 590 160" preserveAspectRatio="none" role="img">
          <line className="feature-chart-zero" x1="8" x2="516" y1={chart.zeroY} y2={chart.zeroY} />
          <text className="feature-chart-base-label" x="520" y={chart.zeroY + 3}>{formatMoney(product.basePriceMinor, currency)} BASE</text>
          {chart.bars.map((bar, index) => (
            <g className="feature-chart-bar-group" key={`${chartId}-bar-${index}`}>
              <rect
                className={`feature-chart-delta ${bar.trend}`}
                height={bar.height}
                rx="2"
                style={{ animationDelay: `${index * 42}ms`, transformOrigin: bar.trend === "up" ? "center bottom" : bar.trend === "dn" ? "center top" : "center center" }}
                width={bar.width}
                x={bar.x}
                y={bar.y}
              />
              {bar.showLabel && <text className={`feature-chart-bar-price ${bar.trend}`} textAnchor="middle" x={bar.x + bar.width / 2} y={bar.labelY}>{formatMoney(bar.price, currency)}</text>}
            </g>
          ))}
          <text className="feature-chart-time" x="8" y="157">OPEN</text>
          <text className="feature-chart-time" x="516" y="157" textAnchor="end">NOW</text>
        </svg>
      </div>
      <div className="feature-pricing">
        <div className={`feature-price ${trend}`}>{formatMoney(product.currentPriceMinor, currency)}</div>
        <div className={`feature-change ${trend}`}>{formatChangePercent(product)}</div>
      </div>
    </article>
  );
}

export function featuredNameSize(name: string) {
  const nameLength = name.trim().length;
  return nameLength > 46 ? "very-long" : nameLength > 32 ? "long" : nameLength > 21 ? "medium" : "short";
}

export function priceBars(product: MarketProduct, history: MarketPriceHistoryPoint[]) {
  const visibleHistory = history.slice(-18);
  // A fresh market has no completed five-minute snapshot yet.  Still render
  // the opening reference and live price so the featured display never starts
  // as an empty chart.  Once the first real round arrives, it replaces this
  // lightweight opening state with recorded prices.
  const prices = visibleHistory.length
    ? visibleHistory.map(point => point.priceMinor)
    : [product.basePriceMinor, product.currentPriceMinor];

  const zeroY = 80;
  const displayedPrices = prices;
  const sparseRoundCount = displayedPrices.length;
  const maxHeight = sparseRoundCount <= 4 ? 64 : sparseRoundCount <= 6 ? 61 : 58;
  const visibleMaxDeviation = Math.max(...prices.map(price => Math.abs(price - product.basePriceMinor)), 1);
  // This is a focused variance chart, so scale to the movement actually visible
  // tonight instead of reserving space for the drink's full theoretical range.
  const scaleCeiling = visibleMaxDeviation * 1.08;
  const showEveryPrice = sparseRoundCount <= 6;
  const plotLeft = 12;
  const plotWidth = 500;
  const slotWidth = plotWidth / Math.max(sparseRoundCount, 1);
  const width = showEveryPrice
    ? Math.min(82, slotWidth * 0.64)
    : Math.max(12, Math.min(24, slotWidth * 0.68));
  const minimumMovementHeight = sparseRoundCount <= 4 ? 34 : showEveryPrice ? 28 : 12;
  const bars = displayedPrices.map((price, index) => {
    const deviation = price - product.basePriceMinor;
    const trend = deviation > 0 ? "up" : deviation < 0 ? "dn" : "hold";
    const height = deviation === 0 ? (showEveryPrice ? 8 : 4) : Math.max(minimumMovementHeight, Math.abs(deviation) / scaleCeiling * maxHeight);
    const y = trend === "up" ? zeroY - height : trend === "dn" ? zeroY : zeroY - height / 2;
    const showLabel = showEveryPrice || index === sparseRoundCount - 1;
    return {
      height,
      labelY: trend === "up" ? Math.max(10, y - 5) : trend === "dn" ? Math.min(150, y + height + 11) : zeroY - 7,
      price,
      showLabel,
      trend,
      width,
      x: plotLeft + index * slotWidth + (slotWidth - width) / 2,
      y,
    };
  });
  return { bars, zeroY };
}
