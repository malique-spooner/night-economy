import { supabase } from "./client";

export type VenueMemberRole = "owner" | "admin" | "staff";

type VenueMemberRow = {
  role: VenueMemberRole;
};

type VenueMembershipRow = {
  role: VenueMemberRole;
  venue_id: string;
};

type VenueRow = {
  id: string;
  name: string;
  slug: string;
};

export type AccessibleVenue = VenueRow & { role: VenueMemberRole };

type PlatformAdminRow = {
  user_id: string;
};

export async function getMyPlatformAdminAccess(): Promise<boolean> {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .maybeSingle<PlatformAdminRow>();

  if (error) throw error;
  return Boolean(data);
}

export async function getVenueMemberRole(venueId: string): Promise<VenueMemberRole | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("venue_members")
    .select("role")
    .eq("venue_id", venueId)
    .maybeSingle<VenueMemberRow>();

  if (error) throw error;
  return data?.role ?? null;
}

export async function getMyAccessibleVenues(): Promise<AccessibleVenue[]> {
  if (!supabase) return [];

  const { data: memberships, error: membershipsError } = await supabase
    .from("venue_members")
    .select("venue_id, role")
    .returns<VenueMembershipRow[]>();
  if (membershipsError) throw membershipsError;

  const venueIds = memberships.map(membership => membership.venue_id);
  if (venueIds.length === 0) return [];

  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("id, name, slug")
    .in("id", venueIds)
    .returns<VenueRow[]>();
  if (venuesError) throw venuesError;

  const roleByVenueId = new Map(memberships.map(membership => [membership.venue_id, membership.role]));
  return venues
    .map(venue => ({ ...venue, role: roleByVenueId.get(venue.id) }))
    .filter((venue): venue is AccessibleVenue => venue.role !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
}
