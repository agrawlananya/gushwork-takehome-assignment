import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  AGENT_SOURCES,
  AGENT_TRIGGERS,
  DATE_RULES,
  DRAFT_STATUSES,
  MESSAGE_ORIGINS,
  SENDERS,
  SOURCES,
  TAGS,
} from "../../shared/constants";

// Tech §4. Timestamps are UTC ISO strings; follow-up dates are IST `YYYY-MM-DD`.

export const reps = sqliteTable("reps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

/**
 * The lead row also holds the latest agent result, so the Today list is one query.
 * Agent fields are NOT NULL: a new lead is scored before it is inserted.
 */
export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    company: text("company").notNull(),
    phone: text("phone").notNull().unique(),
    source: text("source", { enum: SOURCES }).notNull(),
    repId: text("rep_id")
      .notNull()
      .references(() => reps.id),
    lastContactAt: text("last_contact_at").notNull(),
    // Not in Tech §4: kept here so the sort tie-break (newest buyer message first) needs no join.
    lastBuyerMessageAt: text("last_buyer_message_at"),
    createdAt: text("created_at").notNull(),

    tag: text("tag", { enum: TAGS }).notNull(),
    reason: text("reason").notNull(),
    needsReply: integer("needs_reply", { mode: "boolean" }).notNull(),
    buyerSaidNo: integer("buyer_said_no", { mode: "boolean" }).notNull(),
    requestedDate: text("requested_date"),
    nextFollowUpDate: text("next_follow_up_date").notNull(),
    dateRule: text("date_rule", { enum: DATE_RULES }).notNull(),
    draft: text("draft").notNull(),
    draftStatus: text("draft_status", { enum: DRAFT_STATUSES }).notNull().default("ai"),
    agentSource: text("agent_source", { enum: AGENT_SOURCES }).notNull(),
    agentUpdatedAt: text("agent_updated_at").notNull(),
    changeNote: text("change_note"),
  },
  (t) => [index("leads_rep_next_idx").on(t.repId, t.nextFollowUpDate)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sender: text("sender", { enum: SENDERS }).notNull(),
    text: text("text").notNull(),
    sentAt: text("sent_at").notNull(),
    origin: text("origin", { enum: MESSAGE_ORIGINS }).notNull(),
  },
  (t) => [index("messages_lead_sent_idx").on(t.leadId, t.sentAt)],
);

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: text("lead_id").notNull(),
    trigger: text("trigger", { enum: AGENT_TRIGGERS }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    error: text("error"),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    outputJson: text("output_json"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("agent_runs_lead_idx").on(t.leadId)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
});

export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
