import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
const MARKET_CYCLE_MS = 5 * 60_000;

export async function startMarketRunner({
  env = { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env },
  log = console,
} = {}) {
  const simulatorUrl = env.POS_SIMULATOR_URL ?? "http://127.0.0.1:3002";
  const venueSlug = env.NIGHT_ECONOMY_VENUE_SLUG ?? "demo-venue";
  const intervalMs = Number(env.SIMULATOR_CYCLE_MS ?? 3750);
  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const schedulerSecret = env.SCHEDULER_SECRET;
  if (!supabaseUrl || !serviceRoleKey || isPlaceholder(serviceRoleKey)) {
    throw new Error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY before running the local market runner.");
  }
  if (!schedulerSecret || isPlaceholder(schedulerSecret)) {
    throw new Error("Set SCHEDULER_SECRET before running the local market sync.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    // Modern sb_secret keys are accepted in `apikey`, not as Bearer tokens.
    global: { fetch: fetchWithSecretKey },
  });
  let running = false;
  let lastProcessedRoundEnd;
  let lastSimulatorResetId;
  async function cycle() {
    if (running) return;
    running = true;
    try {
      const result = await runMarketCycle({
        supabase,
        simulatorUrl,
        venueSlug,
        marketCycleUrl: `${supabaseUrl}/functions/v1/market-cycle`,
        schedulerSecret,
        serviceRoleKey,
        lastProcessedRoundEnd,
        lastSimulatorResetId,
      });
      if (result.processedRoundEnd) lastProcessedRoundEnd = result.processedRoundEnd;
      if (result.simulatorResetId !== undefined) lastSimulatorResetId = result.simulatorResetId;
      log.log(`${result.referenceTime} ${result.status}: ${result.importedSales} sale line${result.importedSales === 1 ? "" : "s"}, ${result.publishedLines} price update${result.publishedLines === 1 ? "" : "s"}`);
    } catch (error) {
      log.error(`Market runner failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      running = false;
    }
  }

  log.log(`Local market runner polling ${simulatorUrl} every ${intervalMs}ms for venue ${venueSlug}.`);
  await cycle();
  return setInterval(() => { void cycle(); }, intervalMs);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startMarketRunner().catch(error => {
    console.error(error instanceof Error ? error.message : "Could not start local market runner");
    process.exit(1);
  });
}

export async function runMarketCycle({
  supabase,
  simulatorUrl,
  venueSlug,
  fetchImpl = fetch,
  marketCycleUrl,
  schedulerSecret,
  serviceRoleKey,
  lastProcessedRoundEnd,
  lastSimulatorResetId,
} = {}) {
  const [{ data: venue, error: venueError }, simulatorState] = await Promise.all([
    supabase.from("venues").select("id, slug, market_live").eq("slug", venueSlug).maybeSingle(),
    getJson(fetchImpl, `${simulatorUrl}/v1/simulation/state`),
  ]);
  throwIfError(venueError, "load venue");
  if (!venue) throw new Error(`Venue ${venueSlug} was not found`);

  const { data: connection, error: connectionError } = await supabase
    .from("pos_connections")
    .select("id, base_url, status")
    .eq("venue_id", venue.id)
    .eq("provider", "simulator")
    .maybeSingle();
  throwIfError(connectionError, "load simulator connection");
  if (!connection) throw new Error(`No simulator POS connection exists for ${venueSlug}`);
  if (connection.status !== "active") throw new Error("Simulator POS connection is not active");

  const posBaseUrl = connection.base_url || simulatorUrl;
  const simulatorResetId = Number(simulatorState.service.resetId ?? 0);
  const resetDetected = lastSimulatorResetId !== undefined && lastSimulatorResetId !== simulatorResetId;
  if (resetDetected) await resetServiceData({ supabase, venueId: venue.id });
  const productMap = await syncPosProducts({ supabase, fetchImpl, posBaseUrl, venueId: venue.id, connectionId: connection.id });
  const importedSales = await importSales({
    supabase,
    fetchImpl,
    posBaseUrl,
    venueId: venue.id,
    connectionId: connection.id,
    productMap,
  });
  const referenceTime = simulatorState.service.simulatedTime;

  if (!venue.market_live || simulatorState.service.running === false) {
    const publishedLines = await resetPausedMarket({ supabase, fetchImpl, posBaseUrl, venueId: venue.id, connectionId: connection.id, productMap });
    return { importedSales, publishedLines: publishedLines.length, referenceTime, simulatorResetId, status: resetDetected ? "service reset; market paused" : "market paused" };
  }

  const roundEnd = new Date(Math.floor(Date.parse(referenceTime) / MARKET_CYCLE_MS) * MARKET_CYCLE_MS).toISOString();
  if (lastProcessedRoundEnd === roundEnd) {
    return { importedSales, publishedLines: 0, referenceTime, simulatorResetId, status: resetDetected ? "service reset; waiting for next five-minute round" : "waiting for next five-minute round" };
  }

  const [{ data: latestSnapshot, error: snapshotLoadError }, { data: marketProducts, error: marketError }] = await Promise.all([
    supabase.from("market_price_snapshots").select("snapshot").eq("venue_id", venue.id).order("created_at", { ascending: false }).limit(1),
    supabase
      .from("market_products")
      .select("id, pos_product_id, category, base_price_minor, current_price_minor, floor_price_minor, ceiling_price_minor, is_live, is_sold_out")
      .eq("venue_id", venue.id)
      .not("pos_product_id", "is", null),
  ]);
  throwIfError(snapshotLoadError, "load last market round");
  throwIfError(marketError, "load mapped market products");
  if (latestSnapshot?.[0]?.snapshot?.roundEnd === roundEnd) {
    return { importedSales, publishedLines: 0, referenceTime, simulatorResetId, status: resetDetected ? "service reset; waiting for next five-minute round" : "waiting for next five-minute round" };
  }

  if (!marketCycleUrl || !schedulerSecret || !serviceRoleKey) {
    throw new Error("The cloud market-cycle URL, scheduler secret, and server key are required.");
  }
  const cycle = await invokeCloudMarketCycle({
    fetchImpl,
    marketCycleUrl,
    schedulerSecret,
    serviceRoleKey,
    venueSlug,
    roundEnd,
  });
  const posProductIds = new Map((marketProducts ?? []).map(product => [product.id, product.pos_product_id]));
  const changed = (cycle.snapshot?.decisions ?? [])
    .map(decision => ({ ...decision, posProductId: posProductIds.get(decision.productId) }))
    .filter(decision => decision.oldPriceMinor !== decision.newPriceMinor);
  const publishedLines = changed.length
    ? await publishPrices({
        supabase,
        fetchImpl,
        posBaseUrl,
        venueId: venue.id,
        connectionId: connection.id,
        decisions: changed,
        productMap,
      })
    : [];

  return { importedSales, publishedLines: publishedLines.length, referenceTime, processedRoundEnd: roundEnd, simulatorResetId, status: resetDetected ? "service reset; cloud price cycle published" : "cloud price cycle published" };
}

async function invokeCloudMarketCycle({ fetchImpl, marketCycleUrl, schedulerSecret, serviceRoleKey, venueSlug, roundEnd }) {
  const response = await fetchImpl(marketCycleUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      "content-type": "application/json",
      "x-night-economy-scheduler-secret": schedulerSecret,
    },
    body: JSON.stringify({ venueSlug, reason: "simulator_cycle", cycleEnd: roundEnd }),
  });
  if (!response.ok) throw new Error(`Cloud market cycle failed: ${response.status} ${await response.text()}`);
  const result = await response.json();
  if (!result.ok || !result.snapshot) throw new Error(result.error ?? "Cloud market cycle did not return a snapshot.");
  return result;
}

async function resetPausedMarket({ supabase, fetchImpl, posBaseUrl, venueId, connectionId, productMap }) {
  const { data: products, error } = await supabase.from("market_products").select("id, pos_product_id, base_price_minor, current_price_minor").eq("venue_id", venueId).not("pos_product_id", "is", null);
  throwIfError(error, "load market prices to pause");
  const decisions = (products ?? [])
    .filter(product => product.current_price_minor !== product.base_price_minor)
    .map(product => ({ productId: product.id, posProductId: product.pos_product_id, oldPriceMinor: product.current_price_minor, newPriceMinor: product.base_price_minor }));
  if (!decisions.length) return [];
  const publishedLines = await publishPrices({ supabase, fetchImpl, posBaseUrl, venueId, connectionId, decisions, productMap });
  await Promise.all(publishedLines.map(line => update(supabase, "market_products", { current_price_minor: line.newPriceMinor, updated_at: new Date().toISOString() }, "id", line.productId, "reset paused market price")));
  return publishedLines;
}

async function resetServiceData({ supabase, venueId }) {
  const [{ data: publications, error: publicationsError }, { data: marketProducts, error: marketError }, { data: posProducts, error: posError }] = await Promise.all([
    supabase.from("price_publications").select("id").eq("venue_id", venueId),
    supabase.from("market_products").select("id, base_price_minor").eq("venue_id", venueId),
    supabase.from("pos_products").select("id, base_price_minor").eq("venue_id", venueId),
  ]);
  throwIfError(publicationsError, "load price publications for reset");
  throwIfError(marketError, "load market products for reset");
  throwIfError(posError, "load POS products for reset");

  const publicationIds = (publications ?? []).map(publication => publication.id);
  if (publicationIds.length) {
    const { error } = await supabase.from("price_publication_lines").delete().in("publication_id", publicationIds);
    throwIfError(error, "delete price publication lines for reset");
  }
  const deletes = await Promise.all([
    supabase.from("price_publications").delete().eq("venue_id", venueId),
    supabase.from("market_price_snapshots").delete().eq("venue_id", venueId),
    supabase.from("pos_sales_events").delete().eq("venue_id", venueId),
  ]);
  deletes.forEach(result => throwIfError(result.error, "delete prior service data"));
  await Promise.all([
    ...(marketProducts ?? []).map(product => update(supabase, "market_products", { current_price_minor: product.base_price_minor, updated_at: new Date().toISOString() }, "id", product.id, "reset market price")),
    ...(posProducts ?? []).map(product => update(supabase, "pos_products", { current_price_minor: product.base_price_minor, updated_at: new Date().toISOString() }, "id", product.id, "reset POS price")),
  ]);
}

async function syncPosProducts({ supabase, fetchImpl, posBaseUrl, venueId, connectionId }) {
  const [{ products }, { data: existing, error: existingError }] = await Promise.all([
    getJson(fetchImpl, `${posBaseUrl}/v1/products`),
    supabase.from("pos_products").select("id, external_id").eq("pos_connection_id", connectionId),
  ]);
  throwIfError(existingError, "load synced POS products");
  const { error: markStaleError } = await supabase
    .from("pos_products")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("venue_id", venueId)
    .eq("pos_connection_id", connectionId);
  throwIfError(markStaleError, "mark missing POS products");
  const existingByExternalId = new Map((existing ?? []).map(product => [product.external_id, product]));
  const rows = products.map(product => {
    const existingProduct = existingByExternalId.get(product.id);
    return {
      id: existingProduct?.id ?? `pos_${connectionId}_${product.id}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      venue_id: venueId,
      pos_connection_id: connectionId,
      external_id: product.id,
      sku: product.sku,
      source_name: product.name,
      base_price_minor: product.basePriceMinor,
      current_price_minor: product.currentPriceMinor,
      currency: product.currency,
      is_available: product.isAvailable,
      is_current: true,
      category: product.category,
      subcategory: product.subcategory,
      product_group: product.productGroup,
      serve_size: product.serveSize,
      synced_at: product.updatedAt,
      updated_at: new Date().toISOString(),
    };
  });
  const { error } = await supabase.from("pos_products").upsert(rows, { onConflict: "id" });
  throwIfError(error, "sync POS products");
  await ensureMarketProducts({ supabase, venueId, rows, products });
  return new Map(products.map((product, index) => [product.id, rows[index].id]));
}

