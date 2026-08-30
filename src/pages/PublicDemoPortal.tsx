import { useState } from "react";
import { formatMoney } from "../components/format";
import { categoryLabel, groupProductsByCategory } from "../components/tv/tvHelpers";
import { useMarketState } from "../hooks/useMarketState";

const PUBLIC_DEMO_SLUG = "public-demo";

/** A public, read-only look through the operator product. No auth or writes. */
export function PublicDemoPortal() {
  const { error, state } = useMarketState(PUBLIC_DEMO_SLUG, { pollIntervalMs: 30_000 });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (error) return <main className="page">Could not load the public demo: {error}</main>;
  if (!state) return <main className="page">Loading public demo...</main>;

  const activeProducts = state.products.filter(product => !product.isArchived);
  const categories = [...new Set(activeProducts.map(product => product.category))].sort((left, right) => left.localeCompare(right));
  const groups = groupProductsByCategory(activeProducts)
    .filter(([category]) => !selectedCategory || category === selectedCategory);
  const liveCount = activeProducts.filter(product => product.isLive && !product.isSoldOut).length;
  const liveStatus = state.venue.marketLive ? "Live now" : "Restarting now";

  return (
    <section className="public-demo-portal" aria-labelledby="public-demo-title">
      <header className="public-demo-nav">
        <a className="public-demo-brand" href="/" aria-label="Night Economy home"><span>NE</span><strong>Night Economy</strong></a>
        <div><a href="/sign-in">Operator sign in</a><a className="public-demo-nav-primary" href={`/tv/${PUBLIC_DEMO_SLUG}`} target="_blank" rel="noreferrer">Open live market</a></div>
      </header>

      <main className="public-demo-main">
        <p className="public-demo-kicker">Public demo · View only</p>
        <div className="public-demo-heading">
          <div>
            <h1 id="public-demo-title">Portal</h1>
            <p>Explore the product exactly as a guest would. The live market runs continuously; editing and service controls are intentionally unavailable.</p>
          </div>
          <span className={`public-demo-status ${state.venue.marketLive ? "is-live" : ""}`}>{liveStatus}</span>
        </div>

        <section className="public-demo-overview" aria-label="Public demo overview">
          <article><span>Venue</span><strong>{state.venue.name}</strong><small>Public demo environment</small></article>
          <article><span>Products live</span><strong>{liveCount}/{activeProducts.length}</strong><small>Prices refresh every five minutes</small></article>
          <article><span>Display rotation</span><strong>15 seconds</strong><small>TV presentation changes while prices stay live</small></article>
          <article><span>Access</span><strong>Read only</strong><small>No account or changes required</small></article>
        </section>

        <section className="public-demo-links" aria-label="Guest-facing views">
          <a href={`/tv/${PUBLIC_DEMO_SLUG}`} target="_blank" rel="noreferrer"><b>Market display</b><span>See the full TV experience and live clock →</span></a>
          <a href={`/menu/${PUBLIC_DEMO_SLUG}`} target="_blank" rel="noreferrer"><b>Mobile market</b><span>Open the guest drinks menu →</span></a>
        </section>

        <section className="public-demo-catalogue" aria-labelledby="public-demo-catalogue-title">
          <div className="public-demo-catalogue-heading">
            <div><p>Read-only catalogue</p><h2 id="public-demo-catalogue-title">Live market products</h2></div>
            <small>Controls, pricing edits, POS setup and settings are disabled in this public version.</small>
          </div>
          <div className="public-demo-filters" aria-label="Drink categories">
            <button className={!selectedCategory ? "active" : ""} type="button" onClick={() => setSelectedCategory(null)}>All drinks</button>
            {categories.map(category => <button className={selectedCategory === category ? "active" : ""} key={category} type="button" onClick={() => setSelectedCategory(category)}>{categoryLabel(category)}</button>)}
          </div>
          {groups.map(([category, products]) => (
            <section className="public-demo-product-group" key={category} aria-label={categoryLabel(category)}>
              <h3>{categoryLabel(category)} <small>{products.filter(product => product.isLive && !product.isSoldOut).length} live</small></h3>
              <div className="public-demo-product-grid">
                {products.map(product => <article key={product.id} className={!product.isLive || product.isSoldOut ? "is-off" : ""}>
                  <div><span>{product.isLive && !product.isSoldOut ? "Live" : product.isSoldOut ? "Sold out" : "Off"}</span><h4>{product.name}</h4></div>
                  <strong>{formatMoney(product.currentPriceMinor, state.venue.currency)}</strong>
                  <small>Range {formatMoney(product.floorPriceMinor, state.venue.currency)}–{formatMoney(product.ceilingPriceMinor, state.venue.currency)}</small>
                </article>)}
              </div>
            </section>
          ))}
        </section>
      </main>
    </section>
  );
}
