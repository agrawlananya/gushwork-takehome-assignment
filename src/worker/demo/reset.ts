import leadsCsv from "../../../data/leads.csv?raw";
import snapshotJson from "../../../data/snapshot.json";
import { REPS } from "../../shared/constants";
import { addDays } from "../../shared/dates";
import { followUpDate } from "../../shared/followUpRules";
import { buildSampleLeads, type Snapshot } from "../../shared/sampleData";
import { computeFacts } from "../agent/facts";
import { PROMPT_VERSION } from "../agent/prompt";
import { chunk, type Db } from "../db/queries";
import { agentRuns, leads, messages, reps, type NewLeadRow, type NewMessageRow } from "../db/schema";

// "Reset demo data" (PRD J5, Tech §8): sample leads + chats with dates relative to today,
// plus the agent output saved in snapshot.json. No AI calls, one D1 batch.

const chatFiles = import.meta.glob<string>("../../../data/chats/*.txt", { query: "?raw", import: "default", eager: true });
const chats = Object.fromEntries(Object.entries(chatFiles).map(([path, text]) => [path.match(/(L\d+)\.txt$/)![1]!, text]));
const snapshot = snapshotJson as Snapshot;

export async function resetDemo(db: Db, now: Date, today: string): Promise<{ leads: number; messages: number; promptVersion: string }> {
  const sample = buildSampleLeads(leadsCsv, chats, now, today);

  const leadRows: NewLeadRow[] = sample.map((lead) => {
    const saved = snapshot.leads[lead.id];
    if (!saved) throw new Error(`snapshot.json has no entry for ${lead.id}`);
    const facts = computeFacts(lead, lead.messages, today);
    const requestedDate = saved.requestedDateOffset === null ? null : addDays(today, saved.requestedDateOffset);
    const next = followUpDate(
      { tag: saved.tag, needsReply: saved.needsReply, buyerSaidNo: saved.buyerSaidNo, requestedDate },
      { lastContactDate: facts.lastContactDate, lastAskDate: facts.lastAskDate },
      today,
    );
    return {
      id: lead.id,
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      source: lead.source,
      repId: lead.repId,
      lastContactAt: lead.lastContactAt,
      lastBuyerMessageAt: lead.lastBuyerMessageAt,
      createdAt: lead.createdAt,
      tag: saved.tag,
      reason: saved.reason,
      needsReply: saved.needsReply,
      buyerSaidNo: saved.buyerSaidNo,
      requestedDate,
      nextFollowUpDate: next.date,
      dateRule: next.rule,
      draft: saved.draft,
      draftStatus: "ai",
      agentSource: saved.agentSource,
      agentUpdatedAt: now.toISOString(),
      changeNote: null,
    };
  });

  const messageRows: NewMessageRow[] = sample.flatMap((lead) =>
    lead.messages.map((m) => ({ leadId: lead.id, sender: m.sender, text: m.text, sentAt: m.sentAt, origin: "seed" as const })),
  );

  const runRows = sample.map((lead) => ({
    leadId: lead.id,
    trigger: "seed" as const,
    provider: snapshot.leads[lead.id]!.provider,
    model: snapshot.leads[lead.id]!.model,
    promptVersion: snapshot.promptVersion,
    ok: true,
    error: snapshot.promptVersion === PROMPT_VERSION ? null : `snapshot made with prompt ${snapshot.promptVersion}`,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
    outputJson: null,
    createdAt: now.toISOString(),
  }));

  // Rate-limit counters are kept on purpose: a reset must not refill the AI budget.
  await db.batch([
    db.delete(messages),
    db.delete(agentRuns),
    db.delete(leads),
    db.delete(reps),
    db.insert(reps).values(REPS.map((r) => ({ id: r.id, name: r.name }))),
    ...chunk(leadRows).map((rows) => db.insert(leads).values(rows)),
    ...chunk(messageRows).map((rows) => db.insert(messages).values(rows)),
    ...chunk(runRows).map((rows) => db.insert(agentRuns).values(rows)),
  ]);

  return { leads: leadRows.length, messages: messageRows.length, promptVersion: snapshot.promptVersion };
}
