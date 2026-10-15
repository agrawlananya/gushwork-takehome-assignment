import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Placeholder until P6: proves the client can reach the Worker.
export function TodayPage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });

  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="text-xl font-semibold">Follow-ups</h1>
      {health.isPending && <p className="mt-2 text-slate-500">Loading…</p>}
      {health.isError && <p className="mt-2 text-red-700">Can't reach the server.</p>}
      {health.data && <p className="mt-2 text-slate-700">API ok · today (IST): {health.data.todayIST}</p>}
    </main>
  );
}
