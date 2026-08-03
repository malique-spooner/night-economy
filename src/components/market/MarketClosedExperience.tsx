import { useEffect, useState } from "react";
import type { Venue } from "../../engine/types";
import { formatRemainingTime, getNextMarket } from "./nextMarket";

type Props = {
  onFullscreen?: () => void;
  surface: "tv" | "mobile";
  venue: Venue;
};

export function MarketClosedExperience({ onFullscreen, surface, venue }: Props) {
  const [now, setNow] = useState(() => new Date());
  const next = getNextMarket(venue.marketSchedule, now, venue.timezone);
  const remaining = next ? formatRemainingTime(next.remainingMs) : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className={`market-closed market-closed-${surface}`}>
      <div className="market-closed-grid" aria-hidden="true" />
      <div className="market-closed-orbit market-closed-orbit-one" aria-hidden="true" />
      <div className="market-closed-orbit market-closed-orbit-two" aria-hidden="true" />
      <section className="market-closed-card">
        <span className="market-closed-eyebrow"><i /> Market resting</span>
        <p className="market-closed-venue">{venue.name}</p>
        {next && remaining ? (
          <>
            <h1>Prices return<br />{next.day} at <em>{next.start}</em></h1>
            <div className="market-closed-countdown" aria-label={`Market opens in ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds`}>
              <TimeBlock label="Days" value={remaining.days} />
              <TimeBlock label="Hours" value={remaining.hours} />
              <TimeBlock label="Minutes" value={remaining.minutes} />
              <TimeBlock label="Seconds" value={remaining.seconds} />
            </div>
            <p className="market-closed-note">Live prices will appear here when the next market opens.</p>
          </>
        ) : (
          <>
            <h1>The next market<br />is being planned.</h1>
            <p className="market-closed-note">Check back soon for live drink prices.</p>
          </>
        )}
        {surface === "tv" && onFullscreen ? <div className="market-closed-actions">
          <button className="market-closed-cinema primary" onClick={onFullscreen} type="button">Enter full screen</button>
        </div> : null}
      </section>
    </main>
  );
}

function TimeBlock({ label, value }: { label: string; value: number }) {
  return <div><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>;
}
