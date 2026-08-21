import { useState } from "react";
import type { MarketCrashSettings, MarketProduct } from "../../engine/types";
import { marketCrashCapacity, requestedCrashCount } from "../../engine/marketCrash";
import { MarketCrashCinematic } from "../tv/MarketCrashCinematic";
import { ClosingSoonCinematic } from "../tv/ClosingSoonCinematic";

type Props = {
  categories: string[];
  currency: string;
  disabled?: boolean;
  onChange: (settings: MarketCrashSettings) => void;
  products: MarketProduct[];
  serviceMinutes: number;
  settings: MarketCrashSettings;
};

export function PortalCrashSettings({ categories, currency, disabled = false, onChange, products, serviceMinutes, settings }: Props) {
  const [preview, setPreview] = useState<"crash" | "closing" | null>(null);
  const capacity = marketCrashCapacity(serviceMinutes, settings);
  const requested = requestedCrashCount(settings);
  const previewCategory = categories.find(category => (settings.categoryCrashCounts[category] ?? 0) > 0) ?? categories[0] ?? "Cocktails";
  const updateCount = (category: string, value: number) => {
    const categoryCrashCounts = { ...settings.categoryCrashCounts };
    if (value <= 0) delete categoryCrashCounts[category];
    else categoryCrashCounts[category] = value;
    onChange({ ...settings, categoryCrashCounts });
  };

  return <section className="portal-crash-settings" aria-label="Market crash plan">
    <div className="portal-crash-settings-head">
      <div><span>Market crashes</span><h2>Crash plan</h2><p>Choose how often each category can drop. A crash uses 75% of that drink’s available downward range, never its floor.</p></div>
      <div className={`portal-crash-capacity ${requested > capacity ? "is-over" : ""}`}><strong>{requested} of {capacity}</strong><span>crashes planned</span></div>
    </div>
    <div className="portal-crash-controls">
      <label><span>How long it lasts</span><select aria-label="Crash duration" disabled={disabled} onChange={event => onChange({ ...settings, durationMinutes: Number(event.target.value) as 5 | 10 })} value={settings.durationMinutes}><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></label>
    </div>
    <div className="portal-crash-preview">
      <div><strong>TV previews</strong><span>Rehearse the full-screen moments. These do not change the live market.</span></div>
      <div><button onClick={() => setPreview("crash")} type="button">Preview market crash</button><button className="portal-crash-preview-secondary" onClick={() => setPreview("closing")} type="button">Preview closing soon</button></div>
    </div>
    <div className="portal-crash-category-heading"><strong>Categories</strong><span>0 means this category will not crash</span></div>
    <div className="portal-crash-category-list">
      {categories.map(category => {
        const count = settings.categoryCrashCounts[category] ?? 0;
        return <label className={count ? "is-enabled" : ""} key={category}><span>{category}</span><select aria-label={`${category} crashes per service`} disabled={disabled} onChange={event => updateCount(category, Number(event.target.value))} value={count}>{[0, 1, 2, 3, 4].map(option => <option key={option} value={option}>{option === 0 ? "Off" : `${option} ${option === 1 ? "crash" : "crashes"}`}</option>)}</select></label>;
      })}
    </div>
    {requested > capacity && <p className="portal-crash-warning">Reduce the category total to {capacity} crashes for this service length.</p>}
    {preview === "crash" && <MarketCrashCinematic crash={{ id: "market-crash-preview", category: previewCategory, createdAt: new Date().toISOString() }} currency={currency} onPreviewClose={() => setPreview(null)} preview products={products} venueId="preview" />}
    {preview === "closing" && <ClosingSoonCinematic onClose={() => setPreview(null)} />}
  </section>;
}
