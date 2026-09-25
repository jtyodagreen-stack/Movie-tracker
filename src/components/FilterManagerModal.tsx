import { X } from 'lucide-react';
import CustomFilterManager from './CustomFilterManager';
import { CustomFilter } from '../types';

interface FilterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (filter: CustomFilter) => void;
}

export default function FilterManagerModal({ isOpen, onClose, onSelect }: FilterManagerModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 w-full max-w-lg rounded-xl border border-zinc-800 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
            <h2 className="text-xl font-bold text-white">Manage Filters</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white"><X /></button>
        </div>
        <CustomFilterManager onFilterSelect={(f) => { onSelect(f); onClose(); }} />
      </div>
    </div>
  );
}
