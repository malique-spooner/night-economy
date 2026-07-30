import { existsSync, readFileSync } from "node:fs";

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env };
const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/$/, "");
const serverKey = env.SUPABASE_SERVICE_ROLE_KEY;
const schedulerSecret = env.SCHEDULER_SECRET;
const venueSlug = env.NIGHT_ECONOMY_VENUE_SLUG?.trim() || "demo-venue";

if (!supabaseUrl || !serverKey || !schedulerSecret) {
  throw new Error("Set the Supabase URL, SUPABASE_SERVICE_ROLE_KEY, and SCHEDULER_SECRET before checking cloud sync.");
}

const headers = { apikey: serverKey, "content-type": "application/json" };
const venues = await restJson(`/venues?slug=eq.${encodeURIComponent(venueSlug)}&select=id,name,slug,timezone,market_live,market_schedule`);
const venue = venues[0];
if (!venue) throw new Error(`Venue '${venueSlug}' was not found.`);

const [services, runs, marketProducts, posProducts] = await Promise.all([
  restJson(`/venue_test_services?venue_id=eq.${encodeURIComponent(venue.id)}&select=status,simulated_minute,speed,last_tick_at,scheduled_slot_key,active_run_id,target_revenue_minor`),
  restJson(`/market_runs?venue_id=eq.${encodeURIComponent(venue.id)}&select=id,status,kind&limit=1`),
  restJson(`/market_products?venue_id=eq.${encodeURIComponent(venue.id)}&pos_product_id=not.is.null&select=id,pos_product_id,current_price_minor`),
  restJson(`/pos_products?venue_id=eq.${encodeURIComponent(venue.id)}&select=id,current_price_minor`),
]);

const service = services[0];
if (!service) throw new Error(`Venue '${venueSlug}' has not been prepared for the cloud simulator.`);

const posPriceById = new Map(posProducts.map(product => [product.id, product.current_price_minor]));
const mismatches = marketProducts.filter(product => posPriceById.get(product.pos_product_id) !== product.current_price_minor);

const summary = await invoke("venue-simulator", {
  venueSlug,
  action: "summary",
});
if (!summary.service) throw new Error("The deployed venue-simulator did not return service state.");

const schedulerStatus = await checkFunction("service-scheduler");

if (mismatches.length) {
  throw new Error(`${mismatches.length} mapped market price(s) are not synchronized to their POS product.`);
}

console.log("Cloud sync verification passed.");
console.log(`- venue: ${venue.name} (${venue.slug}, ${venue.timezone})`);
console.log(`- service: ${service.status} at minute ${service.simulated_minute}, speed ${service.speed}x`);
console.log(`- scheduler: deployed (read-only probe returned ${schedulerStatus})`);
console.log(`- mapped prices: ${marketProducts.length} synchronized`);
console.log(`- run history: ${runs.length ? "available" : "ready"}`);

async function invoke(functionName, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: { ...headers, "x-night-economy-scheduler-secret": schedulerSecret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${functionName} failed: ${response.status} ${result?.error ?? "Unknown error"}`);
  return result;
}

async function checkFunction(functionName) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "GET",
    headers: { apikey: serverKey },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) throw new Error(`${functionName} is not deployed.`);
  return response.status;
}

async function restJson(path) {
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, { headers, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Supabase schema check failed: ${response.status} ${await response.text()}`);
  return response.json();
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
