import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import type { User } from 'firebase/auth';
import {
  auth,
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setCachedAccessToken,
  saveUserSheetConfig,
  loadUserSheetConfig,
} from './firebase';
import { ShowItem, WatchStatus, PRESET_PLATFORMS, AccessibilitySettings } from './types';
import {
  fetchSpreadsheetDetails,
  fetchSheetRows,
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
  DEFAULT_WISHLIST_HEADERS,
  getSheetTabHeaders,
  extractSpreadsheetId,
  fetchCustomViewers,
} from './services/sheetsService';

import toast from 'react-hot-toast';
import Navbar from './components/Navbar';
import HeroBillboard from './components/HeroBillboard';
import ShowRow from './components/ShowRow';
import ShowCard from './components/ShowCard';
import ShowDetailModal from './components/ShowDetailModal';
import AddShowModal from './components/AddShowModal';
import SheetSyncModal from './components/SheetSyncModal';
import ConfirmModal from './components/ConfirmModal';
import DashboardStats from './components/DashboardStats';
import ShowcaseSection from './components/ShowcaseSection';
import NetflixHoverPortal from './components/NetflixHoverPortal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { getCachedShows, setCachedShows, queueOfflineAction } from './services/offlineQueue';
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
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [shows, setShows] = useState<ShowItem[]>(() => {
    try {
      const cached = getCachedShows();
      if (cached && cached.length > 0) {
        return cached;
      }
    } catch {}
    return [];
  });

  // Persist shows to local cache whenever they update
  useEffect(() => {
    setCachedShows(shows);
  }, [shows]);

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
      const saved = localStorage.getItem('bingebox_accessibility_settings');
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

  // Persist accessibility settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('bingebox_accessibility_settings', JSON.stringify(accessibilitySettings));
    } catch {
      // Ignore
    }
  }, [accessibilitySettings]);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedShow, setSelectedShow] = useState<ShowItem | null>(null);

  const [hoveredShowId, setHoveredShowId] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const hoverGraceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hoveredShow = useMemo(() => {
    return shows.find((s) => s.id === hoveredShowId) || null;
  }, [shows, hoveredShowId]);

  const handleHoverEnter = useCallback((show: ShowItem, rect: { top: number; left: number; width: number; height: number }) => {
    if (hoverGraceTimeoutRef.current) {
      clearTimeout(hoverGraceTimeoutRef.current);
      hoverGraceTimeoutRef.current = null;
    }
    setHoveredShowId(show.id);
    setHoveredRect(rect);
  }, []);

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
      return localStorage.getItem('bingebox_spreadsheet_id') || '';
    } catch {
      return '';
    }
  });
  const [sheetName, setSheetName] = useState<string>(() => {
    try {
      return localStorage.getItem('bingebox_sheet_name') || 'MASTER TRACKER';
    } catch {
      return 'MASTER TRACKER';
    }
  });
  const [wishlistSheetName, setWishlistSheetName] = useState<string>(() => {
    try {
      return localStorage.getItem('bingebox_wishlist_sheet_name') || '📋  WISHLIST';
    } catch {
      return '📋  WISHLIST';
    }
  });
  const [availableTabs, setAvailableTabs] = useState<string[]>(() => {
    try {
      const v = localStorage.getItem('bingebox_available_sheet_tabs');
      if (v) return JSON.parse(v);
    } catch {}
    return [];
  });
  const [sheetTabId, setSheetTabId] = useState<number | undefined>(() => {
    try {
      const v = localStorage.getItem('bingebox_sheet_tab_id');
      return v ? parseInt(v, 10) : undefined;
    } catch {
      return undefined;
    }
  });
  const [sheetTitle, setSheetTitle] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem('bingebox_sheet_title') || undefined;
    } catch {
      return undefined;
    }
  });
  const [sheetHeaders, setSheetHeaders] = useState<string[]>(() => {
    try {
      const v = localStorage.getItem('bingebox_sheet_headers');
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
      const cached = localStorage.getItem('bingebox_custom_viewers');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bingebox_auto_sync') !== 'false';
    } catch {
      return true;
    }
  });

  const clearAllUserData = useCallback(() => {
    setUser(null);
    setShows([]);
    setSelectedShow(null);
    setShowAddModal(false);
    setShowSyncModal(false);
    setCustomViewers([]);
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
      'bingebox_preview_mode',
      'bingebox_spreadsheet_id',
      'bingebox_sheet_name',
      'bingebox_wishlist_sheet_name',
      'bingebox_available_sheet_tabs',
      'bingebox_sheet_tab_id',
      'bingebox_sheet_title',
      'bingebox_sheet_headers',
      'showflix_cached_shows',
      'showflix_offline_queue',
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
      localStorage.setItem('bingebox_auto_sync', String(enabled));
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
      if (!currentSheetId) return;

      const token = await getAccessToken();
      if (!token) return;

      if (!isSilent) setIsSyncing(true);
      try {
        const masterParsed = await fetchSheetRows(currentSheetId, currentSheetName, token, false);
        let combinedShows: ShowItem[] = masterParsed.shows || [];

        // Check if wishlist sheet exists & fetch
        try {
          const wishlistParsed = await fetchSheetRows(currentSheetId, currentWishlistName, token, true);
          if (wishlistParsed.shows && wishlistParsed.shows.length > 0) {
            combinedShows = [...combinedShows, ...wishlistParsed.shows];
          }
        } catch {
          // Wishlist tab may not exist yet or empty
        }

        setShows(combinedShows);
        if (masterParsed.headers && masterParsed.headers.length > 0) {
          setSheetHeaders(masterParsed.headers);
        }
        
        // Try to sync custom viewers list if a lists tab exists
        try {
          const storedTabs = localStorage.getItem('bingebox_available_sheet_tabs');
          const tabs: string[] = storedTabs ? JSON.parse(storedTabs) : availableTabs;
          const listsTab = tabs.find((t) => t.toLowerCase().includes('lists'));
          if (listsTab && currentSheetId) {
            const viewers = await fetchCustomViewers(currentSheetId, listsTab, token);
            if (viewers && viewers.length > 0) {
              setCustomViewers(viewers);
              localStorage.setItem('bingebox_custom_viewers', JSON.stringify(viewers));
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
        if (msg.includes('invalid authentication credentials') || msg.includes('401') || msg.includes('invalid_grant') || msg.includes('Expected OAuth 2 access token')) {
          setCachedAccessToken(null);
          if (!isSilent) {
            showToast('⚠️ Google Sheets session expired. Please open Google Sheets Settings and reconnect.');
          }
        }
      } finally {
        if (!isSilent) setIsSyncing(false);
      }
    },
    [spreadsheetId, sheetName, wishlistSheetName, availableTabs]
  );

  // Initialize Firebase Auth listener and auto-sync on load
  useEffect(() => {
    const unsubscribe = initAuth(
      async (currentUser, token) => {
        setUser(currentUser);

        let activeSheetId = spreadsheetId || localStorage.getItem('bingebox_spreadsheet_id') || '';
        let activeSheetName = sheetName || localStorage.getItem('bingebox_sheet_name') || 'MASTER TRACKER';
        let activeWishlistName = wishlistSheetName || localStorage.getItem('bingebox_wishlist_sheet_name') || 'Wishlist';

        // Check Firestore cloud settings for the authenticated user so their connected sheet is permanent
        if (currentUser?.uid) {
          try {
            const cloudConfig = await loadUserSheetConfig(currentUser.uid);
            if (cloudConfig?.spreadsheetId) {
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
            } else if (activeSheetId) {
              // Save existing local config to Firestore so it is synced across devices
              saveUserSheetConfig(currentUser.uid, {
                spreadsheetId: activeSheetId,
                sheetName: activeSheetName,
                wishlistSheetName: activeWishlistName,
                sheetTitle: sheetTitle || '',
                sheetTabId: sheetTabId,
                autoSyncEnabled: autoSyncEnabled,
              }).catch(console.warn);
            }
          } catch (e) {
            console.warn('Error loading cloud sheet configuration:', e);
          }
        }

        // Automatically fetch latest shows from the saved Google Sheet
        if (activeSheetId && token) {
          try {
            // First check spreadsheet details to verify and detect exact sheet tabs
            try {
              const meta = await fetchSpreadsheetDetails(activeSheetId, token);
              if (meta?.sheetNames && meta.sheetNames.length > 0) {
                setAvailableTabs(meta.sheetNames);
                try {
                  localStorage.setItem('bingebox_available_sheet_tabs', JSON.stringify(meta.sheetNames));
                } catch {}

                // Try fetching custom viewers list from "lists" tab
                const listsTab = meta.sheetNames.find((t) => t.toLowerCase().includes('lists'));
                if (listsTab) {
                  try {
                    const viewers = await fetchCustomViewers(activeSheetId, listsTab, token);
                    if (viewers && viewers.length > 0) {
                      setCustomViewers(viewers);
                      localStorage.setItem('bingebox_custom_viewers', JSON.stringify(viewers));
                    }
                  } catch (listsErr) {
                    console.warn('Initial lists custom viewers fetch notice:', listsErr);
                  }
                }

                const detectedWishlist = findMatchingWishlistSheet(meta.sheetNames);
                if (detectedWishlist && detectedWishlist !== activeWishlistName) {
                  console.log(`Auto-detected existing wishlist tab: "${detectedWishlist}" (was "${activeWishlistName}")`);
                  activeWishlistName = detectedWishlist;
                  setWishlistSheetName(detectedWishlist);
                  localStorage.setItem('bingebox_wishlist_sheet_name', detectedWishlist);
                  if (currentUser?.uid) {
                    saveUserSheetConfig(currentUser.uid, { wishlistSheetName: detectedWishlist }).catch(console.warn);
                  }
                }

                const detectedMaster = findMatchingMasterSheet(meta.sheetNames);
                if (detectedMaster && !meta.sheetNames.includes(activeSheetName)) {
                  activeSheetName = detectedMaster;
                  setSheetName(detectedMaster);
                  localStorage.setItem('bingebox_sheet_name', detectedMaster);
                }
              }
            } catch (metaErr) {
              console.warn('Initial metadata check notice:', metaErr);
            }

            const masterParsed = await fetchSheetRows(activeSheetId, activeSheetName, token, false);
            let combined = masterParsed.shows || [];
            try {
              const wishlistParsed = await fetchSheetRows(activeSheetId, activeWishlistName, token, true);
              if (wishlistParsed.shows && wishlistParsed.shows.length > 0) {
                combined = [...combined, ...wishlistParsed.shows];
              }
            } catch (wErr) {
              console.warn('Wishlist initial fetch notice:', wErr);
            }

            if (combined.length > 0) {
              setShows(combined);
              if (masterParsed.headers.length > 0) {
                setSheetHeaders(masterParsed.headers);
              }
              const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setLastSyncedAt(nowStr);
            }
          } catch (e) {
            console.warn('Initial sheet auto-sync on auth:', e);
          }
        }
      },
      () => {
        clearAllUserData();
      }
    );
    return () => unsubscribe();
  }, []);

  // Background Auto-Sync: Poll every 45 seconds when tab is active
  useEffect(() => {
    if (!autoSyncEnabled || !spreadsheetId) return;

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLatestFromSheet(true);
      }
    }, 45000);

    return () => clearInterval(intervalId);
  }, [autoSyncEnabled, spreadsheetId, fetchLatestFromSheet]);

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
    showToast('Signed out');
  };

  // Google Sheets Connect & Sync
  const handleConnectSheets = async (targetId: string, targetSheetName: string, targetWishlistSheet: string = 'Wishlist') => {
    const cleanId = extractSpreadsheetId(targetId) || targetId.trim();
    if (!cleanId) {
      showToast('⚠️ Please provide a valid Google Sheet URL or ID');
      return;
    }

    // Immediately set spreadsheet ID and sync state so UI responds without delay
    setSpreadsheetId(cleanId);
    try {
      localStorage.setItem('bingebox_spreadsheet_id', cleanId);
    } catch {}

    let token = await getAccessToken();
    if (!token) {
      const authRes = await handleSignIn();
      token = authRes?.accessToken || null;
      if (!token) {
        showToast('⚠️ Google sign-in is required to link your Google Sheet');
        return;
      }
    }

    setIsSyncing(true);
    try {
      // 1. Fetch metadata fast
      const meta = await fetchSpreadsheetDetails(cleanId, token);
      setAvailableTabs(meta.sheetNames);
      setSheetTitle(meta.title);
      try {
        localStorage.setItem('bingebox_available_sheet_tabs', JSON.stringify(meta.sheetNames));
        localStorage.setItem('bingebox_sheet_title', meta.title);
      } catch {}
      
      // Try to find matching sheet name for Master Tracker
      let chosenSheet = (targetSheetName || '').trim();
      const detectedMaster = findMatchingMasterSheet(meta.sheetNames);
      if (chosenSheet) {
        const found = meta.sheetNames.find(
          (s) => s.trim().toLowerCase() === chosenSheet.toLowerCase()
        );
        if (found) {
          chosenSheet = found;
        } else if (detectedMaster) {
          chosenSheet = detectedMaster;
        }
      } else if (detectedMaster) {
        chosenSheet = detectedMaster;
      } else {
        chosenSheet = meta.sheetNames[0] || 'Sheet1';
      }

      // Check Wishlist sheet tab name (accurately detecting "📋  WISHLIST" or variations)
      let chosenWishlist = (targetWishlistSheet || '').trim();
      const detectedWishlist = findMatchingWishlistSheet(meta.sheetNames);
      if (detectedWishlist) {
        chosenWishlist = detectedWishlist;
      } else if (chosenWishlist) {
        const foundWishlist = meta.sheetNames.find(
          (s) => s.trim().toLowerCase() === chosenWishlist.toLowerCase()
        );
        if (foundWishlist) {
          chosenWishlist = foundWishlist;
        }
      } else {
        chosenWishlist = '📋  WISHLIST';
      }

      const hasWishlistTab =
        meta.sheetNames.includes(chosenWishlist) ||
        meta.sheetNames.some((s) => s.trim().toLowerCase() === chosenWishlist.toLowerCase()) ||
        Boolean(detectedWishlist);

      const listsTab = meta.sheetNames.find((t) => t.toLowerCase().includes('lists'));

      // 2. Fetch Master Rows, Wishlist Rows, and Custom Viewers in parallel for instant speed
      const [masterResult, wishlistResult, customViewersResult] = await Promise.allSettled([
        fetchSheetRows(cleanId, chosenSheet, token, false),
        hasWishlistTab
          ? fetchSheetRows(cleanId, chosenWishlist, token, true)
          : Promise.resolve({ shows: [], headers: [], headerRowIndex: 0 }),
        listsTab
          ? fetchCustomViewers(cleanId, listsTab, token)
          : Promise.resolve([]),
      ]);

      const masterParsed =
        masterResult.status === 'fulfilled'
          ? masterResult.value
          : { shows: [], headers: [], headerRowIndex: 0 };

      const wishlistParsed =
        wishlistResult.status === 'fulfilled'
          ? wishlistResult.value
          : { shows: [], headers: [], headerRowIndex: 0 };

      if (customViewersResult.status === 'fulfilled' && customViewersResult.value.length > 0) {
        setCustomViewers(customViewersResult.value);
        try {
          localStorage.setItem('bingebox_custom_viewers', JSON.stringify(customViewersResult.value));
        } catch {}
      }

      let combinedShows: ShowItem[] = [...(masterParsed.shows || []), ...(wishlistParsed.shows || [])];

      // Find matching numeric sheet tab ID for batchUpdate operations (e.g. delete row)
      const matchedSheetObj = meta.sheets.find(
        (s) => s.title.trim().toLowerCase() === chosenSheet.trim().toLowerCase()
      );

      setSheetName(chosenSheet);
      setWishlistSheetName(chosenWishlist);
      setSheetTabId(matchedSheetObj?.id);
      if (masterParsed.headers.length > 0) {
        setSheetHeaders(masterParsed.headers);
      }

      // Update shows immediately
      setShows(combinedShows);

      // Persist configuration in localStorage
      try {
        localStorage.setItem('bingebox_spreadsheet_id', cleanId);
        localStorage.setItem('bingebox_sheet_name', chosenSheet);
        localStorage.setItem('bingebox_wishlist_sheet_name', chosenWishlist);
        localStorage.setItem('bingebox_sheet_title', meta.title);
        if (matchedSheetObj?.id !== undefined) {
          localStorage.setItem('bingebox_sheet_tab_id', String(matchedSheetObj.id));
        }
        if (masterParsed.headers.length > 0) {
          localStorage.setItem('bingebox_sheet_headers', JSON.stringify(masterParsed.headers));
        }
      } catch (e) {
        console.warn('Could not save to localStorage:', e);
      }

      // Save permanently to Firestore cloud database
      const activeUid = user?.uid || auth.currentUser?.uid;
      if (activeUid) {
        saveUserSheetConfig(activeUid, {
          spreadsheetId: cleanId,
          sheetName: chosenSheet,
          wishlistSheetName: chosenWishlist,
          sheetTitle: meta.title,
          sheetTabId: matchedSheetObj?.id,
          autoSyncEnabled: autoSyncEnabled,
        }).catch((e) => console.warn('Could not persist to Firestore:', e));
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(nowStr);
      const wCount = combinedShows.filter((s) => s.isWishlist).length;
      showToast(`Successfully connected "${meta.title}" (${chosenSheet}) - ${combinedShows.length} shows loaded (${combinedShows.length - wCount} Master, ${wCount} Wishlist)`);
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
    }
  };

  const handleDisconnectSheets = () => {
    const activeUid = user?.uid || auth.currentUser?.uid;
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
    try {
      localStorage.removeItem('bingebox_spreadsheet_id');
      localStorage.removeItem('bingebox_sheet_name');
      localStorage.removeItem('bingebox_wishlist_sheet_name');
      localStorage.removeItem('bingebox_sheet_title');
      localStorage.removeItem('bingebox_sheet_tab_id');
      localStorage.removeItem('bingebox_sheet_headers');
    } catch {}
    showToast('Disconnected Google Sheets');
  };

  // Helper: auto-sync updated show to Google Sheet (reliable non-blocking live update)
  const syncShowToSheet = async (updatedShow: ShowItem) => {
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

    try {
      let token = await getAccessToken();
      if (!token) {
        showToast('🔑 Signing in to Google to sync spreadsheet...');
        const authRes = await handleSignIn();
        token = authRes?.accessToken || null;
        if (!token) {
          showToast('⚠️ Google sign-in required to update your Google Sheet');
          return;
        }
      }

      // If show has a poster image and sheet lacks a poster column, ensure it exists
      let currentHeaders = updatedShow.isWishlist ? DEFAULT_WISHLIST_HEADERS : sheetHeaders;
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
      let rowNum = updatedShow.rowNumber;
      if (!rowNum) {
        rowNum = (await findRowNumberByTitle(spreadsheetId, targetTab, updatedShow.title, token)) ?? undefined;
      }

      // 2. If row not found in sheet, automatically append it so the Google Sheet is updated!
      if (!rowNum) {
        showToast(`Adding "${updatedShow.title}" to ${targetTab}...`);
        const appendRes = await appendSheetRow(spreadsheetId, targetTab, updatedShow, currentHeaders, token);
        rowNum = appendRes.rowNumber;
        if (rowNum) {
          updatedShow.rowNumber = rowNum;
          setShows((prev) => prev.map((s) => (s.id === updatedShow.id ? { ...s, rowNumber: rowNum, sheetTabName: targetTab } : s)));
        }
        showToast(`✅ Synced "${updatedShow.title}" to "${targetTab}"!`);
        return;
      }

      console.log(`[Google Sheets Sync] Updating existing row ${rowNum} for "${updatedShow.title}" (Poster: "${updatedShow.posterUrl || 'none'}") in tab "${targetTab}"`);

      // 3. Row exists: update Episode, Season, Status, Next Ep, Poster, Max Ep, Rating, and Rating Num directly via batchUpdate!
      await updateEpisodeAndSeasonInSheet(
        spreadsheetId,
        targetTab,
        rowNum,
        updatedShow.seasons,
        updatedShow.episodes,
        currentHeaders,
        token,
        updatedShow.status,
        updatedShow.nextEp,
        updatedShow.nextSsn,
        updatedShow.posterUrl,
        updatedShow.maxEp,
        updatedShow.rating,
        updatedShow.ratingNum,
        updatedShow.type
      );

      // Keep rowNumber updated in state
      setShows((prev) => prev.map((s) => (s.id === updatedShow.id ? { ...s, rowNumber: rowNum, sheetTabName: targetTab } : s)));

      // 4. Also safely sync entire row values
      await updateSheetRow(
        spreadsheetId,
        targetTab,
        rowNum,
        updatedShow,
        currentHeaders,
        token
      ).catch((e) => {
        console.warn('Full row update secondary warning (batchUpdate already succeeded):', e);
      });

      showToast(`✅ Google Sheet Updated: "${updatedShow.title}" (${targetTab})`);
    } catch (err: any) {
      console.error('Failed to sync show to Google Sheets:', err);
      const msg = err?.message || String(err);
      if (msg.includes('invalid authentication credentials') || msg.includes('401') || msg.includes('invalid_grant') || msg.includes('Expected OAuth 2 access token')) {
        setCachedAccessToken(null);
        showToast('⚠️ Google Sheets session expired. Please open Google Sheets Settings and reconnect.');
      } else {
        showToast(`⚠️ Sheet sync: ${msg}`);
      }
    }
  };

  // Quick increment episode with season advancement & auto-click Google Sheets sync
  const handleIncrementEpisode = async (show: ShowItem) => {
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
    if (selectedShow?.id === show.id) {
      setSelectedShow(updatedShow);
    }

    showToast(`Advanced "${show.title}" to ${nextSsnStr} ${nextEpStr}`);

    // Seamless auto-sync to Google Sheet without blocking popup modal ("auto click")
    if (spreadsheetId) {
      syncShowToSheet(updatedShow);
    } else {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to auto-sync episode progress!');
    }
  };

  // Quick increment season
  const handleIncrementSeason = async (show: ShowItem) => {
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
    if (selectedShow?.id === show.id) {
      setSelectedShow(updatedShow);
    }

    showToast(`Advanced "${show.title}" to ${nextSsnStr} ${nextEpStr}`);

    if (spreadsheetId) {
      syncShowToSheet(updatedShow);
    } else {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to auto-sync season progress!');
    }
  };

  // Toggle watch status with auto-sync
  const handleToggleStatus = async (show: ShowItem) => {
    const nextStatus: WatchStatus = show.status === '✅ Watched' ? '⏳ Watching' : '✅ Watched';
    const updatedShow: ShowItem = { ...show, status: nextStatus };

    setShows((prev) => prev.map((s) => (s.id === show.id ? updatedShow : s)));
    if (selectedShow?.id === show.id) {
      setSelectedShow(updatedShow);
    }

    showToast(`Set "${show.title}" to ${nextStatus}`);

    if (spreadsheetId) {
      syncShowToSheet(updatedShow);
    } else {
      setShowSyncModal(true);
      showToast('⚠️ Connect your Google Sheet to auto-sync status!');
    }
  };

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
      syncShowToSheet(updatedShow);
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
            const token = await getAccessToken();
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
    const isWishlist = Boolean(newShow.isWishlist);
    const isMovie = newShow.type === 'Movie';
    const targetTab = newShow.sheetTabName || (isWishlist ? wishlistSheetName : sheetName);
    const sanitizedShow: ShowItem = {
      ...newShow,
      isWishlist,
      sheetTabName: targetTab,
      seasons: isMovie || isWishlist ? '' : normalizeSeasonStr(newShow.seasons),
      episodes: isMovie || isWishlist ? '' : normalizeEpisodeStr(newShow.episodes),
      maxEp: isMovie || isWishlist ? '' : (newShow.maxEp ? normalizeEpisodeStr(newShow.maxEp) : ''),
      nextEp: isMovie || isWishlist ? false : Boolean(newShow.nextEp),
      nextSsn: isMovie || isWishlist ? false : Boolean(newShow.nextSsn),
    };

    // 1. Instant optimistic UI update: Show appears on the dashboard immediately with 0ms delay!
    setShows((prev) => [sanitizedShow, ...prev]);
    showToast(`✨ Added "${sanitizedShow.title}" to ${isWishlist ? 'Wishlist' : 'Master Tracker'}`);

    // 2. Asynchronous background sync to Google Sheets
    if (spreadsheetId) {
      (async () => {
        let addedShow = { ...sanitizedShow };
        try {
          const token = await getAccessToken();
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
      const token = await getAccessToken();
      if (!token) {
        showToast('⚠️ Google sign-in required to update Google Sheets');
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
                dateAdded: showToMove.dateAdded || new Date().toISOString().split('T')[0],
              }
            : s
        )
      );
      showToast(`🎁 Moved "${showToMove.title}" to "${targetTab}"`);
    } catch (err: any) {
      console.error('Failed to move show to wishlist:', err);
      showToast(`⚠️ Could not move to wishlist: ${err?.message || err}`);
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
      const token = await getAccessToken();
      if (!token) {
        showToast('⚠️ Google sign-in required to update Google Sheets');
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
      showToast(`⚠️ Could not move to master tracker: ${err?.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter shows - broad search across all metadata combined with category, platform, and year
  const filteredShows = useMemo(() => {
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

    let baseList = shows;

    // 1. Search Query filter (if any)
    if (trimmedQuery) {
      const queryClean = cleanStr(trimmedQuery);
      const queryTokens = queryClean.split(/\s+/).filter(Boolean);

      const strictMatches = baseList.filter((show) => {
        const corpus = cleanStr(
          `${show.title} ${show.genre} ${show.platform}`
        );
        return queryTokens.every((token) => corpus.includes(token));
      });

      if (strictMatches.length > 0) {
        baseList = strictMatches;
      } else {
        const looseMatches = baseList.filter((show) => {
          const corpus = cleanStr(
            `${show.title} ${show.genre} ${show.platform}`
          );
          return queryTokens.some((token) => corpus.includes(token));
        });
        if (looseMatches.length > 0) {
          baseList = looseMatches;
        }
      }
    }

    // 2. Category / Status filter
    if (activeFilter !== 'all') {
      baseList = baseList.filter((show) => {
        if (activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist') return Boolean(show.isWishlist);
        if (activeFilter === 'Series') return show.type === 'Series';
        if (activeFilter === 'Movie') return show.type === 'Movie';
        if (activeFilter === '⏳ Watching') return show.status === '⏳ Watching';
        if (activeFilter === '✅ Watched') return show.status === '✅ Watched';
        if (activeFilter === '⏸️ Paused') return show.status === '⏸️ Paused';
        if (activeFilter === '❌ Dropped') return show.status === '❌ Dropped';
        if (activeFilter === '⏸️ Paused / ❌ Dropped') return show.status === '⏸️ Paused' || show.status === '❌ Dropped';
        return true;
      });
    }

    // 3. Platform filter
    if (selectedPlatform !== 'all') {
      baseList = baseList.filter((show) => {
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

    // 4. Year filter
    if (selectedYear !== 'all') {
      baseList = baseList.filter((show) => {
        if (show.year === undefined || show.year === null) return false;
        return String(show.year).trim() === String(selectedYear).trim();
      });
    }

    return baseList;
  }, [shows, searchQuery, activeFilter, selectedPlatform, selectedYear]);

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
      const count = shows.filter((s) => {
        if (!s.platform) return false;
        const norm = normalizePlatform(s.platform);
        return norm === preset || s.platform.trim() === preset;
      }).length;
      return { raw: preset, name: clean, count };
    });
  }, [shows]);

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
    if (shows.length === 0) return null;
    const watchingList = shows.filter((s) => s.status === '⏳ Watching');
    const candidates = watchingList.length > 0 ? watchingList : shows;
    return candidates[featuredIndex % candidates.length] || shows[0];
  }, [shows, featuredIndex]);

  // Auto-slideshow for Hero Billboard
  useEffect(() => {
    if (isAnyFilterActive) return; // Don't slideshow while user is searching/filtering

    const timer = setInterval(() => {
      setFeaturedIndex((prev) => prev + 1);
    }, 12000); // 12 seconds per slide

    return () => clearInterval(timer);
  }, [isAnyFilterActive, shows.length]);

  // Show category collections
  const continueWatching = useMemo(
    () => shows.filter((s) => s.status === '⏳ Watching'),
    [shows]
  );
  const topRated = useMemo(
    () => shows.filter((s) => s.ratingNum >= 4 || s.rating.includes('5')),
    [shows]
  );
  const netflixShows = useMemo(
    () => shows.filter((s) => s.platform.toLowerCase().includes('netflix')),
    [shows]
  );
  const primeShows = useMemo(
    () => shows.filter((s) => s.platform.toLowerCase().includes('prime')),
    [shows]
  );
  const disneyShows = useMemo(
    () => shows.filter((s) => s.platform.toLowerCase().includes('disney')),
    [shows]
  );
  const appleShows = useMemo(
    () => shows.filter((s) => s.platform.toLowerCase().includes('apple')),
    [shows]
  );
  const paramountShows = useMemo(
    () => shows.filter((s) => s.platform.toLowerCase().includes('paramount')),
    [shows]
  );
  const maxShows = useMemo(
    () => shows.filter((s) => s.platform.toLowerCase().includes('max') || s.platform.toLowerCase().includes('hbo')),
    [shows]
  );
  const skyShows = useMemo(
    () => shows.filter((s) => s.platform.toLowerCase().includes('sky') || s.platform.toLowerCase().includes('now')),
    [shows]
  );
  const watchedShows = useMemo(
    () => shows.filter((s) => s.status === '✅ Watched'),
    [shows]
  );
  const pausedShows = useMemo(
    () => shows.filter((s) => s.status === '⏸️ Paused' || s.status === '❌ Dropped'),
    [shows]
  );
  const wishlistShows = useMemo(
    () => shows.filter((s) => s.isWishlist),
    [shows]
  );

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
              <span>{shows.length} Total Titles</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
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
              <span className="text-base font-extrabold text-white">{shows.filter((s) => s.type === 'Movie').length}</span>
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
              <span className="text-base font-extrabold text-white">{shows.filter((s) => s.type === 'Series').length}</span>
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
    if (!user || !sheetTitle) {
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
            onOpenDetails={(show) => {
              setSelectedShow(show);
            }}
          />
        </div>
      );
    }

    return (
      <div className="w-full">
        {shows.length === 0 ? (
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
        ) : (
          <>
            {/* If user is not searching or filtering, show Netflix Hero Billboard */}
            {!isAnyFilterActive && (
              <HeroBillboard
                show={featuredShow}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onSelectNextFeatured={() => setFeaturedIndex((prev) => prev + 1)}
              />
            )}

        {/* Master Tracker Summary & Quick Filters Bar (Top) */}
        {renderMasterTrackerOverviewBar('top')}

        {/* Filter / Search results view */}
        {isAnyFilterActive && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-4">
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

                {/* Active Filter Chips */}
                <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 bg-red-950/80 text-red-300 border border-red-800/60 px-2.5 py-0.5 rounded-full">
                      <span>Query: "{searchQuery}"</span>
                      <button onClick={() => setSearchQuery('')} className="hover:text-white ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {activeFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-200 border border-zinc-700 px-2.5 py-0.5 rounded-full">
                      <span>Category: {activeFilter}</span>
                      <button onClick={() => setActiveFilter('all')} className="hover:text-white ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {['all', ...PRESET_PLATFORMS, ...customPlatforms].map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setSelectedPlatform(platform)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs transition-colors ${
                          selectedPlatform === platform
                            ? 'bg-red-900/60 text-red-200 border-red-700/60'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                  {selectedYear !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-amber-950/70 text-amber-200 border border-amber-700/60 px-2.5 py-0.5 rounded-full">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      <span>Year: {selectedYear}</span>
                      <button onClick={() => setSelectedYear('all')} className="hover:text-white ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>

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
                      if (!hasSub && isCategoryActive) {
                        // Already viewing all of this category, broaden to all titles
                        setActiveFilter('All Titles');
                      } else if (activeFilter === 'all') {
                        setActiveFilter('All Titles');
                      }
                      // Otherwise keeps activeFilter so Series + Netflix resets to Series (all)!
                    }}
                    className="text-xs text-zinc-200 hover:text-white bg-zinc-800/90 hover:bg-zinc-700 hover:border-zinc-500 px-3.5 py-1.5 rounded-lg border border-zinc-700 transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-[0.97] font-medium"
                    title={
                      isCategoryActive && hasSubFilters
                        ? `Reset platform, year, and search while staying in all ${categoryName}`
                        : 'Reset filters'
                    }
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{resetLabel}</span>
                  </button>
                );
              })()}
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
                      }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-300 font-semibold px-4 py-2 rounded-md transition-colors border border-zinc-700 cursor-pointer"
                    >
                      View all titles
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-2">
                {filteredShows.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    className="w-full"
                    onOpenDetails={(s) => setSelectedShow(s)}
                    onIncrementEpisode={handleIncrementEpisode}
                    onToggleStatus={handleToggleStatus}
                    onHoverEnter={handleHoverEnter}
                    onHoverLeave={handleHoverLeave}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Netflix Category Shelves (Default Home) */}
        {!isAnyFilterActive && (
          <div className="space-y-4 sm:space-y-6 pt-4">
            {/* Continue Watching Row */}
            <ShowRow
              id="continue-watching"
              title="Continue Watching"
              subtitle="Pick up right where you left off"
              shows={continueWatching}
              isLoading={isSyncing}
              onOpenDetails={(s) => setSelectedShow(s)}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setActiveFilter('⏳ Watching')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
            />

            {/* Wishlist Sheet Shelf */}
            {wishlistShows.length > 0 && (
              <ShowRow
                id="wishlist-shelf"
                title="🎁 Your Wishlist"
                shows={wishlistShows}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setActiveFilter('🎁 Wishlist')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
              />
            )}

            {/* Top Rated Row */}
            <ShowRow
              id="top-rated"
              title="Top Rated &amp; Great Picks"
              shows={topRated}
              isLoading={isSyncing}
              onOpenDetails={(s) => setSelectedShow(s)}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
            />

            {/* Netflix Originals & Shows */}
            <ShowRow
              id="netflix-shelf"
              title="On Netflix"
              shows={netflixShows}
              isLoading={isSyncing}
              onOpenDetails={(s) => setSelectedShow(s)}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setSelectedPlatform('Netflix')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
            />

            {/* Prime Video Hits */}
            <ShowRow
              id="prime-shelf"
              title="On Prime Video"
              shows={primeShows}
              isLoading={isSyncing}
              onOpenDetails={(s) => setSelectedShow(s)}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setSelectedPlatform('Prime Video')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
            />

            {/* Additional Platforms */}
            {disneyShows.length > 0 && (
              <ShowRow
                id="disney-shelf"
                title="On Disney+"
                shows={disneyShows}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Disney+')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
              />
            )}
            {appleShows.length > 0 && (
              <ShowRow
                id="apple-shelf"
                title="On Apple TV+"
                shows={appleShows}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Apple TV+')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
              />
            )}
            {paramountShows.length > 0 && (
              <ShowRow
                id="paramount-shelf"
                title="On Paramount+"
                shows={paramountShows}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Paramount+')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
              />
            )}
            {maxShows.length > 0 && (
              <ShowRow
                id="max-shelf"
                title="On Max / HBO"
                shows={maxShows}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Max')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
              />
            )}
            {skyShows.length > 0 && (
              <ShowRow
                id="sky-shelf"
                title="On Sky / Now"
                shows={skyShows}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setSelectedPlatform('Sky')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
              />
            )}

            {/* Watched / Finished Row */}
            <ShowRow
              id="watched-shelf"
              title="Completed &amp; Watched"
              subtitle="Everything you've finished"
              shows={watchedShows}
              isLoading={isSyncing}
              onOpenDetails={(s) => setSelectedShow(s)}
              onIncrementEpisode={handleIncrementEpisode}
              onToggleStatus={handleToggleStatus}
              onTitleClick={() => setActiveFilter('✅ Watched')}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
            />

            {/* Paused & Dropped */}
            {pausedShows.length > 0 && (
              <ShowRow
                id="paused-dropped-shelf"
                title="Paused &amp; Dropped"
                subtitle="Titles currently on hold or dropped"
                shows={pausedShows}
                isLoading={isSyncing}
                onOpenDetails={(s) => setSelectedShow(s)}
                onIncrementEpisode={handleIncrementEpisode}
                onToggleStatus={handleToggleStatus}
                onTitleClick={() => setActiveFilter('⏸️ Paused / ❌ Dropped')}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
              />
            )}
          </div>
        )}

            {/* Currently In-Progress & Top Rated Showcase at Main Page Bottom */}
            <ShowcaseSection
              shows={shows}
              onOpenDetails={(s) => setSelectedShow(s)}
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
          <ArrowUp className="w-4 h-4" />
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
        shows={shows}
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
        autoSyncEnabled={autoSyncEnabled}
        onTriggerSync={() => fetchLatestFromSheet(false)}
        accessibilitySettings={accessibilitySettings}
        setAccessibilitySettings={setAccessibilitySettings}
        onOpenDashboard={() => setShowStatsModal(true)}
      />

      <main className={`flex-1 pb-16 ${!isAnyFilterActive && !showStatsModal ? 'pt-0' : 'pt-16'}`}>
        {renderMainContent()}
      </main>


      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#101010] py-8 pb-28 sm:pb-8 text-zinc-500 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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
          key={`${selectedShow.id}-${selectedShow.rowNumber || 0}`}
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
        />
      )}

      {showAddModal && (
        <AddShowModal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddShow}
          sheetConnected={Boolean(spreadsheetId)}
          defaultViewer=""
          sheetPlatforms={availablePlatforms.map((p) => p.raw)}
          sheetViewers={availableViewers}
          sheetGenres={availableGenres}
          masterSheetName={sheetName}
          wishlistSheetName={wishlistSheetName}
        />
      )}

      {showSyncModal && (
        <SheetSyncModal
          isOpen={true}
          onClose={() => setShowSyncModal(false)}
          user={user}
          onSignIn={handleSignIn}
          spreadsheetId={spreadsheetId}
          sheetName={sheetName}
          wishlistSheetName={wishlistSheetName}
          availableTabs={availableTabs}
          onConnect={handleConnectSheets}
          onDisconnect={handleDisconnectSheets}
          isLoading={isSyncing}
          lastSyncedAt={lastSyncedAt}
          sheetTitle={sheetTitle}
          rowCount={shows.length}
          autoSyncEnabled={autoSyncEnabled}
          onToggleAutoSync={handleToggleAutoSync}
          onTriggerSync={() => fetchLatestFromSheet(false)}
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
      {hoveredShow && hoveredRect && (
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
          onOpenDetails={(s) => {
            setHoveredShowId(null);
            setHoveredRect(null);
            setSelectedShow(s);
          }}
          onIncrementEpisode={(s) => {
            handleIncrementEpisode(s);
          }}
          onToggleStatus={(s) => {
            handleToggleStatus(s);
          }}
          onUpdateRating={(s, num) => {
            handleUpdateRating(s, num);
          }}
        />
      )}
    </div>
  );
}
