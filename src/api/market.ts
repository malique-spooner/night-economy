import { seedProducts, seedVenue } from "../demo/marketSeed";
import type { CrashIntervalMinutes, MarketProduct, Venue, VenueMarketSettings, MarketScheduleEntry } from "../engine/types";
import { defaultVenueMarketSettings, isCrashIntervalMinutes, normalizeTimeInput } from "../engine/venueSettings";
import { supabase } from "./client";

export type MarketState = {
  venue: Venue;
  products: MarketProduct[];
  source: "seed" | "supabase";
};

export type MarketProductPatch = Partial<
  Pick<
    MarketProduct,
    | "name"
    | "symbol"
    | "category"
    | "floorPriceMinor"
    | "ceilingPriceMinor"
    | "isLive"
    | "priority"
  >
>;

export type VenueMarketSettingsPatch = Partial<VenueMarketSettings>;

export type MarketProductConfiguration = MarketProduct;

export type MarketPriceHistoryPoint = {
  at: string;
  oldPriceMinor: number;
  priceMinor: number;
  movement: "up" | "down" | "hold";
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
  market_schedule?: unknown;
  crash_interval_minutes?: number | null;
  launch_date?: string | null;
  launch_start_time?: string | null;
  launch_end_time?: string | null;
};

export type MarketProductRow = {
  id: string;
  pos_product_id?: string | null;
  market_symbol: string;
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
  category?: string | null;
  subcategory?: string | null;
  product_group?: string | null;
  serve_size?: string | null;
};

export type MarketPriceSnapshotRow = {
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
    marketSchedule: Array.isArray(row.market_schedule) ? row.market_schedule as MarketScheduleEntry[] : defaults.marketSchedule,
    crashIntervalMinutes,
    launchDate: row.launch_date ?? defaults.launchDate,
    launchStartTime: normalizeTimeInput(row.launch_start_time, defaults.launchStartTime),
    launchEndTime: normalizeTimeInput(row.launch_end_time, defaults.launchEndTime),
  };
}

export function mapMarketProductRow(row: MarketProductRow): MarketProduct {
  return {
    id: row.id,
    ...(row.pos_product_id ? { posProductId: row.pos_product_id } : {}),
    symbol: row.market_symbol,
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

export function mapPosProductRow(row: PosProductRow): PosProduct {
  return {
    id: row.id,
    externalId: row.external_id,
    sku: row.sku,
    name: row.source_name,
    basePriceMinor: row.base_price_minor,
    currentPriceMinor: row.current_price_minor,
    currency: row.currency,
    isAvailable: row.is_available,
    category: row.category ?? "Uncategorised",
    subcategory: row.subcategory ?? "",
    ...(row.product_group ? { productGroup: row.product_group } : {}),
    ...(row.serve_size ? { serveSize: row.serve_size } : {}),
  };
}

export function throwIfSupabaseQueryError(error: SupabaseQueryError | null | undefined, fallbackMessage: string) {
  if (!error) return;

  throw new Error(error.message ? `${fallbackMessage}: ${error.message}` : fallbackMessage);
}

export async function getMarketState(venueSlug: string): Promise<MarketState> {
  if (!supabase) return { venue: seedVenue, products: demoMarketProducts(), source: "seed" };

  const { data: venue, error: venueError } = await supabase.from("venues").select("*").eq("slug", venueSlug).maybeSingle();
  throwIfSupabaseQueryError(venueError, "Could not load venue");

  if (!venue) return { venue: seedVenue, products: demoMarketProducts(), source: "seed" };

  const { data: products, error: productsError } = await supabase
    .from("market_products")
    .select("*")
    .eq("venue_id", venue.id)
    .order("display_name");
  throwIfSupabaseQueryError(productsError, "Could not load market products");

  return {
    venue: mapVenueRow(venue),
    products: (products ?? []).map(mapMarketProductRow),
    source: "supabase",
  };
}

export async function getPosProducts(venueId: string): Promise<PosProduct[]> {
  if (!supabase) return demoPosProducts();

  const { data, error } = await supabase
    .from("pos_products")
    .select("*")
    .eq("venue_id", venueId)
    .eq("is_current", true)
    .order("source_name");
  throwIfSupabaseQueryError(error, "Could not load POS products");
  return (data ?? []).map(mapPosProductRow);
}

/** Returns the actual completed market rounds for one product, oldest first. */
export async function getMarketProductPriceHistory(venueId: string, productId: string): Promise<MarketPriceHistoryPoint[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("market_price_snapshots")
    .select("created_at, snapshot")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });
  throwIfSupabaseQueryError(error, "Could not load price history");

  return (data ?? [])
    .map(row => mapMarketPriceSnapshotRow(row as MarketPriceSnapshotRow, productId))
    .filter((point): point is MarketPriceHistoryPoint => point !== null);
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

  const { error } = await supabase.from("market_products").update(rowPatch).eq("id", productId);
  if (error) throw error;

  return { persisted: true as const };
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

  const { error } = await supabase.from("venues").update(rowPatch).eq("id", venueId);
  if (error) throw error;

  return { persisted: true as const };
}

export function toMarketProductRowPatch(patch: MarketProductPatch) {
  const rowPatch = {
    ...(patch.name !== undefined ? { display_name: patch.name } : {}),
    ...(patch.symbol !== undefined ? { market_symbol: patch.symbol } : {}),
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
    category: product.category,
    subcategory: "",
  }));
}

function demoMarketProducts(): MarketProduct[] {
  return seedProducts.map(product => ({ ...product, posProductId: `pos_${product.id}` }));
}

export function toVenueMarketSettingsRowPatch(patch: VenueMarketSettingsPatch) {
  const rowPatch = {
    ...(patch.marketLive !== undefined ? { market_live: patch.marketLive } : {}),
    ...(patch.crashIntervalMinutes !== undefined
      ? { crash_interval_minutes: patch.crashIntervalMinutes as CrashIntervalMinutes }
      : {}),
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
