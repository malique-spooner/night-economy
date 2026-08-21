import type { MarketCrashSettings } from "./types";

export const CRASH_GUARD_MINUTES = 45;
export const CRASH_MIN_GAP_MINUTES = 60;
export const MAX_CRASHES_PER_SERVICE = 4;

/** The number of responsibly spaced category crashes a service can support. */
export function marketCrashCapacity(serviceMinutes: number, settings: Pick<MarketCrashSettings, "durationMinutes">) {
  const firstStart = CRASH_GUARD_MINUTES;
  const lastStart = serviceMinutes - CRASH_GUARD_MINUTES - settings.durationMinutes;
  if (lastStart < firstStart) return 0;
  return Math.min(MAX_CRASHES_PER_SERVICE, 1 + Math.floor((lastStart - firstStart) / CRASH_MIN_GAP_MINUTES));
}

export function requestedCrashCount(settings: Pick<MarketCrashSettings, "categoryCrashCounts">) {
  return Object.values(settings.categoryCrashCounts).reduce((total, count) => total + Math.max(0, Math.floor(count)), 0);
}

/** Expands configured category quotas into the order in which they will crash. */
export function crashCategoryQueue(settings: Pick<MarketCrashSettings, "categoryCrashCounts">) {
  const remaining = new Map(Object.entries(settings.categoryCrashCounts)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .map(([category, count]) => [category, Math.floor(count)]));
  const queue: string[] = [];
  while (remaining.size && queue.length < MAX_CRASHES_PER_SERVICE) {
    for (const category of [...remaining.keys()].sort((left, right) => left.localeCompare(right))) {
      queue.push(category);
      const next = (remaining.get(category) ?? 1) - 1;
      if (next <= 0) remaining.delete(category);
      else remaining.set(category, next);
      if (queue.length >= MAX_CRASHES_PER_SERVICE) break;
    }
  }
  return queue;
}

/** Evenly space automatic crash starts between the opening and closing guards. */
export function crashStartMinutes(serviceMinutes: number, count: number, durationMinutes = 10) {
  if (!count) return [];
  const first = CRASH_GUARD_MINUTES;
  const last = Math.max(first, serviceMinutes - CRASH_GUARD_MINUTES - durationMinutes);
  const usedByGaps = (count - 1) * CRASH_MIN_GAP_MINUTES;
  const leadingPadding = Math.max(0, Math.round((last - first - usedByGaps) / 10) * 5);
  return Array.from({ length: count }, (_, index) => first + leadingPadding + index * CRASH_MIN_GAP_MINUTES);
}

export function activeMarketCrash(serviceMinutes: number, serviceMinute: number, settings: MarketCrashSettings) {
  const capacity = marketCrashCapacity(serviceMinutes, settings);
  const queue = crashCategoryQueue(settings).slice(0, capacity);
  const starts = crashStartMinutes(serviceMinutes, queue.length, settings.durationMinutes);
  const index = starts.findIndex(start => serviceMinute >= start && serviceMinute < start + settings.durationMinutes);
  return index === -1 ? null : { category: queue[index], index, startMinute: starts[index], endMinute: starts[index] + settings.durationMinutes };
}
