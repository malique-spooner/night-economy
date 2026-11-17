import { appPath } from "../../routes";

type Props = { venueName: string };

export function MobileHero({ venueName }: Props) {
  return (
    <section className="mobile-hero" aria-label={`${venueName} live menu`}>
      <img alt="" aria-hidden="true" className="mobile-hero-scene" src={appPath("/images/mobile-london-night.jpg")} />
      <div className="mobile-hero-shade" aria-hidden="true" />
      <div className="mobile-hero-content">
        <div className="mobile-hero-topline">
          <div className="brand mobile-hero-title"><span>NIGHT</span><strong>ECONOMY</strong></div>
        </div>
        <strong className="mobile-venue-name">{venueName}</strong>
        <span className="mobile-venue-location">LONDON · TONIGHT</span>
        <div className="mobile-live-bar"><span><i aria-hidden="true" />LIVE MARKET: OPEN</span><b className="mobile-live-signal" aria-hidden="true"><i /><i /><i /><i /></b></div>
      </div>
    </section>
  );
}
