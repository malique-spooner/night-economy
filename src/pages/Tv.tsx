import { useEffect, useState } from "react";
import { LiveTicker } from "../components/tv/LiveTicker";
import { MarketBoard } from "../components/tv/MarketBoard";
import { TvBackground } from "../components/tv/TvBackground";
import { TvStoryPanel } from "../components/tv/TvStoryPanel";
import { MarketClosedExperience } from "../components/market/MarketClosedExperience";
import { TvTopBar } from "../components/tv/TvTopBar";
import { marketStatusLabel } from "../components/tv/tvHelpers";
import { getSimulatorState } from "../api/simulator";
import { useMarketState } from "../hooks/useMarketState";

type Props = {
  venueSlug: string;
};

export function Tv({ venueSlug }: Props) {
  const { error, state } = useMarketState(venueSlug, { pollIntervalMs: 30_000 });
  const timezone = state?.venue.timezone ?? "Europe/London";
  const [clock, setClock] = useState(() => formatClock(new Date(), timezone));
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const enterFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f") enterFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refreshClock() {
      try {
        const simulation = await getSimulatorState(venueSlug);
        if (!cancelled) setClock(formatClock(new Date(simulation.service.simulatedTime), timezone));
      } catch {
        if (!cancelled) setClock(formatClock(new Date(), timezone));
      }
    }
    let timer: number | undefined;
    const poll = async () => {
      await refreshClock();
      if (!cancelled) timer = window.setTimeout(() => { void poll(); }, 10_000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [timezone, venueSlug]);

  if (error) return <main className="page">Could not load market: {error}</main>;
  if (!state) return <main className="page">Loading market...</main>;

  if (!state.venue.marketLive) {
    return <MarketClosedExperience onFullscreen={enterFullscreen} surface="tv" venue={state.venue} />;
  }

  return (
    <>
      <TvBackground />
      <div className="root">
        <div className="ui">
          <TvTopBar clock={clock} isFullscreen={isFullscreen} marketStatusLabel={marketStatusLabel(state.venue)} onFullscreen={enterFullscreen} venueName={state.venue.name} />
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

function formatClock(date: Date, timezone: string) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  });
}
