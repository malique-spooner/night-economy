import { simulationStart } from "../_shared/serviceSchedule.ts";

type Service = { venue_id: string; status: "idle" | "running" | "paused" | "ended"; simulated_minute: number; speed: number; target_revenue_minor: number; rush_until_minute: number; slowdown_until_minute: number; last_tick_at: string | null; started_at: string | null; scheduled_slot_key: string | null; active_run_id: string | null };
type Product = { id: string; display_name: string; category: string; base_price_minor: number; current_price_minor: number; pos_product_id: string | null; is_live: boolean; is_sold_out: boolean };
type SimulatedSale = { occurred_at: string; quantity: number; unit_price_minor: number };

const SERVICE_MINUTES = 360;
const QUICK_START_SPEED = 36;
const SERVICE_START = Date.UTC(2026, 6, 28, 17, 0, 0);
const corsHeaders = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };

Deno.serve(async request => {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
    const url = Deno.env.get("SUPABASE_URL");
    const key = serverKey();
    if (!url || !key) return response({ error: "Server configuration is incomplete" }, 500);

    const schedulerSecret = Deno.env.get("SCHEDULER_SECRET");
    const isScheduler = Boolean(schedulerSecret) && request.headers.get("x-night-economy-scheduler-secret") === schedulerSecret;
    const { venueSlug, action = "state", speed, targetRevenueMinor, eventType, scheduledSlotKey } = await request.json().catch(() => ({}));
    if (!venueSlug || !["state", "tick", "summary", "quick_start", "pause", "resume", "end", "event", "scheduled_start", "scheduled_end"].includes(action)) return response({ error: "Invalid simulator request" }, 400);
    const isPublicRead = action === "state";
    const userId = isScheduler || isPublicRead ? null : await authenticatedUserId(url, key, request.headers.get("Authorization"));
    if (!isScheduler && !isPublicRead && !userId) return response({ error: "Unauthorized" }, 401);
    const headers = { apikey: key, "content-type": "application/json" };

    const venues = await restJson<Array<{ id: string; slug: string; timezone: string }>>(url, `/venues?slug=eq.${encodeURIComponent(venueSlug)}&select=id,slug,timezone`, { headers }, "load venue");
    const venue = venues[0];
    if (!venue) return response({ error: "Venue not found" }, 404);
    if (!isScheduler && !isPublicRead) {
      const memberships = await restJson<Array<{ role: string }>>(url, `/venue_members?venue_id=eq.${encodeURIComponent(venue.id)}&user_id=eq.${encodeURIComponent(userId!)}&select=role`, { headers }, "check venue access");
      if (!memberships[0] || !["owner", "admin"].includes(memberships[0].role)) return response({ error: "Only venue owners or admins can run a test service" }, 403);
    }

    const states = await restJson<Service[]>(url, `/venue_test_services?venue_id=eq.${encodeURIComponent(venue.id)}&select=*`, { headers }, "load test service");
    let state = states[0];
    if (!state) return response({ error: "This venue's test service has not been prepared yet." }, 409);
    const nextSpeed = Number.isFinite(speed) ? Math.max(1, Math.min(120, Math.round(speed))) : state.speed;
    const nextTargetRevenueMinor = Number.isFinite(targetRevenueMinor) ? Math.max(0, Math.min(5_000_000, Math.round(targetRevenueMinor))) : state.target_revenue_minor;

    if (action === "quick_start" || action === "scheduled_start") {
      await resetTestService(url, headers, venue.id);
      await setMarketLive(url, headers, venue.id, true);
      const requestedAt = new Date();
      const runStartedAt = requestedAt.toISOString();
      const simulatedStartedAt = simulationStart(venue.timezone || "Europe/London", requestedAt, action === "scheduled_start" ? scheduledSlotKey : null);
      const runId = await createRun(url, headers, venue.id, action === "scheduled_start" ? "scheduled" : "quick", action === "scheduled_start" ? scheduledSlotKey ?? null : null, runStartedAt);
      state = await save(url, headers, venue.id, { status: "running", simulated_minute: 0, speed: action === "scheduled_start" ? 1 : (Number.isFinite(speed) ? nextSpeed : QUICK_START_SPEED), target_revenue_minor: nextTargetRevenueMinor, rush_until_minute: 0, slowdown_until_minute: 0, last_tick_at: runStartedAt, started_at: simulatedStartedAt, scheduled_slot_key: action === "scheduled_start" ? scheduledSlotKey ?? null : null, active_run_id: runId });
    } else if (action === "event") {
      if (!['rush', 'slowdown'].includes(eventType)) return response({ error: "Unknown simulator event" }, 400);
      state = await save(url, headers, venue.id, eventType === 'rush' ? { rush_until_minute: Math.min(SERVICE_MINUTES, state.simulated_minute + 30) } : { slowdown_until_minute: Math.min(SERVICE_MINUTES, state.simulated_minute + 30) });
    } else if (action === "pause") {
      await resetPrices(url, headers, venue.id);
      await setMarketLive(url, headers, venue.id, false);
      await updateRun(url, headers, state.active_run_id, { status: "paused", simulated_minutes: state.simulated_minute });
      state = await save(url, headers, venue.id, { status: "paused", speed: nextSpeed, last_tick_at: new Date().toISOString() });
    } else if (action === "resume") {
      await setMarketLive(url, headers, venue.id, true);
      await updateRun(url, headers, state.active_run_id, { status: "running", simulated_minutes: state.simulated_minute });
      state = await save(url, headers, venue.id, { status: "running", speed: nextSpeed, last_tick_at: new Date().toISOString() });
    } else if (action === "end" || action === "scheduled_end") {
      await resetPrices(url, headers, venue.id);
      await setMarketLive(url, headers, venue.id, false);
      await finishRun(url, headers, state.active_run_id, action === "scheduled_end" ? "completed" : "ended", state.simulated_minute);
      state = await save(url, headers, venue.id, { status: "ended", speed: nextSpeed, last_tick_at: new Date().toISOString(), active_run_id: null });
    } else if (action === "tick" && state.status === "running") {
      state = await advance(url, headers, venue.id, venue.slug, state, nextSpeed);
    }
    if (action === "summary") {
      try {
        return response({ service: publicState(state), salesGraph: await salesGraph(url, headers, state), products: await simulatorProducts(url, headers, venue.id, state), recentSales: await recentSales(url, headers, state) });
      } catch (error) {
        return response({ service: publicState(state), salesGraph: [], products: [], recentSales: [], summaryError: error instanceof Error ? error.message : "Could not load simulator dashboard" });
      }
    }
    return response({ service: publicState(state) });
  } catch (error) {
    console.error("venue-simulator failed", error);
    return response({ error: error instanceof Error ? error.message : "Could not run venue test service" }, 500);
  }
});

