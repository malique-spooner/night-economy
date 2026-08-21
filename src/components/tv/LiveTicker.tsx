import { useMemo } from "react";
import type { MarketProduct, Venue } from "../../engine/types";
import { formatMoney } from "../format";
import { productTrend } from "./tvHelpers";

type Props = {
  products: MarketProduct[];
  roundAnchorAt: string | null;
  roundDurationMs: number;
  venue: Venue;
};

export function LiveTicker({ products, roundAnchorAt, roundDurationMs, venue }: Props) {
  const activeProducts = products.filter(product => product.isLive);
  const tickerProducts = [...activeProducts, ...activeProducts];
  const progressStyle = useMemo(() => {
    const parsedAnchor = roundAnchorAt ? Date.parse(roundAnchorAt) : Number.NaN;
    const elapsed = Number.isFinite(parsedAnchor) ? Math.max(0, Date.now() - parsedAnchor) : 0;
    return {
      animationDelay: `${-Math.min(elapsed, roundDurationMs)}ms`,
      animationDuration: `${roundDurationMs}ms`,
    };
  }, [roundAnchorAt, roundDurationMs]);

  return (
    <div className="ticker ticker-bottom">
      <div className="tv-round-progress" aria-label="Progress to next price update">
        <i aria-hidden="true"><em key={roundAnchorAt ?? "unanchored"} style={progressStyle} /></i>
      </div>
      <div className="t-badge">Live prices</div>
      <div className="t-track">
        <div className="t-inner">
          {tickerProducts.map((product, index) => {
            const trend = productTrend(product);
            return (
              <div className="ti" key={`${product.id}-${index}`}>
                <span className="tn">{product.name}</span>
                <span className="tv">{formatMoney(product.currentPriceMinor, venue.currency)}</span>
                <span className={`t${trend === "up" ? "u" : trend === "dn" ? "d" : "flat"}`}>{trend === "up" ? "▲" : trend === "dn" ? "▼" : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
