import { useEffect, useState } from "react";
import { LiveTicker } from "../components/tv/LiveTicker";
import { MarketBoard } from "../components/tv/MarketBoard";
import { TvBackground } from "../components/tv/TvBackground";
import { TvStoryPanel } from "../components/tv/TvStoryPanel";
import { TvTopBar } from "../components/tv/TvTopBar";
import { marketStatusLabel } from "../components/tv/tvHelpers";
import { getSimulatorState } from "../api/simulator";
import { useMarketState } from "../hooks/useMarketState";
import { PageSwitcher } from "./PageSwitcher";

type Props = {
  venueSlug: string;
};

export function Tv({ venueSlug }: Props) {
  const { error, state } = useMarketState(venueSlug, { pollIntervalMs: 2_000 });
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    let cancelled = false;
    async function refreshClock() {
      try {
        const simulation = await getSimulatorState();
        if (!cancelled) setClock(formatClock(new Date(simulation.service.simulatedTime)));
      } catch {
        // A deployed venue has no local simulator. Keep a London venue clock.
        if (!cancelled) setClock(formatClock(new Date()));
      }
    }
    void refreshClock();
    const timer = window.setInterval(() => { void refreshClock(); }, 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (error) return <main className="page">Could not load market: {error}</main>;
  if (!state) return <main className="page">Loading market...</main>;

  const sourceLabel = state.source === "supabase" ? "Live data" : "Seed fallback";

  return (
    <>
      <PageSwitcher active="tv" venueSlug={venueSlug} />
      <TvBackground />
      <div className="root">
        <div className="ui">
          <TvTopBar clock={clock} marketStatusLabel={marketStatusLabel(state.venue)} sourceLabel={sourceLabel} />
          <div className="body">
            <MarketBoard products={state.products} venue={state.venue} />
            <div className="divv"></div>
            <TvStoryPanel products={state.products} venue={state.venue} />
          </div>
          <LiveTicker products={state.products} venue={state.venue} />
        </div>
      </div>
    </>
  );
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/London",
  });
}
