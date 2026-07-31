import {
  priceMarket,
  type MarketPricingSale,
  type PriceableMarketProduct,
} from "../_shared/marketPricing.ts";

type Venue = {
  id: string;
  market_live: boolean;
};

const MARKET_CYCLE_MS = 5 * 60_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-night-economy-scheduler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async request => {
  try {
    return await handleRequest(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Market cycle failed" }, 500);
  }
});

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const schedulerSecret = Deno.env.get("SCHEDULER_SECRET");
  const requestSecret = request.headers.get("x-night-economy-scheduler-secret");
  if (!schedulerSecret) return json({ error: "SCHEDULER_SECRET is not configured" }, 500);
  if (requestSecret !== schedulerSecret) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getServerKey();
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase function secrets are missing" }, 500);

  const { venueSlug = "demo-venue", reason = "manual_cycle", cycleEnd: requestedCycleEnd, runId = null } = await request.json().catch(() => ({}));
  const headers = {
    apikey: serviceRoleKey,
    "content-type": "application/json",
  };

  const venues = await restJson<Venue[]>(
    `${supabaseUrl}/rest/v1/venues?slug=eq.${encodeURIComponent(venueSlug)}&select=id,market_live`,
    { headers },
    "load venue",
  );
  const venue = venues?.[0];
  if (!venue) return json({ error: "Venue not found" }, 404);

  if (!venue.market_live) {
    return json({
      ok: true,
      engine: "night-economy-v2",
      skipped: true,
      reason: "Market is paused for this venue.",
      venueId: venue.id,
      venueSlug,
    });
  }

  const products = await restJson<PriceableMarketProduct[]>(
    `${supabaseUrl}/rest/v1/market_products?venue_id=eq.${encodeURIComponent(venue.id)}&select=*&order=display_name.asc`,
    { headers },
    "load market products",
  );
  const cycleEnd = requestedCycleEnd ? new Date(requestedCycleEnd) : new Date();
  if (Number.isNaN(cycleEnd.getTime())) return json({ error: "cycleEnd must be a valid ISO timestamp" }, 400);
  const cycleStart = new Date(cycleEnd.getTime() - MARKET_CYCLE_MS);
  const latestSnapshots = await restJson<Array<{ snapshot: { roundEnd?: string } | null }>>(
    `${supabaseUrl}/rest/v1/market_price_snapshots?venue_id=eq.${encodeURIComponent(venue.id)}&run_id=${runId ? `eq.${encodeURIComponent(runId)}` : "is.null"}&select=snapshot&order=created_at.desc&limit=1`,
    { headers },
    "load latest market snapshot",
  );
  if (latestSnapshots[0]?.snapshot?.roundEnd === cycleEnd.toISOString()) {
    return json({
      ok: true,
      engine: "night-economy-v2",
      duplicate: true,
      snapshot: latestSnapshots[0].snapshot,
    });
  }
  const sales = await restJson<MarketPricingSale[]>(
    `${supabaseUrl}/rest/v1/pos_sales_events?venue_id=eq.${encodeURIComponent(venue.id)}&occurred_at=gte.${encodeURIComponent(cycleStart.toISOString())}&occurred_at=lt.${encodeURIComponent(cycleEnd.toISOString())}&select=pos_product_id,quantity`,
    { headers },
    "load recent POS sales",
  );
  const decisions = priceMarket(products, sales);
  const updatedAt = new Date().toISOString();

  await Promise.all(
    decisions.filter(decision => decision.oldPriceMinor !== decision.newPriceMinor).map(decision =>
      restRequest(`${supabaseUrl}/rest/v1/market_products?id=eq.${encodeURIComponent(decision.productId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ current_price_minor: decision.newPriceMinor, updated_at: updatedAt }),
      }, `update product ${decision.productId}`),
    ),
  );

  const snapshot = {
    venueId: venue.id,
    venueSlug,
    runId,
    reason,
    salesWindow: { start: cycleStart.toISOString(), end: cycleEnd.toISOString(), importedLines: sales.length },
    roundStart: cycleStart.toISOString(),
    roundEnd: cycleEnd.toISOString(),
    decisions,
  };

  await restRequest(`${supabaseUrl}/rest/v1/market_price_snapshots`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: crypto.randomUUID(),
      venue_id: venue.id,
      run_id: runId,
      reason,
      status: "published",
      snapshot,
    }),
  }, "write market snapshot");

  return json({ ok: true, engine: "night-economy-v2", snapshot });
}

async function restJson<T>(url: string, init: RequestInit, action: string): Promise<T> {
  const response = await restRequest(url, init, action);
  return response.json() as Promise<T>;
}

async function restRequest(url: string, init: RequestInit, action: string) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Supabase REST failed to ${action}: ${response.status} ${body}`);
  }

  return response;
}

function getServerKey() {
  const modernKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modernKeys) {
    try {
      const keys = JSON.parse(modernKeys) as Record<string, string>;
      return keys.default ?? Object.values(keys)[0];
    } catch {
      return undefined;
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}
