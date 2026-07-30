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

export type MarketRunSale = {
  posProductId: string;
  quantity: number;
  unitPriceMinor: number;
  occurredAt: string;
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

type MarketRunSaleRow = {
  pos_product_id: string;
  quantity: number;
  unit_price_minor: number;
  occurred_at: string;
};

export async function getMarketRunSales(runId: string): Promise<MarketRunSale[]> {
  if (!supabase) return [];
  const pageSize = 1_000;
  const rows: MarketRunSaleRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("pos_sales_events")
      .select("pos_product_id,quantity,unit_price_minor,occurred_at")
      .eq("run_id", runId)
      .order("occurred_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as MarketRunSaleRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.map(row => ({
    posProductId: row.pos_product_id,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    occurredAt: row.occurred_at,
  }));
}
