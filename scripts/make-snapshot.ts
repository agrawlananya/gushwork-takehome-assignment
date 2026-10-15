// Runs the real agent on the 24 sample leads and writes data/snapshot.json (Tech §8),
// so "Reset demo data" needs no AI calls. Re-run whenever the prompt changes.
//
//   npx tsx scripts/make-snapshot.ts               run the agent now
//   npx tsx scripts/make-snapshot.ts --from-eval   reuse eval-results/latest.json (saves the free AI quota)
//   add --allow-rules to accept leads the AI couldn't answer (they keep the "Rule-based" label)

import { readFileSync, writeFileSync } from "node:fs";
import { diffDays, todayIST } from "../src/shared/dates";
import type { Snapshot } from "../src/shared/sampleData";
import { PROMPT_VERSION } from "../src/worker/agent/prompt";
import { scoreLead, type AgentResult } from "../src/worker/agent/run";
import { loadCompany, loadSample, pickProviders, throttle } from "./lib";

const args = process.argv.slice(2);
const allowRules = args.includes("--allow-rules");

let today: string;
let results: { id: string; result: AgentResult }[];

if (args.includes("--from-eval")) {
  const saved = JSON.parse(readFileSync("eval-results/latest.json", "utf8")) as {
    today: string;
    rulesOnly: boolean;
    results: { id: string; result: AgentResult }[];
  };
  if (saved.rulesOnly) throw new Error("eval-results/latest.json is a --rules run; run the AI eval first.");
  today = saved.today;
  results = saved.results;
} else {
  const now = new Date();
  today = todayIST(now);
  const providers = pickProviders(args);
  if (providers.length === 0) throw new Error("No AI keys in .dev.vars.");
  const company = loadCompany();
  results = [];
  for (const lead of loadSample(now)) {
    const result = await scoreLead(lead, lead.messages, { providers, company, today, aiAllowed: true, beforeCall: throttle });
    console.log(`${lead.id} ${result.output.tag} via ${result.provider}`);
    results.push({ id: lead.id, result });
  }
}

if (results.length !== 24) throw new Error(`Expected 24 leads, got ${results.length}.`);
const stale = results.filter((r) => r.result.promptVersion !== PROMPT_VERSION);
if (stale.length) throw new Error(`Results use prompt ${stale[0]!.result.promptVersion}, current is ${PROMPT_VERSION}. Re-run.`);
const ruleBased = results.filter((r) => r.result.source === "rules").map((r) => r.id);
if (ruleBased.length && !allowRules) {
  throw new Error(`The AI didn't answer ${ruleBased.join(", ")}. Re-run, or pass --allow-rules.`);
}

const snapshot: Snapshot = {
  promptVersion: PROMPT_VERSION,
  generatedAt: new Date().toISOString(),
  leads: Object.fromEntries(
    results.map(({ id, result }) => {
      const o = result.output;
      return [
        id,
        {
          tag: o.tag,
          reason: o.reason,
          evidence: o.evidence,
          needsReply: o.needs_reply,
          buyerSaidNo: o.buyer_said_no,
          requestedDateOffset: o.requested_date ? diffDays(o.requested_date, today) : null,
          draft: o.draft,
          agentSource: result.source,
          provider: result.provider,
          model: result.model,
        },
      ];
    }),
  ),
};

writeFileSync("data/snapshot.json", `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote data/snapshot.json (${results.length} leads, prompt ${PROMPT_VERSION}${ruleBased.length ? `, rule-based: ${ruleBased.join(", ")}` : ""}).`);
