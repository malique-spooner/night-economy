import type { MarketProduct } from "../../engine/types";
import type { MarketPriceHistoryPoint, MarketProductPatch, PosProduct } from "../../api/market";
import { portalCategoryLabel, TV_CATEGORY_PAGE_LIMIT } from "./portalHelpers";
import { PortalDrinkRow } from "./PortalDrinkRow";

type Props = {
  allProducts: MarketProduct[];
  category: string;
  onProductChange: (productId: string, patch: MarketProductPatch, options?: { persist?: boolean }) => void;
  onLogoUpload: (productId: string, file: File) => void;
  onLogoRemove: (productId: string) => void;
  onSelectProduct: (productId: string) => void;
  priceHistory: MarketPriceHistoryPoint[];
  priceHistoryLoading: boolean;
  marketLive: boolean;
  posProducts: PosProduct[];
  products: MarketProduct[];
  selectedProductId: string | null;
};

export function PortalDrinkGroup({ allProducts, category, marketLive, onLogoRemove, onLogoUpload, onProductChange, onSelectProduct, posProducts, priceHistory, priceHistoryLoading, products, selectedProductId }: Props) {
  const liveProducts = products.filter(product => product.isLive && !product.isArchived).length;
  const tvPages = Math.ceil(liveProducts / TV_CATEGORY_PAGE_LIMIT);
  const isOverTvPageLimit = liveProducts > TV_CATEGORY_PAGE_LIMIT;
  return (
    <section className="portal-drink-group">
      <div className="portal-drink-sticky-head">
        <div className="portal-drink-group-head">
          <strong>{portalCategoryLabel(category)}</strong>
          <div className="portal-drink-group-status">
            <span>{liveProducts} live · {products.length} drinks</span>
            {isOverTvPageLimit && <em>Over 10 live drinks · TV will use {tvPages} pages</em>}
          </div>
        </div>
        <div className="portal-drink-column-head" aria-hidden="true">
          <span>Image</span>
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
        <PortalDrinkRow allProducts={allProducts} history={priceHistory} historyLoading={priceHistoryLoading} marketLive={marketLive} onChange={onProductChange} onLogoRemove={onLogoRemove} onLogoUpload={onLogoUpload} onSelect={onSelectProduct} posProducts={posProducts} product={product} selected={product.id === selectedProductId} key={product.id} />
      ))}
    </section>
  );
}
