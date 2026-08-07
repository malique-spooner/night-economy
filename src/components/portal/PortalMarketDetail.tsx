import type { MarketPriceHistoryPoint } from "../../api/market";
import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";

type Props = {
  history: MarketPriceHistoryPoint[];
  isLoading: boolean;
  marketLive: boolean;
  product: MarketProduct | null;
};

function indexFor(product: MarketProduct) {
  return product.basePriceMinor ? (product.currentPriceMinor / product.basePriceMinor) * 100 : 100;
}

function changeFor(product: MarketProduct) {
  return product.basePriceMinor
    ? ((product.currentPriceMinor - product.basePriceMinor) / product.basePriceMinor) * 100
    : 0;
}

function pricePath(prices: number[]) {
  if (prices.length < 2) return "";
  const width = 520;
  const height = 104;
  const padding = 8;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const span = Math.max(high - low, 1);

  return prices.map((price, index) => {
    const x = padding + (index / (prices.length - 1)) * (width - padding * 2);
    const y = height - padding - ((price - low) / span) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function PortalMarketDetail({ history, isLoading, marketLive, product }: Props) {
  if (!product) return null;

  const index = indexFor(product);
  const change = changeFor(product);
  const atFloor = product.currentPriceMinor <= product.floorPriceMinor;
  const atCeiling = product.currentPriceMinor >= product.ceilingPriceMinor;
  const prices = [product.basePriceMinor, ...history.map(point => point.priceMinor)];
  const latestRounds = history.slice(-4).reverse();

  return (
    <section className="portal-market-detail" aria-live="polite">
      <div className="portal-market-detail-head">
        <div>
          <span className="portal-market-kicker">{marketLive ? "Current market run" : "Last completed market run"}</span>
          <h2>{product.name}</h2>
          <p>{product.symbol} · {product.category}</p>
        </div>
        <div className={`portal-market-limit ${atFloor ? "floor" : atCeiling ? "ceiling" : "clear"}`}>
          {atFloor ? "At floor — cannot fall further" : atCeiling ? "At ceiling — cannot rise further" : "Trading inside its limits"}
        </div>
      </div>
      <div className="portal-market-stats">
        <div><span>Current price</span><strong>{formatMoney(product.currentPriceMinor)}</strong></div>
        <div><span>Market index</span><strong className={change >= 0 ? "up" : "down"}>{index.toFixed(1)}</strong></div>
        <div><span>Vs opening</span><strong className={change >= 0 ? "up" : "down"}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</strong></div>
        <div><span>Allowed range</span><strong>{formatMoney(product.floorPriceMinor)}–{formatMoney(product.ceilingPriceMinor)}</strong></div>
      </div>
      <div className="portal-market-history">
        <div className="portal-market-history-head">
          <span>{marketLive ? "Current price and completed rounds" : "Price history"}</span>
          <small>{isLoading ? "Loading rounds…" : marketLive ? "Live now · next price is published at the end of this round" : history.length ? `${history.length} completed 5-minute rounds` : "No completed rounds yet"}</small>
        </div>
        <svg viewBox="0 0 520 104" role="img" aria-label={`${product.name} price history`} preserveAspectRatio="none">
          <line x1="8" x2="512" y1="52" y2="52" />
          {prices.length > 1 && <path d={pricePath(prices)} className={change >= 0 ? "up" : "down"} />}
          {prices.length === 1 && <circle cx="260" cy="52" r="4" className="neutral" />}
        </svg>
        <div className="portal-market-history-axis"><span>Opening {formatMoney(product.basePriceMinor)}</span><span>Now {formatMoney(product.currentPriceMinor)}</span></div>
      </div>
      {latestRounds.length > 0 && (
        <div className="portal-market-rounds">
          {latestRounds.map(round => (
            <span className={round.movement} key={round.at}>{round.at.slice(11, 16)} · {formatMoney(round.priceMinor)}</span>
          ))}
        </div>
      )}
    </section>
  );
}