async function advance(url: string, headers: HeadersInit, venueId: string, venueSlug: string, state: Service, speed: number) {
  const tickedAt = new Date();
  const elapsed = Math.floor(((tickedAt.getTime() - Date.parse(state.last_tick_at ?? tickedAt.toISOString())) / 60_000) * speed);
  const nextMinute = Math.min(SERVICE_MINUTES, state.simulated_minute + Math.max(0, elapsed));
  if (nextMinute === state.simulated_minute) return state;
  const products = await restJson<Product[]>(url, `/market_products?venue_id=eq.${encodeURIComponent(venueId)}&select=id,display_name,category,base_price_minor,current_price_minor,pos_product_id,is_live,is_sold_out`, { headers }, "load venue products");
  const active = products.filter(product => product.is_live && !product.is_sold_out && product.pos_product_id);
  if (!active.length) {
    const status = nextMinute >= SERVICE_MINUTES ? "ended" : "running";
    if (status === "ended") {
      await setMarketLive(url, headers, venueId, false);
      await finishRun(url, headers, state.active_run_id, "completed", nextMinute);
    }
    else await syncRunProgress(url, headers, state.active_run_id, nextMinute);
    return save(url, headers, venueId, { status, simulated_minute: nextMinute, speed, last_tick_at: tickedAt.toISOString(), ...(status === "ended" ? { active_run_id: null } : {}) });
  }
  const connectionId = `test_sim_${venueId}`;
  const salesRows: Array<Record<string, unknown>> = [];
  for (let minute = state.simulated_minute; minute < nextMinute; minute += 1) {
    const eventMultiplier = minute < state.rush_until_minute ? 2.1 : minute < state.slowdown_until_minute ? 0.38 : 1;
    const revenueMultiplier = Math.max(0.2, state.target_revenue_minor / 1_500_000);
    const orders = Math.max(1, Math.round((2 + 8 * Math.sin((minute / SERVICE_MINUTES) * Math.PI)) * eventMultiplier * revenueMultiplier));
    salesRows.push(...Array.from({ length: orders }, (_, index) => {
      const product = active[(minute * 17 + index * 7) % active.length];
      return { id: `test_${venueId}_${state.active_run_id ?? "legacy"}_${minute}_${index}`, venue_id: venueId, pos_connection_id: connectionId, pos_product_id: product.pos_product_id, run_id: state.active_run_id, occurred_at: simulatedTime(minute, state.started_at), quantity: 1, unit_price_minor: product.current_price_minor, currency: "GBP" };
    }));
  }
  if (salesRows.length) {
    await restRequest(url, "/pos_sales_events?on_conflict=id", { method: "POST", headers: { ...headers, Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(salesRows) }, "write simulated sales");
  }
  const latestCycleMinute = Math.floor((nextMinute - 1) / 5) * 5;
  if (latestCycleMinute > state.simulated_minute) {
    const decisions = await runMarketCycle(venueSlug, simulatedTime(latestCycleMinute, state.started_at));
    await publishInternalPrices(url, headers, venueId, connectionId, decisions);
  }
  const status = nextMinute >= SERVICE_MINUTES ? "ended" : "running";
  if (status === "ended") {
    await resetPrices(url, headers, venueId);
    await setMarketLive(url, headers, venueId, false);
    await finishRun(url, headers, state.active_run_id, "completed", nextMinute);
  } else {
    await syncRunProgress(url, headers, state.active_run_id, nextMinute);
  }
  return save(url, headers, venueId, { status, simulated_minute: nextMinute, speed, last_tick_at: tickedAt.toISOString(), ...(status === "ended" ? { active_run_id: null } : {}) });
}

async function runMarketCycle(venueSlug: string, cycleEnd: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const res = await fetch(`${url}/functions/v1/market-cycle`, { method: "POST", headers: { apikey: serverKey()!, "content-type": "application/json", "x-night-economy-scheduler-secret": Deno.env.get("SCHEDULER_SECRET") ?? "" }, body: JSON.stringify({ venueSlug, reason: "venue_test_service", cycleEnd }) });
  if (!res.ok) throw new Error(`Market cycle failed: ${await res.text()}`);
  const result = await res.json() as { snapshot?: { decisions?: Array<{ productId: string; oldPriceMinor: number; newPriceMinor: number }> } };
  return result.snapshot?.decisions ?? [];
}

async function publishInternalPrices(
  url: string,
  headers: HeadersInit,
  venueId: string,
  connectionId: string,
  decisions: Array<{ productId: string; oldPriceMinor: number; newPriceMinor: number }>,
) {
  const changed = decisions.filter(decision => decision.oldPriceMinor !== decision.newPriceMinor);
  if (!changed.length) return;

  const productIds = changed.map(decision => decision.productId).join(",");
  const products = await restJson<Array<{ id: string; pos_product_id: string | null }>>(
    url,
    `/market_products?id=in.(${encodeURIComponent(productIds)})&select=id,pos_product_id`,
    { headers },
    "load mapped products for price publication",
  );
  const posProductByMarketProduct = new Map(products.map(product => [product.id, product.pos_product_id]));
  const lines = changed.flatMap(decision => {
    const posProductId = posProductByMarketProduct.get(decision.productId);
    return posProductId ? [{ ...decision, posProductId }] : [];
  });
  if (!lines.length) return;

  const publicationId = `publication_${crypto.randomUUID()}`;
  await restRequest(url, "/price_publications", {
    method: "POST",
    headers,
    body: JSON.stringify({ id: publicationId, venue_id: venueId, pos_connection_id: connectionId, reason: "venue_test_service", status: "published", published_at: new Date().toISOString() }),
  }, "create internal price publication");
  await restRequest(url, "/price_publication_lines", {
    method: "POST",
    headers,
    body: JSON.stringify(lines.map(line => ({ publication_id: publicationId, market_product_id: line.productId, pos_product_id: line.posProductId, old_price_minor: line.oldPriceMinor, new_price_minor: line.newPriceMinor, status: "published", response: { provider: "internal-simulator", status: "published" } }))),
  }, "write internal price publication lines");
  await Promise.all(lines.map(line => restRequest(url, `/pos_products?id=eq.${encodeURIComponent(line.posProductId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ current_price_minor: line.newPriceMinor, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  }, `publish price to POS product ${line.posProductId}`)));
}

async function resetTestService(url: string, headers: HeadersInit, venueId: string) {
  await resetPrices(url, headers, venueId);
}

async function createRun(url: string, headers: HeadersInit, venueId: string, kind: "quick" | "scheduled", scheduledSlotKey: string | null, startedAt: string) {
  const rows = await restJson<Array<{ id: string }>>(url, "/market_runs", { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ id: `run_${crypto.randomUUID()}`, venue_id: venueId, kind, status: "running", scheduled_slot_key: scheduledSlotKey, started_at: startedAt }) }, "create market run");
  if (!rows[0]) throw new Error("Could not create market run");
  return rows[0].id;
}

async function updateRun(url: string, headers: HeadersInit, runId: string | null, patch: Record<string, unknown>) {
  if (!runId) return;
  await restRequest(url, `/market_runs?id=eq.${encodeURIComponent(runId)}`, { method: "PATCH", headers, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }, "update market run");
}

async function finishRun(url: string, headers: HeadersInit, runId: string | null, status: "ended" | "completed", simulatedMinutes: number) {
  if (!runId) return;
  const sales = await restJson<Array<{ quantity: number; unit_price_minor: number }>>(url, `/pos_sales_events?run_id=eq.${encodeURIComponent(runId)}&select=quantity,unit_price_minor`, { headers }, "summarize market run");
  const salesCount = sales.reduce((total, sale) => total + sale.quantity, 0);
  const revenueMinor = sales.reduce((total, sale) => total + sale.quantity * sale.unit_price_minor, 0);
  await updateRun(url, headers, runId, { status, simulated_minutes: simulatedMinutes, sales_count: salesCount, revenue_minor: revenueMinor, ended_at: new Date().toISOString() });
}

async function syncRunProgress(url: string, headers: HeadersInit, runId: string | null, simulatedMinutes: number) {
  if (!runId) return;
  const sales = await restJson<Array<{ quantity: number; unit_price_minor: number }>>(url, `/pos_sales_events?run_id=eq.${encodeURIComponent(runId)}&select=quantity,unit_price_minor`, { headers }, "summarize running market run");
  const salesCount = sales.reduce((total, sale) => total + sale.quantity, 0);
  const revenueMinor = sales.reduce((total, sale) => total + sale.quantity * sale.unit_price_minor, 0);
  await updateRun(url, headers, runId, { status: "running", simulated_minutes: simulatedMinutes, sales_count: salesCount, revenue_minor: revenueMinor });
}

async function salesGraph(url: string, headers: HeadersInit, state: Service) {
  const points = Array.from({ length: Math.ceil(SERVICE_MINUTES / 5) }, (_, index) => ({ minute: index * 5, salesCount: 0, revenueMinor: 0 }));
  if (!state.active_run_id) return points;
  const sales = await restJson<SimulatedSale[]>(url, `/pos_sales_events?run_id=eq.${encodeURIComponent(state.active_run_id)}&select=occurred_at,quantity,unit_price_minor`, { headers }, "load simulated sales graph");
  const startedAt = Date.parse(state.started_at ?? "");
  for (const sale of sales) {
    const saleMinute = Math.max(0, Math.floor((Date.parse(sale.occurred_at) - startedAt) / 60_000));
    const bucket = points[Math.min(points.length - 1, Math.floor(saleMinute / 5))];
    bucket.salesCount += sale.quantity;
    bucket.revenueMinor += sale.quantity * sale.unit_price_minor;
  }
  return points.filter(point => point.minute <= Math.min(SERVICE_MINUTES - 5, Math.max(5, state.simulated_minute)));
}

async function simulatorProducts(url: string, headers: HeadersInit, venueId: string, state: Service) {
  const products = await restJson<Product[]>(url, `/market_products?venue_id=eq.${encodeURIComponent(venueId)}&select=id,display_name,category,base_price_minor,current_price_minor,pos_product_id,is_live,is_sold_out&order=category.asc,display_name.asc`, { headers }, "load simulator catalogue");
  const sales = state.active_run_id
    ? await restJson<Array<SimulatedSale & { pos_product_id: string }>>(url, `/pos_sales_events?run_id=eq.${encodeURIComponent(state.active_run_id)}&select=pos_product_id,quantity,unit_price_minor,occurred_at`, { headers }, "load simulated product sales")
    : [];
  const salesByProduct = new Map<string, { salesCount: number; revenueMinor: number }>();
  for (const sale of sales) {
    const current = salesByProduct.get(sale.pos_product_id) ?? { salesCount: 0, revenueMinor: 0 };
    current.salesCount += sale.quantity;
    current.revenueMinor += sale.quantity * sale.unit_price_minor;
    salesByProduct.set(sale.pos_product_id, current);
  }
  return products.map(product => ({
    id: product.id,
    posProductId: product.pos_product_id,
    name: product.display_name,
    category: product.category,
    isLive: product.is_live && !product.is_sold_out,
    currentPriceMinor: product.current_price_minor,
    basePriceMinor: product.base_price_minor,
    salesCount: product.pos_product_id ? salesByProduct.get(product.pos_product_id)?.salesCount ?? 0 : 0,
    revenueMinor: product.pos_product_id ? salesByProduct.get(product.pos_product_id)?.revenueMinor ?? 0 : 0,
  }));
}

async function recentSales(url: string, headers: HeadersInit, state: Service) {
  if (!state.active_run_id) return [];
  return restJson<Array<SimulatedSale & { pos_product_id: string }>>(url, `/pos_sales_events?run_id=eq.${encodeURIComponent(state.active_run_id)}&select=pos_product_id,quantity,unit_price_minor,occurred_at&order=occurred_at.desc&limit=30`, { headers }, "load recent simulated sales");
}

async function resetPrices(url: string, headers: HeadersInit, venueId: string) {
  await restRequest(url, "/rpc/reset_venue_test_prices", { method: "POST", headers, body: JSON.stringify({ p_venue_id: venueId }) }, "reset test prices");
}

async function setMarketLive(url: string, headers: HeadersInit, venueId: string, marketLive: boolean) {
  await restRequest(url, `/venues?id=eq.${encodeURIComponent(venueId)}`, { method: "PATCH", headers, body: JSON.stringify({ market_live: marketLive, updated_at: new Date().toISOString() }) }, "set test market status");
}

async function save(url: string, headers: HeadersInit, venueId: string, patch: Record<string, unknown>) {
  const rows = await restJson<Service[]>(url, `/venue_test_services?venue_id=eq.${encodeURIComponent(venueId)}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }, "save test service");
  if (!rows[0]) throw new Error("Could not save test service");
  return rows[0];
}

async function restJson<T>(url: string, path: string, init: RequestInit, action: string): Promise<T> { return (await restRequest(url, path, init, action)).json() as Promise<T>; }
async function restRequest(url: string, path: string, init: RequestInit, action: string) {
  const res = await fetch(`${url}/rest/v1${path}`, init);
  if (!res.ok) throw new Error(`Supabase REST failed to ${action}: ${res.status} ${await res.text()}`);
  return res;
}
function simulatedTime(minute: number, startedAt?: string | null) { const start = startedAt ? Date.parse(startedAt) : SERVICE_START; return new Date((Number.isNaN(start) ? SERVICE_START : start) + minute * 60_000).toISOString(); }
function publicState(state: Service) { return { running: state.status === "running", paused: state.status === "paused", ended: state.status === "ended", minute: state.simulated_minute, speed: state.speed, targetRevenueMinor: state.target_revenue_minor, rushUntilMinute: state.rush_until_minute, slowdownUntilMinute: state.slowdown_until_minute, simulatedTime: simulatedTime(state.simulated_minute, state.started_at), isOpen: state.status === "running" || state.status === "paused" }; }
function serverKey() { const keys = Deno.env.get("SUPABASE_SECRET_KEYS"); if (keys) try { const parsed = JSON.parse(keys) as Record<string, string>; return parsed.default ?? Object.values(parsed)[0]; } catch { return undefined; } return Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); }
async function authenticatedUserId(url: string, key: string, token: string | null) { if (!token) return undefined; const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: token } }); if (!res.ok) return undefined; return (await res.json().catch(() => null) as { id?: string } | null)?.id; }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } }); }
