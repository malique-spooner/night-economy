import { useCallback, useEffect, useRef, useState } from "react";
import { getMarketState, type MarketState } from "../api/market";
import { supabase } from "../api/client";

export function useMarketState(venueSlug: string, { pollIntervalMs = 0 }: { pollIntervalMs?: number } = {}) {
  const [state, setState] = useState<MarketState | null>(null);
  const [error, setError] = useState<string>("");
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const request = getMarketState(venueSlug)
      .then(nextState => {
        setState(nextState);
        setError("");
      })
      .catch(refreshError => {
        setError(refreshError instanceof Error ? refreshError.message : "Could not load market state");
      })
      .finally(() => {
        if (refreshInFlight.current === request) refreshInFlight.current = null;
      });
    refreshInFlight.current = request;
    return request;
  }, [venueSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime is the fast path. Public displays also poll as a dependable
  // fallback for TVs and phones that have slept or missed a websocket event.
  useEffect(() => {
    if (!pollIntervalMs) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      await refresh();
      if (!cancelled) timer = window.setTimeout(() => { void poll(); }, pollIntervalMs);
    };
    timer = window.setTimeout(() => { void poll(); }, pollIntervalMs);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [pollIntervalMs, refresh]);

  useEffect(() => {
    if (!supabase || state?.source !== "supabase") return undefined;

    const client = supabase;
    const venueId = state.venue.id;
    const channel = client
      .channel(`market-state-${venueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_products", filter: `venue_id=eq.${venueId}` },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "venues", filter: `id=eq.${venueId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, state?.source, state?.venue.id]);

  return { error, refresh, setState, state };
}
