import { followUpDate, type FollowUp } from "../../shared/followUpRules";
import type { AgentSource, Tag } from "../../shared/types";
import { checkOutput } from "./checks";
import { computeFacts, firstName, type AgentLead, type AgentMessage, type Facts } from "./facts";
import { RULES_MODEL, ruleEngine } from "./fallback";
import { buildSystemPrompt, buildUserPrompt, PROMPT_VERSION, type Company } from "./prompt";
import { callModel, type AgentProvider } from "./providers";
import type { AgentOutput } from "./schema";

// The agent flow for one lead (PRD §9.1, Tech §5.1): facts → AI (with checks) → backup rules → date rules.
// No database here: the caller loads the lead and saves the result, so scripts can run it too.

export type AgentAttempt = {
  provider: string;
  model: string;
  ok: boolean;
  error: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  outputJson: string | null;
};

export type AgentResult = {
  output: AgentOutput;
  source: AgentSource;
  provider: string;
  model: string;
  promptVersion: string;
  facts: Facts;
  followUp: FollowUp;
  /** One per model call (plus one for the backup rules), for the agent_runs table. */
  attempts: AgentAttempt[];
};

export type ScoreOptions = {
  providers: readonly AgentProvider[];
  company: Company;
  today: string;
  /** False when the AI budget is used up: go straight to the backup rules. */
  aiAllowed: boolean;
  /** Called before each model call (scripts use it to stay under free-tier rate limits). */
  beforeCall?: (provider: AgentProvider) => Promise<void>;
};

/** `messages` must be oldest first. */
export async function scoreLead(
  lead: AgentLead,
  messages: readonly AgentMessage[],
  opts: ScoreOptions,
): Promise<AgentResult> {
  const facts = computeFacts(lead, messages, opts.today);
  const attempts: AgentAttempt[] = [];
  const ai = opts.aiAllowed ? await tryProviders(lead, messages, facts, opts, attempts) : null;

  const result = ai ?? {
    output: ruleEngine(lead, facts, messages),
    source: "rules" as const,
    provider: "rules",
    model: RULES_MODEL,
  };
  if (!ai) {
    attempts.push({
      provider: "rules",
      model: RULES_MODEL,
      ok: true,
      error: opts.aiAllowed ? null : "AI budget used up",
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      outputJson: JSON.stringify(result.output),
    });
  }

  const followUp = followUpDate(
    {
      tag: result.output.tag,
      needsReply: result.output.needs_reply,
      buyerSaidNo: result.output.buyer_said_no,
      requestedDate: result.output.requested_date,
    },
    { lastContactDate: facts.lastContactDate, lastAskDate: facts.lastAskDate },
    opts.today,
  );

  return { ...result, promptVersion: PROMPT_VERSION, facts, followUp, attempts };
}

/**
 * Each provider in order: one call, and one retry if the answer was malformed or failed a check.
 * An error, timeout or rate limit moves straight on to the next provider.
 */
async function tryProviders(
  lead: AgentLead,
  messages: readonly AgentMessage[],
  facts: Facts,
  opts: ScoreOptions,
  attempts: AgentAttempt[],
): Promise<{ output: AgentOutput; source: "ai"; provider: string; model: string } | null> {
  const system = buildSystemPrompt(opts.company);
  const user = buildUserPrompt(lead, facts, messages);
  const ctx = {
    buyerFirstName: firstName(lead.name),
    chatText: messages.map((m) => m.text).join("\n"),
    today: opts.today,
  };

  for (const provider of opts.providers) {
    let prompt = user;
    for (let attempt = 1; attempt <= 2; attempt++) {
      await opts.beforeCall?.(provider);
      const call = await callModel(provider, system, prompt);
      const base = { provider: provider.name, model: provider.modelId, latencyMs: call.latencyMs };

      if (!call.ok) {
        attempts.push({ ...base, ok: false, error: `${call.kind}: ${call.error}`, inputTokens: null, outputTokens: null, outputJson: null });
        if (call.kind === "unavailable") break;
        prompt = `${user}\n\nYour previous answer was not valid JSON in the required shape. Answer again with only the JSON object.`;
        continue;
      }

      const { problems, cleaned } = checkOutput(call.output, ctx);
      attempts.push({
        ...base,
        ok: problems.length === 0,
        error: problems.length ? `checks: ${problems.join(" ")}` : null,
        inputTokens: call.inputTokens ?? null,
        outputTokens: call.outputTokens ?? null,
        outputJson: JSON.stringify(call.output),
      });
      if (problems.length === 0) {
        return { output: applyNoChatRules(cleaned, facts), source: "ai", provider: provider.name, model: provider.modelId };
      }

      prompt = `${user}\n\nYour previous answer was:\n${JSON.stringify(call.output)}\n\nFix these problems and answer again:\n- ${problems.join("\n- ")}`;
    }
  }
  return null;
}

/**
 * With no chat there is nothing for the AI to judge: PRD §9.2 makes the tag a plain fact
 * (new within 7 days → Warm, otherwise Cold) and there is nothing to reply to.
 * The AI still writes the reason and the first message.
 */
export function applyNoChatRules(output: AgentOutput, facts: Facts): AgentOutput {
  if (facts.hasChat) return output;
  return { ...output, tag: facts.daysSinceLastContact <= 7 ? "warm" : "cold", needs_reply: false, buyer_said_no: false };
}

const TAG_LABEL: Record<Tag, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };

/** The "what changed" note after a run (PRD J2), e.g. "Warm → Hot". Null on a first run or no visible change. */
export function changeNote(
  before: { tag: Tag; needsReply: boolean } | null,
  after: { tag: Tag; needsReply: boolean },
): string | null {
  if (!before) return null;
  const parts: string[] = [];
  if (before.tag !== after.tag) parts.push(`${TAG_LABEL[before.tag]} → ${TAG_LABEL[after.tag]}`);
  if (!before.needsReply && after.needsReply) parts.push("Now needs your reply");
  if (before.needsReply && !after.needsReply) parts.push("No reply needed now");
  return parts.length ? parts.join(" · ") : null;
}