async function ensureMarketProducts({ supabase, venueId, rows, products }) {
  const { data: existing, error: existingError } = await supabase
    .from("market_products")
    .select("pos_product_id")
    .eq("venue_id", venueId)
    .not("pos_product_id", "is", null);
  throwIfError(existingError, "load configured market products");
  const configuredPosProductIds = new Set((existing ?? []).map(product => product.pos_product_id));
  const marketRows = rows.flatMap((row, index) => (configuredPosProductIds.has(row.id) ? [] : [{
    id: `mp_${row.id}`,
    venue_id: venueId,
    pos_product_id: row.id,
    market_symbol: `POS_${row.id}`,
    display_name: products[index].name,
    category: products[index].category || "Uncategorised",
    base_price_minor: products[index].basePriceMinor,
    current_price_minor: products[index].currentPriceMinor,
    floor_price_minor: Math.round(products[index].basePriceMinor * 0.8),
    ceiling_price_minor: Math.round(products[index].basePriceMinor * 1.2),
    sales_velocity: 0,
    is_live: false,
    is_sold_out: !products[index].isAvailable,
    priority: false,
  }]));
  if (!marketRows.length) return;
  const { error } = await supabase.from("market_products").insert(marketRows);
  throwIfError(error, "create inactive market products from POS catalogue");
}


