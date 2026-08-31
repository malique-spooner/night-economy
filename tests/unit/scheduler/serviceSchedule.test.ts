import { describe, expect, it } from "vitest";
import { activeSlot, serviceAction, simulationStart } from "../../../supabase/functions/_shared/serviceSchedule";

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

  it("treats matching start and end times as a full local calendar day", () => {
    const allDay = [
      { day: "Monday", start: "00:00", end: "00:00", enabled: true },
      { day: "Tuesday", start: "00:00", end: "00:00", enabled: true },
    ];
    expect(activeSlot(allDay, "Europe/London", new Date("2026-08-31T12:00:00.000Z"))?.key).toBe("2026-08-31:Monday:00:00");
    expect(activeSlot(allDay, "Europe/London", new Date("2026-09-01T12:00:00.000Z"))?.key).toBe("2026-09-01:Tuesday:00:00");
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

  it("anchors quick start to 18:00 in the venue timezone", () => {
    expect(simulationStart("Europe/London", new Date("2026-07-30T09:30:00.000Z"))).toBe("2026-07-30T17:00:00.000Z");
    expect(simulationStart("Asia/Bangkok", new Date("2026-07-30T09:30:00.000Z"))).toBe("2026-07-30T11:00:00.000Z");
  });

  it("anchors scheduled starts to the configured slot", () => {
    expect(simulationStart("Europe/London", new Date("2026-07-31T18:01:00.000Z"), "2026-07-31:Friday:18:00")).toBe("2026-07-31T17:00:00.000Z");
  });
});
