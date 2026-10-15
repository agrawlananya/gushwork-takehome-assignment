import type { Source } from "../../shared/types";
import { firstName, MEDIA_PLACEHOLDER, type AgentLead, type AgentMessage, type Facts } from "./facts";
import type { AgentOutput } from "./schema";

// Backup rules (PRD §9.6, Tech §5.7): used when the AI is down, slow, over budget or keeps answering badly.
// Simple keyword + fact rules, so the app always shows a result.

export const RULES_MODEL = "rules-v1";

const STRONG = [
  "quote", "quotation", "proforma", "final price", "best rate", "best price", "demo", "visit", "budget",
  "order", "po", "purchase order", "payment terms", "advance", "delivery", "install", "kab tak", "kam karo", "lower price", "discount",
];
const SOFT = [
  "price", "rate", "kitna", "cost", "catalogue", "catalog", "brochure", "details", "video", "interested",
  "send", "share", "bhejo", "batao", "confirm", "slot",
];
const NO = [
  "not interested", "not needed", "nahi chahiye", "no need", "another supplier", "other supplier", "already bought",
  "bought one", "bought a", "went with", "next year", "not buying",
];
// The buyer will come back to us ("call me next week", "will check and get back"): not our turn yet.
const DEFER = ["call me", "will decide", "get back", "will check", "will discuss", "let me compare", "revert", "will let you know"];
const PROMISE = ["will confirm", "will check", "will send", "will get back", "will revert", "will update", "by evening", "confirm by"];

const MACHINES: [RegExp, string][] = [
  [/shrink/i, "shrink wrapper"],
  [/strapping/i, "strapping machine"],
  [/stretch/i, "stretch wrapper"],
  [/band seal/i, "band sealer"],
  [/label/i, "labelling machine"],
  [/carton/i, "carton sealer"],
];

const INTRO_BY_SOURCE: Record<Source, string> = {
  IndiaMART: "Thanks for your inquiry on IndiaMART.",
  Website: "Thanks for filling the form on our website.",
  "Trade show": "It was good to meet you at our stall.",
  Referral: "We got your number through a common contact.",
  "Cold call": "Following up on our call.",
  "WhatsApp inbound": "Thanks for messaging us.",
};

export function ruleEngine(lead: AgentLead, facts: Facts, messages: readonly AgentMessage[]): AgentOutput {
  const name = firstName(lead.name);
  const rep = firstName(lead.repName);
  const allText = messages.map((m) => m.text).join("\n");
  const greeting = /\bji\b/i.test(allText) ? `${name} ji` : name;
  const machine = MACHINES.find(([re]) => re.test(allText))?.[1] ?? "packaging machine";

  const buyerMessages = messages.filter((m) => m.sender === "buyer" && m.text !== MEDIA_PLACEHOLDER);
  const lastBuyerText = buyerMessages.at(-1)?.text ?? "";
  const buyerText = buyerMessages.map((m) => m.text).join("\n");
  const last = messages.at(-1);

  const base = { evidence: lastBuyerText.slice(0, 200), requested_date: null };

  // No chat yet: new leads are warm, old ones cold.
  if (!facts.hasChat) {
    const intro = `Hi ${name}, this is ${rep} from BoxLine Equipment, Pune. ${INTRO_BY_SOURCE[lead.source]}`;
    const ask = "Which packaging machine are you looking at, and how many units do you pack a day?";
    const isNew = facts.daysSinceLastContact <= 7;
    return {
      ...base,
      evidence: "",
      tag: isNew ? "warm" : "cold",
      reason: isNew ? `New ${lead.source} lead; no conversation yet.` : `${lead.source} lead with no conversation and no recent contact.`,
      needs_reply: false,
      buyer_said_no: false,
      draft: `${intro}\n${ask}`,
    };
  }

  // The buyer's latest message decides.
  if (hasAny(lastBuyerText, NO)) {
    return {
      ...base,
      tag: "cold",
      reason: `Said not needed or went elsewhere for the ${machine}.`,
      needs_reply: false,
      buyer_said_no: true,
      draft: `Thanks for letting me know, ${greeting}.\nIf you need a ${machine} or spares later, I'm just a message away.`,
    };
  }

  if (facts.unansweredRepStreak >= 3) {
    return {
      ...base,
      tag: "cold",
      reason: `No reply to our last ${facts.unansweredRepStreak} messages about the ${machine}.`,
      needs_reply: false,
      buyer_said_no: false,
      draft: `Hi ${greeting}, just a quick check on the ${machine}.\nIf it's not a priority right now, no problem at all. Should I check back later?`,
    };
  }

  const buyerQuiet = facts.daysSinceBuyerMessage ?? facts.daysSinceLastContact;
  if (buyerQuiet > 30) {
    return {
      ...base,
      tag: "cold",
      reason: `Buyer has gone quiet on the ${machine}.`,
      needs_reply: false,
      buyer_said_no: false,
      draft: `Hi ${greeting}, is the ${machine} still on your list for this season?\nIf the timing has moved, just tell me when to check back.`,
    };
  }

  const strong = hasAny(buyerText, STRONG);
  const soft = hasAny(buyerText, SOFT);
  const buyerAsked =
    last?.sender === "buyer" &&
    !hasAny(lastBuyerText, DEFER) &&
    (lastBuyerText.includes("?") || hasAny(lastBuyerText, [...STRONG, ...SOFT]));
  const repPromised = last?.sender === "rep" && hasAny(last.text, PROMISE);
  const tag = strong && buyerQuiet <= 7 ? "hot" : "warm";

  if (repPromised) {
    return {
      ...base,
      tag,
      reason: `We promised to get back on the ${machine}; buyer is waiting.`,
      needs_reply: true,
      buyer_said_no: false,
      draft: `Hi ${greeting}, sorry for the delay on the ${machine}.\nI'm confirming this now. Can I call you in the next hour to close it?`,
    };
  }

  if (buyerAsked) {
    return {
      ...base,
      tag,
      reason: `Asked about the ${machine}; waiting on our reply.`,
      needs_reply: true,
      buyer_said_no: false,
      draft: `Hi ${greeting}, thanks for your message about the ${machine}.\nI'm checking the details for you. Is a quick call at 4 pm okay to go over it?`,
    };
  }

  return {
    ...base,
    tag,
    reason:
      tag === "hot"
        ? `Strong interest in the ${machine}; ball is with the buyer.`
        : soft || strong
          ? `Interested in the ${machine} but not ready to decide.`
          : `Early conversation about the ${machine}.`,
    needs_reply: false,
    buyer_said_no: false,
    draft: `Hi ${greeting}, to help you decide on the ${machine}:\nwould a short call or a video of it running on a line like yours be more useful?`,
  };
}

function hasAny(text: string, words: readonly string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`).test(t));
}
