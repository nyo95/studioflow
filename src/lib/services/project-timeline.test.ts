import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBackwardTimeline,
  isHolidayOrWeekend,
} from "./project-timeline";

test("isHolidayOrWeekend treats weekends and configured holidays as blocked days", () => {
  assert.equal(isHolidayOrWeekend(new Date("2026-08-16T00:00:00.000Z")), true);
  assert.equal(isHolidayOrWeekend(new Date("2026-08-17T00:00:00.000Z")), true);
  assert.equal(isHolidayOrWeekend(new Date("2026-08-18T00:00:00.000Z")), false);
});

test("calculateBackwardTimeline walks backward by business days in phase order", () => {
  const openingDate = new Date("2026-08-18T00:00:00.000Z");
  const result = calculateBackwardTimeline(openingDate, [
    { phase_enum: "MOODBOARD", duration_days: 1 },
    { phase_enum: "LAYOUT", duration_days: 2 },
    { phase_enum: "SUPERVISION", duration_days: 1 },
  ]);

  assert.equal(result.SUPERVISION.end.toISOString(), "2026-08-18T00:00:00.000Z");
  assert.equal(result.SUPERVISION.start.toISOString(), "2026-08-14T00:00:00.000Z");

  assert.equal(result.LAYOUT.end.toISOString(), "2026-08-14T00:00:00.000Z");
  assert.equal(result.LAYOUT.start.toISOString(), "2026-08-12T00:00:00.000Z");

  assert.equal(result.MOODBOARD.end.toISOString(), "2026-08-12T00:00:00.000Z");
  assert.equal(result.MOODBOARD.start.toISOString(), "2026-08-11T00:00:00.000Z");
});
