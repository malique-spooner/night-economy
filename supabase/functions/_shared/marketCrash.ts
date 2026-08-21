export type MarketCrashSettings = { durationMinutes: 5 | 10; categoryCrashCounts: Record<string, number> };

const GUARD_MINUTES = 45;
const MIN_GAP_MINUTES = 60;
const MAX_CRASHES = 4;

export function parseMarketCrashSettings(value: unknown): MarketCrashSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { durationMinutes: 10, categoryCrashCounts: {} };
  const source = value as Record<string, unknown>;
  const rawCounts = source.categoryCrashCounts && typeof source.categoryCrashCounts === "object" && !Array.isArray(source.categoryCrashCounts)
    ? source.categoryCrashCounts as Record<string, unknown> : {};
  const categoryCrashCounts = Object.fromEntries(Object.entries(rawCounts)
    .filter(([category, count]) => Boolean(category.trim()) && typeof count === "number" && Number.isFinite(count) && count > 0)
    .map(([category, count]) => [category, Math.min(MAX_CRASHES, Math.floor(count as number))]));
  return { durationMinutes: source.durationMinutes === 5 ? 5 : 10, categoryCrashCounts };
}

function capacity(serviceMinutes: number, durationMinutes: number) {
  const firstStart = GUARD_MINUTES;
  const lastStart = serviceMinutes - GUARD_MINUTES - durationMinutes;
  return lastStart < firstStart ? 0 : Math.min(MAX_CRASHES, 1 + Math.floor((lastStart - firstStart) / MIN_GAP_MINUTES));
}

function queue(settings: MarketCrashSettings) {
  const remaining = new Map(Object.entries(settings.categoryCrashCounts));
  const result: string[] = [];
  while (remaining.size && result.length < MAX_CRASHES) {
    for (const category of [...remaining.keys()].sort((a, b) => a.localeCompare(b))) {
      result.push(category);
      const next = (remaining.get(category) ?? 1) - 1;
      if (next <= 0) remaining.delete(category); else remaining.set(category, next);
      if (result.length >= MAX_CRASHES) break;
    }
  }
  return result;
}

export function activeMarketCrash(serviceMinute: number, settings: MarketCrashSettings, serviceMinutes = 360) {
  const categories = queue(settings).slice(0, capacity(serviceMinutes, settings.durationMinutes));
  if (!categories.length) return null;
  const first = GUARD_MINUTES;
  const last = Math.max(first, serviceMinutes - GUARD_MINUTES - settings.durationMinutes);
  const usedByGaps = (categories.length - 1) * MIN_GAP_MINUTES;
  const leadingPadding = Math.max(0, Math.round((last - first - usedByGaps) / 10) * 5);
  const starts = categories.map((_, index) => first + leadingPadding + index * MIN_GAP_MINUTES);
  const index = starts.findIndex(start => serviceMinute >= start && serviceMinute < start + settings.durationMinutes);
  return index < 0 ? null : { category: categories[index], index, startMinute: starts[index], endMinute: starts[index] + settings.durationMinutes };
}
