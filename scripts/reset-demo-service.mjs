import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env };
const venueSlug = env.NIGHT_ECONOMY_VENUE_SLUG ?? "demo-venue";
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || isPlaceholder(serviceRoleKey)) {
  throw new Error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY before resetting demo service data.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: fetchWithSecretKey },
});

const { data: venue, error: venueError } = await supabase
  .from("venues")
  .select("id, name")
  .eq("slug", venueSlug)
  .single();
throwIfError(venueError, "load venue");

const venueId = venue.id;
const [{ data: publications, error: publicationsError }, { data: marketProducts, error: marketError }, { data: posProducts, error: posError }] = await Promise.all([
  supabase.from("price_publications").select("id").eq("venue_id", venueId),
  supabase.from("market_products").select("id, base_price_minor").eq("venue_id", venueId),
  supabase.from("pos_products").select("id, base_price_minor").eq("venue_id", venueId),
]);
throwIfError(publicationsError, "load price publications");
throwIfError(marketError, "load market products");
throwIfError(posError, "load POS products");

const publicationIds = (publications ?? []).map(publication => publication.id);
if (publicationIds.length) {
  const { error } = await supabase.from("price_publication_lines").delete().in("publication_id", publicationIds);
  throwIfError(error, "delete price publication lines");
}

await Promise.all([
  removeRows("price_publications"),
  removeRows("market_price_snapshots"),
  removeRows("pos_sales_events"),
  ...resetPrices("market_products", marketProducts ?? []),
  ...resetPrices("pos_products", posProducts ?? []),
]);

console.log(`Reset ${venue.name}: ${marketProducts?.length ?? 0} market prices, ${posProducts?.length ?? 0} POS prices, and all demo service sales/publications.`);

async function removeRows(table) {
  const { error } = await supabase.from(table).delete().eq("venue_id", venueId);
  throwIfError(error, `delete ${table}`);
}

function resetPrices(table, products) {
  return products.map(async product => {
    const { error } = await supabase
      .from(table)
      .update({ current_price_minor: product.base_price_minor, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    throwIfError(error, `reset ${table} price`);
  });
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
