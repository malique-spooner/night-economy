import { describe, expect, it } from "vitest";
import { runMarketCycle, startMarketRunner } from "../../pos-simulator/market-runner.mjs";
import { priceMarket } from "../../pos-simulator/src/marketPricing.mjs";

describe("local market runner", () => {
  it("requires a server-only Supabase credential", async () => {
    await expect(startMarketRunner({ env: {} })).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("uses a zero-sum point ledger within each category", () => {
    const products = [{ id: "espresso", posProductId: "pos_espresso", category: "Cocktails", currentPriceMinor: 1000, floorPriceMinor: 700, ceilingPriceMinor: 1500, isLive: true, isSoldOut: false }, { id: "margarita", posProductId: "pos_margarita", category: "Cocktails", currentPriceMinor: 1000, floorPriceMinor: 700, ceilingPriceMinor: 1500, isLive: true, isSoldOut: false }, { id: "negroni", posProductId: "pos_negroni", category: "Cocktails", currentPriceMinor: 1000, floorPriceMinor: 700, ceilingPriceMinor: 1500, isLive: true, isSoldOut: false }, { id: "lager", posProductId: "pos_lager", category: "Beer", currentPriceMinor: 1000, floorPriceMinor: 700, ceilingPriceMinor: 1500, isLive: true, isSoldOut: false }];
    const decisions = priceMarket(products, [{ pos_product_id: "pos_espresso", quantity: 3 }, { pos_product_id: "pos_margarita", quantity: 2 }, { pos_product_id: "pos_negroni", quantity: 1 }]);
    expect(decisions).toMatchObject([{ productId: "espresso", movement: "up" }, { productId: "margarita", movement: "hold" }, { productId: "negroni", movement: "down" }, { productId: "lager", movement: "hold" }]);
  });

  it("imports simulator sales and asks the cloud engine to calculate the market price", async () => {
    const database = {
      venues: [{ id: "ven_demo", slug: "demo-venue", market_live: true }],
      pos_connections: [{ id: "pos_sim_demo", venue_id: "ven_demo", provider: "simulator", base_url: "http://simulator", status: "active" }],
      pos_products: [{ id: "db_pos_cem", venue_id: "ven_demo", pos_connection_id: "pos_sim_demo", external_id: "pos_cem", sku: "COCK-001", source_name: "Classic Espresso Martini", base_price_minor: 1200, current_price_minor: 1200, currency: "GBP", is_available: true }],
      market_products: [{ id: "mp_cem", venue_id: "ven_demo", pos_product_id: "db_pos_cem", category: "Cocktails", current_price_minor: 1200, floor_price_minor: 800, ceiling_price_minor: 1800, is_live: true, is_sold_out: false }],
      pos_sales_events: [],
      market_price_snapshots: [],
      price_publications: [],
      price_publication_lines: [],
    };
    const publications = [];
    const fetchImpl = async (url, init = {}) => {
      if (url.endsWith("/v1/simulation/state")) return json({ service: { minute: 300, simulatedTime: "2026-07-17T22:00:00.000Z" } });
      if (url.includes("/v1/products")) return json({ products: [{ id: "pos_cem", sku: "COCK-001", name: "Classic Espresso Martini", basePriceMinor: 1200, currentPriceMinor: 1200, currency: "GBP", isAvailable: true, updatedAt: "2026-07-17T22:00:00.000Z" }] });
      if (url.includes("/v1/sales")) return json({ sales: [{ id: "sale_001", occurredAt: "2026-07-17T21:59:30.000Z", productId: "pos_cem", quantity: 8, unitPriceMinor: 1200, currency: "GBP" }] });
      if (url.endsWith("/v1/price-publications") && init.method === "POST") {
        const body = JSON.parse(init.body);
        publications.push(body);
        return json({ publicationId: body.publicationId, status: "published", lines: body.lines.map(line => ({ productId: line.productId, status: "published", oldPriceMinor: 1200, newPriceMinor: line.newPriceMinor })) });
      }
      if (url === "https://example.supabase.co/functions/v1/market-cycle" && init.method === "POST") {
        const body = JSON.parse(init.body);
        expect(init.headers["x-night-economy-scheduler-secret"]).toBe("scheduler-secret");
        expect(body).toMatchObject({ venueSlug: "demo-venue", reason: "simulator_cycle", cycleEnd: "2026-07-17T22:00:00.000Z", serviceMinute: 300 });
        database.market_price_snapshots.push({ snapshot: { roundEnd: body.cycleEnd } });
        return json({
          ok: true,
          snapshot: {
            decisions: [{ productId: "mp_cem", oldPriceMinor: 1200, newPriceMinor: 1200, movement: "hold", reason: "No orders were recorded in this category, so the price held." }],
          },
        });
      }
      throw new Error(`Unexpected POS request ${url}`);
    };

    const runnerOptions = { marketCycleUrl: "https://example.supabase.co/functions/v1/market-cycle", schedulerSecret: "scheduler-secret", serviceRoleKey: "sb_secret_test" };
    const result = await runMarketCycle({ supabase: new MemorySupabase(database), simulatorUrl: "http://simulator", venueSlug: "demo-venue", fetchImpl, ...runnerOptions });
    const duplicate = await runMarketCycle({
      supabase: new MemorySupabase(database),
      simulatorUrl: "http://simulator",
      venueSlug: "demo-venue",
      fetchImpl,
      ...runnerOptions,
      lastProcessedRoundEnd: result.processedRoundEnd,
    });

    expect(result).toMatchObject({ importedSales: 1, publishedLines: 0, status: "cloud price cycle published" });
    expect(duplicate).toMatchObject({ publishedLines: 0, status: "waiting for next five-minute round" });
    expect(database.pos_sales_events).toHaveLength(1);
    expect(database.market_price_snapshots).toHaveLength(1);
    expect(database.market_products[0].current_price_minor).toBe(1200);
    expect(publications).toEqual([]);
  });
});

function json(body) { return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }); }

