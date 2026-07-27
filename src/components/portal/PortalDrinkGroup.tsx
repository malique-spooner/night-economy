import type { MarketProduct } from "../../engine/types";
import type { MarketPriceHistoryPoint, MarketProductPatch } from "../../api/market";
import { portalCategoryLabel, TV_CATEGORY_PAGE_LIMIT } from "./portalHelpers";
import { PortalDrinkRow } from "./PortalDrinkRow";

type Props = {
  allProducts: MarketProduct[];
  category: string;
  onProductChange: (productId: string, patch: MarketProductPatch, options?: { persist?: boolean }) => void;
  onSelectProduct: (productId: string) => void;
  priceHistory: MarketPriceHistoryPoint[];
  priceHistoryLoading: boolean;
  products: MarketProduct[];
  selectedProductId: string | null;
};

export function PortalDrinkGroup({ allProducts, category, onProductChange, onSelectProduct, priceHistory, priceHistoryLoading, products, selectedProductId }: Props) {
  const liveProducts = products.filter(product => product.isLive && !product.isSoldOut).length;
  return (
    <section className="portal-drink-group">
      <div className="portal-drink-sticky-head">
        <div className="portal-drink-group-head">
          <strong>{portalCategoryLabel(category)}</strong>
          <span>{liveProducts} live · {products.length} drinks{liveProducts > TV_CATEGORY_PAGE_LIMIT ? ` · TV pages: ${Math.ceil(liveProducts / TV_CATEGORY_PAGE_LIMIT)}` : ""}</span>
        </div>
        <div className="portal-drink-column-head" aria-hidden="true">
          <span>Logo</span>
          <span>Market name</span>
          <span>Category</span>
          <span>Live</span>
          <span>Price</span>
          <span>Priority</span>
          <span>Floor</span>
          <span>Base</span>
          <span>Ceiling</span>
          <span />
        </div>
      </div>
      {products.map(product => (
        <PortalDrinkRow allProducts={allProducts} history={priceHistory} historyLoading={priceHistoryLoading} onChange={onProductChange} onSelect={onSelectProduct} product={product} selected={product.id === selectedProductId} key={product.id} />
      ))}
    </section>
  );
}
