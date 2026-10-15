import { describe, expect, it } from "vitest";
import { groupLeads, inView, sortLeads, type SortableLead } from "@shared/sort";

const TODAY = "2026-10-15";

const lead = (name: string, overrides: Partial<SortableLead>): SortableLead => ({
  name,
  tag: "warm",
  needsReply: false,
  nextFollowUpDate: TODAY,
  lastBuyerMessageAt: null,
  ...overrides,
});

describe("sortLeads — PRD §10", () => {
  it("orders groups: needs reply → hot → warm → cold", () => {
    const leads = [
      lead("cold", { tag: "cold" }),
      lead("warm", { tag: "warm" }),
      lead("reply", { tag: "warm", needsReply: true }),
      lead("hot", { tag: "hot" }),
    ];
    expect(sortLeads(leads).map((l) => l.name)).toEqual(["reply", "hot", "warm", "cold"]);
  });

  it("an overdue cold lead does not jump above a hot lead due today", () => {
    const leads = [lead("old cold", { tag: "cold", nextFollowUpDate: "2026-10-01" }), lead("hot", { tag: "hot" })];
    expect(sortLeads(leads).map((l) => l.name)).toEqual(["hot", "old cold"]);
  });

  it("inside a group: most overdue first", () => {
    const leads = [
      lead("1d", { tag: "hot", nextFollowUpDate: "2026-10-14" }),
      lead("4d", { tag: "hot", nextFollowUpDate: "2026-10-11" }),
      lead("today", { tag: "hot", nextFollowUpDate: TODAY }),
    ];
    expect(sortLeads(leads).map((l) => l.name)).toEqual(["4d", "1d", "today"]);
  });

  it("same date: newest buyer message first, no buyer message last", () => {
    const leads = [
      lead("none", {}),
      lead("older", { lastBuyerMessageAt: "2026-10-13T05:00:00.000Z" }),
      lead("newer", { lastBuyerMessageAt: "2026-10-14T05:00:00.000Z" }),
    ];
    expect(sortLeads(leads).map((l) => l.name)).toEqual(["newer", "older", "none"]);
  });

  it("does not change the input array", () => {
    const leads = [lead("b", { tag: "cold" }), lead("a", { tag: "hot" })];
    sortLeads(leads);
    expect(leads.map((l) => l.name)).toEqual(["b", "a"]);
  });
});

describe("groupLeads", () => {
  it("returns non-empty groups in order with sorted leads", () => {
    const groups = groupLeads([
      lead("w", { tag: "warm" }),
      lead("r2", { needsReply: true, nextFollowUpDate: "2026-10-14" }),
      lead("r1", { needsReply: true, nextFollowUpDate: "2026-10-11" }),
    ]);
    expect(groups.map((g) => [g.group, g.leads.map((l) => l.name)])).toEqual([
      ["needs_reply", ["r1", "r2"]],
      ["warm", ["w"]],
    ]);
  });
});

describe("inView", () => {
  it("today = due today or overdue", () => {
    expect(inView({ nextFollowUpDate: "2026-10-10" }, "today", TODAY)).toBe(true);
    expect(inView({ nextFollowUpDate: TODAY }, "today", TODAY)).toBe(true);
    expect(inView({ nextFollowUpDate: "2026-10-16" }, "today", TODAY)).toBe(false);
  });

  it("upcoming = tomorrow up to 7 days ahead", () => {
    expect(inView({ nextFollowUpDate: TODAY }, "upcoming", TODAY)).toBe(false);
    expect(inView({ nextFollowUpDate: "2026-10-16" }, "upcoming", TODAY)).toBe(true);
    expect(inView({ nextFollowUpDate: "2026-10-22" }, "upcoming", TODAY)).toBe(true);
    expect(inView({ nextFollowUpDate: "2026-10-23" }, "upcoming", TODAY)).toBe(false);
  });

  it("all = everything", () => {
    expect(inView({ nextFollowUpDate: "2027-01-01" }, "all", TODAY)).toBe(true);
  });
});
