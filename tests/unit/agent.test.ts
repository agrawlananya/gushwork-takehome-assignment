import { describe, expect, it } from "vitest";
import { normalisePhone, formatPhone } from "@shared/phone";
import { parseCsv } from "@shared/sampleData";
import { checkOutput, madeUpNumbers, madeUpWeekdays, repeatsSentMessage } from "../../src/worker/agent/checks";
import { computeFacts, contactFromMessages } from "../../src/worker/agent/facts";
import { ruleEngine } from "../../src/worker/agent/fallback";
import { buildUserPrompt } from "../../src/worker/agent/prompt";
import { applyNoChatRules, changeNote, scoreLead } from "../../src/worker/agent/run";
import type { AgentOutput } from "../../src/worker/agent/schema";
import { loadLabels, loadSampleLeads, readData } from "../helpers/sample";

// Thursday 15 Oct 2026, 12:00 IST.
const NOW = new Date("2026-10-15T06:30:00Z");
const TODAY = "2026-10-15";
const leads = loadSampleLeads(NOW);
const labels = loadLabels();
const byId = (id: string) => leads.find((l) => l.id === id)!;
const factsOf = (id: string) => computeFacts(byId(id), byId(id).messages, TODAY);

describe("sample data loader", () => {
  it("loads 24 leads with last contact matching leads.csv", () => {
    const rows = parseCsv(readData("leads.csv"));
    expect(leads).toHaveLength(24);
    for (const row of rows) {
      expect(factsOf(row.id!).daysSinceLastContact, row.id).toBe(Number(row.last_contact_days_ago));
    }
  });

  it("stores phones as +91XXXXXXXXXX and maps reps to ids", () => {
    expect(byId("L04")).toMatchObject({ phone: "+919000000004", repId: "arjun", repName: "Arjun" });
  });

  it("never puts a timestamp in the future", () => {
    const early = loadSampleLeads(new Date("2026-10-15T01:00:00Z")); // 06:30 IST, before L07's 08:45 messages
    for (const lead of early) {
      for (const m of lead.messages) expect(Date.parse(m.sentAt)).toBeLessThanOrEqual(Date.parse("2026-10-15T01:00:00Z"));
    }
  });
});

describe("computeFacts", () => {
  it("L01: buyer wrote last, 1 day ago", () => {
    expect(factsOf("L01")).toMatchObject({
      lastSender: "buyer",
      unansweredRepStreak: 0,
      daysSinceBuyerMessage: 1,
      lastAskDate: "2026-10-14",
      hasChat: true,
      isNewLead: false,
    });
  });

  it("L10: counts 4 unanswered rep messages, ignoring the attachment", () => {
    expect(factsOf("L10")).toMatchObject({ lastSender: "rep", unansweredRepStreak: 4, daysSinceBuyerMessage: 69 });
  });

  it("L08: buyer last wrote 7 days ago (the Hot edge)", () => {
    expect(factsOf("L08").daysSinceBuyerMessage).toBe(7);
  });

  it("no-chat leads: new if created within 7 days", () => {
    expect(factsOf("L13")).toMatchObject({ hasChat: false, isNewLead: true, lastSender: "none", lastAskDate: null });
    expect(factsOf("L21").isNewLead).toBe(false);
  });
});

describe("contactFromMessages (after a message is removed)", () => {
  it("uses the newest remaining message, and the newest buyer message", () => {
    const lead = byId("L04");
    expect(contactFromMessages(lead.messages, lead.createdAt)).toEqual({
      lastContactAt: lead.lastContactAt,
      lastBuyerMessageAt: lead.lastBuyerMessageAt,
    });
  });

  it("goes back to the earlier contact when the newest message is removed", () => {
    const lead = byId("L12"); // last message is the rep's "will confirm by evening"
    const contact = contactFromMessages(lead.messages.slice(0, -1), lead.createdAt);
    expect(contact.lastContactAt).toBe(lead.messages.at(-2)!.sentAt);
    expect(contact.lastBuyerMessageAt).toBe(lead.lastBuyerMessageAt);
  });

  it("falls back to when the lead was created when nothing is left", () => {
    expect(contactFromMessages([], "2026-10-10T04:30:00.000Z")).toEqual({
      lastContactAt: "2026-10-10T04:30:00.000Z",
      lastBuyerMessageAt: null,
    });
  });
});

