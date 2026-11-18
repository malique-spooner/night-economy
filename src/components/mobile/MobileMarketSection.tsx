import type { MarketProduct, Venue } from "../../engine/types";
import { categoryLabel } from "../tv/tvHelpers";
import { MobileMarketRow } from "./MobileMarketRow";
import { mobileCategorySectionId } from "./mobileHelpers";

type Props = {
  category: string;
  products: MarketProduct[];
  venue: Venue;
};

export function MobileMarketSection({ category, products, venue }: Props) {
  return (
    <section className="mobile-menu-section mobile-market-section" id={mobileCategorySectionId(category)}>
      <div className="mobile-menu-section-head">
        <div>
          <h2>{categoryLabel(category)}</h2>
          <p>{String(products.length).padStart(2, "0")} LIVE</p>
        </div>
      </div>
      <div className="mobile-market-list">
        {products.map(product => (
          <MobileMarketRow currency={venue.currency} product={product} key={product.id} />
        ))}
      </div>
    </section>
  );
}
