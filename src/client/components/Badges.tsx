import type { Tag } from "@shared/types";
import type { Due } from "@/lib/format";
import { cn } from "@/lib/utils";

// Tags always show the word, never colour alone (PRD NFR "Clarity"). Overdue red and Hot orange are kept distinct.
const TAG_STYLES: Record<Tag, string> = {
  hot: "bg-orange-100 text-orange-800 ring-orange-300",
  warm: "bg-amber-50 text-amber-800 ring-amber-300",
  cold: "bg-slate-100 text-slate-700 ring-slate-300",
};

export function TagBadge({ tag, className }: { tag: Tag; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold tracking-wide ring-1 ring-inset", TAG_STYLES[tag], className)}>
      {tag.toUpperCase()}
    </span>
  );
}

const DUE_STYLES: Record<Due["kind"], string> = {
  overdue: "text-red-700",
  today: "text-blue-700",
  later: "text-slate-600",
};

export function DueBadge({ due }: { due: Due }) {
  return <span className={cn("text-xs font-bold uppercase tracking-wide", DUE_STYLES[due.kind])}>{due.label}</span>;
}

export function RuleBasedBadge() {
  return (
    <span
      className="inline-flex items-center rounded bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-200"
      title="The AI was unavailable, so backup rules wrote this. The draft may be more generic."
    >
      Rule-based
    </span>
  );
}
