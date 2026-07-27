import { useCallback, useEffect, useState } from "react";
import { getMarketState, type MarketState } from "../api/market";
import { supabase } from "../api/client";

export function useMarketState(venueSlug: string, { pollIntervalMs = 0 }: { pollIntervalMs?: number } = {}) {
  const [state, setState] = useState<MarketState | null>(null);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const nextState = await getMarketState(venueSlug);
      setState(nextState);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not load market state");
    }
  }, [venueSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime is the fast path. Public displays also poll as a dependable
  // fallback for TVs and phones that have slept or missed a websocket event.
  useEffect(() => {
    if (!pollIntervalMs) return undefined;
    const interval = window.setInterval(() => { void refresh(); }, pollIntervalMs);
    return () => window.clearInterval(interval);
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
