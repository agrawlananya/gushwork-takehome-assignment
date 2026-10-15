import { diffDays, istDateOf } from "../../shared/dates";
import type { Sender, Source } from "../../shared/types";

// Step 1 of the agent (PRD §9.1): plain facts worked out by code, so the AI never counts days or messages.

export type AgentLead = {
  name: string;
  company: string;
  source: Source;
  repName: string;
  createdAt: string;
  lastContactAt: string;
};

export type AgentMessage = { sender: Sender; text: string; sentAt: string };

export type Facts = {
  today: string;
  lastContactDate: string;
  daysSinceLastContact: number;
  hasChat: boolean;
  lastSender: Sender | "none";
  /** Rep messages since the buyer last wrote (attachments don't count as extra messages). */
  unansweredRepStreak: number;
  lastBuyerMessageDate: string | null;
  daysSinceBuyerMessage: number | null;
  /** IST date of the newest message: the buyer's question, or our later "will get back". Used only when the lead needs a reply. */
  lastAskDate: string | null;
  /** Created ≤ 7 days ago and no chat yet. */
  isNewLead: boolean;
};

export const MEDIA_PLACEHOLDER = "<Media omitted>";

/** `messages` must be oldest first. */
export function computeFacts(lead: AgentLead, messages: readonly AgentMessage[], today: string): Facts {
  const lastContactDate = istDateOf(lead.lastContactAt);
  const last = messages.at(-1);
  const lastBuyerIndex = messages.findLastIndex((m) => m.sender === "buyer");
  const lastBuyer = lastBuyerIndex >= 0 ? messages[lastBuyerIndex]! : null;
  const lastBuyerMessageDate = lastBuyer ? istDateOf(lastBuyer.sentAt) : null;

  const unansweredRepStreak = messages
    .slice(lastBuyerIndex + 1)
    .filter((m) => m.sender === "rep" && m.text !== MEDIA_PLACEHOLDER).length;

  return {
    today,
    lastContactDate,
    daysSinceLastContact: diffDays(today, lastContactDate),
    hasChat: messages.length > 0,
    lastSender: last?.sender ?? "none",
    unansweredRepStreak,
    lastBuyerMessageDate,
    daysSinceBuyerMessage: lastBuyerMessageDate ? diffDays(today, lastBuyerMessageDate) : null,
    lastAskDate: last ? istDateOf(last.sentAt) : null,
    isNewLead: messages.length === 0 && diffDays(today, istDateOf(lead.createdAt)) <= 7,
  };
}

/**
 * Last-contact fields worked out again from the messages left after one is removed.
 * With no messages left, last contact falls back to when the lead was created.
 */
export function contactFromMessages(messages: readonly AgentMessage[], createdAt: string) {
  const newest = (items: readonly AgentMessage[]) =>
    items.reduce<string | null>((max, m) => (max === null || m.sentAt > max ? m.sentAt : max), null);
  return {
    lastContactAt: newest(messages) ?? createdAt,
    lastBuyerMessageAt: newest(messages.filter((m) => m.sender === "buyer")),
  };
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
