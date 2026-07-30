import { supabase } from "./client";

export type MarketRun = {
  id: string;
  kind: "quick" | "instant" | "scheduled";
  status: "running" | "paused" | "ended" | "completed";
  startedAt: string;
  endedAt: string | null;
  simulatedMinutes: number;
  salesCount: number;
  revenueMinor: number;
};

export type MarketRunSale = {
  id: string;
  posProductId: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  occurredAt: string;
};

export type MarketRunPricePoint = {
  at: string;
  productId: string;
  oldPriceMinor: number;
  priceMinor: number;
  movement: "up" | "down" | "hold";
  reason: string;
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
  id: string;
  pos_product_id: string;
  quantity: number;
  unit_price_minor: number;
  currency: string;
  occurred_at: string;
};

export async function getMarketRunSales(runId: string): Promise<MarketRunSale[]> {
  if (!supabase) return [];
  const pageSize = 1_000;
  const rows: MarketRunSaleRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("pos_sales_events")
      .select("id,pos_product_id,quantity,unit_price_minor,currency,occurred_at")
      .eq("run_id", runId)
      .order("occurred_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as MarketRunSaleRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.map(row => ({
    id: row.id,
    posProductId: row.pos_product_id,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    currency: row.currency,
    occurredAt: row.occurred_at,
  }));
}

type MarketRunPriceSnapshotRow = {
  created_at: string;
  snapshot: unknown;
};

export async function getMarketRunPriceHistory(runId: string): Promise<MarketRunPricePoint[]> {
  if (!supabase) return [];
  const pageSize = 1_000;
  const rows: MarketRunPriceSnapshotRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("market_price_snapshots")
      .select("created_at,snapshot")
      .eq("run_id", runId)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as MarketRunPriceSnapshotRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.flatMap(mapRunPriceSnapshot);
}

export function mapRunPriceSnapshot(row: MarketRunPriceSnapshotRow): MarketRunPricePoint[] {
  if (!isRecord(row.snapshot) || !Array.isArray(row.snapshot.decisions)) return [];
  const at = typeof row.snapshot.roundEnd === "string" ? row.snapshot.roundEnd : row.created_at;
  return row.snapshot.decisions.flatMap(decision => {
    if (!isRecord(decision) || typeof decision.productId !== "string" || !isNumber(decision.oldPriceMinor) || !isNumber(decision.newPriceMinor)) return [];
    const movement = decision.movement === "up" || decision.movement === "down" ? decision.movement : "hold";
    return [{
      at,
      productId: decision.productId,
      oldPriceMinor: decision.oldPriceMinor,
      priceMinor: decision.newPriceMinor,
      movement,
      reason: typeof decision.reason === "string" ? decision.reason : "",
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
