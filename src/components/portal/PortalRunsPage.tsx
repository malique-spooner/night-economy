import { useEffect, useMemo, useState } from "react";
import {
  getMarketRunPriceHistory,
  getMarketRunSales,
  type MarketRun,
  type MarketRunPricePoint,
  type MarketRunSale,
} from "../../api/runs";
import type { MarketProduct } from "../../engine/types";
import { buildRunDashboard, buildRunPriceLedger } from "./runDashboard";

type Props = {
  currency: string;
  isLoading: boolean;
  products: MarketProduct[];
  runs: MarketRun[];
  timezone: string;
};

export function PortalRunsPage({ currency, isLoading, products, runs, timezone }: Props) {
  const [selectedRun, setSelectedRun] = useState<MarketRun | null>(null);
  const [sales, setSales] = useState<MarketRunSale[]>([]);
  const [priceHistory, setPriceHistory] = useState<MarketRunPricePoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!selectedRun) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    void Promise.all([getMarketRunSales(selectedRun.id), getMarketRunPriceHistory(selectedRun.id)])
      .then(([nextSales, nextPriceHistory]) => {
        if (!cancelled) {
          setSales(nextSales);
          setPriceHistory(nextPriceHistory);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setSales([]);
          setPriceHistory([]);
          setDetailError(error instanceof Error ? error.message : "Could not load this run's events");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedRun?.id]);

  const dashboard = useMemo(() => selectedRun ? buildRunDashboard(selectedRun, sales, products) : null, [products, sales, selectedRun]);
  const priceLedger = useMemo(() => buildRunPriceLedger(priceHistory, products), [priceHistory, products]);
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
  const serviceTime = (value: string, withSeconds = false) => new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  }).format(new Date(value));

  if (selectedRun && dashboard) {
    const maxTimelineSales = Math.max(1, ...dashboard.timeline.map(point => point.quantity));
    const maxProductRevenue = Math.max(1, ...dashboard.products.map(product => product.revenueMinor));
    const distinctRounds = new Set(priceHistory.map(point => point.at)).size;
    return <section className="portal-runs-page portal-run-dashboard">
      <button className="portal-run-back" onClick={() => setSelectedRun(null)} type="button">← Back to run history</button>
      <header className="portal-run-hero">
        <div>
          <span className="portal-start-kicker">Night intelligence</span>
          <h1 className="portal-page-title">{selectedRun.kind === "quick" ? "Quick rehearsal" : "Scheduled service"} dashboard</h1>
          <p>{new Date(selectedRun.startedAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: timezone })} · {selectedRun.simulatedMinutes} simulated minutes</p>
        </div>
        <span className={`portal-run-status ${selectedRun.status}`}>{selectedRun.status}</span>
      </header>

      {detailLoading ? <p className="portal-runs-empty">Loading every order and price round…</p> : detailError ? <p className="portal-runs-empty portal-run-error" role="alert">{detailError}</p> : <>
        <div className="portal-run-kpis">
          <RunKpi label="Night sales" value={money(dashboard.revenueMinor || selectedRun.revenueMinor)} />
          <RunKpi label="Orders" value={String(dashboard.orders.length)} />
          <RunKpi label="Drinks sold" value={String(dashboard.unitsSold || selectedRun.salesCount)} />
          <RunKpi label="Average drink" value={money(dashboard.averageUnitPriceMinor)} />
          <RunKpi label="Busiest period" value={`${dashboard.peakLabel} · ${dashboard.peakQuantity}`} />
          <RunKpi label="Price rounds" value={String(distinctRounds)} />
        </div>

        <div className="portal-run-dashboard-grid">
          <section className="portal-run-panel portal-run-timeline" aria-labelledby="run-timeline-title">
            <PanelHeading eyebrow="Trading flow" id="run-timeline-title" title="Sales through the night" />
            <div className="portal-run-bars">{dashboard.timeline.map(point => <div className="portal-run-bar-column" key={point.label} title={`${point.label}: ${point.quantity} drinks, ${money(point.revenueMinor)}`}><div className="portal-run-bar" style={{ height: `${Math.max(4, (point.quantity / maxTimelineSales) * 100)}%` }} /><span>{point.label}</span></div>)}</div>
          </section>
          <section className="portal-run-panel" aria-labelledby="run-products-title">
            <PanelHeading eyebrow="Menu performance" id="run-products-title" title="Top drinks" />
            {!dashboard.products.length ? <p>No item-level sales were recorded for this run.</p> : <ol className="portal-run-ranking">{dashboard.products.slice(0, 8).map(product => <li key={product.id}><div><strong>{product.name}</strong><span>{product.quantity} sold · {product.category}</span></div><b>{money(product.revenueMinor)}</b><i style={{ width: `${(product.revenueMinor / maxProductRevenue) * 100}%` }} /></li>)}</ol>}
          </section>
          <section className="portal-run-panel" aria-labelledby="run-categories-title">
            <PanelHeading eyebrow="Sales mix" id="run-categories-title" title="By category" />
            <dl className="portal-run-category-list">{dashboard.categories.map(category => <div key={category.id}><dt>{category.name}<span>{category.quantity} drinks</span></dt><dd>{money(category.revenueMinor)}</dd></div>)}</dl>
          </section>
          <section className="portal-run-panel portal-run-night-note" aria-labelledby="run-story-title">
            <PanelHeading eyebrow="At a glance" id="run-story-title" title="How the night moved" />
            <p>The busiest half hour began at <strong>{dashboard.peakLabel}</strong>, with <strong>{dashboard.peakQuantity} drinks</strong>. The ledger below preserves all {dashboard.orders.length} order events and {priceLedger.length} individual product price decisions.</p>
          </section>
        </div>

        <section className="portal-run-panel portal-run-ledger-panel" aria-labelledby="price-ledger-title">
          <div className="portal-run-section-heading">
            <PanelHeading eyebrow="Five-minute market tape" id="price-ledger-title" title="Every price and percentage change" />
            <span>{distinctRounds} rounds · {priceLedger.length} decisions</span>
          </div>
          {!priceLedger.length ? <p className="portal-run-ledger-empty">No linked price rounds were recorded for this historical run. New runs preserve every five-minute price decision here.</p> :
            <div className="portal-run-table-wrap">
              <table className="portal-run-table" aria-label="Five-minute price history">
                <thead><tr><th>Time</th><th>Product</th><th>Previous</th><th>Price</th><th>Change</th><th>Why</th></tr></thead>
                <tbody>{priceLedger.map((point, index) => {
                  const change = `${point.changePercentage > 0 ? "+" : ""}${point.changePercentage.toFixed(2)}%`;
                  return <tr key={`${point.at}-${point.productId}-${index}`}>
                    <td><time dateTime={point.at}>{serviceTime(point.at)}</time></td>
                    <td><strong>{point.productName}</strong><span>{point.symbol}</span></td>
                    <td>{money(point.oldPriceMinor)}</td>
                    <td><strong>{money(point.priceMinor)}</strong></td>
                    <td><span className={`portal-run-movement ${point.movement}`}>{change}</span></td>
                    <td>{point.reason}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
        </section>

        <section className="portal-run-panel portal-run-ledger-panel" aria-labelledby="order-ledger-title">
          <div className="portal-run-section-heading">
            <PanelHeading eyebrow="Complete POS ledger" id="order-ledger-title" title="Every single order" />
            <span>{dashboard.orders.length} order events · {dashboard.unitsSold} drinks</span>
          </div>
          {!dashboard.orders.length ? <p className="portal-run-ledger-empty">No orders were recorded for this run.</p> :
            <div className="portal-run-table-wrap portal-run-orders-wrap">
              <table className="portal-run-table portal-run-orders-table" aria-label="Every order">
                <thead><tr><th>Time</th><th>Order</th><th>Drink</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
                <tbody>{dashboard.orders.map((order, index) => <tr key={order.id}>
                  <td><time dateTime={order.occurredAt}>{serviceTime(order.occurredAt, true)}</time></td>
                  <td><code>#{String(index + 1).padStart(4, "0")}</code></td>
                  <td><strong>{order.productName}</strong></td>
                  <td>{order.quantity}</td>
                  <td>{money(order.unitPriceMinor)}</td>
                  <td><strong>{money(order.totalMinor)}</strong></td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>
      </>}
    </section>;
  }

  return <section className="portal-runs-page">
    <div className="portal-runs-heading"><div><span className="portal-start-kicker">Service archive</span><h1 className="portal-page-title">Previous runs</h1><p>Every quick rehearsal and scheduled service is kept here with its sales, five-minute prices and complete order ledger.</p></div><span>{runs.length} recorded</span></div>
    {isLoading ? <p className="portal-runs-empty">Loading run history…</p> : !runs.length ? <p className="portal-runs-empty">Your next completed service will appear here. Earlier runs were not recorded individually.</p> : <div className="portal-runs-list">
      {runs.map(run => <article className="portal-run-card" key={run.id}>
        <div><strong>{run.kind === "quick" ? "Quick rehearsal" : "Scheduled service"}</strong><span>{new Date(run.startedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone })}</span></div>
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

function PanelHeading({ eyebrow, id, title }: { eyebrow: string; id: string; title: string }) {
  return <div><span>{eyebrow}</span><h2 id={id}>{title}</h2></div>;
}
