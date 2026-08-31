import { activeSlot, serviceAction, type ScheduleEntry } from "../_shared/serviceSchedule.ts";

/**
 * Cloud-owned orchestration entry point, invoked once per minute by Supabase
 * Cron. It decides whether each prepared venue should start, advance, or end;
 * all state mutation remains inside venue-simulator so manual and scheduled
 * services follow exactly the same lifecycle.
 */

type Venue = { id: string; slug: string; timezone: string; market_schedule: ScheduleEntry[] | null; is_public_demo: boolean };
type Service = { venue_id: string; status: "idle" | "running" | "paused" | "ended"; scheduled_slot_key: string | null };

Deno.serve(async request => {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const schedulerSecret = Deno.env.get("SCHEDULER_SECRET");
    if (!schedulerSecret || request.headers.get("x-night-economy-scheduler-secret") !== schedulerSecret) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const key = serverKey();
    if (!url || !key) return json({ error: "Server configuration is incomplete" }, 500);
    const headers = { apikey: key, "content-type": "application/json" };
    const venues = await restJson<Venue[]>(url, "/venues?select=id,slug,timezone,market_schedule,is_public_demo", { headers }, "load venue schedules");
    const services = await restJson<Service[]>(url, "/venue_test_services?select=venue_id,status,scheduled_slot_key", { headers }, "load test services");
    const byVenue = new Map(services.map(service => [service.venue_id, service]));
    const outcomes: Array<{ venue: string; action: string }> = [];

    for (const venue of venues) {
      const service = byVenue.get(venue.id);
      if (!service) continue;

      // Retire the old continuous public-demo run once. Public Demo now uses
      // the same daily scheduled service lifecycle as every other venue.
      if (venue.is_public_demo && service.scheduled_slot_key === null && service.status === "running") {
        await invokeVenueSimulator(url, key, { venueSlug: venue.slug, action: "scheduled_end" });
        outcomes.push({ venue: venue.slug, action: "ended-legacy-continuous-run" });
        continue;
      }
      const slot = activeSlot(venue.market_schedule ?? [], venue.timezone || "Europe/London", new Date());
      const action = serviceAction(slot, service);
      if (action === "scheduled_start" && slot) {
        await invokeVenueSimulator(url, key, { venueSlug: venue.slug, action: "scheduled_start", scheduledSlotKey: slot.key, targetRevenueMinor: slot.targetRevenueMinor });
        outcomes.push({ venue: venue.slug, action: "started" });
      } else if (action === "scheduled_end") {
        await invokeVenueSimulator(url, key, { venueSlug: venue.slug, action: "scheduled_end" });
        outcomes.push({ venue: venue.slug, action: "ended" });
      } else if (action === "tick") {
        // Quick-start rehearsals are cloud-owned too. Previously only a service
        // inside a scheduled slot was ticked, so a rehearsal froze as soon as
        // the operator closed the Portal.
        await invokeVenueSimulator(url, key, { venueSlug: venue.slug, action: "tick" });
        outcomes.push({ venue: venue.slug, action: "ticked" });
      }
    }

    return json({ ok: true, checked: venues.length, outcomes });
  } catch (error) {
    console.error("service-scheduler failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not schedule venue services" }, 500);
  }
});

async function invokeVenueSimulator(url: string, key: string, body: Record<string, unknown>) {
  const response = await fetch(`${url}/functions/v1/venue-simulator`, {
    method: "POST",
    headers: {
      apikey: key,
      "content-type": "application/json",
      "x-night-economy-scheduler-secret": Deno.env.get("SCHEDULER_SECRET") ?? "",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Venue simulator failed: ${await response.text()}`);
}

async function restJson<T>(url: string, path: string, init: RequestInit, action: string): Promise<T> {
  const response = await fetch(`${url}/rest/v1${path}`, init);
  if (!response.ok) throw new Error(`Supabase REST failed to ${action}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

function serverKey() {
  const modernKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modernKeys) {
    try {
      const parsed = JSON.parse(modernKeys) as Record<string, string>;
      return parsed.default ?? Object.values(parsed)[0];
    } catch {
      return undefined;
    }
  }
  return Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
