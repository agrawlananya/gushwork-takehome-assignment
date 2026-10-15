import { and, asc, desc, eq, gt, like, lte, or, type SQL } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { Lead, Message } from "../../shared/api";
import { DATE_RULE_LABELS, REPS } from "../../shared/constants";
import { addDays, overdueDays } from "../../shared/dates";
import { sortLeads, type View } from "../../shared/sort";
import type { AgentTrigger } from "../agent/triggers";
import { changeNote, type AgentResult } from "../agent/run";
import * as schema from "./schema";
import { agentRuns, leads, messages, type LeadRow, type MessageRow } from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

export function getDb(env: Env): Db {
  return drizzle(env.DB, { schema });
}

export function repName(repId: string): string {
  return REPS.find((r) => r.id === repId)?.name ?? repId;
}

export function toLead(row: LeadRow, today: string): Lead {
  return {
    ...row,
    repName: repName(row.repId),
    dateRuleLabel: DATE_RULE_LABELS[row.dateRule],
    overdueDays: overdueDays(row.nextFollowUpDate, today),
  };
}

export function toMessage(row: MessageRow): Message {
  return { id: row.id, sender: row.sender, text: row.text, sentAt: row.sentAt };
}

/** One query: the lead row holds the latest agent result (Tech §4). Sorted per PRD §10. */
export async function listLeads(db: Db, opts: { view: View; rep?: string; q?: string }, today: string): Promise<Lead[]> {
  const where: (SQL | undefined)[] = [];
  if (opts.view === "today") where.push(lte(leads.nextFollowUpDate, today));
  if (opts.view === "upcoming") {
    where.push(gt(leads.nextFollowUpDate, today), lte(leads.nextFollowUpDate, addDays(today, 7)));
  }
  if (opts.rep) where.push(eq(leads.repId, opts.rep));
  if (opts.q) {
    const text = `%${opts.q.replace(/[%_]/g, "")}%`;
    const digits = opts.q.replace(/\D/g, "");
    where.push(
      or(like(leads.name, text), like(leads.company, text), digits.length >= 3 ? like(leads.phone, `%${digits}%`) : undefined),
    );
  }
  const rows = await db.select().from(leads).where(and(...where));
  return sortLeads(rows.map((r) => toLead(r, today)));
}

export async function getLead(db: Db, id: string): Promise<LeadRow | undefined> {
  return db.select().from(leads).where(eq(leads.id, id)).get();
}

export async function getMessages(db: Db, leadId: string): Promise<MessageRow[]> {
  return db.select().from(messages).where(eq(messages.leadId, leadId)).orderBy(asc(messages.sentAt), asc(messages.id));
}

export async function findLeadByPhone(db: Db, phone: string): Promise<LeadRow | undefined> {
  return db.select().from(leads).where(eq(leads.phone, phone)).get();
}

export async function recentRuns(db: Db, leadId: string, limit = 5) {
  return db.select().from(agentRuns).where(eq(agentRuns.leadId, leadId)).orderBy(desc(agentRuns.id)).limit(limit);
}

/** Lead fields that hold the agent's latest result. A new run replaces the draft (PRD A9). */
export function agentFields(result: AgentResult, before: { tag: LeadRow["tag"]; needsReply: boolean } | null, now: Date) {
  const o = result.output;
  return {
    tag: o.tag,
    reason: o.reason,
    needsReply: o.needs_reply,
    buyerSaidNo: o.buyer_said_no,
    requestedDate: o.requested_date,
    nextFollowUpDate: result.followUp.date,
    dateRule: result.followUp.rule,
    draft: o.draft,
    draftStatus: "ai" as const,
    agentSource: result.source,
    agentUpdatedAt: now.toISOString(),
    changeNote: changeNote(before, { tag: o.tag, needsReply: o.needs_reply }),
  };
}

/** One agent_runs row per model call (and one for the backup rules), for debugging and the "how it works" story. */
export function agentRunRows(leadId: string, trigger: AgentTrigger, result: AgentResult, now: Date) {
  return result.attempts.map((a) => ({
    leadId,
    trigger,
    provider: a.provider,
    model: a.model,
    promptVersion: result.promptVersion,
    ok: a.ok,
    error: a.error,
    latencyMs: a.latencyMs,
    inputTokens: a.inputTokens,
    outputTokens: a.outputTokens,
    outputJson: a.outputJson,
    createdAt: now.toISOString(),
  }));
}

/** D1 allows at most 100 bound values per statement, so multi-row inserts go in chunks. */
export function chunk<T extends object>(rows: readonly T[]): T[][] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]!).length;
  const size = Math.max(1, Math.floor(99 / columns));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