async function importSales({ supabase, fetchImpl, posBaseUrl, venueId, connectionId, productMap }) {
  const { data: latest, error: latestError } = await supabase
    .from("pos_sales_events")
    .select("occurred_at")
    .eq("pos_connection_id", connectionId)
    .order("occurred_at", { ascending: false })
    .limit(1);
  throwIfError(latestError, "load sales import cursor");
  const latestTime = latest?.[0]?.occurred_at;
  // The simulator starts at 18:00 London, which is 17:00 UTC during BST.
  // Start one minute earlier on a fresh service so the opening sales are not skipped.
  const since = latestTime ? new Date(Date.parse(latestTime) - 60_000).toISOString() : "2026-07-17T16:59:00.000Z";
  const { sales } = await getJson(fetchImpl, `${posBaseUrl}/v1/sales?since=${encodeURIComponent(since)}`);
  const rows = sales
    .filter(sale => productMap.has(sale.productId))
    .map(sale => ({
      id: sale.id,
      venue_id: venueId,
      pos_connection_id: connectionId,
      pos_product_id: productMap.get(sale.productId),
      occurred_at: sale.occurredAt,
      quantity: sale.quantity,
      unit_price_minor: sale.unitPriceMinor,
      currency: sale.currency,
    }));
  if (!rows.length) return 0;
  const { error } = await supabase.from("pos_sales_events").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  throwIfError(error, "import POS sales");
  return rows.length;
}

