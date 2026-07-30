import { useEffect, useRef, useState } from "react";
import { siteReasons } from "../../content/siteContent";

export function SiteWhy() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeReason = siteReasons[activeIndex];

  useEffect(() => {
    const sectionElement = sectionRef.current;
    if (!sectionElement) return;
    const root = sectionElement;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".site-why-card"));
    const visualWrap = root.querySelector<HTMLElement>(".site-why-visual-wrap");
    let frame = 0;

    function update() {
      frame = 0;
      const focus = window.innerHeight * 0.5;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const bounds = card.getBoundingClientRect();
        const center = bounds.top + bounds.height / 2;
        const distance = Math.abs(center - focus);
        const progress = Math.max(0, 1 - distance / (window.innerHeight * 0.72));
        card.style.setProperty("--card-progress", progress.toFixed(3));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      if (visualWrap) {
        const sectionBounds = root.getBoundingClientRect();
        const baseMargin = Math.max(0, (window.innerHeight - 616) / 2);
        const maxShift = Math.max(0, root.offsetHeight - visualWrap.offsetHeight - baseMargin);
        const shift = window.innerWidth > 900
          ? Math.min(maxShift, Math.max(0, 96 - sectionBounds.top - baseMargin))
          : 0;
        visualWrap.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      }
      setActiveIndex(current => current === closestIndex ? current : closestIndex);
    }

    function requestUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section id="site-why" className="site-section site-why" ref={sectionRef}>
      <div className="site-why-shell">
        <div className="site-section-split site-why-grid">
          <div className="site-why-copy">
            <div className="site-kicker">Why it wins</div>
            <h2>Software the room can feel.</h2>
            <p>Guests see momentum. Staff see where to steer demand. Operators keep the market playful, profitable, and under control.</p>
            <div className="site-why-panel" aria-label="Why Night Economy works">
              {siteReasons.map((reason, index) => (
                <article className={`site-why-card ${index === 0 ? "site-why-card-primary" : ""}`} data-active={index === activeIndex} key={reason.number}>
                  <span>{reason.number}</span>
                  <strong>{reason.title}</strong>
                  <p>{reason.copy}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="site-why-visual-wrap">
            <div className="site-why-visual" data-scene={activeIndex + 1} aria-live="polite">
              <div className="site-display-mock">
                <div className="site-display-top">
                  <span>Market open</span>
                  <strong>Live · 22:48</strong>
                </div>
                <div className="site-display-hero">
                  <span>{activeReason.title}</span>
                  <strong>{activeIndex === 0 ? "£9.80" : activeIndex === 1 ? "±12%" : "+18%"}</strong>
                </div>
                <div className="site-display-rows">
                  <i><span></span></i>
                  <i><span></span></i>
                  <i><span></span></i>
                  <i><span></span></i>
                </div>
                <div className="site-display-note">{activeReason.copy}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
