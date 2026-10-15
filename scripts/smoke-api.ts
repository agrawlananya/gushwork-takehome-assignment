// Hits every API route and checks the answers (TODO P5). Makes ~5 AI calls.
//
//   npx tsx scripts/smoke-api.ts                       against http://localhost:5173
//   npx tsx scripts/smoke-api.ts https://<app>.workers.dev
//
// Resets the demo data at the start and the end.

import type { ApiError, LeadDetail, LeadList, Meta } from "../src/shared/api";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
let failures = 0;

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T; ms: number }> {
  const started = Date.now();
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as T, ms: Date.now() - started };
}

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ---- Reset ----
const reset = await call<{ ok: boolean; leads: number; messages: number; ms: number }>("POST", "/demo/reset");
check("reset loads 24 leads", reset.data.leads === 24, `${reset.data.messages} messages, ${reset.data.ms} ms in Worker, ${reset.ms} ms round trip`);
check("reset under 2 s", reset.ms < 2000);

// ---- Reads ----
const meta = await call<Meta>("GET", "/meta");
const all = meta.data.counts.all;
check("meta counts", all.needsReply === 5 && all.hot === 5, `today ${meta.data.today} · ${all.needsReply} need reply · ${all.overdue} overdue · ${all.hot} hot · ${all.dueToday} due`);

const today = await call<LeadList>("GET", "/leads?view=today");
const order = today.data.leads.map((l) => `${l.id}${l.overdueDays ? `(-${l.overdueDays}d)` : ""}`);
check("today list: first card is the oldest needs-reply lead (PRD T-1)", today.data.leads[0]?.id === "L02", order.join(" "));
check("today list loads fast (PRD T-9)", today.ms < 2000, `${today.ms} ms`);

const priya = await call<LeadList>("GET", "/leads?view=today&rep=priya");
check("rep filter", priya.data.leads.length > 0 && priya.data.leads.every((l) => l.repId === "priya"), `${priya.data.leads.length} for Priya`);

const search = await call<LeadList>("GET", "/leads?view=all&q=jain");
check("search 'jain' finds Neha Jain (PRD T-7)", search.data.leads.some((l) => l.id === "L04"));

const byPhone = await call<LeadList>("GET", "/leads?view=all&q=00012");
check("search by phone digits", byPhone.data.leads.some((l) => l.id === "L12"));

const upcoming = await call<LeadList>("GET", "/leads?view=upcoming");
check("upcoming = next 7 days", upcoming.data.leads.every((l) => l.nextFollowUpDate > upcoming.data.today), `${upcoming.data.leads.length} leads`);

const detail = await call<LeadDetail>("GET", "/leads/L04");
check("lead detail with chat", detail.data.messages.length === 5 && detail.data.lead.dateRuleLabel.length > 0, detail.data.lead.dateRuleLabel);

const missing = await call<ApiError>("GET", "/leads/NOPE");
check("unknown lead → 404 in the error shape", missing.status === 404 && missing.data.error.code === "NOT_FOUND");

const badQuery = await call<ApiError>("GET", "/leads?view=nope");
check("bad query → 400 VALIDATION", badQuery.status === 400 && badQuery.data.error.code === "VALIDATION", badQuery.data.error.message);

// ---- Writes ----
const edited = await call<LeadDetail>("PATCH", "/leads/L04/draft", { draft: "Neha ji, checking the best rate for 2 units now. Can you share the other quote?" });
check("edit draft → 'edited'", edited.data.lead.draftStatus === "edited");

const sent = await call<LeadDetail>("POST", "/leads/L07/sent", { draft: "Hi Mohammed, yes we have band sealers for 500 g pouches. How many pouches a day do you pack?" });
const l07 = sent.data.lead;
check(
  "mark as sent → rep message added, lead leaves Today (PRD D-5)",
  sent.data.messages.at(-1)?.sender === "rep" && l07.nextFollowUpDate > sent.data.today,
  `${l07.tag} · next ${l07.nextFollowUpDate} (${l07.dateRule}) · ${l07.agentSource} · ${sent.ms} ms`,
);

const pasted = await call<LeadDetail>("POST", "/leads/L09/messages", {
  text: "Buyer: Production head approved the automatic model. Please send the final quote for 1 unit, we want to order this month.",
});
const l09 = pasted.data.lead;
check("add messages → agent updates the lead (PRD J2)", l09.tag === "hot", `${l09.changeNote ?? "no change note"} · ${l09.reason} · ${pasted.ms} ms`);

const empty = await call<ApiError>("POST", "/leads/L09/messages", { text: "   " });
check("empty paste → 400", empty.status === 400, empty.data.error?.message);

const newLead = {
  name: "Test Buyer",
  company: "Smoke Test Foods",
  phone: "+91 98765 00001",
  source: "Website",
  repId: "sneha",
  chat: "Buyer: Hi, need a carton sealer for 200 cartons a day. Price?",
};
const created = await call<LeadDetail>("POST", "/leads", newLead);
check(
  "new lead → saved and scored (PRD J3)",
  created.status === 201 && created.data.lead.reason.length > 0 && created.data.messages.length === 1,
  `${created.data.lead?.tag} · ${created.data.lead?.nextFollowUpDate} · ${created.data.lead?.agentSource} · ${created.ms} ms`,
);

const dup = await call<ApiError>("POST", "/leads", { ...newLead, phone: "98765 00001" });
check("duplicate phone → 409 with the existing lead (PRD N-3)", dup.status === 409 && dup.data.error.leadId === created.data.lead?.id, dup.data.error.message);

const badPhone = await call<ApiError>("POST", "/leads", { ...newLead, phone: "12345" });
check("bad phone → 400 (PRD N-2)", badPhone.status === 400, badPhone.data.error.message);

const regen = await call<LeadDetail>("POST", "/leads/L13/regenerate");
check("regenerate", regen.status === 200 && regen.data.lead.draftStatus === "ai", `${regen.data.lead.agentSource} · ${regen.ms} ms`);

// ---- Leave the demo clean ----
const resetAgain = await call<{ leads: number }>("POST", "/demo/reset");
check("reset again", resetAgain.data.leads === 24);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
