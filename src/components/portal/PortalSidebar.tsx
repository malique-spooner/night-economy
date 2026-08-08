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
  simulatorHref: string | null;
  totalCount: number;
  venueName: string;
  venueSlug: string;
};

export function PortalSidebar({ accessibleVenues, activeTab, isPinned, liveCount, onSignOut, onTabChange, onTogglePinned, simulatorHref, totalCount, venueName, venueSlug }: Props) {
  return (
    <aside className={`portal-sidebar ${isPinned ? "is-pinned" : ""}`}>
      <button aria-label={isPinned ? "Collapse navigation" : "Keep navigation open"} className="portal-nav-toggle" onClick={onTogglePinned} type="button">
        <span aria-hidden="true">☰</span><b>{isPinned ? "Collapse" : "Navigation"}</b>
      </button>
      <div className="portal-sidebar-brand">
        <span className="portal-sidebar-mark" aria-hidden="true">NE</span>
        <div className="portal-sidebar-kicker">Night Economy · venue account</div>
        <strong>{venueName}</strong>
      </div>
      {accessibleVenues.length > 1 && (
        <label className="portal-venue-switcher">
          <span>Switch venue</span>
          <select aria-label="Switch venue" onChange={event => window.location.assign(`/app/${encodeURIComponent(event.target.value)}`)} value={venueSlug}>
            {accessibleVenues.map(venue => <option key={venue.id} value={venue.slug}>{venue.name}</option>)}
          </select>
        </label>
      )}
      <div className="portal-sidebar-stat">
        <span>Products live</span>
        <strong>{liveCount}/{totalCount}</strong>
      </div>
      <nav className="portal-nav" aria-label="Portal sections">
        <button
          className={`portal-nav-item ${activeTab === "start" ? "active" : ""}`}
          onClick={() => onTabChange("start")}
          type="button"
        >
          <span className="portal-nav-icon" aria-hidden="true">⌁</span><span className="portal-nav-label">Start</span>
          <small>Market controls</small>
        </button>
        <button
          className={`portal-nav-item ${activeTab === "runs" ? "active" : ""}`}
          onClick={() => onTabChange("runs")}
          type="button"
        >
          <span className="portal-nav-icon" aria-hidden="true">◷</span><span className="portal-nav-label">Run history</span>
          <small>Previous services</small>
        </button>
        <button
          className={`portal-nav-item ${activeTab === "account" ? "active" : ""}`}
          onClick={() => onTabChange("account")}
          type="button"
        >
          <span className="portal-nav-icon" aria-hidden="true">◉</span><span className="portal-nav-label">Settings</span>
          <small>Venue and display</small>
        </button>
        {simulatorHref && <a className="portal-nav-item portal-nav-link" href={simulatorHref}>
          <span className="portal-nav-icon" aria-hidden="true">◌</span><span className="portal-nav-label">Simulator</span>
          <small>Development tool</small>
        </a>}
        <a className="portal-nav-item portal-nav-link" href={`/tv/${encodeURIComponent(venueSlug)}`} rel="noreferrer" target="_blank">
          <span className="portal-nav-icon" aria-hidden="true">▣</span><span className="portal-nav-label">Market</span>
          <small>TV display</small>
        </a>
        <a className="portal-nav-item portal-nav-link" href={`/menu/${encodeURIComponent(venueSlug)}`} rel="noreferrer" target="_blank">
          <span className="portal-nav-icon" aria-hidden="true">◫</span><span className="portal-nav-label">Mobile market</span>
          <small>Guest menu</small>
        </a>
      </nav>
      <div className="portal-sidebar-foot">
        <button className="portal-signout" type="button" onClick={onSignOut}><span aria-hidden="true">↩</span><b>Sign out</b></button>
      </div>
    </aside>
  );
}
