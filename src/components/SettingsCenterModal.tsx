import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Table,
  Accessibility,
  Palette,
  Database,
  BarChart3,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Check,
  User,
  ShieldCheck,
  ExternalLink,
  Clock,
  Sparkles,
  WifiOff,
  Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  extractSpreadsheetId,
  findMatchingWishlistSheet,
  findMatchingMasterSheet,
  fetchSpreadsheetDetails,
} from '../services/sheetsService';
import { getAccessToken } from '../firebase';
import {
  getProfilePicture,
  getProfileDisplayName,
  getProfileEmail,
  GOOGLE_AVATAR_DATA_URI,
  DEFAULT_PROFILE_USER,
} from '../utils/userProfile';
import { ShowItem, AccessibilitySettings, AlertIntervals } from '../types';
import {
  PROFILE_COLOR_PALETTE,
  getViewerColor,
  getViewerColorName,
} from '../utils/profileColors';

interface SettingsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  // User Authentication
  user: FirebaseUser | null;
  onSignIn: (options?: { forceConsent?: boolean }) => any;
  onSignOut: () => void;
  // Google Sheets Sync
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  availableTabs?: string[];
  onConnect: (id: string, name: string, wishlistName?: string) => Promise<void>;
  onDisconnect: () => void;
  isSyncing: boolean;
  lastSyncedAt?: string;
  sheetTitle?: string;
  shows: ShowItem[];
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  syncFrequency?: number;
  onUpdateSyncFrequency?: (freq: number) => void;
  onTriggerSync?: () => void;
  isOnline?: boolean;
  // Viewer Profile settings
  customViewers: string[];
  onUpdateCustomViewers: (viewers: string[], colors?: Record<string, string>) => void;
  viewerColors?: Record<string, string>;
  onUpdateViewerColors?: (colors: Record<string, string>) => void;
  activeProfile?: string;
  onSwitchProfile?: (profile: string) => void;
  // Alerts
  alertIntervals: AlertIntervals;
  onUpdateAlertIntervals: (intervals: AlertIntervals) => void;
  // Accessibility
  accessibilitySettings: AccessibilitySettings;
  setAccessibilitySettings: (settings: AccessibilitySettings) => void;
  defaultTab?: 'all' | 'user' | 'sync' | 'acc' | 'theme' | 'data';
}

