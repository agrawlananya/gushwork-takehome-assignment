import { addDays, isIsoDate } from "../../shared/dates";
import type { AgentOutput } from "./schema";

// Step 3 of the agent: code checks the AI's answer (Tech §5.5).

export const MAX_DRAFT_CHARS = 420;
export const MAX_DRAFT_LINES = 6;

// Reasons must stay true as days pass (PRD §9.3): no relative time words, day counts or dates.
const TIME_WORDS =
  /\b(today|tonight|yesterday|tomorrow|ago|(last|this|next|a|one) (week|month)|\d+\s*(day|days|week|weeks|month|months)|\d{4}-\d{2}-\d{2})\b/i;

export type CheckContext = {
  buyerFirstName: string;
  /** All chat text, to check that every number in the draft is real. */
  chatText: string;
  today: string;
  /** The rep's recent messages: the next draft must not repeat one (e.g. right after "Mark as sent"). */
  recentRepMessages?: readonly string[];
};

export type CheckResult = {
  /** Problems the AI must fix (sent back to it in a retry). */
  problems: string[];
  /** The output with fixable issues fixed by code (an out-of-range date is dropped). */
  cleaned: AgentOutput;
};

export function checkOutput(out: AgentOutput, ctx: CheckContext): CheckResult {
  const problems: string[] = [];

  if (TIME_WORDS.test(out.reason)) {
    problems.push(`The reason uses a time word ("${out.reason.match(TIME_WORDS)![0]}"). Remove it; dates are shown separately.`);
  }

  const madeUp = madeUpNumbers(out.draft, ctx.chatText);
  if (madeUp.length) {
    problems.push(`The draft has numbers that are not in the chat: ${madeUp.join(", ")}. Remove them or ask a question instead.`);
  }

  const days = madeUpWeekdays(out.draft, ctx.chatText);
  if (days.length) {
    problems.push(`The draft names a day the buyer never mentioned (${days.join(", ")}). Ask which day suits them instead.`);
  }

  if (out.draft.length > MAX_DRAFT_CHARS) {
    problems.push(`The draft is ${out.draft.length} characters. Keep it under 400.`);
  }
  if (out.draft.split("\n").length > MAX_DRAFT_LINES) {
    problems.push("The draft has too many lines. Use 2–4 short lines.");
  }
  if (!out.draft.toLowerCase().includes(ctx.buyerFirstName.toLowerCase())) {
    problems.push(`The draft must start with the buyer's first name, ${ctx.buyerFirstName}.`);
  }
  if (repeatsSentMessage(out.draft, ctx.recentRepMessages ?? [])) {
    problems.push("The draft repeats a message the rep already sent. Write the next follow-up instead, building on that message.");
  }

  return { problems, cleaned: { ...out, requested_date: sensibleDate(out.requested_date, ctx.today) } };
}

/** True when the draft is (nearly) the same text as a message the rep already sent. */
export function repeatsSentMessage(draft: string, sent: readonly string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const d = norm(draft);
  return sent.some((m) => {
    const s = norm(m);
    return s.length > 20 && (s === d || d.includes(s) || s.includes(d));
  });
}

/** Numbers ≥ 100 in the draft (prices, quantities, sizes) that never appear in the chat. */
export function madeUpNumbers(draft: string, chatText: string): string[] {
  const inChat = new Set(numbersIn(chatText));
  return [...new Set(numbersIn(draft).filter((n) => Number(n) >= 100 && !inChat.has(n)))];
}

const WEEKDAYS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

/** Weekdays in the draft that never appear in the chat: the AI picking a day the rep never agreed to. */
export function madeUpWeekdays(draft: string, chatText: string): string[] {
  const inChat = new Set([...chatText.matchAll(WEEKDAYS)].map((m) => m[0].toLowerCase()));
  return [...new Set([...draft.matchAll(WEEKDAYS)].map((m) => m[0].toLowerCase()).filter((d) => !inChat.has(d)))];
}

/** Digits with Indian or Western grouping read as one number: "₹1,45,000" → "145000". */
function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, "").replace(/\.0+$/, ""));
}

/** A requested date must be a real date between 60 days ago and 120 days ahead; otherwise use the tag rule. */
function sensibleDate(date: string | null, today: string): string | null {
  if (!date || !isIsoDate(date)) return null;
  return date >= addDays(today, -60) && date <= addDays(today, 120) ? date : null;
}
