import { describe, expect, it } from "vitest";
import { activeSlot, serviceAction } from "../../../supabase/functions/_shared/serviceSchedule";

const friday = [{ day: "Friday", start: "18:00", end: "00:00", enabled: true, targetRevenueMinor: 1_200_000 }];

describe("cloud service scheduling", () => {
  it("opens the configured Friday slot in the venue timezone", () => {
    const slot = activeSlot(friday, "Europe/London", new Date("2026-07-31T18:30:00.000Z"));
    expect(slot).toEqual({ key: "2026-07-31:Friday:18:00", targetRevenueMinor: 1_200_000 });
  });

  it("keeps a cross-midnight Friday slot active after midnight", () => {
    const slot = activeSlot([{ day: "Friday", start: "22:00", end: "02:00", enabled: true }], "Asia/Bangkok", new Date("2026-07-31T18:30:00.000Z"));
    expect(slot?.key).toBe("2026-07-31:Friday:22:00");
  });

  it("ticks a quick rehearsal even when no scheduled slot is open", () => {
    expect(serviceAction(null, { status: "running", scheduled_slot_key: null })).toBe("tick");
  });

  it("ends a scheduled service after its slot and does not tick it again", () => {
    expect(serviceAction(null, { status: "running", scheduled_slot_key: "2026-07-31:Friday:18:00" })).toBe("scheduled_end");
  });

  it("starts a new weekly slot only when its key differs", () => {
    const slot = { key: "2026-08-07:Friday:18:00" };
    expect(serviceAction(slot, { status: "ended", scheduled_slot_key: "2026-07-31:Friday:18:00" })).toBe("scheduled_start");
    expect(serviceAction(slot, { status: "running", scheduled_slot_key: slot.key })).toBe("tick");
  });
});
