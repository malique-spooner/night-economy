import { useRef, type PointerEvent } from "react";
import { siteHero } from "../../content/siteContent";

export function SiteHero() {
  const sceneRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const scene = sceneRef.current;
    if (!scene || event.pointerType === "touch") return;
    const bounds = scene.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    scene.style.setProperty("--hero-x", x.toFixed(3));
    scene.style.setProperty("--hero-y", y.toFixed(3));
  }

  function resetScene() {
    sceneRef.current?.style.setProperty("--hero-x", "0");
    sceneRef.current?.style.setProperty("--hero-y", "0");
  }

  return (
    <section id="site-hero" className="site-hero" onPointerMove={handlePointerMove} onPointerLeave={resetScene}>
      <div className="site-hero-scene" ref={sceneRef} aria-hidden="true">
        <div className="site-hero-orbit site-hero-orbit-one"></div>
        <div className="site-hero-orbit site-hero-orbit-two"></div>
        <div className="site-hero-surface site-hero-surface-tv">
          <span>Room display</span><strong>£9.80</strong><i></i><i></i><i></i>
        </div>
        <div className="site-hero-surface site-hero-surface-menu">
          <span>Guest menu</span><strong>Market open</strong><b>Order at the live price</b>
        </div>
        <div className="site-hero-surface site-hero-surface-portal">
          <span>Operator portal</span><strong>Limits active</strong><b>Guardrails on</b>
        </div>
      </div>
      <div className="site-hero-inner">
        <div className="site-kicker">{siteHero.kicker}</div>
        <h1>{siteHero.title}</h1>
        <p>{siteHero.copy}</p>
        <div className="site-hero-actions">
          <a className="site-primary" href="#site-subscribe">Book a 15-minute demo <span aria-hidden="true">↗</span></a>
          <a className="site-text-link" href="#site-decks">See the three surfaces <span aria-hidden="true">↓</span></a>
        </div>
        <div className="site-hero-stats" aria-label="Live market stats">
          {siteHero.stats.map(stat => (
            <span key={stat}>{stat}</span>
          ))}
        </div>
        <div className="site-hero-foot">{siteHero.footnote}</div>
      </div>
      <a className="site-scroll-cue" href="#site-why" aria-label="Scroll to why it works"><span></span>Scroll</a>
    </section>
  );
}
