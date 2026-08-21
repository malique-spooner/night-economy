import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { PricePosition } from "./PricePosition";
import { formatChangePercent, movementLabel, productTrend } from "./tvHelpers";

type Props = {
  currency: string;
  product: MarketProduct;
};

export function MarketProductRow({ currency, product }: Props) {
  const trend = productTrend(product);
  const decayWidth = Math.min(100, Math.max(18, product.salesVelocity * 12));

  return (
    <div className={`drow ${product.salesVelocity > 3 ? "fresh" : "decaying"} ${product.isSoldOut ? "sold-out" : ""}`}>
      <div>
        <div className="dname" title={product.name}>
          {product.name}
          {product.isSoldOut ? <span className="val-badge">SOLD OUT</span> : null}
        </div>
        <div className="dcat-sub">{movementLabel(product)}</div>
      </div>
      <div className={`dprice ${trend}`}>{formatMoney(product.currentPriceMinor, currency)}</div>
      <div className="spark-cell">
        <PricePosition product={product} currency={currency} />
      </div>
      <div className={`dpct ${trend}`}>{formatChangePercent(product)}</div>
      <div className="decay-wrap">
        <div className="decay-bar">
          <div className="decay-fill" style={{ width: `${decayWidth}%` }}></div>
        </div>
        <div className={`darr ${trend}`}>{trend === "up" ? "▲" : trend === "dn" ? "▼" : "—"}</div>
      </div>
    </div>
  );
}
