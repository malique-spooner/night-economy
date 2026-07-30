export type ScheduleEntry = { day?: string; start?: string; end?: string; enabled?: boolean; targetRevenueMinor?: number };
export type ActiveSlot = { key: string; targetRevenueMinor?: number };
export type ServiceScheduleState = { status: "idle" | "running" | "paused" | "ended"; scheduled_slot_key: string | null };
export type ServiceAction = "scheduled_start" | "scheduled_end" | "tick" | null;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function serviceAction(slot: ActiveSlot | null, service: ServiceScheduleState): ServiceAction {
  if (slot && service.scheduled_slot_key !== slot.key) return "scheduled_start";
  if (!slot && service.scheduled_slot_key && (service.status === "running" || service.status === "paused")) return "scheduled_end";
  if (service.status === "running") return "tick";
  return null;
}

export function activeSlot(schedule: ScheduleEntry[], timezone: string, now: Date) {
  const local = localDateTime(now, timezone);
  for (const entry of schedule) {
    if (!entry.enabled || !entry.day || !entry.start || !entry.end) continue;
    const scheduledDay = DAYS.indexOf(entry.day);
    const start = minutes(entry.start);
    const end = minutes(entry.end);
    if (scheduledDay < 0 || start === null || end === null || start === end) continue;
    const dayDelta = (local.dayIndex - scheduledDay + 7) % 7;
    const crossesMidnight = end <= start;
    const activeToday = dayDelta === 0 && local.minutes >= start && (crossesMidnight || local.minutes < end);
    const activeAfterMidnight = crossesMidnight && dayDelta === 1 && local.minutes < end;
    if (activeToday || activeAfterMidnight) {
      const slotDate = activeAfterMidnight ? dateKey(now.getTime() - 24 * 60 * 60 * 1000, timezone) : local.date;
      return { key: `${slotDate}:${entry.day}:${entry.start}`, targetRevenueMinor: entry.targetRevenueMinor };
    }
  }
  return null;
}

function localDateTime(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return { dayIndex: DAYS.indexOf(value("weekday")), date: `${value("year")}-${value("month")}-${value("day")}`, minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}

function dateKey(milliseconds: number, timezone: string) {
  return localDateTime(new Date(milliseconds), timezone).date;
}

function minutes(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const result = Number(match[1]) * 60 + Number(match[2]);
  return result < 24 * 60 ? result : null;
}
