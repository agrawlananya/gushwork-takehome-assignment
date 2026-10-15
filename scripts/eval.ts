// Scores the agent on the 24 sample leads against data/labels.csv (TODO P4, Tech §11).
//
//   npx tsx scripts/eval.ts                    all providers with a key in .dev.vars
//   npx tsx scripts/eval.ts --provider=groq    one provider only
//   npx tsx scripts/eval.ts --rules            backup rules only (no AI calls)
//   npx tsx scripts/eval.ts --only=L01,L04     some leads only
//
// Writes the full results to eval-results/latest.json (used by make-snapshot.ts --from-eval).

import { mkdirSync, writeFileSync } from "node:fs";
import { todayIST } from "../src/shared/dates";
import { TAGS } from "../src/shared/constants";
import { madeUpNumbers } from "../src/worker/agent/checks";
import { firstName } from "../src/worker/agent/facts";
import { scoreLead, type AgentResult } from "../src/worker/agent/run";
import { flag, loadCompany, loadLabels, loadSample, pickProviders, throttle } from "./lib";

const args = process.argv.slice(2);
const rulesOnly = args.includes("--rules");
const only = flag(args, "only")?.split(",");

const now = new Date();
const today = todayIST(now);
const company = loadCompany();
const labels = loadLabels();
const leads = loadSample(now).filter((l) => !only || only.includes(l.id));
const providers = rulesOnly ? [] : pickProviders(args);

if (!rulesOnly && providers.length === 0) {
  console.error("No AI keys found in .dev.vars. Add GEMINI_API_KEY / GROQ_API_KEY or pass --rules.");
  process.exit(1);
}

console.log(`Eval on ${leads.length} leads · today ${today} · ${rulesOnly ? "rules only" : providers.map((p) => `${p.name}:${p.modelId}`).join(" → ")}\n`);

const results: { id: string; result: AgentResult }[] = [];
for (const lead of leads) {
  const result = await scoreLead(lead, lead.messages, {
    providers,
    company,
    today,
    aiAllowed: !rulesOnly,
    beforeCall: throttle,
  });
  results.push({ id: lead.id, result });
  const exp = labels[lead.id]!;
  const o = result.output;
  const tagOk = o.tag === exp.tag ? "✓" : "✗";
  const replyOk = String(o.needs_reply) === exp.needs_reply ? "✓" : "✗";
  const retries = result.attempts.length - 1;
  console.log(
    `${lead.id} ${tagOk} ${o.tag.padEnd(4)} (want ${exp.tag.padEnd(4)})  reply ${replyOk} ${String(o.needs_reply).padEnd(5)}  ` +
      `${result.followUp.date} ${result.followUp.rule.padEnd(12)} ${result.provider}${retries ? ` (+${retries} retries)` : ""}`,
  );
}

// ---- Summary ----
const tagHits = results.filter(({ id, result }) => result.output.tag === labels[id]!.tag).length;
const wantReply = results.filter(({ id }) => labels[id]!.needs_reply === "true");
const replyHits = wantReply.filter(({ result }) => result.output.needs_reply).length;
const falseReply = results.filter(({ id, result }) => labels[id]!.needs_reply === "false" && result.output.needs_reply);

console.log(`\nTags: ${tagHits}/${results.length} match labels (target ≥ 22/24)`);
console.log(`Needs reply: ${replyHits}/${wantReply.length} detected, ${falseReply.length} false alarms (${falseReply.map((r) => r.id).join(", ") || "none"})`);

console.log("\nConfusion (rows = label, cols = agent):");
console.log(`        ${TAGS.map((t) => t.padStart(5)).join("")}`);
for (const want of TAGS) {
  const row = TAGS.map((got) => results.filter(({ id, result }) => labels[id]!.tag === want && result.output.tag === got).length);
  console.log(`  ${want.padEnd(5)} ${row.map((n) => String(n).padStart(5)).join("")}`);
}

const bySource = results.reduce<Record<string, number>>((acc, { result }) => ({ ...acc, [result.provider]: (acc[result.provider] ?? 0) + 1 }), {});
const calls = results.flatMap((r) => r.result.attempts).filter((a) => a.provider !== "rules");
const tokens = calls.reduce((s, a) => s + (a.inputTokens ?? 0) + (a.outputTokens ?? 0), 0);
const failed = calls.filter((a) => !a.ok);
console.log(`\nAnswered by: ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`AI calls: ${calls.length} (${failed.length} failed or retried), ${tokens} tokens, avg ${calls.length ? Math.round(tokens / calls.length) : 0}/call`);
for (const { id, result } of results) {
  for (const a of result.attempts.filter((x) => !x.ok && x.provider !== "rules")) console.log(`  ${id} ${a.provider}: ${a.error}`);
}

// ---- Drafts with the checklist (PRD §4.3 "Drafts are usable") ----
console.log("\nDrafts (✓ = first name · ≤400 chars · no made-up numbers · one question; check the real detail by eye):\n");
for (const { id, result } of results) {
  const lead = leads.find((l) => l.id === id)!;
  const { draft, reason } = result.output;
  const name = draft.toLowerCase().includes(firstName(lead.name).toLowerCase());
  const short = draft.length <= 400;
  const numbers = madeUpNumbers(draft, lead.messages.map((m) => m.text).join("\n")).length === 0;
  const questions = (draft.match(/\?/g) ?? []).length;
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  console.log(`${id} ${result.output.tag.toUpperCase()} · ${reason}`);
  console.log(`   ${mark(name)} name  ${mark(short)} ${draft.length} chars  ${mark(numbers)} numbers  ${mark(questions === 1)} ${questions} question(s)`);
  console.log(`   ${draft.replace(/\n/g, "\n   ")}\n`);
}

mkdirSync("eval-results", { recursive: true });
writeFileSync(
  "eval-results/latest.json",
  JSON.stringify({ today, generatedAt: now.toISOString(), rulesOnly, results }, null, 2),
);
console.log("Saved eval-results/latest.json");
