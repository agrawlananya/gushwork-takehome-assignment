import { sql } from "drizzle-orm";
import type { Db } from "../db/queries";
import { rateLimits } from "../db/schema";

// No login on a public link, so AI runs are capped (Tech §10). Over a cap the agent uses
// the backup rules instead of failing.

export const AI_RUNS_PER_VISITOR_PER_HOUR = 30;

/**
 * Counts one AI run for this visitor and for the day, and says whether it is within budget.
 * Counters are bumped even when over the limit; that only matters for abusers.
 */
export async function takeAiBudget(db: Db, ip: string, now: Date, dailyLimit: number): Promise<boolean> {
  const iso = now.toISOString();
  const visitorKey = `ip:${await hash(ip)}:${iso.slice(0, 13)}`; // per UTC hour
  const globalKey = `global:${iso.slice(0, 10)}`; // per UTC day (Gemini's free quota resets on Pacific time; close enough)

  const bump = (key: string) =>
    db
      .insert(rateLimits)
      .values({ key, count: 1 })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count });

  const [visitor, global] = await db.batch([bump(visitorKey), bump(globalKey)]);
  return (visitor[0]?.count ?? 0) <= AI_RUNS_PER_VISITOR_PER_HOUR && (global[0]?.count ?? 0) <= dailyLimit;
}

/** IPs are hashed so the table never stores one. */
async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lead-followup:${value}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
