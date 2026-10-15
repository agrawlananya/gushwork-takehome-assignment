import type { Meta } from "@shared/api";
import { cn } from "@/lib/utils";

/** "5 need reply · 8 overdue · 5 hot" (PRD T-4) for the rep being viewed. */
function Counts({ meta, rep }: { meta: Meta; rep: string | null }) {
  const counts = rep ? meta.counts.byRep[rep] : meta.counts.all;
  if (!counts) return null;
  const parts = [
    { n: counts.needsReply, label: "need reply", tone: "text-slate-900" },
    { n: counts.overdue, label: "overdue", tone: "text-red-700" },
    { n: counts.hot, label: "hot", tone: "text-orange-800" },
  ];
  return (
    <p className="text-sm">
      {parts.map((p, i) => (
        <span key={p.label}>
          {i > 0 && <span className="text-slate-400"> · </span>}
          <span className={cn("font-bold", p.n > 0 ? p.tone : "text-slate-500")}>{p.n}</span>{" "}
          <span className="text-slate-600">{p.label}</span>
        </span>
      ))}
    </p>
  );
}

/** Owner view (PRD J4): one scrollable row of per-rep counts; tapping one opens that rep's list. */
function PerRep({ meta, onPickRep }: { meta: Meta; onPickRep: (rep: string) => void }) {
  return (
    <ul className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Counts per rep">
      {meta.reps.map((r) => {
        const c = meta.counts.byRep[r.id];
        if (!c) return null;
        return (
          <li key={r.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onPickRep(r.id)}
              className="min-h-9 rounded-full border border-slate-200 bg-white px-2.5 text-xs whitespace-nowrap text-slate-700 hover:border-slate-300"
              title={`Show ${r.name}'s list`}
            >
              <span className="font-semibold text-slate-900">{r.name}</span>
              {c.overdue > 0 && <span className="text-red-700"> · {c.overdue} overdue</span>}
              {c.hot > 0 && <span className="text-orange-800"> · {c.hot} hot</span>}
              {c.overdue === 0 && c.hot === 0 && <span> · all clear</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const SummaryStrip = { Counts, PerRep };
