import { supabase } from "./client";

export type MarketRun = {
  id: string;
  kind: "quick" | "scheduled";
  status: "running" | "paused" | "ended" | "completed";
  startedAt: string;
  endedAt: string | null;
  simulatedMinutes: number;
  salesCount: number;
  revenueMinor: number;
};

type MarketRunRow = {
  id: string;
  kind: MarketRun["kind"];
  status: MarketRun["status"];
  started_at: string;
  ended_at: string | null;
  simulated_minutes: number;
  sales_count: number;
  revenue_minor: number;
};

export async function getMarketRuns(venueId: string): Promise<MarketRun[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("market_runs")
    .select("id,kind,status,started_at,ended_at,simulated_minutes,sales_count,revenue_minor")
    .eq("venue_id", venueId)
    .order("started_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return ((data ?? []) as MarketRunRow[]).map(row => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    simulatedMinutes: row.simulated_minutes,
    salesCount: row.sales_count,
    revenueMinor: row.revenue_minor,
  }));
}
