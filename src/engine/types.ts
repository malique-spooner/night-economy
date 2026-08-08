export type Venue = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  marketLive: boolean;
  tvStoryCategories: string[];
  marketSchedule: MarketScheduleEntry[];
  crashIntervalMinutes: CrashIntervalMinutes;
  launchDate: string;
  launchStartTime: string;
  launchEndTime: string;
};
export type MarketScheduleEntry = { day: string; start: string; end: string; enabled: boolean; targetRevenueMinor?: number };

export type CrashIntervalMinutes = 15 | 30 | 60 | 120;

export type VenueMarketSettings = Pick<
  Venue,
  "marketLive" | "tvStoryCategories" | "crashIntervalMinutes" | "marketSchedule" | "launchDate" | "launchStartTime" | "launchEndTime"
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
