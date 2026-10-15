import type { Lead } from "@shared/api";
import { diffDays, formatDate, formatIST } from "@shared/dates";

/** "Thu 15 Oct" */
export function shortDate(date: string): string {
  return formatDate(date, "EEE d MMM");
}

/** Chat bubble time: "12 Oct, 4:15 pm" (IST). */
export function chatTime(timestamp: string): string {
  return formatIST(timestamp, "d MMM, h:mm a").replace("AM", "am").replace("PM", "pm");
}

export type Due = { kind: "overdue" | "today" | "later"; label: string };

/** PRD T-2: overdue label is text, not only colour. */
export function dueOf(lead: Pick<Lead, "overdueDays" | "nextFollowUpDate">, today: string): Due {
  if (lead.overdueDays > 0) return { kind: "overdue", label: `Overdue ${lead.overdueDays}d` };
  if (lead.nextFollowUpDate === today) return { kind: "today", label: "Due today" };
  const days = diffDays(lead.nextFollowUpDate, today);
  return { kind: "later", label: days === 1 ? "Tomorrow" : shortDate(lead.nextFollowUpDate) };
}

/** "Mon 12 Oct (overdue 3 days)" for the lead page. */
export function nextDateText(lead: Pick<Lead, "overdueDays" | "nextFollowUpDate">, today: string): string {
  const date = shortDate(lead.nextFollowUpDate);
  if (lead.overdueDays > 0) return `${date} (overdue ${lead.overdueDays} day${lead.overdueDays === 1 ? "" : "s"})`;
  if (lead.nextFollowUpDate === today) return `${date} (today)`;
  return date;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
