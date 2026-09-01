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

export function priceChart(prices: number[], basePriceMinor: number) {
  const width = 520;
  const height = 104;
  const padding = 8;
  const zeroY = height / 2;
  const maxDeviation = Math.max(...prices.map(price => Math.abs(price - basePriceMinor)), 1);
  const plotHeight = zeroY - padding;
  const point = (price: number, index: number) => {
    const x = padding + (index / (prices.length - 1)) * (width - padding * 2);
    const y = zeroY - ((price - basePriceMinor) / maxDeviation) * plotHeight;
    return { x, y };
  };
  const points = prices.length > 1 ? prices.map(point) : [];
  return {
    last: points.at(-1) ?? { x: width / 2, y: zeroY },
    path: points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
    zeroY,
  };
}

export function PortalMarketDetail({ history, isLoading, marketLive, product }: Props) {
  if (!product) return null;

  const index = indexFor(product);
  const change = changeFor(product);
  const atFloor = product.currentPriceMinor <= product.floorPriceMinor;
  const atCeiling = product.currentPriceMinor >= product.ceilingPriceMinor;
  const prices = [product.basePriceMinor, ...history.map(point => point.priceMinor)];
  const chart = priceChart(prices, product.basePriceMinor);
  const priceWindows = history.slice().reverse();

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
          <line x1="8" x2="512" y1={chart.zeroY} y2={chart.zeroY} />
          {prices.length > 1 && <path d={chart.path} className={change >= 0 ? "up" : "down"} />}
          {history.length > 0 && <circle cx={chart.last.x} cy={chart.last.y} r="3" className={change >= 0 ? "up" : "down"} />}
          {prices.length === 1 && <circle cx="260" cy="52" r="4" className="neutral" />}
        </svg>
        <div className="portal-market-history-axis"><span>Opening {formatMoney(product.basePriceMinor)}</span><span>Now {formatMoney(product.currentPriceMinor)}</span></div>
      </div>
      {priceWindows.length > 0 && (
        <section className="portal-market-rounds-wrap">
          <div className="portal-market-rounds-head"><span>Price windows</span><small>{priceWindows.length} recorded</small></div>
          <div className="portal-market-rounds">
          {priceWindows.map(round => (
            <span className={round.movement} key={round.at}>{round.at.slice(11, 16)} · {formatMoney(round.priceMinor)}</span>
          ))}
          </div>
        </section>
      )}
    </section>
  );
}
