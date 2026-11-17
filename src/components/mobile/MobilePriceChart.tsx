import type { MarketPriceHistoryPoint } from "../../api/market";
import type { MarketProduct } from "../../engine/types";
import { productTrend } from "../tv/tvHelpers";

type Props = {
  history: MarketPriceHistoryPoint[];
  product: MarketProduct;
};

export function MobilePriceChart({ history, product }: Props) {
  const points = history.length
    ? history.slice(-12).map(point => point.priceMinor)
    : [product.basePriceMinor, product.currentPriceMinor];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const coords = points.map((price, index) => ({
    x: points.length === 1 ? 50 : 2 + (index / (points.length - 1)) * 96,
    y: 53 - ((price - min) / span) * 44,
  }));
  const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const fill = `${line} L98,58 L2,58 Z`;
  const lastPrice = points.at(-1) ?? product.currentPriceMinor;
  const firstPrice = points[0] ?? product.basePriceMinor;
  const trend = productTrend(product);

  return (
    <svg
      aria-label={`${product.name} price movement${history.length ? ` across the latest ${Math.min(history.length, 12)} completed rounds` : " from opening price to current price"}`}
      className={`mobile-price-chart ${trend}`}
      preserveAspectRatio="none"
      role="img"
      viewBox="0 0 100 60"
    >
      <path className="mobile-price-chart-grid" d="M2 8H98 M2 23H98 M2 38H98 M2 53H98 M25 5V55 M50 5V55 M75 5V55" />
      <path className="mobile-price-chart-area" d={fill} />
      <path className="mobile-price-chart-line" d={line} />
      <circle className="mobile-price-chart-end" cx={coords.at(-1)?.x ?? 98} cy={coords.at(-1)?.y ?? 27} r="2" />
      <title>{`${product.name} price movement, ${firstPrice} to ${lastPrice} minor currency units`}</title>
    </svg>
  );
}
