import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * In-page confirm (Tech §9: never alert()/confirm()). Built on the native <dialog>,
 * which gives focus trapping and Esc-to-cancel for free.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Fires on Esc too. Only counts as "cancel" if the parent still thinks it's open.
      onClose={() => open && onCancel()}
      className="m-auto w-[min(92vw,26rem)] rounded-xl border border-line bg-white p-0 text-ink shadow-[0_24px_48px_-12px_rgb(20_33_61/0.35)] backdrop:bg-ink/50"
    >
      <div className="p-5">
        <h2 className="cond text-2xl leading-tight font-extrabold">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn("btn-primary", danger && "bg-signal hover:bg-signal/85")}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