describe("buildUserPrompt", () => {
  it("sends first names only and never the phone number", () => {
    const lead = byId("L04");
    const prompt = buildUserPrompt(lead, factsOf("L04"), lead.messages);
    expect(prompt).toContain("Lead: Neha, Jain Textiles");
    expect(prompt).not.toContain("Neha Jain");
    expect(prompt).not.toMatch(/9000000004|90000 00004/);
    expect(prompt).toContain("2026-10-13 Tue 10:02 Buyer: Thoda kam karo");
  });
});

describe("checkOutput", () => {
  const good: AgentOutput = {
    tag: "hot",
    reason: "Wants a lower price on 2 strapping machines; waiting on us.",
    evidence: "Thoda kam karo",
    needs_reply: true,
    buyer_said_no: false,
    requested_date: null,
    draft: "Neha ji, I've asked my manager for the best price on 2 units at ₹1,45,000.\nCan you share the other quote?",
  };
  const ctx = { buyerFirstName: "Neha", chatText: "Ma'am ₹1,45,000 per unit, GST alag", today: TODAY };

  it("passes a good answer", () => expect(checkOutput(good, ctx).problems).toEqual([]));

  it("flags time words in the reason", () => {
    expect(checkOutput({ ...good, reason: "Asked for price 2 days ago; waiting on us." }, ctx).problems).toHaveLength(1);
    expect(checkOutput({ ...good, reason: "Asked for price yesterday; waiting on us." }, ctx).problems).toHaveLength(1);
  });

  it("flags made-up numbers but allows numbers from the chat", () => {
    expect(madeUpNumbers("Best price ₹1,30,000 for 2 units", "₹1,45,000 per unit")).toEqual(["130000"]);
    expect(madeUpNumbers("₹1,45,000 per unit, 2 units", "₹1,45,000 per unit")).toEqual([]);
    expect(madeUpNumbers("₹145000", "₹1,45,000")).toEqual([]);
  });

  it("flags a weekday the buyer never mentioned", () => {
    expect(madeUpWeekdays("Visit confirmed for Friday at 10 am", "Day after tomorrow works")).toEqual(["friday"]);
    expect(madeUpWeekdays("See you Friday", "Friday works for us")).toEqual([]);
    expect(checkOutput({ ...good, draft: "Neha ji, can I come on Friday?" }, ctx).problems).toHaveLength(1);
  });

  it("flags a draft that repeats a message the rep already sent", () => {
    const sent = "Neha ji, I've asked my manager for the best price on 2 units at ₹1,45,000.\nCan you share the other quote?";
    expect(checkOutput(good, { ...ctx, recentRepMessages: [sent] }).problems).toHaveLength(1);
    expect(repeatsSentMessage("Neha ji, any update on the other quote?", [sent])).toBe(false);
    expect(repeatsSentMessage("ok", ["ok"])).toBe(false); // too short to judge
  });

  it("flags a missing first name and a long draft", () => {
    expect(checkOutput({ ...good, draft: "Hello, please share the other quote with me." }, ctx).problems).toHaveLength(1);
    expect(checkOutput({ ...good, draft: `Neha ji, ${"x".repeat(430)}` }, ctx).problems).toHaveLength(1);
  });

  it("drops a requested date out of range instead of failing", () => {
    const out = checkOutput({ ...good, requested_date: "2027-06-01" }, ctx);
    expect(out.problems).toEqual([]);
    expect(out.cleaned.requested_date).toBeNull();
    expect(checkOutput({ ...good, requested_date: "2026-10-20" }, ctx).cleaned.requested_date).toBe("2026-10-20");
  });
});

