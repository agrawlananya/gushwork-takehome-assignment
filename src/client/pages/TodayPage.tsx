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
      <header className="pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-baseline gap-2.5">
            <span className="cond text-[32px] leading-none font-extrabold">Follow-ups</span>
            {todayIso && <span className="text-sm font-medium text-ink-soft">{shortDate(todayIso)}</span>}
          </h1>
          <Link to="/new" className="btn-primary shrink-0 px-3.5">
            <Plus className="size-4" aria-hidden /> New lead
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <RepSwitcher rep={rep} onChange={setRep} />
          {meta.data ? <SummaryStrip.Counts meta={meta.data} rep={rep} /> : <div className="h-9 w-40 animate-pulse rounded bg-steel" />}
        </div>
        {meta.data && !rep && (
          <div className="mt-2">
            <SummaryStrip.PerRep meta={meta.data} onPickRep={setRep} />
          </div>
        )}
      </header>

      {reset.isSuccess && (
        <p role="status" className="mt-3 rounded-lg bg-leaf px-3 py-2.5 text-sm font-semibold text-leaf-deep">
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
            <div className="rounded-xl border-[1.5px] border-dashed border-ink/25 bg-white px-6 pt-7 pb-4 text-center">
              <p className="cond text-2xl font-extrabold">No follow-ups today 🎉</p>
              <p className="mt-1 text-sm text-ink-soft">
                {repLabel(rep)} {rep ? "is" : "are"} all caught up.
              </p>
              <button type="button" className="btn-link" onClick={() => setUpcomingOpen(true)}>
                See what's coming up
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {numbered(groupLeads(today.data.leads)).map(({ group, leads, start }) => (
                <div key={group}>
                  <h3 className="mb-1.5 flex items-baseline gap-2 text-sm font-bold text-ink">
                    {GROUP_LABELS[group]} <span className="text-xs font-semibold text-mute tabular-nums">{leads.length}</span>
                  </h3>
                  <ol className="space-y-1.5" start={start + 1}>
                    {leads.map((lead, i) => (
                      <li key={lead.id}>
                        <LeadCard lead={lead} today={todayIso} showRep={showRep} position={start + i + 1} />
                      </li>
                    ))}
                  </ol>
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
          <p className="px-1 py-2 text-sm text-ink-soft">Nothing due in the next 7 days.</p>
        ) : (
          <CompactList leads={upcoming.data.leads} showRep={showRep} showDate />
        ))}
      </Collapsible>

      <Collapsible title="All leads" count={all.data?.leads.length} open={allOpen} onToggle={() => setAllOpen((o) => !o)}>
        {all.isError && <ErrorState message={all.error.message} onRetry={() => all.refetch()} />}
        {all.data && <SearchableList leads={all.data.leads} showRep={showRep} />}
      </Collapsible>

      <footer className="mt-8 text-center">
        <button type="button" className="btn-link text-ink-soft" onClick={() => setConfirmReset(true)} disabled={reset.isPending}>
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

/** Today's list is one queue across the groups: each group's leads continue the count. */
function numbered<T extends { leads: unknown[] }>(groups: T[]): (T & { start: number })[] {
  let start = 0;
  return groups.map((g) => {
    const out = { ...g, start };
    start += g.leads.length;
    return out;
  });
}

function ListSkeleton() {
  return (
    <div className="space-y-1.5" aria-label="Loading follow-ups">
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
    <section className="panel mt-4 overflow-hidden">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-13 w-full items-center justify-between gap-3 px-4 text-left hover:bg-paper/60"
        >
          <span className="flex items-baseline gap-2">
            <span className="cond text-xl font-extrabold">{title}</span>
            {count !== undefined && <span className="text-xs font-semibold text-mute tabular-nums">{count}</span>}
            {hint && <span className="text-sm text-mute">{hint}</span>}
          </span>
          <ChevronDown className={cn("size-5 text-ink-soft transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      {open && (
        <div id={id} className="border-t border-line p-3">
          {children}
        </div>
      )}
    </section>
  );
}

function CompactList({ leads, showRep, showDate }: { leads: Lead[]; showRep: boolean; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-line/70">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link to={`/lead/${lead.id}`} className="-mx-1 flex min-h-12 items-center gap-2.5 rounded-md px-1 py-2 hover:bg-paper/70">
            {showDate && <span className="cond w-[4.5rem] shrink-0 text-[15px] font-bold text-ink-soft">{shortDate(lead.nextFollowUpDate)}</span>}
            <TagBadge tag={lead.tag} />
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-bold">{lead.name}</span>
              <span className="ml-1.5 text-mute">{lead.company}</span>
            </span>
            {showRep && <span className="shrink-0 text-xs font-medium text-mute">{lead.repName}</span>}
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
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company or phone"
          className="field pl-9"
        />
      </label>
      <p className="mt-2 mb-1 text-xs font-medium text-mute">{plural(shown.length, "lead")}</p>
      <CompactList leads={shown} showRep={showRep} />
    </div>
  );
}
