import { MAX_PASTE_CHARS, MAX_PASTE_MESSAGES } from "@shared/constants";
import { parseChat } from "@shared/parseChat";
import type { Sender } from "@shared/types";
import { ArrowLeftRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * PRD §8.4: paste WhatsApp lines (export format or "Buyer: …" / "Rep: …"), check who sent
 * each one (tap to switch, C-3), then "Add & update" re-runs the agent.
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
  onAdd: (text: string, senders: Sender[]) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  /** The rep's Buyer/Rep switches, by message position. Cleared when the text changes. */
  const [switched, setSwitched] = useState<Record<number, Sender>>({});

  // Same parser as the Worker, so the preview matches what gets saved.
  const preview = useMemo(() => (text.trim() ? parseChat(text, { repName, buyerName }) : null), [text, repName, buyerName]);
  const senders = preview?.messages.map((m, i) => switched[i] ?? m.sender) ?? [];
  const buyerCount = senders.filter((s) => s === "buyer").length;
  const guessed = preview?.messages.filter((m, i) => !m.senderKnown && switched[i] === undefined).length ?? 0;

  const tooLong = text.length > MAX_PASTE_CHARS;
  const tooMany = senders.length > MAX_PASTE_MESSAGES;
  const canAdd = senders.length > 0 && !tooLong && !tooMany && !busy;
  const firstName = buyerName.split(" ")[0];

  function close() {
    setText("");
    setSwitched({});
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Add messages
      </button>
    );
  }

  return (
    <div className="panel p-4">
      <label htmlFor="paste" className="label">
        Paste new WhatsApp messages
      </label>
      <textarea
        id="paste"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSwitched({});
        }}
        rows={5}
        disabled={busy}
        placeholder={`Paste from WhatsApp, or type lines like:\nBuyer: Can you do it for 1,30,000?\nRep: Let me check and revert`}
        className="field font-mono text-sm"
        autoFocus
      />
      <p className={cn("mt-1.5 text-xs tabular-nums", tooLong ? "font-semibold text-signal" : "text-mute")}>
        {text.length.toLocaleString("en-IN")} / {MAX_PASTE_CHARS.toLocaleString("en-IN")} characters
      </p>

      {preview && (
        <div className="mt-3 rounded-lg border border-line bg-paper/70 p-3 text-sm" aria-live="polite">
          {senders.length === 0 ? (
            <p className="text-ink-soft">No messages found yet.</p>
          ) : (
            <>
              <p className="font-bold">
                {plural(senders.length, "message")} found ({buyerCount} from {firstName}, {senders.length - buyerCount} from {repName})
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">Tap a name to switch who sent it.</p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {preview.messages.map((m, i) => {
                  const sender = senders[i]!;
                  const unsure = !m.senderKnown && switched[i] === undefined;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setSwitched((s) => ({ ...s, [i]: sender === "rep" ? "buyer" : "rep" }))}
                        className={cn(
                          "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold ring-1 ring-inset",
                          sender === "rep" ? "bg-leaf text-leaf-deep ring-leaf-deep/30" : "bg-white text-ink ring-ink/25",
                          unsure && "ring-2 ring-saffron-deep ring-offset-1",
                        )}
                        aria-label={`Sent by ${sender === "rep" ? repName : firstName}. Switch`}
                        title="Switch who sent this"
                      >
                        {sender === "rep" ? repName : firstName}
                        <ArrowLeftRight className="size-3" aria-hidden />
                      </button>
                      <span className="line-clamp-2 min-w-0 pt-3 text-ink-soft">{m.text}</span>
                    </li>
                  );
                })}
              </ul>
              {guessed > 0 && (
                <p className="mt-2 text-xs font-semibold text-saffron-deep">
                  {guessed === 1 ? "This message didn't say who sent it" : `${guessed} messages didn't say who sent them`}, so we guessed
                  (outlined). Please check.
                </p>
              )}
            </>
          )}
          {tooMany && <p className="mt-2 font-semibold text-signal">Paste at most {MAX_PASTE_MESSAGES} messages at a time.</p>}
        </div>
      )}

      {draftEdited && <p className="mt-3 text-xs font-medium text-saffron-deep">New messages replace your edited draft with a fresh one.</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={!canAdd}
          onClick={async () => {
            try {
              await onAdd(text, senders);
              close();
            } catch {
              // The page shows the error; keep the pasted text so nothing is lost.
            }
          }}
        >
          Add &amp; update
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}
