import { describe, expect, it } from "vitest";
import { isIsoDate, todayIST } from "@shared/dates";

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

describe("isIsoDate", () => {
  it("accepts YYYY-MM-DD", () => expect(isIsoDate("2026-10-20")).toBe(true));
  it("rejects other formats", () => expect(isIsoDate("20/10/2026")).toBe(false));
  it("rejects impossible dates", () => expect(isIsoDate("2026-13-40")).toBe(false));
});
