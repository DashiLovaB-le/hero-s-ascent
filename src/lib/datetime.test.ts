import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_TIMEZONE,
  addDaysToDateKey,
  calendarDateInTz,
  hourInTz,
  isQuietHoursInTz,
  ontemISO,
  zonedDateTimeToUtc,
  zonedDayBoundsUtcIso,
} from "@/lib/datetime";

describe("datetime Brasília", () => {
  it("calendarDateInTz usa America/Sao_Paulo e não UTC puro", () => {
    // 2026-07-28 02:30 UTC = 2026-07-27 23:30 BRT
    const lateUtc = new Date("2026-07-28T02:30:00.000Z");
    assert.equal(calendarDateInTz(lateUtc, APP_TIMEZONE), "2026-07-27");
    assert.equal(lateUtc.toISOString().slice(0, 10), "2026-07-28");
  });

  it("ontemISO é o dia anterior no fuso", () => {
    const lateUtc = new Date("2026-07-28T02:30:00.000Z");
    assert.equal(ontemISO(lateUtc), "2026-07-26");
  });

  it("addDaysToDateKey", () => {
    assert.equal(addDaysToDateKey("2026-07-28", -1), "2026-07-27");
    assert.equal(addDaysToDateKey("2026-03-01", -1), "2026-02-28");
  });

  it("hourInTz BRT", () => {
    // 18:00 UTC = 15:00 BRT
    assert.equal(hourInTz(new Date("2026-07-28T18:00:00.000Z")), 15);
  });

  it("quiet hours 23–06 BRT", () => {
    assert.equal(isQuietHoursInTz(new Date("2026-07-28T02:30:00.000Z")), true); // 23:30 BRT
    assert.equal(isQuietHoursInTz(new Date("2026-07-28T12:00:00.000Z")), false); // 09:00 BRT
  });

  it("quiet: 07:00 BRT já está fora; 06:00 dentro", () => {
    // 07:00 BRT = 10:00 UTC
    assert.equal(isQuietHoursInTz(new Date("2026-07-28T10:00:00.000Z")), false);
    // 06:00 BRT = 09:00 UTC
    assert.equal(isQuietHoursInTz(new Date("2026-07-28T09:00:00.000Z")), true);
  });

  it("zonedDayBoundsUtcIso para um dia BRT", () => {
    const { start, end } = zonedDayBoundsUtcIso("2026-07-28");
    assert.equal(start, "2026-07-28T03:00:00.000Z");
    assert.equal(end, "2026-07-29T02:59:59.999Z");
  });

  it("zonedDateTimeToUtc 15:00 BRT → 18:00 UTC", () => {
    const d = zonedDateTimeToUtc("2026-07-28", 15, 0, 0);
    assert.equal(d.toISOString(), "2026-07-28T18:00:00.000Z");
  });
});
