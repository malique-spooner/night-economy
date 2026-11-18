import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { formatChangePercent, productTrend } from "../tv/tvHelpers";
import { mobileAccent, mobileMovementMark } from "./mobileHelpers";
import { mobileDrinkArtwork } from "./mobileArtwork";

type Props = {
  currency: string;
  product: MarketProduct;
};

export function MobileMarketRow({ currency, product }: Props) {
  const trend = productTrend(product);
  const accent = mobileAccent(product);

  return (
    <article className={`mobile-market-row ${trend} accent-${accent}`}>
      <div className="mobile-drink-mark" aria-hidden="true">
        <img alt="" src={mobileDrinkArtwork(product)} />
      </div>
      <div className="mobile-market-main">
        <div className="mobile-market-name">
          <strong>{product.name}</strong>
          {product.isSoldOut ? <span className="mobile-market-unavailable">Unavailable</span> : null}
        </div>
        <div className="mobile-market-quote">
          <strong className={`mobile-market-price ${trend}`}>{formatMoney(product.currentPriceMinor, currency)}</strong>
          <span className={`mobile-market-change ${trend}`} aria-label={`Market change ${formatChangePercent(product)}`}>
            <i aria-hidden="true">{mobileMovementMark(product)}</i>{formatChangePercent(product).replace("+", "")}
          </span>
        </div>
      </div>
    </article>
  );
}
