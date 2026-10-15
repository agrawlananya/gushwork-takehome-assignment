import { z } from "zod";
import { AGENT_SOURCES, DATE_RULES, DRAFT_STATUSES, SENDERS, SOURCES, TAGS } from "./constants";

export const Tag = z.enum(TAGS);
export type Tag = z.infer<typeof Tag>;

export const Sender = z.enum(SENDERS);
export type Sender = z.infer<typeof Sender>;

export const Source = z.enum(SOURCES);
export type Source = z.infer<typeof Source>;

export const DateRule = z.enum(DATE_RULES);
export type DateRule = z.infer<typeof DateRule>;

export const DraftStatus = z.enum(DRAFT_STATUSES);
export type DraftStatus = z.infer<typeof DraftStatus>;

export const AgentSource = z.enum(AGENT_SOURCES);
export type AgentSource = z.infer<typeof AgentSource>;
