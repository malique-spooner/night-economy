import { describe, expect, it } from "vitest";
import type { MarketProduct } from "../../../../src/engine/types";
import {
  applyMarketProductPatch,
  applyVenueSettingsPatch,
  canEditMarketProducts,
  canManageVenueSettings,
  normalizeMarketProductPatch,
  portalAccessMessage,
  prepareMarketProductConfiguration,
  PRIORITY_DRINKS_PER_CATEGORY_LIMIT,
  TV_CATEGORY_PAGE_LIMIT,
  venueSettingsAccessMessage,
  wouldExceedPriorityLimit,
  wouldNeedAnotherTvPage,
} from "../../../../src/components/portal/portalHelpers";

const product: MarketProduct = {
  id: "mp_test",
  posProductId: "pos_test",
  symbol: "TEST",
  name: "Test Drink",
  category: "classic-cocktails",
  basePriceMinor: 1000,
  currentPriceMinor: 1100,
  floorPriceMinor: 800,
  ceilingPriceMinor: 1500,
  salesVelocity: 3,
  isLive: true,
  isSoldOut: false,
  priority: false,
};

describe("prepareMarketProductConfiguration", () => {
  it("creates market settings from a POS-owned product without changing the POS data", () => {
    expect(
      prepareMarketProductConfiguration({
        id: "mp_new",
        posProduct: {
          id: "pos_new",
          externalId: "pos_new",
          sku: "COCK-009",
          name: "Peach Highball",
          basePriceMinor: 1250,
          currentPriceMinor: 1250,
          currency: "GBP",
          isAvailable: true,
          category: "Cocktails",
          subcategory: "Highballs",
        },
        products: [product],
      }),
    ).toMatchObject({
      id: "mp_new",
      posProductId: "pos_new",
      name: "Peach Highball",
      basePriceMinor: 1250,
      currentPriceMinor: 1250,
      floorPriceMinor: 813,
      ceilingPriceMinor: 2063,
      isLive: false,
      isSoldOut: false,
    });
  });

  it("marks a market configuration unavailable when the POS product is sold out", () => {
    const configured = prepareMarketProductConfiguration({
      id: "mp_new",
      posProduct: { id: "pos_new", externalId: "pos_new", sku: "COCK-009", name: "Peach Highball", basePriceMinor: 1250, currentPriceMinor: 1250, currency: "GBP", isAvailable: false, category: "Cocktails", subcategory: "Highballs" },
      products: [],
    });
    expect(configured.isSoldOut).toBe(true);
  });
});

describe("normalizeMarketProductPatch", () => {
  it("keeps the POS-controlled current price inside configured floor and ceiling", () => {
    expect(normalizeMarketProductPatch(product, { floorPriceMinor: 1600 })).toMatchObject({ floorPriceMinor: 1100, ceilingPriceMinor: 1500 });
    expect(normalizeMarketProductPatch(product, { ceilingPriceMinor: 900 })).toMatchObject({ floorPriceMinor: 800, ceilingPriceMinor: 1100 });
  });

  it("normalizes editable display name and symbol only", () => {
    expect(normalizeMarketProductPatch(product, { name: "  Better Drink  ", symbol: "b-d!" })).toEqual({ name: "Better Drink", symbol: "BD" });
  });
});

describe("market configuration access", () => {
  it("updates only the selected market product", () => {
    expect(applyMarketProductPatch([product, { ...product, id: "mp_other" }], "mp_test", { symbol: "NEW" })[0].symbol).toBe("NEW");
  });

  it("removes a drink image without losing its POS mapping or market settings", () => {
    const withImage = { ...product, logoUrl: "https://storage.example/drink.webp" };
    expect(applyMarketProductPatch([withImage], "mp_test", { logoUrl: null })[0]).toMatchObject({ id: "mp_test", posProductId: "pos_test", name: "Test Drink" });
    expect(applyMarketProductPatch([withImage], "mp_test", { logoUrl: null })[0].logoUrl).toBeUndefined();
  });

  it("keeps venue settings separate from product settings", () => {
    expect(applyVenueSettingsPatch({ id: "ven_demo", slug: "demo", name: "Demo", currency: "GBP", timezone: "Europe/London", marketLive: false, marketSchedule: [{ day: "Friday", start: "18:00", end: "00:00", enabled: true }], crashIntervalMinutes: 30, launchDate: "2026-07-12", launchStartTime: "18:00", launchEndTime: "23:00" }, { marketLive: true })).toMatchObject({ marketLive: true, launchStartTime: "18:00" });
  });

  it("requires a membership to configure live POS-backed products", () => {
    expect(canEditMarketProducts({ isSignedIn: false, role: null, source: "supabase" })).toBe(false);
    expect(canEditMarketProducts({ isSignedIn: true, role: "staff", source: "supabase" })).toBe(true);
    expect(canManageVenueSettings({ role: "staff", source: "supabase" })).toBe(false);
  });

  it("explains access in market-configuration language", () => {
    expect(portalAccessMessage({ isSignedIn: false, isCheckingAccess: false, role: null, source: "seed" })).toBe("Demo changes stay local");
    expect(portalAccessMessage({ isSignedIn: true, isCheckingAccess: false, role: "owner", source: "supabase" })).toBe("Can configure as owner");
    expect(venueSettingsAccessMessage({ role: "staff", source: "supabase" })).toBe("Owner or admin access required");
  });
});

describe("TV category page guidance", () => {
  it("warns only when activating a thirteenth available drink in the same category", () => {
    const cocktailPeers = Array.from({ length: TV_CATEGORY_PAGE_LIMIT }, (_, index) => ({ ...product, id: `mp_${index}`, isLive: true }));
    const inactiveCocktail = { ...product, id: "mp_inactive", isLive: false };

    expect(wouldNeedAnotherTvPage([...cocktailPeers, inactiveCocktail], inactiveCocktail, { isLive: true })).toBe(true);
    expect(wouldNeedAnotherTvPage([...cocktailPeers.slice(0, -1), inactiveCocktail], inactiveCocktail, { isLive: true })).toBe(false);
  });

  it("limits each category to three live priority drinks", () => {
    const priorityPeers = Array.from({ length: PRIORITY_DRINKS_PER_CATEGORY_LIMIT }, (_, index) => ({ ...product, id: `mp_priority_${index}`, priority: true }));
    const nonPriorityCocktail = { ...product, id: "mp_not_priority", priority: false };

    expect(wouldExceedPriorityLimit([...priorityPeers, nonPriorityCocktail], nonPriorityCocktail, { priority: true })).toBe(true);
    expect(wouldExceedPriorityLimit([...priorityPeers.slice(0, -1), nonPriorityCocktail], nonPriorityCocktail, { priority: true })).toBe(false);
  });
});
