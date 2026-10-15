import { addDays, isIsoDate, istToUtcIso, todayIST } from "./dates";
import type { Sender } from "./types";

// Reads pasted WhatsApp text (PRD §8.4) and the sample chat files (data/README.md).
// Shared so the preview the rep sees matches what the Worker saves.

export type ParsedMessage = {
  sender: Sender;
  text: string;
  /** UTC ISO string. Never later than `now`. */
  sentAt: string;
  /** False when the line had no time and got "now" (PRD C-4). */
  timeKnown: boolean;
  /** False when the text named no sender, so the side is a guess the rep should check. */
  senderKnown: boolean;
};

export type ParseOptions = {
  /** The lead's rep. A sender whose first name matches is the rep; everyone else is the buyer. */
  repName: string;
  /** The buyer's name, so untimed `Neha: ok` lines are recognised as new messages. */
  buyerName?: string;
  now?: Date;
  /** IST date that `D-n` counts back from. Defaults to today in IST. */
  today?: string;
};

export type ParseResult = {
  messages: ParsedMessage[];
  counts: { buyer: number; rep: number };
};

type Stamp = { date: string; hours: number; minutes: number };
/** `senderName` is null when the text didn't say who sent it. */
type Draft = { senderName: string | null; text: string; stamp: Stamp | null };

// Exports carry invisible direction marks and narrow no-break spaces (before "pm").
const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g;
const ODD_SPACES = /[  ]/g;

// D-3, 14:05 - Name: text        (sample files)
const SAMPLE = /^D-(\d{1,3}),?\s+(\d{1,2}):(\d{2})\s+-\s+(.*)$/;
// 12/10/26, 4:15 pm - Name: text (Android)
const ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}),?\s+(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s?m\.?)?\s+-\s+(.*)$/i;
// [12/10/26, 4:15:02 PM] Name: text (iPhone)
const IPHONE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap])\.?\s?m\.?)?\]\s+(.*)$/i;
const NAME_AND_TEXT = /^([^:]{1,60}):\s?(.*)$/;
const ENCRYPTION_NOTICE = /end-to-end encrypted/i;

export function parseChat(input: string, options: ParseOptions): ParseResult {
  const now = options.now ?? new Date();
  const today = options.today ?? todayIST(now);
  const drafts: Draft[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.replace(INVISIBLE, "").replace(ODD_SPACES, " ").trim();
    if (!line) continue;

    const stamped = readStampedLine(line, today);
    if (stamped) {
      // A stamped line without "Name:" is a system line ("Neha joined", the encryption notice).
      const parts = stamped.rest.match(NAME_AND_TEXT);
      if (!parts || ENCRYPTION_NOTICE.test(stamped.rest)) continue;
      drafts.push({ senderName: parts[1]!.trim(), text: parts[2]!.trim(), stamp: stamped.stamp });
      continue;
    }

    const untimed = readUntimedLine(line, options);
    if (untimed) {
      drafts.push({ ...untimed, stamp: null });
    } else if (drafts.length > 0) {
      // Multi-line message: WhatsApp puts the following lines without a time.
      const last = drafts[drafts.length - 1]!;
      last.text = last.text ? `${last.text}\n${line}` : line;
    } else {
      drafts.push({ senderName: null, text: line, stamp: null });
    }
  }

  const messages = assignTimes(
    drafts.filter((d) => d.text.length > 0),
    now,
  ).map(({ draft, sentAt }) => ({
    sender: draft.senderName ? senderOf(draft.senderName, options.repName) : guessSender(draft.text, options.buyerName),
    text: draft.text,
    sentAt,
    timeKnown: draft.stamp !== null,
    senderKnown: draft.senderName !== null,
  }));

  return {
    messages,
    counts: {
      buyer: messages.filter((m) => m.sender === "buyer").length,
      rep: messages.filter((m) => m.sender === "rep").length,
    },
  };
}

/**
 * A message with no sender name. The rep often pastes their own sent message, which opens by
 * addressing the buyer ("Farah, sorry…", "Hi Neha ji", "Sir, …"): that's the rep. Otherwise
 * assume the buyer, since a pasted reply is the common case. The preview lets the rep switch it.
 */
