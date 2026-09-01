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

export function PortalMarketDetail({ history, isLoading, marketLive, product }: Props) {
  if (!product) return null;

  const index = indexFor(product);
  const change = changeFor(product);
  const atFloor = product.currentPriceMinor <= product.floorPriceMinor;
  const atCeiling = product.currentPriceMinor >= product.ceilingPriceMinor;
  const chart = tablePriceBars(product, history);
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
          <svg viewBox="0 0 440 122" preserveAspectRatio="xMinYMid meet" role="img" aria-label={`${product.name} price history`}>
            <line className="feature-chart-zero" x1="10" x2="378" y1={chart.zeroY} y2={chart.zeroY} />
            <text className="feature-chart-base-label" x="384" y={chart.zeroY + 3}>{formatMoney(product.basePriceMinor)} BASE</text>
            {chart.bars.map((bar, index) => (
              <g className="feature-chart-bar-group" key={`${chartId}-bar-${index}`}>
                <rect className={`feature-chart-delta ${bar.trend}`} height={bar.height} rx="2" style={{ animationDelay: `${index * 42}ms`, transformOrigin: bar.trend === "up" ? "center bottom" : bar.trend === "dn" ? "center top" : "center center" }} width={bar.width} x={bar.x} y={bar.y} />
                {bar.showLabel && <text className={`feature-chart-bar-price ${bar.trend}`} textAnchor="middle" x={bar.x + bar.width / 2} y={bar.labelY}>{formatMoney(bar.price)}</text>}
              </g>
            ))}
            <text className="feature-chart-time" x="10" y="118">OPEN</text>
            <text className="feature-chart-time" x="378" y="118" textAnchor="end">NOW</text>
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

// The expanded Portal row is far wider and shallower than the TV feature.
// Keep the same price-bar language, but use a compact chart with a stable
// aspect ratio and a smaller recent window so it remains legible in a table.
function tablePriceBars(product: MarketProduct, history: MarketPriceHistoryPoint[]) {
  const prices = history.length
    ? history.slice(-10).map(point => point.priceMinor)
    : [product.basePriceMinor, product.currentPriceMinor];
  const zeroY = 58;
  const count = prices.length;
  const visibleMaxDeviation = Math.max(...prices.map(price => Math.abs(price - product.basePriceMinor)), 1);
  const scaleCeiling = visibleMaxDeviation * 1.08;
  const plotLeft = 14;
  const plotWidth = 350;
  const slotWidth = plotWidth / Math.max(count, 1);
  const width = Math.min(22, Math.max(10, slotWidth * 0.54));

  return {
    bars: prices.map((price, index) => {
      const deviation = price - product.basePriceMinor;
      const trend = deviation > 0 ? "up" : deviation < 0 ? "dn" : "hold";
      const height = deviation === 0 ? 5 : Math.max(10, Math.abs(deviation) / scaleCeiling * 42);
      const y = trend === "up" ? zeroY - height : trend === "dn" ? zeroY : zeroY - height / 2;
      const isLatest = index === count - 1;
      return {
        height,
        labelY: trend === "up" ? Math.max(9, y - 4) : trend === "dn" ? Math.min(107, y + height + 9) : zeroY - 6,
        price,
        showLabel: count <= 5 || isLatest,
        trend,
        width,
        x: plotLeft + index * slotWidth + (slotWidth - width) / 2,
        y,
      };
    }),
    zeroY,
  };
}
