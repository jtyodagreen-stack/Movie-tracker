import React, { useState, useEffect } from 'react';
import { X, User, Plus, Edit2, Trash2, Check, Sparkles, Settings, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface ManageProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  customViewers: string[];
  onUpdateCustomViewers: (viewers: string[]) => void;
  activeProfile?: string;
  onSwitchProfile?: (profile: string) => void;
  sheetConnected: boolean;
}

export default function ManageProfilesModal({
  isOpen,
  onClose,
  customViewers,
  onUpdateCustomViewers,
  activeProfile,
  onSwitchProfile,
  sheetConnected,
}: ManageProfilesModalProps) {
  const [newViewerName, setNewViewerName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Default viewer list if empty
  const defaultList = ['Me', 'Family', 'Guest', 'Shared'];
  const currentList = customViewers.length > 0 ? customViewers : defaultList;

  const handleAddViewer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newViewerName.trim();
    if (!trimmed) return;

    if (currentList.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" is already in your profile viewer list.`);
      return;
    }

    const updated = [...currentList, trimmed];
    onUpdateCustomViewers(updated);
    setNewViewerName('');
    toast.success(`✨ Added profile viewer: "${trimmed}"`);
  };

  const handleStartEdit = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingName(currentName);
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    const updated = [...currentList];
    const oldName = updated[index];
    updated[index] = trimmed;
    onUpdateCustomViewers(updated);

    if (activeProfile === oldName && onSwitchProfile) {
      onSwitchProfile(trimmed);
    }

    setEditingIndex(null);
    setEditingName('');
    toast.success(`Updated profile name to "${trimmed}"`);
  };

  const handleRemoveViewer = (index: number) => {
    const nameToRemove = currentList[index];
    if (currentList.length <= 1) {
      toast.error('You must keep at least one profile name.');
      return;
    }

    const updated = currentList.filter((_, i) => i !== index);
    onUpdateCustomViewers(updated);

    if (activeProfile === nameToRemove && onSwitchProfile) {
      onSwitchProfile(updated[0]);
    }

    toast.success(`Removed "${nameToRemove}" from viewers list.`);
  };

  return (
    <div
      id="manage-profiles-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="manage-profiles-modal-dialog"
        className="relative w-full max-w-lg bg-[#181818] border-0 rounded-2xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-gradient-to-r from-zinc-900 to-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Manage Profile & Viewer Names</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                  Lists Sheet
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Add, edit, or select profile viewers synced across your tracker.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto overscroll-contain">
          {/* Add New Profile Name Input Form */}
          <form onSubmit={handleAddViewer} className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              ➕ Add New Profile Name / Viewer
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Me, Family, Kids..."
                value={newViewerName}
                onChange={(e) => setNewViewerName(e.target.value)}
                className="flex-1 bg-zinc-900 border-0 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={!newViewerName.trim()}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Profile</span>
              </button>
            </div>
          </form>

          {/* Current Profile Names / Viewers List */}
          <div className="space-y-2 pt-2 border-t border-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Configured Profile Viewers ({currentList.length})
              </span>
              {sheetConnected && (
                <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Synced with Google Sheet
                </span>
              )}
            </div>

            <div className="space-y-2">
              {currentList.map((viewer, index) => {
                const isSelected = activeProfile === viewer;
                const isEditing = editingIndex === index;

                return (
                  <div
                    key={`profile-viewer-${index}`}
                    className={`flex items-center justify-between p-3 rounded-xl border-0 transition-all ${
                      isSelected
                        ? 'bg-red-950/40 shadow-md ring-1 ring-red-500/30'
                        : 'bg-zinc-900/90 hover:bg-zinc-900'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(index);
                            }
                          }}
                          className="flex-1 bg-zinc-950 border border-red-500 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(index)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                          title="Save Changes"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-red-600 text-white ring-2 ring-red-400'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
                            <span>{viewer}</span>
                            {isSelected && (
                              <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Active Profile
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-zinc-400">Available in show &apos;Who&apos; column</p>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        {onSwitchProfile && !isSelected && (
                          <button
                            type="button"
                            onClick={() => onSwitchProfile(viewer)}
                            className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(index, viewer)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                          title="Edit Profile Name"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveViewer(index)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/50 rounded transition-colors cursor-pointer"
                          title="Remove Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-900 border-t border-zinc-900 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 font-medium">
            💡 Changes saved automatically to Lists tab
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
