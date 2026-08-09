import { SiteFooter } from "../components/site/SiteFooter";
import { SiteHero } from "../components/site/SiteHero";
import { SiteProductFlow } from "../components/site/SiteProductFlow";
import { SiteSignup } from "../components/site/SiteSignup";
import { SiteWhy } from "../components/site/SiteWhy";
import { useMarketState } from "../hooks/useMarketState";

type Props = {
  venueSlug: string;
};

export function Site({ venueSlug }: Props) {
  const { state: marketState } = useMarketState(venueSlug, { pollIntervalMs: 30_000 });
  const venueName = marketState?.venue.name ?? venueSlug.replace(/-/g, " ");
  const signInHref = `/sign-in/${encodeURIComponent(venueSlug)}`;

  return (
    <>
      <section id="siteView" className="alt-view site-view active">
        <div className="site-shell">
          <header className="site-nav">
            <a className="site-nav-brand" href="#site-hero" aria-label={`${venueName} by Night Economy`}>
              <span aria-hidden="true">NE</span>
              <strong><span>Night Economy</span><small>{venueName}</small></strong>
            </a>
            <nav className="site-nav-links" aria-label="Main navigation">
              <a href="#site-why">For venues</a>
              <a href="#site-decks">How it works</a>
              <a href="#site-subscribe">Licences</a>
            </nav>
            <a className="site-nav-cta" href={signInHref}>
              Sign in
              <span aria-hidden="true">↗</span>
            </a>
          </header>
          <SiteHero />
          <SiteWhy />
          <SiteProductFlow />
          <SiteSignup />
          <SiteFooter venueSlug={venueSlug} />
        </div>
      </section>
    </>
  );
}
