import type { ApiError, LeadDetail, LeadList, Meta, NewLeadInput } from "@shared/api";
import type { View } from "@shared/sort";
import type { Sender } from "@shared/types";
import { storage } from "./storage";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: ApiError["error"]["code"],
    readonly status: number,
    readonly leadId?: string,
  ) {
    super(message);
  }
}

// Dev only: `?today=YYYY-MM-DD` on any page is remembered for the tab and sent with every call
// (the Worker ignores it outside dev). Lets us check how the list looks on another day.
const devToday = new URLSearchParams(window.location.search).get("today");
if (devToday) storage.session.set("devToday", devToday);

function url(path: string): string {
  const today = storage.session.get("devToday");
  if (!today) return `/api${path}`;
  return `/api${path}${path.includes("?") ? "&" : "?"}today=${encodeURIComponent(today)}`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url(path), {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError("Can't reach the server. Check your connection and try again.", "INTERNAL", 0);
  }
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const error = (data as ApiError | null)?.error;
    throw new ApiRequestError(error?.message ?? "Something went wrong", error?.code ?? "INTERNAL", res.status, error?.leadId);
  }
  return data as T;
}

export const api = {
  meta: () => request<Meta>("GET", "/meta"),
  leads: (view: View, rep: string | null) =>
    request<LeadList>("GET", `/leads?view=${view}${rep ? `&rep=${encodeURIComponent(rep)}` : ""}`),
  lead: (id: string) => request<LeadDetail>("GET", `/leads/${encodeURIComponent(id)}`),
  createLead: (input: NewLeadInput) => request<LeadDetail>("POST", "/leads", input),
  addMessages: (id: string, text: string, senders?: Sender[]) =>
    request<LeadDetail>("POST", `/leads/${encodeURIComponent(id)}/messages`, { text, senders }),
  saveDraft: (id: string, draft: string) => request<LeadDetail>("PATCH", `/leads/${encodeURIComponent(id)}/draft`, { draft }),
  markSent: (id: string, draft: string) => request<LeadDetail>("POST", `/leads/${encodeURIComponent(id)}/sent`, { draft }),
  regenerate: (id: string) => request<LeadDetail>("POST", `/leads/${encodeURIComponent(id)}/regenerate`),
  removeMessage: (id: string, messageId: number) =>
    request<LeadDetail>("DELETE", `/leads/${encodeURIComponent(id)}/messages/${messageId}`),
  resetDemo: () => request<{ ok: boolean; leads: number }>("POST", "/demo/reset"),
};

/** Query keys, so mutations can refresh exactly what changed. */
export const keys = {
  meta: ["meta"] as const,
  leads: (view: View, rep: string | null) => ["leads", view, rep] as const,
  allLeads: ["leads"] as const,
  lead: (id: string) => ["lead", id] as const,
};
