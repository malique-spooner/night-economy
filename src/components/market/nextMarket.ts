import type { MarketScheduleEntry } from "../../engine/types";

const weekdayIndex: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export type NextMarket = {
  day: string;
  start: string;
  remainingMs: number;
};

/** Finds the next weekly opening in a venue's local clock. */
export function getNextMarket(schedule: MarketScheduleEntry[], now = new Date(), timeZone = "Europe/London"): NextMarket | null {
  const enabled = schedule.filter(entry => entry.enabled && weekdayIndex[entry.day] !== undefined && /^\d{2}:\d{2}$/.test(entry.start));
  if (!enabled.length) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const currentDay = weekdayIndex[values.weekday];
  const wallNow = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));

  return enabled
    .map(entry => {
      const [hours, minutes] = entry.start.split(":").map(Number);
      let daysAhead = (weekdayIndex[entry.day] - currentDay + 7) % 7;
      let opening = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + daysAhead, hours, minutes);
      if (opening <= wallNow) {
        daysAhead += 7;
        opening = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + daysAhead, hours, minutes);
      }
      return { day: entry.day, start: entry.start, remainingMs: opening - wallNow };
    })
    .sort((left, right) => left.remainingMs - right.remainingMs)[0];
}

export function formatRemainingTime(remainingMs: number) {
  const seconds = Math.max(0, Math.floor(remainingMs / 1_000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainderSeconds = seconds % 60;
  return { days, hours, minutes, seconds: remainderSeconds };
}
