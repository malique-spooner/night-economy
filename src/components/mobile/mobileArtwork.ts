import type { MarketProduct } from "../../engine/types";
import { appPath } from "../../routes";
import { defaultDrinkImage } from "../tv/tvHelpers";

const commissionedDrinkArt = new Set([
  "amaretto", "blended-whisky", "bourbon", "cognac", "dark-rum", "london-dry-gin", "pink-gin", "premium-vodka", "spiced-rum", "tequila-reposado",
  "amber-ale-pint", "cider-pint", "guinness-pint", "house-lager-pint", "pale-ale-pint", "pilsner-pint", "premium-lager-pint", "session-ipa-pint", "wheat-beer-pint",
  "aperol-spritz", "cosmopolitan", "daiquiri", "espresso-martini", "french-75", "hugo-spritz", "margarita", "mojito", "old-fashioned", "paloma",
  "cabernet-sauvignon-large-glass", "chardonnay-large-glass", "malbec-large-glass", "merlot-large-glass", "pinot-grigio-large-glass", "pinot-noir-large-glass", "prosecco-large-glass", "rioja-large-glass", "rose-large-glass", "sauvignon-blanc-large-glass",
]);

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function mobileDrinkArtwork(product: MarketProduct) {
  const slug = slugify(product.name);
  if (commissionedDrinkArt.has(slug)) return appPath(`/images/mobile-drinks/${slug}.webp`);
  return defaultDrinkImage(product.category, product.id);
}
