import { MobileCategoryRail } from "../components/mobile/MobileCategoryRail";
import { MobileHero } from "../components/mobile/MobileHero";
import { MobileMarketSection } from "../components/mobile/MobileMarketSection";
import { MarketClosedExperience } from "../components/market/MarketClosedExperience";
import { mobileCategorySectionId } from "../components/mobile/mobileHelpers";
import { categoryLabel, groupProductsByCategory } from "../components/tv/tvHelpers";
import { useMarketState } from "../hooks/useMarketState";

type Props = {
  venueSlug: string;
};

export function Menu({ venueSlug }: Props) {
  const { error, state } = useMarketState(venueSlug, { pollIntervalMs: 30_000 });

  if (error) return <main className="page">Could not load menu: {error}</main>;
  if (!state) return <main className="page">Loading menu...</main>;

  if (!state.venue.marketLive) {
    return <>
      <MarketClosedExperience surface="mobile" venue={state.venue} />
    </>;
  }

  // The public menu is the live market board, not the venue's full catalogue.
  // This keeps it aligned with the TV and prevents inactive drinks appearing
  // with prices that are not currently being managed by the market.
  const activeProducts = state.products.filter(product => product.isLive);
  const groups = groupProductsByCategory(activeProducts);
  const categoryLinks = groups.map(([category]) => ({
    id: mobileCategorySectionId(category),
    label: categoryLabel(category),
  }));

  return (
    <>
      <section id="mobileView" className="alt-view mobile-view active">
        <div className="mobile-shell">
          <MobileHero venueName={state.venue.name} />
          <main className="mobile-menu">
            <MobileCategoryRail categories={categoryLinks} />
            {groups.map(([category, products]) => (
              <MobileMarketSection category={category} products={products} venue={state.venue} key={category} />
            ))}
          </main>
        </div>
      </section>
    </>
  );
}
