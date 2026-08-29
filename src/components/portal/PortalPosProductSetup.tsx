import type { PosProduct } from "../../api/market";
import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { hasConfiguredCategory, unconfiguredCurrentPosProducts } from "./portalHelpers";

type Props = {
  archivedProducts: MarketProduct[];
  onConfigure: (posProduct: PosProduct) => void;
  onRestore: (product: MarketProduct) => void;
  posProducts: PosProduct[];
  products: MarketProduct[];
};

export function PortalPosProductSetup({ archivedProducts, onConfigure, onRestore, posProducts, products }: Props) {
  // An archived market drink is still connected to its POS record. It belongs
  // in the Restore list, never in the "needs setup" list.
  const unmatched = unconfiguredCurrentPosProducts(posProducts, [...products, ...archivedProducts]);
  if (!unmatched.length && !archivedProducts.length) return null;

  return <details className="portal-pos-setup"><summary><span>POS drinks</span><small>{unmatched.length ? `${unmatched.length} need setup` : "All connected"}{archivedProducts.length ? ` · ${archivedProducts.length} archived` : ""}</small></summary>
    <div className="portal-pos-setup-body">
      {unmatched.map(product => {
        const hasCategory = hasConfiguredCategory(product.category);
        return <article className="portal-pos-setup-row" key={product.id}><div><strong>{product.name}</strong><span>{hasCategory ? product.category : "Category required in POS"}{product.subcategory ? ` · ${product.subcategory}` : ""} · {formatMoney(product.basePriceMinor)}</span></div><button disabled={!hasCategory} onClick={() => onConfigure(product)} type="button">{hasCategory ? "Set up" : "Add category in POS"}</button></article>;
      })}
      {archivedProducts.map(product => <article className="portal-pos-setup-row archived" key={product.id}><div><strong>{product.name}</strong><span>Archived from the market · price history kept</span></div><button onClick={() => onRestore(product)} type="button">Restore</button></article>)}
    </div>
  </details>;
}
