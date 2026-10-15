import { addDays } from "./dates";
import type { Tag } from "./types";

export const GROUPS = ["needs_reply", "hot", "warm", "cold"] as const;
export type Group = (typeof GROUPS)[number];

export const GROUP_LABELS: Record<Group, string> = {
  needs_reply: "Needs your reply",
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export type SortableLead = {
  name: string;
  tag: Tag;
  needsReply: boolean;
  nextFollowUpDate: string;
  lastBuyerMessageAt: string | null;
};

export type View = "today" | "upcoming" | "all";

export function groupOf(lead: SortableLead): Group {
  return lead.needsReply ? "needs_reply" : lead.tag;
}

/**
 * PRD §10: Needs reply → Hot → Warm → Cold. Inside a group: most overdue
 * (earliest date) first, then the most recent buyer message first.
 */
export function compareLeads(a: SortableLead, b: SortableLead): number {
  return (
    GROUPS.indexOf(groupOf(a)) - GROUPS.indexOf(groupOf(b)) ||
    a.nextFollowUpDate.localeCompare(b.nextFollowUpDate) ||
    compareNewestFirst(a.lastBuyerMessageAt, b.lastBuyerMessageAt) ||
    a.name.localeCompare(b.name)
  );
}

export function sortLeads<T extends SortableLead>(leads: readonly T[]): T[] {
  return [...leads].sort(compareLeads);
}

/** Sorted leads split into their groups, in group order. Empty groups are left out. */
export function groupLeads<T extends SortableLead>(leads: readonly T[]): { group: Group; leads: T[] }[] {
  const sorted = sortLeads(leads);
  return GROUPS.map((group) => ({ group, leads: sorted.filter((l) => groupOf(l) === group) })).filter(
    (g) => g.leads.length > 0,
  );
}

/** Today = due today or overdue. Upcoming = due in the next 7 days. */
export function inView(lead: Pick<SortableLead, "nextFollowUpDate">, view: View, today: string): boolean {
  if (view === "today") return lead.nextFollowUpDate <= today;
  if (view === "upcoming") return lead.nextFollowUpDate > today && lead.nextFollowUpDate <= addDays(today, 7);
  return true;
}

function compareNewestFirst(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b.localeCompare(a);
}
