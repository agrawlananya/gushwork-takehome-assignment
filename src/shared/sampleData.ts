import { REPS, SOURCES } from "./constants";
import { addDays, istToUtcIso, todayIST } from "./dates";
import { parseChat, type ParsedMessage } from "./parseChat";
import { normalisePhone } from "./phone";
import type { AgentSource, Source, Tag } from "./types";

// Turns the files in data/ into leads with real timestamps relative to "now" (data/README.md).
// Callers pass file contents in: the Worker bundles them, Node scripts read them from disk.

export type SampleLead = {
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
  messages: ParsedMessage[];
};

/** Precomputed agent output for the sample leads, so a demo reset needs no AI calls (Tech §8). */
export type SnapshotEntry = {
  tag: Tag;
  reason: string;
  evidence: string;
  needsReply: boolean;
  buyerSaidNo: boolean;
  /** Days from the day the snapshot was made; re-applied relative to the reset day. */
  requestedDateOffset: number | null;
  draft: string;
  agentSource: AgentSource;
  provider: string;
  model: string;
};

export type Snapshot = {
  promptVersion: string;
  generatedAt: string;
  leads: Record<string, SnapshotEntry>;
};

/** Small CSV reader: header row, commas, double-quoted fields. Enough for our data files. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => m[2] ?? m[1]!).slice(0, -1));
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header!.map((col, i) => [col, cells[i] ?? ""])));
}

export function buildSampleLeads(
  leadsCsv: string,
  chats: Record<string, string>,
  now: Date = new Date(),
  today: string = todayIST(now),
): SampleLead[] {
  return parseCsv(leadsCsv).map((row) => {
    const rep = REPS.find((r) => r.name === row.rep);
    const source = SOURCES.find((s) => s === row.source);
    const phone = normalisePhone(row.phone ?? "");
    if (!rep || !source || !phone) throw new Error(`leads.csv: bad rep, source or phone for ${row.id}`);

    const chat = chats[row.id!];
    const messages = chat ? parseChat(chat, { repName: rep.name, buyerName: row.name, now, today }).messages : [];
    const buyerMessages = messages.filter((m) => m.sender === "buyer");

    // No chat: last contact at 10:00 IST that day (never in the future).
    const noChatContact = new Date(
      Math.min(Date.parse(istToUtcIso(addDays(today, -Number(row.last_contact_days_ago)), 10, 0)), now.getTime()),
    ).toISOString();

    return {
      id: row.id!,
      name: row.name!,
      company: row.company!,
      phone,
      source,
      repId: rep.id,
      repName: rep.name,
      createdAt: messages[0]?.sentAt ?? noChatContact,
      lastContactAt: messages.at(-1)?.sentAt ?? noChatContact,
      lastBuyerMessageAt: buyerMessages.at(-1)?.sentAt ?? null,
      messages,
    };
  });
}
