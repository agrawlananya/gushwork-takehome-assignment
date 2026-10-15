import type { Tag } from "@shared/types";
import type { Due } from "@/lib/format";
import { cn } from "@/lib/utils";

// Tags always show the word, never colour alone (PRD NFR "Clarity"). Solid fills, like carton labels.
// Overdue red and Hot saffron are kept distinct: red is used for nothing but overdue.
const TAG_STYLES: Record<Tag, string> = {
  hot: "bg-saffron text-ink",
  warm: "bg-turmeric text-ink",
  cold: "bg-steel text-ink-soft",
};

export function TagBadge({ tag, size = "sm", className }: { tag: Tag; size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "cond inline-flex shrink-0 items-center rounded-[3px] font-extrabold tracking-wide",
        size === "lg" ? "px-2 py-0.5 text-base" : "px-1.5 text-[13px] leading-5",
        TAG_STYLES[tag],
        className,
      )}
    >
      {tag.toUpperCase()}
    </span>
  );
}

const DUE_STYLES: Record<Due["kind"], string> = {
  overdue: "text-signal",
  today: "text-teal",
  later: "text-mute",
};

export function DueBadge({ due }: { due: Due }) {
  return <span className={cn("cond text-[15px] leading-5 font-extrabold", DUE_STYLES[due.kind])}>{due.label}</span>;
}

export function RuleBasedBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-dashed border-ink/40 px-2 py-0.5 text-xs font-semibold text-ink-soft"
      title="The AI was unavailable, so backup rules wrote this. The draft may be more generic."
    >
      Rule-based
    </span>
  );
}
