type Props = { venueName: string };

export function MobileHero({ venueName }: Props) {
  return (
    <section className="mobile-hero">
      <div className="brand mobile-hero-title"><span>Night Economy</span><b aria-hidden="true">×</b><strong>{venueName}</strong></div>
    </section>
  );
}
