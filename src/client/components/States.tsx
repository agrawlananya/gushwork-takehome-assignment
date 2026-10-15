import { AlertTriangle, LoaderCircle } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 font-semibold underline underline-offset-2">
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
    <div role="status" className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
