import type { CrashDurationMinutes, CrashIntervalMinutes, MarketCrashSettings, VenueMarketSettings } from "./types";
import { defaultTvStoryArticleIds } from "./tvStoryArticleSettings";

const crashIntervalOptions = [15, 30, 60, 120] as const satisfies readonly CrashIntervalMinutes[];
const crashDurationOptions = [5, 10] as const satisfies readonly CrashDurationMinutes[];

export function defaultMarketCrashSettings(): MarketCrashSettings {
  return { durationMinutes: 10, categoryCrashCounts: {} };
}

export function defaultVenueMarketSettings(now = new Date()): VenueMarketSettings {
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    marketLive: false,
    tvStoryCategories: ["Cocktails"],
    tvStoryArticleIds: defaultTvStoryArticleIds,
    marketSchedule: [{ day: "Friday", start: "18:00", end: "00:00", enabled: true }],
    crashIntervalMinutes: 30,
    crashSettings: defaultMarketCrashSettings(),
    launchDate: formatDateInput(now),
    launchStartTime: formatTimeInput(now),
    launchEndTime: formatTimeInput(end),
  };
}

export function normalizeMarketCrashSettings(value: unknown): MarketCrashSettings {
  const defaults = defaultMarketCrashSettings();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const settings = value as Record<string, unknown>;
  const categoryCrashCounts = settings.categoryCrashCounts && typeof settings.categoryCrashCounts === "object" && !Array.isArray(settings.categoryCrashCounts)
    ? Object.fromEntries(Object.entries(settings.categoryCrashCounts as Record<string, unknown>)
      .filter(([category, count]) => Boolean(category.trim()) && typeof count === "number" && Number.isFinite(count) && count > 0)
      .map(([category, count]) => [category, Math.min(4, Math.floor(count as number))]))
    : {};
  return {
    durationMinutes: crashDurationOptions.includes(settings.durationMinutes as CrashDurationMinutes) ? settings.durationMinutes as CrashDurationMinutes : defaults.durationMinutes,
    categoryCrashCounts,
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
