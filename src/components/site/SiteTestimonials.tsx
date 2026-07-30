import { sitePilotProof } from "../../content/siteContent";

export function SiteTestimonials() {
  return (
    <section id="site-testimonials" className="site-section site-testimonials">
      <div className="site-section-intro">
        <div className="site-kicker">Proof before rollout</div>
        <h2>A pilot built to earn its next venue.</h2>
        <p>No invented uplift numbers. We agree the baseline, measure a real service, and let the venue’s own data make the case.</p>
      </div>
      <div className="site-proof-grid" aria-label="Pilot measurement plan">
        {sitePilotProof.map((proof, index) => (
          <article className="site-proof-card" key={proof.value}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{proof.value}</strong>
            <p>{proof.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
