import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const IST = "Asia/Kolkata";

// India has no daylight saving, so IST is always UTC+05:30.
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in India time as `YYYY-MM-DD`. Workers run on UTC, so never use `new Date()` for "today". */
export function todayIST(now: Date = new Date()): string {
  return format(new TZDate(now, IST), "yyyy-MM-dd");
}

/** The IST calendar date of a UTC timestamp. */
export function istDateOf(timestamp: string | Date): string {
  return todayIST(new Date(timestamp));
}

/** An IST wall-clock time on an IST date, as a UTC ISO string. */
export function istToUtcIso(date: string, hours: number, minutes: number): string {
  return new Date(dateToUtcMs(date) + hours * 3_600_000 + minutes * 60_000 - IST_OFFSET_MS).toISOString();
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const ms = dateToUtcMs(value);
  return !Number.isNaN(ms) && msToDate(ms) === value;
}

// Calendar maths on plain `YYYY-MM-DD` strings (no time zone involved).

export function addDays(date: string, days: number): string {
  return msToDate(dateToUtcMs(date) + days * DAY_MS);
}

/** Whole calendar days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((dateToUtcMs(a) - dateToUtcMs(b)) / DAY_MS);
}

/** Days a follow-up is late. 0 when due today or in the future. Worked out on read, so no nightly job is needed. */
export function overdueDays(nextFollowUpDate: string, today: string): number {
  return Math.max(0, diffDays(today, nextFollowUpDate));
}

export function isSunday(date: string): boolean {
  return new Date(dateToUtcMs(date)).getUTCDay() === 0;
}

/** Mon–Sat working days (PRD A6): a Sunday moves to Monday. */
export function moveOffSunday(date: string): string {
  return isSunday(date) ? addDays(date, 1) : date;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

function dateToUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Format a UTC timestamp in IST with a date-fns pattern, e.g. "EEE d MMM HH:mm". */
export function formatIST(timestamp: string | Date, pattern: string): string {
  return format(new TZDate(new Date(timestamp), IST), pattern);
}

/** Format an IST `YYYY-MM-DD` date, e.g. "EEE d MMM" → "Thu 15 Oct". */
export function formatDate(date: string, pattern: string): string {
  return format(new TZDate(dateToUtcMs(date), "UTC"), pattern);
}
