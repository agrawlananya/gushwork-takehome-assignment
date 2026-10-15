import type { Message } from "@shared/api";
import { chatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const MEDIA = "<Media omitted>";

/** PRD D-7: buyer on the left, rep on the right, with date and time. */
export function ChatThread({ messages, buyerName, repName }: { messages: Message[]; buyerName: string; repName: string }) {
  if (messages.length === 0) {
    return <p className="rounded-lg bg-white p-4 text-sm text-slate-600">No messages yet. Paste the WhatsApp chat to help the agent.</p>;
  }
  return (
    <ol className="space-y-2">
      {messages.map((m) => {
        const rep = m.sender === "rep";
        return (
          <li key={m.id} className={cn("flex", rep ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-xs",
                rep ? "rounded-br-sm bg-emerald-100 text-emerald-950" : "rounded-bl-sm bg-white text-slate-900",
              )}
            >
              <p className="mb-0.5 text-xs font-semibold text-slate-500">{rep ? repName : buyerName.split(" ")[0]}</p>
              <p className={cn("whitespace-pre-wrap break-words", m.text === MEDIA && "italic text-slate-500")}>
                {m.text === MEDIA ? "Photo or file" : m.text}
              </p>
              <p className="mt-1 text-right text-[11px] text-slate-500">{chatTime(m.sentAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
