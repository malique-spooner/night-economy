import type { MarketProduct, Venue } from "../../engine/types";

export type ProductTrend = "up" | "dn";

// One TV view is intentionally capped at twelve distinct drinks: three
// featured cards plus nine rows. Keeping this shared makes the Portal's
// paging warning match what guests see on screen.
export const TV_CATEGORY_PAGE_LIMIT = 12;
export const TV_FEATURED_PRODUCTS_PER_CATEGORY = 3;

const defaultDrinkArtwork = {
  beer: "/images/default-drink-art/beer.webp",
  cocktails: "/images/default-drink-art/cocktails.webp",
  spirits: "/images/default-drink-art/spirits.webp",
  wine: "/images/default-drink-art/wine.webp",
} as const;

/** The venue's category photography fills in whenever an individual drink has no image. */
export function defaultDrinkImage(category: string) {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("beer")) return defaultDrinkArtwork.beer;
  if (normalized.includes("spirit")) return defaultDrinkArtwork.spirits;
  if (normalized.includes("wine")) return defaultDrinkArtwork.wine;
  return defaultDrinkArtwork.cocktails;
}

export function productTrend(product: MarketProduct): ProductTrend {
  return product.currentPriceMinor >= product.basePriceMinor ? "up" : "dn";
}

export function productChangePercent(product: MarketProduct) {
  if (!product.basePriceMinor) return 0;
  return ((product.currentPriceMinor - product.basePriceMinor) / product.basePriceMinor) * 100;
}

export function formatChangePercent(product: MarketProduct) {
  const change = productChangePercent(product);
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

export function categoryLabel(category: string) {
  return category.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export function categoryClass(category: string) {
  return category
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function marketStatusLabel(venue: Pick<Venue, "marketLive">) {
  return venue.marketLive ? "Market open" : "Market paused";
}

export function marketBoardLabel(venue: Pick<Venue, "marketLive">) {
  return venue.marketLive ? "Live Market Board" : "Paused Market Board";
}

export function mobilePriceStatusLabel(venue: Pick<Venue, "marketLive">) {
  return venue.marketLive ? "Live prices" : "Paused prices";
}

export function movementLabel(product: MarketProduct) {
  if (product.isSoldOut) return "Sold out";
  if (product.priority) return "House signal";

  const change = productChangePercent(product);
  if (change >= 8) return "Fast mover";
  if (change >= 3) return "Heating up";
  if (change <= -8) return "Value window";
  if (change <= -3) return "Cooling off";
  return "Steady trade";
}

export function groupProductsByCategory(products: MarketProduct[]) {
  return Object.entries(
    products.reduce<Record<string, MarketProduct[]>>((groups, product) => {
      groups[product.category] ??= [];
      groups[product.category].push(product);
      return groups;
    }, {}),
  );
}

const tvCategoryOrder = ["Beer", "Cocktails", "Spirits", "Wine", "Other Drinks"];

export function sortTvCategories(groups: Array<[string, MarketProduct[]]>) {
  return [...groups].sort(([left], [right]) => {
    const leftIndex = tvCategoryOrder.indexOf(left);
    const rightIndex = tvCategoryOrder.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? tvCategoryOrder.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? tvCategoryOrder.length : rightIndex;
    return normalizedLeft - normalizedRight || left.localeCompare(right);
  });
}

// A TV should lead with the drinks staff and guests most need to notice.
export function sortTvBoardProducts(products: MarketProduct[]) {
  return [...products].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority ? -1 : 1;
    const movement = Math.abs(productChangePercent(right)) - Math.abs(productChangePercent(left));
    return movement || left.name.localeCompare(right.name);
  });
}

export function categoryChangePercent(products: MarketProduct[]) {
  if (!products.length) return 0;
  return products.reduce((total, product) => total + productChangePercent(product), 0) / products.length;
}

export function getFeaturedProducts(products: MarketProduct[]) {
  return getStoryProducts(products)
    .slice(0, TV_FEATURED_PRODUCTS_PER_CATEGORY);
}

// The story panel cycles through this full ordered list. Priorities and the
// biggest price moves lead the cycle, but every live drink still gets a turn.
export function getStoryProducts(products: MarketProduct[]) {
  return [...products]
    .filter(product => product.isLive && !product.isSoldOut)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      const movement = Math.abs(productChangePercent(b)) - Math.abs(productChangePercent(a));
      return movement || a.name.localeCompare(b.name);
    });
}

// Each category owns its three top TV cards. Operator priorities stay fixed;
// any empty slots rotate through the other live drinks each time that category
// comes back on screen.
export function getCategoryFeaturedProducts(products: MarketProduct[], rotation = 0) {
  const activeProducts = products.filter(product => product.isLive && !product.isSoldOut);
  const priorities = activeProducts.filter(product => product.priority).slice(0, TV_FEATURED_PRODUCTS_PER_CATEGORY);
  const availableFillers = activeProducts.filter(product => !product.priority);
  const fillerOffset = availableFillers.length ? rotation % availableFillers.length : 0;
  const rotatedFillers = [...availableFillers.slice(fillerOffset), ...availableFillers.slice(0, fillerOffset)];
  return [...priorities, ...rotatedFillers].slice(0, TV_FEATURED_PRODUCTS_PER_CATEGORY);
}

export function getStoryProduct(products: MarketProduct[]) {
  return getStoryProducts(products)[0] ?? products.find(product => product.isLive) ?? null;
}
