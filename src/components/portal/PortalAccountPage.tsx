import type { MarketCrashSettings, MarketProduct, Venue } from "../../engine/types";
import type { VenueMemberRole } from "../../api/memberships";
import { PortalCrashSettings } from "./PortalCrashSettings";

type Props = {
  categories: string[];
  canManageCrashSettings: boolean;
  email: string;
  isSignedIn: boolean;
  onCrashSettingsChange: (settings: MarketCrashSettings) => void;
  products: MarketProduct[];
  role: VenueMemberRole | null;
  source: "seed" | "supabase";
  venue: Venue;
};

export function PortalAccountPage({ categories, canManageCrashSettings, email, isSignedIn, onCrashSettingsChange, products, role, source, venue }: Props) {
  const access = source === "seed" ? "Demo access" : role ? `${role[0].toUpperCase()}${role.slice(1)} access` : "No venue access";

  return (
    <section className="portal-page-grid portal-settings-page">
      <header className="portal-settings-heading">
        <span>Venue settings</span>
        <h1>Settings</h1>
        <p>Control the details that apply across your venue and its displays.</p>
      </header>

      <PortalCrashSettings categories={categories} currency={venue.currency} disabled={!canManageCrashSettings} onChange={onCrashSettingsChange} products={products} serviceMinutes={serviceMinutesFor(venue.marketSchedule)} settings={venue.crashSettings} />
      {!canManageCrashSettings && <small className="portal-crash-access-note">Owner or admin access required to change the crash plan.</small>}

      <article className="portal-account-card portal-settings-details">
        <h2>Venue</h2>
        <dl className="portal-account-list">
          <div><dt>Venue</dt><dd>{venue.name}</dd></div>
          <div><dt>Timezone</dt><dd>{venue.timezone}</dd></div>
          <div><dt>Currency</dt><dd>{venue.currency}</dd></div>
        </dl>
      </article>

      <article className="portal-account-card portal-settings-details">
        <h2>Access</h2>
        <dl className="portal-account-list">
          <div><dt>Operator</dt><dd>{isSignedIn ? email || "Signed in" : "Not signed in"}</dd></div>
          <div><dt>Permission</dt><dd>{access}</dd></div>
        </dl>
      </article>
    </section>
  );
}

function serviceMinutesFor(schedule: Venue["marketSchedule"]) {
  const longest = schedule.filter(entry => entry.enabled).reduce((maximum, entry) => {
    const [startHour, startMinute] = entry.start.split(":").map(Number);
    const [endHour, endMinute] = entry.end.split(":").map(Number);
    return Math.max(maximum, ((endHour * 60 + endMinute) - (startHour * 60 + startMinute) + 24 * 60) % (24 * 60));
  }, 0);
  return longest || 360;
}
