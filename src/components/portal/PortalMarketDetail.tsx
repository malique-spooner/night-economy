import type { MarketPriceHistoryPoint } from "../../api/market";
import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { priceBars } from "../tv/FeaturedProductTile";

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

export function PortalMarketDetail({ history, isLoading, marketLive, product }: Props) {
  if (!product) return null;

  const index = indexFor(product);
  const change = changeFor(product);
  const atFloor = product.currentPriceMinor <= product.floorPriceMinor;
  const atCeiling = product.currentPriceMinor >= product.ceilingPriceMinor;
  const chart = priceBars(product, history);
  const chartId = `portal-feature-chart-${product.id.replace(/[^a-z0-9]/gi, "")}`;
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
        <div className="feature-chart portal-feature-chart" aria-label="Recent price movement">
          <svg viewBox="0 0 590 160" preserveAspectRatio="none" role="img" aria-label={`${product.name} price history`}>
            <line className="feature-chart-zero" x1="8" x2="516" y1={chart.zeroY} y2={chart.zeroY} />
            <text className="feature-chart-base-label" x="520" y={chart.zeroY + 3}>{formatMoney(product.basePriceMinor)} BASE</text>
            {chart.bars.map((bar, index) => (
              <g className="feature-chart-bar-group" key={`${chartId}-bar-${index}`}>
                <rect className={`feature-chart-delta ${bar.trend}`} height={bar.height} rx="2" style={{ animationDelay: `${index * 42}ms`, transformOrigin: bar.trend === "up" ? "center bottom" : bar.trend === "dn" ? "center top" : "center center" }} width={bar.width} x={bar.x} y={bar.y} />
                {bar.showLabel && <text className={`feature-chart-bar-price ${bar.trend}`} textAnchor="middle" x={bar.x + bar.width / 2} y={bar.labelY}>{formatMoney(bar.price)}</text>}
              </g>
            ))}
            <text className="feature-chart-time" x="8" y="157">OPEN</text>
            <text className="feature-chart-time" x="516" y="157" textAnchor="end">NOW</text>
          </svg>
        </div>
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
