import { seedProducts, seedVenue } from "../demo/marketSeed";
import type { CrashIntervalMinutes, MarketProduct, Venue, VenueMarketSettings, MarketScheduleEntry } from "../engine/types";
import { defaultVenueMarketSettings, isCrashIntervalMinutes, normalizeMarketCrashSettings, normalizeTimeInput } from "../engine/venueSettings";
import { supabase } from "./client";

export type MarketState = {
  venue: Venue;
  products: MarketProduct[];
  crash: MarketCrashEvent | null;
  source: "seed" | "supabase";
};

export type MarketCrashEvent = { id: string; category: string; createdAt: string; startMinute?: number };

export type MarketProductPatch = Partial<
  Pick<
    MarketProduct,
    | "name"
    | "symbol"
    | "posProductId"
    | "isArchived"
    | "category"
    | "floorPriceMinor"
    | "ceilingPriceMinor"
    | "isLive"
    | "priority"
  >
> & { logoUrl?: string | null };

export type VenueMarketSettingsPatch = Partial<VenueMarketSettings>;

export type MarketProductConfiguration = MarketProduct;

export type MarketPriceHistoryPoint = {
  at: string;
  oldPriceMinor: number;
  priceMinor: number;
  movement: "up" | "down" | "hold";
};

export type MarketRoundSignal = {
  createdAt: string;
  roundEnd: string;
  runId: string | null;
};

export type PosProduct = {
  id: string;
  externalId: string;
  sku: string;
  name: string;
  basePriceMinor: number;
  currentPriceMinor: number;
  currency: string;
  isAvailable: boolean;
  isCurrent?: boolean;
  category: string;
  subcategory: string;
  productGroup?: string;
  serveSize?: string;
};

export type VenueRow = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  market_live?: boolean | null;
  tv_story_categories?: unknown;
  market_schedule?: unknown;
  crash_interval_minutes?: number | null;
  crash_settings?: unknown;
  launch_date?: string | null;
  launch_start_time?: string | null;
  launch_end_time?: string | null;
};

export type MarketProductRow = {
  id: string;
  pos_product_id?: string | null;
  market_symbol: string;
  logo_url?: string | null;
  display_name: string;
  category: string;
  base_price_minor: number;
  current_price_minor: number;
  floor_price_minor: number;
  ceiling_price_minor: number;
  sales_velocity?: number | null;
  is_live: boolean;
  is_sold_out: boolean;
  priority: boolean;
  is_archived?: boolean | null;
};

type VenueMarketStateRow = VenueRow & {
  market_products?: MarketProductRow[] | null;
};

type PosProductRow = {
  id: string;
  external_id: string;
  sku: string;
  source_name: string;
  base_price_minor: number;
  current_price_minor: number;
  currency: string;
  is_available: boolean;
  is_current: boolean;
  category?: string | null;
  subcategory?: string | null;
  product_group?: string | null;
  serve_size?: string | null;
};

export type MarketPriceSnapshotRow = {
  id?: string;
  reason?: string;
  run_id?: string | null;
  created_at: string;
  snapshot: unknown;
};

type SupabaseQueryError = {
  message?: string;
};

export function mapVenueRow(row: VenueRow): Venue {
  const defaults = defaultVenueMarketSettings();
  const crashIntervalMinutes = isCrashIntervalMinutes(row.crash_interval_minutes)
    ? row.crash_interval_minutes
    : defaults.crashIntervalMinutes;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    currency: row.currency,
    timezone: row.timezone,
    marketLive: row.market_live ?? defaults.marketLive,
    tvStoryCategories: parseTvStoryCategories(row.tv_story_categories, defaults.tvStoryCategories),
    marketSchedule: Array.isArray(row.market_schedule) ? row.market_schedule as MarketScheduleEntry[] : defaults.marketSchedule,
    crashIntervalMinutes,
    crashSettings: normalizeMarketCrashSettings(row.crash_settings),
    launchDate: row.launch_date ?? defaults.launchDate,
    launchStartTime: normalizeTimeInput(row.launch_start_time, defaults.launchStartTime),
    launchEndTime: normalizeTimeInput(row.launch_end_time, defaults.launchEndTime),
  };
}

