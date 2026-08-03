import { NightEconomyLogo } from "../components/brand/NightEconomyLogo";

export function LogoDemo() {
  return (
    <main className="logo-demo-page">
      <header className="logo-demo-header">
        <a href="/" className="logo-demo-back">← Night Economy</a>
        <p>Animated identity study</p>
      </header>
      <section className="logo-demo-intro">
        <p>Live hospitality pricing</p>
        <h1>Night Economy.<br />Simply stated.</h1>
        <span>A clear text-only wordmark that works at every size and on every surface.</span>
      </section>
      <section className="logo-demo-grid" aria-label="Night Economy logo variants">
        <article className="logo-demo-card is-light">
          <span>Light background · animated</span>
          <NightEconomyLogo showWordmark size="min(100%, 420px)" />
        </article>
        <article className="logo-demo-card is-dark">
          <span>Dark background · animated</span>
          <NightEconomyLogo variant="dark" showWordmark size="min(100%, 420px)" />
        </article>
        <article className="logo-demo-card is-light">
          <span>Light background · static</span>
          <NightEconomyLogo animated={false} size="min(100%, 420px)" />
        </article>
        <article className="logo-demo-card is-dark">
          <span>Dark background · static</span>
          <NightEconomyLogo variant="dark" animated={false} size="min(100%, 420px)" />
        </article>
      </section>
    </main>
  );
}
