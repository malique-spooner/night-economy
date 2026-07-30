import { useEffect, useState } from "react";
import { getCurrentSession, onAuthStateChange, signOut } from "../api/auth";
import { getMyAccessibleVenues, getMyPlatformAdminAccess, type AccessibleVenue } from "../api/memberships";
import { getSimulatorDashboard, type SimulatorDashboard } from "../api/simulator";
import { updateVenueMarketSettings } from "../api/market";
import { useMarketState } from "../hooks/useMarketState";
import type { MarketScheduleEntry } from "../engine/types";

type Props = {
  venueSlug: string;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function Simulator({ venueSlug }: Props) {
  const [isResolved, setIsResolved] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [dashboard, setDashboard] = useState<SimulatorDashboard | null>(null);
  const [venues, setVenues] = useState<AccessibleVenue[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { state: marketState } = useMarketState(venueSlug, { pollIntervalMs: 10_000 });

  useEffect(() => {
    void refreshAccess();
    return onAuthStateChange(() => { void refreshAccess(); });
  }, []);

  useEffect(() => {
    if (!isResolved || !isSignedIn || !isPlatformAdmin) return;
    let cancelled = false;

    async function refreshState() {
      try {
        const nextDashboard = await getSimulatorDashboard(venueSlug);
        if (!cancelled) {
          setDashboard(nextDashboard);
          setMessage("");
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not reach the cloud simulator.");
      }
    }

    void refreshState();
    const interval = window.setInterval(() => { void refreshState(); }, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isPlatformAdmin, isResolved, isSignedIn, venueSlug]);

  async function refreshAccess() {
    const session = await getCurrentSession();
    setIsSignedIn(Boolean(session));
    setIsPlatformAdmin(session ? await getMyPlatformAdminAccess() : false);
    setVenues(session ? await getMyAccessibleVenues() : []);
    setIsResolved(true);
  }

  async function saveTarget(day: string, value: number) {
    if (!marketState) return;
    try {
      setBusy(true);
      setMessage("");
      const schedule = scheduleFor(marketState.venue.marketSchedule).map(entry => entry.day === day ? { ...entry, targetRevenueMinor: Math.max(0, Math.round(value * 100)) } : entry);
      await updateVenueMarketSettings(marketState.venue.id, { marketSchedule: schedule });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the target takings.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
      window.location.assign("/");
    } catch (error) {
      setIsSigningOut(false);
      setMessage(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  if (!isResolved) return <main className="simulator-page">Checking simulator access…</main>;
  if (isSigningOut) return <main className="simulator-page">Signing out…</main>;
  if (!isSignedIn) {
    window.location.replace(`/sign-in/${encodeURIComponent(venueSlug)}`);
    return <main className="simulator-page">Taking you to sign in…</main>;
  }
  if (!isPlatformAdmin) return <main className="simulator-page simulator-denied"><h1>Simulator access is restricted</h1><p>This development tool is only available to the Night Economy account.</p><a href={`/app/${encodeURIComponent(venueSlug)}`}>Return to the portal</a></main>;

  const service = dashboard?.service;
  const status = service?.running ? "Running" : service?.paused ? "Paused" : service?.ended ? "Ended" : "Scheduled";
  const clock = service ? simulatedClock(service.simulatedTime, marketState?.venue.timezone ?? "Europe/London") : "--:--";
  const salesCount = dashboard?.products.reduce((total, product) => total + product.salesCount, 0) ?? 0;
  const revenueMinor = dashboard?.products.reduce((total, product) => total + product.revenueMinor, 0) ?? 0;

  return (
    <main className="simulator-page">
      <header className="simulator-topbar">
        <a className="simulator-brand" href={`/app/${encodeURIComponent(venueSlug)}`}><span>NE</span> Night Economy</a>
        <div><a href={`/app/${encodeURIComponent(venueSlug)}`}>Portal</a><button onClick={() => { void handleSignOut(); }} type="button">Sign out</button></div>
      </header>
      <section className="simulator-hero">
        <h1>Simulator</h1>
      </section>
      <section className="simulator-graph-card" aria-label="Live simulated sales over time">
        <div className="simulator-graph-head">
          <div><h2>Sales over time</h2></div>
          {venues.length > 1 && <label><span>Venue simulation</span><select onChange={event => window.location.assign(`/simulator/${encodeURIComponent(event.target.value)}`)} value={venueSlug}>{venues.map(venue => <option key={venue.id} value={venue.slug}>{venue.name}</option>)}</select></label>}
        </div>
        <SalesGraph points={dashboard?.salesGraph ?? []} minute={service?.minute ?? 0} />
        <div className="simulator-graph-key"><span><i />Sales per five minutes</span><b>{service ? `Live at ${clock}` : "Waiting to start"}</b></div>
      </section>
      <section className="simulator-dashboard" aria-live="polite">
        <div className="simulator-status-card">
          <span>Status</span><strong>{status}</strong>
        </div>
        <div className="simulator-status-card">
          <span>Time</span><strong>{clock}</strong>
        </div>
        <div className="simulator-status-card"><span>Sale lines</span><strong>{salesCount}</strong></div>
        <div className="simulator-status-card"><span>Takings</span><strong>{formatMoney(revenueMinor)}</strong></div>
      </section>
      <section className="simulator-targets" aria-label="Scheduled target takings">
        <div className="simulator-targets-head"><div><span>Simulator plan</span><h2>Target takings</h2></div><p>Each scheduled day uses its own target.</p></div>
        <div className="simulator-target-days">{scheduleFor(marketState?.venue.marketSchedule ?? []).map(entry => <label className={entry.enabled ? "is-enabled" : ""} key={entry.day}><strong>{entry.day.slice(0, 3)}</strong><span>{entry.enabled ? "Scheduled" : "Off"}</span><input aria-label={`${entry.day} target takings`} defaultValue={(entry.targetRevenueMinor ?? 1_000_000) / 100} disabled={busy || !entry.enabled} min="0" onBlur={event => { void saveTarget(entry.day, Number(event.target.value || 0)); }} step="100" type="number" /><b>£</b></label>)}</div>
        {message && <p className="simulator-error">{message}</p>}
      </section>
      <section className="simulator-live-layout"><ProductCatalogue products={dashboard?.products ?? []} /><SalesFeed products={dashboard?.products ?? []} sales={dashboard?.recentSales ?? []} /></section>
    </main>
  );
}

function SalesGraph({ minute, points }: { minute: number; points: Array<{ minute: number; salesCount: number }> }) {
  const width = 960;
  const height = 210;
  const padded = points.length ? points : [{ minute: 0, salesCount: 0 }, { minute: 5, salesCount: 0 }];
  const maxSales = Math.max(1, ...padded.map(point => point.salesCount));
  const path = padded.map((point, index) => {
    const x = (point.minute / 355) * width;
    const y = height - (point.salesCount / maxSales) * (height - 24) - 12;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const currentX = Math.min(width, (minute / 360) * width);

  return <div className="simulator-graph"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales volume over simulated service time">
    <line className="simulator-graph-grid" x1="0" x2={width} y1={height - 12} y2={height - 12} />
    <line className="simulator-graph-grid" x1="0" x2={width} y1={height / 2} y2={height / 2} />
    <path className="simulator-graph-line" d={path} />
    {minute > 0 && <line className="simulator-graph-now" x1={currentX} x2={currentX} y1="0" y2={height} />}
  </svg><div className="simulator-graph-axis"><span>18:00</span><span>20:00</span><span>22:00</span><span>00:00</span></div></div>;
}

function simulatedClock(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(new Date(value));
}

function scheduleFor(schedule: MarketScheduleEntry[]) {
  return DAYS.map(day => schedule.find(entry => entry.day === day) ?? { day, start: "18:00", end: "00:00", enabled: false, targetRevenueMinor: 1_000_000 });
}

function ProductCatalogue({ products }: { products: SimulatorDashboard["products"] }) {
  const categories = [...new Set(products.map(product => product.category))];

  return <section className="simulator-catalogue">
    <div className="simulator-catalogue-head"><div><h2>Drinks</h2></div><b>{products.length} drinks</b></div>
    {categories.map(category => <div className="simulator-catalogue-group" key={category}>
      <h3>{category}</h3>
      <div className="simulator-catalogue-table"><div className="simulator-catalogue-labels"><span>Drink</span><span>Status</span><span>Current price</span><span>Sales</span><span>Takings</span></div>
        {products.filter(product => product.category === category).map(product => <div className="simulator-catalogue-row" key={product.id}>
          <strong>{product.name}</strong><span className={product.isLive ? "is-live" : "is-inactive"}>{product.isLive ? "Live" : "Inactive"}</span><b>{formatMoney(product.currentPriceMinor)}</b><span>{product.salesCount}</span><span>{formatMoney(product.revenueMinor)}</span>
        </div>)}
      </div>
    </div>)}
  </section>;
}

function SalesFeed({ products, sales }: { products: SimulatorDashboard["products"]; sales: SimulatorDashboard["recentSales"] }) {
  const nameByPosId = new Map(products.map(product => [product.posProductId, product.name]));
  return <section className="simulator-sales-feed"><h2>Live sales feed</h2>{sales.length ? <ol>{sales.map((sale, index) => <li key={`${sale.occurred_at}-${index}`}><time>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(sale.occurred_at))}</time><span>{sale.quantity} × {nameByPosId.get(sale.pos_product_id) ?? "Drink"}</span><b>{formatMoney(sale.unit_price_minor)}</b></li>)}</ol> : <p>No sales yet.</p>}</section>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value / 100);
}
