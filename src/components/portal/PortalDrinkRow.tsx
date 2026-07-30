import { useRef } from "react";
import type { MarketProduct } from "../../engine/types";
import type { MarketPriceHistoryPoint, MarketProductPatch } from "../../api/market";
import { formatMoney } from "../format";
import { portalCategoryLabel, portalCategoryOptions } from "./portalHelpers";
import { PortalMoneyField } from "./PortalMoneyField";
import { PortalMarketDetail } from "./PortalMarketDetail";

type Props = {
  allProducts: MarketProduct[];
  history: MarketPriceHistoryPoint[];
  historyLoading: boolean;
  onChange: (productId: string, patch: MarketProductPatch, options?: { persist?: boolean }) => void;
  onLogoUpload: (productId: string, file: File) => void;
  onSelect: (productId: string) => void;
  product: MarketProduct;
  selected: boolean;
};

export function PortalDrinkRow({ allProducts, history, historyLoading, onChange, onLogoUpload, onSelect, product, selected }: Props) {
  const categoryOptions = portalCategoryOptions(allProducts, product.category);
  const logoInput = useRef<HTMLInputElement>(null);
  return (
    <article className={`portal-drink-row ${product.isSoldOut ? "paused" : ""} ${selected ? "selected" : ""}`}>
      <div className="portal-drink-symbol">
        <button aria-label={`${product.logoUrl ? "Replace" : "Add"} logo for ${product.name}`} className={`portal-logo-picker ${product.logoUrl ? "has-image" : ""}`} title={`${product.logoUrl ? "Replace" : "Add"} logo`} type="button" onClick={() => logoInput.current?.click()}>{product.logoUrl ? <img alt={`${product.name} logo`} src={product.logoUrl} /> : <b aria-hidden="true">+</b>}</button>
        <input ref={logoInput} accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label={`Upload logo for ${product.name}`} hidden onChange={event => { const file = event.target.files?.[0]; if (file) onLogoUpload(product.id, file); event.currentTarget.value = ""; }} type="file" />
      </div>
      <label className="portal-drink-name">
        <span>Market name</span>
        <input value={product.name} onChange={event => onChange(product.id, { name: event.target.value }, { persist: false })} onBlur={event => onChange(product.id, { name: event.target.value })} />
      </label>
      <label className="portal-drink-cat">
        <span>Category</span>
        <select value={product.category} onChange={event => onChange(product.id, { category: event.target.value })}>
          {categoryOptions.map(category => <option value={category} key={category}>{portalCategoryLabel(category)}</option>)}
        </select>
      </label>
      <div className="portal-live-actions">
        <span>Live</span>
        <button className={`portal-live-toggle ${product.isLive ? "on" : "off"}`} type="button" onClick={() => onChange(product.id, { isLive: !product.isLive })}>
          {product.isLive ? "Live" : "Off"}
        </button>
      </div>
      <div className="portal-current-price">
        <span>Price</span>
        <strong>{formatMoney(product.currentPriceMinor)}</strong>
      </div>
      <label className="portal-priority-toggle" title={product.isLive ? "Show this drink in this category's three TV feature cards" : "Make this drink live before choosing it as a TV priority"}>
        <span>Priority</span>
        <input checked={product.priority} disabled={!product.isLive} onChange={event => onChange(product.id, { priority: event.target.checked })} type="checkbox" />
      </label>
      <PortalMoneyField label="Floor" valueMinor={product.floorPriceMinor} onChange={floorPriceMinor => onChange(product.id, { floorPriceMinor })} />
      <div className="portal-base-price">
        <span>Base</span>
        <strong>{formatMoney(product.basePriceMinor)}</strong>
      </div>
      <PortalMoneyField label="Ceiling" valueMinor={product.ceilingPriceMinor} onChange={ceilingPriceMinor => onChange(product.id, { ceilingPriceMinor })} />
      <button
        aria-controls={`price-history-${product.id}`}
        aria-expanded={selected}
        aria-label={`${selected ? "Hide" : "Show"} price history for ${product.name}`}
        className={`portal-history-toggle ${selected ? "open" : ""}`}
        type="button"
        onClick={() => onSelect(product.id)}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg>
      </button>
      {selected && (
        <div className="portal-inline-history" id={`price-history-${product.id}`}>
          <PortalMarketDetail history={history} isLoading={historyLoading} product={product} />
        </div>
      )}
    </article>
  );
}
