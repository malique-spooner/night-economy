import { useState } from "react";
import type { MarketProduct, Venue, VenueMarketSettings } from "../../engine/types";
import type { MarketPriceHistoryPoint, MarketProductPatch, PosProduct, VenueMarketSettingsPatch } from "../../api/market";
import { groupProductsByCategory } from "../tv/tvHelpers";
import { PortalCategoryFilters } from "./PortalCategoryFilters";
import { PortalDrinkGroup } from "./PortalDrinkGroup";
import { PortalLaunchStrip } from "./PortalLaunchStrip";
import { PortalPosProductSetup } from "./PortalPosProductSetup";
import { portalCategories } from "./portalHelpers";

type Props = {
  onProductChange: (productId: string, patch: MarketProductPatch, options?: { persist?: boolean }) => void;
  onSelectProduct: (productId: string) => void;
  onConfigurePosProduct: (posProduct: PosProduct) => void;
  onVenueSettingsChange: (patch: VenueMarketSettingsPatch) => void;
  products: MarketProduct[];
  priceHistory: MarketPriceHistoryPoint[];
  priceHistoryLoading: boolean;
  posProducts: PosProduct[];
  selectedProductId: string | null;
  venue: Venue;
};

export function PortalStartPage({
  onConfigurePosProduct,
  onProductChange,
  onSelectProduct,
  onVenueSettingsChange,
  products,
  priceHistory,
  priceHistoryLoading,
  selectedProductId,
  posProducts,
  venue,
}: Props) {
  const groups = groupProductsByCategory(products);
  const categories = portalCategories(products);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const activeCategory = selectedCategory && categories.includes(selectedCategory) ? selectedCategory : null;
  const visibleGroups = activeCategory ? groups.filter(([category]) => category === activeCategory) : groups;
  const settings: VenueMarketSettings = {
    marketLive: venue.marketLive,
    crashIntervalMinutes: venue.crashIntervalMinutes,
    launchDate: venue.launchDate,
    launchStartTime: venue.launchStartTime,
    launchEndTime: venue.launchEndTime,
  };

  return (
    <section className="portal-start-page">
      <h1 className="portal-page-title">Portal</h1>
      <PortalLaunchStrip onSettingsChange={onVenueSettingsChange} settings={settings} />
      <PortalCategoryFilters activeCategory={activeCategory} categories={categories} onCategoryChange={setSelectedCategory} />
      <div className="portal-drink-list">
        {visibleGroups.map(([category, categoryProducts]) => (
          <PortalDrinkGroup
            allProducts={products}
            category={category}
            onProductChange={onProductChange}
            onSelectProduct={onSelectProduct}
            priceHistory={priceHistory}
            priceHistoryLoading={priceHistoryLoading}
            products={categoryProducts}
            selectedProductId={selectedProductId}
            key={category}
          />
        ))}
      </div>
      <PortalPosProductSetup onConfigure={onConfigurePosProduct} posProducts={posProducts} products={products} />
    </section>
  );
}
