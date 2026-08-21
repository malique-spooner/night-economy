import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MarketCrashEvent } from "../../api/market";
import type { MarketProduct } from "../../engine/types";

type Props = {
  crash: MarketCrashEvent | null;
  /** Lets the Portal rehearse the exact TV treatment without creating a crash. */
  preview?: boolean;
  onPreviewClose?: () => void;
  products?: MarketProduct[];
  venueId: string;
  currency?: string;
};

export const CRASH_CINEMATIC_DURATION_MS = 15_000;

/** A new crash takes over the TV, but never replays old history or floods a service. */
export function MarketCrashCinematic({ crash, currency = "GBP", onPreviewClose, preview = false, products = [], venueId }: Props) {
  const [visible, setVisible] = useState(false);
  const initialCrashId = useRef<string | null | undefined>(undefined);
  const played = useRef(0);
  const activeCrash = preview ? crash : visible ? crash : null;

  useEffect(() => {
    if (preview) return;
    if (initialCrashId.current === undefined) {
      initialCrashId.current = crash?.id ?? null;
      return;
    }
    if (!crash || crash.id === initialCrashId.current || played.current >= 2) return;
    initialCrashId.current = crash.id;
    played.current += 1;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), CRASH_CINEMATIC_DURATION_MS);
    return () => window.clearTimeout(timer);
    // A market-state refresh creates a new crash object. Keying this effect to
    // the stable ID prevents that refresh from cancelling the hide timer.
  }, [crash?.id, preview, venueId]);

  if (!activeCrash) return null;
  const crashProducts = products
    .filter(product => product.isLive && !product.isSoldOut && product.category === activeCrash.category)
    .sort((left, right) => left.currentPriceMinor - right.currentPriceMinor)
    .slice(0, 3);
  const heroTone = categoryHeroTone(activeCrash.category);
  return <section className="market-crash-cinematic" aria-live="assertive" aria-label={`${activeCrash.category} market crash`} role={preview ? "dialog" : undefined} aria-modal={preview || undefined}>
    {preview && <button aria-label="Close market crash preview" className="market-cinematic-close" onClick={onPreviewClose} type="button">Close preview</button>}
    <div aria-hidden="true" className="market-crash-cinematic-grid" />
    <div aria-hidden="true" className="market-crash-tension"><span>Market volatility detected</span><i /><i /><i /></div>
    <div aria-hidden="true" className="market-crash-shards">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ "--rotation": `${index * 31}deg`, "--travel-x": `${(index - 7) * 13}vw` } as CSSProperties} />)}</div>
    <figure aria-hidden="true" className={`market-crash-hero is-${heroTone}`}><span className="market-crash-hero-orb" /><span className="market-crash-hero-liquid" /><span className="market-crash-hero-glint" />{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--fragment-angle": `${index * 45}deg` } as CSSProperties} />)}</figure>
    <div className="market-crash-cinematic-core" aria-hidden="true"><b>↓</b></div>
    <div className="market-crash-cinematic-copy"><span>Night Economy presents</span><h1>{activeCrash.category}<em> crash</em></h1><p>Limited-time prices are live now</p></div>
    <div className="market-crash-offers" aria-label={`${activeCrash.category} live crash prices`}>
      {crashProducts.length ? crashProducts.map(product => <div key={product.id}><span>{product.name}</span><strong>{formatPrice(product.currentPriceMinor, currency)}</strong></div>) : <div><span>Limited-time category prices</span><strong>Live now</strong></div>}
    </div>
    <div className="market-crash-progress" aria-hidden="true"><i key={activeCrash.id} style={{ animationDuration: `${CRASH_CINEMATIC_DURATION_MS}ms` }} /></div>
  </section>;
}

function formatPrice(priceMinor: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 }).format(priceMinor / 100);
}

function categoryHeroTone(category: string) {
  const value = category.toLowerCase();
  if (value.includes("beer")) return "beer";
  if (value.includes("wine")) return "wine";
  if (value.includes("spirit")) return "spirits";
  return "cocktails";
}