export function mapMarketProductRow(row: MarketProductRow): MarketProduct {
  return {
    id: row.id,
    ...(row.pos_product_id ? { posProductId: row.pos_product_id } : {}),
    ...(row.is_archived ? { isArchived: true } : {}),
    symbol: row.market_symbol,
    ...(row.logo_url ? { logoUrl: row.logo_url } : {}),
    name: row.display_name,
    category: row.category,
    basePriceMinor: row.base_price_minor,
    currentPriceMinor: row.current_price_minor,
    floorPriceMinor: row.floor_price_minor,
    ceilingPriceMinor: row.ceiling_price_minor,
    salesVelocity: row.sales_velocity ?? 4,
    isLive: row.is_live,
    isSoldOut: row.is_sold_out,
    priority: row.priority,
  };
}

function mapPosProductRow(row: PosProductRow): PosProduct {
  return {
    id: row.id,
    externalId: row.external_id,
    sku: row.sku,
    name: row.source_name,
    basePriceMinor: row.base_price_minor,
    currentPriceMinor: row.current_price_minor,
    currency: row.currency,
    isAvailable: row.is_available,
    isCurrent: row.is_current,
    category: row.category?.trim() ?? "",
    subcategory: row.subcategory ?? "",
    ...(row.product_group ? { productGroup: row.product_group } : {}),
    ...(row.serve_size ? { serveSize: row.serve_size } : {}),
  };
}

export function throwIfSupabaseQueryError(error: SupabaseQueryError | null | undefined, fallbackMessage: string) {
  if (!error) return;

  throw new Error(error.message ? `${fallbackMessage}: ${error.message}` : fallbackMessage);
}

export function requireVenue<T extends VenueRow>(row: T | null): T {
  if (!row) throw new Error("This venue is no longer available.");
  return row;
}

export async function getMarketState(venueSlug: string): Promise<MarketState> {
  if (!supabase) return { venue: seedVenue, products: demoMarketProducts(), crash: null, source: "seed" };

  const { data: venue, error: venueError } = await supabase.from("venues").select("*, market_products(*)").eq("slug", venueSlug).maybeSingle();
  throwIfSupabaseQueryError(venueError, "Could not load venue");

  const existingVenue = requireVenue(venue as VenueMarketStateRow | null);
  const { data: crashSnapshots, error: crashError } = await supabase
    .from("market_price_snapshots")
    .select("id, created_at, snapshot")
    .eq("venue_id", existingVenue.id)
    .eq("reason", "market_crash")
    .order("created_at", { ascending: false })
    .limit(1);
  throwIfSupabaseQueryError(crashError, "Could not load latest market crash");
  const products = [...(existingVenue.market_products ?? [])]
    .sort((left, right) => left.display_name.localeCompare(right.display_name));

  return {
    venue: mapVenueRow(existingVenue),
    products: products.map(mapMarketProductRow),
    crash: mapMarketCrashSnapshot(crashSnapshots?.[0] as MarketPriceSnapshotRow | undefined),
    source: "supabase",
  };
}

function mapMarketCrashSnapshot(row: MarketPriceSnapshotRow | undefined): MarketCrashEvent | null {
  if (!row || !row.id || !isRecord(row.snapshot) || !isRecord(row.snapshot.crash) || typeof row.snapshot.crash.category !== "string") return null;
  const startMinute = typeof row.snapshot.crash.startMinute === "number" ? row.snapshot.crash.startMinute : undefined;
  const runId = typeof row.snapshot.runId === "string" ? row.snapshot.runId : row.created_at.slice(0, 10);
  // A ten-minute crash has two five-minute price rounds but one TV moment.
  return { id: startMinute === undefined ? row.id : `${runId}:${startMinute}:${row.snapshot.crash.category}`, category: row.snapshot.crash.category, createdAt: row.created_at, ...(startMinute === undefined ? {} : { startMinute }) };
}

export async function getPosProducts(venueId: string): Promise<PosProduct[]> {
  if (!supabase) return demoPosProducts();

  const { data, error } = await supabase
    .from("pos_products")
    .select("*")
    .eq("venue_id", venueId)
    .order("source_name");
  throwIfSupabaseQueryError(error, "Could not load POS products");
  return (data ?? []).map(mapPosProductRow);
}

/** Returns the actual completed market rounds for one product, oldest first. */
export async function getMarketProductPriceHistory(venueId: string, productId: string, activeRunId?: string): Promise<MarketPriceHistoryPoint[]> {
  if (!supabase) return [];

  let query = supabase
    .from("market_price_snapshots")
    .select("run_id, created_at, snapshot")
    .eq("venue_id", venueId);
  if (activeRunId) query = query.eq("run_id", activeRunId);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(200);
  throwIfSupabaseQueryError(error, "Could not load price history");

  const rows = (data ?? []) as MarketPriceSnapshotRow[];
  const runRows = selectMarketHistoryRun(rows, activeRunId);
  const points = runRows
    .reverse()
    .map(row => mapMarketPriceSnapshotRow(row as MarketPriceSnapshotRow, productId))
    .filter((point): point is MarketPriceHistoryPoint => point !== null);

  // A retried market cycle can write the same five-minute round twice. The TV
  // still renders one point and one activity bar for that period.
  return [...new Map(points.map(point => [point.at, point])).values()];
}

