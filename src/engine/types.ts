export type Venue = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  marketLive: boolean;
  tvStoryCategories: string[];
  tvStoryArticleIds: string[];
  marketSchedule: MarketScheduleEntry[];
  crashIntervalMinutes: CrashIntervalMinutes;
  crashSettings: MarketCrashSettings;
  launchDate: string;
  launchStartTime: string;
  launchEndTime: string;
};
export type MarketScheduleEntry = { day: string; start: string; end: string; enabled: boolean; targetRevenueMinor?: number };

export type CrashIntervalMinutes = 15 | 30 | 60 | 120;
export type CrashDurationMinutes = 5 | 10;
export type MarketCrashSettings = {
  durationMinutes: CrashDurationMinutes;
  categoryCrashCounts: Record<string, number>;
};

export type VenueMarketSettings = Pick<
  Venue,
  "marketLive" | "tvStoryCategories" | "tvStoryArticleIds" | "crashIntervalMinutes" | "crashSettings" | "marketSchedule" | "launchDate" | "launchStartTime" | "launchEndTime"
>;

export type MarketProduct = {
  id: string;
  posProductId?: string;
  isArchived?: boolean;
  symbol: string;
  logoUrl?: string;
  name: string;
  category: string;
  basePriceMinor: number;
  currentPriceMinor: number;
  floorPriceMinor: number;
  ceilingPriceMinor: number;
  salesVelocity: number;
  isLive: boolean;
  isSoldOut: boolean;
  priority: boolean;
};