describe("ruleEngine (backup)", () => {
  const rules = (id: string) => ruleEngine(byId(id), factsOf(id), byId(id).messages);

  it("said no → cold, buyer_said_no", () => {
    expect(rules("L06")).toMatchObject({ tag: "cold", buyer_said_no: true });
    expect(rules("L11")).toMatchObject({ tag: "cold", buyer_said_no: true });
  });

  it("3+ unanswered rep messages → cold", () => expect(rules("L10").tag).toBe("cold"));

  it("buyer waiting on us → needs reply", () => {
    for (const id of ["L01", "L02", "L04", "L07"]) expect(rules(id).needs_reply, id).toBe(true);
  });

  it("rep promised and didn't → needs reply", () => expect(rules("L12").needs_reply).toBe(true));

  it("no chat: new → warm, old → cold, with an intro tied to the source", () => {
    expect(rules("L13")).toMatchObject({ tag: "warm", needs_reply: false });
    expect(rules("L13").draft).toContain("IndiaMART");
    expect(rules("L18").tag).toBe("cold");
  });

  it("every draft names the buyer and passes the output checks", () => {
    for (const lead of leads) {
      const out = ruleEngine(lead, factsOf(lead.id), lead.messages);
      const ctx = { buyerFirstName: lead.name.split(" ")[0]!, chatText: lead.messages.map((m) => m.text).join("\n"), today: TODAY };
      expect(checkOutput(out, ctx).problems, lead.id).toEqual([]);
      expect(out.reason.length, lead.id).toBeLessThanOrEqual(120);
    }
  });

  it("agrees with our labels on at least 18 of 24 tags", () => {
    const hits = leads.filter((l) => rules(l.id).tag === labels[l.id]!.tag).length;
    expect(hits).toBeGreaterThanOrEqual(18);
  });
});

describe("scoreLead", () => {
  const company = JSON.parse(readData("company.json"));

  it("with no providers, uses the rules and still sets a date", async () => {
    const lead = byId("L04");
    const result = await scoreLead(lead, lead.messages, { providers: [], company, today: TODAY, aiAllowed: true });
    expect(result).toMatchObject({ source: "rules", provider: "rules", followUp: { rule: "needs_reply", date: "2026-10-13" } });
    expect(result.attempts).toHaveLength(1);
  });

  it("past the deadline, skips the AI and uses the rules", async () => {
    const lead = byId("L04");
    const fake = { name: "google" as const, modelId: "fake", model: "fake" };
    const result = await scoreLead(lead, lead.messages, { providers: [fake], company, today: TODAY, aiAllowed: true, deadlineMs: 0 });
    expect(result.source).toBe("rules");
    expect(result.attempts.map((a) => a.error)).toEqual(["skipped: agent deadline reached", null]);
  });

  it("over the AI budget, records why it used the rules", async () => {
    const lead = byId("L13");
    const result = await scoreLead(lead, lead.messages, { providers: [], company, today: TODAY, aiAllowed: false });
    expect(result.attempts[0]!.error).toBe("AI budget used up");
    expect(result.followUp.rule).toBe("warm_plus_5");
  });
});

describe("applyNoChatRules", () => {
  const ai: AgentOutput = {
    tag: "warm",
    reason: "Trade show lead with no conversation since.",
    evidence: "",
    needs_reply: true,
    buyer_said_no: false,
    requested_date: null,
    draft: "Hi Ritu, I'm Priya from BoxLine Equipment. Which machine are you looking at?",
  };

  it("sets the tag from the facts and clears needs_reply when there is no chat", () => {
    expect(applyNoChatRules(ai, factsOf("L21"), "Trade show")).toMatchObject({ tag: "cold", needs_reply: false, reason: "Trade show lead with no conversation since." }); // 8 days
    expect(applyNoChatRules({ ...ai, tag: "cold" }, factsOf("L13"), "IndiaMART")).toMatchObject({ tag: "warm", reason: "New IndiaMART lead; no conversation yet." }); // 1 day
  });

  it("leaves leads with a chat alone", () => {
    expect(applyNoChatRules(ai, factsOf("L04"), "Referral")).toBe(ai);
  });
});

describe("changeNote", () => {
  it("describes tag and needs-reply changes", () => {
    expect(changeNote({ tag: "warm", needsReply: false }, { tag: "hot", needsReply: true })).toBe("Warm → Hot · Now needs your reply");
    expect(changeNote({ tag: "hot", needsReply: true }, { tag: "hot", needsReply: true })).toBeNull();
    expect(changeNote(null, { tag: "hot", needsReply: true })).toBeNull();
  });
});

describe("phone", () => {
  it("accepts 10-digit Indian mobiles with or without +91", () => {
    expect(normalisePhone("98765 43210")).toBe("+919876543210");
    expect(normalisePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalisePhone("919876543210")).toBe("+919876543210");
    expect(normalisePhone("09876543210")).toBe("+919876543210");
  });

  it("rejects anything else", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("5876543210")).toBeNull();
    expect(normalisePhone("+1 415 555 0100")).toBeNull();
  });

  it("formats for display", () => expect(formatPhone("+919000000004")).toBe("+91 90000 00004"));
});
