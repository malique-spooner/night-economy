import { useEffect, useRef } from "react";
import { appPath } from "../routes";

type Props = {
  venueSlug?: string;
};

export function Site({ venueSlug }: Props) {
  const marketPreview = useRef<HTMLVideoElement>(null);
  const path = appPath;
  const signInHref = path(venueSlug ? `/sign-in/${encodeURIComponent(venueSlug)}` : "/sign-in");

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void marketPreview.current?.play().catch(() => undefined);
    }
  }, []);

  return (
    <main id="siteView" className="night-project" aria-labelledby="night-project-title">
      <header className="night-project-nav">
        <a aria-label="Night Economy home" className="night-project-brand" href={path("/")}>
          <span aria-hidden="true">NE</span>
          <strong>Night Economy</strong>
        </a>
        <a className="night-project-nav-link" href={signInHref}>Venue sign in <span aria-hidden="true">↗</span></a>
      </header>

      <section className="night-project-hero">
        <div className="night-project-copy">
          <p className="night-project-eyebrow"><i aria-hidden="true" /> An interactive product concept</p>
          <h1 id="night-project-title">A night out,<br /><em>in motion.</em></h1>
          <p className="night-project-intro">A hospitality pricing concept exploring how drink prices can respond to demand, while giving guests a more engaging way to discover the menu.</p>
          <a className="night-project-primary" href={path("/public-demo")}>Explore the interactive portal <span aria-hidden="true">→</span></a>
          <p className="night-project-footnote">Public demo · venue and market activity are simulated</p>
        </div>
        <div className="night-project-market-card">
          <div className="night-project-market-card-head"><span>PUBLIC MARKET · SHORT LOOP</span><a href={path("/tv/public-demo/")}>LIVE MARKET ↗</a></div>
          <div className="night-project-market-card-screen">
            <video aria-label="A short silent loop of the Night Economy public market" className="night-project-market-loop" loop muted playsInline preload="metadata" poster={path("/media/market-loop-poster.jpg")} ref={marketPreview}>
              <source src={path("/media/market-loop.mp4")} type="video/mp4" />
            </video>
          </div>
          <div className="night-project-market-card-foot"><span>SIMULATED MARKET ACTIVITY</span><a href={path("/tv/public-demo/")}>Open live screen ↗</a></div>
        </div>
      </section>

      <section className="night-project-links" aria-label="Explore the demo">
        <a href={path("/public-demo")}><span>01 / OPERATE</span><strong>Interactive portal</strong><small>Explore the venue dashboard, drinks and market controls.</small><b aria-hidden="true">↗</b></a>
        <a href={path("/tv/public-demo")}><span>02 / WATCH</span><strong>Live market</strong><small>See the public market display and changing drink prices.</small><b aria-hidden="true">↗</b></a>
        <a href={path("/menu/public-demo")}><span>03 / EXPERIENCE</span><strong>Mobile menu</strong><small>Browse the guest-facing menu on a phone-sized view.</small><b aria-hidden="true">↗</b></a>
      </section>

      <footer className="night-project-footer"><span>Designed and built by Malique Spooner</span><span>Project concept · market activity is simulated</span></footer>
    </main>
  );
}
