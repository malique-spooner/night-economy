import { execFileSync } from "node:child_process";

const minDimension = 2000;
const maxBytes = 5 * 1024 * 1024;
const apply = process.argv.includes("--apply");
const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) throw new Error("Missing Supabase service configuration.");

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

function storagePath(publicUrl) {
  const marker = "/object/public/market-logos/";
  const index = publicUrl.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(publicUrl.slice(index + marker.length));
}

function byteCount(size) {
  const match = /([\d.]+)\s*(B|KB|MB|GB)/i.exec(size);
  if (!match) return Number.NaN;
  const multiplier = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[match[2].toUpperCase()];
  return Number(match[1]) * multiplier;
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${url}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${endpoint}: ${await response.text()}`);
  return response;
}

const response = await request("/rest/v1/market_products?select=id,venue_id,display_name,logo_url&logo_url=not.is.null", { headers: { Accept: "application/json" } });
const products = await response.json();
const failing = [];

for (const product of products) {
  try {
    const data = execFileSync("curl", ["-fsSL", "--retry", "2", "--retry-all-errors", product.logo_url], { maxBuffer: maxBytes + 1024 });
    const [format, width, height, byteText] = execFileSync("magick", ["identify", "-format", "%m|%w|%h|%b", "-"], { input: data }).toString().split("|");
    const bytes = byteCount(byteText);
    const passes = format === "WEBP" && width === height && Number(width) >= minDimension && bytes <= maxBytes;
    if (!passes) failing.push({ ...product, format, width: Number(width), height: Number(height), bytes });
  } catch (error) {
    failing.push({ ...product, error: error instanceof Error ? error.message : String(error) });
  }
  await new Promise(resolve => setTimeout(resolve, 500));
}

console.table(failing.map(product => ({ venue: product.venue_id, drink: product.display_name, format: product.format ?? "unreadable", dimensions: product.width ? `${product.width}×${product.height}` : "—", size: product.bytes ? `${Math.round(product.bytes / 1024)} KB` : "—", error: product.error ?? "" })));
console.log(`${failing.length} of ${products.length} attached drink images fail the delivery standard.`);

if (apply) {
  for (const product of failing) {
    await request(`/rest/v1/market_products?id=eq.${product.id}&venue_id=eq.${product.venue_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo_url: null }),
    });
    const path = storagePath(product.logo_url);
    if (path) await request(`/storage/v1/object/market-logos/${path}`, { method: "DELETE" });
  }
  console.log(`Removed ${failing.length} non-compliant drink images.`);
}
