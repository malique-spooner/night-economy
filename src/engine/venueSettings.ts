import type { CrashIntervalMinutes, VenueMarketSettings } from "./types";

export const crashIntervalOptions = [15, 30, 60, 120] as const satisfies readonly CrashIntervalMinutes[];

export function defaultVenueMarketSettings(now = new Date()): VenueMarketSettings {
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    marketLive: false,
    marketSchedule: [{ day: "Friday", start: "18:00", end: "00:00", enabled: true }],
    crashIntervalMinutes: 30,
    launchDate: formatDateInput(now),
    launchStartTime: formatTimeInput(now),
    launchEndTime: formatTimeInput(end),
  };
}

export function isCrashIntervalMinutes(value: unknown): value is CrashIntervalMinutes {
  return crashIntervalOptions.includes(value as CrashIntervalMinutes);
}

export function normalizeTimeInput(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

function formatTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
