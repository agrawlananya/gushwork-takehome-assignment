import { MAX_INSTRUCTION_CHARS, QUICK_INSTRUCTIONS, type Lead } from "@shared/api";
import { Check, Copy, RefreshCw, Send, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * PRD D-3…D-6: editable draft (saved on blur), Copy, Mark as sent, Regenerate
 * (asks first if the rep edited the draft). "Rewrite with instructions" lets the rep
 * say how the new draft should read; the agent's rules still apply.
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
  onRegenerate: (instruction?: string) => void;
}) {
  const [text, setText] = useState(lead.draft);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  /** A regenerate waiting for "Replace your edited draft?" (holds the instruction, if any). */
  const [pending, setPending] = useState<{ instruction?: string } | null>(null);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
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

  function regenerate(withInstruction?: string) {
    const clean = withInstruction?.trim() || undefined;
    if (edited) setPending({ instruction: clean });
    else run(clean);
  }

  function run(withInstruction?: string) {
    onRegenerate(withInstruction);
    if (withInstruction) {
      setInstruction("");
      setRewriteOpen(false);
    }
  }

  return (
    <section aria-labelledby="draft-heading" className="panel p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="draft-heading" className="cond text-xl font-extrabold">
          Draft message
        </h2>
        <span className="text-xs font-medium text-mute" aria-live="polite">
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
        rows={5}
        maxLength={1000}
        disabled={busy}
        className="field field-sizing-content min-h-32 resize-y border-leaf-deep/25 bg-leaf/60 leading-relaxed hover:border-leaf-deep/45 focus:bg-white"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="btn-secondary" disabled={busy || !text.trim()}>
          {copied ? <Check className="size-4 text-leaf-deep" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={() => onMarkSent(text)} className="btn-primary" disabled={busy || !text.trim()}>
          <Send className="size-4" aria-hidden /> Mark as sent
        </button>
        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setRewriteOpen((o) => !o)}
            className="btn-link"
            aria-expanded={rewriteOpen}
            aria-controls="rewrite-panel"
            disabled={busy}
          >
            <Wand2 className="size-4" aria-hidden /> Rewrite…
          </button>
          <button type="button" onClick={() => regenerate()} className="btn-link" disabled={busy}>
            <RefreshCw className="size-4" aria-hidden /> Regenerate
          </button>
        </div>
      </div>

      {rewriteOpen && (
        <form
          id="rewrite-panel"
          className="mt-3 rounded-lg border border-line bg-paper/70 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (instruction.trim()) regenerate(instruction);
          }}
        >
          <p className="text-sm font-bold text-ink">How should the new draft read?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_INSTRUCTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => regenerate(q)}
                disabled={busy}
                className="min-h-11 rounded-full border border-ink/20 bg-white px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink/50 disabled:opacity-45"
              >
                {q}
              </button>
            ))}
          </div>
          <label htmlFor="instruction" className="mt-3 block text-xs font-medium text-ink-soft">
            Or say it in your words
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={MAX_INSTRUCTION_CHARS}
              placeholder="e.g. mention the free installation, ask for a site visit"
              className="field min-w-0 flex-1 py-2"
              disabled={busy}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={busy || !instruction.trim()}>
              Rewrite
            </button>
          </div>
          <p className="mt-2 text-xs text-mute">
            The agent still won't invent prices, discounts or dates that aren't in the chat.
          </p>
        </form>
      )}

      <p className="mt-1 text-xs text-mute">Copy, send it from your WhatsApp, then tap Mark as sent.</p>

      <ConfirmDialog
        open={pending !== null}
        title="Replace your edited draft?"
        confirmLabel="Replace"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          run(next?.instruction);
        }}
      >
        The agent will write a new draft{pending?.instruction ? ` (“${pending.instruction}”)` : ""}. Your edits will be lost.
      </ConfirmDialog>
    </section>
  );
}
