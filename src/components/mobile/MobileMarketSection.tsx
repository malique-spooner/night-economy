import type { MarketProduct, Venue } from "../../engine/types";
import type { MarketPriceHistoryPoint } from "../../api/market";
import { categoryLabel } from "../tv/tvHelpers";
import { MobileMarketRow } from "./MobileMarketRow";
import { mobileCategorySectionId } from "./mobileHelpers";

type Props = {
  category: string;
  historyByProductId: Map<string, MarketPriceHistoryPoint[]>;
  products: MarketProduct[];
  venue: Venue;
};

export function MobileMarketSection({ category, historyByProductId, products, venue }: Props) {
  return (
    <section className="mobile-menu-section mobile-market-section" id={mobileCategorySectionId(category)}>
      <div className="mobile-menu-section-head">
        <div>
          <h2>{categoryLabel(category)}</h2>
          <p>{String(products.length).padStart(2, "0")} LIVE</p>
        </div>
      </div>
      <div className="mobile-market-list">
        {products.map((product, index) => (
          <MobileMarketRow currency={venue.currency} history={historyByProductId.get(product.id) ?? []} layout={(index % 9) + 1} product={product} key={product.id} />
        ))}
      </div>
    </section>
  );
}