export default function SettingsCenterModal({
  isOpen,
  onClose,
  user,
  onSignIn,
  onSignOut,
  spreadsheetId,
  sheetName,
  wishlistSheetName = '📋  WISHLIST',
  availableTabs = [],
  onConnect,
  onDisconnect,
  isSyncing,
  lastSyncedAt,
  sheetTitle,
  shows,
  autoSyncEnabled = true,
  onToggleAutoSync,
  syncFrequency = 45,
  onUpdateSyncFrequency,
  onTriggerSync,
  isOnline = true,
  customViewers,
  onUpdateCustomViewers,
  viewerColors = {},
  onUpdateViewerColors,
  activeProfile,
  onSwitchProfile,
  alertIntervals,
  onUpdateAlertIntervals,
  accessibilitySettings,
  setAccessibilitySettings,
  defaultTab = 'all',
}: SettingsCenterModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'user' | 'sync' | 'acc' | 'alerts' | 'data' | 'stats'>(defaultTab === 'theme' ? 'alerts' : (defaultTab as any));

  // Synchronize tab if defaultTab changes when open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab === 'theme' ? 'alerts' : (defaultTab as any));
    }
  }, [isOpen, defaultTab]);

  // Sync Input States
  const [sheetInputVal, setSheetInputVal] = useState(spreadsheetId);

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

  const [selectedSheet, setSelectedSheet] = useState(sheetName || 'MASTER TRACKER');
  const [selectedWishlist, setSelectedWishlist] = useState(wishlistSheetName || '📋  WISHLIST');
  const [tabsList, setTabsList] = useState<string[]>(availableTabs);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile Viewer States & Color Coding
  const [newViewerName, setNewViewerName] = useState('');
  const [selectedNewColor, setSelectedNewColor] = useState<string>(PROFILE_COLOR_PALETTE[0].hex);
  const [activeColorPickerIndex, setActiveColorPickerIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Local storage profile picture customization options
  const [customAvatarUri, setCustomAvatarUri] = useState<string>('');

  const activeUser = user || DEFAULT_PROFILE_USER;
  const isConnected = Boolean(spreadsheetId && sheetTitle);

  useEffect(() => {
    if (isOpen) {
      if (spreadsheetId) setSheetInputVal(spreadsheetId);
      if (sheetName) setSelectedSheet(sheetName);
      if (wishlistSheetName) setSelectedWishlist(wishlistSheetName);
      if (availableTabs && availableTabs.length > 0) {
        setTabsList(availableTabs);
      }
      setErrorMsg(null);
    }
  }, [isOpen, spreadsheetId, sheetName, wishlistSheetName, availableTabs]);

  // Dynamically load sheet tabs if user is connected and sheet ID changes
  useEffect(() => {
    if (!isOpen) return;
    const cleanId = extractSpreadsheetId(sheetInputVal) || sheetInputVal.trim();
    if (!cleanId) {
      setTabsList([]);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const token = await getAccessToken();
        if (token && cleanId) {
          const meta = await fetchSpreadsheetDetails(cleanId, token);
          if (isMounted && meta?.sheetNames && meta.sheetNames.length > 0) {
            setTabsList(meta.sheetNames);
            const matchedWishlist = findMatchingWishlistSheet(meta.sheetNames);
            if (matchedWishlist) {
              setSelectedWishlist(matchedWishlist);
            }
            const matchedMaster = findMatchingMasterSheet(meta.sheetNames);
            if (matchedMaster && (!selectedSheet || selectedSheet === 'Sheet1')) {
              setSelectedSheet(matchedMaster);
            }
          }
        }
      } catch (e) {
        // Tab check preview notice
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sheetInputVal]);

  if (!isOpen) return null;

  const defaultList = ['Me', 'Family', 'Guest', 'Shared'];
  const currentList = customViewers.length > 0 ? customViewers : defaultList;

  // Add profile viewer with chosen color tag
  const handleAddViewer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newViewerName.trim();
    if (!trimmed) return;

    if (currentList.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" is already in your profile list.`);
      return;
    }

    const updated = [...currentList, trimmed];
    const updatedColors = { ...(viewerColors || {}), [trimmed]: selectedNewColor };
    onUpdateCustomViewers(updated, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }
    setNewViewerName('');
    // Advance to next unused palette color
    const nextIdx = (PROFILE_COLOR_PALETTE.findIndex((c) => c.hex === selectedNewColor) + 1) % PROFILE_COLOR_PALETTE.length;
    setSelectedNewColor(PROFILE_COLOR_PALETTE[nextIdx].hex);
    toast.success(`✨ Added profile: "${trimmed}" with ${getViewerColorName(selectedNewColor)} tag!`);
  };

  // Update a single profile's color tag
  const handleUpdateProfileColor = (viewer: string, newColor: string) => {
    const updatedColors = { ...(viewerColors || {}), [viewer]: newColor };
    onUpdateCustomViewers(currentList, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }
    toast.success(`🎨 Color tag for "${viewer}" updated to ${getViewerColorName(newColor)}!`);
  };

  // Save edited profile name while preserving their color tag
  const handleSaveEdit = (index: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    const updated = [...currentList];
    const oldName = updated[index];
    updated[index] = trimmed;

    const updatedColors = { ...(viewerColors || {}) };
    if (updatedColors[oldName]) {
      updatedColors[trimmed] = updatedColors[oldName];
      delete updatedColors[oldName];
    }

    onUpdateCustomViewers(updated, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }

    if (activeProfile === oldName && onSwitchProfile) {
      onSwitchProfile(trimmed);
    }

    setEditingIndex(null);
    setEditingName('');
    toast.success(`Updated profile to "${trimmed}"`);
  };

  // Remove profile viewer
  const handleRemoveViewer = (index: number) => {
    const nameToRemove = currentList[index];
    if (currentList.length <= 1) {
      toast.error('You must keep at least one profile.');
      return;
    }

    const updated = currentList.filter((_, i) => i !== index);
    const updatedColors = { ...(viewerColors || {}) };
    delete updatedColors[nameToRemove];

    onUpdateCustomViewers(updated, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }

    if (activeProfile === nameToRemove && onSwitchProfile) {
      onSwitchProfile(updated[0]);
    }

    toast.success(`Removed "${nameToRemove}"`);
  };

  // Handle full authentication popup and sheet connection/load
  const handleReSync = async () => {
    const cleanId = extractSpreadsheetId(sheetInputVal) || sheetInputVal.trim();
    if (!cleanId) {
      toast.error('Please paste a valid Google Sheet URL or ID.');
      return;
    }

    try {
      toast.loading('🔑 Opening Google authentication popup...', { id: 'resync-loader' });
      // Triggers Google OAuth authentication popup window!
      await onSignIn({ forceConsent: true });
      
      // Re-connect / initialize sheets connection with fresh token
      await onConnect(cleanId, selectedSheet, selectedWishlist);
      
      // Run sync update
      if (onTriggerSync) {
        onTriggerSync();
      }
      toast.success('⚡ Connected and synced Google Sheets successfully!', { id: 'resync-loader' });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Authentication or connection cancelled.', { id: 'resync-loader' });
    }
  };

  // Connect Google Sheet
  const handleSheetConnect = async () => {
    setErrorMsg(null);
    const cleanId = extractSpreadsheetId(sheetInputVal) || sheetInputVal.trim();
    if (!cleanId) {
      setErrorMsg('Please paste a valid Google Sheet URL or ID.');
      return;
    }

    try {
      await onConnect(cleanId, selectedSheet, selectedWishlist);
      if (onTriggerSync) {
        onTriggerSync();
      }
      toast.success('Connected and synced Google Sheets successfully!');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect. Verify your URL and permissions.');
    }
  };

  // Export Data to JSON File
  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(shows, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = 'showflix-library-backup.json';

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      toast.success('💾 Library backup exported successfully!');
    } catch (e) {
      toast.error('Could not export library backup.');
    }
  };

  // Force sync / reload cache
  const handleForcePullUpdate = () => {
    if (onTriggerSync) {
      onTriggerSync();
      toast.success('⚡ Requesting full library update from Sheets...');
    } else {
      toast.error('Sync trigger is offline');
    }
  };

  return (
    <div
      id="settings-center-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="settings-center-modal-dialog"
        className="relative w-full max-w-4xl bg-[#141414] border-0 rounded-2xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col md:max-h-[90vh]"
        style={{ border: 'none', outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-900 bg-gradient-to-r from-zinc-900 to-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-lg">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>ShowFlix Settings Center</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
                  Control Panel
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Configure your profiles, sync preferences, display themes, and inclusive settings.
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
        <div className="p-6 overflow-y-auto overscroll-contain space-y-6 flex-1 bg-zinc-950/20 border-0">
          
          {/* VIEW A: CENTRAL GRID DASHBOARD (3x2 Grid matching the user's rough Paint sketch) */}
          {activeTab === 'all' && (
            <div className="space-y-4.5">
              {/* Mini Box Metrics Display Row on Control Panel Home (Matching Quick Metrics Tab) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 select-none">
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider block">Total</span>
                  <span className="text-base font-black text-white">{shows.length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-amber-400/90 uppercase font-bold tracking-wider block">Watching</span>
                  <span className="text-base font-black text-amber-400">{shows.filter((s) => s.status === '⏳ Watching').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-emerald-400/90 uppercase font-bold tracking-wider block">Completed</span>
                  <span className="text-base font-black text-emerald-400">{shows.filter((s) => s.status === '✅ Watched').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-red-400/90 uppercase font-bold tracking-wider block">Progress</span>
                  <span className="text-base font-black text-red-400">
                    {shows.length > 0 ? Math.round((shows.filter((s) => s.status === '✅ Watched').length / shows.length) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-purple-400/90 uppercase font-bold tracking-wider block">Movies</span>
                  <span className="text-base font-black text-purple-300">{shows.filter((s) => s.type === 'Movie').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-blue-400/90 uppercase font-bold tracking-wider block">Series</span>
                  <span className="text-base font-black text-blue-300">{shows.filter((s) => s.type === 'Series').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-amber-400/90 uppercase font-bold tracking-wider block">Wishlist</span>
                  <span className="text-base font-black text-amber-300">{shows.filter((s) => s.isWishlist).length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2.5 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] text-sky-400/90 uppercase font-bold tracking-wider block">Coming Soon</span>
                  <span className="text-base font-black text-sky-300">
                    {shows.filter((s) => Boolean(s.releaseDate || s.releaseNote || s.nextAirDate || s.nextAirTimestamp)).length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
              
              {/* CARD 1: User Profile Settings (user) */}
              <div
                onClick={() => setActiveTab('user')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all duration-200">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-red-500 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">👤 Profile Users & Color Tags</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Manage viewer names & visual color tags synced with your Google Sheet.
                </p>
                <span className="inline-block text-[10px] text-red-400 font-bold mt-3 underline decoration-dotted">Open profile & color settings &rarr;</span>
              </div>

              {/* CARD 2: Google Sheets Sync (sheets) */}
              <div
                onClick={() => setActiveTab('sync')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition-all duration-200">
                    <Table className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-amber-500 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">📂 Google Sheets Sync</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  {isConnected ? `Connected to sheet "${sheetTitle || 'Spreadsheet'}"` : 'Google Sheets Sync not connected yet.'} Set frequency & edit URL.
                </p>
                <span className="inline-block text-[10px] text-amber-400 font-bold mt-3 underline decoration-dotted">Open sync manager &rarr;</span>
              </div>

              {/* CARD 3: Accessibility & Inclusion (accessibility) */}
              <div
                onClick={() => setActiveTab('acc')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all duration-200">
                    <Accessibility className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-purple-400 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">👁️ Inclusive Settings</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Toggle Large / Clear Print, High Contrast WCAG mode, Dyslexia-friendly text fonts, or Reduced Motion.
                </p>
                <span className="inline-block text-[10px] text-purple-400 font-bold mt-3 underline decoration-dotted">Open inclusive settings &rarr;</span>
              </div>

              {/* CARD 4: Alert Intervals (alerts) */}
              <div
                onClick={() => setActiveTab('alerts')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
                    <Bell className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-blue-400 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">🔔 Alert Intervals</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Choose custom notification triggers for upcoming releases (e.g. 1 week, 3 days, or 1 hour before).
                </p>
                <span className="inline-block text-[10px] text-blue-400 font-bold mt-3 underline decoration-dotted">Open alert settings &rarr;</span>
              </div>

              {/* CARD 5: Data Backup & Reset (data) */}
              <div
                onClick={() => setActiveTab('data')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200">
                    <Database className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-emerald-400 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">💾 Backup & Reset Cache</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Download offline JSON backups of your tracking, force sync live data, or reset local app cached data.
                </p>
                <span className="inline-block text-[10px] text-emerald-400 font-bold mt-3 underline decoration-dotted">Open backup tools &rarr;</span>
              </div>

            </div>
          </div>
        )}

          {/* VIEW B: USER PROFILE SETTINGS DETAIL PANEL */}
          {activeTab === 'user' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">👤 Profile Settings & Color Tags</h4>
                  <p className="text-xs text-zinc-400">
                    Assign visual color tags to distinct profile names.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              {/* Add New Profile Form with Color Tag Picker */}
              <form onSubmit={handleAddViewer} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800/80 space-y-3 shadow-lg">
                <div>
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    ➕ Add New Profile Name & Color Tag
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Me, Alex, Family, Kids..."
                      value={newViewerName}
                      onChange={(e) => setNewViewerName(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={!newViewerName.trim()}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md hover:scale-105 active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> Add Profile
                    </button>
                  </div>
                </div>

                {/* Color Tag Swatch Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-zinc-400">Assign Color Tag:</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {PROFILE_COLOR_PALETTE.map((c) => {
                      const isSelected = selectedNewColor.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSelectedNewColor(c.hex)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-zinc-900 shadow-lg'
                              : 'opacity-70 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </form>

              {/* Configured Profiles List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Configured Profile Viewers ({currentList.length})
                  </h5>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentList.map((viewer, index) => {
                    const isSelected = activeProfile === viewer;
                    const isEditing = editingIndex === index;
                    const viewerColor = getViewerColor(viewer, viewerColors);
                    const colorName = getViewerColorName(viewerColor);
                    const isPaletteOpen = activeColorPickerIndex === index;

                    return (
                      <div
                        key={`modal-viewer-${index}`}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-zinc-900/95 border-red-500/50 shadow-md ring-1 ring-red-500/20'
                            : 'bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(index);
                                }}
                                className="flex-1 bg-zinc-950 border border-red-500 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(index)}
                                className="p-1.5 bg-emerald-600 text-white rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Color-coded Avatar with soft colored shadow */}
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-md ring-2 transition-transform"
                                style={{
                                  backgroundColor: viewerColor,
                                  borderColor: `${viewerColor}80`,
                                  boxShadow: `0 4px 12px ${viewerColor}40`,
                                }}
                              >
                                {viewer.charAt(0).toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-white truncate block">
                                    {viewer}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-600/20 text-red-400 border border-red-500/30">
                                      Active
                                    </span>
                                  )}
                                </div>

                                {/* Clickable Color Tag Badge */}
                                <button
                                  type="button"
                                  onClick={() => setActiveColorPickerIndex(isPaletteOpen ? null : index)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border transition-all cursor-pointer hover:scale-105"
                                  style={{
                                    backgroundColor: `${viewerColor}18`,
                                    color: viewerColor,
                                    borderColor: `${viewerColor}40`,
                                  }}
                                  title="Click to change profile color tag"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: viewerColor }}
                                  />
                                  <span>{colorName}</span>
                                  <span className="text-[8px] opacity-70 ml-0.5">▼</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              {onSwitchProfile && !isSelected && (
                                <button
                                  type="button"
                                  onClick={() => onSwitchProfile(viewer)}
                                  className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  Select
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveColorPickerIndex(isPaletteOpen ? null : index)}
                                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Change Profile Color Tag"
                              >
                                <Palette className="w-3.5 h-3.5" style={{ color: viewerColor }} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIndex(index);
                                  setEditingName(viewer);
                                }}
                                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Rename Profile"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveViewer(index)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete Profile"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expandable Mini Palette for this profile */}
                        {isPaletteOpen && (
                          <div className="mt-3 pt-3 border-t border-zinc-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Choose Color Tag for {viewer}:
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 font-bold">
                                {colorName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {PROFILE_COLOR_PALETTE.map((c) => {
                                const isCurr = viewerColor.toLowerCase() === c.hex.toLowerCase();
                                return (
                                  <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() => {
                                      handleUpdateProfileColor(viewer, c.hex);
                                      setActiveColorPickerIndex(null);
                                    }}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                      isCurr
                                        ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-zinc-900 shadow-md'
                                        : 'opacity-70 hover:opacity-100 hover:scale-110'
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                    title={c.name}
                                  >
                                    {isCurr && <Check className="w-3 h-3 text-white drop-shadow" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW C: GOOGLE SHEETS SYNC DETAIL PANEL */}
          {activeTab === 'sync' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">📂 Google Sheets Sync Manager</h4>
                  <p className="text-xs text-zinc-400">Configure secure background sync and change connected spreadsheet URL details.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              {/* Status Banner */}
              {/* RE-SYNC PROMPT ALERT BANNER (Only if connected and NO shows loaded yet) */}
              {isConnected && shows.length === 0 && (
                <div className="p-3.5 mb-4 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                    <span className="truncate">
                      Google Account connected! Click <strong>"Re-Sync Now"</strong> to refresh your Google Sheets data.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReSync}
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-3 py-1.5 rounded-lg text-xs shrink-0 transition-all shadow-md cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-Sync Now</span>
                  </button>
                </div>
              )}
              
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 flex-wrap ${isConnected ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-zinc-900 border-zinc-900'}`}>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Connection Status</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                    <strong className="text-sm text-white">{isConnected ? 'Spreadsheet Connected' : 'Disconnected'}</strong>
                  </div>
                  {isConnected && (
                    <p className="text-xs text-zinc-400">
                      Syncing: <strong className="text-zinc-300 font-mono">{sheetTitle}</strong> ({shows.length} shows total)
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {isConnected ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDisconnect();
                        toast.success('Disconnected from Google Sheet');
                      }}
                      className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/40 text-xs font-bold px-3 py-2 rounded-lg"
                    >
                      Disconnect Sheet
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onSignIn();
                          if (onTriggerSync) {
                            onTriggerSync();
                          }
                          onClose();
                        } catch (err: any) {
                          toast.error(err.message || 'Sign in cancelled.');
                        }
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Connect Google Account
                    </button>
                  )}
                </div>
              </div>

              {/* Update Sync URL / ID Details */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Spreadsheet URL / ID
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sheetInputVal}
                    onChange={(e) => setSheetInputVal(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 bg-zinc-900 border-0 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSheetConnect}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shrink-0"
                  >
                    Save & Test Sync
                  </button>
                </div>
                {errorMsg && <p className="text-red-400 text-xs font-medium">{errorMsg}</p>}
              </div>

              {/* Auto Sync Timer frequency */}
              {onUpdateSyncFrequency && (
                <div className="space-y-2 pt-2 border-t border-zinc-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">⏱️ Auto-Sync Interval</span>
                      <p className="text-[11px] text-zinc-500">Change background automated fetch timer interval speed.</p>
                    </div>
                    <span className="text-xs font-bold font-mono text-white">{syncFrequency >= 60 ? `${syncFrequency / 60} minutes` : `${syncFrequency} seconds`}</span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {[15, 30, 45, 60, 180, 300].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onUpdateSyncFrequency(sec)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                          syncFrequency === sec
                            ? 'bg-emerald-500 text-white border-emerald-400'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-900 hover:bg-zinc-800'
                        }`}
                      >
                        {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW D: ACCESSIBILITY & INCLUSION DETAIL PANEL */}
          {activeTab === 'acc' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">👁️ Inclusive Sizing & Dyslexia Fonts</h4>
                  <p className="text-xs text-zinc-400">Modify typography sizes, visual accessibility contrast levels, and frame motions.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Large Print */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Large / Clear Print</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Increases typography sizing parameters (WCAG standard).</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        textSize: accessibilitySettings.textSize === 'large' ? 'standard' : 'large',
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.textSize === 'large' ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.textSize === 'large' ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* 2. Color Contrast */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">High contrast dark</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Applies direct black contrast lines on borders.</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        contrastMode: accessibilitySettings.contrastMode === 'high' ? 'default' : 'high',
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.contrastMode === 'high' ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.contrastMode === 'high' ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* 3. Dyslexia Friendly */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Dyslexia-Friendly Fonts</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Switches text headings to highly readable sans serif styles.</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        dyslexiaFont: !accessibilitySettings.dyslexiaFont,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.dyslexiaFont ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.dyslexiaFont ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* 4. Motion Reduce */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Reduce Transition Motion</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Turns off sliding shelves and animation effects.</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        reduceMotion: !accessibilitySettings.reduceMotion,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.reduceMotion ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.reduceMotion ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* VIEW E: ALERT INTERVALS PANEL */}
          {activeTab === 'alerts' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">🔔 Customizable Alert Intervals</h4>
                  <p className="text-xs text-zinc-400">Choose when you want to be notified about upcoming premieres.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'oneWeek', label: '1 Week Before', desc: 'Receive an alert 7 days before premiere' },
                  { id: 'threeDays', label: '3 Days Before', desc: 'Receive an alert 72 hours before premiere' },
                  { id: 'oneDay', label: '1 Day Before', desc: 'Receive an alert 24 hours before premiere' },
                  { id: 'oneHour', label: '1 Hour Before', desc: 'Final warning 60 minutes before start' },
                  { id: 'atRelease', label: 'At Release Time', desc: '"OUT NOW" notification when it airs' },
                ].map((interval) => (
                  <div key={interval.id} className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3 shadow-lg">
                    <div>
                      <h5 className="text-xs font-bold text-zinc-200">{interval.label}</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{interval.desc}</p>
                    </div>
                    <button
                      onClick={() =>
                        onUpdateAlertIntervals({
                          ...alertIntervals,
                          [interval.id]: !alertIntervals[interval.id as keyof AlertIntervals],
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        alertIntervals[interval.id as keyof AlertIntervals] ? 'bg-amber-500 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {alertIntervals[interval.id as keyof AlertIntervals] ? 'Enabled' : 'Off'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-200/80 text-[11px] leading-relaxed">
                <strong>Note:</strong> Alerts are triggered automatically while the app is open in your browser. Ensure browser notifications are allowed to receive native system alerts.
              </div>
            </div>
          )}

          {/* VIEW F: BACKUP & DATA MAINTENANCE */}
          {activeTab === 'data' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">💾 Library Backups & Maintenance</h4>
                  <p className="text-xs text-zinc-400">Export local library cached data or reset local system cache storage completely.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Offline JSON Backup */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 space-y-3.5">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Export Offline JSON Backup</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Download a complete structured JSON list of all tracked titles offline.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer text-center block"
                  >
                    Download JSON Backup
                  </button>
                </div>

                {/* 2. Force Pull Update */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 space-y-3.5">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Force Pull Raw Sheets Update</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Bypasses cached local storage data and retrieves raw content directly.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleForcePullUpdate}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer text-center block"
                  >
                    Force Live Refresh
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4.5 bg-zinc-900 border-t border-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>ShowFlix settings dashboard synced automatically.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-colors cursor-pointer"
          >
            Done & Save
          </button>
        </div>
      </div>
    </div>
  );
}
