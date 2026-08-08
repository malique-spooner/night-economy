import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const venueId = "ven_showcase";
const maxOutputBytes = 5 * 1024 * 1024;
const sources = [
  ["show_cocktails_01", "Espresso Martini", "https://upload.wikimedia.org/wikipedia/commons/3/3e/Espresso_martini_-_November_2024_-_Sarah_Stierch.jpg"],
  ["show_cocktails_02", "Margarita", "https://upload.wikimedia.org/wikipedia/commons/1/1d/Margarita_de_lim%C3%B3n%2C_Mazatl%C3%A1n%2C_23_de_noviembre_de_2022_13.jpg"],
  ["show_cocktails_03", "Aperol Spritz", "https://upload.wikimedia.org/wikipedia/commons/8/88/Aperol_Spritz_%28Aperol_Spritz_Original_Bar%29_%2842171686322%29.jpg"],
  ["show_cocktails_04", "Old Fashioned", "https://upload.wikimedia.org/wikipedia/commons/6/65/Images_of_drinks_with_neutral_Background%3B_Old_Fashioned_%28cocktail%29%2C_Whisky.jpg"],
  ["show_cocktails_05", "Negroni", "https://upload.wikimedia.org/wikipedia/commons/2/22/Negroni_on_the_Rocks.jpg"],
  ["show_cocktails_06", "Mojito", "https://upload.wikimedia.org/wikipedia/commons/1/13/Fresh_Mojito_Premium.jpg"],
  ["show_cocktails_07", "Pornstar Martini", "https://upload.wikimedia.org/wikipedia/commons/a/ab/Porn_star_martini_cocktail.jpg"],
  ["show_cocktails_08", "Paloma", "https://upload.wikimedia.org/wikipedia/commons/f/fb/Paloma_Spritz_-_Purezza_2024-12-17.jpg"],
  ["show_cocktails_09", "Whiskey Sour", "https://upload.wikimedia.org/wikipedia/commons/6/65/Whiskey_Sour_im_Collegium_in_T%C3%BCbingen.jpg"],
  ["show_cocktails_10", "Daiquiri", "https://upload.wikimedia.org/wikipedia/commons/9/99/Szechuan_Daiquiri.jpg"],
  ["show_cocktails_11", "Hugo Spritz", "https://upload.wikimedia.org/wikipedia/commons/5/5f/Hugo_Cocktail_2013-08-03_20-24.jpg"],
  ["show_cocktails_12", "Bloody Mary", "https://upload.wikimedia.org/wikipedia/commons/6/63/Bloody_Mary_at_the_Town_Square_-_May_2024_-_Sarah_Stierch.jpg"],
  ["show_cocktails_13", "Cosmopolitan", "https://commons.wikimedia.org/wiki/Special:FilePath/Cosmopolitan_-_CrystalMixer.jpg?width=2560"],
  ["show_cocktails_14", "French 75", "https://images.weserv.nl/?url=upload.wikimedia.org/wikipedia/commons/0/0b/French_75.jpg&w=2560&output=jpg"],
];

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase service configuration.");

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const workspace = await mkdtemp(join(tmpdir(), "night-economy-showcase-images-"));

function objectPath(publicUrl) {
  const marker = "/object/public/market-logos/";
  const index = publicUrl?.indexOf(marker) ?? -1;
  return index === -1 ? null : decodeURIComponent(publicUrl.slice(index + marker.length));
}

async function request(endpoint, options) {
  const response = await fetch(`${url}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${endpoint}: ${await response.text()}`);
  return response;
}

try {
  const existing = await request(`/rest/v1/market_products?select=id,logo_url&id=in.(${sources.map(([id]) => id).join(",")})&venue_id=eq.${venueId}`, { headers: { Accept: "application/json" } });
  const previousImages = new Map((await existing.json()).map(product => [product.id, product.logo_url]));
  const selectedSources = process.argv.includes("--only-missing")
    ? sources.filter(([id]) => !previousImages.get(id))
    : sources;

  for (const [id, name, sourceUrl] of selectedSources) {
    const original = join(workspace, `${id}.source`);
    const output = join(workspace, `${id}.webp`);
    execFileSync("curl", ["-fL", "--retry", "2", "-A", "NightEconomyImageCuration/1.0", sourceUrl, "-o", original], { stdio: "inherit" });
    execFileSync("magick", [original, "-auto-orient", "-resize", "2560x2560^", "-gravity", "center", "-extent", "2560x2560", "-quality", "88", output]);
    const outputSize = (await stat(output)).size;
    if (outputSize > maxOutputBytes) throw new Error(`${name} output is ${(outputSize / 1024 / 1024).toFixed(1)} MB; expected under 5 MB.`);

    const path = `${venueId}/${id}/${crypto.randomUUID()}.webp`;
    await request(`/storage/v1/object/market-logos/${path}`, {
      method: "POST",
      headers: { "Content-Type": "image/webp", "cache-control": "31536000", "x-upsert": "false" },
      body: await readFile(output),
    });

    const publicUrl = `${url}/storage/v1/object/public/market-logos/${path}`;
    await request(`/rest/v1/market_products?id=eq.${id}&venue_id=eq.${venueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ logo_url: publicUrl }),
    });

    const oldPath = objectPath(previousImages.get(id));
    if (oldPath) await request(`/storage/v1/object/market-logos/${oldPath}`, { method: "DELETE" });
    console.log(`Updated ${name}: ${(outputSize / 1024).toFixed(0)} KB WebP`);
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
