import type { Meta } from "@shared/api";
import { cn } from "@/lib/utils";

/** "5 need reply, 8 overdue, 5 hot" (PRD T-4) for the rep being viewed. */
function Counts({ meta, rep }: { meta: Meta; rep: string | null }) {
  const counts = rep ? meta.counts.byRep[rep] : meta.counts.all;
  if (!counts) return null;
  const parts = [
    { n: counts.needsReply, label: "need reply", tone: "text-ink" },
    { n: counts.overdue, label: "overdue", tone: "text-signal" },
    { n: counts.hot, label: "hot", tone: "text-saffron-deep" },
  ];
  return (
    <dl className="flex items-end gap-3.5">
      {parts.map((p) => (
        <div key={p.label} className="flex flex-col-reverse items-start">
          <dt className="text-[11px] leading-tight whitespace-nowrap text-mute">{p.label}</dt>
          <dd className={cn("cond text-[22px] leading-none font-extrabold tabular-nums", p.n > 0 ? p.tone : "text-mute/70")}>{p.n}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Owner view (PRD J4): one scrollable row of per-rep counts; tapping one opens that rep's list. */
function PerRep({ meta, onPickRep }: { meta: Meta; onPickRep: (rep: string) => void }) {
  return (
    <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Counts per rep">
      {meta.reps.map((r) => {
        const c = meta.counts.byRep[r.id];
        if (!c) return null;
        return (
          <li key={r.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onPickRep(r.id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-3 text-xs whitespace-nowrap text-ink-soft transition-colors hover:border-ink/40"
              title={`Show ${r.name}'s list`}
            >
              <span className="text-sm font-bold text-ink">{r.name}</span>
              {c.overdue > 0 && <span className="font-semibold text-signal">{c.overdue} overdue</span>}
              {c.hot > 0 && <span className="font-semibold text-saffron-deep">{c.hot} hot</span>}
              {c.overdue === 0 && c.hot === 0 && <span>all clear</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const SummaryStrip = { Counts, PerRep };
