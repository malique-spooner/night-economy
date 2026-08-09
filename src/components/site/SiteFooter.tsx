type Props = {
  venueSlug: string;
};

export function SiteFooter({ venueSlug }: Props) {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <div className="site-kicker">Night Economy</div>
        <h2>Keep the room moving.</h2>
      </div>
      <div className="site-footer-cols">
        <div>
          <span>Product</span>
          <a href="#site-why">Why it works</a>
          <a href="#site-decks">How it works</a>
          <a href="#site-subscribe">Request a licence</a>
        </div>
        <div>
          <span>Surfaces</span>
          <a href={`/tv/${venueSlug}`}>Room display</a>
          <a href={`/menu/${venueSlug}`}>Guest mobile</a>
          <a href={`/app/${venueSlug}`}>Control center</a>
        </div>
        <div>
          <span>Company</span>
          <a href="mailto:hello@nighteconomy.app">hello@nighteconomy.app</a>
          <a href="#site-why">Founders</a>
          <a href="#site-hero">Back to top</a>
        </div>
      </div>
    </footer>
  );
}
