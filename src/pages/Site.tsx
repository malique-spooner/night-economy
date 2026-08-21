type Props = {
  venueSlug?: string;
};

export function Site({ venueSlug }: Props) {
  const signInHref = venueSlug ? `/sign-in/${encodeURIComponent(venueSlug)}` : "/sign-in";

  return (
    <main id="siteView" className="site-holding" aria-labelledby="site-holding-title">
      <header className="site-holding-nav">
        <a aria-label="Night Economy" className="site-holding-mark" href="/">
          <span>NE</span>
          <strong>Night Economy</strong>
        </a>
        <a className="site-holding-signin" href={signInHref}>Sign in to Portal <span aria-hidden="true">→</span></a>
      </header>
      <section className="site-holding-stage">
        <p className="site-holding-eyebrow">The Night Economy website</p>
        <h1 id="site-holding-title"><span>Coming</span> soon.</h1>
        <p className="site-holding-copy">We’re building a new home for the market.</p>
      </section>
      <footer className="site-holding-footer">
        <span>© Night Economy</span>
        <span>For venue teams</span>
      </footer>
    </main>
  );
}
