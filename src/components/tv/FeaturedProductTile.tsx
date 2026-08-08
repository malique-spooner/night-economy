import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { PricePosition } from "./PricePosition";
import { formatChangePercent, movementLabel, productTrend } from "./tvHelpers";

type Props = {
  currency: string;
  product: MarketProduct;
  rank: number;
};

export function FeaturedProductTile({ currency, product, rank }: Props) {
  const trend = productTrend(product);

  return (
    <article className={`feature-tile ${trend} ${product.isSoldOut ? "sold-out" : ""}`}>
      {product.logoUrl ? <img alt="" className="feature-art" src={product.logoUrl} /> : <div aria-hidden="true" className={`feature-fallback-art ${trend}`}><i></i><i></i><i></i></div>}
      <div className="feature-shade" aria-hidden="true"></div>
      <div className="feature-tile-top">
        <span className="feature-rank">0{rank}</span>
        <span className="feature-cat">{movementLabel(product)}</span>
      </div>
      <strong className="feature-name">{product.name}</strong>
      <div className="feature-bottom">
        <div className={`feature-price ${trend}`}>{formatMoney(product.currentPriceMinor, currency)}</div>
        <div className={`feature-change ${trend}`}>{formatChangePercent(product)}</div>
      </div>
      <PricePosition product={product} currency={currency} />
    </article>
  );
}