export function selectMarketHistoryRun(rows: MarketPriceSnapshotRow[], activeRunId?: string) {
  if (activeRunId) return rows.filter(row => row.run_id === activeRunId);
  const latestRunId = rows.find(row => row.run_id)?.run_id ?? null;
  return latestRunId ? rows.filter(row => row.run_id === latestRunId) : rows.slice(0, 72);
}

/** Latest completed round, used as the TV's single presentation clock. */
export async function getLatestMarketRound(venueId: string): Promise<MarketRoundSignal | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("market_price_snapshots")
    .select("run_id, created_at, snapshot")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfSupabaseQueryError(error, "Could not load the latest market round");
  if (!data) return null;
  return mapMarketRoundSnapshotRow(data as MarketPriceSnapshotRow);
}

export function mapMarketRoundSnapshotRow(row: MarketPriceSnapshotRow): MarketRoundSignal | null {
  if (!isRecord(row.snapshot) || typeof row.snapshot.roundEnd !== "string") return null;
  return { createdAt: row.created_at, roundEnd: row.snapshot.roundEnd, runId: row.run_id ?? null };
}

export function mapMarketPriceSnapshotRow(
  row: MarketPriceSnapshotRow,
  productId: string,
): MarketPriceHistoryPoint | null {
  if (!isRecord(row.snapshot) || !Array.isArray(row.snapshot.decisions)) return null;

  const decision = row.snapshot.decisions.find(item => isRecord(item) && item.productId === productId);
  if (!isRecord(decision) || !isPriceDecision(decision)) return null;

  return {
    at: typeof row.snapshot.roundEnd === "string" ? row.snapshot.roundEnd : row.created_at,
    oldPriceMinor: decision.oldPriceMinor,
    priceMinor: decision.newPriceMinor,
    movement: decision.movement,
  };
}

export async function updateMarketProduct(productId: string, patch: MarketProductPatch) {
  if (!supabase) return { persisted: false as const };

  const rowPatch = toMarketProductRowPatch(patch);
  if (!Object.keys(rowPatch).length) return { persisted: true as const };

  const { error } = await supabase.from("market_products").update(rowPatch).eq("id", productId).select("id").single();
  if (error) throw error;

  return { persisted: true as const };
}

