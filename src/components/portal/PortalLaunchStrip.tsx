import type { SimulatorState } from "../../api/simulator";
import type { MarketScheduleEntry, VenueMarketSettings } from "../../engine/types";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Props = {
  isServiceActionPending: boolean;
  onQuickStart: () => void;
  onRealTimeStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onSettingsChange: (patch: Partial<VenueMarketSettings>) => void;
  readOnly?: boolean;
  settings: VenueMarketSettings;
  simulatorState: SimulatorState | null;
  timezone: string;
};

function getNextService(schedule: MarketScheduleEntry[], timezone: string) {
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: timezone }).format(new Date());
  const todayIndex = Math.max(days.indexOf(today), 0);

  for (let offset = 0; offset < days.length; offset += 1) {
    const entry = schedule[(todayIndex + offset) % days.length];
    if (entry.enabled) return entry;
  }

  return null;
}

export function updateScheduleDay(schedule: MarketScheduleEntry[], day: string, patch: Partial<MarketScheduleEntry>) {
  return schedule.map(entry => entry.day === day ? { ...entry, ...patch } : entry);
}

export function PortalLaunchStrip({ isServiceActionPending, onEnd, onPause, onQuickStart, onRealTimeStart, onResume, onSettingsChange, readOnly = false, settings, simulatorState, timezone }: Props) {
  const schedule = days.map(day => settings.marketSchedule.find(entry => entry.day === day) ?? { day, start: "18:00", end: "00:00", enabled: false });
  const next = getNextService(schedule, timezone);
  const save = (nextSchedule: MarketScheduleEntry[]) => onSettingsChange({ marketSchedule: nextSchedule });
  const updateDay = (day: string, patch: Partial<MarketScheduleEntry>) => save(updateScheduleDay(schedule, day, patch));
  const service = simulatorState?.service;
  const serviceIsOpen = service?.isOpen ?? Boolean(service?.running || service?.paused);
  const marketStatus = serviceIsOpen && service
    ? service.running ? `Market open${service.speed === 1 ? " · real time" : ""} · ${formatSimulatedTime(service.simulatedTime, timezone)} · ${formatElapsed(service.minute)} elapsed` : `Market paused · ${formatSimulatedTime(service.simulatedTime, timezone)} · ${formatElapsed(service.minute)} elapsed`
    : next ? "Your next scheduled service" : "Choose a day to schedule your first service";

  return <section className="portal-start-strip" aria-label="Market schedule">
    <div className="portal-schedule-summary">
      <div>
        <div className="portal-start-kicker">Market schedule</div>
        <h2>{readOnly ? "Open 24/7" : next ? `${next.day} · ${next.start}–${next.end}` : "No service scheduled"}</h2>
        <p>{marketStatus}</p>
      </div>
      <div className="portal-service-actions" data-portal-tour="service-controls">
        {!serviceIsOpen ? <>
          <button className="portal-quick-start" disabled={readOnly || isServiceActionPending} onClick={onQuickStart} type="button">Start 18-min demo</button>
          <button className="portal-real-time-start" disabled={readOnly || isServiceActionPending} onClick={onRealTimeStart} type="button">Start real time demo</button>
        </> : null}
        {service?.running ? <button className="portal-quick-start is-live" disabled={readOnly} onClick={onPause} type="button">Pause</button> : null}
        {serviceIsOpen && service?.paused ? <button className="portal-quick-start" disabled={readOnly} onClick={onResume} type="button">Resume</button> : null}
        {serviceIsOpen ? <button className="portal-end-service" disabled={readOnly} onClick={onEnd} type="button">End</button> : null}
      </div>
    </div>

    {readOnly ? <div className="portal-public-schedule" aria-label="Public market schedule"><strong>Always open</strong><span>Every day · all day</span><small>Prices update every five minutes</small></div> : <div className="portal-schedule-days" aria-label="Weekly market schedule">
      {schedule.map(entry => <div className={`portal-schedule-day ${entry.enabled ? "is-enabled" : ""}`} key={entry.day}>
        <button aria-pressed={entry.enabled} className="portal-schedule-day-toggle" disabled={readOnly} onClick={() => updateDay(entry.day, { enabled: !entry.enabled })} type="button">
          <strong>{entry.day}</strong>
          <span>{entry.enabled ? "On" : "Off"}</span>
        </button>
        <label>Start<input aria-label={`${entry.day} start`} disabled={readOnly || !entry.enabled} onChange={event => updateDay(entry.day, { start: event.target.value })} type="time" value={entry.start} /></label>
        <label>Finish<input aria-label={`${entry.day} finish`} disabled={readOnly || !entry.enabled} onChange={event => updateDay(entry.day, { end: event.target.value })} type="time" value={entry.end} /></label>
      </div>)}
    </div>}
  </section>;
}

function formatElapsed(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function formatSimulatedTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(new Date(value));
}
