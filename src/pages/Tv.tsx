import { useEffect, useRef, useState } from "react";
import { LiveTicker } from "../components/tv/LiveTicker";
import { MarketBoard } from "../components/tv/MarketBoard";
import { TvBackground } from "../components/tv/TvBackground";
import { TvStoryPanel } from "../components/tv/TvStoryPanel";
import { MarketClosedExperience } from "../components/market/MarketClosedExperience";
import { TvTopBar } from "../components/tv/TvTopBar";
import { MarketCrashCinematic } from "../components/tv/MarketCrashCinematic";
import { getSimulatorState } from "../api/simulator";
import type { MarketState } from "../api/market";
import { supabase } from "../api/client";
import { useMarketState } from "../hooks/useMarketState";

type Props = {
  venueSlug: string;
};

export function Tv({ venueSlug }: Props) {
  const { error, refresh, state: liveState } = useMarketState(venueSlug, { pollIntervalMs: 30_000 });
  const [presentedState, setPresentedState] = useState<MarketState | null>(null);
  const state = liveState ? { ...liveState, products: presentedState?.venue.id === liveState.venue.id ? presentedState.products : liveState.products } : null;
  const timezone = liveState?.venue.timezone ?? "Europe/London";
  const [boardCategory, setBoardCategory] = useState<string | null>(null);
  const [clock, setClock] = useState(() => formatClock(new Date(), timezone));
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [simulationSpeed, setSimulationSpeed] = useState(20);
  const [activeRunId, setActiveRunId] = useState<string | undefined>();
  const [historyRunReady, setHistoryRunReady] = useState(false);
  const [presentationAnchor, setPresentationAnchor] = useState<{ realAt: number; simulatedAt: number } | null>(null);
  const [roundAnchorAt, setRoundAnchorAt] = useState<string | null>(null);
  const [roundSequence, setRoundSequence] = useState(0);
  const latestStateRef = useRef<MarketState | null>(null);
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
    if (!liveState) return;
    latestStateRef.current = liveState;
    setPresentedState(current => current?.venue.id === liveState.venue.id ? current : liveState);
  }, [liveState]);

  useEffect(() => {
    if (!liveState) return undefined;
    let active = true;
    setActiveRunId(undefined);
    setHistoryRunReady(false);
    void getSimulatorState(venueSlug)
      .then(simulation => {
        if (!active) return;
        setActiveRunId(simulation.service.activeRunId ?? undefined);
        setHistoryRunReady(true);
        const speed = Math.max(1, simulation.service.speed);
        const realAt = Date.now();
        setSimulationSpeed(speed);
        setPresentationAnchor({ realAt, simulatedAt: Date.parse(simulation.service.simulatedTime) });
        setRoundAnchorAt(new Date(realAt).toISOString());
      })
      .catch(() => {
        if (!active) return;
        setHistoryRunReady(true);
        const realAt = Date.now();
        setSimulationSpeed(20);
        setPresentationAnchor({ realAt, simulatedAt: realAt });
        setRoundAnchorAt(new Date(realAt).toISOString());
      });
    return () => { active = false; };
  }, [liveState?.venue.id, timezone, venueSlug]);

  useEffect(() => {
    if (!liveState) return undefined;
    let active = true;
    const syncRun = () => {
      void getSimulatorState(venueSlug)
        .then(simulation => {
          if (!active) return;
          setActiveRunId(simulation.service.activeRunId ?? undefined);
          setHistoryRunReady(true);
        })
        .catch(() => { if (active) setHistoryRunReady(true); });
    };
    syncRun();
    const timer = window.setInterval(syncRun, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [liveState?.venue.id, venueSlug]);

  useEffect(() => {
    if (!presentationAnchor) return undefined;
    const roundDurationMs = 300_000 / simulationSpeed;
    const updateClock = () => {
      const elapsed = Math.max(0, Date.now() - presentationAnchor.realAt);
      setClock(formatClock(new Date(presentationAnchor.simulatedAt + elapsed * simulationSpeed), timezone));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 250);
    return () => window.clearInterval(timer);
  }, [presentationAnchor, simulationSpeed, timezone]);

  useEffect(() => {
    if (!presentationAnchor) return undefined;
    const roundDurationMs = 300_000 / simulationSpeed;
    let nextRoundAt = presentationAnchor.realAt + roundDurationMs;
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const now = Date.now();
        setPresentedState(latestStateRef.current);
        setRoundSequence(sequence => sequence + 1);
        setRoundAnchorAt(new Date(now).toISOString());
        do nextRoundAt += roundDurationMs;
        while (nextRoundAt <= now);
        schedule();
      }, Math.max(0, nextRoundAt - Date.now()));
    };
    schedule();
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [presentationAnchor, simulationSpeed]);

  useEffect(() => {
    if (!supabase || liveState?.source !== "supabase") return undefined;
    const client = supabase;
    const venueId = liveState.venue.id;
    const channel = client
      .channel(`tv-market-rounds-${venueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "market_price_snapshots", filter: `venue_id=eq.${venueId}` },
        () => {
          // Buffer the finished round. The drift-corrected presentation timer
          // reveals it with the board/story change at the exact 15-second mark.
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [liveState?.source, liveState?.venue.id, refresh]);

  if (error) return <main className="page">Could not load market: {error}</main>;
  if (!state) return <main className="page">Loading market...</main>;

  if (!state.venue.marketLive) {
    return <MarketClosedExperience onFullscreen={enterFullscreen} surface="tv" venue={state.venue} />;
  }

  return (
    <>
      <TvBackground />
      <MarketCrashCinematic crash={state.crash} currency={state.venue.currency} products={state.products} venueId={state.venue.id} />
      <div className="root">
        <div className="ui">
          <TvTopBar clock={clock} isFullscreen={isFullscreen} onFullscreen={enterFullscreen} venueName={state.venue.name} />
          <div className="body">
            <><MarketBoard activeRunId={activeRunId} historyRunReady={historyRunReady} onCategoryChange={setBoardCategory} products={state.products} roundSequence={roundSequence} venue={state.venue} /><div className="divv"></div><TvStoryPanel category={boardCategory} products={state.products} roundSequence={roundSequence} venue={state.venue} /></>
          </div>
          <LiveTicker products={state.products} roundAnchorAt={roundAnchorAt} roundDurationMs={300_000 / simulationSpeed} venue={state.venue} />
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