export async function uploadMarketProductLogo(venueId: string, productId: string, file: File) {
  if (!supabase) throw new Error("Image uploads need Supabase to be connected.");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose an image smaller than 12 MB.");

  const prepared = await prepareDrinkImage(file);
  const path = `${venueId}/${productId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("market-logos").upload(path, prepared.file, { cacheControl: "31536000", contentType: "image/webp", upsert: false });
  if (error) throw error;
  return { url: supabase.storage.from("market-logos").getPublicUrl(path).data.publicUrl, warning: prepared.warning };
}

export async function removeMarketProductLogo(url: string) {
  if (!supabase) return;
  const marker = "/object/public/market-logos/";
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  const { error } = await supabase.storage.from("market-logos").remove([path]);
  if (error) throw error;
}

export async function createMarketProductConfiguration(venueId: string, product: MarketProductConfiguration) {
  if (!supabase) return { persisted: false as const, product };

  const { data, error } = await supabase
    .from("market_products")
    .insert(toMarketProductInsertRow(venueId, product))
    .select("*")
    .single();
  if (error) throw error;

  return { persisted: true as const, product: mapMarketProductRow(data) };
}

export async function updateVenueMarketSettings(venueId: string, patch: VenueMarketSettingsPatch) {
  if (!supabase) return { persisted: false as const };

  const rowPatch = toVenueMarketSettingsRowPatch(patch);
  if (!Object.keys(rowPatch).length) return { persisted: true as const };

  const { error } = await supabase.from("venues").update(rowPatch).eq("id", venueId).select("id").single();
  if (error) throw error;

  return { persisted: true as const };
}

export function toMarketProductRowPatch(patch: MarketProductPatch) {
  const rowPatch = {
    ...(patch.name !== undefined ? { display_name: patch.name } : {}),
    ...(patch.symbol !== undefined ? { market_symbol: patch.symbol } : {}),
    ...(patch.logoUrl !== undefined ? { logo_url: patch.logoUrl } : {}),
    ...(patch.posProductId !== undefined ? { pos_product_id: patch.posProductId } : {}),
    ...(patch.isArchived !== undefined ? { is_archived: patch.isArchived } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.floorPriceMinor !== undefined ? { floor_price_minor: patch.floorPriceMinor } : {}),
    ...(patch.ceilingPriceMinor !== undefined ? { ceiling_price_minor: patch.ceilingPriceMinor } : {}),
    ...(patch.isLive !== undefined ? { is_live: patch.isLive } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
  };

  return withUpdatedAt(rowPatch);
}

function toMarketProductInsertRow(venueId: string, product: MarketProductConfiguration) {
  return {
    id: product.id,
    venue_id: venueId,
    ...(product.posProductId ? { pos_product_id: product.posProductId } : {}),
    market_symbol: product.symbol,
    display_name: product.name,
    category: product.category,
    base_price_minor: product.basePriceMinor,
    current_price_minor: product.currentPriceMinor,
    floor_price_minor: product.floorPriceMinor,
    ceiling_price_minor: product.ceilingPriceMinor,
    sales_velocity: product.salesVelocity,
    is_live: product.isLive,
    is_sold_out: product.isSoldOut,
    priority: product.priority,
  };
}

function demoPosProducts(): PosProduct[] {
  return seedProducts.map(product => ({
    id: `pos_${product.id}`,
    externalId: `pos_${product.symbol.toLowerCase()}`,
    sku: product.symbol,
    name: product.name,
    basePriceMinor: product.basePriceMinor,
    currentPriceMinor: product.currentPriceMinor,
    currency: seedVenue.currency,
    isAvailable: !product.isSoldOut,
    isCurrent: true,
    category: product.category,
    subcategory: "",
  }));
}

async function prepareDrinkImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const outputSize = Math.min(2560, Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");

  const cropSize = Math.min(bitmap.width, bitmap.height);
  context.drawImage(bitmap, (bitmap.width - cropSize) / 2, (bitmap.height - cropSize) / 2, cropSize, cropSize, 0, 0, outputSize, outputSize);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("Could not compress this image.");
  if (blob.size > 5 * 1024 * 1024) throw new Error("This image is still too large after optimisation. Choose a simpler image.");
  return {
    file: new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }),
    warning: sourceSize < 2000 ? "This source is below 2000px and may look soft on a large TV." : null,
  };
}

function demoMarketProducts(): MarketProduct[] {
  return seedProducts.map(product => ({ ...product, posProductId: `pos_${product.id}` }));
}

export function toVenueMarketSettingsRowPatch(patch: VenueMarketSettingsPatch) {
  const rowPatch = {
    ...(patch.marketLive !== undefined ? { market_live: patch.marketLive } : {}),
    ...(patch.tvStoryCategories !== undefined ? { tv_story_categories: patch.tvStoryCategories } : {}),
    ...(patch.crashIntervalMinutes !== undefined
      ? { crash_interval_minutes: patch.crashIntervalMinutes as CrashIntervalMinutes }
      : {}),
    ...(patch.crashSettings !== undefined ? { crash_settings: patch.crashSettings } : {}),
    ...(patch.marketSchedule !== undefined ? { market_schedule: patch.marketSchedule } : {}),
    ...(patch.launchDate !== undefined ? { launch_date: patch.launchDate } : {}),
    ...(patch.launchStartTime !== undefined ? { launch_start_time: patch.launchStartTime } : {}),
    ...(patch.launchEndTime !== undefined ? { launch_end_time: patch.launchEndTime } : {}),
  };

  return withUpdatedAt(rowPatch);
}

function withUpdatedAt<T extends Record<string, unknown>>(rowPatch: T) {
  if (!Object.keys(rowPatch).length) return rowPatch;

  return {
    ...rowPatch,
    updated_at: new Date().toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTvStoryCategories(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const categories = value.filter((category): category is string => typeof category === "string").map(category => category.trim()).filter(Boolean);
  return categories.length ? [...new Set(categories)] : fallback;
}

function isPriceDecision(value: Record<string, unknown>): value is {
  productId: string;
  oldPriceMinor: number;
  newPriceMinor: number;
  movement: "up" | "down" | "hold";
} {
  return typeof value.productId === "string"
    && typeof value.oldPriceMinor === "number"
    && typeof value.newPriceMinor === "number"
    && (value.movement === "up" || value.movement === "down" || value.movement === "hold");
}
