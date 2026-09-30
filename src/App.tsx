import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import type { User } from 'firebase/auth';
import {
  auth,
  initAuth,
  googleSignIn,
  handleRedirectResultOnLoad,
  logout,
  getAccessToken,
  setCachedAccessToken,
  saveUserSheetConfig,
  loadUserSheetConfig,
  googleFetch as fetch,
} from './firebase';
import { ShowItem, WatchStatus, PRESET_PLATFORMS, AccessibilitySettings, AlertIntervals } from './types';
import { DEFAULT_PROFILE_USER } from './utils/userProfile';
import {
  fetchSpreadsheetDetails,
  fetchMultipleSheetRows,
  updateSheetRow,
  appendSheetRow,
  deleteSheetRow,
  findRowNumberByTitle,
  updateEpisodeAndSeasonInSheet,
  ensurePosterColumnInSheet,
  ensureSheetTabExists,
  moveShowBetweenTabs,
  normalizeSeasonStr,
  normalizeEpisodeStr,
  normalizePlatform,
  normalizePriority,
  findMatchingWishlistSheet,
  findMatchingMasterSheet,
  findMatchingShowcaseSheet,
  DEFAULT_WISHLIST_HEADERS,
  getSheetTabHeaders,
  extractSpreadsheetId,
  fetchCustomViewers,
  updateCustomViewers,
  parseGoogleSheetsDate,
  formatA1Range,
} from './services/sheetsService';

