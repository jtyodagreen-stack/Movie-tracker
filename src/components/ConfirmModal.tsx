import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      id="confirm-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="confirm-modal-dialog"
        className="w-full max-w-md bg-[#1c1c1c] border border-zinc-700 rounded-xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            id="confirm-modal-cancel"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            id="confirm-modal-action"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-md transition-colors ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-900/30'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-900/30'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
