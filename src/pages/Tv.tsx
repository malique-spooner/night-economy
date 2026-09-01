import { useCallback, useEffect, useRef, useState } from "react";
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

// The display is a paced visual experience, independent from when the market
// writes a new five-minute price round. That keeps a real-time service lively.
const PRESENTATION_ROTATION_MS = 15_000;
export const PREPARING_SCREEN_MAX_MS = 8_000;

export function clearStartingParameter() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("starting")) return;
  url.searchParams.delete("starting");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function Tv({ venueSlug }: Props) {
  const { error, refresh, state: liveState } = useMarketState(venueSlug, { pollIntervalMs: 30_000 });
  const [isPreparing, setIsPreparing] = useState(() => new URLSearchParams(window.location.search).get("starting") === "1");
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
  const [postCrashCategory, setPostCrashCategory] = useState<string | null>(null);
  const handleCrashComplete = useCallback((category: string) => {
    setPostCrashCategory(category);
    window.setTimeout(() => setPostCrashCategory(null), 15_000);
  }, []);
  const latestStateRef = useRef<MarketState | null>(null);
  const enterFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  useEffect(() => {
    if (!isPreparing) return undefined;
    // The launch tab includes ?starting=1 only to bridge the short gap before
    // the market becomes live. Do not let that URL flag turn an ended market
    // into a permanent loading screen.
    if (liveState?.venue.marketLive) {
      setIsPreparing(false);
      clearStartingParameter();
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setIsPreparing(false);
      clearStartingParameter();
    }, PREPARING_SCREEN_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [isPreparing, liveState?.venue.marketLive]);

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
    if (!liveState || liveState.venue.marketLive) return undefined;

    // A Portal action and its newly opened TV tab race each other. If the tab
    // reads the closed state first, make a short, bounded set of retries rather
    // than leaving the display parked until the normal 30-second poll.
    const timers = [350, 1_000, 2_000, 4_000].map(delay => window.setTimeout(() => { void refresh(); }, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [liveState?.venue.id, liveState?.venue.marketLive, refresh]);

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
        // `simulatedTime` is stored at the last completed minute. Advance it
        // by the real time since that tick so the displayed clock does not
        // remain up to a minute behind the actual market.
        const lastTickAt = Date.parse(simulation.service.lastTickAt ?? simulation.service.simulatedTime);
        const elapsedSinceTick = simulation.service.running && !Number.isNaN(lastTickAt)
          ? Math.max(0, realAt - lastTickAt)
          : 0;
        setPresentationAnchor({ realAt, simulatedAt: Date.parse(simulation.service.simulatedTime) + elapsedSinceTick * speed });
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
  // A demo launched from the Portal opens this tab just before `marketLive`
  // changes. Re-read the simulator when that transition arrives so a display
  // never stays anchored to the previous 1× service clock.
  }, [liveState?.venue.id, liveState?.venue.marketLive, timezone, venueSlug]);

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
    const updateClock = () => {
      // A 1× scheduled market is real time. Reading the venue's actual clock
      // directly avoids a visible delay introduced by polling simulator state.
      if (simulationSpeed === 1) {
        setClock(formatClock(new Date(), timezone));
        return;
      }
      const elapsed = Math.max(0, Date.now() - presentationAnchor.realAt);
      setClock(formatClock(new Date(presentationAnchor.simulatedAt + elapsed * simulationSpeed), timezone));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 250);
    return () => window.clearInterval(timer);
  }, [presentationAnchor, simulationSpeed, timezone]);

  useEffect(() => {
    if (!presentationAnchor) return undefined;
    let nextRoundAt = presentationAnchor.realAt + PRESENTATION_ROTATION_MS;
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const now = Date.now();
        setPresentedState(latestStateRef.current);
        setRoundSequence(sequence => sequence + 1);
        setRoundAnchorAt(new Date(now).toISOString());
        do nextRoundAt += PRESENTATION_ROTATION_MS;
        while (nextRoundAt <= now);
        schedule();
      }, Math.max(0, nextRoundAt - Date.now()));
    };
    schedule();
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [presentationAnchor]);

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
    return <MarketClosedExperience isPreparing={isPreparing} onFullscreen={enterFullscreen} surface="tv" venue={state.venue} />;
  }

  return (
    <>
      <TvBackground />
      <MarketCrashCinematic crash={state.crash} currency={state.venue.currency} onComplete={handleCrashComplete} products={state.products} venueId={state.venue.id} />
      <div className="root">
        <div className="ui">
          <TvTopBar clock={clock} isFullscreen={isFullscreen} onFullscreen={enterFullscreen} venueName={state.venue.name} />
          <div className="body">
            <><MarketBoard activeRunId={activeRunId} featuredCategory={postCrashCategory} historyRunReady={historyRunReady} onCategoryChange={setBoardCategory} products={state.products} roundSequence={roundSequence} venue={state.venue} /><div className="divv"></div><TvStoryPanel category={boardCategory} products={state.products} roundSequence={roundSequence} venue={state.venue} /></>
          </div>
          <LiveTicker products={state.products} roundAnchorAt={roundAnchorAt} roundDurationMs={PRESENTATION_ROTATION_MS} venue={state.venue} />
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
