import React, { useEffect } from 'react';
import { X, Plus, Check, Settings, Users, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { getViewerColor } from '../utils/profileColors';
import { ShowItem } from '../types';

interface NetflixProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  customViewers: string[];
  activeProfile?: string;
  onSwitchProfile?: (profile: string) => void;
  viewerColors?: Record<string, string>;
  shows?: ShowItem[];
  onOpenManageProfiles?: () => void;
}

export default function NetflixProfileSwitcherModal({
  isOpen,
  onClose,
  customViewers,
  activeProfile = '',
  onSwitchProfile,
  viewerColors,
  shows = [],
  onOpenManageProfiles,
}: NetflixProfileSwitcherModalProps) {
  // Close on Escape key & manage scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const prevTop = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(prevTop || '0', 10) * -1);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (profileName: string) => {
    if (onSwitchProfile) {
      onSwitchProfile(profileName);
    }
    onClose();
    if (profileName) {
      toast.success(`Switched to "${profileName}"'s profile`, {
        icon: '👤',
        style: {
          background: '#181818',
          color: '#fff',
          border: '1px solid #333',
        },
      });
    } else {
      toast.success('Viewing All Household Profiles', {
        icon: '👥',
        style: {
          background: '#181818',
          color: '#fff',
          border: '1px solid #333',
        },
      });
    }
  };

  // Helper to count shows matching a profile
  const countForProfile = (profileName: string) => {
    if (!profileName) return shows.length;
    const norm = profileName.trim().toLowerCase();
    return shows.filter((s) => {
      if (!s.who) return false;
      const showWho = String(s.who).trim().toLowerCase();
      return showWho === norm || showWho.includes(norm) || showWho.split(/[&,\/]/).map((p) => p.trim()).includes(norm);
    }).length;
  };

  const currentList = customViewers.length > 0 ? customViewers : ['Me'];

  return (
    <div
      id="netflix-profile-switcher-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="netflix-profile-switcher-modal-dialog"
        className="relative w-full max-w-3xl bg-[#141414] border border-zinc-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl text-white text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer border border-zinc-800 shadow-md"
          title="Close Profile Switcher"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Header */}
        <div className="mb-8 sm:mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Profile Switcher</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Who's watching?
          </h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Select your personal profile to filter your watchlist, watching progress, and category shelves.
          </p>
        </div>

        {/* Profiles Grid */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap max-w-2xl mx-auto mb-8 sm:mb-10">
          {/* 1. All Profiles Tile */}
          <div
            onClick={() => handleSelect('')}
            className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1"
          >
            <div
              className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center bg-zinc-900 border-2 transition-all duration-200 shadow-lg group-hover:scale-105 ${
                !activeProfile
                  ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-950/60'
                  : 'border-zinc-800 group-hover:border-white group-hover:ring-4 group-hover:ring-white/20'
              }`}
            >
              <Users className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-300 group-hover:text-white transition-colors" />
              {!activeProfile && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white shadow-md">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>
            <span
              className={`mt-3 text-sm sm:text-base font-bold transition-colors ${
                !activeProfile ? 'text-white font-black' : 'text-zinc-400 group-hover:text-white'
              }`}
            >
              All Profiles
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {shows.length} titles
            </span>
          </div>

          {/* 2. Custom Configured Profile Viewers */}
          {currentList.map((viewer) => {
            const isSelected = activeProfile === viewer;
            const color = getViewerColor(viewer, viewerColors);
            const count = countForProfile(viewer);

            return (
              <div
                key={`netflix-profile-${viewer}`}
                onClick={() => handleSelect(viewer)}
                className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1"
              >
                <div
                  className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black text-white transition-all duration-200 shadow-xl group-hover:scale-105 ${
                    isSelected
                      ? 'ring-4 ring-white shadow-2xl'
                      : 'border-2 border-transparent group-hover:ring-4 group-hover:ring-white/30'
                  }`}
                  style={{
                    backgroundColor: color,
                    boxShadow: isSelected ? `0 10px 25px -5px ${color}80` : undefined,
                  }}
                >
                  <span>{viewer.charAt(0).toUpperCase()}</span>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center text-zinc-950 shadow-md">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <span
                  className={`mt-3 text-sm sm:text-base font-bold transition-colors truncate max-w-[110px] ${
                    isSelected ? 'text-white font-black' : 'text-zinc-400 group-hover:text-white'
                  }`}
                >
                  {viewer}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {count} titles
                </span>
              </div>
            );
          })}

          {/* 3. Add Profile Tile */}
          {onOpenManageProfiles && (
            <div
              onClick={() => {
                onClose();
                onOpenManageProfiles();
              }}
              className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center bg-zinc-900/50 border-2 border-dashed border-zinc-700 hover:border-white transition-all duration-200 group-hover:scale-105 group-hover:bg-zinc-800">
                <Plus className="w-10 h-10 text-zinc-500 group-hover:text-white transition-colors" />
              </div>
              <span className="mt-3 text-sm sm:text-base font-bold text-zinc-500 group-hover:text-white transition-colors">
                Add Profile
              </span>
              <span className="text-[11px] text-zinc-600 font-mono">
                New viewer
              </span>
            </div>
          )}
        </div>

        {/* Manage Profiles Button */}
        {onOpenManageProfiles && (
          <div className="pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManageProfiles();
              }}
              className="px-6 py-2.5 rounded-lg border border-zinc-700 hover:border-white text-zinc-400 hover:text-white text-xs sm:text-sm font-bold uppercase tracking-widest transition-all cursor-pointer inline-flex items-center gap-2 hover:bg-white/5"
            >
              <Settings className="w-4 h-4" />
              <span>Manage Profiles</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
