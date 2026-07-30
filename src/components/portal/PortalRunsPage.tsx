import { useEffect, useMemo, useState } from "react";
import { getMarketRunSales, type MarketRun, type MarketRunSale } from "../../api/runs";
import type { MarketProduct } from "../../engine/types";
import { buildRunDashboard } from "./runDashboard";

type Props = { currency: string; isLoading: boolean; products: MarketProduct[]; runs: MarketRun[] };

export function PortalRunsPage({ currency, isLoading, products, runs }: Props) {
  const [selectedRun, setSelectedRun] = useState<MarketRun | null>(null);
  const [sales, setSales] = useState<MarketRunSale[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!selectedRun) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    void getMarketRunSales(selectedRun.id).then(nextSales => {
      if (!cancelled) setSales(nextSales);
    }).catch(error => {
      if (!cancelled) {
        setSales([]);
        setDetailError(error instanceof Error ? error.message : "Could not load this run's events");
      }
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedRun?.id]);

  const dashboard = useMemo(() => selectedRun ? buildRunDashboard(selectedRun, sales, products) : null, [products, sales, selectedRun]);
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);

  if (selectedRun && dashboard) {
    const maxTimelineSales = Math.max(1, ...dashboard.timeline.map(point => point.quantity));
    const maxProductRevenue = Math.max(1, ...dashboard.products.map(product => product.revenueMinor));
    return <section className="portal-runs-page portal-run-dashboard">
      <button className="portal-run-back" onClick={() => setSelectedRun(null)} type="button">← Back to run history</button>
      <div className="portal-runs-heading">
        <div><span className="portal-start-kicker">Night dashboard</span><h1 className="portal-page-title">{selectedRun.kind === "quick" ? "Quick rehearsal" : "Scheduled service"} dashboard</h1><p>{new Date(selectedRun.startedAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })} · {selectedRun.simulatedMinutes} simulated minutes</p></div>
        <span className={`portal-run-status ${selectedRun.status}`}>{selectedRun.status}</span>
      </div>
      {detailLoading ? <p className="portal-runs-empty">Loading the night’s events…</p> : detailError ? <p className="portal-runs-empty portal-run-error" role="alert">{detailError}</p> : <>
        <div className="portal-run-kpis">
          <RunKpi label="Night sales" value={money(dashboard.revenueMinor || selectedRun.revenueMinor)} />
          <RunKpi label="Drinks sold" value={String(dashboard.unitsSold || selectedRun.salesCount)} />
          <RunKpi label="Average drink" value={money(dashboard.averageUnitPriceMinor)} />
          <RunKpi label="Busiest period" value={`${dashboard.peakLabel} · ${dashboard.peakQuantity}`} />
        </div>
        <div className="portal-run-dashboard-grid">
          <section className="portal-run-panel portal-run-timeline" aria-labelledby="run-timeline-title">
            <div><span>Trading flow</span><h2 id="run-timeline-title">Sales through the night</h2></div>
            <div className="portal-run-bars">{dashboard.timeline.map(point => <div className="portal-run-bar-column" key={point.label} title={`${point.label}: ${point.quantity} drinks, ${money(point.revenueMinor)}`}><div className="portal-run-bar" style={{ height: `${Math.max(4, (point.quantity / maxTimelineSales) * 100)}%` }} /><span>{point.label}</span></div>)}</div>
          </section>
          <section className="portal-run-panel" aria-labelledby="run-products-title">
            <div><span>Menu performance</span><h2 id="run-products-title">Top drinks</h2></div>
            {!dashboard.products.length ? <p>No item-level sales were recorded for this run.</p> : <ol className="portal-run-ranking">{dashboard.products.slice(0, 8).map(product => <li key={product.id}><div><strong>{product.name}</strong><span>{product.quantity} sold · {product.category}</span></div><b>{money(product.revenueMinor)}</b><i style={{ width: `${(product.revenueMinor / maxProductRevenue) * 100}%` }} /></li>)}</ol>}
          </section>
          <section className="portal-run-panel" aria-labelledby="run-categories-title">
            <div><span>Sales mix</span><h2 id="run-categories-title">By category</h2></div>
            <dl className="portal-run-category-list">{dashboard.categories.map(category => <div key={category.id}><dt>{category.name}<span>{category.quantity} drinks</span></dt><dd>{money(category.revenueMinor)}</dd></div>)}</dl>
          </section>
          <section className="portal-run-panel" aria-labelledby="run-events-title">
            <div><span>Event log</span><h2 id="run-events-title">Latest sales</h2></div>
            <div className="portal-run-event-list">{dashboard.recentSales.map((sale, index) => <div key={`${sale.occurredAt}-${sale.posProductId}-${index}`}><time>{new Date(sale.occurredAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</time><span>{sale.productName}</span><strong>{sale.quantity} × {money(sale.unitPriceMinor)}</strong></div>)}</div>
          </section>
        </div>
      </>}
    </section>;
  }

  return <section className="portal-runs-page">
    <div className="portal-runs-heading"><div><span className="portal-start-kicker">Service archive</span><h1 className="portal-page-title">Previous runs</h1><p>Every quick rehearsal and scheduled service is kept here with its sales and final result.</p></div><span>{runs.length} recorded</span></div>
    {isLoading ? <p className="portal-runs-empty">Loading run history…</p> : !runs.length ? <p className="portal-runs-empty">Your next completed service will appear here. Earlier runs were not recorded individually.</p> : <div className="portal-runs-list">
      {runs.map(run => <article className="portal-run-card" key={run.id}>
        <div><strong>{run.kind === "quick" ? "Quick rehearsal" : "Scheduled service"}</strong><span>{new Date(run.startedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></div>
        <span className={`portal-run-status ${run.status}`}>{run.status}</span>
        <dl><div><dt>Service time</dt><dd>{run.simulatedMinutes} min</dd></div><div><dt>Drinks sold</dt><dd>{run.salesCount}</dd></div><div><dt>Sales</dt><dd>{money(run.revenueMinor)}</dd></div></dl>
        <button aria-label={`Open dashboard for ${run.kind === "quick" ? "Quick rehearsal" : "Scheduled service"}`} className="portal-run-open" onClick={() => setSelectedRun(run)} type="button">View night dashboard →</button>
      </article>)}
    </div>}
  </section>;
}

function RunKpi({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