import toast from 'react-hot-toast';
import Navbar from './components/Navbar';
import HeroBillboard from './components/HeroBillboard';
import ShowRow from './components/ShowRow';
import ShowCard from './components/ShowCard';
import ShowDetailModal from './components/ShowDetailModal';
import AddShowModal from './components/AddShowModal';
import SettingsCenterModal from './components/SettingsCenterModal';
import ConfirmModal from './components/ConfirmModal';
import DashboardStats from './components/DashboardStats';
import MainPageReleaseRadarBanner from './components/MainPageReleaseRadarBanner';
import ShowcaseSection from './components/ShowcaseSection';
import NetflixHoverPortal from './components/NetflixHoverPortal';
import {
  checkAndTrigger24hNotifications,
  parseReleaseDateToTimestamp,
  enableShowNotificationSilent,
  getAlertIntervals,
  saveAlertIntervals
} from './services/notificationService';
import { OfflineIndicator } from './components/OfflineIndicator';
import { getViewerColor } from './utils/profileColors';
import { getAppDataCache, setAppDataCache, queueOfflineAction } from './services/offlineQueue';
import { calculateShowProgress } from './utils/showMetrics';
import { parseAnyDate, getTodayDDMMYYYY } from './utils/dateUtils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import {
  Sparkles,
  Filter,
  Layers,
  Table,
  CheckCircle2,
  Tv,
  SlidersHorizontal,
  Calendar,
  X,
  Plus,
  ExternalLink,
  RotateCcw,
  BarChart3,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser || DEFAULT_PROFILE_USER);
  const [shows, setShows] = useState<ShowItem[]>(() => {
    try {
      const cache = getAppDataCache();
      const currentStoredId = localStorage.getItem('showflix_spreadsheet_id') || localStorage.getItem('bingebox_spreadsheet_id') || '';
      // Pre-flight check: Verify cache spreadsheet ID matches the stored active spreadsheet ID
      if (cache?.spreadsheetId && currentStoredId && cache.spreadsheetId !== currentStoredId) {
        console.warn('[Pre-flight Check] Cached shows belong to a different spreadsheet ID. Discarding stale data.');
        return [];
      }
      if (cache?.shows && cache.shows.length > 0) {
        return cache.shows;
      }
    } catch {}
    return [];
  });

  // Persist shows and active spreadsheet context to local cache whenever they update
  useEffect(() => {
    setAppDataCache({
      shows,
      spreadsheetId: localStorage.getItem('showflix_spreadsheet_id') || localStorage.getItem('bingebox_spreadsheet_id') || undefined,
    });
  }, [shows]);

  const showsRef = useRef<ShowItem[]>([]);
  useEffect(() => {
    showsRef.current = shows;
  }, [shows]);

  const isResetCheckInProgressRef = useRef(false);
  const lastResetCheckTimeRef = useRef(0);
  const connectingSheetIdRef = useRef<string | null>(null);

  // Ensure layout is clean on mount and during transitions
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.style.width = '100%';
      root.style.maxWidth = '100%';
      root.style.overflowX = 'hidden';
    }
    document.body.style.width = '100%';
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.width = '100%';
    document.documentElement.style.overflowX = 'hidden';
  }, []);

  const handleSyncOfflineQueue = async (queue: any[]) => {
    for (const action of queue) {
      try {
        if (action.payload) {
          await syncShowToSheet(action.payload);
        }
      } catch (e) {
        console.error('Failed to sync offline action:', action, e);
      }
    }
    showToast('✨ All offline changes successfully synced to Google Sheets!');
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [customPlatforms] = useState<string[]>([]);
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem('showflix_accessibility_settings') || localStorage.getItem('bingebox_accessibility_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return {
      contrastMode: 'default',
      textSize: 'standard',
      dyslexiaFont: false,
      reduceMotion: false,
    };
  });

  const [alertIntervals, setAlertIntervals] = useState<AlertIntervals>(() => getAlertIntervals());

  const handleUpdateAlertIntervals = (intervals: AlertIntervals) => {
    setAlertIntervals(intervals);
    saveAlertIntervals(intervals);
    toast.success('🔔 Alert preferences updated!');
  };

  // Persist accessibility settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('showflix_accessibility_settings', JSON.stringify(accessibilitySettings));
    } catch {
      // Ignore
    }
  }, [accessibilitySettings]);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [sortOrder, setSortOrder] = useState('title-asc');
  const [selectedShow, setSelectedShow] = useState<ShowItem | null>(null);

  const [hoveredShowId, setHoveredShowId] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const hoverGraceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filteredSectionRef = useRef<HTMLElement | null>(null);

  const hoveredShow = useMemo(() => {
    return shows.find((s) => s.id === hoveredShowId) || null;
  }, [shows, hoveredShowId]);

  const handleOpenDetails = useCallback((show: ShowItem) => {
    if (hoverGraceTimeoutRef.current) {
      clearTimeout(hoverGraceTimeoutRef.current);
      hoverGraceTimeoutRef.current = null;
    }
    setHoveredShowId(null);
    setHoveredRect(null);
    setSelectedShow(show);
  }, []);

  const handleHoverEnter = useCallback((show: ShowItem, rect: { top: number; left: number; width: number; height: number }) => {
    if (selectedShow) return;
    if (hoverGraceTimeoutRef.current) {
      clearTimeout(hoverGraceTimeoutRef.current);
      hoverGraceTimeoutRef.current = null;
    }
    setHoveredShowId(show.id);
    setHoveredRect(rect);
  }, [selectedShow]);

  const handleHoverPortalEnter = useCallback(() => {
    if (hoverGraceTimeoutRef.current) {
      clearTimeout(hoverGraceTimeoutRef.current);
      hoverGraceTimeoutRef.current = null;
    }
  }, []);

  const handleHoverLeave = useCallback(() => {
    // Completely ignore mouse-leave events on mobile viewports (window.innerWidth < 768)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return;
    }
    if (hoverGraceTimeoutRef.current) {
      clearTimeout(hoverGraceTimeoutRef.current);
    }
    hoverGraceTimeoutRef.current = setTimeout(() => {
      setHoveredShowId(null);
      setHoveredRect(null);
    }, 150); // Small grace period so the mouse can easily glide from the static card to the portal
  }, []);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track window scroll position for Back to Top
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: accessibilitySettings.reduceMotion ? 'auto' : 'smooth',
    });
  };

  // Welcome onboarding state
  const [welcomeSheetUrl, setWelcomeSheetUrl] = useState('');
  const [welcomeError, setWelcomeError] = useState('');

  // Google Sheets state with localStorage persistence
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    try {
      return getAppDataCache()?.spreadsheetId || localStorage.getItem('showflix_spreadsheet_id') || localStorage.getItem('bingebox_spreadsheet_id') || '';
    } catch {
      return '';
    }
  });
  const [sheetName, setSheetName] = useState<string>(() => {
    try {
      return getAppDataCache()?.sheetName || localStorage.getItem('showflix_sheet_name') || localStorage.getItem('bingebox_sheet_name') || 'MASTER TRACKER';
    } catch {
      return 'MASTER TRACKER';
    }
  });
  const [wishlistSheetName, setWishlistSheetName] = useState<string>(() => {
    try {
      return getAppDataCache()?.wishlistSheetName || localStorage.getItem('showflix_wishlist_sheet_name') || localStorage.getItem('bingebox_wishlist_sheet_name') || '📋  WISHLIST';
    } catch {
      return '📋  WISHLIST';
    }
  });
  const [showcaseSheetName, setShowcaseSheetName] = useState<string>(() => {
    try {
      return getAppDataCache()?.showcaseSheetName || localStorage.getItem('showflix_showcase_sheet_name') || localStorage.getItem('bingebox_showcase_sheet_name') || 'SHOWCASE';
    } catch {
      return 'SHOWCASE';
    }
  });
  const [availableTabs, setAvailableTabs] = useState<string[]>(() => {
    try {
      const v = localStorage.getItem('showflix_available_sheet_tabs') || localStorage.getItem('bingebox_available_sheet_tabs');
      if (v) return JSON.parse(v);
    } catch {}
    return [];
  });
  const [sheetTabId, setSheetTabId] = useState<number | undefined>(() => {
    try {
      const v = localStorage.getItem('showflix_sheet_tab_id') || localStorage.getItem('bingebox_sheet_tab_id');
      return v ? parseInt(v, 10) : undefined;
    } catch {
      return undefined;
    }
  });
  const [sheetTitle, setSheetTitle] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem('showflix_sheet_title') || localStorage.getItem('bingebox_sheet_title') || undefined;
    } catch {
      return undefined;
    }
  });
  const [sheetHeaders, setSheetHeaders] = useState<string[]>(() => {
    try {
      const cache = getAppDataCache();
      if (cache?.headers && cache.headers.length > 0) return cache.headers;
      const v = localStorage.getItem('showflix_sheet_headers') || localStorage.getItem('bingebox_sheet_headers');
      if (v) return JSON.parse(v);
    } catch {}
    return [
      'Title',
      'Type',
      'Platform',
      'Seasons',
      'Episodes',
      '▶ Next Ep',
      '📺 Next Ssn',
      'Genre',
      'Year',
      'Status',
      'Rating',
      'Notes',
      'Who',
      'Rating num',
      'Max Ep',
    ];
  });
  const [customViewers, setCustomViewers] = useState<string[]>(() => {
    try {
      const cache = getAppDataCache();
      if (cache?.customViewers && cache.customViewers.length > 0) return cache.customViewers;
      const cached = localStorage.getItem('showflix_custom_viewers') || localStorage.getItem('bingebox_custom_viewers');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [viewerColors, setViewerColors] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem('showflix_viewer_colors');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [activeProfile, setActiveProfile] = useState<string>(() => {
    try {
      return localStorage.getItem('showflix_active_profile') || '';
    } catch {
      return '';
    }
  });

  const profileFilteredShows = useMemo(() => {
    let list = shows;
    if (activeProfile) {
      const normActive = activeProfile.trim().toLowerCase();
      list = list.filter((show) => {
        if (!show.who) return false;
        const showWho = String(show.who).trim().toLowerCase();
        if (!showWho) return false;
        if (showWho === normActive || showWho.includes(normActive)) return true;
        const parts = showWho.split(/[&,\/]/).map((p) => p.trim());
        return parts.includes(normActive);
      });
    }
    return list;
  }, [shows, activeProfile]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('showflix_auto_sync') !== 'false' && localStorage.getItem('bingebox_auto_sync') !== 'false';
    } catch {
      return true;
    }
  });
  const [syncFrequency, setSyncFrequency] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('showflix_sync_frequency') || localStorage.getItem('bingebox_sync_frequency');
      if (saved) return parseInt(saved, 10) || 45;
    } catch {}
    return 45;
  });
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('🌐 Internet connection restored');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('⚠️ Offline Mode: Changes stored locally and will sync when online');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSwitchProfile = (profile: string) => {
    setActiveProfile(profile);
    try {
      if (profile) {
        localStorage.setItem('showflix_active_profile', profile);
        showToast(`👤 Switched profile to ${profile}`);
      } else {
        localStorage.removeItem('showflix_active_profile');
        showToast('👥 Viewing all profiles');
      }
    } catch {}
  };

  const handleUpdateViewerColors = (colors: Record<string, string>) => {
    setViewerColors(colors);
    try {
      localStorage.setItem('showflix_viewer_colors', JSON.stringify(colors));
    } catch {}
  };

  const handleUpdateSyncFrequency = (freq: number) => {
    setSyncFrequency(freq);
    try {
      localStorage.setItem('showflix_sync_frequency', String(freq));
    } catch {}
    const activeUid = auth.currentUser?.uid || (user && user.uid !== 'user_default' ? user.uid : undefined);
    if (activeUid) {
      saveUserSheetConfig(activeUid, { syncFrequency: freq }).catch(console.warn);
    }
    showToast(`⏱️ Background sync frequency set to ${freq >= 60 ? `${freq / 60} min` : `${freq}s`}`);
  };

  const handleUpdateCustomViewers = async (updatedViewers: string[], updatedColors?: Record<string, string>) => {
    setCustomViewers(updatedViewers);
    try {
      localStorage.setItem('showflix_custom_viewers', JSON.stringify(updatedViewers));
    } catch {}

    const colorsToSave = updatedColors || viewerColors;
    if (updatedColors) {
      setViewerColors(updatedColors);
      try {
        localStorage.setItem('showflix_viewer_colors', JSON.stringify(updatedColors));
      } catch {}
    }

    // Seamless auto-sync to Google Sheet Lists tab Column D (Profile Name) and Column E (Color Tag)
    if (spreadsheetId) {
      try {
        let token = await getAccessToken();
        if (!token) {
          const authRes = await handleSignIn();
          token = authRes?.accessToken || null;
        }
        if (token) {
          const meta = await fetchSpreadsheetDetails(spreadsheetId, token);
          if (meta) {
            const listsTabName = meta.sheetNames.find((t) => t.toLowerCase().includes('lists')) || 'Lists';
            const success = await updateCustomViewers(spreadsheetId, listsTabName, updatedViewers, token, colorsToSave);
            if (success) {
              showToast('👤 Google Sheets profiles & color tags updated!');
            } else {
              showToast('⚠️ Failed to sync profiles to Lists sheet');
            }
          }
        }
      } catch (err: any) {
        console.warn('Failed to sync custom viewers to sheet:', err);
        showToast(`⚠️ Profile sync error: ${err.message || String(err)}`);
      }
    }
  };

  const clearAllUserData = useCallback(() => {
    setUser(null);
    setShows([]);
    setSelectedShow(null);
    setShowAddModal(false);
    setShowSyncModal(false);
    setCustomViewers([]);
    setViewerColors({});
    setActiveProfile('');
    try {
      localStorage.removeItem('showflix_viewer_colors');
      localStorage.removeItem('showflix_active_profile');
    } catch {}
    setSpreadsheetId('');
    setSheetName('MASTER TRACKER');
    setWishlistSheetName('📋  WISHLIST');
    setAvailableTabs([]);
    setSheetTabId(undefined);
    setSheetTitle(undefined);
    setSheetHeaders([]);
    setSearchQuery('');
    setActiveFilter('all');
    setSelectedPlatform('all');
    setSelectedYear('all');
    setWelcomeSheetUrl('');
    setWelcomeError('');

    const keysToClear = [
      'showflix_preview_mode',
      'showflix_spreadsheet_id',
      'showflix_sheet_name',
      'showflix_wishlist_sheet_name',
      'showflix_showcase_sheet_name',
      'showflix_available_sheet_tabs',
      'showflix_sheet_tab_id',
      'showflix_sheet_title',
      'showflix_sheet_headers',
      'showflix_app_data_cache',
      'showflix_cached_shows',
      'showflix_offline_queue',
      'showflix_auto_sync',
      'showflix_custom_viewers',
      'showflix_sync_frequency',
      'showflix_accessibility_settings',
      'bingebox_preview_mode',
      'bingebox_spreadsheet_id',
      'bingebox_sheet_name',
      'bingebox_wishlist_sheet_name',
      'bingebox_showcase_sheet_name',
      'bingebox_available_sheet_tabs',
      'bingebox_sheet_tab_id',
      'bingebox_sheet_title',
      'bingebox_sheet_headers',
      'bingebox_app_data_cache',
      'bingebox_auto_sync',
      'bingebox_custom_viewers',
      'google_access_token',
      'google_access_token_timestamp',
    ];
    keysToClear.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });
  }, []);

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    try {
      localStorage.setItem('showflix_auto_sync', String(enabled));
    } catch {}
    showToast(enabled ? '⚡ Auto-Sync Active: continuous real-time sync' : '⏸ Auto-Sync Paused');
  };

  // Featured billboard show index
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Confirmation modal state (mandated by Workspace integration skill for data mutations)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Notification toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    toast(msg);
  };

  // Reusable silent/background sync from Google Sheets
  const fetchLatestFromSheet = useCallback(
    async (isSilent = true) => {
      const currentSheetId = spreadsheetId || localStorage.getItem('bingebox_spreadsheet_id');
      const currentSheetName = sheetName || localStorage.getItem('bingebox_sheet_name') || 'MASTER TRACKER';
      const currentWishlistName = wishlistSheetName || localStorage.getItem('bingebox_wishlist_sheet_name') || 'Wishlist';
      const currentShowcaseName = showcaseSheetName || localStorage.getItem('bingebox_showcase_sheet_name') || 'SHOWCASE';
      if (!currentSheetId) return;

      let token = await getAccessToken();
      if (!token && auth.currentUser) {
        token = await getAccessToken(true);
      }
      if (!token) return;

      if (!isSilent) setIsSyncing(true);
      try {
        const tabConfigs = [
          { name: currentSheetName, isWishlist: false },
          { name: currentWishlistName, isWishlist: true },
          { name: currentShowcaseName, isWishlist: false }
        ];
        
        const results = await fetchMultipleSheetRows(currentSheetId, tabConfigs, token);
        const masterParsed = results[currentSheetName] || { shows: [], headers: [], headerRowIndex: 0 };
        const wishlistParsed = results[currentWishlistName] || { shows: [], headers: [], headerRowIndex: 0 };
        const showcaseParsed = results[currentShowcaseName] || { shows: [], headers: [], headerRowIndex: 0 };
        
        let combinedShows: ShowItem[] = [
          ...(masterParsed.shows || []), 
          ...(wishlistParsed.shows || []),
          ...(showcaseParsed.shows || [])
        ];

        // Deduplicate by ID
        const uniqueShows = Array.from(new Map(combinedShows.map(s => [s.id, s])).values());

        if (uniqueShows.length > 0) {
          setShows(uniqueShows);
          if (masterParsed.headers && masterParsed.headers.length > 0) {
            setSheetHeaders(masterParsed.headers);
          }

          // Cache all metadata for instant load next time
          setAppDataCache({
            shows: uniqueShows,
            headers: masterParsed.headers,
            spreadsheetId: currentSheetId,
            sheetName: currentSheetName,
            wishlistSheetName: currentWishlistName,
            showcaseSheetName: currentShowcaseName,
            customViewers: uniqueShows.length > 0 ? customViewers : undefined
          });
        } else {
          // Connected sheet is blank (0 shows): faithfully reflect empty state
          setShows([]);
          setAppDataCache({
            shows: [],
            headers: masterParsed.headers || [],
            spreadsheetId: currentSheetId,
            sheetName: currentSheetName,
            wishlistSheetName: currentWishlistName,
            showcaseSheetName: currentShowcaseName,
            customViewers: undefined
          });
        }
        
        // Try to sync custom viewers list if a lists tab exists
        try {
          const storedTabs = localStorage.getItem('bingebox_available_sheet_tabs');
          const tabs: string[] = storedTabs ? JSON.parse(storedTabs) : availableTabs;
          const listsTab = tabs.find((t) => t.toLowerCase().includes('lists'));
          if (listsTab && currentSheetId) {
            const viewerRes = await fetchCustomViewers(currentSheetId, listsTab, token);
            if (viewerRes?.viewers && viewerRes.viewers.length > 0) {
              setCustomViewers(viewerRes.viewers);
              localStorage.setItem('bingebox_custom_viewers', JSON.stringify(viewerRes.viewers));
            }
            if (viewerRes?.colors && Object.keys(viewerRes.colors).length > 0) {
              setViewerColors(viewerRes.colors);
              localStorage.setItem('showflix_viewer_colors', JSON.stringify(viewerRes.colors));
            }
          }
        } catch (listsErr) {
          console.warn('Silent sync custom viewers list fetch notice:', listsErr);
        }

        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedAt(nowStr);
        if (!isSilent) {
          const wCount = combinedShows.filter((s) => s.isWishlist).length;
          showToast(`✅ Synced ${combinedShows.length} shows (${combinedShows.length - wCount} Master, ${wCount} Wishlist)`);
        }
      } catch (e: any) {
        console.warn('Background auto-sync fetch:', e);
        const msg = e?.message || String(e);
        if (
          msg.includes('invalid authentication credentials') ||
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('invalid_grant') ||
          msg.includes('Expected OAuth 2 access token')
        ) {
          setCachedAccessToken(null);
          if (!isSilent) {
            setShowSyncModal(true);
            showToast('⚠️ Google Sheets session expired. Please click Connect to re-authenticate.');
          }
        }
      } finally {
        if (!isSilent) setIsSyncing(false);
      }
    },
    [spreadsheetId, sheetName, wishlistSheetName, showcaseSheetName, availableTabs]
  );

  // Handle Firebase sign-in redirect results on load
  useEffect(() => {
    handleRedirectResultOnLoad().then((res) => {
      if (res?.user) {
        setUser(res.user);
        showToast(`Signed in as ${res.user.displayName || res.user.email}`);
      }

      // Auto-restore settings modal on returning from redirect
      try {
        const redirectTab = sessionStorage.getItem('showflix_auth_redirect_active');
        if (redirectTab) {
          console.log('[Auth Restore] Restoring settings modal tab after redirect:', redirectTab);
          setShowSyncModal(true);
          sessionStorage.removeItem('showflix_auth_redirect_active');
        }
      } catch (e) {
        console.warn('[Auth Restore] Failed checking session storage:', e);
      }
    }).catch((err) => {
      console.warn('Redirect result check on load failed:', err);
    });
  }, []);

  // Initialize Firebase Auth listener and auto-sync on load
  useEffect(() => {
    const unsubscribe = initAuth(
      async (currentUser, token) => {
        setUser(currentUser || DEFAULT_PROFILE_USER);

        let activeSheetId = localStorage.getItem('bingebox_spreadsheet_id') || '';
        let activeSheetName = localStorage.getItem('bingebox_sheet_name') || 'MASTER TRACKER';
        let activeWishlistName = localStorage.getItem('bingebox_wishlist_sheet_name') || '📋  WISHLIST';
        let activeShowcaseName = localStorage.getItem('bingebox_showcase_sheet_name') || 'SHOWCASE';

        // If user is actively connecting a specific new sheet, do not overwrite it with old Firestore settings
        if (connectingSheetIdRef.current) {
          console.log('[Auth] Active sheet connection in progress, skipping Firestore overwrite:', connectingSheetIdRef.current);
          return;
        }

        // Pre-flight Check during Auth flow: Verify if user's cloud config matches current session
        if (currentUser?.uid) {
          try {
            const cloudConfig = await loadUserSheetConfig(currentUser.uid);
            if (cloudConfig?.spreadsheetId) {
              const currentLocalId = localStorage.getItem('bingebox_spreadsheet_id') || '';
              
              // If local storage has a different spreadsheet ID than cloud config, pre-flight check detects change
              if (currentLocalId && cloudConfig.spreadsheetId !== currentLocalId && !connectingSheetIdRef.current) {
                console.log('[Pre-flight Check] Sheet updated in user profile. Clearing stale local shows before sync.');
                setShows([]);
                setSheetHeaders([]);
                setAppDataCache({ shows: [], spreadsheetId: cloudConfig.spreadsheetId });
              }

              if (!currentLocalId || (!connectingSheetIdRef.current && cloudConfig.spreadsheetId !== currentLocalId)) {
                activeSheetId = cloudConfig.spreadsheetId;
                setSpreadsheetId(cloudConfig.spreadsheetId);
                localStorage.setItem('bingebox_spreadsheet_id', cloudConfig.spreadsheetId);

                if (cloudConfig.sheetName) {
                  activeSheetName = cloudConfig.sheetName;
                  setSheetName(cloudConfig.sheetName);
                  localStorage.setItem('bingebox_sheet_name', cloudConfig.sheetName);
                }
                if (cloudConfig.wishlistSheetName) {
                  activeWishlistName = cloudConfig.wishlistSheetName;
                  setWishlistSheetName(cloudConfig.wishlistSheetName);
                  localStorage.setItem('bingebox_wishlist_sheet_name', cloudConfig.wishlistSheetName);
                }
                if (cloudConfig.showcaseSheetName) {
                  activeShowcaseName = cloudConfig.showcaseSheetName;
                  setShowcaseSheetName(cloudConfig.showcaseSheetName);
                  localStorage.setItem('bingebox_showcase_sheet_name', cloudConfig.showcaseSheetName);
                }
                if (cloudConfig.sheetTitle) {
                  setSheetTitle(cloudConfig.sheetTitle);
                  localStorage.setItem('bingebox_sheet_title', cloudConfig.sheetTitle);
                }
                if (cloudConfig.sheetTabId !== undefined) {
                  setSheetTabId(cloudConfig.sheetTabId);
                  localStorage.setItem('bingebox_sheet_tab_id', String(cloudConfig.sheetTabId));
                }
                if (cloudConfig.autoSyncEnabled !== undefined) {
                  setAutoSyncEnabled(cloudConfig.autoSyncEnabled);
                  localStorage.setItem('bingebox_auto_sync', String(cloudConfig.autoSyncEnabled));
                }
                if (cloudConfig.syncFrequency !== undefined) {
                  setSyncFrequency(cloudConfig.syncFrequency);
                  localStorage.setItem('bingebox_sync_frequency', String(cloudConfig.syncFrequency));
                }
              }
            }
          } catch (e) {
            console.warn('[Pre-flight Check] Notice while checking cloud sheet configuration:', e);
          }
        }

        // Automatically fetch latest shows from the saved Google Sheet (Background Refresh)
        if (activeSheetId && token) {
          console.log('[Background Refresh] Auth ready, revalidating sheet data...');
          fetchLatestFromSheet(true);
        }
      },
      () => {
        setUser(DEFAULT_PROFILE_USER);
      }
    );
    return () => unsubscribe();
  }, [fetchLatestFromSheet]);

  // Background Auto-Sync: Poll at configured frequency when tab is active and online
  useEffect(() => {
    if (!autoSyncEnabled || !spreadsheetId || !isOnline) return;

    const intervalMs = (syncFrequency || 45) * 1000;
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fetchLatestFromSheet(true);
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [autoSyncEnabled, spreadsheetId, syncFrequency, isOnline, fetchLatestFromSheet]);

  // Listen for Google Sheets 403 API permission errors
  useEffect(() => {
    const handleGoogleSheets403 = () => {
      toast.error('⚠️ Google Sheets permission error (403). Please reconnect Google Sheets in Settings.');
      setShowSyncModal(true);
    };

    window.addEventListener('google-sheets-403', handleGoogleSheets403);
    return () => {
      window.removeEventListener('google-sheets-403', handleGoogleSheets403);
    };
  }, []);

  // Tab Focus & Visibility Change Auto-Sync: Refresh whenever user switches back to this tab
  useEffect(() => {
    if (!autoSyncEnabled || !spreadsheetId) return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchLatestFromSheet(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [autoSyncEnabled, spreadsheetId, fetchLatestFromSheet]);



  const handleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setUser(res.user);
        showToast(`Signed in as ${res.user.displayName || res.user.email}`);
        return res;
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      showToast(`Sign in error: ${err.message || 'Please try again'}`);
    }
    return null;
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout error:', err);
    }
    clearAllUserData();
    setUser(DEFAULT_PROFILE_USER);
    showToast('Signed out');
  };

  // Google Sheets Connect & Sync
  const handleConnectSheets = async (targetId: string, targetSheetName: string, targetWishlistSheet: string = 'Wishlist') => {
    const cleanId = extractSpreadsheetId(targetId) || targetId.trim();
    if (!cleanId) {
      showToast('⚠️ Please provide a valid Google Sheet URL or ID');
      return;
    }

    connectingSheetIdRef.current = cleanId;

    // Immediately clear out old shows, old headers, and old cache so data from a previous sheet never lingers
    setShows([]);
    setSheetHeaders([]);
    setSpreadsheetId(cleanId);
    setIsSyncing(true);
    try {
      localStorage.setItem('bingebox_spreadsheet_id', cleanId);
      setAppDataCache({ shows: [], spreadsheetId: cleanId });
    } catch {}

    let token = await getAccessToken();
    if (!token) {
      const authRes = await handleSignIn();
      token = authRes?.accessToken || null;
      if (!token) {
        setIsSyncing(false);
        showToast('⚠️ Google sign-in is required to link your Google Sheet');
        return;
      }
    }

    try {
      // 1. Fetch metadata and rows in parallel
      // We guess common tab names for the ultra-fast first fetch
      const guessedTabs = [
        { name: targetSheetName || 'MASTER TRACKER', isWishlist: false },
        { name: targetWishlistSheet || 'Wishlist', isWishlist: true },
        { name: 'SHOWCASE', isWishlist: false }
      ];

      const [metaResult, quickSheetResults] = await Promise.allSettled([
        fetchSpreadsheetDetails(cleanId, token),
        fetchMultipleSheetRows(cleanId, guessedTabs, token),
      ]);

      const meta = metaResult.status === 'fulfilled' ? metaResult.value : null;
      const quickResults = quickSheetResults.status === 'fulfilled' ? quickSheetResults.value : {};
      
      let viewerResult: { viewers: string[]; colors: Record<string, string> } = { viewers: [], colors: {} };
      if (meta) {
        const listsTabName = meta.sheetNames.find((t) => t.toLowerCase().includes('lists'));
        if (listsTabName) {
          viewerResult = await fetchCustomViewers(cleanId, listsTabName, token);
        }
      }

      if (meta) {
        setAvailableTabs(meta.sheetNames);
        setSheetTitle(meta.title);
        localStorage.setItem('bingebox_available_sheet_tabs', JSON.stringify(meta.sheetNames));
        localStorage.setItem('bingebox_sheet_title', meta.title);
      }

      // If metadata is back, we can refine our tab names
      let chosenSheet = (targetSheetName || '').trim();
      let chosenWishlist = (targetWishlistSheet || '').trim();
      let chosenShowcase = 'SHOWCASE';

      if (meta) {
        const detectedMaster = findMatchingMasterSheet(meta.sheetNames);
        chosenSheet = detectedMaster || meta.sheetNames[0] || 'Sheet1';
        
        const detectedWishlist = findMatchingWishlistSheet(meta.sheetNames);
        chosenWishlist = detectedWishlist || '📋  WISHLIST';

        const detectedShowcase = findMatchingShowcaseSheet(meta.sheetNames);
        chosenShowcase = detectedShowcase || 'SHOWCASE';
      }

      // Use quick results if they match our refined names, otherwise fetch again (rare fallback)
      let masterParsed = quickResults[chosenSheet] || { shows: [], headers: [], headerRowIndex: 0 };
      let wishlistParsed = quickResults[chosenWishlist] || { shows: [], headers: [], headerRowIndex: 0 };
      let showcaseParsed = quickResults[chosenShowcase] || { shows: [], headers: [], headerRowIndex: 0 };

      // If we missed any due to bad guessing, fetch them specifically
      if (meta && (!quickResults[chosenSheet] || !quickResults[chosenWishlist])) {
        console.log('[Connection Optimization] Guessed tabs missed, fetching refined tabs...');
        const refinedTabs = [];
        if (!quickResults[chosenSheet]) refinedTabs.push({ name: chosenSheet, isWishlist: false });
        if (!quickResults[chosenWishlist]) refinedTabs.push({ name: chosenWishlist, isWishlist: true });
        
        const refinedResults = await fetchMultipleSheetRows(cleanId, refinedTabs, token);
        if (refinedResults[chosenSheet]) masterParsed = refinedResults[chosenSheet];
        if (refinedResults[chosenWishlist]) wishlistParsed = refinedResults[chosenWishlist];
      }

      if (viewerResult.viewers && viewerResult.viewers.length > 0) {
        setCustomViewers(viewerResult.viewers);
        localStorage.setItem('bingebox_custom_viewers', JSON.stringify(viewerResult.viewers));
      }
      if (viewerResult.colors && Object.keys(viewerResult.colors).length > 0) {
        setViewerColors(viewerResult.colors);
        localStorage.setItem('showflix_viewer_colors', JSON.stringify(viewerResult.colors));
      }

      let combinedShows: ShowItem[] = [
        ...(masterParsed.shows || []), 
        ...(wishlistParsed.shows || []),
        ...(showcaseParsed.shows || [])
      ];
      // Deduplicate
      const finalShows = Array.from(new Map(combinedShows.map(s => [s.id, s])).values());

      const matchedSheetObj = meta?.sheets.find(
        (s) => s.title.trim().toLowerCase() === chosenSheet.trim().toLowerCase()
      );

      setSheetName(chosenSheet);
      setWishlistSheetName(chosenWishlist);
      setShowcaseSheetName(chosenShowcase);
      setSheetTabId(matchedSheetObj?.id);
      if (masterParsed.headers.length > 0) {
        setSheetHeaders(masterParsed.headers);
      }

      setShows(finalShows);

      // Persist configuration & app data cache for instant initial render
      setAppDataCache({
        shows: finalShows,
        headers: masterParsed.headers,
        spreadsheetId: cleanId,
        sheetName: chosenSheet,
        wishlistSheetName: chosenWishlist,
        showcaseSheetName: chosenShowcase,
        customViewers: viewerResult.viewers && viewerResult.viewers.length > 0 ? viewerResult.viewers : undefined,
      });

      localStorage.setItem('bingebox_spreadsheet_id', cleanId);
      localStorage.setItem('bingebox_sheet_name', chosenSheet);
      localStorage.setItem('bingebox_wishlist_sheet_name', chosenWishlist);
      localStorage.setItem('bingebox_showcase_sheet_name', chosenShowcase);
      if (meta) localStorage.setItem('bingebox_sheet_title', meta.title);
      if (matchedSheetObj?.id !== undefined) localStorage.setItem('bingebox_sheet_tab_id', String(matchedSheetObj.id));

      const activeUid = auth.currentUser?.uid || (user && user.uid !== 'user_jtyodagreen' ? user.uid : undefined);
      if (activeUid) {
        saveUserSheetConfig(activeUid, {
          spreadsheetId: cleanId,
          sheetName: chosenSheet,
          wishlistSheetName: chosenWishlist,
          sheetTitle: meta?.title || '',
          sheetTabId: matchedSheetObj?.id,
          autoSyncEnabled: autoSyncEnabled,
          syncFrequency: syncFrequency,
          // Add custom field to Firestore for showcase
          ...({ showcaseSheetName: chosenShowcase })
        } as any).catch(console.warn);
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(nowStr);
      showToast(`✨ Instant Sync: ${finalShows.length} titles connected!`);
    } catch (err: any) {
      console.error('Sheets sync error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('invalid authentication credentials') || msg.includes('401') || msg.includes('invalid_grant') || msg.includes('Expected OAuth 2 access token')) {
        setCachedAccessToken(null);
        showToast('⚠️ Google Sheets session expired. Please sign in again with Google.');
      }
      throw err;
    } finally {
      setIsSyncing(false);
      connectingSheetIdRef.current = null;
    }
  };

  const handleDisconnectSheets = () => {
    const activeUid = auth.currentUser?.uid || (user && user.uid !== 'user_jtyodagreen' ? user.uid : undefined);
    if (activeUid) {
      saveUserSheetConfig(activeUid, {
        spreadsheetId: '',
        sheetName: 'MASTER TRACKER',
        sheetTitle: '',
        autoSyncEnabled: false,
      }).catch(console.warn);
    }

    setSpreadsheetId('');
    setSheetTitle(undefined);
    setSheetTabId(undefined);
    setLastSyncedAt(undefined);
    setShows([]);
    setSheetHeaders([]);
    try {
      localStorage.removeItem('bingebox_spreadsheet_id');
      localStorage.removeItem('bingebox_sheet_name');
      localStorage.removeItem('bingebox_wishlist_sheet_name');
      localStorage.removeItem('bingebox_showcase_sheet_name');
      localStorage.removeItem('bingebox_sheet_title');
      localStorage.removeItem('bingebox_sheet_tab_id');
      localStorage.removeItem('bingebox_sheet_headers');
      localStorage.removeItem('bingebox_app_data_cache');
      setAppDataCache({ shows: [], spreadsheetId: '' });
    } catch {}
    showToast('Disconnected Google Sheets');
  };

  // Helper: auto-sync updated show to Google Sheet (reliable non-blocking live update)
  const syncShowToSheet = async (updatedShow: ShowItem, isExplicitSave = false) => {
    if (!navigator.onLine) {
      queueOfflineAction('UPDATE_SHOW', updatedShow);
      showToast('📴 Offline: Change queued locally and will sync when online');
      return;
    }

    if (!spreadsheetId) {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to enable live sync');
      return;
    }

    const targetTab = updatedShow.sheetTabName || (updatedShow.isWishlist ? wishlistSheetName : sheetName);
    console.log(`[Google Sheets Sync] Syncing show "${updatedShow.title}" to tab "${targetTab}" with posterUrl: "${updatedShow.posterUrl || 'none'}"`);

    let rowNum = updatedShow.rowNumber;
    let currentHeaders = updatedShow.isWishlist ? DEFAULT_WISHLIST_HEADERS : sheetHeaders;

    try {
      let token = await getAccessToken();
      if (!token) {
        showToast('🔑 Authenticating Google session...');
        const authRes = await handleSignIn();
        token = authRes?.accessToken || null;
      }

      if (!token) {
        setShowSyncModal(true);
        showToast('⚠️ Google sign-in required. Please click Connect to sign in.');
        return;
      }

      // If show has a poster image and sheet lacks a poster column, ensure it exists
      const liveHeaders = await getSheetTabHeaders(spreadsheetId, targetTab, token);
      if (liveHeaders && liveHeaders.length > 0) {
        currentHeaders = liveHeaders;
      }

      if (!updatedShow.isWishlist && updatedShow.posterUrl && !currentHeaders.some((h, i) => h.toLowerCase().includes('poster') || h.toLowerCase().includes('image') || i === 15)) {
        try {
          const colRes = await ensurePosterColumnInSheet(spreadsheetId, targetTab, currentHeaders, token);
          if (colRes.wasAdded) {
            currentHeaders = colRes.headers;
            setSheetHeaders(currentHeaders);
            try {
              localStorage.setItem('bingebox_sheet_headers', JSON.stringify(currentHeaders));
            } catch {}
          }
        } catch (e) {
          console.warn('Could not auto-add poster column:', e);
        }
      }

      // If target tab is Wishlist, ensure tab exists
      if (updatedShow.isWishlist) {
        try {
          const tabRes = await ensureSheetTabExists(spreadsheetId, targetTab, DEFAULT_WISHLIST_HEADERS, token);
          if (tabRes.actualTitle && tabRes.actualTitle !== targetTab) {
            updatedShow.sheetTabName = tabRes.actualTitle;
          }
        } catch (tabErr) {
          console.warn('Ensure wishlist tab in syncShowToSheet:', tabErr);
        }
      }

      // 1. Resolve row number in the sheet
      if (!rowNum) {
        rowNum = (await findRowNumberByTitle(spreadsheetId, targetTab, updatedShow.title, token)) ?? undefined;
      }

      // --- DEEP VERIFICATION STEP ---
      // For quick actions (increment episode, toggle status), ensure releaseDate and releaseNote are not lost
      if (!isExplicitSave) {
        const existingShow = shows.find(
          (s) =>
            s.id === updatedShow.id ||
            (s.title && updatedShow.title && s.title.toLowerCase().trim() === updatedShow.title.toLowerCase().trim())
        );

        let verifiedReleaseDate = updatedShow.releaseDate?.trim();
        let verifiedReleaseNote = updatedShow.releaseNote?.trim();

        // Check state fallback: if incoming show has empty/undefined, but existing state has valid values, preserve them!
        if (!verifiedReleaseDate && existingShow?.releaseDate?.trim()) {
          verifiedReleaseDate = existingShow.releaseDate.trim();
          console.log(`[Google Sheets Deep Verification] Preserved releaseDate from local state for "${updatedShow.title}": "${verifiedReleaseDate}"`);
        }
        if (!verifiedReleaseNote && existingShow?.releaseNote?.trim()) {
          verifiedReleaseNote = existingShow.releaseNote.trim();
          console.log(`[Google Sheets Deep Verification] Preserved releaseNote from local state for "${updatedShow.title}": "${verifiedReleaseNote}"`);
        }

        // Live Sheet fallback: if still missing and row exists in Google Sheets, query the live sheet row
        if ((!verifiedReleaseDate || !verifiedReleaseNote) && rowNum && spreadsheetId) {
          try {
            const checkRange = formatA1Range(targetTab, `Q${rowNum}:R${rowNum}`);
            const checkRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(checkRange)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              const rowCells = checkData.values?.[0];
              if (rowCells) {
                const liveDate = rowCells[0]?.trim();
                const liveNote = rowCells[1]?.trim();
                if (!verifiedReleaseDate && liveDate) {
                  verifiedReleaseDate = liveDate;
                  console.log(`[Google Sheets Deep Verification] Preserved live sheet releaseDate for "${updatedShow.title}": "${liveDate}"`);
                }
                if (!verifiedReleaseNote && liveNote) {
                  verifiedReleaseNote = liveNote;
                  console.log(`[Google Sheets Deep Verification] Preserved live sheet releaseNote for "${updatedShow.title}": "${liveNote}"`);
                }
              }
            }
          } catch (checkErr) {
            console.warn('[Google Sheets Deep Verification] Querying live sheet release fields error:', checkErr);
          }
        }

        // Apply verified values to updatedShow
        updatedShow.releaseDate = verifiedReleaseDate || undefined;
        updatedShow.releaseNote = verifiedReleaseNote || undefined;
      }

      // 2. If row not found in sheet, automatically append it so the Google Sheet is updated!
      if (!rowNum) {
        showToast(`Adding "${updatedShow.title}" to ${targetTab}...`);
        const appendRes = await appendSheetRow(spreadsheetId, targetTab, updatedShow, currentHeaders, token);
        rowNum = appendRes.rowNumber;
        if (rowNum) {
          updatedShow.rowNumber = rowNum;
          setShows((prev) =>
            prev.map((s) =>
              s.id === updatedShow.id
                ? { ...s, rowNumber: rowNum, sheetTabName: targetTab, releaseDate: updatedShow.releaseDate, releaseNote: updatedShow.releaseNote }
                : s
            )
          );
        }
        showToast(`✅ Synced "${updatedShow.title}" to "${targetTab}"!`);
        return;
      }

      console.log(`[Google Sheets Sync] Updating existing row ${rowNum} for "${updatedShow.title}" in tab "${targetTab}"`);

      // 3. Row exists: sync entire row values in a single API call to minimize Google Sheets write quota consumption
      await updateSheetRow(
        spreadsheetId,
        targetTab,
        rowNum,
        updatedShow,
        currentHeaders,
        token
      );

      // Keep rowNumber and release info updated in state
      setShows((prev) =>
        prev.map((s) =>
          s.id === updatedShow.id
            ? { ...s, rowNumber: rowNum, sheetTabName: targetTab, releaseDate: updatedShow.releaseDate, releaseNote: updatedShow.releaseNote }
            : s
        )
      );

      showToast(`✅ Google Sheet Updated: "${updatedShow.title}" (${targetTab})`);
    } catch (err: any) {
      console.error('Failed to sync show to Google Sheets:', err);
      const msg = err?.message || String(err);
      if (
        msg.includes('invalid authentication credentials') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('invalid_grant') ||
        msg.includes('Expected OAuth 2 access token')
      ) {
        setCachedAccessToken(null);
        try {
          showToast('🔑 Session expired, re-authenticating Google...');
          const authRes = await handleSignIn();
          const newToken = authRes?.accessToken;
          if (newToken && rowNum) {
            await updateSheetRow(
              spreadsheetId,
              targetTab,
              rowNum,
              updatedShow,
              currentHeaders,
              newToken
            );
            showToast(`✅ Google Sheet Updated: "${updatedShow.title}" (${targetTab})`);
            return;
          }
        } catch (retryErr) {
          console.warn('Auto re-auth retry failed:', retryErr);
        }
        setShowSyncModal(true);
        showToast('⚠️ Google Sheets session expired. Please click Connect to re-authenticate.');
      } else {
        showToast(`⚠️ Sheet sync: ${msg}`);
      }
    }
  };

  // Release date check - preserve all user premiere dates and notes permanently
  const checkAndResetExpiredReleases = useCallback(async (_currentShows: ShowItem[]) => {
    // No-op: Never auto-delete or clear release dates entered by the user
  }, []);

  // Periodic 24-Hour Release Notification Check
  useEffect(() => {
    if (!shows || shows.length === 0) return;

    // Run checks immediately on mount or when shows are loaded/changed
    checkAndTrigger24hNotifications(shows);

    // Re-check periodically every 5 minutes in case the tab stays open
    const interval = setInterval(() => {
      const current = showsRef.current;
      if (current && current.length > 0) {
        checkAndTrigger24hNotifications(current);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [shows]);

  // Quick increment episode with season advancement & auto-click Google Sheets sync
  const handleIncrementEpisode = useCallback(async (show: ShowItem) => {
    const currentEpNum = parseInt(show.episodes.replace(/[^0-9]/g, '')) || 1;
    const maxEpNum = parseInt(show.maxEp.replace(/[^0-9]/g, '')) || 8;
    const currentSsnNum = parseInt(show.seasons.replace(/[^0-9]/g, '')) || 1;

    let nextEpNum = currentEpNum + 1;
    let nextSsnNum = currentSsnNum;
    let nextStatus: WatchStatus = '⏳ Watching';

    // If already at or past max episode, advance to next season at Episode 1
    if (currentEpNum >= maxEpNum) {
      nextSsnNum = currentSsnNum + 1;
      nextEpNum = 1;
      nextStatus = '⏳ Watching';
    } else if (nextEpNum === maxEpNum) {
      nextStatus = '✅ Watched';
    } else {
      nextStatus = '⏳ Watching';
    }

    const nextEpStr = `E${nextEpNum}`;
    const nextSsnStr = `S${nextSsnNum}`;

    const updatedShow: ShowItem = {
      ...show,
      seasons: nextSsnStr,
      episodes: nextEpStr,
      status: nextStatus,
      nextEp: nextEpNum < maxEpNum,
    };

    // Immediate optimistic local update
    setShows((prev) => prev.map((s) => (s.id === show.id ? updatedShow : s)));
    setSelectedShow((prev) => (prev?.id === show.id ? updatedShow : prev));

    showToast(`Advanced "${show.title}" to ${nextSsnStr} ${nextEpStr}`);

    // Seamless auto-sync to Google Sheet without blocking popup modal ("auto click")
    if (spreadsheetId) {
      syncShowToSheet(updatedShow);
    } else {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to auto-sync episode progress!');
    }
  }, [spreadsheetId, syncShowToSheet, showToast]);

  // Quick increment season
  const handleIncrementSeason = useCallback(async (show: ShowItem) => {
    const currentSsnNum = parseInt(show.seasons.replace(/[^0-9]/g, '')) || 1;
    const nextSsnNum = currentSsnNum + 1;
    const nextSsnStr = `S${nextSsnNum}`;
    const nextEpStr = 'E1';

    const updatedShow: ShowItem = {
      ...show,
      seasons: nextSsnStr,
      episodes: nextEpStr,
      status: '⏳ Watching',
      nextEp: true,
    };

    setShows((prev) => prev.map((s) => (s.id === show.id ? updatedShow : s)));
    setSelectedShow((prev) => (prev?.id === show.id ? updatedShow : prev));

    showToast(`Advanced "${show.title}" to ${nextSsnStr} ${nextEpStr}`);

    if (spreadsheetId) {
      syncShowToSheet(updatedShow);
    } else {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to auto-sync season progress!');
    }
  }, [spreadsheetId, syncShowToSheet, showToast]);

  // Toggle watch status with auto-sync
  const handleToggleStatus = useCallback(async (show: ShowItem) => {
    const nextStatus: WatchStatus = show.status === '✅ Watched' ? '⏳ Watching' : '✅ Watched';
    const updatedShow: ShowItem = { ...show, status: nextStatus };

    setShows((prev) => prev.map((s) => (s.id === show.id ? updatedShow : s)));
    setSelectedShow((prev) => (prev?.id === show.id ? updatedShow : prev));

    showToast(`Set "${show.title}" to ${nextStatus}`);

    if (spreadsheetId) {
      syncShowToSheet(updatedShow);
    } else {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to auto-sync status!');
    }
  }, [spreadsheetId, syncShowToSheet, showToast]);

  // Quick update rating with auto-sync
  const handleUpdateRating = async (show: ShowItem, ratingNum: number) => {
    const getRatingText = (num: number): string => {
      if (num === 1) return '⭐ = Poor';
      if (num === 2) return '⭐⭐ = Fair';
      if (num === 3) return '⭐⭐⭐ = Good';
      if (num === 4) return '⭐⭐⭐⭐ = Great';
      if (num === 5) return '⭐⭐⭐⭐⭐ = Excellent';
      return 'Unrated';
    };

    const updatedShow: ShowItem = {
      ...show,
      ratingNum,
      rating: getRatingText(ratingNum),
    };

    setShows((prev) => prev.map((s) => (s.id === show.id ? updatedShow : s)));
    if (selectedShow?.id === show.id) {
      setSelectedShow(updatedShow);
    }

    showToast(`Rated "${show.title}" ${ratingNum} Stars`);

    if (spreadsheetId) {
      syncShowToSheet(updatedShow);
    } else {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to auto-sync ratings!');
    }
  };

  // Save changes from Detail modal or Theater Column
  const handleSaveShow = (updatedShow: ShowItem) => {
    setShows((prev) => prev.map((s) => (s.id === updatedShow.id ? updatedShow : s)));
    setSelectedShow(null);
    showToast(`Saved changes for "${updatedShow.title}"`);

    if (spreadsheetId) {
      syncShowToSheet(updatedShow, true);
    }
  };

  // Delete show
  const handleDeleteShow = (showToDelete: ShowItem) => {
    const targetTab = showToDelete.sheetTabName || (showToDelete.isWishlist ? wishlistSheetName : sheetName);
    if (spreadsheetId) {
      setConfirmState({
        isOpen: true,
        title: 'Delete from Google Sheet & Tracker?',
        message: `Permanently delete "${showToDelete.title}" from your Google Sheet? This will remove the row from "${targetTab}".`,
        confirmLabel: 'Delete from Google Sheet',
        isDestructive: true,
        onConfirm: async () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          let targetRow = showToDelete.rowNumber;
          try {
            let token = await getAccessToken();
            if (!token) {
              const authRes = await handleSignIn();
              token = authRes?.accessToken || null;
            }
            if (token) {
              // If row number is missing or needs verification, find it by title in the sheet
              if (!targetRow) {
                const foundRow = await findRowNumberByTitle(
                  spreadsheetId,
                  targetTab,
                  showToDelete.title,
                  token
                );
                if (foundRow) targetRow = foundRow;
              }

              if (targetRow) {
                await deleteSheetRow(
                  spreadsheetId,
                  targetTab,
                  targetRow,
                  targetTab === sheetName ? sheetTabId : undefined,
                  token
                );
                showToast(`Deleted "${showToDelete.title}" from "${targetTab}"`);
              } else {
                showToast(`Removed "${showToDelete.title}" from Tracker`);
              }
            }
          } catch (err: any) {
            console.error('Sheet delete error:', err);
            const msg = err?.message || String(err);
            if (msg.includes('invalid authentication credentials') || msg.includes('401') || msg.includes('invalid_grant') || msg.includes('Expected OAuth 2 access token')) {
              setCachedAccessToken(null);
              showToast('⚠️ Google Sheets session expired. Please open Google Sheets Settings and reconnect.');
            } else {
              showToast(`Removed locally. Sheet error: ${msg}`);
            }
          }

          // Update local state: remove show and decrement rowNumber of shows below it on same tab
          setShows((prev) =>
            prev
              .filter((s) => s.id !== showToDelete.id)
              .map((s) => {
                if (
                  targetRow &&
                  s.rowNumber &&
                  s.rowNumber > targetRow &&
                  (s.sheetTabName || (s.isWishlist ? wishlistSheetName : sheetName)) === targetTab
                ) {
                  return { ...s, rowNumber: s.rowNumber - 1 };
                }
                return s;
              })
          );
          if (selectedShow?.id === showToDelete.id) {
            setSelectedShow(null);
          }
        },
      });
    } else {
      setConfirmState({
        isOpen: true,
        title: 'Delete from Tracker?',
        message: `Are you sure you want to remove "${showToDelete.title}" from your watch list?`,
        confirmLabel: 'Delete Title',
        isDestructive: true,
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          setShows((prev) => prev.filter((s) => s.id !== showToDelete.id));
          if (selectedShow?.id === showToDelete.id) {
            setSelectedShow(null);
          }
          showToast(`Removed "${showToDelete.title}"`);
        },
      });
    }
  };

  // Add new show with instant optimistic UI update
  const handleAddShow = (newShow: ShowItem) => {
    // Strict Duplicate title prevention: auto-decline duplicates
    const cleanCand = newShow.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const existingDupe = cleanCand.length >= 2 ? shows.find((s) => {
      if (newShow.imdbId && s.imdbId && newShow.imdbId === s.imdbId) return true;
      if (!s.title) return false;
      const cleanExisting = s.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanExisting.length >= 2 && cleanCand === cleanExisting;
    }) : undefined;

    if (existingDupe) {
      showToast(
        `🚫 Blocked Duplicate: "${newShow.title}" is already in your ${
          existingDupe.isWishlist ? 'Wishlist' : 'Master Tracker'
        } (${existingDupe.status})!`
      );
      return;
    }

    const isWishlist = Boolean(newShow.isWishlist);
    const isMovie = newShow.type === 'Movie';
    const targetTab = newShow.sheetTabName || (isWishlist ? wishlistSheetName : sheetName);
    const sanitizedShow: ShowItem = {
      ...newShow,
      isWishlist,
      sheetTabName: targetTab,
      dateAdded: newShow.dateAdded || getTodayDDMMYYYY(),
      seasons: isMovie || isWishlist ? '' : normalizeSeasonStr(newShow.seasons),
      episodes: isMovie || isWishlist ? '' : normalizeEpisodeStr(newShow.episodes),
      maxEp: isMovie || isWishlist ? '' : (newShow.maxEp ? normalizeEpisodeStr(newShow.maxEp) : ''),
      nextEp: isMovie || isWishlist ? false : Boolean(newShow.nextEp),
      nextSsn: isMovie || isWishlist ? false : Boolean(newShow.nextSsn),
    };

    // 1. Instant optimistic UI update: Show appears on the dashboard immediately with 0ms delay!
    if (sanitizedShow.releaseDate || sanitizedShow.releaseNote) {
      enableShowNotificationSilent(sanitizedShow.id);
    }
    setShows((prev) => [sanitizedShow, ...prev]);
    showToast(`✨ Added "${sanitizedShow.title}" to ${isWishlist ? 'Wishlist' : 'Master Tracker'}`);

    // 2. Asynchronous background sync to Google Sheets
    if (spreadsheetId) {
      (async () => {
        let addedShow = { ...sanitizedShow };
        try {
          let token = await getAccessToken();
          if (!token) {
            const authRes = await handleSignIn();
            token = authRes?.accessToken || null;
          }
          if (token) {
            let currentHeaders = isWishlist ? DEFAULT_WISHLIST_HEADERS : sheetHeaders;
            if (isWishlist) {
              const tabRes = await ensureSheetTabExists(
                spreadsheetId,
                targetTab,
                DEFAULT_WISHLIST_HEADERS,
                token
              );
              if (tabRes.actualTitle && tabRes.actualTitle !== targetTab) {
                addedShow.sheetTabName = tabRes.actualTitle;
              }
            }

            const liveHeaders = await getSheetTabHeaders(
              spreadsheetId,
              addedShow.sheetTabName || targetTab,
              token
            );
            if (liveHeaders && liveHeaders.length > 0) {
              currentHeaders = liveHeaders;
            }

            if (!isWishlist && addedShow.posterUrl && !currentHeaders.some((h, i) => h.toLowerCase().includes('poster') || h.toLowerCase().includes('image') || i === 15)) {
              try {
                const colRes = await ensurePosterColumnInSheet(spreadsheetId, targetTab, currentHeaders, token);
                if (colRes.wasAdded) {
                  currentHeaders = colRes.headers;
                  setSheetHeaders(currentHeaders);
                  try {
                    localStorage.setItem('bingebox_sheet_headers', JSON.stringify(currentHeaders));
                  } catch {}
                }
              } catch (e) {
                console.warn('Could not auto-add poster column:', e);
              }
            }

            const res = await appendSheetRow(
              spreadsheetId,
              addedShow.sheetTabName || targetTab,
              addedShow,
              currentHeaders,
              token
            );
            if (res?.rowNumber) {
              addedShow.rowNumber = res.rowNumber;
              // Silently update rowNumber in state for future edits/deletes
              setShows((prev) =>
                prev.map((s) => (s.id === sanitizedShow.id ? { ...s, rowNumber: res.rowNumber, sheetTabName: addedShow.sheetTabName } : s))
              );
            }
          } else {
            queueOfflineAction('ADD_SHOW', sanitizedShow);
          }
        } catch (err: any) {
          console.error('Sheet append background error:', err);
          const msg = err?.message || String(err);
          if (msg.includes('invalid authentication credentials') || msg.includes('401') || msg.includes('invalid_grant') || msg.includes('Expected OAuth 2 access token')) {
            setCachedAccessToken(null);
            showToast('⚠️ Google Sheets session expired. Please open Google Sheets Settings to reconnect.');
          }
        }
      })();
    }
  };

  // Move show from Master Tracker to Wishlist
  const handleMoveToWishlist = async (showToMove: ShowItem) => {
    if (!spreadsheetId) {
      setShows((prev) =>
        prev.map((s) => (s.id === showToMove.id ? { ...s, isWishlist: true, sheetTabName: wishlistSheetName } : s))
      );
      showToast(`Moved "${showToMove.title}" to Wishlist`);
      return;
    }

    try {
      let token = await getAccessToken();
      if (!token) {
        showToast('🔑 Authenticating Google session...');
        const authRes = await handleSignIn();
        token = authRes?.accessToken || null;
      }

      if (!token) {
        setShowSyncModal(true);
        showToast('⚠️ Google sign-in required. Please click Connect to sign in.');
        return;
      }

      setIsSyncing(true);
      const res = await moveShowBetweenTabs(
        spreadsheetId,
        sheetName,
        wishlistSheetName,
        showToMove,
        sheetHeaders,
        token
      );

      const targetTab = res.targetSheetName || wishlistSheetName;
      if (res.targetSheetName && res.targetSheetName !== wishlistSheetName) {
        setWishlistSheetName(res.targetSheetName);
        localStorage.setItem('bingebox_wishlist_sheet_name', res.targetSheetName);
      }

      setShows((prev) =>
        prev.map((s) =>
          s.id === showToMove.id
            ? {
                ...s,
                ...showToMove,
                isWishlist: true,
                sheetTabName: targetTab,
                rowNumber: res.newRowNumber,
                priority: normalizePriority(showToMove.priority),
                dateAdded: parseGoogleSheetsDate(showToMove.dateAdded || new Date()),
              }
            : s
        )
      );
      showToast(`🎁 Moved "${showToMove.title}" to "${targetTab}"`);
    } catch (err: any) {
      console.error('Failed to move show to wishlist:', err);
      const msg = err?.message || String(err);
      if (
        msg.includes('invalid authentication credentials') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('invalid_grant') ||
        msg.includes('Expected OAuth 2 access token')
      ) {
        setCachedAccessToken(null);
        setShowSyncModal(true);
        showToast('⚠️ Google Sheets session expired. Please click Connect to re-authenticate.');
      } else {
        showToast(`⚠️ Could not move to wishlist: ${msg}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Move show from Wishlist to Master Tracker
  const handleMoveToMaster = async (showToMove: ShowItem) => {
    if (!spreadsheetId) {
      setShows((prev) =>
        prev.map((s) =>
          s.id === showToMove.id
            ? {
                ...s,
                ...showToMove,
                isWishlist: false,
                sheetTabName: sheetName,
                seasons: normalizeSeasonStr(showToMove.seasons || 'S1'),
                episodes: normalizeEpisodeStr(showToMove.episodes || 'E1'),
                maxEp: normalizeEpisodeStr(showToMove.maxEp || 'E8'),
                status: showToMove.status || '⏳ Watching',
              }
            : s
        )
      );
      showToast(`Moved "${showToMove.title}" to Master Tracker`);
      return;
    }

    try {
      let token = await getAccessToken();
      if (!token) {
        showToast('🔑 Authenticating Google session...');
        const authRes = await handleSignIn();
        token = authRes?.accessToken || null;
      }

      if (!token) {
        setShowSyncModal(true);
        showToast('⚠️ Google sign-in required. Please click Connect to sign in.');
        return;
      }

      setIsSyncing(true);
      const res = await moveShowBetweenTabs(
        spreadsheetId,
        wishlistSheetName,
        sheetName,
        showToMove,
        sheetHeaders,
        token
      );

      const targetTab = res.targetSheetName || sheetName;
      if (res.targetSheetName && res.targetSheetName !== sheetName) {
        setSheetName(res.targetSheetName);
        localStorage.setItem('bingebox_sheet_name', res.targetSheetName);
      }

      setShows((prev) =>
        prev.map((s) =>
          s.id === showToMove.id
            ? {
                ...s,
                ...showToMove,
                isWishlist: false,
                sheetTabName: targetTab,
                rowNumber: res.newRowNumber,
                seasons: normalizeSeasonStr(showToMove.seasons || 'S1'),
                episodes: normalizeEpisodeStr(showToMove.episodes || 'E1'),
                maxEp: normalizeEpisodeStr(showToMove.maxEp || 'E8'),
                status: showToMove.status || '⏳ Watching',
              }
            : s
        )
      );
      showToast(`📊 Moved "${showToMove.title}" to "${targetTab}"`);
    } catch (err: any) {
      console.error('Failed to move show to master:', err);
      const msg = err?.message || String(err);
      if (
        msg.includes('invalid authentication credentials') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('invalid_grant') ||
        msg.includes('Expected OAuth 2 access token')
      ) {
        setCachedAccessToken(null);
        setShowSyncModal(true);
        showToast('⚠️ Google Sheets session expired. Please click Connect to re-authenticate.');
      } else {
        showToast(`⚠️ Could not move to master tracker: ${msg}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Base list filtered by Search, Category, and Year (used for platform breakdown and final filtered list)
  const baseFilteredList = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    // Helper to normalize strings (remove accents, punctuation, lower-case)
    const cleanStr = (s?: string | number | null) => {
      if (s === null || s === undefined) return '';
      return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['’".,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
    };

    let list = profileFilteredShows;

    // 1. Search Query filter (if any)
    if (trimmedQuery) {
      const queryClean = cleanStr(trimmedQuery);
      const queryTokens = queryClean.split(/\s+/).filter(Boolean);

      const strictMatches = list.filter((show) => {
        const corpus = cleanStr(`${show.title} ${show.genre} ${show.platform}`);
        return queryTokens.every((token) => corpus.includes(token));
      });

      if (strictMatches.length > 0) {
        list = strictMatches;
      } else {
        const looseMatches = list.filter((show) => {
          const corpus = cleanStr(`${show.title} ${show.genre} ${show.platform}`);
          return queryTokens.some((token) => corpus.includes(token));
        });
        if (looseMatches.length > 0) {
          list = looseMatches;
        }
      }
    }

    // 2. Category / Status filter
    if (activeFilter !== 'all') {
      list = list.filter((show) => {
        if (activeFilter === 'All Titles') return true;
        if (activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist') return Boolean(show.isWishlist);
        if (activeFilter === 'Series') return show.type === 'Series';
        if (activeFilter === 'Movie') return show.type === 'Movie';
        if (activeFilter === '⏳ Watching') return show.status === '⏳ Watching';
        if (activeFilter === '✅ Watched') return show.status === '✅ Watched';
        if (activeFilter === '⭐ Top Rated' || activeFilter === 'Top Rated') {
          const stars = show.ratingNum || (show.rating ? (show.rating.match(/⭐/g) || []).length : 0);
          return stars >= 4 || (show.rating && (show.rating.toLowerCase().includes('excellent') || show.rating.toLowerCase().includes('great')));
        }
        if (activeFilter === '⏰ Coming Soon' || activeFilter === 'Coming Soon') {
          return Boolean(show.releaseDate || show.releaseNote || show.nextAirDate || show.nextAirTimestamp);
        }
        if (activeFilter === '⏸️ Paused') return show.status === '⏸️ Paused';
        if (activeFilter === '❌ Dropped') return show.status === '❌ Dropped';
        if (activeFilter === '⏸️ Paused / ❌ Dropped') return show.status === '⏸️ Paused' || show.status === '❌ Dropped';
        return true;
      });
    }

    // 3. Year filter
    if (selectedYear !== 'all') {
      list = list.filter((show) => {
        if (show.year === undefined || show.year === null) return false;
        return String(show.year).trim() === String(selectedYear).trim();
      });
    }

    return list;
  }, [profileFilteredShows, searchQuery, activeFilter, selectedYear]);

  // Filter shows - broad search across all metadata combined with category, platform, and year
  const filteredShows = useMemo(() => {
    let list = baseFilteredList;

    // 4. Platform filter
    if (selectedPlatform !== 'all') {
      list = list.filter((show) => {
        if (!show.platform) return false;
        const normShow = normalizePlatform(show.platform);
        const normSelected = normalizePlatform(selectedPlatform);
        return (
          normShow === normSelected ||
          show.platform.trim() === selectedPlatform.trim() ||
          show.platform.toLowerCase().includes(selectedPlatform.toLowerCase().replace(/^[^\w\s]+/, '').trim())
        );
      });
    }

    // 5. Sorting
    return [...list].sort((a, b) => {
      if (sortOrder === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'title-desc') {
        return b.title.localeCompare(a.title);
      }
      if (sortOrder === 'year-newest') {
        return (Number(b.year) || 0) - (Number(a.year) || 0);
      }
      if (sortOrder === 'year-oldest') {
        return (Number(a.year) || 0) - (Number(b.year) || 0);
      }
      if (sortOrder === 'rating') {
        return (b.ratingNum || 0) - (a.ratingNum || 0);
      }
      if (sortOrder === 'progress' || sortOrder === 'progress-desc') {
        return calculateShowProgress(b) - calculateShowProgress(a);
      }
      if (sortOrder === 'progress-asc') {
        return calculateShowProgress(a) - calculateShowProgress(b);
      }
      return 0;
    });
  }, [baseFilteredList, selectedPlatform, sortOrder]);

  // Pagination State for Filtered Results
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  // Reset page to 1 and itemsPerPage back to default 50 when returning Home or changing active filter
  useEffect(() => {
    setCurrentPage(1);
    setItemsPerPage(50);
  }, [searchQuery, activeFilter, selectedPlatform, selectedYear, sortOrder]);

  const scrollToFilteredSection = useCallback(() => {
    if (filteredSectionRef.current) {
      filteredSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    setTimeout(() => {
      scrollToFilteredSection();
    }, 50);
  }, [scrollToFilteredSection]);

  const totalPages = Math.ceil(filteredShows.length / itemsPerPage) || 1;
  const paginatedShows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredShows.slice(start, start + itemsPerPage);
  }, [filteredShows, currentPage, itemsPerPage]);

  // Unique sorted list of years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    shows.forEach((s) => {
      if (s.year !== undefined && s.year !== null) {
        const yr = String(s.year).trim();
        if (yr) yearsSet.add(yr);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [shows]);

  // Strictly user preset platforms
  const availablePlatforms = useMemo(() => {
    return PRESET_PLATFORMS.map((preset) => {
      const clean = preset.replace(/^[^\w\s]+/, '').trim() || preset;
      const count = baseFilteredList.filter((s) => {
        if (!s.platform) return false;
        const norm = normalizePlatform(s.platform);
        return norm === preset || s.platform.trim() === preset;
      }).length;
      return { raw: preset, name: clean, count };
    });
  }, [baseFilteredList]);

  const availableViewers = useMemo(() => {
    // If the Google Sheet Lists tab (D3:D900) has provided custom viewers, strictly use only those
    if (customViewers && customViewers.length > 0) {
      const set = new Set<string>();
      customViewers.forEach((v) => {
        if (v && v.trim()) set.add(v.trim());
      });
      return Array.from(set);
    }
    const set = new Set<string>();
    shows.forEach((s) => {
      if (s.who && s.who.trim()) set.add(s.who.trim());
    });
    return Array.from(set);
  }, [shows, customViewers]);

  const availableGenres = useMemo(() => {
    const defaultGenres = [
      'Action',
      'Adventure',
      'Comedy',
      'Drama',
      'Family',
      'Fantasy',
      'Horror',
      'Mystery',
      'Romance',
      'Sci-Fi',
      'Thriller',
      'Animation',
      'Documentary',
      'War',
    ];
    const set = new Set<string>(defaultGenres);
    shows.forEach((s) => {
      if (s.genre) set.add(s.genre.trim());
    });
    return Array.from(set);
  }, [shows]);

  const isAnyFilterActive = Boolean(
    searchQuery.trim() ||
      activeFilter !== 'all' ||
      selectedPlatform !== 'all' ||
      selectedYear !== 'all'
  );

  // Featured billboard show
  const featuredShow = useMemo(() => {
    const list = profileFilteredShows.length > 0 ? profileFilteredShows : shows;
    if (list.length === 0) return null;
    const watchingList = list.filter((s) => s.status === '⏳ Watching');
    const candidates = watchingList.length > 0 ? watchingList : list;
    return candidates[featuredIndex % candidates.length] || list[0];
  }, [profileFilteredShows, shows, featuredIndex]);

  // Auto-slideshow for Hero Billboard
  useEffect(() => {
    if (isAnyFilterActive) return; // Don't slideshow while user is searching/filtering

    const timer = setInterval(() => {
      setFeaturedIndex((prev) => prev + 1);
    }, 12000); // 12 seconds per slide

    return () => clearInterval(timer);
  }, [isAnyFilterActive, profileFilteredShows.length]);

  // Show category collections
  const recentlyAddedShows = useMemo(() => {
    if (!profileFilteredShows || profileFilteredShows.length === 0) return [];

    const copy = [...profileFilteredShows];
    copy.sort((a, b) => {
      const dateA = a.dateAdded ? parseAnyDate(a.dateAdded)?.getTime() : null;
      const dateB = b.dateAdded ? parseAnyDate(b.dateAdded)?.getTime() : null;

      if (dateA && dateB && dateA !== dateB) {
        return dateB - dateA;
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;

      if (a.rowNumber && b.rowNumber && a.rowNumber !== b.rowNumber) {
        return b.rowNumber - a.rowNumber;
      }

      return 0;
    });

    return copy.slice(0, 20);
  }, [profileFilteredShows]);

  const continueWatching = useMemo(
    () => profileFilteredShows
      .filter((s) => s.status === '⏳ Watching')
      .sort((a, b) => calculateShowProgress(b) - calculateShowProgress(a)),
    [profileFilteredShows]
  );
  const topRated = useMemo(
    () => profileFilteredShows
      .filter((s) => s.ratingNum >= 4 || s.rating.includes('5'))
      .sort((a, b) => (b.ratingNum || 0) - (a.ratingNum || 0)),
    [profileFilteredShows]
  );
  const netflixShows = useMemo(
    () => profileFilteredShows.filter((s) => s.platform.toLowerCase().includes('netflix')),
    [profileFilteredShows]
  );
  const primeShows = useMemo(
    () => profileFilteredShows.filter((s) => s.platform.toLowerCase().includes('prime')),
    [profileFilteredShows]
  );
  const disneyShows = useMemo(
    () => profileFilteredShows.filter((s) => s.platform.toLowerCase().includes('disney')),
    [profileFilteredShows]
  );
  const appleShows = useMemo(
    () => profileFilteredShows.filter((s) => s.platform.toLowerCase().includes('apple')),
    [profileFilteredShows]
  );
  const paramountShows = useMemo(
    () => profileFilteredShows.filter((s) => s.platform.toLowerCase().includes('paramount')),
    [profileFilteredShows]
  );
  const maxShows = useMemo(
    () => profileFilteredShows.filter((s) => s.platform.toLowerCase().includes('max') || s.platform.toLowerCase().includes('hbo')),
    [profileFilteredShows]
  );
  const skyShows = useMemo(
    () => profileFilteredShows.filter((s) => s.platform.toLowerCase().includes('sky') || s.platform.toLowerCase().includes('now')),
    [profileFilteredShows]
  );
  const watchedShows = useMemo(
    () => profileFilteredShows.filter((s) => s.status === '✅ Watched'),
    [profileFilteredShows]
  );
  const pausedShows = useMemo(
    () => profileFilteredShows.filter((s) => s.status === '⏸️ Paused' || s.status === '❌ Dropped'),
    [profileFilteredShows]
  );
  const wishlistShows = useMemo(
    () => profileFilteredShows.filter((s) => s.isWishlist),
    [profileFilteredShows]
  );
  const comingSoonShows = useMemo(() => {
    const list = profileFilteredShows.filter((s) => Boolean(s.releaseDate || s.releaseNote || s.nextAirDate || s.nextAirTimestamp));
    return [...list].sort((a, b) => {
      const tsA = a.releaseDate ? parseReleaseDateToTimestamp(a.releaseDate) : a.nextAirTimestamp || null;
      const tsB = b.releaseDate ? parseReleaseDateToTimestamp(b.releaseDate) : b.nextAirTimestamp || null;

      // Earliest / closest upcoming premiere dates first, later future dates last
      if (tsA !== null && tsB !== null) {
        return tsA - tsB;
      }
      if (tsA !== null) return -1;
      if (tsB !== null) return 1;

      return (a.releaseNote || a.title).localeCompare(b.releaseNote || b.title);
    });
  }, [profileFilteredShows]);

  const renderMasterTrackerOverviewBar = (position: 'top' | 'bottom' = 'top') => (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${position === 'top' ? 'pt-2 sm:pt-3 pb-2' : 'pt-6 pb-4'}`}>
      <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-lg shadow-red-950/20">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-tight">
                {position === 'bottom' ? 'Master Tracker Overview Summary' : 'Master Tracker Overview'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {position === 'bottom'
                  ? 'Quick access stats & category filters at the bottom of your library'
                  : 'Summary of all tracked shows and movies in your library'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeFilter === 'All Titles') {
                  setActiveFilter('all');
                } else {
                  setActiveFilter('All Titles');
                  setSelectedPlatform('all');
                  setSelectedYear('all');
                }
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-mono font-semibold transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] flex items-center gap-1.5 border-solid focus:outline-none ${
                activeFilter === 'All Titles'
                  ? 'bg-red-950/80 border-2 border-red-500 text-white shadow-lg shadow-red-950/60 ring-2 ring-red-500/70'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-red-500/80 active:border-2 active:border-red-500 active:ring-2 active:ring-red-500/50 hover:bg-zinc-800 hover:text-white hover:shadow-lg hover:shadow-red-950/30 hover:-translate-y-0.5'
              }`}
              title="Click to show all titles in filter view (click again to restore shelves)"
            >
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${activeFilter === 'All Titles' ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'}`} />
              <span>{profileFilteredShows.length} Total Titles</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setActiveFilter((prev) => (prev === 'Movie' ? 'all' : 'Movie'))}
            className={`text-left rounded-xl p-3 flex items-center gap-3 transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] border-solid focus:outline-none ${
              activeFilter === 'Movie'
                ? 'bg-red-950/80 border-2 border-red-500 shadow-xl shadow-red-950/60 ring-2 ring-red-500/70'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-red-500/80 active:border-2 active:border-red-500 active:ring-2 active:ring-red-500/50 hover:bg-zinc-900 hover:shadow-lg hover:shadow-red-950/30 hover:-translate-y-0.5'
            }`}
            title="Filter by Movies (click again to clear)"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-transform duration-200 group-hover:scale-110 ${
              activeFilter === 'Movie' ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-400'
            }`}>
              🎬
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Movies</span>
              <span className="text-base font-extrabold text-white">{profileFilteredShows.filter((s) => s.type === 'Movie').length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter((prev) => (prev === 'Series' ? 'all' : 'Series'))}
            className={`text-left rounded-xl p-3 flex items-center gap-3 transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] border-solid focus:outline-none ${
              activeFilter === 'Series'
                ? 'bg-red-950/80 border-2 border-red-500 shadow-xl shadow-red-950/60 ring-2 ring-red-500/70'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-red-500/80 active:border-2 active:border-red-500 active:ring-2 active:ring-red-500/50 hover:bg-zinc-900 hover:shadow-lg hover:shadow-red-950/30 hover:-translate-y-0.5'
            }`}
            title="Filter by Series (click again to clear)"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-transform duration-200 group-hover:scale-110 ${
              activeFilter === 'Series' ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-400'
            }`}>
              📺
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Series</span>
              <span className="text-base font-extrabold text-white">{profileFilteredShows.filter((s) => s.type === 'Series').length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter((prev) => (prev === '⏳ Watching' ? 'all' : '⏳ Watching'))}
            className={`text-left rounded-xl p-3 flex items-center gap-3 transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] border-solid focus:outline-none ${
              activeFilter === '⏳ Watching'
                ? 'bg-amber-950/80 border-2 border-amber-500 shadow-xl shadow-amber-950/60 ring-2 ring-amber-500/70'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-500/80 active:border-2 active:border-amber-500 active:ring-2 active:ring-amber-500/50 hover:bg-zinc-900 hover:shadow-lg hover:shadow-amber-950/30 hover:-translate-y-0.5'
            }`}
            title="Filter by Currently Watching (click again to clear)"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-transform duration-200 group-hover:scale-110 ${
              activeFilter === '⏳ Watching' ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-400'
            }`}>
              ⏳
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Watching</span>
              <span className="text-base font-extrabold text-white">{continueWatching.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter((prev) => (prev === '✅ Watched' ? 'all' : '✅ Watched'))}
            className={`text-left rounded-xl p-3 flex items-center gap-3 transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] border-solid focus:outline-none ${
              activeFilter === '✅ Watched'
                ? 'bg-emerald-950/80 border-2 border-emerald-500 shadow-xl shadow-emerald-950/60 ring-2 ring-emerald-500/70'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/80 active:border-2 active:border-emerald-500 active:ring-2 active:ring-emerald-500/50 hover:bg-zinc-900 hover:shadow-lg hover:shadow-emerald-950/30 hover:-translate-y-0.5'
            }`}
            title="Filter by Watched (click again to clear)"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-transform duration-200 group-hover:scale-110 ${
              activeFilter === '✅ Watched' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              ✅
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Watched</span>
              <span className="text-base font-extrabold text-white">{watchedShows.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter((prev) => (prev === '⏰ Coming Soon' ? 'all' : '⏰ Coming Soon'))}
            className={`text-left rounded-xl p-3 flex items-center gap-3 transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] border-solid focus:outline-none ${
              activeFilter === '⏰ Coming Soon'
                ? 'bg-amber-950/80 border-2 border-amber-500 shadow-xl shadow-amber-950/60 ring-2 ring-amber-500/70'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-500/80 active:border-2 active:border-amber-500 active:ring-2 active:ring-amber-500/50 hover:bg-zinc-900 hover:shadow-lg hover:shadow-amber-950/30 hover:-translate-y-0.5'
            }`}
            title="Filter by Coming Soon (click again to clear)"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-transform duration-200 group-hover:scale-110 ${
              activeFilter === '⏰ Coming Soon' ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-400'
            }`}>
              ⏰
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Coming Soon</span>
              <span className="text-base font-extrabold text-white">{comingSoonShows.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter((prev) => (prev === '🎁 Wishlist' || prev === 'Wishlist' ? 'all' : '🎁 Wishlist'))}
            className={`text-left rounded-xl p-3 flex items-center gap-3 transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] border-solid focus:outline-none ${
              activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                ? 'bg-amber-950/80 border-2 border-amber-500 shadow-xl shadow-amber-950/60 ring-2 ring-amber-500/70'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-500/80 active:border-2 active:border-amber-500 active:ring-2 active:ring-amber-500/50 hover:bg-zinc-900 hover:shadow-lg hover:shadow-amber-950/30 hover:-translate-y-0.5'
            }`}
            title="Filter by Wishlist (click again to clear)"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-transform duration-200 group-hover:scale-110 ${
              activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist' ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-400'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Wishlist</span>
              <span className="text-base font-extrabold text-white">{wishlistShows.length}</span>
            </div>
          </button>

          <div
            role="button"
            tabIndex={0}
            id={`tracker-completion-stats-${position}`}
            onClick={() => setShowStatsModal(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowStatsModal(true);
              }
            }}
            className={`text-left rounded-xl p-3 flex items-center justify-between transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.97] border-solid focus:outline-none ${
              showStatsModal
                ? 'bg-red-950/80 border-2 border-red-500 shadow-xl shadow-red-950/60 ring-2 ring-red-500/70'
                : 'bg-zinc-900/60 border border-zinc-800/80 hover:border-red-500/80 active:border-2 active:border-red-500 active:ring-2 active:ring-red-500/50 hover:bg-zinc-900 hover:shadow-lg hover:shadow-red-950/30 hover:-translate-y-0.5'
            }`}
            title="Click to view Analytics & Stats Dashboard"
          >
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Completion</span>
              <span className="text-base font-extrabold text-white">
                {shows.length > 0 ? Math.round((watchedShows.length / shows.length) * 100) : 0}%
              </span>
            </div>
            <div className="w-10 h-10 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Completed', value: watchedShows.length, fill: '#ef4444' },
                      { name: 'Remaining', value: Math.max(0, shows.length - watchedShows.length), fill: '#27272a' },
                    ]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={12}
                    outerRadius={17}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    <Cell key="cell-0" fill="#ef4444" />
                    <Cell key="cell-1" fill="#27272a" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => {
    // State A: No Spreadsheet ID configured yet
    if (!spreadsheetId) {
      const handleSaveSheetUrl = async () => {
        setWelcomeError('');
        if (!welcomeSheetUrl.trim()) {
          setWelcomeError('Please paste your Google Sheet URL first');
          return;
        }
        const extractedId = extractSpreadsheetId(welcomeSheetUrl.trim());
        if (!extractedId) {
          setWelcomeError('Invalid Google Sheet URL. Please copy and paste the entire web address from your browser.');
          return;
        }
        setSpreadsheetId(extractedId);
        try {
          localStorage.setItem('bingebox_spreadsheet_id', extractedId);
        } catch {}

        // If user already authenticated, connect and load immediately with zero delay
        if (user || auth.currentUser) {
          showToast('⚡ Connecting Google Sheet...');
          await handleConnectSheets(extractedId, sheetName, wishlistSheetName);
        } else {
          showToast('✅ Google Sheet added! Please sign in to sync your data.');
        }
      };

      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-500 shadow-xl shadow-amber-950/20 animate-pulse">
            <Table className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome to SHOWFLIX
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              First time use: Set up your tracker with our official layout template.
            </p>
          </div>

          {/* Welcome Screen Instructions */}
          <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-4 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-20 h-20 text-amber-500" />
            </div>
            <div className="relative z-10 space-y-3">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Setup Instructions
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Follow these simple steps to configure your personal show tracker:
              </p>
              
              <div className="space-y-3 text-xs text-zinc-200 bg-zinc-950/60 p-4 rounded-lg border border-zinc-800">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0">1</span>
                  <div className="space-y-1.5 w-full">
                    <strong className="text-amber-400 font-bold">Click to make a copy of the official Sheet template</strong>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">Get your copy of our official Google Sheets template in your Drive.</p>
                    <div className="pt-1">
                      <a
                        href="https://docs.google.com/spreadsheets/d/1XWlhjlmRO3l85Ng_uVVGsAAApNiv469KGTRX0ZtpBBA/copy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black px-4 py-2 rounded shadow transition-all cursor-pointer no-underline uppercase"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        1. Click to make a copy of the official Sheet template
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-2.5 border-t border-zinc-800/80 pt-3">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0">2</span>
                  <div className="space-y-2 w-full">
                    <strong className="text-amber-400 font-bold">Connect your new sheet URL</strong>
                    <p className="text-zinc-400 text-[11px] leading-relaxed font-normal">Copy the spreadsheet URL from your browser address bar and paste it below:</p>
                    
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <input
                        type="text"
                        value={welcomeSheetUrl}
                        onChange={(e) => setWelcomeSheetUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveSheetUrl();
                          }
                        }}
                        placeholder="Paste Google Sheet URL (https://docs.google.com/spreadsheets/d/...)"
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSaveSheetUrl}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 rounded shrink-0 transition-colors cursor-pointer"
                      >
                        Save Sheet URL
                      </button>
                    </div>
                    {welcomeError && (
                      <p className="text-red-400 text-[11px] font-medium">{welcomeError}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5 border-t border-zinc-800/80 pt-3">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0">3</span>
                  <div>
                    <strong className="text-amber-400 font-bold">Add profile names in the "Lists" tab</strong>
                    <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">Open your Google Sheet, click the <span className="font-mono text-zinc-300">Lists</span> tab at the bottom, and enter your profile names in <strong>Column D</strong>. This adds your names as profiles you can select inside the app!</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/40 text-center">
                <span className="text-amber-400 font-bold text-xs md:text-sm inline-flex items-center gap-1.5 animate-pulse">
                  ✨ Set up and enjoy your new show tracker! ( Enjoy )
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // State B: Google Sheet has been added, but they need to authenticate & sync
    // ENHANCEMENT: If we have cached shows, or if currently syncing, we skip this screen to provide an "instant" experience.
    if (!isSyncing && (!user || !sheetTitle) && shows.length === 0) {
      return (
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-500 shadow-xl shadow-amber-950/20 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome to SHOWFLIX
            </h2>
            <p className="text-sm font-semibold max-w-md mx-auto leading-relaxed text-amber-400">
              Connect Google Sheet Sync & Sign In with Google
            </p>
          </div>

          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-5 shadow-2xl">
            <p className="text-xs text-zinc-300 leading-relaxed">
              You added your spreadsheet URL successfully! Now, please sign in with your Google account to authorize secure synchronization.
            </p>

            <div className="p-3 bg-zinc-950 rounded border border-zinc-800 flex items-center justify-between text-xs text-left">
              <div className="truncate pr-3">
                <span className="text-zinc-500 block text-[10px] uppercase">Active Spreadsheet URL</span>
                <span className="font-mono text-zinc-300 truncate block">https://docs.google.com/spreadsheets/d/{spreadsheetId}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSpreadsheetId('');
                  setSheetTitle(undefined);
                  setAvailableTabs([]);
                  setShows([]);
                  setWelcomeSheetUrl('');
                  try {
                    localStorage.removeItem('bingebox_spreadsheet_id');
                    localStorage.removeItem('bingebox_sheet_title');
                    localStorage.removeItem('bingebox_available_sheet_tabs');
                    localStorage.removeItem('bingebox_app_data_cache');
                  } catch {}
                }}
                className="text-red-400 hover:text-red-300 text-[11px] font-bold underline shrink-0 cursor-pointer"
              >
                Change URL
              </button>
            </div>

            <button
              type="button"
              onClick={async () => {
                showToast('🔑 Opening Google sign-in window...');
                await handleConnectSheets(spreadsheetId, sheetName, wishlistSheetName);
              }}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold py-3.5 px-4 rounded-lg shadow-lg hover:shadow-red-950/50 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer uppercase tracking-wider"
            >
              <Table className="w-4 h-4" />
              Connect & Sign In with Google
            </button>

            <div className="pt-3 border-t border-zinc-800 text-center">
              <span className="text-amber-400 font-bold text-xs inline-flex items-center gap-1.5 animate-pulse">
                ✨ Almost ready to enjoy tracking and adding your shows! ( Enjoy )
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (showStatsModal && shows.length > 0) {
      return (
        <div className="w-full animate-in fade-in duration-200">
          <DashboardStats
            shows={shows}
            onClose={() => setShowStatsModal(false)}
            onOpenDetails={handleOpenDetails}
          />
        </div>
      );
    }

    return (
      <div className="w-full">
        {shows.length === 0 ? (
          isSyncing ? (
            <div className="max-w-md mx-auto px-4 py-32 text-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-red-600/10 border-t-red-600 rounded-full animate-spin mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Tv className="w-6 h-6 text-red-600 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Syncing your library...</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Fetching your movie and series collection from Google Sheets.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
              <div className="w-16 h-16 bg-[#E50914]/10 border border-[#E50914]/30 rounded-full flex items-center justify-center mx-auto text-[#E50914] shadow-xl animate-pulse">
                <Plus className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Your Show Tracker is Empty</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  You have successfully connected your Google Sheet! Now you can start adding movies and series to your personal list.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-[#E50914] hover:bg-[#B80710] text-white text-xs font-bold px-5 py-3 rounded-md shadow-lg shadow-red-900/30 transition-all uppercase tracking-wider cursor-pointer hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Add Your First Show
              </button>
            </div>
          )
        ) : (
          <>
            {/* If user is not searching or filtering, show Netflix Hero Billboard */}
            {!isAnyFilterActive && (
              <HeroBillboard
                show={featuredShow}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onSelectNextFeatured={() => setFeaturedIndex((prev) => prev + 1)}
                onSelectPrevFeatured={() => setFeaturedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, shows.length - 1)))}
                itemCount={shows.filter((s) => s.status === '⏳ Watching').length > 0 ? shows.filter((s) => s.status === '⏳ Watching').length : shows.length}
                currentIndex={featuredIndex}
                onSelectIndex={(idx) => setFeaturedIndex(idx)}
              />
            )}
            {!searchQuery && (
              <MainPageReleaseRadarBanner
                shows={shows}
                onOpenDetails={(s) => setSelectedShow(s)}
              />
            )}

        {/* Master Tracker Summary & Quick Filters Bar (Top) */}
        {renderMasterTrackerOverviewBar('top')}

        {/* Filter / Search results view */}
        {isAnyFilterActive && (
          <section ref={filteredSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-red-500" />
                  <h2 className="text-lg font-bold text-white">
                    {searchQuery
                      ? `Search: "${searchQuery}"`
                      : activeFilter !== 'all'
                      ? activeFilter === 'All Titles'
                        ? '🎬 All Titles'
                        : activeFilter === 'Series'
                        ? '📺 TV Series'
                        : activeFilter === 'Movie'
                        ? '🎬 Movies & Films'
                        : activeFilter === '⏳ Watching'
                        ? '⏳ Currently Watching'
                        : activeFilter === '✅ Watched'
                        ? '✅ Completed & Watched'
                        : activeFilter === '⭐ Top Rated' || activeFilter === 'Top Rated'
                        ? '⭐ Top Rated Titles (4–5 Stars)'
                        : activeFilter === '⏰ Coming Soon' || activeFilter === 'Coming Soon'
                        ? '⏰ Upcoming Release Dates & Premieres'
                        : activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                        ? '🎁 Wishlist'
                        : activeFilter
                      : selectedPlatform !== 'all'
                      ? `Platform: ${selectedPlatform}`
                      : selectedYear !== 'all'
                      ? `Year: ${selectedYear}`
                      : 'Filtered Results'}
                  </h2>
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full font-mono font-semibold border border-zinc-700">
                    {filteredShows.length} titles
                  </span>
                </div>

                {/* Active Filter Chips Breakdown */}
                <div className="flex flex-col gap-3 pt-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {searchQuery && (
                      <span className="inline-flex items-center gap-1.5 bg-red-950/80 text-red-300 border border-red-800/60 px-2.5 py-1 rounded-full shadow-sm">
                        <span className="opacity-70">Search:</span>
                        <span className="font-bold">"{searchQuery}"</span>
                        <button onClick={() => setSearchQuery('')} className="hover:text-white ml-0.5 p-0.5 rounded-full hover:bg-red-800/50 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {activeFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1.5 bg-zinc-800 text-zinc-200 border border-zinc-700 px-2.5 py-1 rounded-full shadow-sm">
                        <span className="opacity-70 uppercase text-[9px] font-bold">Category:</span>
                        <span className="font-bold">{activeFilter}</span>
                        <button onClick={() => setActiveFilter('all')} className="hover:text-white ml-0.5 p-0.5 rounded-full hover:bg-zinc-700/50 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {selectedYear !== 'all' && (
                      <span className="inline-flex items-center gap-1.5 bg-amber-950/70 text-amber-200 border border-amber-700/60 px-2.5 py-1 rounded-full shadow-sm">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span className="opacity-70">Year:</span>
                        <span className="font-bold">{selectedYear}</span>
                        <button onClick={() => setSelectedYear('all')} className="hover:text-white ml-0.5 p-0.5 rounded-full hover:bg-amber-800/50 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {(() => {
                      const hasSubFilters = Boolean(searchQuery || selectedPlatform !== 'all' || selectedYear !== 'all');
                      const isCategoryActive = activeFilter !== 'all' && activeFilter !== 'All Titles';
                      const categoryName =
                        activeFilter === 'Series'
                          ? 'Series'
                          : activeFilter === 'Movie'
                          ? 'Movies'
                          : activeFilter === '⏳ Watching'
                          ? 'Watching'
                          : activeFilter === '✅ Watched'
                          ? 'Watched'
                          : activeFilter === '⭐ Top Rated' || activeFilter === 'Top Rated'
                          ? 'Top Rated'
                          : activeFilter === '⏰ Coming Soon' || activeFilter === 'Coming Soon'
                          ? 'Coming Soon'
                          : activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                          ? 'Wishlist'
                          : activeFilter === '⏸️ Paused'
                          ? 'Paused'
                          : activeFilter === '❌ Dropped'
                          ? 'Dropped'
                          : activeFilter;

                      const resetLabel = isCategoryActive
                        ? hasSubFilters
                          ? `Reset to all ${categoryName}`
                          : 'View all titles'
                        : 'Reset to all';

                      return (
                        <button
                          onClick={() => {
                            const hasSub = Boolean(searchQuery || selectedPlatform !== 'all' || selectedYear !== 'all');
                            setSearchQuery('');
                            setSelectedPlatform('all');
                            setSelectedYear('all');
                            setSortOrder('title-asc');
                            if (!hasSub && isCategoryActive) {
                              // Already viewing all of this category, broaden to all titles
                              setActiveFilter('All Titles');
                            } else if (activeFilter === 'all') {
                              setActiveFilter('All Titles');
                            }
                            // Otherwise keeps activeFilter so Series + Netflix resets to Series (all)!
                          }}
                          className="text-xs text-zinc-200 hover:text-white bg-zinc-800/90 hover:bg-zinc-700 hover:border-zinc-500 px-3 py-1 rounded-full border border-zinc-700 transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-[0.97] font-medium"
                          title={
                            isCategoryActive && hasSubFilters
                              ? `Reset platform, year, and search while staying in all ${categoryName}`
                              : 'Reset filters'
                          }
                        >
                          <RotateCcw className="w-3 h-3 text-zinc-400" />
                          <span>{resetLabel}</span>
                        </button>
                      );
                    })()}

                    {/* Sorting Dropdown relocated next to Reset */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-red-500 transition-colors">
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="bg-zinc-800/90 border border-zinc-700 text-zinc-300 text-[11px] font-bold rounded-full pl-7 pr-7 py-1 appearance-none focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all cursor-pointer hover:bg-zinc-700 hover:text-white shadow-sm"
                      >
                        <option value="title-asc">Title (A-Z)</option>
                        <option value="title-desc">Title (Z-A)</option>
                        <option value="year-newest">Year (Newest)</option>
                        <option value="year-oldest">Year (Oldest)</option>
                        <option value="rating">Top Rated</option>
                        <option value="progress-desc">Progress % (High to Low)</option>
                        <option value="progress-asc">Progress % (Low to High)</option>
                      </select>
                      <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-zinc-500">
                        <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Platform Breakdown Row */}
                  <div className="flex flex-col gap-2 border-t border-zinc-800/50 pt-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setSelectedPlatform('all')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          selectedPlatform === 'all'
                            ? 'bg-white text-black border-white shadow-lg'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        📺 All Platforms
                        <span className={`text-[10px] px-1.5 rounded-md ${selectedPlatform === 'all' ? 'bg-black/10' : 'bg-zinc-800'}`}>
                          {baseFilteredList.length}
                        </span>
                      </button>
                      {availablePlatforms.filter(p => p.count > 0 || PRESET_PLATFORMS.includes(p.raw)).map((platform) => (
                        <button
                          key={platform.raw}
                          onClick={() => setSelectedPlatform(platform.raw)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            selectedPlatform === platform.raw
                              ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/20'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-red-500/50 hover:text-zinc-200'
                          }`}
                        >
                          {platform.raw}
                          <span className={`text-[10px] px-1.5 rounded-md ${selectedPlatform === platform.raw ? 'bg-black/20 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                            {platform.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {filteredShows.length === 0 ? (
              <div className="py-16 text-center space-y-4 bg-[#181818] rounded-xl border border-zinc-800 p-6">
                <SlidersHorizontal className="w-10 h-10 text-zinc-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-zinc-200 font-semibold text-base">
                    No shows match your current filters
                  </p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Try adjusting your platform, year, or category selection.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPlatform('all');
                      setSelectedYear('all');
                      setSortOrder('title-asc');
                      if (activeFilter === 'all') {
                        setActiveFilter('All Titles');
                      }
                    }}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-md transition-colors shadow-md cursor-pointer"
                  >
                    {activeFilter !== 'all' && activeFilter !== 'All Titles'
                      ? `Reset to all ${
                          activeFilter === 'Series'
                            ? 'Series'
                            : activeFilter === 'Movie'
                            ? 'Movies'
                            : activeFilter === '⏳ Watching'
                            ? 'Watching'
                            : activeFilter === '✅ Watched'
                            ? 'Watched'
                            : activeFilter === '⭐ Top Rated' || activeFilter === 'Top Rated'
                            ? 'Top Rated'
                            : activeFilter === '⏰ Coming Soon' || activeFilter === 'Coming Soon'
                            ? 'Coming Soon'
                            : activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                            ? 'Wishlist'
                            : activeFilter
                        }`
                      : 'Reset to all'}
                  </button>
                  {activeFilter !== 'all' && activeFilter !== 'All Titles' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveFilter('All Titles');
                        setSelectedPlatform('all');
                        setSelectedYear('all');
                        setSortOrder('title-asc');
                      }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-300 font-semibold px-4 py-2 rounded-md transition-colors border border-zinc-700 cursor-pointer"
                    >
                      View all titles
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Top Pagination Bar for Quick Navigation */}
                {(filteredShows.length > itemsPerPage || totalPages > 1) && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#181818] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs shadow-md">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-zinc-400 font-medium">Shows per page:</span>
                      {[50, 100, 200].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setItemsPerPage(num);
                            handlePageChange(1);
                          }}
                          className={`px-2.5 py-1 rounded font-mono font-bold transition-colors cursor-pointer ${
                            itemsPerPage === num
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                      <span className="text-zinc-500 ml-2 font-mono">
                        Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredShows.length)} of {filteredShows.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                      >
                        Previous
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
                        .map((page, idx, arr) => {
                          const prevPage = arr[idx - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;
                          return (
                            <div key={page} className="flex items-center gap-1">
                              {showEllipsis && <span className="text-zinc-500 px-1">...</span>}
                              <button
                                onClick={() => handlePageChange(page)}
                                className={`w-7 h-7 rounded font-bold font-mono text-xs transition-colors cursor-pointer flex items-center justify-center ${
                                  currentPage === page
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}

                      <button
                        onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-2">
                  {paginatedShows.map((show) => (
                    <ShowCard
                      key={show.id}
                      show={show}
                      className="w-full"
                      onOpenDetails={handleOpenDetails}
                      onIncrementEpisode={handleIncrementEpisode}
                      onToggleStatus={handleToggleStatus}
                      onHoverEnter={handleHoverEnter}
                      onHoverLeave={handleHoverLeave}
                      viewerColors={viewerColors}
                    />
                  ))}
                </div>

                {/* Bottom Pagination & Items Per Page Controls */}
                {(filteredShows.length > itemsPerPage || totalPages > 1) && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-800 text-xs">
                    {/* Items per page 50 / 100 / 200 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-zinc-400 font-medium">Shows per page:</span>
                      {[50, 100, 200].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setItemsPerPage(num);
                            handlePageChange(1);
                          }}
                          className={`px-2.5 py-1 rounded font-mono font-bold transition-colors cursor-pointer ${
                            itemsPerPage === num
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                      <span className="text-zinc-500 ml-2">
                        Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredShows.length)} of {filteredShows.length} titles
                      </span>
                    </div>

                    {/* Page navigation 1, 2, 3, 4, 5, 6... */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                      >
                        Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                        })
                        .map((page, idx, arr) => {
                          const prevPage = arr[idx - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;
                          return (
                            <div key={page} className="flex items-center gap-1">
                              {showEllipsis && <span className="text-zinc-500 px-1">...</span>}
                              <button
                                onClick={() => handlePageChange(page)}
                                className={`w-8 h-8 rounded font-bold font-mono transition-colors cursor-pointer flex items-center justify-center ${
                                  currentPage === page
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}

                      <button
                        onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Active Profile Filter Indicator Banner */}
        {activeProfile && (
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-4 pb-1">
            <div
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border backdrop-blur-sm shadow-md transition-all"
              style={{
                backgroundColor: `${getViewerColor(activeProfile, viewerColors)}15`,
                borderColor: `${getViewerColor(activeProfile, viewerColors)}40`,
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: getViewerColor(activeProfile, viewerColors) }}
                >
                  {activeProfile.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Active Profile: <span style={{ color: getViewerColor(activeProfile, viewerColors) }}>{activeProfile}</span>
                  </span>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline font-medium">
                    (Showing titles for this viewer)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSwitchProfile('')}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer border border-zinc-700"
              >
                👥 View All Profiles
              </button>
            </div>
          </div>
        )}

        {/* Netflix Category Shelves (Default Home) */}
        {!isAnyFilterActive && (
          <div className="space-y-4 sm:space-y-6 pt-2">
            {/* Recently Added Section */}
            <ShowRow
              id="recently-added"
              title="✨ Recently Added"
              subtitle="Latest additions to your tracker"
              shows={recentlyAddedShows}
              isLoading={isSyncing}
              onOpenDetails={handleOpenDetails}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setActiveFilter('All Titles')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              viewerColors={viewerColors}
              emptyState={{
                type: 'recently-added',
                title: 'No Recently Added Shows',
                description: 'Your recent additions shelf is empty. Add new movies or TV series to start tracking dates, platform availability, and your personal ratings.',
                actionLabel: '+ Add Show',
                onAction: () => setShowAddModal(true),
                tipText: 'New entries are automatically sorted to the front so you always see your latest additions.',
                badge: 'RECENT FEED EMPTY',
              }}
            />

            {/* Continue Watching Row */}
            <ShowRow
              id="continue-watching"
              title="Continue Watching"
              subtitle="Pick up right where you left off"
              shows={continueWatching.slice(0, 20)}
              isLoading={isSyncing}
              onOpenDetails={handleOpenDetails}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setActiveFilter('⏳ Watching')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              viewerColors={viewerColors}
              emptyState={{
                type: 'continue-watching',
                title: 'No Shows In Progress Right Now',
                description: 'You don\'t have any titles currently marked as "Watching". Add a new show or mark an existing title from your library to track episodes, seasons, and progress bars here!',
                actionLabel: '+ Add Show',
                onAction: () => setShowAddModal(true),
                secondaryActionLabel: shows.length > 0 ? 'Explore All Titles' : undefined,
                onSecondaryAction: shows.length > 0 ? () => setActiveFilter('All Titles') : undefined,
                tipText: 'Tap the status button on any title card to switch it to "Watching" and resume right here.',
                badge: 'QUEUE READY',
              }}
            />

            {/* Wishlist Sheet Shelf */}
            {wishlistShows.length > 0 && (
              <ShowRow
                id="wishlist-shelf"
                title="🎁 Your Wishlist"
                shows={wishlistShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setActiveFilter('🎁 Wishlist')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}

            {/* Coming Soon & Premieres Showcase Shelf */}
            {comingSoonShows.length > 0 && (
              <ShowRow
                id="coming-soon-shelf"
                title="⏰ Upcoming Release Dates"
                subtitle="Shows with upcoming release dates"
                shows={comingSoonShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setActiveFilter('⏰ Coming Soon')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}

            {/* Top Rated Row */}
            <ShowRow
              id="top-rated"
              title="Top Rated &amp; Great Picks"
              shows={topRated.slice(0, 20)}
              isLoading={isSyncing}
              onOpenDetails={handleOpenDetails}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setActiveFilter('⭐ Top Rated')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              viewerColors={viewerColors}
            />

            {/* Netflix Originals & Shows */}
            <ShowRow
              id="netflix-shelf"
              title="On Netflix"
              shows={netflixShows.slice(0, 20)}
              isLoading={isSyncing}
              onOpenDetails={handleOpenDetails}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setSelectedPlatform('Netflix')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              viewerColors={viewerColors}
            />

            {/* Prime Video Hits */}
            <ShowRow
              id="prime-shelf"
              title="On Prime Video"
              shows={primeShows.slice(0, 20)}
              isLoading={isSyncing}
              onOpenDetails={handleOpenDetails}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setSelectedPlatform('Prime Video')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              viewerColors={viewerColors}
            />

            {/* Additional Platforms */}
            {disneyShows.length > 0 && (
              <ShowRow
                id="disney-shelf"
                title="On Disney+"
                shows={disneyShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Disney+')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}
            {appleShows.length > 0 && (
              <ShowRow
                id="apple-shelf"
                title="On Apple TV+"
                shows={appleShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Apple TV+')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}
            {paramountShows.length > 0 && (
              <ShowRow
                id="paramount-shelf"
                title="On Paramount+"
                shows={paramountShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Paramount+')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}
            {maxShows.length > 0 && (
              <ShowRow
                id="max-shelf"
                title="On Max / HBO"
                shows={maxShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Max')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}
            {skyShows.length > 0 && (
              <ShowRow
                id="sky-shelf"
                title="On Sky / Now"
                shows={skyShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Sky')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}

            {/* Watched / Finished Row */}
            <ShowRow
              id="watched-shelf"
              title="Completed &amp; Watched"
              subtitle="Everything you've finished"
              shows={watchedShows.slice(0, 20)}
              isLoading={isSyncing}
              onOpenDetails={handleOpenDetails}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setActiveFilter('✅ Watched')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              viewerColors={viewerColors}
            />

            {/* Paused & Dropped */}
            {pausedShows.length > 0 && (
              <ShowRow
                id="paused-dropped-shelf"
                title="Paused &amp; Dropped"
                subtitle="Titles currently on hold or dropped"
                shows={pausedShows.slice(0, 20)}
                isLoading={isSyncing}
                onOpenDetails={handleOpenDetails}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setActiveFilter('⏸️ Paused / ❌ Dropped')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                viewerColors={viewerColors}
              />
            )}
          </div>
        )}

            {/* Currently In-Progress & Top Rated Showcase at Main Page Bottom */}
            <ShowcaseSection
              shows={profileFilteredShows}
              onOpenDetails={handleOpenDetails}
              onNavigateToFilter={(filter = 'All Titles', sort) => {
                setSearchQuery('');
                setSelectedPlatform('all');
                setSelectedYear('all');
                if (sort) {
                  setSortOrder(sort);
                }
                setActiveFilter(filter);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen ${
        accessibilitySettings.contrastMode === 'high' ? 'high-contrast' : 'bg-[#141414]'
      } ${
        accessibilitySettings.textSize === 'large' ? 'accessible-large-text' : ''
      } ${
        accessibilitySettings.dyslexiaFont ? 'accessible-dyslexia-font' : ''
      } ${
        accessibilitySettings.reduceMotion ? 'accessible-reduce-motion' : ''
      } text-white flex flex-col selection:bg-[#E50914] selection:text-white font-sans antialiased`}
    >
      <Toaster position="bottom-center" toastOptions={{
        style: {
          background: '#181818',
          color: '#fff',
          border: '1px solid #3f3f46',
        }
      }} />
      {/* Offline Indicator & Sync Queue Processor */}
      <OfflineIndicator onSyncOfflineQueue={handleSyncOfflineQueue} />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          id="app-toast-notification"
          className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-200"
        >
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Floating Centered Back to Top Button */}
      {showScrollTop && !showStatsModal && (
        <button
          id="floating-back-to-top-btn"
          onClick={scrollToTop}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-2xl shadow-black/80 hover:scale-105 active:scale-95 transition-all cursor-pointer text-xs sm:text-sm border border-red-400/40 animate-in fade-in slide-in-from-bottom-4 duration-200"
          title="Back to Top"
        >
          <ArrowUp className="w-4 h-4 animate-bounce-subtle" />
          <span>Back to Top</span>
        </button>
      )}

      {/* Top Navigation */}
      <Navbar
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onOpenSync={() => setShowSyncModal(true)}
        onOpenAdd={() => setShowAddModal(true)}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q) setShowStatsModal(false);
        }}
        activeFilter={activeFilter}
        onSelectFilter={(f) => {
          setShowStatsModal(false);
          setActiveFilter(f);
        }}
        selectedPlatform={selectedPlatform}
        onSelectPlatform={(p) => {
          setShowStatsModal(false);
          setSelectedPlatform(p);
        }}
        sheetConnected={Boolean(spreadsheetId && sheetTitle)}
        sheetTitle={sheetTitle}
        shows={profileFilteredShows}
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
        autoSyncEnabled={autoSyncEnabled}
        onTriggerSync={() => fetchLatestFromSheet(false)}
        accessibilitySettings={accessibilitySettings}
        setAccessibilitySettings={setAccessibilitySettings}
        onOpenDashboard={() => setShowStatsModal(true)}
        isOnline={isOnline}
        syncFrequency={syncFrequency}
        onUpdateSyncFrequency={handleUpdateSyncFrequency}
        onOpenDetails={handleOpenDetails}
        activeProfile={activeProfile}
        onSwitchProfile={handleSwitchProfile}
        customViewers={customViewers}
        onUpdateCustomViewers={handleUpdateCustomViewers}
        viewerColors={viewerColors}
        onUpdateViewerColors={handleUpdateViewerColors}
        alertIntervals={alertIntervals}
        onUpdateAlertIntervals={handleUpdateAlertIntervals}
        spreadsheetId={spreadsheetId}
        sheetName={sheetName}
        wishlistSheetName={wishlistSheetName}
        availableTabs={availableTabs}
        onConnect={handleConnectSheets}
        onDisconnect={handleDisconnectSheets}
        onToggleAutoSync={handleToggleAutoSync}
      />

      <main className={`flex-1 pb-16 w-full max-w-full overflow-x-hidden ${!isAnyFilterActive && !showStatsModal ? 'pt-0' : 'pt-16'}`}>
        {renderMainContent()}
      </main>


      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#101010] py-8 pb-28 sm:pb-8 text-zinc-500 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#E50914] flex items-center justify-center font-bold text-white text-xs">
              N
            </div>
            <span className="font-semibold text-zinc-400">SHOWFLIX Tracker</span>
            <span>•</span>
            <span>Google Sheets Auto-Sync</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSyncModal(true)}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Google Sheets Settings
            </button>
            {shows.length > 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="hover:text-zinc-300 transition-colors cursor-pointer"
              >
                + Add Title
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedShow && (
        <ShowDetailModal
          key={selectedShow.id}
          show={selectedShow}
          isOpen={true}
          onClose={() => setSelectedShow(null)}
          onSave={handleSaveShow}
          onDelete={handleDeleteShow}
          sheetConnected={Boolean(spreadsheetId && sheetTitle)}
          sheetPlatforms={availablePlatforms.map((p) => p.raw)}
          sheetViewers={availableViewers}
          sheetGenres={availableGenres}
          onMoveToWishlist={handleMoveToWishlist}
          onMoveToMaster={handleMoveToMaster}
          masterSheetName={sheetName}
          wishlistSheetName={wishlistSheetName}
          viewerColors={viewerColors}
        />
      )}

      {showAddModal && (
        <AddShowModal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddShow}
          onSelectExistingShow={(show) => setSelectedShow(show)}
          sheetConnected={Boolean(spreadsheetId)}
          defaultViewer={activeProfile || ""}
          sheetPlatforms={availablePlatforms.map((p) => p.raw)}
          sheetViewers={availableViewers}
          sheetGenres={availableGenres}
          masterSheetName={sheetName}
          wishlistSheetName={wishlistSheetName}
          shows={shows}
          viewerColors={viewerColors}
        />
      )}

      {showSyncModal && (
        <SettingsCenterModal
          isOpen={true}
          onClose={() => setShowSyncModal(false)}
          user={user}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          spreadsheetId={spreadsheetId}
          sheetName={sheetName}
          wishlistSheetName={wishlistSheetName}
          availableTabs={availableTabs}
          onConnect={handleConnectSheets}
          onDisconnect={handleDisconnectSheets}
          isSyncing={isSyncing}
          lastSyncedAt={lastSyncedAt}
          sheetTitle={sheetTitle}
          shows={shows}
          autoSyncEnabled={autoSyncEnabled}
          onToggleAutoSync={handleToggleAutoSync}
          syncFrequency={syncFrequency}
          onUpdateSyncFrequency={handleUpdateSyncFrequency}
          onTriggerSync={() => fetchLatestFromSheet(false)}
          isOnline={isOnline}
          customViewers={customViewers}
          onUpdateCustomViewers={handleUpdateCustomViewers}
          viewerColors={viewerColors}
          onUpdateViewerColors={handleUpdateViewerColors}
          activeProfile={activeProfile}
          onSwitchProfile={handleSwitchProfile}
          alertIntervals={alertIntervals}
          onUpdateAlertIntervals={handleUpdateAlertIntervals}
          accessibilitySettings={accessibilitySettings}
          setAccessibilitySettings={setAccessibilitySettings}
          defaultTab="sync"
        />
      )}

      {/* Workspace API Confirmation Modal */}
      {confirmState.isOpen && (
        <ConfirmModal
          isOpen={true}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          isDestructive={confirmState.isDestructive}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Netflix True Hover Expansion Card */}
      {hoveredShow && hoveredRect && !selectedShow && (
        <NetflixHoverPortal
          key={`hover-portal-${hoveredShow.id}`}
          show={hoveredShow}
          rect={hoveredRect}
          onMouseEnter={handleHoverPortalEnter}
          onClose={() => {
            if (hoverGraceTimeoutRef.current) {
              clearTimeout(hoverGraceTimeoutRef.current);
              hoverGraceTimeoutRef.current = null;
            }
            setHoveredShowId(null);
            setHoveredRect(null);
          }}
          onMouseLeave={handleHoverLeave}
          onOpenDetails={handleOpenDetails}
          onIncrementEpisode={(s) => {
            handleIncrementEpisode(s);
          }}
          onToggleStatus={(s) => {
            handleToggleStatus(s);
          }}
          onUpdateRating={(s, num) => {
            handleUpdateRating(s, num);
          }}
          viewerColors={viewerColors}
        />
      )}
    </div>
  );
}
