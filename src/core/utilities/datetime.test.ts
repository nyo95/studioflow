import test from "node:test";
import assert from "node:assert/strict";
import {
  DISPLAY_TIME_ZONE,
  formatDate,
  formatDateTime,
  formatRelativeDate,
  formatDateWithOptions,
  toJakartaDateBoundary,
} from "./datetime";

test("display timezone is fixed, not device-local", () => {
  assert.equal(DISPLAY_TIME_ZONE, "Asia/Jakarta");
});

test("formatDate renders UTC instants as WIB calendar dates", () => {
  const utcEvening = "2026-08-24T17:30:00Z";
  assert.equal(formatDate(utcEvening), "25 Aug 2026");

  const utcMorning = "2026-08-24T02:00:00Z";
  assert.equal(formatDate(utcMorning), "24 Aug 2026");
});

test("formatDate accepts Date objects and timestamps", () => {
  const d = new Date("2026-01-01T00:00:00Z");
  assert.equal(formatDate(d), "01 Jan 2026");
  assert.equal(formatDate(d.getTime()), "01 Jan 2026");
});

test("formatDateTime includes WIB clock time", () => {
  assert.equal(formatDateTime("2026-08-24T09:15:00Z"), "24 Aug 2026, 16:15");
});

test("formatDateWithOptions reuses WIB by default while allowing locale/pattern changes", () => {
  assert.equal(
    formatDateWithOptions("2026-08-24T18:30:00Z", {
      locale: "en-GB",
      day: "numeric",
      month: "short",
    }),
    "25 Aug"
  );
  assert.equal(
    formatDateWithOptions("2026-08-24T18:30:00Z", {
      locale: "id-ID",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    "25 Agu 2026"
  );
});

test("formatRelativeDate buckets by Jakarta calendar day", () => {
  const now = "2026-08-24T10:00:00Z";
  assert.equal(formatRelativeDate("2026-08-23T23:00:00Z", now), "Today");
  assert.equal(formatRelativeDate("2026-08-24T00:00:00Z", now), "Today");
  assert.equal(formatRelativeDate("2026-08-25T00:00:00+07:00", now), "Tomorrow");
  assert.equal(
    formatRelativeDate("2026-08-22T00:00:00+07:00", now),
    "2 days ago"
  );
  assert.equal(formatRelativeDate("2026-08-27T00:00:00+07:00", now), "in 3 days");
  assert.equal(
    formatRelativeDate("2026-08-23T00:00:00+07:00", now),
    "Yesterday"
  );
});

test("invalid dates throw instead of producing Invalid Date strings", () => {
  assert.throws(() => formatDate("not-a-date"), /INVALID_DATE/);
});

test("toJakartaDateBoundary produces explicit WIB day edges", () => {
  assert.equal(
    toJakartaDateBoundary("2026-08-24", false).toISOString(),
    "2026-08-23T17:00:00.000Z"
  );
  assert.equal(
    toJakartaDateBoundary("2026-08-24", true).toISOString(),
    "2026-08-24T16:59:59.999Z"
  );
});
