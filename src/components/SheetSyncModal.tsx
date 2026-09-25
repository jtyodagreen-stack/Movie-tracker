import { useState, useEffect } from 'react';
import {
  X,
  Table,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  extractSpreadsheetId,
  findMatchingWishlistSheet,
  findMatchingMasterSheet,
  fetchSpreadsheetDetails,
} from '../services/sheetsService';
import { getAccessToken } from '../firebase';

interface SheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSignIn: () => void;
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  availableTabs?: string[];
  onConnect: (id: string, name: string, wishlistName?: string) => Promise<void>;
  onDisconnect: () => void;
  isLoading: boolean;
  lastSyncedAt?: string;
  sheetTitle?: string;
  rowCount: number;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  onTriggerSync?: () => void;
}

export default function SheetSyncModal({
  isOpen,
  onClose,
  user,
  onSignIn,
  spreadsheetId,
  sheetName,
  wishlistSheetName = '📋  WISHLIST',
  availableTabs = [],
  onConnect,
  onDisconnect,
  isLoading,
  lastSyncedAt,
  sheetTitle,
  rowCount,
  autoSyncEnabled = true,
  onToggleAutoSync,
  onTriggerSync,
}: SheetSyncModalProps) {
  const [inputVal, setInputVal] = useState(spreadsheetId);
  const [selectedSheet, setSelectedSheet] = useState(sheetName || 'MASTER TRACKER');
  const [selectedWishlist, setSelectedWishlist] = useState(wishlistSheetName || '📋  WISHLIST');
  const [tabsList, setTabsList] = useState<string[]>(availableTabs);
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (spreadsheetId) setInputVal(spreadsheetId);
      if (sheetName) setSelectedSheet(sheetName);
      if (wishlistSheetName) setSelectedWishlist(wishlistSheetName);
      if (availableTabs && availableTabs.length > 0) {
        setTabsList(availableTabs);
        const matchedW = findMatchingWishlistSheet(availableTabs);
        if (matchedW) {
          setSelectedWishlist(matchedW);
        }
      }
      setErrorMsg(null);
    }
  }, [isOpen, spreadsheetId, sheetName, wishlistSheetName, availableTabs]);

  // Dynamically load sheet tabs if user is connected and sheet ID changes
  useEffect(() => {
    if (!isOpen) return;
    const cleanId = extractSpreadsheetId(inputVal) || inputVal.trim();
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
        // Tab preview check notice
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, inputVal]);

  if (!isOpen) return null;

  const isConnected = Boolean(spreadsheetId && sheetTitle);
  const detectedWishlist = findMatchingWishlistSheet(tabsList);

  const handleTestOrLoadTabs = async () => {
    const cleanId = extractSpreadsheetId(inputVal) || inputVal.trim();
    if (!cleanId) {
      setErrorMsg('Please paste a valid Google Sheet URL or Spreadsheet ID.');
      return;
    }

    setErrorMsg(null);
    setFetchingSheets(true);

    try {
      if (!user) {
        await onSignIn();
      }
      onClose();
      // Connect to Google Sheets with token and tab names
      await onConnect(
        cleanId,
        selectedSheet.trim() || 'MASTER TRACKER',
        selectedWishlist.trim() || detectedWishlist || '📋  WISHLIST'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to Google Sheets. Check permissions.');
    } finally {
      setFetchingSheets(false);
    }
  };

  return (
    <div
      id="sheet-sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="sheet-sync-modal-card"
        className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#181818] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-950">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Google Sheets Integration</span>
                <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Auto-Sync
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Seamless real-time synchronization with your Master Tracker spreadsheet
              </p>
            </div>
          </div>
          <button
            id="close-sync-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* NEW USER ONBOARDING SECTION */}
          {!isConnected && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-16 h-16 text-amber-500" />
              </div>
              <div className="relative z-10 space-y-2">
                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Official Template Required
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  To use this tracker, make a copy of our official template and set it up:
                </p>
                <div className="space-y-1.5 text-xs text-zinc-400">
                  <p>1. <strong className="text-amber-400">Click to make a copy of the official Sheet template</strong></p>
                  <p>2. Paste your new spreadsheet URL in the box below</p>
                  <p>3. Go to the <span className="font-mono text-zinc-300">Lists</span> sheet tab in your spreadsheet and enter profile names in Column D to populate your profile dropdown</p>
                </div>
                <div className="pt-2">
                  <a
                    href="https://docs.google.com/spreadsheets/d/1XWlhjlmRO3l85Ng_uVVGsAAApNiv469KGTRX0ZtpBBA/copy"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-4 py-2.5 rounded-md shadow-lg shadow-amber-900/20 transition-all cursor-pointer active:scale-95 no-underline uppercase"
                  >
                    <ExternalLink className="w-4 h-4" />
                    1. Click to make a copy of the official Sheet template
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Auto-Sync Banner */}
          <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-600/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-emerald-200">
                  Persistent Background Auto-Sync
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">
                  {autoSyncEnabled ? 'Auto-Sync Active' : 'Auto-Sync Paused'}
                </span>
                {onToggleAutoSync && (
                  <button
                    type="button"
                    onClick={() => onToggleAutoSync(!autoSyncEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoSyncEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoSyncEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              ✨ The app automatically fetches updates from Google Sheets every 45s and whenever you switch back to this tab — <strong>no manual login or re-auth required!</strong>
            </p>
          </div>

          {/* Auth status notice */}
          {!user ? (
            <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-800/60 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-200">
                    One-Time Google Sign-In Required
                  </h4>
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    Sign in with Google once. Your session will stay authenticated across browser visits so your show updates sync directly to your personal Google Sheet.
                  </p>
                </div>
              </div>
              <button
                id="sync-modal-signin-btn"
                type="button"
                onClick={onSignIn}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-950 text-xs sm:text-sm font-bold py-2 px-4 rounded-md transition-all shadow-md cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-zinc-300">Signed in as:</span>
                <span className="font-semibold text-white truncate max-w-[200px]">{user.email}</span>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
          )}

          {/* Current Connection Status */}
          {isConnected && (
            <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-bold text-emerald-200">
                    Linked to: {sheetTitle}
                  </span>
                </div>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 underline cursor-pointer"
                >
                  Open in Google Sheets <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Master Tab: <strong className="text-zinc-200">{sheetName}</strong></span>
                <span>•</span>
                <span>Wishlist Tab: <strong className="text-emerald-300">{wishlistSheetName}</strong></span>
                <span>•</span>
                <span>Rows: <strong className="text-zinc-200">{rowCount}</strong></span>
                {lastSyncedAt && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-300 font-medium">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      Last Auto-Sync: <strong>{lastSyncedAt}</strong>
                    </span>
                  </>
                )}
              </div>
              {onTriggerSync && (
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onTriggerSync}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Sync from Google Sheets Now</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Input Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="spreadsheet-id-input" className="text-xs font-semibold text-zinc-300 block">
                  Google Sheets URL or Spreadsheet ID
                </label>
                {isConnected && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Permanent Default Sheet Saved
                  </span>
                )}
              </div>
              <input
                id="spreadsheet-id-input"
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTestOrLoadTabs();
                  }
                }}
                placeholder="Paste the full link from your browser address bar..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
              />

              
            </div>

            {/* Detected Tabs Section */}
            {/* Removed for simplicity */}

            {/* Detected Wishlist Highlight Alert */}
            {/* Removed for simplicity */}

            {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="sheet-tab-name-input" className="text-xs font-semibold text-zinc-300 block">
                    📊 Master Tracker Tab Name
                  </label>
                  {tabsList.length > 0 && (
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-1.5 py-0.5"
                    >
                      {tabsList.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  id="sheet-tab-name-input"
                  type="text"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  placeholder="e.g. MASTER TRACKER"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-zinc-500">
                  Tab holding your active watched &amp; watching shows.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="wishlist-tab-name-input" className="text-xs font-semibold text-zinc-300 block">
                    🎁 Wishlist Tab Name
                  </label>
                  {tabsList.length > 0 && (
                    <select
                      value={selectedWishlist}
                      onChange={(e) => setSelectedWishlist(e.target.value)}
                      className="text-[11px] bg-zinc-800 text-amber-300 border border-zinc-700 rounded px-1.5 py-0.5 font-medium"
                    >
                      {tabsList.map((t) => (
                        <option key={t} value={t}>
                          {t} {t === detectedWishlist ? '⭐ (Detected Wishlist)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  id="wishlist-tab-name-input"
                  type="text"
                  value={selectedWishlist}
                  onChange={(e) => setSelectedWishlist(e.target.value)}
                  placeholder="e.g. 📋  WISHLIST"
                  className="w-full bg-zinc-900 border border-amber-600/50 rounded-md px-3 py-2 text-sm text-amber-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-zinc-500">
                  Tab holding titles on your wishlist to watch later.
                </p>
              </div>
            </div> */}
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Column structure guide & template download */}
          {!isConnected && (
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  Supported Columns in Your Master Tracker:
                </h4>
                <button
                  type="button"
                  onClick={() => window.open('https://docs.google.com/spreadsheets/d/1XWlhjlmRO3l85Ng_uVVGsAAApNiv469KGTRX0ZtpBBA/copy', '_blank')}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 underline underline-offset-2 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Make a Copy of Master Template</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Title, Type, Platform, Seasons, Episodes, Genre, Year, Status, Rating, Notes, Who, Max Ep, Poster.
                Any rows you update in this Netflix view will sync right back to your Google Sheet!
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
            {isConnected ? (
              <button
                id="disconnect-sheets-btn"
                type="button"
                onClick={onDisconnect}
                className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
              >
                Disconnect Sheet
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-2 cursor-pointer"
              >
                Close
              </button>
              <button
                id="sync-now-btn"
                type="button"
                disabled={fetchingSheets || isLoading}
                onClick={handleTestOrLoadTabs}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-md shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${fetchingSheets || isLoading ? 'animate-spin' : ''}`} />
                <span>{isConnected ? 'Re-Sync Now' : 'Connect & Load Sheet'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
