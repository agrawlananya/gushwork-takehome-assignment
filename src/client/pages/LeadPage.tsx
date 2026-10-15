import type { LeadDetail, Message } from "@shared/api";
import { formatPhone } from "@shared/phone";
import type { Sender } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Phone, Undo2 } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { AddMessages } from "@/components/AddMessages";
import { RuleBasedBadge, TagBadge } from "@/components/Badges";
import { ChatThread } from "@/components/ChatThread";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DraftEditor } from "@/components/DraftEditor";
import { AgentUpdating, ErrorState } from "@/components/States";
import { api, keys } from "@/lib/api";
import { chatTime, nextDateText, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Lead detail (PRD §8.3). Phone order: tag + reason → draft → chat (D-9).
export function LeadPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: keys.lead(id), queryFn: () => api.lead(id) });
  /** Result note after an agent run. After "Mark as sent" it carries the sent message, so it can be undone. */
  const [notice, setNotice] = useState<{ text: string; undoMessageId?: number } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Message | null>(null);

  /** After any change: show the new lead right away, and refresh the lists and counts. */
  function applied(data: LeadDetail) {
    queryClient.setQueryData(keys.lead(id), data);
    void queryClient.invalidateQueries({ queryKey: keys.allLeads });
    void queryClient.invalidateQueries({ queryKey: keys.meta });
  }

  const saveDraft = useMutation({ mutationFn: (draft: string) => api.saveDraft(id, draft), onSuccess: applied });
  const markSent = useMutation({
    mutationFn: (draft: string) => api.markSent(id, draft),
    onSuccess: (data) => {
      applied(data);
      const sent = data.messages.findLast((m) => m.sender === "rep" && m.removable);
      setNotice({
        text: `Marked as sent. Next follow-up: ${shortDate(data.lead.nextFollowUpDate)}. A new draft is ready for then.`,
        undoMessageId: sent?.id,
      });
    },
  });
  const regenerate = useMutation({
    mutationFn: (instruction?: string) => api.regenerate(id, instruction),
    onSuccess: (data, instruction) => {
      applied(data);
      const what = instruction ? `Rewritten (“${instruction}”)` : "New draft ready";
      setNotice({ text: data.lead.changeNote ? `${what} · ${data.lead.changeNote}` : `${what}.` });
    },
  });
  const addMessages = useMutation({
    mutationFn: ({ text, senders }: { text: string; senders: Sender[] }) => api.addMessages(id, text, senders),
    onSuccess: (data) => {
      applied(data);
      setNotice({ text: data.lead.changeNote ? `Updated · ${data.lead.changeNote}` : "Updated · tag unchanged, new draft ready." });
    },
  });
  const removeMessage = useMutation({
    mutationFn: ({ messageId }: { messageId: number; undo: boolean }) => api.removeMessage(id, messageId),
    onSuccess: (data, { undo }) => {
      applied(data);
      const change = data.lead.changeNote ? ` · ${data.lead.changeNote}` : "";
      setNotice({ text: `${undo ? "Undone: the message is removed" : "Message removed"}${change}. Next follow-up: ${shortDate(data.lead.nextFollowUpDate)}.` });
    },
  });

  const agentBusy = markSent.isPending || regenerate.isPending || addMessages.isPending || removeMessage.isPending;
  const mutationError = markSent.error ?? regenerate.error ?? addMessages.error ?? removeMessage.error ?? saveDraft.error;

  // Back keeps the list as it was (rep, scroll) when we came from inside the app.
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/"));

  if (detail.isPending) {
    return (
      <Shell onBack={goBack}>
        <div className="mt-4 h-40 max-w-2xl animate-pulse rounded-xl bg-steel" aria-label="Loading lead" />
      </Shell>
    );
  }
  if (detail.isError) {
    return (
      <Shell onBack={goBack}>
        <div className="mt-4 max-w-2xl">
          <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />
        </div>
      </Shell>
    );
  }

  const { lead, messages, today } = detail.data;

  return (
    <Shell onBack={goBack}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-4">
          <header className="mt-1">
            <h1 className="cond text-[34px] leading-[0.95] font-extrabold">{lead.name}</h1>
            <p className="mt-1 text-[17px] font-medium text-ink-soft">{lead.company}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 text-sm text-ink-soft">
              <a href={`tel:${lead.phone}`} className="-my-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-teal underline-offset-4 hover:underline">
                <Phone className="size-3.5" aria-hidden />
                {formatPhone(lead.phone)}
              </a>
              <span>{lead.source}</span>
              <span>
                Rep <span className="font-semibold text-ink">{lead.repName}</span>
              </span>
            </div>
            <p className="mt-0.5 text-sm text-mute">Last contact {chatTime(lead.lastContactAt)}</p>
          </header>

          <section aria-label="Agent's view" className="panel relative mt-4 overflow-hidden p-4">
            {lead.overdueDays > 0 && <span className="absolute inset-y-0 left-0 w-[5px] bg-signal" aria-hidden />}
            <div className="flex flex-wrap items-center gap-2">
              <TagBadge tag={lead.tag} size="lg" />
              {lead.agentSource === "rules" && <RuleBasedBadge />}
            </div>
            <p className="mt-2 text-[17px] leading-snug font-semibold text-ink">{lead.reason}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
              <div>
                <dt className="text-xs text-mute">Next follow-up</dt>
                <dd className={cn("cond mt-0.5 text-lg leading-tight font-extrabold", lead.overdueDays > 0 ? "text-signal" : "text-ink")}>
                  {nextDateText(lead, today)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mute">Why this date</dt>
                <dd className="mt-0.5 leading-snug text-ink-soft">{lead.dateRuleLabel}</dd>
              </div>
            </dl>
          </section>

          <div className="mt-3 space-y-2" aria-live="polite">
            {agentBusy && !removeMessage.isPending && <AgentUpdating />}
            {agentBusy && removeMessage.isPending && <AgentUpdating label="Removing the message and updating this lead…" />}
            {notice && !agentBusy && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-leaf-deep">
                <p className="min-w-0 flex-1">{notice.text}</p>
                {notice.undoMessageId !== undefined && (
                  <button
                    type="button"
                    className="-my-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 font-bold text-leaf-deep underline-offset-4 hover:bg-white/60 hover:underline"
                    onClick={() => removeMessage.mutate({ messageId: notice.undoMessageId!, undo: true })}
                  >
                    <Undo2 className="size-4" aria-hidden /> Undo
                  </button>
                )}
              </div>
            )}
            {mutationError && !agentBusy && <ErrorState message={mutationError.message} />}
          </div>

          <div className="mt-3">
            <DraftEditor
              lead={lead}
              busy={agentBusy}
              onSave={(draft) => saveDraft.mutateAsync(draft)}
              onMarkSent={(draft) => {
                setNotice(null);
                markSent.mutate(draft);
              }}
              onRegenerate={(instruction) => {
                setNotice(null);
                regenerate.mutate(instruction);
              }}
            />
          </div>
        </div>

        <section aria-labelledby="chat-heading" className="mt-6 lg:mt-1">
          <h2 id="chat-heading" className="cond mb-2 text-xl font-extrabold">
            Chat
          </h2>
          <div className="rounded-xl bg-steel/60 p-3">
            <ChatThread messages={messages} buyerName={lead.name} repName={lead.repName} busy={agentBusy} onRemove={setConfirmRemove} />
          </div>
          <div className="mt-3">
            <AddMessages
              repName={lead.repName}
              buyerName={lead.name}
              draftEdited={lead.draftStatus === "edited"}
              busy={agentBusy}
              onAdd={(text, senders) => {
                setNotice(null);
                return addMessages.mutateAsync({ text, senders });
              }}
            />
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove this message?"
        confirmLabel="Remove"
        danger
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          const message = confirmRemove;
          setConfirmRemove(null);
          setNotice(null);
          if (message) removeMessage.mutate({ messageId: message.id, undo: false });
        }}
      >
        <p>It's removed from this chat and the agent updates the lead. It isn't deleted from WhatsApp.</p>
        {confirmRemove && <p className="mt-3 line-clamp-3 rounded-lg bg-leaf p-2.5 text-ink">{confirmRemove.text}</p>}
      </ConfirmDialog>
    </Shell>
  );
}

function Shell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 lg:max-w-6xl lg:px-8">
      <button type="button" onClick={onBack} className="btn-link -ml-1 text-ink-soft">
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>
      {children}
    </div>
  );
}
