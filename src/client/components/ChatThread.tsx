import type { Message } from "@shared/api";
import { Trash2 } from "lucide-react";
import { chatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const MEDIA = "<Media omitted>";

/**
 * PRD D-7: buyer on the left, rep on the right, with date and time.
 * Messages added in the app (pasted or marked as sent) can be removed.
 */
export function ChatThread({
  messages,
  buyerName,
  repName,
  busy = false,
  onRemove,
}: {
  messages: Message[];
  buyerName: string;
  repName: string;
  busy?: boolean;
  onRemove?: (message: Message) => void;
}) {
  if (messages.length === 0) {
    return <p className="rounded-lg bg-white p-4 text-sm text-ink-soft">No messages yet. Paste the WhatsApp chat to help the agent.</p>;
  }
  return (
    <ol className="space-y-2">
      {messages.map((m) => {
        const rep = m.sender === "rep";
        return (
          <li key={m.id} className={cn("flex", rep ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-snug",
                rep ? "rounded-br-[4px] bg-leaf text-ink" : "rounded-bl-[4px] border border-line bg-white text-ink",
              )}
            >
              <p className={cn("mb-0.5 text-xs font-bold", rep ? "text-leaf-deep" : "text-ink-soft")}>{rep ? repName : buyerName.split(" ")[0]}</p>
              <p className={cn("whitespace-pre-wrap break-words", m.text === MEDIA && "italic text-mute")}>
                {m.text === MEDIA ? "Photo or file" : m.text}
              </p>
              <div className="mt-1 flex items-center justify-end gap-2">
                {m.removable && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(m)}
                    disabled={busy}
                    className="-my-2 inline-flex min-h-11 items-center gap-1 rounded px-1.5 text-xs font-medium text-ink-soft hover:text-signal disabled:opacity-45"
                    aria-label="Remove this message"
                  >
                    <Trash2 className="size-3.5" aria-hidden /> Remove
                  </button>
                )}
                <span className="text-[11px] text-mute tabular-nums">{chatTime(m.sentAt)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
