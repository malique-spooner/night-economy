import { existsSync, readFileSync } from "node:fs";

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env };
const venueSlug = env.NIGHT_ECONOMY_VENUE_SLUG?.trim();
const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/$/, "");
const serverKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!venueSlug) throw new Error("Set NIGHT_ECONOMY_VENUE_SLUG to the venue being prepared.");
if (!supabaseUrl || !serverKey || isPlaceholder(serverKey)) {
  throw new Error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY before preparing a venue test service.");
}

const headers = { apikey: serverKey, "content-type": "application/json" };
const venues = await restJson(`/venues?slug=eq.${encodeURIComponent(venueSlug)}&select=id,name`);
const venue = venues[0];
if (!venue) throw new Error(`Venue '${venueSlug}' was not found.`);

await rest(`/rpc/prepare_venue_test_service`, {
  method: "POST",
  headers,
  body: JSON.stringify({ p_venue_id: venue.id }),
});

const [{ products }, { mappedProducts }, { service }] = await Promise.all([
  restJson(`/market_products?venue_id=eq.${encodeURIComponent(venue.id)}&select=id`).then(rows => ({ products: rows.length })),
  restJson(`/market_products?venue_id=eq.${encodeURIComponent(venue.id)}&pos_product_id=like.test_pos_*&select=id`).then(rows => ({ mappedProducts: rows.length })),
  restJson(`/venue_test_services?venue_id=eq.${encodeURIComponent(venue.id)}&select=status`).then(rows => ({ service: rows[0]?.status })),
]);

if (products !== mappedProducts || !service) {
  throw new Error(`Prepared ${venue.name}, but only ${mappedProducts} of ${products} products have test POS mappings.`);
}

console.log(`Prepared ${venue.name}: ${mappedProducts} products mapped and test service is ${service}.`);

async function rest(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  return response;
}

async function restJson(path) {
  return (await rest(path, { headers })).json();
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#") && line.includes("="))
    .map(line => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }));
}

function isPlaceholder(value) {
  return ["", "your_service_role_key_here", "..."].includes(value ?? "");
}
