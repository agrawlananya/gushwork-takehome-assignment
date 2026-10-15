import { AlertTriangle, LoaderCircle } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-signal/30 bg-signal/[0.06] p-3.5 text-sm text-ink">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-signal" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-1 inline-flex min-h-11 items-center font-semibold text-signal underline underline-offset-4">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** Shown while the agent runs (Tech §9: "Agent is updating…"). */
export function AgentUpdating({ label = "Agent is updating this lead…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-lg bg-teal/10 px-3 py-2.5 text-sm font-semibold text-teal">
      <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
