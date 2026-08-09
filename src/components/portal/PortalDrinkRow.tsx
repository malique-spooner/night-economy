import { useRef, useState } from "react";
import type { MarketPriceHistoryPoint, MarketProductPatch, PosProduct } from "../../api/market";
import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { portalCategoryLabel, portalCategoryOptions, TV_DRINK_NAME_MAX_LENGTH } from "./portalHelpers";
import { PortalMarketDetail } from "./PortalMarketDetail";
import { PortalMoneyField } from "./PortalMoneyField";

type Props = {
  allProducts: MarketProduct[];
  history: MarketPriceHistoryPoint[];
  historyLoading: boolean;
  marketLive: boolean;
  onChange: (productId: string, patch: MarketProductPatch, options?: { persist?: boolean }) => void;
  onLogoUpload: (productId: string, file: File) => void;
  onLogoRemove: (productId: string) => void;
  onSelect: (productId: string) => void;
  posProducts: PosProduct[];
  product: MarketProduct;
  selected: boolean;
};

export function PortalDrinkRow({ allProducts, history, historyLoading, marketLive, onChange, onLogoRemove, onLogoUpload, onSelect, posProducts, product, selected }: Props) {
  const categoryOptions = portalCategoryOptions(allProducts, product.category);
  const imageInput = useRef<HTMLInputElement>(null);
  const [isImagePreviewOpen, setImagePreviewOpen] = useState(false);
  const linkedPos = posProducts.find(candidate => candidate.id === product.posProductId);
  const isConnected = Boolean(linkedPos && linkedPos.isCurrent !== false);
  const canGoLive = isConnected && !product.isArchived;

  return (
    <article className={`portal-drink-row ${product.isSoldOut ? "paused" : ""} ${product.isArchived ? "archived" : ""} ${!isConnected ? "mapping-lost" : ""} ${selected ? "selected" : ""}`}>
      <div className="portal-drink-symbol">
        <button aria-label={`${product.logoUrl ? "Preview" : "Add"} drink image for ${product.name}`} className={`portal-logo-picker ${product.logoUrl ? "has-image" : ""}`} title={`${product.logoUrl ? "Preview" : "Add"} drink image`} type="button" onClick={() => product.logoUrl ? setImagePreviewOpen(true) : imageInput.current?.click()}>{product.logoUrl ? <img alt={`${product.name} drink`} src={product.logoUrl} /> : <b aria-hidden="true">+</b>}</button>
        <input ref={imageInput} accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label={`Upload drink image for ${product.name}`} hidden onChange={event => { const file = event.target.files?.[0]; if (file) onLogoUpload(product.id, file); event.currentTarget.value = ""; }} type="file" />
      </div>
      {isImagePreviewOpen && product.logoUrl && <div aria-label={`${product.name} drink image preview`} aria-modal="true" className="portal-image-preview-backdrop" onMouseDown={() => setImagePreviewOpen(false)} role="dialog">
        <section className="portal-image-preview-dialog" onMouseDown={event => event.stopPropagation()}>
          <button aria-label="Close image preview" className="portal-image-preview-close" type="button" onClick={() => setImagePreviewOpen(false)}>×</button>
          <img alt={`${product.name} drink`} src={product.logoUrl} />
          <div><strong>{product.name}</strong><span>Drink image</span></div>
          <footer><button className="portal-image-preview-replace" type="button" onClick={() => { setImagePreviewOpen(false); imageInput.current?.click(); }}>Replace image</button><button className="portal-image-preview-remove" type="button" onClick={() => { setImagePreviewOpen(false); onLogoRemove(product.id); }}>Remove image</button></footer>
        </section>
      </div>}
      <label className="portal-drink-name">
        <input aria-label={`Market name for ${product.name}`} maxLength={TV_DRINK_NAME_MAX_LENGTH} value={product.name} onChange={event => onChange(product.id, { name: event.target.value }, { persist: false })} onBlur={event => onChange(product.id, { name: event.target.value })} />
      </label>
      <label className="portal-drink-cat"><span>Category</span><select value={product.category} onChange={event => onChange(product.id, { category: event.target.value })}>{categoryOptions.map(category => <option value={category} key={category}>{portalCategoryLabel(category)}</option>)}</select></label>
      <div className="portal-live-actions"><span>Live</span><button aria-label={`${product.isLive ? "Take" : "Make"} ${product.name} live`} className={`portal-live-toggle ${product.isLive ? "on" : "off"}`} disabled={!canGoLive} title={canGoLive ? undefined : "Connect this drink to an active POS product before it can go live"} type="button" onClick={() => onChange(product.id, { isLive: !product.isLive })}>{product.isLive ? "Live" : "Off"}</button></div>
      <div className="portal-current-price"><span>Price</span><strong>{formatMoney(product.currentPriceMinor)}</strong></div>
      <label className="portal-priority-toggle" title={product.isLive ? "Show this drink in this category's three TV feature cards" : "Make this drink live before choosing it as a TV priority"}><span>Priority</span><input checked={product.priority} disabled={!product.isLive || !canGoLive} onChange={event => onChange(product.id, { priority: event.target.checked })} type="checkbox" /></label>
      <PortalMoneyField label="Floor" valueMinor={product.floorPriceMinor} onChange={floorPriceMinor => onChange(product.id, { floorPriceMinor })} />
      <div className="portal-base-price"><span>Base</span><strong>{formatMoney(product.basePriceMinor)}</strong></div>
      <PortalMoneyField label="Ceiling" valueMinor={product.ceilingPriceMinor} onChange={ceilingPriceMinor => onChange(product.id, { ceilingPriceMinor })} />
      <button aria-controls={`price-history-${product.id}`} aria-expanded={selected} aria-label={`${selected ? "Hide" : "Show"} market and POS details for ${product.name}`} className={`portal-history-toggle ${selected ? "open" : ""}`} type="button" onClick={() => onSelect(product.id)}><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg></button>
      {selected && <div className="portal-inline-history" id={`price-history-${product.id}`}>
        <PortalMarketDetail history={history} isLoading={historyLoading} marketLive={marketLive} product={product} />
        <section className="portal-pos-connection" aria-label="POS connection">
          <div><span>POS connection</span><strong className={isConnected ? "connected" : "attention"}>{isConnected ? `Connected · ${linkedPos?.name}` : "Not connected to an active POS drink"}</strong><small>{linkedPos ? `${linkedPos.sku} · ${linkedPos.isCurrent ? "synced" : "no longer found in POS"}` : "Choose the till item that should receive this drink's live price."}</small></div>
          {!product.isArchived && <select aria-label={`POS drink for ${product.name}`} value={isConnected ? product.posProductId : ""} onChange={event => { if (event.target.value) onChange(product.id, { posProductId: event.target.value, isArchived: false }); }}><option value="">Choose POS drink…</option>{posProducts.filter(candidate => candidate.isCurrent !== false).map(candidate => <option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.sku}</option>)}</select>}
          <div className="portal-pos-actions">{product.logoUrl && <button className="portal-remove-image" type="button" onClick={() => onLogoRemove(product.id)}>Remove image</button>}<button className="portal-archive-drink" type="button" onClick={() => onChange(product.id, { isArchived: !product.isArchived, isLive: false, priority: false })}>{product.isArchived ? "Restore drink" : "Remove from market"}</button></div>
        </section>
      </div>}
    </article>
  );
}
