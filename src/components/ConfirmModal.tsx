import { useState } from 'react';
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
  const [tilt, setTilt] = useState({ x: 0, y: 0, isHovered: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.innerWidth < 640) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -(y / rect.height) * 8;
    const rotateY = (x / rect.width) * 8;
    setTilt({ x: rotateX, y: rotateY, isHovered: true });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, isHovered: false });
  };

  if (!isOpen) return null;

  return (
    <div
      id="confirm-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ perspective: '1200px' }}
    >
      <div
        id="confirm-modal-dialog"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translate3d(0, 0, ${tilt.isHovered ? '15px' : '0px'})`,
          transformStyle: 'preserve-3d',
          boxShadow: tilt.isHovered 
            ? '0 30px 60px -15px rgba(0, 0, 0, 0.95), 0 0 35px rgba(229, 9, 20, 0.12)' 
            : '0 20px 40px -12px rgba(0, 0, 0, 0.75)',
          transition: tilt.isHovered 
            ? 'transform 0.08s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease' 
            : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s ease',
        }}
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
