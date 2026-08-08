import { useState } from "react";
import type { SimulatorState } from "../../api/simulator";
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
  onLogoUpload: (productId: string, file: File) => void;
  onLogoRemove: (productId: string) => void;
  onSelectProduct: (productId: string) => void;
  onConfigurePosProduct: (posProduct: PosProduct) => void;
  onRestoreProduct: (product: MarketProduct) => void;
  onVenueSettingsChange: (patch: VenueMarketSettingsPatch) => void;
  instantRunPending: boolean;
  onInstantRun: () => void;
  onQuickStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  products: MarketProduct[];
  priceHistory: MarketPriceHistoryPoint[];
  priceHistoryLoading: boolean;
  posProducts: PosProduct[];
  selectedProductId: string | null;
  simulatorState: SimulatorState | null;
  venue: Venue;
};

export function PortalStartPage({
  onConfigurePosProduct,
  onRestoreProduct,
  onProductChange,
  onLogoUpload,
  onLogoRemove,
  onSelectProduct,
  onVenueSettingsChange,
  instantRunPending,
  onInstantRun,
  onQuickStart,
  onPause,
  onResume,
  onEnd,
  products,
  priceHistory,
  priceHistoryLoading,
  selectedProductId,
  simulatorState,
  posProducts,
  venue,
}: Props) {
  const activeProducts = products.filter(product => !product.isArchived);
  const groups = groupProductsByCategory(activeProducts);
  const categories = portalCategories(activeProducts);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const activeCategory = selectedCategory && categories.includes(selectedCategory) ? selectedCategory : null;
  const visibleGroups = activeCategory ? groups.filter(([category]) => category === activeCategory) : groups;
  const settings: VenueMarketSettings = {
    marketLive: venue.marketLive,
    tvStoryCategories: venue.tvStoryCategories,
    crashIntervalMinutes: venue.crashIntervalMinutes,
    marketSchedule: venue.marketSchedule,
    launchDate: venue.launchDate,
    launchStartTime: venue.launchStartTime,
    launchEndTime: venue.launchEndTime,
  };

  return (
    <section className="portal-start-page">
      <h1 className="portal-page-title">Portal</h1>
      <PortalLaunchStrip instantRunPending={instantRunPending} onEnd={onEnd} onInstantRun={onInstantRun} onPause={onPause} onQuickStart={onQuickStart} onResume={onResume} onSettingsChange={onVenueSettingsChange} settings={settings} simulatorState={simulatorState} timezone={venue.timezone} />
      <PortalCategoryFilters activeCategory={activeCategory} categories={categories} onCategoryChange={setSelectedCategory} />
      <div className="portal-drink-list">
        {visibleGroups.map(([category, categoryProducts]) => (
          <PortalDrinkGroup
            allProducts={activeProducts}
            category={category}
            marketLive={venue.marketLive}
            onProductChange={onProductChange}
            onLogoUpload={onLogoUpload}
            onLogoRemove={onLogoRemove}
            onSelectProduct={onSelectProduct}
            priceHistory={priceHistory}
            priceHistoryLoading={priceHistoryLoading}
            posProducts={posProducts}
            products={categoryProducts}
            selectedProductId={selectedProductId}
            key={category}
          />
        ))}
      </div>
      <PortalPosProductSetup archivedProducts={products.filter(product => product.isArchived)} onConfigure={onConfigurePosProduct} onRestore={onRestoreProduct} posProducts={posProducts} products={activeProducts} />
    </section>
  );
}
