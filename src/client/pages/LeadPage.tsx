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
    mutationFn: () => api.regenerate(id),
    onSuccess: (data) => {
      applied(data);
      setNotice({ text: data.lead.changeNote ? `New draft ready · ${data.lead.changeNote}` : "New draft ready." });
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
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-200" aria-label="Loading lead" />
      </Shell>
    );
  }
  if (detail.isError) {
    return (
      <Shell onBack={goBack}>
        <div className="mt-4">
          <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />
        </div>
      </Shell>
    );
  }

  const { lead, messages, today } = detail.data;

  return (
    <Shell onBack={goBack}>
      <header className="mt-2">
        <h1 className="text-xl font-bold">
          {lead.name} <span className="font-normal text-slate-500">· {lead.company}</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
            <Phone className="size-3.5" aria-hidden />
            {formatPhone(lead.phone)}
          </a>
          <span>· {lead.source}</span>
          <span>· Rep: {lead.repName}</span>
        </p>
        <p className="text-sm text-slate-500">Last contact {chatTime(lead.lastContactAt)}</p>
      </header>

      <section
        aria-label="Agent's view"
        className={cn("mt-4 rounded-xl border bg-white p-4", lead.overdueDays > 0 ? "border-l-4 border-red-200 border-l-red-600" : "border-slate-200")}
      >
        <div className="flex flex-wrap items-start gap-2">
          <TagBadge tag={lead.tag} className="mt-0.5" />
          <p className="min-w-0 flex-1 font-medium text-slate-900">"{lead.reason}"</p>
          {lead.agentSource === "rules" && <RuleBasedBadge />}
        </div>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <dt className="text-slate-500">Next follow-up</dt>
          <dd className={cn("font-semibold", lead.overdueDays > 0 ? "text-red-700" : "text-slate-900")}>{nextDateText(lead, today)}</dd>
          <dt className="text-slate-500">Why this date</dt>
          <dd className="text-slate-800">{lead.dateRuleLabel}</dd>
        </dl>
      </section>

      <div className="mt-3 space-y-2" aria-live="polite">
        {agentBusy && !removeMessage.isPending && <AgentUpdating />}
        {agentBusy && removeMessage.isPending && <AgentUpdating label="Removing the message and updating this lead…" />}
        {notice && !agentBusy && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <p className="min-w-0 flex-1">{notice.text}</p>
            {notice.undoMessageId !== undefined && (
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold text-emerald-900 underline-offset-2 hover:bg-emerald-100 hover:underline"
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
          onRegenerate={() => {
            setNotice(null);
            regenerate.mutate();
          }}
        />
      </div>

      <section aria-labelledby="chat-heading" className="mt-6">
        <h2 id="chat-heading" className="mb-2 font-semibold">
          Chat
        </h2>
        <div className="rounded-xl bg-slate-100 p-3">
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
        {confirmRemove && <p className="mt-2 line-clamp-3 rounded bg-slate-100 p-2 text-slate-800">{confirmRemove.text}</p>}
      </ConfirmDialog>
    </Shell>
  );
}

function Shell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10">
      <button type="button" onClick={onBack} className="btn-link -ml-1 text-slate-700">
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>
      {children}
    </div>
  );
}
