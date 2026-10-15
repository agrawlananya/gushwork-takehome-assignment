import { REPS } from "@shared/constants";
import { ChevronDown } from "lucide-react";

/** "Viewing: [All reps ▼]" (PRD T-5). No login, so this stands in for "my list". */
export function RepSwitcher({ rep, onChange }: { rep: string | null; onChange: (rep: string | null) => void }) {
  return (
    <label className="relative inline-flex min-h-11 items-center rounded-lg border-[1.5px] border-ink/25 bg-white pl-3 transition-colors focus-within:border-teal hover:border-ink/50">
      <span className="text-xs font-medium text-mute">Viewing</span>
      <select
        value={rep ?? "all"}
        onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
        className="min-h-11 cursor-pointer appearance-none bg-transparent pr-8 pl-1.5 text-sm font-bold text-ink focus:outline-none"
      >
        <option value="all">All reps</option>
        {REPS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-4 text-ink-soft" aria-hidden />
    </label>
  );
}
