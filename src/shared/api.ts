import { z } from "zod";
import { MAX_PASTE_CHARS, MAX_PASTE_MESSAGES, REPS } from "./constants";
import { isIsoDate } from "./dates";
import { normalisePhone } from "./phone";
import type { AgentSource, DateRule, DraftStatus, Sender, Source, Tag } from "./types";
import { Sender as SenderSchema, Source as SourceSchema } from "./types";

// The API contract (Tech §6), shared by the Worker and the web app.

// ---- Requests ----

const REP_IDS = REPS.map((r) => r.id) as [string, ...string[]];

export const RepId = z.enum(REP_IDS);

export const LeadsQuery = z.object({
  view: z.enum(["today", "upcoming", "all"]).default("today"),
  rep: RepId.optional(),
  q: z.string().trim().max(80).optional(),
});

export const NewLeadInput = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  company: z.string().trim().min(2, "Company is required").max(120),
  phone: z
    .string()
    .trim()
    .refine((p) => normalisePhone(p) !== null, "Phone must be a 10-digit Indian mobile number")
    .transform((p) => normalisePhone(p)!),
  source: SourceSchema,
  repId: RepId,
  /** IST date of the last contact; defaults to today. */
  lastContactDate: z.string().refine(isIsoDate, "Use YYYY-MM-DD").optional(),
  chat: z.string().max(MAX_PASTE_CHARS, `Paste at most ${MAX_PASTE_CHARS.toLocaleString("en-IN")} characters`).optional(),
});
export type NewLeadInput = z.input<typeof NewLeadInput>;

export const AddMessagesInput = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Paste at least one message")
    .max(MAX_PASTE_CHARS, `Paste at most ${MAX_PASTE_CHARS.toLocaleString("en-IN")} characters`),
  /** Who sent each parsed message, when the rep switched a side in the preview (PRD C-3). Same order as the parser's output. */
  senders: z.array(SenderSchema).max(MAX_PASTE_MESSAGES).optional(),
});

/** Applies the rep's Buyer/Rep choices from the preview to the parsed messages, by position. */
export function applySenders<T extends { sender: Sender }>(messages: T[], senders: readonly Sender[] | undefined): T[] {
  if (!senders || senders.length !== messages.length) return messages;
  return messages.map((m, i) => ({ ...m, sender: senders[i]! }));
}

export const DraftInput = z.object({
  draft: z.string().trim().min(1, "The draft is empty").max(1000),
});

// ---- Responses ----

export type Lead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  source: Source;
  repId: string;
  repName: string;
  createdAt: string;
  lastContactAt: string;
  lastBuyerMessageAt: string | null;
  tag: Tag;
  reason: string;
  needsReply: boolean;
  buyerSaidNo: boolean;
  requestedDate: string | null;
  nextFollowUpDate: string;
  dateRule: DateRule;
  /** Plain-language "Why this date". */
  dateRuleLabel: string;
  /** 0 when due today or later. Worked out on read from today in IST. */
  overdueDays: number;
  draft: string;
  draftStatus: DraftStatus;
  agentSource: AgentSource;
  agentUpdatedAt: string;
  changeNote: string | null;
};

/** `removable`: added in the app (pasted or marked as sent), so the rep can remove it. Sample chat history is fixed. */
export type Message = { id: number; sender: Sender; text: string; sentAt: string; removable: boolean };

export type LeadDetail = { today: string; lead: Lead; messages: Message[] };

export type LeadList = { today: string; leads: Lead[] };

export type Counts = { needsReply: number; overdue: number; hot: number; dueToday: number };

export type Meta = {
  today: string;
  reps: { id: string; name: string }[];
  sources: readonly Source[];
  counts: { all: Counts; byRep: Record<string, Counts> };
};

export type ApiError = {
  error: { code: "VALIDATION" | "NOT_FOUND" | "DUPLICATE" | "RATE_LIMITED" | "INTERNAL"; message: string; leadId?: string };
};
