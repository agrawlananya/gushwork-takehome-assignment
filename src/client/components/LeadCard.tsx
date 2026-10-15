import type { Lead } from "@shared/api";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { DueBadge, TagBadge } from "@/components/Badges";
import { dueOf } from "@/lib/format";

/**
 * PRD T-3: due label, tag, name, company, one-line reason, rep name (All reps view).
 * `position` is the lead's place in today's queue: 1 = message first.
 */
export function LeadCard({ lead, today, showRep, position }: { lead: Lead; today: string; showRep: boolean; position?: number }) {
  const due = dueOf(lead, today);
  const overdue = due.kind === "overdue";
  return (
    <Link
      to={`/lead/${lead.id}`}
      className="group relative flex items-stretch gap-2.5 overflow-hidden rounded-[10px] border border-line bg-white py-2 pr-1.5 pl-3.5 transition-colors hover:border-ink/30"
    >
      {overdue && <span className="absolute inset-y-0 left-0 w-[5px] bg-signal" aria-hidden />}
      {position !== undefined && (
        <span className="cond w-6 shrink-0 pt-px text-right text-[28px] leading-none font-extrabold text-ink tabular-nums" aria-hidden>
          {position}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <DueBadge due={due} />
          <TagBadge tag={lead.tag} />
          {showRep && <span className="ml-auto shrink-0 text-xs font-medium text-mute">{lead.repName}</span>}
        </div>
        <p className="mt-0.5 truncate leading-snug">
          <span className="font-bold">{lead.name}</span>
          <span className="ml-1.5 text-sm text-mute">{lead.company}</span>
        </p>
        <p className="line-clamp-2 text-sm leading-[1.35] text-ink-soft">{lead.reason}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 self-center text-ink/30 transition-colors group-hover:text-ink/60" aria-hidden />
    </Link>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[10px] border border-line bg-white p-3 pl-12" aria-hidden>
      <div className="h-4 w-1/3 rounded bg-steel" />
      <div className="mt-2 h-4 w-2/3 rounded bg-steel/70" />
      <div className="mt-2 h-3 w-full rounded bg-paper" />
    </div>
  );
}
