import type { AccessibleVenue } from "../../api/memberships";

export type PortalTab = "start" | "runs" | "account";

type Props = {
  activeTab: PortalTab;
  accessibleVenues: AccessibleVenue[];
  isPinned: boolean;
  liveCount: number;
  onTabChange: (tab: PortalTab) => void;
  onTogglePinned: () => void;
  onSignOut: () => void;
  onOpenTour: () => void;
  simulatorHref: string | null;
  totalCount: number;
  venueName: string;
  venueSlug: string;
};

export function PortalSidebar({ accessibleVenues, activeTab, isPinned, liveCount, onSignOut, onOpenTour, onTabChange, onTogglePinned, simulatorHref, totalCount, venueName, venueSlug }: Props) {
  const canSwitchVenue = accessibleVenues.length > 1;

  return (
    <aside className={`portal-sidebar ${isPinned ? "is-pinned" : ""}`}>
      <div className="portal-sidebar-brand">
        <div className="portal-sidebar-brand-top">
          <button aria-controls="portal-navigation" aria-expanded={isPinned} aria-label={isPinned ? "Collapse navigation" : "Open navigation"} className="portal-nav-toggle" onClick={onTogglePinned} type="button">
            <span aria-hidden="true">☰</span><b>{isPinned ? "Collapse" : "Navigation"}</b>
          </button>
          <strong>Night Economy</strong>
        </div>
        <span className="portal-sidebar-venue">{venueName}</span>
      </div>
      <label className="portal-venue-switcher">
        <span>{canSwitchVenue ? "Switch venue" : "Venue"}</span>
        <select aria-label="Switch venue" disabled={!canSwitchVenue} onChange={event => window.location.assign(`/app/${encodeURIComponent(event.target.value)}`)} value={venueSlug}>
          {accessibleVenues.map(venue => <option key={venue.id} value={venue.slug}>{venue.name}</option>)}
        </select>
      </label>
      <div className="portal-sidebar-stat">
        <span>Products live</span>
        <strong>{liveCount}/{totalCount}</strong>
      </div>
      <nav className="portal-nav" aria-label="Portal sections" id="portal-navigation">
        <button
          className={`portal-nav-item ${activeTab === "start" ? "active" : ""}`} data-portal-tour="start"
          onClick={() => onTabChange("start")}
          type="button"
        >
          <span className="portal-nav-icon" aria-hidden="true"><NavIcon name="start" /></span><span className="portal-nav-label">Start</span>
          <small>Market controls</small>
        </button>
        <button
          className={`portal-nav-item ${activeTab === "runs" ? "active" : ""}`} data-portal-tour="runs"
          onClick={() => onTabChange("runs")}
          type="button"
        >
          <span className="portal-nav-icon" aria-hidden="true"><NavIcon name="history" /></span><span className="portal-nav-label">Run history</span>
          <small>Previous services</small>
        </button>
        <button
          className={`portal-nav-item ${activeTab === "account" ? "active" : ""}`}
          onClick={() => onTabChange("account")}
          type="button"
        >
          <span className="portal-nav-icon" aria-hidden="true"><NavIcon name="settings" /></span><span className="portal-nav-label">Settings</span>
          <small>Venue and display</small>
        </button>
        <a className="portal-nav-item portal-nav-link" data-portal-tour="market" href={`/tv/${encodeURIComponent(venueSlug)}`} rel="noreferrer" target="_blank">
          <span className="portal-nav-icon" aria-hidden="true"><NavIcon name="market" /></span><span className="portal-nav-label">Market</span>
          <small>TV display</small>
        </a>
        <a className="portal-nav-item portal-nav-link" data-portal-tour="mobile" href={`/menu/${encodeURIComponent(venueSlug)}`} rel="noreferrer" target="_blank">
          <span className="portal-nav-icon" aria-hidden="true"><NavIcon name="mobile" /></span><span className="portal-nav-label">Mobile market</span>
          <small>Guest menu</small>
        </a>
      </nav>
      <div className="portal-sidebar-foot">
        <button aria-label="Open Portal tour" className="portal-nav-item portal-tour-open" onClick={onOpenTour} type="button">
          <span className="portal-nav-icon" aria-hidden="true">?</span><span className="portal-nav-label">Tour</span><small>How it works</small>
        </button>
        {simulatorHref && <a className="portal-nav-item portal-nav-link" href={simulatorHref}>
          <span className="portal-nav-icon" aria-hidden="true"><NavIcon name="simulator" /></span><span className="portal-nav-label">Simulator</span>
        </a>}
        <button className="portal-signout" type="button" onClick={onSignOut}><span aria-hidden="true" className="portal-signout-icon"><NavIcon name="signout" /></span><b>Sign out</b></button>
      </div>
    </aside>
  );
}

type NavIconName = "start" | "history" | "settings" | "market" | "mobile" | "simulator" | "signout";

function NavIcon({ name }: { name: NavIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  if (name === "start") return <svg viewBox="0 0 24 24" {...common}><path d="M5 4v16l14-8L5 4Z" /></svg>;
  if (name === "history") return <svg viewBox="0 0 24 24" {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></svg>;
  if (name === "settings") return <svg viewBox="0 0 24 24" {...common}><path d="M4 7h16M4 17h16M8 7a2 2 0 1 0 0 .01M16 17a2 2 0 1 0 0 .01" /></svg>;
  if (name === "market") return <svg viewBox="0 0 24 24" {...common}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="m7 14 3-3 2 2 4-5M9 21h6" /></svg>;
  if (name === "mobile") return <svg viewBox="0 0 24 24" {...common}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>;
  if (name === "simulator") return <svg viewBox="0 0 24 24" {...common}><path d="M9 3h6M10 3v6l-5.1 8.3A2.4 2.4 0 0 0 7 21h10a2.4 2.4 0 0 0 2.1-3.7L14 9V3M8.5 16h7" /></svg>;
  return <svg viewBox="0 0 24 24" {...common}><path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9" /></svg>;
}
