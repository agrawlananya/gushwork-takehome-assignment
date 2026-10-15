import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const IST = "Asia/Kolkata";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in India time as `YYYY-MM-DD`. Workers run on UTC, so never use `new Date()` for "today". */
export function todayIST(now: Date = new Date()): string {
  return format(new TZDate(now, IST), "yyyy-MM-dd");
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
