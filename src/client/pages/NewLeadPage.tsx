import { NewLeadInput } from "@shared/api";
import { MAX_PASTE_CHARS, REPS, SOURCES } from "@shared/constants";
import { normalisePhone } from "@shared/phone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AgentUpdating, ErrorState } from "@/components/States";
import { api, ApiRequestError, keys } from "@/lib/api";
import { useRep } from "@/lib/useRep";

type Form = {
  name: string;
  company: string;
  phone: string;
  source: string;
  repId: string;
  lastContactDate: string;
  chat: string;
};

// New lead (PRD §8.5). On save the agent scores it, then the lead opens.
export function NewLeadPage() {
  const [rep] = useRep();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = useQuery({ queryKey: keys.meta, queryFn: api.meta });
  const today = meta.data?.today ?? "";

  const [form, setForm] = useState<Form>({
    name: "",
    company: "",
    phone: "",
    source: "",
    repId: rep ?? "",
    lastContactDate: "",
    chat: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  const create = useMutation({
    mutationFn: api.createLead,
    onSuccess: (data) => {
      queryClient.setQueryData(keys.lead(data.lead.id), data);
      void queryClient.invalidateQueries({ queryKey: keys.allLeads });
      void queryClient.invalidateQueries({ queryKey: keys.meta });
      navigate(`/lead/${data.lead.id}`, { replace: true });
    },
  });
  const duplicate = create.error instanceof ApiRequestError && create.error.code === "DUPLICATE" ? create.error : null;

  const set = (field: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const input = {
      name: form.name,
      company: form.company,
      phone: form.phone,
      source: form.source,
      repId: form.repId,
      lastContactDate: form.lastContactDate || undefined,
      chat: form.chat.trim() || undefined,
    };
    // Same schema as the API, so the messages match.
    const parsed = NewLeadInput.safeParse(input);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Form;
        next[field] ??= field === "source" || field === "repId" ? "Pick one" : issue.message;
      }
      setErrors(next);
      return;
    }
    create.mutate(input as NewLeadInput);
  }

  const phoneOk = form.phone.trim() === "" || normalisePhone(form.phone) !== null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10">
      <Link to="/" className="btn-link -ml-1 text-slate-700">
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Link>
      <h1 className="mt-1 text-xl font-bold">New lead</h1>
      <p className="mt-1 text-sm text-slate-600">The agent tags it and writes a first message as soon as you save.</p>

      <form onSubmit={submit} noValidate className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <Field label="Buyer name" error={errors.name}>
          <input id="name" value={form.name} onChange={set("name")} className="field" autoComplete="off" required />
        </Field>
        <Field label="Company" error={errors.company}>
          <input id="company" value={form.company} onChange={set("company")} className="field" autoComplete="off" required />
        </Field>
        <Field
          label="Phone"
          hint="10-digit Indian mobile, with or without +91"
          error={errors.phone ?? (!phoneOk ? "Phone must be a 10-digit Indian mobile number" : undefined)}
        >
          <input id="phone" value={form.phone} onChange={set("phone")} className="field" inputMode="tel" autoComplete="off" required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source" error={errors.source}>
            <select id="source" value={form.source} onChange={set("source")} className="field" required>
              <option value="">Choose…</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rep" error={errors.repId}>
            <select id="repId" value={form.repId} onChange={set("repId")} className="field" required>
              <option value="">Choose…</option>
              {REPS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Last contact" hint="Leave empty for today" error={errors.lastContactDate}>
          <input id="lastContactDate" type="date" value={form.lastContactDate} onChange={set("lastContactDate")} max={today || undefined} className="field" />
        </Field>

        <Field label="WhatsApp chat (optional)" hint="Paste the first few messages, or lines like “Buyer: price?”" error={errors.chat}>
          <textarea id="chat" value={form.chat} onChange={set("chat")} rows={4} maxLength={MAX_PASTE_CHARS} className="field font-mono text-sm" />
        </Field>

        {duplicate && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {duplicate.message}{" "}
            {duplicate.leadId && (
              <Link to={`/lead/${duplicate.leadId}`} className="font-semibold underline">
                Open it
              </Link>
            )}
          </div>
        )}
        {create.isError && !duplicate && <ErrorState message={create.error.message} />}
        {create.isPending && <AgentUpdating label="Saving — the agent is reading this lead…" />}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            Save
          </button>
          <Link to="/" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactElement<{ id: string }> }) {
  const id = children.props.id;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
