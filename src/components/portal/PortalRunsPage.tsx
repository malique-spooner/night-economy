import type { MarketRun } from "../../api/runs";

type Props = { currency: string; isLoading: boolean; runs: MarketRun[] };

export function PortalRunsPage({ currency, isLoading, runs }: Props) {
  return <section className="portal-runs-page">
    <div className="portal-runs-heading"><div><span className="portal-start-kicker">Service archive</span><h1 className="portal-page-title">Previous runs</h1><p>Every quick rehearsal and scheduled service is kept here with its sales and final result.</p></div><span>{runs.length} recorded</span></div>
    {isLoading ? <p className="portal-runs-empty">Loading run history…</p> : !runs.length ? <p className="portal-runs-empty">Your next completed service will appear here. Earlier runs were not recorded individually.</p> : <div className="portal-runs-list">
      {runs.map(run => <article className="portal-run-card" key={run.id}>
        <div><strong>{run.kind === "quick" ? "Quick rehearsal" : "Scheduled service"}</strong><span>{new Date(run.startedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></div>
        <span className={`portal-run-status ${run.status}`}>{run.status}</span>
        <dl><div><dt>Service time</dt><dd>{run.simulatedMinutes} min</dd></div><div><dt>Drinks sold</dt><dd>{run.salesCount}</dd></div><div><dt>Sales</dt><dd>{new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(run.revenueMinor / 100)}</dd></div></dl>
      </article>)}
    </div>}
  </section>;
}
