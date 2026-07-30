import { useEffect, useState } from "react";
import { getCurrentSession, onAuthStateChange } from "../api/auth";
import { SiteFooter } from "../components/site/SiteFooter";
import { SiteHero } from "../components/site/SiteHero";
import { SiteProductFlow } from "../components/site/SiteProductFlow";
import { SiteSignup } from "../components/site/SiteSignup";
import { SiteTestimonials } from "../components/site/SiteTestimonials";
import { SiteWhy } from "../components/site/SiteWhy";
import { useMarketState } from "../hooks/useMarketState";

type Props = {
  venueSlug: string;
};

export function Site({ venueSlug }: Props) {
  const { state: marketState } = useMarketState(venueSlug, { pollIntervalMs: 30_000 });
  const [isSignedIn, setIsSignedIn] = useState(false);
  const venueName = marketState?.venue.name ?? venueSlug.replace(/-/g, " ");
  const portalHref = `/app/${encodeURIComponent(venueSlug)}`;
  const signInHref = `/sign-in/${encodeURIComponent(venueSlug)}`;
  const runHistoryHref = isSignedIn ? `${portalHref}?tab=runs` : `${signInHref}?next=runs`;

  useEffect(() => {
    async function refreshSession() {
      setIsSignedIn(Boolean(await getCurrentSession()));
    }

    void refreshSession();
    return onAuthStateChange(() => { void refreshSession(); });
  }, []);

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
              <a href={`/tv/${encodeURIComponent(venueSlug)}`}>Market</a>
              <a href={`/menu/${encodeURIComponent(venueSlug)}`}>Mobile market</a>
              <a href={runHistoryHref}>Run history</a>
              <a href="#site-why">Why it works</a>
              <a href="#site-decks">Product</a>
              <a href="#site-subscribe">Pilot</a>
            </nav>
            <a className="site-nav-cta" href={isSignedIn ? portalHref : signInHref}>
              {isSignedIn ? "Open portal" : "Portal sign in"}
              <span aria-hidden="true">↗</span>
            </a>
          </header>
          <SiteHero />
          <SiteWhy />
          <SiteProductFlow />
          <SiteTestimonials />
          <SiteSignup />
          <SiteFooter venueSlug={venueSlug} />
        </div>
      </section>
    </>
  );
}
