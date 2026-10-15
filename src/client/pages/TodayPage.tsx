import type { Lead } from "@shared/api";
import { groupLeads, GROUP_LABELS } from "@shared/sort";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { TagBadge } from "@/components/Badges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LeadCard, LeadCardSkeleton } from "@/components/LeadCard";
import { RepSwitcher } from "@/components/RepSwitcher";
import { ErrorState } from "@/components/States";
import { SummaryStrip } from "@/components/SummaryStrip";
import { api, keys } from "@/lib/api";
import { plural, shortDate } from "@/lib/format";
import { repLabel, useRep } from "@/lib/useRep";
import { cn } from "@/lib/utils";

// Home (PRD §8.2). Pure database reads: no AI runs when this screen loads (T-9).
export function TodayPage() {
  const [rep, setRep] = useRep();
  const queryClient = useQueryClient();
  const meta = useQuery({ queryKey: keys.meta, queryFn: api.meta });
  const today = useQuery({ queryKey: keys.leads("today", rep), queryFn: () => api.leads("today", rep) });
  const upcoming = useQuery({ queryKey: keys.leads("upcoming", rep), queryFn: () => api.leads("upcoming", rep) });
  const all = useQuery({ queryKey: keys.leads("all", rep), queryFn: () => api.leads("all", rep) });

  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const todayIso = meta.data?.today ?? today.data?.today;
  const showRep = rep === null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10">
      {/* Kept short so the top 5 follow-ups fit on a phone screen without scrolling (PRD §4.3). */}
      <header className="border-b border-slate-200 pt-2 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold">
            Follow-ups{todayIso && <span className="font-normal text-slate-600"> · {shortDate(todayIso)}</span>}
          </h1>
          <Link to="/new" className="btn-primary min-h-10 shrink-0 px-3">
            <Plus className="size-4" aria-hidden /> New lead
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <RepSwitcher rep={rep} onChange={setRep} />
          {meta.data ? <SummaryStrip.Counts meta={meta.data} rep={rep} /> : <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />}
        </div>
        {meta.data && !rep && <SummaryStrip.PerRep meta={meta.data} onPickRep={setRep} />}
      </header>

      {reset.isSuccess && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Demo data restored.
        </p>
      )}

      <section className="mt-3" aria-labelledby="today-heading">
        <h2 id="today-heading" className="sr-only">
          Today
        </h2>
        {today.isPending && <ListSkeleton />}
        {today.isError && <ErrorState message={today.error.message} onRetry={() => today.refetch()} />}
        {today.data && todayIso && (
          today.data.leads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
              <p className="text-lg font-semibold">No follow-ups today 🎉</p>
              <p className="mt-1 text-sm text-slate-600">
                {repLabel(rep)} {rep ? "is" : "are"} all caught up.
              </p>
              <button type="button" className="btn-link" onClick={() => setUpcomingOpen(true)}>
                See what's coming up
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {groupLeads(today.data.leads).map(({ group, leads }) => (
                <div key={group}>
                  <h3 className={cn("mb-1.5 text-xs font-bold tracking-wider uppercase", group === "needs_reply" ? "text-red-800" : "text-slate-600")}>
                    {GROUP_LABELS[group]} <span className="font-normal text-slate-500">({leads.length})</span>
                  </h3>
                  <ul className="space-y-2">
                    {leads.map((lead) => (
                      <li key={lead.id}>
                        <LeadCard lead={lead} today={todayIso} showRep={showRep} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <Collapsible
        title="Upcoming"
        hint="next 7 days"
        count={upcoming.data?.leads.length}
        open={upcomingOpen}
        onToggle={() => setUpcomingOpen((o) => !o)}
      >
        {upcoming.isError && <ErrorState message={upcoming.error.message} onRetry={() => upcoming.refetch()} />}
        {upcoming.data && (upcoming.data.leads.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing due in the next 7 days.</p>
        ) : (
          <CompactList leads={upcoming.data.leads} showRep={showRep} showDate />
        ))}
      </Collapsible>

      <Collapsible title="All leads" count={all.data?.leads.length} open={allOpen} onToggle={() => setAllOpen((o) => !o)}>
        {all.isError && <ErrorState message={all.error.message} onRetry={() => all.refetch()} />}
        {all.data && <SearchableList leads={all.data.leads} showRep={showRep} />}
      </Collapsible>

      <footer className="mt-8 text-center">
        <button type="button" className="btn-link text-slate-600" onClick={() => setConfirmReset(true)} disabled={reset.isPending}>
          {reset.isPending ? "Restoring…" : "Reset demo data"}
        </button>
        {reset.isError && <ErrorState message={reset.error.message} />}
      </footer>

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        confirmLabel="Reset"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          reset.mutate();
        }}
      >
        This restores the 24 sample leads and chats, with dates moved to today. Anything added or edited here is removed.
      </ConfirmDialog>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading follow-ups">
      {[0, 1, 2, 3].map((i) => (
        <LeadCardSkeleton key={i} />
      ))}
    </div>
  );
}

function Collapsible({
  title,
  hint,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  count: number | undefined;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const id = `section-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center justify-between px-4 text-left font-semibold"
        >
          <span>
            {title} {count !== undefined && <span className="font-normal text-slate-500">({count})</span>}
            {hint && <span className="ml-1 text-sm font-normal text-slate-500">· {hint}</span>}
          </span>
          <ChevronDown className={cn("size-5 text-slate-500 transition", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      {open && (
        <div id={id} className="border-t border-slate-200 p-3">
          {children}
        </div>
      )}
    </section>
  );
}

function CompactList({ leads, showRep, showDate }: { leads: Lead[]; showRep: boolean; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link to={`/lead/${lead.id}`} className="flex min-h-12 items-center gap-2 py-2 hover:bg-slate-50">
            {showDate && <span className="w-20 shrink-0 text-xs font-semibold text-slate-600">{shortDate(lead.nextFollowUpDate)}</span>}
            <TagBadge tag={lead.tag} />
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-semibold">{lead.name}</span> <span className="text-slate-500">· {lead.company}</span>
            </span>
            {showRep && <span className="shrink-0 text-xs text-slate-500">{lead.repName}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** PRD T-7: search by name, company or phone. */
function SearchableList({ leads, showRep }: { leads: Lead[]; showRep: boolean }) {
  const [q, setQ] = useState("");
  const text = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const shown = text
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(text) ||
          l.company.toLowerCase().includes(text) ||
          (digits.length >= 3 && l.phone.includes(digits)),
      )
    : [...leads].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search leads</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company or phone"
          className="field pl-9"
        />
      </label>
      <p className="mt-2 text-xs text-slate-500">{plural(shown.length, "lead")}</p>
      <CompactList leads={shown} showRep={showRep} />
    </div>
  );
}
