type MarketProduct = {
  id: string;
  pos_product_id: string | null;
  base_price_minor: number;
  current_price_minor: number;
  floor_price_minor: number;
  ceiling_price_minor: number;
  category: string;
  is_live: boolean;
  is_sold_out: boolean;
};

type PosSaleEvent = {
  pos_product_id: string;
  quantity: number;
};

type Venue = {
  id: string;
  market_live: boolean;
};

type PriceDecision = {
  productId: string;
  oldPriceMinor: number;
  newPriceMinor: number;
  movement: "up" | "down" | "hold";
  reason: string;
};

const MARKET_INTENSITY = 1.25;
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

  const { venueSlug = "demo-venue", reason = "manual_cycle", cycleEnd: requestedCycleEnd } = await request.json().catch(() => ({}));
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

  const products = await restJson<MarketProduct[]>(
    `${supabaseUrl}/rest/v1/market_products?venue_id=eq.${encodeURIComponent(venue.id)}&select=*&order=display_name.asc`,
    { headers },
    "load market products",
  );
  const cycleEnd = requestedCycleEnd ? new Date(requestedCycleEnd) : new Date();
  if (Number.isNaN(cycleEnd.getTime())) return json({ error: "cycleEnd must be a valid ISO timestamp" }, 400);
  const cycleStart = new Date(cycleEnd.getTime() - MARKET_CYCLE_MS);
  const latestSnapshots = await restJson<Array<{ snapshot: { roundEnd?: string } | null }>>(
    `${supabaseUrl}/rest/v1/market_price_snapshots?venue_id=eq.${encodeURIComponent(venue.id)}&select=snapshot&order=created_at.desc&limit=1`,
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
  const sales = await restJson<PosSaleEvent[]>(
    `${supabaseUrl}/rest/v1/pos_sales_events?venue_id=eq.${encodeURIComponent(venue.id)}&occurred_at=gte.${encodeURIComponent(cycleStart.toISOString())}&occurred_at=lte.${encodeURIComponent(cycleEnd.toISOString())}&select=pos_product_id,quantity`,
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

function priceMarket(products: MarketProduct[], sales: PosSaleEvent[]): PriceDecision[] {
  const active = products.filter(product => product.is_live && !product.is_sold_out);
  const groups = new Map<string, MarketProduct[]>();
  const sold = new Map<string, number>();
  for (const product of active) groups.set(product.category, [...(groups.get(product.category) ?? []), product]);
  for (const sale of sales) sold.set(sale.pos_product_id, (sold.get(sale.pos_product_id) ?? 0) + sale.quantity);
  return products.map(product => priceProduct(product, groups, sold));
}

function priceProduct(product: MarketProduct, groups: Map<string, MarketProduct[]>, sold: Map<string, number>): PriceDecision {
  if (!product.is_live || product.is_sold_out) {
    return hold(product, "Product is not currently tradable.");
  }
  const peers = groups.get(product.category) ?? [product];
  if (peers.length === 1) return hold(product, "This is the only live product in its category, so the price held.");
  const categoryUnits = peers.reduce((sum, peer) => sum + (peer.pos_product_id ? sold.get(peer.pos_product_id) ?? 0 : 0), 0);
  if (!categoryUnits) return hold(product, "No orders were recorded in this category, so the price held.");
  // Every sale gives the sold drink +(N-1) points and each other live drink
  // -1. The category total is always exactly zero.
  const ownUnits = product.pos_product_id ? sold.get(product.pos_product_id) ?? 0 : 0;
  const marketPoints = peers.length * ownUnits - categoryUnits;
  const marketSignal = marketPoints / (peers.length * categoryUnits);
  const activityFactor = categoryUnits / (categoryUnits + peers.length);
  const allowedRange = (product.ceiling_price_minor - product.floor_price_minor) / product.base_price_minor;
  const percentageChange = MARKET_INTENSITY * allowedRange * activityFactor * marketSignal;
  const rawNext = Math.round(product.current_price_minor * (1 + percentageChange));

  const nextPrice = Math.max(product.floor_price_minor, Math.min(product.ceiling_price_minor, rawNext));
  const movement =
    nextPrice > product.current_price_minor ? "up" : nextPrice < product.current_price_minor ? "down" : "hold";

  return {
    productId: product.id,
    oldPriceMinor: product.current_price_minor,
    newPriceMinor: nextPrice,
    movement,
    reason: movement === "hold"
      ? "Orders were evenly balanced within this category, so the price held."
      : `This drink ${movement === "up" ? "gained" : "lost"} market points against its category peers.`,
  };
}
function hold(product: MarketProduct, reason: string): PriceDecision { return { productId: product.id, oldPriceMinor: product.current_price_minor, newPriceMinor: product.current_price_minor, movement: "hold", reason }; }

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
