import { addDays, maxDate, moveOffSunday } from "./dates";
import type { DateRule, Tag } from "./types";

/** What the agent (AI or backup rules) decided about the lead. */
export type FollowUpJudgement = {
  tag: Tag;
  needsReply: boolean;
  buyerSaidNo: boolean;
  requestedDate: string | null;
};

/** Worked out by code from the lead and its chat. Dates are IST `YYYY-MM-DD`. */
export type FollowUpFacts = {
  lastContactDate: string;
  /** Date of the newest buyer question, or the rep's later "will get back". Null when there is no chat. */
  lastAskDate: string | null;
};

export type FollowUp = { date: string; rule: DateRule };

/** PRD §9.4 / Tech §5.6, applied in order. Then a Sunday moves to Monday. */
export function followUpDate(judgement: FollowUpJudgement, facts: FollowUpFacts, today: string): FollowUp {
  const { date, rule } = pickDate(judgement, facts, today);
  return { date: moveOffSunday(date), rule };
}

function pickDate(j: FollowUpJudgement, facts: FollowUpFacts, today: string): FollowUp {
  // May be in the past: then the lead shows as overdue.
  if (j.needsReply) return { date: facts.lastAskDate ?? facts.lastContactDate, rule: "needs_reply" };
  if (j.requestedDate) return { date: j.requestedDate, rule: "buyer_asked" };

  const base = facts.lastContactDate;
  if (j.buyerSaidNo) return { date: addDays(base, 60), rule: "said_no" };
  if (j.tag === "hot") return { date: addDays(base, 2), rule: "hot_plus_2" };
  if (j.tag === "warm") return { date: addDays(base, 5), rule: "warm_plus_5" };
  // Cold leads are never overdue on scoring, to keep the Today list clean.
  return { date: maxDate(addDays(base, 14), today), rule: "cold_plus_14" };
}
