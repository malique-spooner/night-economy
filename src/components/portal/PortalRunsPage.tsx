import { useEffect, useMemo, useRef, useState } from "react";
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
  readOnly?: boolean;
  runs: MarketRun[];
  timezone: string;
};

export function PortalRunsPage({ currency, isLoading, products, readOnly = false, runs, timezone }: Props) {
  const [selectedRun, setSelectedRun] = useState<MarketRun | null>(null);
  const [sales, setSales] = useState<MarketRunSale[]>([]);
  const [priceHistory, setPriceHistory] = useState<MarketRunPricePoint[]>([]);
  const [selectedPriceProductIds, setSelectedPriceProductIds] = useState<string[]>([]);
  const [selectedOrderProductIds, setSelectedOrderProductIds] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const priceLedgerRef = useRef<HTMLElement>(null);

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
  const priceFilterOptions = useMemo(() => uniqueDrinkOptions(priceLedger.map(point => ({ id: point.productId, name: point.productName }))), [priceLedger]);
  const orderFilterOptions = useMemo(() => uniqueDrinkOptions((dashboard?.orders ?? []).map(order => ({ id: order.posProductId, name: order.productName }))), [dashboard?.orders]);
  const visiblePriceLedger = selectedPriceProductIds.length ? priceLedger.filter(point => selectedPriceProductIds.includes(point.productId)) : priceLedger;
  const visibleOrders = selectedOrderProductIds.length ? (dashboard?.orders ?? []).filter(order => selectedOrderProductIds.includes(order.posProductId)) : (dashboard?.orders ?? []);
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
  const serviceTime = (value: string, withSeconds = false) => new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  }).format(new Date(value));

  if (readOnly) return <PublicMarketHistory currency={currency} isLoading={isLoading} runs={runs} timezone={timezone} />;

  if (selectedRun && dashboard) {
    const maxTimelineSales = Math.max(1, ...dashboard.timeline.map(point => point.quantity));
    const maxProductRevenue = Math.max(1, ...dashboard.products.map(product => product.revenueMinor));
    const distinctRounds = new Set(priceHistory.map(point => point.at)).size;
    return <section className="portal-runs-page portal-run-dashboard">
      <button className="portal-run-back" onClick={() => setSelectedRun(null)} type="button">← Back to run history</button>
      <header className="portal-run-hero">
        <div>
          <span className="portal-start-kicker">Night intelligence</span>
          <h1 className="portal-page-title">{runLabel(selectedRun)} dashboard</h1>
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
            {!dashboard.products.length ? <p>No item-level sales were recorded for this run.</p> : <ol className="portal-run-ranking">{dashboard.products.map(product => <li key={product.id}><button aria-pressed={selectedPriceProductIds.includes(product.id)} onClick={() => {
              setSelectedPriceProductIds(current => current.includes(product.id) ? current.filter(id => id !== product.id) : [...current, product.id]);
              window.setTimeout(() => priceLedgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }} type="button"><div><strong>{product.name}</strong><span>{product.quantity} sold · {product.category}</span></div><b>{money(product.revenueMinor)}</b><i style={{ width: `${(product.revenueMinor / maxProductRevenue) * 100}%` }} /></button></li>)}</ol>}
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

        <section className="portal-run-panel portal-run-ledger-panel" aria-labelledby="price-ledger-title" ref={priceLedgerRef}>
          <div className="portal-run-section-heading">
            <PanelHeading eyebrow="Five-minute market tape" id="price-ledger-title" title="Every price and percentage change" />
            <div className="portal-run-heading-tools">
              <DrinkMultiSelect label="Filter price tape by drink" options={priceFilterOptions} selectedIds={selectedPriceProductIds} onChange={setSelectedPriceProductIds} />
              <span>{distinctRounds} rounds · {visiblePriceLedger.length} decisions</span>
            </div>
          </div>
          {!visiblePriceLedger.length ? <p className="portal-run-ledger-empty">{selectedPriceProductIds.length ? "No five-minute price rounds match the selected drinks." : "No linked price rounds were recorded for this historical run. New runs preserve every five-minute price decision here."}</p> :
            <div className="portal-run-table-wrap">
              <table className="portal-run-table" aria-label="Five-minute price history">
                <thead><tr><th>Time</th><th>Product</th><th>Previous</th><th>Price</th><th>Change</th><th>Why</th></tr></thead>
                <tbody>{visiblePriceLedger.map((point, index) => {
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
            <div className="portal-run-heading-tools">
              <DrinkMultiSelect label="Filter POS ledger by drink" options={orderFilterOptions} selectedIds={selectedOrderProductIds} onChange={setSelectedOrderProductIds} />
              <span>{visibleOrders.length} order events · {visibleOrders.reduce((total, order) => total + order.quantity, 0)} drinks</span>
            </div>
          </div>
          {!visibleOrders.length ? <p className="portal-run-ledger-empty">{selectedOrderProductIds.length ? "No orders match the selected drinks." : "No orders were recorded for this run."}</p> :
            <div className="portal-run-table-wrap portal-run-orders-wrap">
              <table className="portal-run-table portal-run-orders-table" aria-label="Every order">
                <thead><tr><th>Time</th><th>Order</th><th>Drink</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
                <tbody>{visibleOrders.map((order, index) => <tr key={order.id}>
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
        <div><strong>{runLabel(run)}</strong><span>{new Date(run.startedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone })}</span></div>
        <span className={`portal-run-status ${run.status}`}>{run.status}</span>
        <dl><div><dt>Service time</dt><dd>{run.simulatedMinutes} min</dd></div><div><dt>Drinks sold</dt><dd>{run.salesCount}</dd></div><div><dt>Sales</dt><dd>{money(run.revenueMinor)}</dd></div></dl>
        <button aria-label={`Open dashboard for ${runLabel(run)}`} className="portal-run-open" onClick={() => { setSelectedPriceProductIds([]); setSelectedOrderProductIds([]); setSelectedRun(run); }} type="button">View night dashboard →</button>
      </article>)}
    </div>}
  </section>;
}

/** Public visitors see continuous daily activity, never implementation-level restarts. */
function PublicMarketHistory({ currency, isLoading, runs, timezone }: Pick<Props, "currency" | "isLoading" | "runs" | "timezone">) {
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const days = useMemo(() => {
    const grouped = new Map<string, MarketRun[]>();
    for (const run of runs) {
      const key = calendarDay(run.startedAt, timezone);
      grouped.set(key, [...(grouped.get(key) ?? []), run]);
    }
    return [...grouped.entries()].map(([key, dayRuns]) => ({ key, runs: dayRuns })).sort((left, right) => right.key.localeCompare(left.key));
  }, [runs, timezone]);
  const today = calendarDay(new Date().toISOString(), timezone);
  const selectedDay = selectedDayKey ? days.find(day => day.key === selectedDayKey) ?? null : null;
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);

  if (selectedDay) return <PublicMarketDayDashboard currency={currency} day={selectedDay} isToday={selectedDay.key === today} onBack={() => setSelectedDayKey(null)} timezone={timezone} />;

  return <section className="portal-runs-page portal-public-history">
    <div className="portal-runs-heading"><div><span className="portal-start-kicker">Public market</span><h1 className="portal-page-title">Market history</h1><p>This market stays live continuously. Activity is grouped by day, so automatic background handovers never interrupt the story.</p></div><span>{days.length} days recorded</span></div>
    <div className="portal-public-history-live"><span>Live now</span><strong>Public Demo market · running continuously</strong><small>Prices refresh every five minutes</small></div>
    {isLoading ? <p className="portal-runs-empty">Loading market history…</p> : !days.length ? <p className="portal-runs-empty">Today’s activity will appear here once the market records its first update.</p> : <div className="portal-runs-list">
      {days.map(day => {
        const simulatedMinutes = day.runs.reduce((total, run) => total + run.simulatedMinutes, 0);
        const salesCount = day.runs.reduce((total, run) => total + run.salesCount, 0);
        const revenueMinor = day.runs.reduce((total, run) => total + run.revenueMinor, 0);
        const priceRounds = Math.floor(simulatedMinutes / 5);
        const isToday = day.key === today;
        return <article className="portal-run-card portal-public-history-day" key={day.key}>
          <div><strong>{isToday ? "Today" : formatMarketDay(day.key, timezone)}</strong><span>{isToday ? "Live market activity so far" : "Public market activity"}</span></div>
          <span className={`portal-run-status ${isToday ? "running" : "completed"}`}>{isToday ? "live" : "complete"}</span>
          <dl><div><dt>Price updates</dt><dd>{priceRounds}</dd></div><div><dt>Drinks sold</dt><dd>{salesCount}</dd></div><div><dt>Sales</dt><dd>{money(revenueMinor)}</dd></div></dl>
          <button aria-label={`Open daily dashboard for ${isToday ? "today" : formatMarketDay(day.key, timezone)}`} className="portal-run-open portal-public-day-open" onClick={() => setSelectedDayKey(day.key)} type="button">View daily dashboard →</button>
        </article>;
      })}
    </div>}
  </section>;
}

type PublicMarketDay = { key: string; runs: MarketRun[] };

/** A light daily view: it aggregates run summaries and deliberately avoids loading every POS sale. */
function PublicMarketDayDashboard({ currency, day, isToday, onBack, timezone }: { currency: string; day: PublicMarketDay; isToday: boolean; onBack: () => void; timezone: string }) {
  const simulatedMinutes = day.runs.reduce((total, run) => total + run.simulatedMinutes, 0);
  const salesCount = day.runs.reduce((total, run) => total + run.salesCount, 0);
  const revenueMinor = day.runs.reduce((total, run) => total + run.revenueMinor, 0);
  const priceRounds = Math.floor(simulatedMinutes / 5);
  const averageDrinkMinor = salesCount ? Math.round(revenueMinor / salesCount) : 0;
  const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
  const periods = [...day.runs].sort((left, right) => left.startedAt.localeCompare(right.startedAt));

  return <section className="portal-runs-page portal-run-dashboard portal-public-day-dashboard">
    <button className="portal-run-back" onClick={onBack} type="button">← Back to market history</button>
    <header className="portal-run-hero">
      <div>
        <span className="portal-start-kicker">Public market</span>
        <h1 className="portal-page-title">{isToday ? "Today’s market" : formatMarketDay(day.key, timezone)} dashboard</h1>
        <p>One continuous public market day, summarised without loading every individual sale.</p>
      </div>
      <span className={`portal-run-status ${isToday ? "running" : "completed"}`}>{isToday ? "live" : "complete"}</span>
    </header>
    <div className="portal-run-kpis portal-public-day-kpis">
      <RunKpi label="Time live" value={formatDuration(simulatedMinutes)} />
      <RunKpi label="Drinks sold" value={String(salesCount)} />
      <RunKpi label="Sales" value={money(revenueMinor)} />
      <RunKpi label="Average drink" value={salesCount ? money(averageDrinkMinor) : "—"} />
      <RunKpi label="Price updates" value={String(priceRounds)} />
    </div>
    <div className="portal-run-dashboard-grid portal-public-day-grid">
      <section className="portal-run-panel" aria-labelledby="public-day-periods">
        <PanelHeading eyebrow="Trading flow" id="public-day-periods" title="Market periods" />
        <ol className="portal-public-day-periods">
          {periods.map(period => <li key={period.id}><div><strong>{formatPeriodTime(period.startedAt, timezone)}</strong><span>{formatDuration(period.simulatedMinutes)} active · {period.salesCount} drinks</span></div><b>{money(period.revenueMinor)}</b></li>)}
        </ol>
      </section>
      <section className="portal-run-panel" aria-labelledby="public-day-summary">
        <PanelHeading eyebrow="At a glance" id="public-day-summary" title="How the market moved" />
        <p className="portal-public-day-summary">The market was active for {formatDuration(simulatedMinutes).toLowerCase()}, with {priceRounds} five-minute price updates. {salesCount ? `${salesCount} drinks were sold at an average of ${money(averageDrinkMinor)}.` : "Sales will appear here as they are recorded."}</p>
      </section>
    </div>
  </section>;
}

function calendarDay(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatMarketDay(day: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: timezone }).format(new Date(`${day}T12:00:00Z`));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${String(remainder).padStart(2, "0")}m` : `${remainder}m`;
}

function formatPeriodTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

function RunKpi({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function PanelHeading({ eyebrow, id, title }: { eyebrow: string; id: string; title: string }) {
  return <div><span>{eyebrow}</span><h2 id={id}>{title}</h2></div>;
}

function DrinkMultiSelect({ label, onChange, options, selectedIds }: { label: string; onChange: (ids: string[]) => void; options: Array<{ id: string; name: string }>; selectedIds: string[] }) {
  const selectedCount = selectedIds.length;
  return <details className="portal-run-drink-filter">
    <summary aria-label={label}><span>Drinks</span><b>{selectedCount ? `${selectedCount} selected` : "All drinks"}</b></summary>
    <div className="portal-run-drink-filter-menu" role="group" aria-label={label}>
      {selectedCount > 0 && <button type="button" onClick={() => onChange([])}>Clear selection</button>}
      {options.map(option => <label key={option.id}><input checked={selectedIds.includes(option.id)} onChange={() => onChange(selectedIds.includes(option.id) ? selectedIds.filter(id => id !== option.id) : [...selectedIds, option.id])} type="checkbox" /><span>{option.name}</span></label>)}
    </div>
  </details>;
}

function uniqueDrinkOptions(options: Array<{ id: string; name: string }>) {
  return [...new Map(options.map(option => [option.id, option])).values()].sort((left, right) => left.name.localeCompare(right.name));
}

function runLabel(run: MarketRun) {
  return run.kind === "instant" ? "Instant simulation" : run.kind === "quick" ? "18-minute live rehearsal" : "Scheduled service";
}