async function publishPrices({ supabase, fetchImpl, posBaseUrl, venueId, connectionId, decisions, productMap }) {
  const inverseProductMap = new Map([...productMap].map(([externalId, id]) => [id, externalId]));
  const publicationId = `publication_${crypto.randomUUID()}`;
  const lines = decisions
    .filter(decision => decision.posProductId)
    .map(line => ({ ...line, externalProductId: inverseProductMap.get(line.posProductId) }));
  if (!lines.length) return 0;

  const { error: publicationError } = await supabase.from("price_publications").insert({
    id: publicationId,
    venue_id: venueId,
    pos_connection_id: connectionId,
    reason: "simulator_cycle",
    status: "pending",
  });
  throwIfError(publicationError, "create price publication");
  const { error: lineError } = await supabase.from("price_publication_lines").insert(
    lines.map(line => ({
      publication_id: publicationId,
      market_product_id: line.productId,
      pos_product_id: line.posProductId,
      old_price_minor: line.oldPriceMinor,
      new_price_minor: line.newPriceMinor,
      status: "pending",
    })),
  );
  throwIfError(lineError, "create price publication lines");

  const result = await postJson(fetchImpl, `${posBaseUrl}/v1/price-publications`, {
    publicationId,
    lines: lines.map(line => ({ productId: line.externalProductId, newPriceMinor: line.newPriceMinor })),
  });
  const resultsByExternalId = new Map(result.lines.map(line => [line.productId, line]));
  const publishedLines = [];

  await Promise.all(lines.map(async line => {
    const response = resultsByExternalId.get(line.externalProductId) ?? { status: "failed", message: "POS did not return this line" };
    const status = response.status === "published" ? "published" : "failed";
    if (status === "published") {
      publishedLines.push(line);
      await update(supabase, "pos_products", { current_price_minor: line.newPriceMinor, updated_at: new Date().toISOString() }, "id", line.posProductId, "update published POS price");
    }
    await supabase
      .from("price_publication_lines")
      .update({ status, response })
      .eq("publication_id", publicationId)
      .eq("pos_product_id", line.posProductId);
  }));

  const publicationStatus = publishedLines.length === lines.length ? "published" : publishedLines.length ? "partial_failure" : "failed";
  await update(supabase, "price_publications", { status: publicationStatus, published_at: new Date().toISOString() }, "id", publicationId, "finish price publication");
  return publishedLines;
}

async function update(supabase, table, row, key, value, action) {
  const { error } = await supabase.from(table).update(row).eq(key, value);
  throwIfError(error, action);
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`POS request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function postJson(fetchImpl, url, body) {
  const response = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`POS publication failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function throwIfError(error, action) {
  if (error) throw new Error(`Could not ${action}: ${error.message}`);
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#") && line.includes("=")).map(line => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));
}

function isPlaceholder(value) {
  return ["", "your_service_role_key_here", "..."].includes(value ?? "");
}

export function fetchWithSecretKey(input, init = {}, fetchImpl = fetch) {
  const headers = new Headers(init.headers);
  headers.delete("authorization");
  return fetchImpl(input, { ...init, headers });
}
