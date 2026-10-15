import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { ZodType } from "zod";
import {
  AddMessagesInput,
  applySenders,
  DraftInput,
  LeadsQuery,
  NewLeadInput,
  type Counts,
  type LeadDetail,
  type LeadList,
  type Meta,
} from "../shared/api";
import { MAX_PASTE_MESSAGES, REPS, SOURCES } from "../shared/constants";
import { isIsoDate, istToUtcIso, todayIST } from "../shared/dates";
import { parseChat } from "../shared/parseChat";
import { agentLead, contactFields, rerunAgent, score, type RequestContext } from "./agentService";
import {
  agentFields,
  agentRunRows,
  chunk,
  findLeadByPhone,
  getDb,
  getLead,
  getMessages,
  listLeads,
  repName,
  toLead,
  toMessage,
} from "./db/queries";
import { agentRuns, leads, messages, type NewLeadRow } from "./db/schema";
import { resetDemo } from "./demo/reset";
import { apiError } from "./lib/errors";

type AppEnv = { Bindings: Env; Variables: { ctx: RequestContext } };

const app = new Hono<AppEnv>().basePath("/api");

// Every request gets the DB, "now", today in IST and the visitor's IP.
app.use(async (c, next) => {
  const now = new Date();
  c.set("ctx", {
    env: c.env,
    db: getDb(c.env),
    now,
    today: resolveToday(c.env, c.req.query("today"), now),
    ip: c.req.header("cf-connecting-ip") ?? "local",
  });
  await next();
});

/** Today in IST. In dev only, `?today=YYYY-MM-DD` overrides it (Tech §7). */
function resolveToday(env: Env, override: string | undefined, now: Date): string {
  if (env.ENV === "dev" && override && isIsoDate(override)) return override;
  return todayIST(now);
}

/** Zod validation with our error shape. */
function valid<T extends ZodType, Target extends "json" | "query">(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      return apiError(c, 400, "VALIDATION", issue ? `${issue.path.join(".") || target}: ${issue.message}` : "Invalid input");
    }
  });
}

async function leadDetail(ctx: RequestContext, id: string): Promise<LeadDetail | null> {
  const row = await getLead(ctx.db, id);
  if (!row) return null;
  const msgs = await getMessages(ctx.db, id);
  return { today: ctx.today, lead: toLead(row, ctx.today), messages: msgs.map(toMessage) };
}

app.get("/health", (c) => c.json({ ok: true, todayIST: c.var.ctx.today }));

// ---- Read (no AI) ----

app.get("/meta", async (c) => {
  const ctx = c.var.ctx;
  const all = await listLeads(ctx.db, { view: "all" }, ctx.today);
  const count = (rows: typeof all): Counts => ({
    needsReply: rows.filter((l) => l.needsReply).length,
    overdue: rows.filter((l) => l.overdueDays > 0).length,
    hot: rows.filter((l) => l.tag === "hot").length,
    dueToday: rows.filter((l) => l.nextFollowUpDate <= ctx.today).length,
  });
  return c.json<Meta>({
    today: ctx.today,
    reps: REPS.map((r) => ({ id: r.id, name: r.name })),
    sources: SOURCES,
    counts: {
      all: count(all),
      byRep: Object.fromEntries(REPS.map((r) => [r.id, count(all.filter((l) => l.repId === r.id))])),
    },
  });
});

app.get("/leads", valid("query", LeadsQuery), async (c) => {
  const ctx = c.var.ctx;
  const query = c.req.valid("query");
  return c.json<LeadList>({ today: ctx.today, leads: await listLeads(ctx.db, query, ctx.today) });
});

app.get("/leads/:id", async (c) => {
  const detail = await leadDetail(c.var.ctx, c.req.param("id"));
  return detail ? c.json(detail) : apiError(c, 404, "NOT_FOUND", "Lead not found");
});

// ---- Write ----

