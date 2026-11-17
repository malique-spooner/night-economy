import type { MarketProduct } from "../../engine/types";
import type { MarketPriceHistoryPoint } from "../../api/market";
import { formatMoney } from "../format";
import { formatChangePercent, productTrend } from "../tv/tvHelpers";
import { mobileAccent, mobileMovementMark } from "./mobileHelpers";
import { mobileDrinkArtwork } from "./mobileArtwork";
import { MobilePriceChart } from "./MobilePriceChart";

type Props = {
  currency: string;
  history: MarketPriceHistoryPoint[];
  layout: number;
  product: MarketProduct;
};

export function MobileMarketRow({ currency, history, layout, product }: Props) {
  const trend = productTrend(product);
  const accent = mobileAccent(product);

  return (
    <article className={`mobile-market-row mobile-layout-${layout} ${trend} accent-${accent}`}>
      <div className="mobile-drink-mark" aria-hidden="true">
        <img alt="" src={mobileDrinkArtwork(product)} />
      </div>
      <div className="mobile-market-main">
        <div className="mobile-market-name">
          <strong>{product.name}</strong>
          {product.isSoldOut ? <span className="mobile-market-unavailable">Unavailable</span> : null}
        </div>
        <MobilePriceChart history={history} product={product} />
      </div>
      <div className="mobile-market-quote">
        <strong className={`mobile-market-price ${trend}`}>{formatMoney(product.currentPriceMinor, currency)}</strong>
        <span className={`mobile-market-change ${trend}`} aria-label={`Market change ${formatChangePercent(product)}`}>
          <i aria-hidden="true">{mobileMovementMark(product)}</i>{formatChangePercent(product).replace("+", "")}
        </span>
      </div>
    </article>
  );
}
