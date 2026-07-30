import type { Venue } from "../../engine/types";
import type { VenueMemberRole } from "../../api/memberships";

type Props = {
  email: string;
  isSignedIn: boolean;
  liveCount: number;
  role: VenueMemberRole | null;
  source: "seed" | "supabase";
  totalCount: number;
  venue: Venue;
};

export function PortalAccountPage({ email, isSignedIn, liveCount, role, source, totalCount, venue }: Props) {
  const access = source === "seed" ? "Demo access" : role ? `${role[0].toUpperCase()}${role.slice(1)} access` : "No venue access";

  return (
    <section className="portal-page-grid">
      <article className="portal-account-card portal-account-card-hero">
        <h2>{source === "supabase" ? "Connected venue" : "Demo venue"}</h2>
        <div className="portal-account-actions">
          <button className="manager-action" disabled type="button">Manage subscription</button>
          <button className="manager-action" disabled type="button">Billing details</button>
        </div>
      </article>

      <article className="portal-account-card">
        <dl className="portal-account-list">
          <div><dt>Venue</dt><dd>{venue.name}</dd></div>
          <div><dt>Operator email</dt><dd>{isSignedIn ? email || "Signed in" : "Not signed in"}</dd></div>
          <div><dt>Timezone</dt><dd>{venue.timezone}</dd></div>
          <div><dt>Currency</dt><dd>{venue.currency}</dd></div>
        </dl>
      </article>

      <article className="portal-account-card">
        <dl className="portal-account-list">
          <div><dt>Status</dt><dd>{venue.marketLive ? "Market live" : "Market paused"}</dd></div>
          <div><dt>Account</dt><dd>{access}</dd></div>
          <div><dt>Products</dt><dd>{liveCount}/{totalCount} live</dd></div>
          <div><dt>Data</dt><dd>{source === "supabase" ? "Supabase" : "Seed fallback"}</dd></div>
        </dl>
      </article>
    </section>
  );
}