export function guessSender(text: string, buyerName?: string): Sender {
  const t = text.trim().toLowerCase();
  const greeting = String.raw`^(?:(?:hi|hello|hey|dear|namaste|good (?:morning|afternoon|evening))[\s,!]+)?`;
  if (new RegExp(`${greeting}(?:sir|ma'?am|madam)\\b`).test(t)) return "rep";
  const first = buyerName ? firstWord(buyerName.trim().toLowerCase()) : "";
  if (first && new RegExp(`${greeting}${escapeRegExp(first)}\\b`).test(t)) return "rep";
  return "buyer";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rep if the name is "Rep"/"Me" or its first word matches the rep's first name; otherwise buyer. */
export function senderOf(name: string, repName: string): Sender {
  const n = name.trim().toLowerCase();
  if (n === "rep" || n === "me") return "rep";
  if (n === "buyer") return "buyer";
  return firstWord(n) === firstWord(repName.toLowerCase()) ? "rep" : "buyer";
}

function readStampedLine(line: string, today: string): { stamp: Stamp; rest: string } | null {
  const sample = line.match(SAMPLE);
  if (sample) {
    const stamp = { date: addDays(today, -Number(sample[1])), hours: Number(sample[2]), minutes: Number(sample[3]) };
    return validTime(stamp) ? { stamp, rest: sample[4]! } : null;
  }

  const exported = line.match(ANDROID) ?? line.match(IPHONE);
  if (exported) {
    const [, a, b, y, h, min, ampm, rest] = exported;
    const date = exportDate(Number(a), Number(b), Number(y));
    const stamp = date && { date, hours: to24h(Number(h), ampm), minutes: Number(min) };
    return stamp && validTime(stamp) ? { stamp, rest: rest! } : null;
  }
  return null;
}

/** `Buyer: price?`, `Rep: sent`, or a line starting with the rep's or buyer's name. */
function readUntimedLine(line: string, options: ParseOptions): Omit<Draft, "stamp"> | null {
  const parts = line.match(NAME_AND_TEXT);
  if (!parts) return null;
  const name = parts[1]!.trim();
  const n = name.toLowerCase();
  const known =
    ["buyer", "rep", "me"].includes(n) ||
    firstWord(n) === firstWord(options.repName.toLowerCase()) ||
    (options.buyerName !== undefined && n === options.buyerName.trim().toLowerCase());
  // Anything else ("Note: delivery by 20th") is message text, not a sender.
  return known ? { senderName: name, text: parts[2]!.trim() } : null;
}

/**
 * Indian exports are day/month/year. If the second number can't be a month,
 * it was a US-style month/day export, so swap.
 */
function exportDate(a: number, b: number, year: number): string | null {
  const [day, month] = b > 12 && a <= 12 ? [b, a] : [a, b];
  const fullYear = year < 100 ? 2000 + year : year;
  const date = `${fullYear}-${pad(month)}-${pad(day)}`;
  return isIsoDate(date) ? date : null;
}

function to24h(hours: number, ampm: string | undefined): number {
  if (!ampm) return hours;
  const pm = ampm.toLowerCase() === "p";
  return (hours % 12) + (pm ? 12 : 0);
}

function validTime(stamp: Stamp): boolean {
  return stamp.hours >= 0 && stamp.hours <= 23 && stamp.minutes >= 0 && stamp.minutes <= 59;
}

/**
 * Stamped lines get their own time, clamped to `now` so nothing is in the future
 * (e.g. a `D-0, 08:45` sample line read at 07:00). Untimed lines get "now",
 * spaced one second apart so they keep their order and the last one is exactly now.
 */
function assignTimes(drafts: Draft[], now: Date): { draft: Draft; sentAt: string }[] {
  const nowMs = now.getTime();
  const untimedTotal = drafts.filter((d) => d.stamp === null).length;
  let untimedSeen = 0;

  return drafts.map((draft) => {
    if (draft.stamp === null) {
      untimedSeen++;
      return { draft, sentAt: new Date(nowMs - (untimedTotal - untimedSeen) * 1000).toISOString() };
    }
    const ms = Date.parse(istToUtcIso(draft.stamp.date, draft.stamp.hours, draft.stamp.minutes));
    return { draft, sentAt: new Date(Math.min(ms, nowMs)).toISOString() };
  });
}

function firstWord(s: string): string {
  return s.split(/[\s(]/)[0] ?? "";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
