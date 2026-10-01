import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Settings, Users, Sparkles, Edit2, Smile } from 'lucide-react';
import toast from 'react-hot-toast';
import { getViewerColor } from '../utils/profileColors';
import {
  NETFLIX_AVATARS,
  getViewerAvatarId,
  saveStoredViewerAvatars,
  getStoredViewerAvatars,
} from '../utils/profileAvatars';
import NetflixAvatarIcon from './NetflixAvatarIcon';
import { ShowItem } from '../types';

interface NetflixProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  customViewers: string[];
  activeProfile?: string;
  onSwitchProfile?: (profile: string) => void;
  viewerColors?: Record<string, string>;
  viewerAvatars?: Record<string, string>;
  onUpdateViewerAvatars?: (avatars: Record<string, string>) => void;
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
  viewerAvatars,
  onUpdateViewerAvatars,
  shows = [],
  onOpenManageProfiles,
}: NetflixProfileSwitcherModalProps) {
  const [isManageMode, setIsManageMode] = useState(false);
  const [editingAvatarViewer, setEditingAvatarViewer] = useState<string | null>(null);
  const [localAvatars, setLocalAvatars] = useState<Record<string, string>>(() => ({
    ...getStoredViewerAvatars(),
    ...(viewerAvatars || {}),
  }));

  useEffect(() => {
    if (viewerAvatars) {
      setLocalAvatars((prev) => ({ ...prev, ...viewerAvatars }));
    }
  }, [viewerAvatars]);

  // Close on Escape key & manage scroll lock
  useEffect(() => {
    if (!isOpen) {
      setIsManageMode(false);
      setEditingAvatarViewer(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingAvatarViewer) {
          setEditingAvatarViewer(null);
        } else {
          onClose();
        }
      }
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
  }, [isOpen, onClose, editingAvatarViewer]);

  if (!isOpen) return null;

  const handleSelect = (profileName: string) => {
    if (isManageMode) {
      // In manage mode, clicking a profile opens the avatar picker!
      setEditingAvatarViewer(profileName);
      return;
    }

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

  const handleChooseAvatar = (viewer: string, avatarId: string) => {
    const updated = { ...localAvatars, [viewer]: avatarId };
    setLocalAvatars(updated);
    saveStoredViewerAvatars(updated);
    if (onUpdateViewerAvatars) {
      onUpdateViewerAvatars(updated);
    }
    setEditingAvatarViewer(null);
    toast.success(`Updated "${viewer}" avatar icon! ✨`, {
      style: { background: '#181818', color: '#fff', border: '1px solid #333' },
    });
  };

  // Helper to count shows matching a profile
  const countForProfile = (profileName: string) => {
    if (!profileName) return shows.length;
    const norm = profileName.trim().toLowerCase();
    return shows.filter((s) => {
      if (!s.who) return false;
      const showWho = String(s.who).trim().toLowerCase();
      return (
        showWho === norm ||
        showWho.includes(norm) ||
        showWho
          .split(/[&,\/]/)
          .map((p) => p.trim())
          .includes(norm)
      );
    }).length;
  };

  const currentList = customViewers.length > 0 ? customViewers : ['Me'];

  return (
    <div
      id="netflix-profile-switcher-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="netflix-profile-switcher-modal-dialog"
        className="relative w-full max-w-3xl bg-[#141414] border border-zinc-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl text-white text-center animate-in zoom-in-95 duration-200 max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer border border-zinc-800 shadow-md"
          title="Close Profile Switcher"
          aria-label="Close"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* SUBVIEW: AVATAR PICKER OVERLAY */}
        {editingAvatarViewer ? (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="text-left">
                <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>Choose an Avatar for</span>
                  <span className="text-red-500 font-extrabold">{editingAvatarViewer}</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Select a Netflix classic face, cinema emblem, or character avatar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAvatarViewer(null)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                &larr; Back
              </button>
            </div>

            {/* Avatar Presets Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4 max-h-[50vh] overflow-y-auto p-1">
              {NETFLIX_AVATARS.map((avatar) => {
                const currentAvatarId = getViewerAvatarId(editingAvatarViewer, localAvatars);
                const isSelected = currentAvatarId === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => handleChooseAvatar(editingAvatarViewer, avatar.id)}
                    className={`group flex flex-col items-center p-2 rounded-2xl transition-all cursor-pointer hover:bg-zinc-900/80 hover:scale-105 ${
                      isSelected ? 'ring-2 ring-red-500 bg-zinc-900' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="relative">
                      <NetflixAvatarIcon
                        avatarId={avatar.id}
                        sizeClassName="w-16 h-16 sm:w-18 sm:h-18"
                        className={`transition-all duration-200 ${
                          isSelected ? 'ring-2 ring-white shadow-xl' : 'group-hover:ring-2 group-hover:ring-white/40'
                        }`}
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-white shadow-md">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="mt-2 text-[11px] font-bold text-zinc-300 group-hover:text-white truncate max-w-full">
                      {avatar.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Title & Header */}
            <div className="mb-6 sm:mb-10 space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-red-600/10 border border-red-500/30 text-red-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
                <span>{isManageMode ? 'Manage Profile Avatars' : 'Profile Switcher'}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                {isManageMode ? 'Choose a profile to edit avatar' : "Who's watching?"}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto px-2">
                {isManageMode
                  ? 'Click any profile to pick a new custom Netflix face or character avatar.'
                  : 'Select your personal profile to filter your watchlist, watching progress, and category shelves.'}
              </p>
            </div>

            {/* Profiles Grid */}
            <div className="flex items-center justify-center gap-3.5 sm:gap-6 flex-wrap max-w-2xl mx-auto mb-6 sm:mb-10">
              {/* 1. All Profiles Tile */}
              {!isManageMode && (
                <div
                  onClick={() => handleSelect('')}
                  className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95"
                >
                  <div
                    className={`relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center bg-zinc-900 border-2 transition-all duration-200 shadow-lg group-hover:scale-105 ${
                      !activeProfile
                        ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-950/60'
                        : 'border-zinc-800 group-hover:border-white group-hover:ring-4 group-hover:ring-white/20'
                    }`}
                  >
                    <Users className="w-8 h-8 sm:w-12 sm:h-12 text-zinc-300 group-hover:text-white transition-colors" />
                    {!activeProfile && (
                      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-600 flex items-center justify-center text-white shadow-md">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span
                    className={`mt-2 sm:mt-3 text-xs sm:text-base font-bold transition-colors ${
                      !activeProfile ? 'text-white font-black' : 'text-zinc-400 group-hover:text-white'
                    }`}
                  >
                    All Profiles
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
                    {shows.length} titles
                  </span>
                </div>
              )}

              {/* 2. Custom Configured Profile Viewers with Netflix Avatars */}
              {currentList.map((viewer) => {
                const isSelected = activeProfile === viewer;
                const avatarId = getViewerAvatarId(viewer, localAvatars);
                const color = getViewerColor(viewer, viewerColors);
                const count = countForProfile(viewer);

                return (
                  <div
                    key={`netflix-profile-${viewer}`}
                    onClick={() => handleSelect(viewer)}
                    className="group relative flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95"
                  >
                    <div className="relative">
                      <NetflixAvatarIcon
                        avatarId={avatarId}
                        name={viewer}
                        bgColor={color}
                        sizeClassName="w-20 h-20 sm:w-28 sm:h-28"
                        className={`transition-all duration-200 group-hover:scale-105 ${
                          isSelected && !isManageMode
                            ? 'ring-4 ring-white shadow-2xl scale-102'
                            : 'ring-2 ring-transparent group-hover:ring-4 group-hover:ring-white/40'
                        } ${isManageMode ? 'opacity-80 group-hover:opacity-100 ring-2 ring-red-500/80' : ''}`}
                      />

                      {/* Manage mode edit overlay badge */}
                      {isManageMode && (
                        <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center backdrop-blur-[1px]">
                          <div className="w-8 h-8 rounded-full bg-zinc-900/90 border border-white/40 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                            <Edit2 className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}

                      {isSelected && !isManageMode && (
                        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white flex items-center justify-center text-zinc-950 shadow-md">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <span
                      className={`mt-2 sm:mt-3 text-xs sm:text-base font-bold transition-colors truncate max-w-[90px] sm:max-w-[110px] ${
                        isSelected && !isManageMode ? 'text-white font-black' : 'text-zinc-400 group-hover:text-white'
                      }`}
                    >
                      {viewer}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
                      {count} titles
                    </span>
                  </div>
                );
              })}

              {/* 3. Add Profile Tile */}
              {!isManageMode && onOpenManageProfiles && (
                <div
                  onClick={() => {
                    onClose();
                    onOpenManageProfiles();
                  }}
                  className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95"
                >
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center bg-zinc-900/50 border-2 border-dashed border-zinc-700 hover:border-white transition-all duration-200 group-hover:scale-105 group-hover:bg-zinc-800">
                    <Plus className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                  <span className="mt-2 sm:mt-3 text-xs sm:text-base font-bold text-zinc-500 group-hover:text-white transition-colors">
                    Add Profile
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-600 font-mono">
                    New viewer
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setIsManageMode(!isManageMode)}
                className={`px-5 py-2.5 rounded-lg border text-xs sm:text-sm font-bold uppercase tracking-widest transition-all cursor-pointer inline-flex items-center gap-2 ${
                  isManageMode
                    ? 'bg-red-600 border-red-500 text-white shadow-lg'
                    : 'border-zinc-700 hover:border-white text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {isManageMode ? <Check className="w-4 h-4" /> : <Smile className="w-4 h-4" />}
                <span>{isManageMode ? 'Done Editing Avatars' : 'Customize Avatars'}</span>
              </button>

              {onOpenManageProfiles && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenManageProfiles();
                  }}
                  className="px-5 py-2.5 rounded-lg border border-zinc-700 hover:border-white text-zinc-400 hover:text-white text-xs sm:text-sm font-bold uppercase tracking-widest transition-all cursor-pointer inline-flex items-center gap-2 hover:bg-white/5"
                >
                  <Settings className="w-4 h-4" />
                  <span>Manage Names & Colors</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
