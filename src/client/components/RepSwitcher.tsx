import { REPS } from "@shared/constants";

/** "Viewing: [All reps ▼]" (PRD T-5). No login, so this stands in for "my list". */
export function RepSwitcher({ rep, onChange }: { rep: string | null; onChange: (rep: string | null) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      Viewing
      <select
        value={rep ?? "all"}
        onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900"
      >
        <option value="all">All reps</option>
        {REPS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}
