import type { MarketProduct, Venue } from "../../engine/types";
import type { MarketProductPatch, PosProduct, VenueMarketSettingsPatch } from "../../api/market";
import type { VenueMemberRole } from "../../api/memberships";
import { categoryLabel, groupProductsByCategory, TV_CATEGORY_PAGE_LIMIT } from "../tv/tvHelpers";

export { TV_CATEGORY_PAGE_LIMIT };
export const PRIORITY_DRINKS_PER_CATEGORY_LIMIT = 3;
export const TV_DRINK_NAME_MAX_LENGTH = 28;

export function portalCategories(products: MarketProduct[]) { return groupProductsByCategory(products).map(([category]) => category); }
export function portalCategoryOptions(products: MarketProduct[], currentCategory: string) { return [...new Set([...portalCategories(products), currentCategory].filter(Boolean))]; }
export function portalCategoryLabel(category: string) { return categoryLabel(category); }
export function formatInputMoney(valueMinor: number) { return (valueMinor / 100).toFixed(2); }
export function hasConfiguredCategory(category: string | null | undefined) {
  const normalized = category?.trim() ?? "";
  return Boolean(normalized) && !["uncategorized", "uncategorised"].includes(normalized.toLowerCase());
}

export function prepareMarketProductConfiguration({ id, posProduct, products }: { id: string; posProduct: PosProduct; products: MarketProduct[] }): MarketProduct {
  if (!hasConfiguredCategory(posProduct.category)) throw new Error("Add a category in the POS before setting up this drink");
  const currentPriceMinor = posProduct.currentPriceMinor;
  return { id, posProductId: posProduct.id, symbol: nextMarketSymbol(posProduct.name, products), name: posProduct.name, category: posProduct.category.trim(), basePriceMinor: posProduct.basePriceMinor, currentPriceMinor, floorPriceMinor: Math.round(currentPriceMinor * 0.65), ceilingPriceMinor: Math.round(currentPriceMinor * 1.65), salesVelocity: 0, isLive: false, isSoldOut: !posProduct.isAvailable, priority: false };
}

export function normalizeMarketProductPatch(product: MarketProduct, patch: MarketProductPatch): MarketProductPatch {
  const requestedFloor = patch.floorPriceMinor ?? product.floorPriceMinor;
  const requestedCeiling = patch.ceilingPriceMinor ?? product.ceilingPriceMinor;
  const floorPriceMinor = Math.min(Math.max(0, requestedFloor), product.currentPriceMinor);
  const ceilingPriceMinor = Math.max(floorPriceMinor, requestedCeiling, product.currentPriceMinor);
  return { ...patch, ...(patch.floorPriceMinor !== undefined || patch.ceilingPriceMinor !== undefined ? { floorPriceMinor, ceilingPriceMinor } : {}), ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, TV_DRINK_NAME_MAX_LENGTH) || product.name } : {}), ...(patch.symbol !== undefined ? { symbol: patch.symbol.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || product.symbol } : {}) };
}

export function applyMarketProductPatch(products: MarketProduct[], productId: string, patch: MarketProductPatch): MarketProduct[] {
  return products.map(product => {
    if (product.id !== productId) return product;
    const { logoUrl, ...patchWithoutLogo } = patch;
    if (logoUrl === null) {
      const { logoUrl: _removedLogo, ...productWithoutLogo } = product;
      return { ...productWithoutLogo, ...patchWithoutLogo };
    }
    return { ...product, ...patchWithoutLogo, ...(logoUrl !== undefined ? { logoUrl } : {}) };
  });
}
export function wouldNeedAnotherTvPage(products: MarketProduct[], product: MarketProduct, patch: MarketProductPatch) {
  const nextCategory = patch.category ?? product.category;
  const willBeLive = patch.isLive ?? product.isLive;
  const willBeArchived = patch.isArchived ?? product.isArchived ?? false;
  const alreadyOccupiesThisCategory = product.isLive && !product.isArchived && product.category === nextCategory;
  if (!willBeLive || willBeArchived || alreadyOccupiesThisCategory) return false;
  const otherLiveProducts = products.filter(candidate => candidate.id !== product.id && candidate.category === nextCategory && candidate.isLive && !candidate.isArchived).length;
  return otherLiveProducts >= TV_CATEGORY_PAGE_LIMIT;
}
export function wouldExceedPriorityLimit(products: MarketProduct[], product: MarketProduct, patch: MarketProductPatch) {
  const nextCategory = patch.category ?? product.category;
  const willBePriority = patch.priority ?? product.priority;
  const willBeLive = patch.isLive ?? product.isLive;
  if (!willBePriority || !willBeLive || product.isSoldOut) return false;
  const otherPriorityProducts = products.filter(candidate => candidate.id !== product.id && candidate.category === nextCategory && candidate.priority && candidate.isLive && !candidate.isSoldOut).length;
  return otherPriorityProducts >= PRIORITY_DRINKS_PER_CATEGORY_LIMIT;
}
export function applyVenueSettingsPatch(venue: Venue, patch: VenueMarketSettingsPatch): Venue { return { ...venue, ...patch }; }
export function canEditMarketProducts({ isSignedIn, role, source }: { isSignedIn: boolean; role: VenueMemberRole | null; source: "seed" | "supabase" }) { return source === "seed" || (isSignedIn && role !== null); }
export function canManageVenueSettings({ role, source }: { role: VenueMemberRole | null; source: "seed" | "supabase" }) { return source === "seed" || role === "owner" || role === "admin"; }
export function venueSettingsAccessMessage({ role, source }: { role: VenueMemberRole | null; source: "seed" | "supabase" }) { if (source === "seed") return "Demo launch settings"; if (role === "owner" || role === "admin") return "Launch settings can be saved"; if (role === "staff") return "Owner or admin access required"; return "Sign in as an owner or admin"; }
export function portalAccessMessage({ isSignedIn, isCheckingAccess, role, source }: { isSignedIn: boolean; isCheckingAccess: boolean; role: VenueMemberRole | null; source: "seed" | "supabase" }) { if (source === "seed") return "Demo changes stay local"; if (!isSignedIn) return "Sign in to save changes"; if (isCheckingAccess) return "Checking venue access"; if (!role) return "No access to this venue"; return `Can configure as ${role}`; }

function nextMarketSymbol(name: string, products: MarketProduct[]) {
  const initials = name.trim().split(/\s+/).map(word => word[0]).join("").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const compact = name.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
  const base = (initials || compact || "NE").slice(0, 4);
  const used = new Set(products.map(product => product.symbol.toUpperCase()));
  if (!used.has(base)) return base;
  for (let index = 2; index < 100; index += 1) { const suffix = String(index); const candidate = `${base.slice(0, Math.max(1, 4 - suffix.length))}${suffix}`; if (!used.has(candidate)) return candidate; }
  return `${base.slice(0, 2)}${products.length + 1}`;
}
