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
  };
  totals: {
    revenueMinor: number;
    salesCount: number;
    unitsSold: number;
  };
};

const configuredUrl = String(import.meta.env.VITE_POS_SIMULATOR_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:3002" : ""))
  .trim()
  .replace(/\/$/, "");

export const simulatorStatus = {
  ready: Boolean(configuredUrl),
  reason: configuredUrl ? "Local POS simulator connected." : "Set VITE_POS_SIMULATOR_URL to enable local service controls.",
};

export async function getSimulatorState(): Promise<SimulatorState> {
  return getJson("/v1/simulation/state");
}

export async function controlSimulator(action: "start" | "quick_start" | "pause" | "resume" | "end" | "reset_prices", options: { speed?: number; targetRevenueMinor?: number } = {}) {
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
