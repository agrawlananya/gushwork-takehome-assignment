import { describe, expect, it } from "vitest";
import { followUpDate, type FollowUpFacts, type FollowUpJudgement } from "@shared/followUpRules";

// Thursday 15 Oct 2026. Sunday is 18 Oct.
const TODAY = "2026-10-15";

const judge = (overrides: Partial<FollowUpJudgement>): FollowUpJudgement => ({
  tag: "warm",
  needsReply: false,
  buyerSaidNo: false,
  requestedDate: null,
  ...overrides,
});
const facts = (overrides: Partial<FollowUpFacts> = {}): FollowUpFacts => ({
  lastContactDate: "2026-10-13",
  lastAskDate: "2026-10-12",
  ...overrides,
});

describe("followUpDate — PRD §9.4 rules", () => {
  it("1. needs reply → the day the buyer asked, even if past (shows overdue)", () => {
    expect(followUpDate(judge({ tag: "hot", needsReply: true }), facts(), TODAY)).toEqual({
      date: "2026-10-12",
      rule: "needs_reply",
    });
  });

  it("1. needs reply with no chat → last contact date", () => {
    expect(followUpDate(judge({ needsReply: true }), facts({ lastAskDate: null }), TODAY)).toEqual({
      date: "2026-10-13",
      rule: "needs_reply",
    });
  });

  it("2. buyer named a day → that day", () => {
    expect(followUpDate(judge({ requestedDate: "2026-10-22" }), facts(), TODAY)).toEqual({
      date: "2026-10-22",
      rule: "buyer_asked",
    });
  });

  it("3. buyer said no → last contact + 60 days", () => {
    expect(followUpDate(judge({ tag: "cold", buyerSaidNo: true }), facts(), TODAY)).toEqual({
      date: "2026-12-12",
      rule: "said_no",
    });
  });

  it("4. hot → last contact + 2 days", () => {
    expect(followUpDate(judge({ tag: "hot" }), facts(), TODAY)).toEqual({ date: "2026-10-15", rule: "hot_plus_2" });
  });

  it("5. warm → last contact + 5 days", () => {
    expect(followUpDate(judge({ tag: "warm" }), facts({ lastContactDate: "2026-10-10" }), TODAY)).toEqual({
      date: "2026-10-15",
      rule: "warm_plus_5",
    });
  });

  it("6. cold → last contact + 14 days", () => {
    expect(followUpDate(judge({ tag: "cold" }), facts({ lastContactDate: "2026-10-10" }), TODAY)).toEqual({
      date: "2026-10-24",
      rule: "cold_plus_14",
    });
  });

  it("6. cold is never before today (not shown as overdue on scoring)", () => {
    expect(followUpDate(judge({ tag: "cold" }), facts({ lastContactDate: "2026-08-01" }), TODAY)).toEqual({
      date: TODAY,
      rule: "cold_plus_14",
    });
  });
});

describe("followUpDate — order and Sundays", () => {
  it("needs reply wins over a requested date", () => {
    const out = followUpDate(judge({ needsReply: true, requestedDate: "2026-10-22" }), facts(), TODAY);
    expect(out.rule).toBe("needs_reply");
  });

  it("a requested date wins over said-no", () => {
    const out = followUpDate(judge({ buyerSaidNo: true, requestedDate: "2026-11-02" }), facts(), TODAY);
    expect(out).toEqual({ date: "2026-11-02", rule: "buyer_asked" });
  });

  it("said-no wins over the tag rules", () => {
    const out = followUpDate(judge({ tag: "hot", buyerSaidNo: true }), facts(), TODAY);
    expect(out.rule).toBe("said_no");
  });

  it("moves a Sunday result to Monday", () => {
    // 16 Oct + 2 = Sunday 18 Oct → Monday 19 Oct
    expect(followUpDate(judge({ tag: "hot" }), facts({ lastContactDate: "2026-10-16" }), TODAY)).toEqual({
      date: "2026-10-19",
      rule: "hot_plus_2",
    });
  });

  it("moves a requested Sunday to Monday", () => {
    expect(followUpDate(judge({ requestedDate: "2026-10-18" }), facts(), TODAY).date).toBe("2026-10-19");
  });
});
