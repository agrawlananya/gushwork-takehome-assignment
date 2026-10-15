import type { Lead } from "@shared/api";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { DueBadge, TagBadge } from "@/components/Badges";
import { dueOf } from "@/lib/format";
import { cn } from "@/lib/utils";

/** PRD T-3: due label, tag, name, company, one-line reason, rep name (All reps view). */
export function LeadCard({ lead, today, showRep }: { lead: Lead; today: string; showRep: boolean }) {
  const due = dueOf(lead, today);
  return (
    <Link
      to={`/lead/${lead.id}`}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-l-4 border-slate-200 bg-white py-2 pr-2 pl-3 transition hover:border-slate-300 hover:bg-slate-50",
        due.kind === "overdue" ? "border-l-red-600" : "border-l-slate-200",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <DueBadge due={due} />
          <TagBadge tag={lead.tag} />
          {showRep && <span className="ml-auto shrink-0 text-xs text-slate-500">{lead.repName}</span>}
        </div>
        <p className="mt-1 truncate font-semibold text-slate-900">
          {lead.name} <span className="font-normal text-slate-500">· {lead.company}</span>
        </p>
        <p className="line-clamp-2 text-sm leading-snug text-slate-700">{lead.reason}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
    </Link>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-3" aria-hidden>
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-full rounded bg-slate-100" />
    </div>
  );
}
