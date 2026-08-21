import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env };
const venueSlug = env.NIGHT_ECONOMY_VENUE_SLUG ?? "demo-venue";
const simulatorUrl = (env.POS_SIMULATOR_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || isPlaceholder(serviceRoleKey)) {
  throw new Error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY before verifying the live POS flow.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: fetchWithSecretKey },
});
const { data: venue, error: venueError } = await supabase.from("venues").select("id, name").eq("slug", venueSlug).single();
throwIfError(venueError, "load venue");

const [{ products: simulatorProducts }, { data: posProducts, error: posError }, { data: marketProducts, error: marketError }, { count: salesCount, error: salesError }, { count: snapshotCount, error: snapshotError }, { count: publicationCount, error: publicationError }] = await Promise.all([
  getJson(`${simulatorUrl}/v1/products`),
  supabase.from("pos_products").select("id, external_id, current_price_minor").eq("venue_id", venue.id).eq("is_current", true),
  supabase.from("market_products").select("id, pos_product_id, current_price_minor, floor_price_minor, ceiling_price_minor, is_live").eq("venue_id", venue.id).eq("is_live", true).not("pos_product_id", "is", null),
  supabase.from("pos_sales_events").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
  supabase.from("market_price_snapshots").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
  supabase.from("price_publications").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
]);
throwIfError(posError, "load POS products");
throwIfError(marketError, "load market products");
throwIfError(salesError, "count imported POS sales");
throwIfError(snapshotError, "count market snapshots");
throwIfError(publicationError, "count price publications");

const simulatorById = new Map(simulatorProducts.map(product => [product.id, product]));
const posById = new Map((posProducts ?? []).map(product => [product.id, product]));
const tradablePosProductIds = new Set((marketProducts ?? []).map(product => product.pos_product_id).filter(Boolean));
const tradablePosProducts = (posProducts ?? []).filter(product => tradablePosProductIds.has(product.id));
const posMismatches = tradablePosProducts.filter(product => simulatorProduct(product.external_id)?.currentPriceMinor !== product.current_price_minor);
const marketMismatches = (marketProducts ?? []).filter(product => {
  const posProduct = posById.get(product.pos_product_id);
  return !posProduct || posProduct.current_price_minor !== product.current_price_minor;
});
const rangeMismatches = (marketProducts ?? []).filter(product => product.current_price_minor < product.floor_price_minor || product.current_price_minor > product.ceiling_price_minor);

if (posMismatches.length || marketMismatches.length || rangeMismatches.length || !salesCount || !snapshotCount || !publicationCount) {
  const problems = [
    posMismatches.length ? `${posMismatches.length} simulator/POS price mismatch(es)` : "",
    marketMismatches.length ? `${marketMismatches.length} POS/market price mismatch(es)` : "",
    rangeMismatches.length ? `${rangeMismatches.length} market price(s) outside their limits` : "",
    !salesCount ? "no imported POS sales" : "",
    !snapshotCount ? "no market snapshots" : "",
    !publicationCount ? "no price publications" : "",
  ].filter(Boolean);
  throw new Error(`Live POS flow verification failed: ${problems.join("; ")}.`);
}

console.log(`Live POS flow verified for ${venue.name}.`);
console.log(`- ${tradablePosProducts.length} live POS products match the simulator`);
console.log(`- ${marketProducts?.length ?? 0} market products match their POS prices`);
console.log("- every market price remains within its configured floor and ceiling");
console.log(`- ${salesCount} imported sales, ${snapshotCount} market rounds, ${publicationCount} price publications`);

function simulatorProduct(externalId) {
  // The current import stores a stable database prefix before the POS's native
  // product ID. The simulator exposes that native ID, so compare on either
  // representation rather than reporting every valid product as a mismatch.
  const nativeIdStart = externalId.lastIndexOf("_pos_");
  return simulatorById.get(externalId) ?? simulatorById.get(nativeIdStart >= 0 ? externalId.slice(nativeIdStart + 1) : externalId);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Simulator request failed: ${response.status}`);
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

function isPlaceholder(value) {
  return ["", "your_service_role_key_here", "..."].includes(value ?? "");
}

function throwIfError(error, action) {
  if (error) throw new Error(`Could not ${action}: ${error.message}`);
}

function fetchWithSecretKey(input, init = {}, fetchImpl = fetch) {
  const headers = new Headers(init.headers);
  headers.delete("authorization");
  return fetchImpl(input, { ...init, headers });
}