class MemorySupabase {
  constructor(database) { this.database = database; }
  from(table) { return new MemoryQuery(this.database, table); }
}

class MemoryQuery {
  constructor(database, table) { this.database = database; this.table = table; this.filters = []; this.operation = "select"; this.single = false; }
  select() { this.operation = "select"; return this; }
  eq(column, value) { this.filters.push(row => row[column] === value); return this; }
  gte(column, value) { this.filters.push(row => row[column] >= value); return this; }
  lt(column, value) { this.filters.push(row => row[column] < value); return this; }
  lte(column, value) { this.filters.push(row => row[column] <= value); return this; }
  not(column, operator, value) { if (operator === "is" && value === null) this.filters.push(row => row[column] !== null && row[column] !== undefined); return this; }
  order(column, { ascending }) { this.orderBy = { column, ascending }; return this; }
  limit(value) { this.limitValue = value; return this; }
  maybeSingle() { this.single = true; return this; }
  update(row) { this.operation = "update"; this.row = row; return this; }
  insert(rows) { const values = Array.isArray(rows) ? rows : [rows]; this.database[this.table].push(...values.map(value => ({ ...value }))); return Promise.resolve({ error: null }); }
  upsert(rows) { for (const row of rows) if (!this.database[this.table].some(existing => existing.id === row.id)) this.database[this.table].push({ ...row }); return Promise.resolve({ error: null }); }
  then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
  execute() {
    let rows = this.database[this.table].filter(row => this.filters.every(filter => filter(row)));
    if (this.operation === "update") { rows.forEach(row => Object.assign(row, this.row)); return { data: rows, error: null }; }
    if (this.orderBy) rows = [...rows].sort((left, right) => (left[this.orderBy.column] > right[this.orderBy.column] ? 1 : -1) * (this.orderBy.ascending ? 1 : -1));
    if (this.limitValue) rows = rows.slice(0, this.limitValue);
    return { data: this.single ? rows[0] ?? null : rows, error: null };
  }
}
