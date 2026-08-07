import type { PosProduct } from "../../api/market";
import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";

type Props = {
  archivedProducts: MarketProduct[];
  onConfigure: (posProduct: PosProduct) => void;
  onRestore: (product: MarketProduct) => void;
  posProducts: PosProduct[];
  products: MarketProduct[];
};

export function PortalPosProductSetup({ archivedProducts, onConfigure, onRestore, posProducts, products }: Props) {
  const mapped = new Set(products.flatMap(product => (product.posProductId ? [product.posProductId] : [])));
  const unmatched = posProducts.filter(product => product.isCurrent !== false && !mapped.has(product.id));
  if (!unmatched.length && !archivedProducts.length) return null;

  return <details className="portal-pos-setup"><summary><span>POS drinks</span><small>{unmatched.length ? `${unmatched.length} need setup` : "All connected"}{archivedProducts.length ? ` · ${archivedProducts.length} archived` : ""}</small></summary>
    <div className="portal-pos-setup-body">
      {unmatched.map(product => <article className="portal-pos-setup-row" key={product.id}><div><strong>{product.name}</strong><span>{product.category}{product.subcategory ? ` · ${product.subcategory}` : ""} · {formatMoney(product.basePriceMinor)}</span></div><button onClick={() => onConfigure(product)} type="button">Set up</button></article>)}
      {archivedProducts.map(product => <article className="portal-pos-setup-row archived" key={product.id}><div><strong>{product.name}</strong><span>Archived from the market · price history kept</span></div><button onClick={() => onRestore(product)} type="button">Restore</button></article>)}
    </div>
  </details>;
}
