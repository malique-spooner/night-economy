import type { MarketProduct } from "../../engine/types";
import { productChangePercent } from "../tv/tvHelpers";

const categoryAccents: Record<string, string> = {
  "classic-cocktails": "lime",
  spritz: "citrus",
  margarita: "lime",
  "old-fashioned": "oak",
  "bloody-mary": "tomato",
  "signature-cocktails": "gold",
  mocktails: "mint",
};

export function mobileCategorySectionId(category: string) {
  const slug = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `mobile-category-${slug || "menu"}`;
}

export function mobileAccent(product: MarketProduct) {
  const change = Math.abs(productChangePercent(product));
  if (change >= 9) return "ruby";
  return categoryAccents[product.category] ?? "amber";
}

export function mobileHook(product: MarketProduct) {
  if (product.isSoldOut) return "Paused";
  if (product.priority) return "House pick";

  const change = productChangePercent(product);
  if (change >= 8) return "Fast mover";
  if (change >= 3) return "Heating up";
  if (change <= -8) return "Value window";
  if (change <= -3) return "Cooling";
  return "Steady";
}

export function mobileMovementMark(product: MarketProduct) {
  const change = productChangePercent(product);
  if (Math.abs(change) < 0.05) return "•";
  return change >= 0 ? "▲" : "▼";
}

export function sectionTone(products: MarketProduct[]) {
  const average = products.length
    ? products.reduce((total, product) => total + productChangePercent(product), 0) / products.length
    : 0;

  return {
    average,
    tone: average >= 0 ? "up" : "dn",
  };
}
