import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { defaultDrinkImage, formatChangePercent, productTrend } from "../tv/tvHelpers";
import { mobileAccent, mobileHook, mobileMovementMark } from "./mobileHelpers";

type Props = {
  currency: string;
  product: MarketProduct;
  rank: number;
};

export function MobileMarketRow({ currency, product, rank }: Props) {
  const trend = productTrend(product);
  const accent = mobileAccent(product);

  return (
    <article className={`mobile-market-row ${trend} accent-${accent}`}>
      <div className="mobile-drink-mark" aria-hidden="true">
        <img alt="" src={product.logoUrl ?? defaultDrinkImage(product.category)} />
      </div>
      <div className="mobile-market-main">
        <div className="mobile-market-name">
          <strong>{product.name}</strong>
          <span>{mobileHook(product)}</span>
        </div>
        <div className={`mobile-market-price ${trend}`}>{formatMoney(product.currentPriceMinor, currency)}</div>
      </div>
      <div className="mobile-market-meta">
        <span className={trend}>
          {mobileMovementMark(product)} {formatChangePercent(product).replace("+", "")}
        </span>
        <span>#{String(rank).padStart(2, "0")}</span>
      </div>
    </article>
  );
}
