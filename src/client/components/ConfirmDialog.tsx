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
      className="m-auto w-[min(92vw,26rem)] rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-slate-700">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn("btn-primary", danger && "bg-red-700 hover:bg-red-800")}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
