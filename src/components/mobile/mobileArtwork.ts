import type { MarketProduct } from "../../engine/types";
import { appPath } from "../../routes";

const nightArtwork = {
  stout: appPath("/images/night-economy-wide-styles/stout-pub.webp"),
  deco: appPath("/images/night-economy-wide-styles/wine-art-deco.webp"),
  vector: appPath("/images/night-economy-wide-styles/pale-vector.webp"),
  watercolor: appPath("/images/night-economy-wide-styles/gin-watercolor.webp"),
  whisky: appPath("/images/night-economy-wide-styles/whisky-photo.webp"),
  travel: appPath("/images/night-economy-wide-styles/spritz-travel.webp"),
  ceramic: appPath("/images/night-economy-wide-styles/amber-ceramic.webp"),
  ink: appPath("/images/night-economy-wide-styles/amaretto-ink.webp"),
  neon: appPath("/images/night-economy-wide-styles/cocktail-neon.webp"),
} as const;

const artKeys = Object.keys(nightArtwork) as Array<keyof typeof nightArtwork>;

export function mobileDrinkArtwork(product: MarketProduct) {
  const name = product.name.toLowerCase();
  const category = product.category.toLowerCase();

  if (name.includes("amaretto")) return nightArtwork.ink;
  if (name.includes("guinness") || name.includes("stout")) return nightArtwork.stout;
  if (name.includes("amber ale")) return nightArtwork.ceramic;
  if (name.includes("gin") || name.includes("tonic")) return nightArtwork.watercolor;
  if (name.includes("whisky") || name.includes("whiskey") || name.includes("bourbon")) return nightArtwork.whisky;
  if (name.includes("aperol") || name.includes("spritz")) return nightArtwork.travel;
  if (name.includes("espresso martini")) return nightArtwork.neon;
  if (category.includes("wine")) return nightArtwork.deco;
  if (category.includes("beer")) return nightArtwork.vector;
  if (category.includes("cocktail")) return nightArtwork.neon;

  const index = [...product.id].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0) % artKeys.length;
  return nightArtwork[artKeys[index]];
}
