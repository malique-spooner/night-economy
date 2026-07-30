import type { MarketRun, MarketRunSale } from "../../api/runs";
import type { MarketProduct } from "../../engine/types";

export type RunDashboardProduct = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenueMinor: number;
};

export type RunDashboardPoint = {
  label: string;
  quantity: number;
  revenueMinor: number;
};

export type RunDashboard = {
  unitsSold: number;
  revenueMinor: number;
  averageUnitPriceMinor: number;
  peakLabel: string;
  peakQuantity: number;
  timeline: RunDashboardPoint[];
  products: RunDashboardProduct[];
  categories: RunDashboardProduct[];
  recentSales: Array<MarketRunSale & { productName: string }>;
};

export function buildRunDashboard(run: MarketRun, sales: MarketRunSale[], products: MarketProduct[]): RunDashboard {
  const productLookup = new Map(products.filter(product => product.posProductId).map(product => [product.posProductId!, product]));
  const validTimes = sales.map(sale => Date.parse(sale.occurredAt)).filter(Number.isFinite);
  const firstSaleAt = validTimes.length ? Math.min(...validTimes) : Date.parse(run.startedAt);
  const bucketMinutes = 30;
  const bucketCount = Math.max(1, Math.ceil(Math.max(run.simulatedMinutes, bucketMinutes) / bucketMinutes));
  const timeline = Array.from({ length: bucketCount }, (_, index) => ({
    label: formatServiceTime(index * bucketMinutes),
    quantity: 0,
    revenueMinor: 0,
  }));
  const productTotals = new Map<string, RunDashboardProduct>();
  const categoryTotals = new Map<string, RunDashboardProduct>();

  for (const sale of sales) {
    const product = productLookup.get(sale.posProductId);
    const quantity = Math.max(0, sale.quantity);
    const revenueMinor = quantity * Math.max(0, sale.unitPriceMinor);
    const minute = Number.isFinite(Date.parse(sale.occurredAt)) ? Math.max(0, Math.floor((Date.parse(sale.occurredAt) - firstSaleAt) / 60_000)) : 0;
    const bucket = timeline[Math.min(timeline.length - 1, Math.floor(minute / bucketMinutes))];
    bucket.quantity += quantity;
    bucket.revenueMinor += revenueMinor;

    const productName = product?.name ?? "Unlisted product";
    const category = product?.category ?? "Other";
    addTotal(productTotals, sale.posProductId, productName, category, quantity, revenueMinor);
    addTotal(categoryTotals, category, category, category, quantity, revenueMinor);
  }

  const unitsSold = sales.reduce((total, sale) => total + Math.max(0, sale.quantity), 0);
  const revenueMinor = sales.reduce((total, sale) => total + Math.max(0, sale.quantity) * Math.max(0, sale.unitPriceMinor), 0);
  const peak = timeline.reduce((best, point) => point.quantity > best.quantity ? point : best, timeline[0]);

  return {
    unitsSold,
    revenueMinor,
    averageUnitPriceMinor: unitsSold ? Math.round(revenueMinor / unitsSold) : 0,
    peakLabel: peak.label,
    peakQuantity: peak.quantity,
    timeline,
    products: [...productTotals.values()].sort((a, b) => b.revenueMinor - a.revenueMinor),
    categories: [...categoryTotals.values()].sort((a, b) => b.revenueMinor - a.revenueMinor),
    recentSales: sales.slice(-8).reverse().map(sale => ({ ...sale, productName: productLookup.get(sale.posProductId)?.name ?? "Unlisted product" })),
  };
}

function addTotal(target: Map<string, RunDashboardProduct>, id: string, name: string, category: string, quantity: number, revenueMinor: number) {
  const current = target.get(id) ?? { id, name, category, quantity: 0, revenueMinor: 0 };
  current.quantity += quantity;
  current.revenueMinor += revenueMinor;
  target.set(id, current);
}

function formatServiceTime(minute: number) {
  const totalMinutes = 18 * 60 + minute;
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}
