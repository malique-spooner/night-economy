import { supabase } from "./client";

export type SimulatorState = {
  recentPublications: Array<{ publicationId: string; status: string }>;
  service: {
    isComplete: boolean;
    isOpen: boolean;
    hasStarted: boolean;
    paused: boolean;
    ended: boolean;
    minute: number;
    running: boolean;
    simulatedTime: string;
    speed: number;
    targetRevenueMinor: number;
    rushUntilMinute?: number;
    slowdownUntilMinute?: number;
  };
  totals: {
    revenueMinor: number;
    salesCount: number;
    unitsSold: number;
  };
};

export type SimulatorDashboard = SimulatorState & {
  salesGraph: Array<{ minute: number; salesCount: number; revenueMinor: number }>;
  products: Array<{ id: string; posProductId: string | null; name: string; category: string; isLive: boolean; currentPriceMinor: number; basePriceMinor: number; salesCount: number; revenueMinor: number }>;
  recentSales: Array<{ pos_product_id: string; quantity: number; unit_price_minor: number; occurred_at: string }>;
};

const configuredUrl = String(import.meta.env.VITE_POS_SIMULATOR_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:3002" : ""))
  .trim()
  .replace(/\/$/, "");

export const simulatorDashboardUrl = configuredUrl || null;

export const simulatorStatus = {
  ready: Boolean(configuredUrl),
  reason: configuredUrl ? "Local POS simulator connected." : "Set VITE_POS_SIMULATOR_URL to enable local service controls.",
};

export async function getSimulatorState(venueSlug = "demo-venue"): Promise<SimulatorState> {
  if (usesCloudSimulator(venueSlug)) return cloudSimulator(venueSlug, "tick");
  return getJson("/v1/simulation/state");
}

export async function getSimulatorDashboard(venueSlug: string): Promise<SimulatorDashboard> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("venue-simulator", { body: { venueSlug, action: "summary" } });
  if (error) throw error;
  const state = toSimulatorState(data);
  if (data?.summaryError) throw new Error(data.summaryError);
  return { ...state, salesGraph: Array.isArray(data?.salesGraph) ? data.salesGraph : [], products: Array.isArray(data?.products) ? data.products : [], recentSales: Array.isArray(data?.recentSales) ? data.recentSales : [] };
}

export async function controlSimulator(venueSlug: string, action: "start" | "quick_start" | "pause" | "resume" | "end" | "reset_prices" | "event", options: { speed?: number; targetRevenueMinor?: number; eventType?: "rush" | "slowdown" } = {}) {
  if (usesCloudSimulator(venueSlug)) return cloudSimulator(venueSlug, action, options);
  return postJson("/v1/simulation/control", { action, ...options });
}

export async function updateSimulatorService(options: { speed?: number; targetRevenueMinor?: number }) {
  return postJson("/v1/simulation/control", options);
}

async function getJson(path: string) {
  if (!configuredUrl) throw new Error(simulatorStatus.reason);
  const response = await fetch(`${configuredUrl}${path}`);
  if (!response.ok) throw new Error(`Simulator request failed: ${response.status}`);
  return response.json();
}

async function postJson(path: string, body: unknown) {
  if (!configuredUrl) throw new Error(simulatorStatus.reason);
  const response = await fetch(`${configuredUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(error?.error ?? `Simulator request failed: ${response.status}`);
  }
  return response.json();
}

function usesCloudSimulator(venueSlug: string) {
  return Boolean(supabase) && Boolean(venueSlug);
}

async function cloudSimulator(venueSlug: string, action: string, options: { speed?: number; targetRevenueMinor?: number; eventType?: "rush" | "slowdown" } = {}): Promise<SimulatorState> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("venue-simulator", { body: { venueSlug, action, ...options } });
  if (error) throw error;
  return toSimulatorState(data);
}

function toSimulatorState(data: unknown): SimulatorState {
  const service = (data as { service?: SimulatorState["service"] } | null)?.service;
  if (!service) throw new Error("The venue test service did not return its state.");
  return {
    recentPublications: [],
    service: {
      ...service,
      hasStarted: service.minute > 0 || service.running || service.paused || service.ended,
      isComplete: service.minute >= 360,
      targetRevenueMinor: service.targetRevenueMinor ?? 0,
    },
    totals: { revenueMinor: 0, salesCount: 0, unitsSold: 0 },
  };
}
