import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  isIsoDate,
  isSunday,
  istDateOf,
  istToUtcIso,
  moveOffSunday,
  overdueDays,
  todayIST,
} from "@shared/dates";

describe("todayIST", () => {
  it("is still the previous day just before 00:00 IST", () => {
    expect(todayIST(new Date("2026-10-15T18:29:59Z"))).toBe("2026-10-15");
  });

  it("rolls over at 00:00 IST (18:30 UTC), not at UTC midnight", () => {
    expect(todayIST(new Date("2026-10-15T18:30:00Z"))).toBe("2026-10-16");
  });

  it("matches the UTC date in the middle of the IST day", () => {
    expect(todayIST(new Date("2026-10-15T06:00:00Z"))).toBe("2026-10-15");
  });
});

describe("istDateOf / istToUtcIso", () => {
  it("gives the IST date of a late-evening UTC timestamp", () => {
    expect(istDateOf("2026-10-14T20:00:00.000Z")).toBe("2026-10-15");
  });

  it("converts IST wall-clock time to UTC", () => {
    expect(istToUtcIso("2026-10-15", 14, 5)).toBe("2026-10-15T08:35:00.000Z");
  });

  it("puts early-morning IST on the previous UTC day", () => {
    expect(istToUtcIso("2026-10-15", 2, 0)).toBe("2026-10-14T20:30:00.000Z");
  });
});

describe("isIsoDate", () => {
  it("accepts YYYY-MM-DD", () => expect(isIsoDate("2026-10-20")).toBe(true));
  it("rejects other formats", () => expect(isIsoDate("20/10/2026")).toBe(false));
  it("rejects impossible dates", () => expect(isIsoDate("2026-13-40")).toBe(false));
  it("rejects 31 February", () => expect(isIsoDate("2026-02-31")).toBe(false));
});

describe("calendar maths", () => {
  it("adds days across a month end", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
  it("subtracts days across a year start", () => expect(addDays("2026-01-02", -5)).toBe("2025-12-28"));
  it("counts days between dates", () => expect(diffDays("2026-10-15", "2026-10-11")).toBe(4));

  it("counts overdue days, and 0 when not late", () => {
    expect(overdueDays("2026-10-11", "2026-10-15")).toBe(4);
    expect(overdueDays("2026-10-15", "2026-10-15")).toBe(0);
    expect(overdueDays("2026-10-20", "2026-10-15")).toBe(0);
  });
});

describe("Sundays", () => {
  it("knows 18 Oct 2026 is a Sunday", () => {
    expect(isSunday("2026-10-18")).toBe(true);
    expect(isSunday("2026-10-17")).toBe(false);
  });

  it("moves Sunday to Monday and leaves other days alone", () => {
    expect(moveOffSunday("2026-10-18")).toBe("2026-10-19");
    expect(moveOffSunday("2026-10-17")).toBe("2026-10-17");
  });
});
