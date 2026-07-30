import { describe, expect, it } from "vitest";
import { updateScheduleDay } from "../../../../src/components/portal/PortalLaunchStrip";

const schedule = [
  { day: "Friday", start: "18:00", end: "00:00", enabled: true },
  { day: "Saturday", start: "18:00", end: "00:00", enabled: false },
];

describe("updateScheduleDay", () => {
  it("turns a day on or off without changing any other day", () => {
    expect(updateScheduleDay(schedule, "Saturday", { enabled: true })).toEqual([
      schedule[0],
      { ...schedule[1], enabled: true },
    ]);
  });

  it("saves a changed time on the matching day only", () => {
    expect(updateScheduleDay(schedule, "Friday", { start: "19:30" })).toEqual([
      { ...schedule[0], start: "19:30" },
      schedule[1],
    ]);
  });
});
