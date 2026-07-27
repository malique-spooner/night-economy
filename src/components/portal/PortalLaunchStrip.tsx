import { useState } from "react";
import type { SimulatorState } from "../../api/simulator";
import type { MarketScheduleEntry, VenueMarketSettings } from "../../engine/types";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Props = {
  onQuickStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onSettingsChange: (patch: Partial<VenueMarketSettings>) => void;
  settings: VenueMarketSettings;
  simulatorState: SimulatorState | null;
};

function getNextService(schedule: MarketScheduleEntry[]) {
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(new Date());
  const todayIndex = Math.max(days.indexOf(today), 0);

  for (let offset = 0; offset < days.length; offset += 1) {
    const entry = schedule[(todayIndex + offset) % days.length];
    if (entry.enabled) return entry;
  }

  return null;
}

export function PortalLaunchStrip({ onEnd, onPause, onQuickStart, onResume, onSettingsChange, settings, simulatorState }: Props) {
  const schedule = days.map(day => settings.marketSchedule.find(entry => entry.day === day) ?? { day, start: "18:00", end: "00:00", enabled: false });
  const [selectedDay, setSelectedDay] = useState("Friday");
  const selected = schedule.find(entry => entry.day === selectedDay) ?? schedule[0];
  const next = getNextService(schedule);
  const save = (nextSchedule: MarketScheduleEntry[]) => onSettingsChange({ marketSchedule: nextSchedule });
  const updateSelected = (patch: Partial<MarketScheduleEntry>) => save(schedule.map(entry => entry.day === selected.day ? { ...entry, ...patch } : entry));
  const service = simulatorState?.service;
  const serviceIsOpen = service?.isOpen ?? Boolean(service?.running || service?.paused);
  const marketStatus = serviceIsOpen && service
    ? service.running ? `Market open · ${formatSimulatedTime(service.simulatedTime)} · ${formatElapsed(service.minute)} elapsed` : `Market paused · ${formatSimulatedTime(service.simulatedTime)} · clock continues`
    : next ? "Your next scheduled service" : "Choose a day to schedule your first service";

  return <section className="portal-start-strip" aria-label="Market schedule">
    <div className="portal-schedule-summary">
      <div>
        <div className="portal-start-kicker">Market schedule</div>
        <h2>{next ? `${next.day} · ${next.start}–${next.end}` : "No service scheduled"}</h2>
        <p>{marketStatus}</p>
      </div>
      <div className="portal-service-actions">
        {!serviceIsOpen ? <button className="portal-quick-start" onClick={onQuickStart} type="button">Quick start</button> : null}
        {service?.running ? <button className="portal-quick-start is-live" onClick={onPause} type="button">Pause</button> : null}
        {serviceIsOpen && service?.paused ? <button className="portal-quick-start" onClick={onResume} type="button">Resume</button> : null}
        {serviceIsOpen ? <button className="portal-end-service" onClick={onEnd} type="button">End</button> : null}
      </div>
    </div>

    <div className="portal-schedule-days" aria-label="Choose a day to edit">
      {schedule.map(entry => <button aria-pressed={entry.day === selected.day} className={`portal-schedule-day ${entry.day === selected.day ? "is-selected" : ""} ${entry.enabled ? "is-enabled" : ""}`} key={entry.day} onClick={() => setSelectedDay(entry.day)} type="button">
        <strong>{entry.day.slice(0, 3)}</strong>
        <span>{entry.enabled ? `${entry.start}–${entry.end}` : "Off"}</span>
      </button>)}
    </div>

    <div className="portal-schedule-editor">
      <div>
        <span className="portal-start-kicker">{selected.day}</span>
        <strong>{selected.enabled ? "Scheduled weekly" : "Not scheduled"}</strong>
      </div>
      <label className="portal-schedule-toggle"><input checked={selected.enabled} onChange={event => updateSelected({ enabled: event.target.checked })} type="checkbox" /> Run weekly</label>
      <label>Start<input aria-label={`${selected.day} start`} disabled={!selected.enabled} onChange={event => updateSelected({ start: event.target.value })} type="time" value={selected.start} /></label>
      <label>Finish<input aria-label={`${selected.day} finish`} disabled={!selected.enabled} onChange={event => updateSelected({ end: event.target.value })} type="time" value={selected.end} /></label>
    </div>
  </section>;
}

function formatElapsed(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function formatSimulatedTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(value));
}
