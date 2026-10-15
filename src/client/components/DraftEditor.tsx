import type { Lead } from "@shared/api";
import { Check, Copy, RefreshCw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * PRD D-3…D-6: editable draft (saved on blur), Copy, Mark as sent, Regenerate
 * (asks first if the rep edited the draft).
 */
export function DraftEditor({
  lead,
  busy,
  onSave,
  onMarkSent,
  onRegenerate,
}: {
  lead: Lead;
  busy: boolean;
  onSave: (draft: string) => Promise<unknown>;
  onMarkSent: (draft: string) => void;
  onRegenerate: () => void;
}) {
  const [text, setText] = useState(lead.draft);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A new agent result replaces the text in the box.
  useEffect(() => setText(lead.draft), [lead.draft, lead.agentUpdatedAt]);

  const dirty = text.trim() !== lead.draft.trim();
  const edited = lead.draftStatus === "edited" || dirty;

  async function save() {
    if (!dirty || !text.trim()) return;
    setSaving(true);
    try {
      await onSave(text);
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked: select the text and use the old copy command.
      textareaRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section aria-labelledby="draft-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="draft-heading" className="font-semibold">
          Draft message
        </h2>
        <span className="text-xs text-slate-500" aria-live="polite">
          {saving ? "Saving…" : edited ? "Edited" : "Written by the agent"}
        </span>
      </div>
      <label htmlFor="draft" className="sr-only">
        Draft WhatsApp message
      </label>
      <textarea
        id="draft"
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={Math.min(8, Math.max(4, text.split("\n").length + 1))}
        maxLength={1000}
        disabled={busy}
        className="field field-sizing-content min-h-32 resize-y leading-relaxed"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="btn-secondary" disabled={busy || !text.trim()}>
          {copied ? <Check className="size-4 text-emerald-700" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={() => onMarkSent(text)} className="btn-primary" disabled={busy || !text.trim()}>
          <Send className="size-4" aria-hidden /> Mark as sent
        </button>
        <button
          type="button"
          onClick={() => (edited ? setConfirmRegenerate(true) : onRegenerate())}
          className="btn-link ml-auto"
          disabled={busy}
        >
          <RefreshCw className="size-4" aria-hidden /> Regenerate
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Copy, send it from your WhatsApp, then tap Mark as sent.</p>

      <ConfirmDialog
        open={confirmRegenerate}
        title="Replace your edited draft?"
        confirmLabel="Replace"
        onCancel={() => setConfirmRegenerate(false)}
        onConfirm={() => {
          setConfirmRegenerate(false);
          onRegenerate();
        }}
      >
        The agent will write a new draft. Your edits will be lost.
      </ConfirmDialog>
    </section>
  );
}
