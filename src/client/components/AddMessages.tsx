import { MAX_PASTE_CHARS, MAX_PASTE_MESSAGES } from "@shared/constants";
import { parseChat } from "@shared/parseChat";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { plural } from "@/lib/format";

/**
 * PRD §8.4: paste WhatsApp lines (export format or "Buyer: …" / "Rep: …"),
 * see a preview, then "Add & update" re-runs the agent.
 */
export function AddMessages({
  repName,
  buyerName,
  draftEdited,
  busy,
  onAdd,
}: {
  repName: string;
  buyerName: string;
  draftEdited: boolean;
  busy: boolean;
  onAdd: (text: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  // Same parser as the Worker, so the preview matches what gets saved.
  const preview = useMemo(() => (text.trim() ? parseChat(text, { repName, buyerName }) : null), [text, repName, buyerName]);
  const tooLong = text.length > MAX_PASTE_CHARS;
  const tooMany = (preview?.messages.length ?? 0) > MAX_PASTE_MESSAGES;
  const canAdd = !!preview && preview.messages.length > 0 && !tooLong && !tooMany && !busy;

  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Add messages
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor="paste" className="label">
        Paste new WhatsApp messages
      </label>
      <textarea
        id="paste"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        disabled={busy}
        placeholder={`Paste from WhatsApp, or type lines like:\nBuyer: Can you do it for 1,30,000?\nRep: Let me check and revert`}
        className="field font-mono text-sm"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
        <span className={tooLong ? "font-semibold text-red-700" : "text-slate-500"}>
          {text.length.toLocaleString("en-IN")} / {MAX_PASTE_CHARS.toLocaleString("en-IN")} characters
        </span>
        <span className="text-slate-500">Lines from {repName} count as yours; everyone else is the buyer.</span>
      </div>

      {preview && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm" aria-live="polite">
          {preview.messages.length === 0 ? (
            <p className="text-slate-700">No messages found yet.</p>
          ) : (
            <>
              <p className="font-semibold">
                {plural(preview.messages.length, "message")} found ({preview.counts.buyer} from buyer, {preview.counts.rep} from rep)
              </p>
              <ul className="mt-2 space-y-1">
                {preview.messages.slice(-5).map((m, i) => (
                  <li key={i} className="truncate text-slate-700">
                    <span className={m.sender === "rep" ? "font-semibold text-emerald-800" : "font-semibold text-slate-900"}>
                      {m.sender === "rep" ? "Rep" : "Buyer"}:
                    </span>{" "}
                    {m.text}
                  </li>
                ))}
              </ul>
              {preview.messages.length > 5 && <p className="mt-1 text-xs text-slate-500">Showing the last 5.</p>}
              <p className="mt-2 text-xs text-slate-500">Wrong side? Start the line with "Buyer:" or "Rep:".</p>
            </>
          )}
          {tooMany && <p className="mt-2 font-semibold text-red-700">Paste at most {MAX_PASTE_MESSAGES} messages at a time.</p>}
        </div>
      )}

      {draftEdited && <p className="mt-3 text-xs text-amber-800">New messages replace your edited draft with a fresh one.</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={!canAdd}
          onClick={async () => {
            try {
              await onAdd(text);
              setText("");
              setOpen(false);
            } catch {
              // The page shows the error; keep the pasted text so nothing is lost.
            }
          }}
        >
          Add &amp; update
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            setText("");
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
