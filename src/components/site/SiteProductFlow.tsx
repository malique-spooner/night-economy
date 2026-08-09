import { useEffect, useRef, useState, type PointerEvent } from "react";
import { siteProductSlides } from "../../content/siteContent";

export function SiteProductFlow() {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, startScroll: 0 });
  const programmaticIndex = useRef<number | null>(null);
  const scrollSettleTimer = useRef<number | undefined>(undefined);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => () => window.clearTimeout(scrollSettleTimer.current), []);

  function updateActive() {
    if (programmaticIndex.current !== null) {
      setActiveIndex(programmaticIndex.current);
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const slides = Array.from(track.querySelectorAll<HTMLElement>(".site-deck-slide"));
    const center = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    slides.forEach((slide, index) => {
      const nextDistance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });
    setActiveIndex(nearest);
  }

  function goTo(index: number) {
    const track = trackRef.current;
    const slide = track?.querySelectorAll<HTMLElement>(".site-deck-slide")[index];
    if (!track || !slide) return;
    programmaticIndex.current = index;
    window.clearTimeout(scrollSettleTimer.current);
    track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior: "smooth" });
    setActiveIndex(index);
    scrollSettleTimer.current = window.setTimeout(() => {
      programmaticIndex.current = null;
      updateActive();
    }, 500);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    dragState.current = { active: true, startX: event.clientX, startScroll: track.scrollLeft };
    track.classList.add("is-dragging");
    track.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track || !dragState.current.active) return;
    track.scrollLeft = dragState.current.startScroll - (event.clientX - dragState.current.startX) * 1.15;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track || !dragState.current.active) return;
    dragState.current.active = false;
    track.classList.remove("is-dragging");
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    updateActive();
  }

  return (
    <section id="site-decks" className="site-section site-decks">
      <div className="site-section-intro">
        <div className="site-kicker">One connected market</div>
        <h2>From sale to screen.</h2>
        <p>The POS informs the market. Every surface updates together.</p>
      </div>
      <div
        className="site-deck-track"
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onScroll={updateActive}
        aria-label="Venue stack carousel"
      >
        {siteProductSlides.map((slide, index) => (
          <DeckSlide {...slide} active={index === activeIndex} index={index} key={slide.tone} />
        ))}
      </div>
      <div className="site-deck-controls">
        <p><strong>{String(activeIndex + 1).padStart(2, "0")}</strong> / {String(siteProductSlides.length).padStart(2, "0")}</p>
        <div className="site-deck-dots" aria-label="Choose a product view">
          {siteProductSlides.map((slide, index) => (
            <button type="button" aria-label={`Show ${slide.label}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => goTo(index)} key={slide.tone}></button>
          ))}
        </div>
        <div className="site-deck-arrows">
          <button type="button" onClick={() => goTo(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0} aria-label="Previous product view">←</button>
          <button type="button" onClick={() => goTo(Math.min(siteProductSlides.length - 1, activeIndex + 1))} disabled={activeIndex === siteProductSlides.length - 1} aria-label="Next product view">→</button>
        </div>
      </div>
    </section>
  );
}

function DeckSlide({ tone, label, copy, active, index }: { tone: string; label: string; copy: string; active: boolean; index: number }) {
  return (
    <article className={`site-deck-slide tone-${tone}`} data-active={active} aria-label={`${label}: ${copy}`}>
      <div className="site-deck-meta">
        <span>{String(index + 1).padStart(2, "0")} · Live surface</span>
        <div><strong>{label}</strong><p>{copy}</p></div>
      </div>
      <div className={`site-deck-screen site-deck-preview preview-${tone}`} aria-hidden="true">
        <DeckPreview tone={tone} />
      </div>
    </article>
  );
}

function DeckPreview({ tone }: { tone: string }) {
  if (tone === "mobile") {
    return (
      <div className="site-preview-phone">
        <PreviewTop label="Guest menu" status="Market open" />
        <div className="site-preview-phone-hero"><span>Spotlight</span><strong>Aperol Spritz</strong><b>£10.80</b><small>Order at the live price</small></div>
        <div className="site-preview-phone-tabs"><i></i><i></i><i></i></div>
        <PreviewRow name="Classic Negroni" price="£11.20" movement="+1.8%" />
        <PreviewRow name="Hugo Spritz" price="£10.40" movement="−2.1%" />
        <PreviewRow name="Old Fashioned" price="£12.60" movement="+0.6%" />
      </div>
    );
  }

  if (tone === "portal") {
    return (
      <div className="site-preview-portal">
        <aside><strong>Night Economy</strong><span>Overview</span><span className="active">Live market</span><span>Menu</span><span>Settings</span></aside>
        <main>
          <PreviewTop label="Venue controls" status="All guardrails active" />
          <div className="site-preview-control-head"><div><span>Market product</span><strong>Aperol Spritz</strong></div><b>Live</b></div>
          <div className="site-preview-chart"><i></i><i></i><i></i><i></i><b></b></div>
          <div className="site-preview-limits"><div><span>Floor</span><strong>£9.00</strong></div><div><span>Live</span><strong>£10.80</strong></div><div><span>Ceiling</span><strong>£13.50</strong></div></div>
        </main>
      </div>
    );
  }

  if (tone === "event") {
    return (
      <div className="site-preview-event">
        <PreviewTop label="Market update" status="Synced to 3 surfaces" />
        <div className="site-preview-event-hero"><span>Latest market round</span><strong>Aperol Spritz is setting the pace.</strong><b>£10.80</b></div>
        <div className="site-preview-event-flow"><i>Portal</i><em>→</em><i>Display</i><em>→</em><i>Menu</i><em>→</em><i>Order</i></div>
        <p>Every live price remains inside the venue’s configured range.</p>
      </div>
    );
  }

  return (
    <div className="site-preview-display">
      <PreviewTop label="Live market board" status="Market open" />
      <div className="site-preview-display-grid">
        <div>
          <PreviewRow name="Aperol Spritz" price="£10.80" movement="+4.2%" featured />
          <PreviewRow name="Classic Negroni" price="£11.20" movement="+1.8%" />
          <PreviewRow name="Hugo Spritz" price="£10.40" movement="−2.1%" />
        </div>
        <aside><span>House signal</span><strong>Aperol Spritz is setting the pace.</strong><small>Current price</small><b>£10.80</b></aside>
      </div>
      <div className="site-preview-ticker">LIVE PRICES · APEROL SPRITZ £10.80 ↑ · HUGO SPRITZ £10.40 ↓</div>
    </div>
  );
}

function PreviewTop({ label, status }: { label: string; status: string }) {
  return <div className="site-preview-top"><strong>{label}</strong><span><i></i>{status}</span></div>;
}

function PreviewRow({ name, price, movement, featured = false }: { name: string; price: string; movement: string; featured?: boolean }) {
  return <div className={`site-preview-row ${featured ? "featured" : ""}`}><span>{name}<small>Live price</small></span><strong>{price}<small>{movement}</small></strong></div>;
}
