import companyJson from "../../data/company.json";
import { agentFields, agentRunRows, getLead, getMessages, type Db } from "./db/queries";
import { agentRuns, leads, type LeadRow } from "./db/schema";
import { takeAiBudget } from "./lib/rateLimit";
import { eq } from "drizzle-orm";
import type { AgentLead, AgentMessage } from "./agent/facts";
import type { Company } from "./agent/prompt";
import { createProviders } from "./agent/providers";
import { scoreLead, type AgentResult } from "./agent/run";
import type { AgentTrigger } from "./agent/triggers";

// Wires the agent (agent/run.ts has no DB) to the Worker: AI budget, providers, saving.

export const company: Company = companyJson;

export type RequestContext = { env: Env; db: Db; today: string; now: Date; ip: string };

export function agentLead(row: Pick<LeadRow, "name" | "company" | "source" | "repId" | "createdAt" | "lastContactAt">, repName: string): AgentLead {
  return {
    name: row.name,
    company: row.company,
    source: row.source,
    repName,
    createdAt: row.createdAt,
    lastContactAt: row.lastContactAt,
  };
}

/** Scores a lead that may not be saved yet (new leads are scored before insert). */
export async function score(
  ctx: RequestContext,
  lead: AgentLead,
  messages: readonly AgentMessage[],
  draftInstruction?: string,
): Promise<AgentResult> {
  const aiAllowed = await takeAiBudget(ctx.db, ctx.ip, ctx.now, Number(ctx.env.AI_DAILY_LIMIT) || 400);
  const result = await scoreLead(lead, messages, {
    providers: createProviders(ctx.env),
    company,
    today: ctx.today,
    aiAllowed,
    draftInstruction,
  });
  const used = result.attempts.map((a) => `${a.provider}${a.ok ? "" : "✗"}`).join(" → ");
  console.log(`agent ${lead.company}: ${result.output.tag} via ${used}, ${result.attempts.reduce((s, a) => s + a.latencyMs, 0)} ms`);
  return result;
}

/** Re-runs the agent for a saved lead and saves the result. Returns the updated row. */
/** `draftInstruction`: the rep's optional "Regenerate with instructions" text. */
export async function rerunAgent(
  ctx: RequestContext,
  leadId: string,
  trigger: AgentTrigger,
  repName: string,
  draftInstruction?: string,
): Promise<LeadRow> {
  const row = await getLead(ctx.db, leadId);
  if (!row) throw new Error(`Lead ${leadId} not found`);
  const messages = await getMessages(ctx.db, leadId);

  const result = await score(ctx, agentLead(row, repName), messages, draftInstruction);
  const fields = agentFields(result, { tag: row.tag, needsReply: row.needsReply }, ctx.now);
  const runs = agentRunRows(leadId, trigger, result, ctx.now);

  const [updated] = await ctx.db.batch([
    ctx.db.update(leads).set(fields).where(eq(leads.id, leadId)).returning(),
    ctx.db.insert(agentRuns).values(runs),
  ]);
  return updated[0]!;
}

/** Last-contact fields after new messages: last contact moves forward only. */
export function contactFields(row: Pick<LeadRow, "lastContactAt" | "lastBuyerMessageAt">, added: readonly AgentMessage[]) {
  // Pasted exports can contain older lines, so take the newest time, never just the last line.
  const newest = (current: string | null, items: readonly AgentMessage[]) =>
    items.reduce<string | null>((max, m) => (max === null || m.sentAt > max ? m.sentAt : max), current);
  return {
    lastContactAt: newest(row.lastContactAt, added) ?? row.lastContactAt,
    lastBuyerMessageAt: newest(row.lastBuyerMessageAt, added.filter((m) => m.sender === "buyer")),
  };
}