app.post("/leads", valid("json", NewLeadInput), async (c) => {
  const ctx = c.var.ctx;
  const input = c.req.valid("json");

  const existing = await findLeadByPhone(ctx.db, input.phone);
  if (existing) {
    return apiError(c, 409, "DUPLICATE", `This number belongs to ${existing.name} (${existing.company}). Open it instead?`, {
      leadId: existing.id,
    });
  }

  const rep = repName(input.repId);
  const parsed = input.chat ? parseChat(input.chat, { repName: rep, buyerName: input.name, now: ctx.now, today: ctx.today }) : null;
  if (parsed && parsed.messages.length > MAX_PASTE_MESSAGES) {
    return apiError(c, 400, "VALIDATION", `Paste at most ${MAX_PASTE_MESSAGES} messages`);
  }
  const chat = parsed?.messages ?? [];

  // Last contact: the chat's newest message, else the chosen day (now if today, 10:00 IST otherwise).
  const contactDate = input.lastContactDate ?? ctx.today;
  const chosenContact = contactDate >= ctx.today ? ctx.now.toISOString() : istToUtcIso(contactDate, 10, 0);
  const contact = contactFields({ lastContactAt: chosenContact, lastBuyerMessageAt: null }, chat);

  const base = {
    id: `N${Date.now().toString(36).toUpperCase()}`,
    name: input.name,
    company: input.company,
    phone: input.phone,
    source: input.source,
    repId: input.repId,
    createdAt: ctx.now.toISOString(),
    ...contact,
  };

  // Scored before insert, so a saved lead always has a tag, reason, date and draft.
  const result = await score(ctx, agentLead(base, rep), chat);
  const row: NewLeadRow = { ...base, ...agentFields(result, null, ctx.now) };

  await ctx.db.batch([
    ctx.db.insert(leads).values(row),
    ...chunk(chat.map((m) => ({ leadId: base.id, sender: m.sender, text: m.text, sentAt: m.sentAt, origin: "paste" as const }))).map(
      (rows) => ctx.db.insert(messages).values(rows),
    ),
    ctx.db.insert(agentRuns).values(agentRunRows(base.id, "new_lead", result, ctx.now)),
  ]);

  return c.json((await leadDetail(ctx, base.id))!, 201);
});

app.post("/leads/:id/messages", valid("json", AddMessagesInput), async (c) => {
  const ctx = c.var.ctx;
  const row = await getLead(ctx.db, c.req.param("id"));
  if (!row) return apiError(c, 404, "NOT_FOUND", "Lead not found");

  const rep = repName(row.repId);
  const { text, senders } = c.req.valid("json");
  const parsed = parseChat(text, { repName: rep, buyerName: row.name, now: ctx.now, today: ctx.today });
  const added = applySenders(parsed.messages, senders);
  if (added.length === 0) return apiError(c, 400, "VALIDATION", "No messages found in the pasted text");
  if (added.length > MAX_PASTE_MESSAGES) return apiError(c, 400, "VALIDATION", `Paste at most ${MAX_PASTE_MESSAGES} messages`);

  await ctx.db.batch([
    ctx.db.update(leads).set(contactFields(row, added)).where(eq(leads.id, row.id)),
    ...chunk(added.map((m) => ({ leadId: row.id, sender: m.sender, text: m.text, sentAt: m.sentAt, origin: "paste" as const }))).map(
      (rows) => ctx.db.insert(messages).values(rows),
    ),
  ]);
  await rerunAgent(ctx, row.id, "new_messages", rep);
  return c.json((await leadDetail(ctx, row.id))!);
});

app.patch("/leads/:id/draft", valid("json", DraftInput), async (c) => {
  const ctx = c.var.ctx;
  const updated = await ctx.db
    .update(leads)
    .set({ draft: c.req.valid("json").draft, draftStatus: "edited" })
    .where(eq(leads.id, c.req.param("id")))
    .returning({ id: leads.id });
  if (updated.length === 0) return apiError(c, 404, "NOT_FOUND", "Lead not found");
  return c.json((await leadDetail(ctx, updated[0]!.id))!);
});

/** The rep sent the draft on WhatsApp themselves (PRD A4): save it as a rep message and re-run the agent. */
app.post("/leads/:id/sent", valid("json", DraftInput), async (c) => {
  const ctx = c.var.ctx;
  const row = await getLead(ctx.db, c.req.param("id"));
  if (!row) return apiError(c, 404, "NOT_FOUND", "Lead not found");

  const sentAt = ctx.now.toISOString();
  await ctx.db.batch([
    ctx.db.insert(messages).values({ leadId: row.id, sender: "rep", text: c.req.valid("json").draft, sentAt, origin: "mark_sent" }),
    ctx.db.update(leads).set({ lastContactAt: sentAt }).where(eq(leads.id, row.id)),
  ]);
  await rerunAgent(ctx, row.id, "sent", repName(row.repId));
  return c.json((await leadDetail(ctx, row.id))!);
});

app.post("/leads/:id/regenerate", async (c) => {
  const ctx = c.var.ctx;
  const row = await getLead(ctx.db, c.req.param("id"));
  if (!row) return apiError(c, 404, "NOT_FOUND", "Lead not found");
  await rerunAgent(ctx, row.id, "regenerate", repName(row.repId));
  return c.json((await leadDetail(ctx, row.id))!);
});

app.post("/demo/reset", async (c) => {
  const ctx = c.var.ctx;
  const started = Date.now();
  const result = await resetDemo(ctx.db, ctx.now, ctx.today);
  return c.json({ ok: true, ...result, ms: Date.now() - started });
});

app.notFound((c) => apiError(c, 404, "NOT_FOUND", "Not found"));
app.onError((err, c) => {
  console.error(err);
  return apiError(c, 500, "INTERNAL", "Something went wrong");
});

export default app;
