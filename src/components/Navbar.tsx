import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Table,
  LogOut,
  Tv,
  Film,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Zap,
  Calendar,
  Layers,
  Check,
  Accessibility,
  BarChart3,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { ShowItem, PRESET_PLATFORMS, AccessibilitySettings } from '../types';
import { normalizePlatform } from '../services/sheetsService';

interface NavbarProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenSync: () => void;
  onOpenAdd: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: string;
  onSelectFilter: (f: string) => void;
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
  sheetConnected: boolean;
  sheetTitle?: string;
  shows: ShowItem[];
  isSyncing?: boolean;
  lastSyncedAt?: string;
  autoSyncEnabled?: boolean;
  onTriggerSync?: () => void;
  accessibilitySettings: AccessibilitySettings;
  setAccessibilitySettings: (settings: AccessibilitySettings) => void;
  onOpenDashboard?: () => void;
}

export default function Navbar({
  user,
  onSignIn,
  onSignOut,
  onOpenSync,
  onOpenAdd,
  searchQuery,
  onSearchChange,
  activeFilter,
  onSelectFilter,
  selectedPlatform,
  onSelectPlatform,
  sheetConnected,
  sheetTitle,
  shows,
  isSyncing,
  lastSyncedAt,
  autoSyncEnabled = true,
  onTriggerSync,
  accessibilitySettings,
  setAccessibilitySettings,
  onOpenDashboard,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(Boolean(searchQuery));
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAccMenu, setShowAccMenu] = useState(false);

  // Desktop Dropdown States
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);

  const platformDropdownRef = useRef<HTMLDivElement>(null);
  const platformTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const accDropdownRef = useRef<HTMLDivElement>(null);
  const mobileAccDropdownRef = useRef<HTMLDivElement>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchMouseEnter = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setShowSearch(true);
  };

  const handleSearchMouseLeave = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (!searchQuery.trim()) {
        searchInputRef.current?.blur();
        setShowSearch(false);
      }
    }, 150);
  };

  const handlePlatformMouseEnter = () => {
    if (platformTimeoutRef.current) {
      clearTimeout(platformTimeoutRef.current);
      platformTimeoutRef.current = null;
    }
    setShowPlatformMenu(true);
  };

  const handlePlatformMouseLeave = () => {
    if (platformTimeoutRef.current) {
      clearTimeout(platformTimeoutRef.current);
    }
    platformTimeoutRef.current = setTimeout(() => {
      setShowPlatformMenu(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (platformTimeoutRef.current) {
        clearTimeout(platformTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (searchQuery) {
      setShowSearch(true);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        platformDropdownRef.current &&
        !platformDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPlatformMenu(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
      if (
        accDropdownRef.current &&
        !accDropdownRef.current.contains(event.target as Node) &&
        mobileAccDropdownRef.current &&
        !mobileAccDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAccMenu(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node) &&
        !searchQuery.trim()
      ) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const watchingCount = shows.filter(
    (s) =>
      !s.isWishlist &&
      (s.status === '⏳ Watching' ||
        String(s.status).toLowerCase().includes('watching') ||
        String(s.status).toLowerCase().includes('in progress'))
  ).length;
  const watchedCount = shows.filter(
    (s) =>
      !s.isWishlist &&
      (s.status === '✅ Watched' ||
        String(s.status).toLowerCase().includes('watched') ||
        String(s.status).toLowerCase().includes('done') ||
        String(s.status).toLowerCase().includes('finished'))
  ).length;
  const wishlistCount = shows.filter(
    (s) =>
      Boolean(s.isWishlist) ||
      s.status === ('🎁 Wishlist' as any) ||
      String(s.status).toLowerCase().includes('wishlist')
  ).length;

  // Exact user preset platforms
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

  const isTransparent =
    !scrolled &&
    activeFilter === 'all' &&
    selectedPlatform === 'all' &&
    !searchQuery.trim() &&
    !isMobileMenuOpen;

  const handleMobileNavClick = (filter: string) => {
    onSelectFilter(filter);
    setIsMobileMenuOpen(false);
  };

  const handleMobilePlatformClick = (plat: string) => {
    onSelectPlatform(plat);
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
        isTransparent
          ? 'bg-gradient-to-b from-black/90 via-black/60 to-transparent'
          : 'bg-[#141414]/98 backdrop-blur-md shadow-xl border-b border-[#262626]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Desktop Navigation */}
        <div className="flex items-center gap-4 xl:gap-6 min-w-0">
          <button
            id="brand-logo-btn"
            onClick={() => {
              onSelectFilter('all');
              onSelectPlatform('all');
              onSearchChange('');
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none shrink-0"
          >
            <div className="w-9 h-9 rounded bg-[#E50914] flex items-center justify-center font-black text-white text-xl tracking-tighter shadow-lg shadow-red-900/30 group-hover:scale-105 transition-transform">
              N
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg xl:text-xl tracking-wider text-white uppercase flex items-center gap-1.5">
                SHOW<span className="text-[#E50914]">FLIX</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-tight -mt-1 hidden sm:inline">
                Personal Streaming Tracker
              </span>
            </div>
          </button>

          {/* DESKTOP Navigation Links (xl: >= 1280px) */}
          {sheetConnected && (
            <nav className="hidden xl:flex items-center gap-1 text-sm font-medium shrink-0">
            {/* ALL PLATFORMS DROPDOWN MENU */}
            <div
              className="relative"
              ref={platformDropdownRef}
              onMouseEnter={handlePlatformMouseEnter}
              onMouseLeave={handlePlatformMouseLeave}
            >
              <button
                id="nav-platforms-dropdown-btn"
                onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedPlatform !== 'all'
                    ? 'text-white font-semibold bg-red-600/20 border border-red-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Filter by streaming platform"
              >
                <Layers className="w-3.5 h-3.5 text-red-400" />
                <span>
                  {selectedPlatform !== 'all' ? selectedPlatform : 'Platforms'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPlatformMenu ? 'rotate-180' : ''}`} />
              </button>

              {showPlatformMenu && (
                <div
                  id="navbar-platforms-menu"
                  className="absolute left-0 mt-1 w-60 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl py-2 text-xs z-50 animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3"
                >
                  <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">All Streaming Platforms</span>
                    <span className="text-[10px] text-zinc-500">{availablePlatforms.length} platforms</span>
                  </div>

                  <button
                    onClick={() => {
                      onSelectPlatform('all');
                      onSelectFilter('All Titles');
                      setShowPlatformMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                      selectedPlatform === 'all' && activeFilter === 'All Titles'
                        ? 'bg-red-600 text-white font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>All Platforms (Show All Titles)</span>
                    {selectedPlatform === 'all' && activeFilter === 'All Titles' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="my-1 border-t border-zinc-800" />

                  {availablePlatforms.map((p) => {
                    const isSelected = selectedPlatform === p.raw;
                    return (
                      <button
                        key={p.raw}
                        onClick={() => {
                          onSelectPlatform(p.raw);
                          setShowPlatformMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-red-600/30 text-red-200 font-semibold border-l-2 border-red-500'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        <span className="truncate">{p.raw}</span>
                        <div className="flex items-center gap-1.5">
                          {p.count > 0 && (
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                              {p.count}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              id="nav-series"
              onClick={() => onSelectFilter('Series')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === 'Series'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Series
            </button>
            <button
              id="nav-movies"
              onClick={() => onSelectFilter('Movie')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === 'Movie'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Movies
            </button>
            <button
              id="nav-watching"
              onClick={() => onSelectFilter('⏳ Watching')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === '⏳ Watching'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Watching</span>
              {watchingCount > 0 && (
                <span className="text-[11px] bg-red-600/40 text-red-200 font-bold px-1.5 py-0.2 rounded border border-red-500/30">
                  {watchingCount}
                </span>
              )}
            </button>
            <button
              id="nav-watched"
              onClick={() => onSelectFilter('✅ Watched')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === '✅ Watched'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Watched</span>
              {watchedCount > 0 && (
                <span className="text-[11px] bg-emerald-950 text-emerald-400 font-bold px-1.5 py-0.2 rounded border border-emerald-800/40">
                  {watchedCount}
                </span>
              )}
            </button>
            <button
              id="nav-wishlist"
              onClick={() => onSelectFilter('🎁 Wishlist')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                  ? 'text-white font-semibold bg-amber-500/20 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>🎁 Wishlist</span>
              {wishlistCount > 0 && (
                <span className="text-[11px] bg-amber-950 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-700/50">
                  {wishlistCount}
                </span>
              )}
            </button>
          </nav>
        )}
      </div>

        {/* Right Tools (Search, Google Sheets Sync, Add Show, Profile / Mobile Toggle) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Search Toggle / Input */}
          {sheetConnected && (
            <div
              ref={searchContainerRef}
              className="relative flex items-center"
              onMouseEnter={handleSearchMouseEnter}
              onMouseLeave={handleSearchMouseLeave}
            >
              {showSearch ? (
                <div className="flex items-center bg-[#202020] border border-zinc-700 rounded-full px-3 py-1.5 transition-all w-48 sm:w-60 shadow-lg">
                  <Search className="w-3.5 h-3.5 text-red-500 mr-1.5 shrink-0" />
                  <input
                    ref={searchInputRef}
                    id="navbar-search-input"
                    type="text"
                    placeholder="Search titles, genres..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    autoFocus
                    onBlur={() => {
                      if (!searchQuery.trim()) setShowSearch(false);
                    }}
                    className="bg-transparent text-base text-white focus:outline-none w-full placeholder:text-zinc-500"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSearchChange('');
                        setShowSearch(false);
                      }}
                      className="p-0.5 hover:text-white text-zinc-400 shrink-0 ml-1 rounded-full hover:bg-zinc-700 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSearch(false)}
                      className="p-0.5 hover:text-white text-zinc-500 shrink-0 ml-1 rounded-full hover:bg-zinc-700 cursor-pointer"
                      title="Close search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  id="navbar-search-toggle"
                  onClick={() => setShowSearch(true)}
                  onMouseEnter={handleSearchMouseEnter}
                  className="p-2 text-zinc-300 hover:text-white transition-colors rounded-full hover:bg-white/10 cursor-pointer"
                  title="Search shows"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* DESKTOP-ONLY BUTTONS (xl: >= 1280px) */}
          <div className="hidden xl:flex items-center gap-2.5 2xl:gap-3">
            {/* Google Sheets Auto-Sync Indicator & Button */}
            {sheetConnected && (
              <button
                id="open-sheets-sync-btn"
                onClick={onOpenSync}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-all whitespace-nowrap cursor-pointer shrink-0 bg-emerald-950/70 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/60 shadow-sm shadow-emerald-950/40"
                title={`Auto-Sync Connected: ${sheetTitle || 'Google Sheet'} (${lastSyncedAt ? `Last synced: ${lastSyncedAt}` : 'Active'})`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-emerald-400 shrink-0 ${
                    isSyncing ? 'animate-spin text-amber-400' : ''
                  }`}
                />
                <span className="font-semibold text-emerald-300">Auto-Synced</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </button>
            )}

            {/* Add Title Button */}
            {sheetConnected && shows.length > 0 && (
              <button
                id="nav-add-title-btn"
                onClick={onOpenAdd}
                className="flex items-center gap-1 bg-[#E50914] hover:bg-[#B80710] text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-md shadow-red-900/40 whitespace-nowrap cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add Show</span>
              </button>
            )}

            {/* Accessibility Menu */}
            <div className="relative shrink-0" ref={accDropdownRef}>
              <button
                id="acc-settings-btn"
                onClick={() => setShowAccMenu(!showAccMenu)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors cursor-pointer ${
                  accessibilitySettings.contrastMode === 'high'
                    ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border-zinc-700'
                }`}
                title="Accessibility: Title, Remove, Replace Settings"
                aria-label="Accessibility Settings"
              >
                <Accessibility className="w-4 h-4" />
              </button>

              {showAccMenu && (
                <div
                  id="acc-dropdown-menu"
                  className="absolute right-0 mt-2 w-72 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl py-2.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-zinc-800"
                >
                  <div className="px-3 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Accessibility className="w-4 h-4 text-zinc-300" />
                      <p className="text-white font-medium">Inclusive Communication</p>
                    </div>
                  </div>

                  {/* 1. Color Contrast (WCAG & Gov.uk standard) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-300 font-medium">Color Contrast</label>
                      <span className="text-[10px] text-zinc-400">
                        {accessibilitySettings.contrastMode === 'high' ? 'High Contrast' : 'Default'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'default' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'default'
                            ? 'bg-[#E50914] text-white border-red-500 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        Default Dark
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'high' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'high'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        High Contrast
                      </button>
                    </div>
                  </div>


                  {/* 2. Clear Print / Large Print (16pt+ gov.uk recommendation) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Large / Clear Print</label>
                        <span className="text-[10px] text-zinc-400">16pt+ min for sight loss</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            textSize: accessibilitySettings.textSize === 'large' ? 'standard' : 'large',
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.textSize === 'large'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.textSize === 'large' ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 3. Dyslexia-friendly Clear Font */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Dyslexia-Friendly Text</label>
                        <span className="text-[10px] text-zinc-400">Clear sans font & loose tracking</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            dyslexiaFont: !accessibilitySettings.dyslexiaFont,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.dyslexiaFont
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.dyslexiaFont ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 4. Reduced Motion */}
                  <div className="px-3 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Reduce Motion</label>
                        <span className="text-[10px] text-zinc-400">Disable transitions & shakes</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            reduceMotion: !accessibilitySettings.reduceMotion,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.reduceMotion
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.reduceMotion ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Auth / User Menu */}
            {user ? (
              <div className="relative shrink-0" ref={userDropdownRef}>
                <button
                  id="user-profile-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-red-600"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-sm flex items-center justify-center">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>

                {showUserMenu && (
                  <div
                    id="user-dropdown-menu"
                    className="absolute right-0 mt-2 w-64 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl py-2 text-sm z-50 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="px-3 py-2 border-b border-zinc-800">
                      <p className="text-white font-medium truncate">{user.displayName || 'Account'}</p>
                      <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>Google Sheets Auto-Sync Enabled</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSync();
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-emerald-400" />
                        <span>Google Sheets Sync</span>
                      </div>
                      {lastSyncedAt && (
                        <span className="text-[10px] text-zinc-400">{lastSyncedAt}</span>
                      )}
                    </button>
                    <button
                      id="user-profile-stats-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onOpenDashboard) onOpenDashboard();
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-red-500" />
                        <span>Stats & Analytics</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                    <div className="my-1 border-t border-zinc-800" />
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                      className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : sheetConnected ? (
              <button
                id="google-signin-btn"
                onClick={onSignIn}
                className="flex items-center gap-2 bg-white text-zinc-900 hover:bg-zinc-100 text-xs font-semibold px-3 py-1.5 rounded transition-all shadow-sm cursor-pointer shrink-0"
                title="Sign in with Google once to auto-sync your sheets"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
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
                <span>Sign In</span>
              </button>
            ) : null}
          </div>

          {/* MOBILE & TABLET (< xl): Quick Accessibility + Quick Add + Hamburger Toggle */}
          <div className="flex xl:hidden items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Accessibility Menu for Mobile / Tablet */}
            <div className="relative shrink-0" ref={mobileAccDropdownRef}>
              <button
                id="mobile-acc-settings-btn"
                type="button"
                onClick={() => setShowAccMenu(!showAccMenu)}
                className={`p-2 rounded-md transition-colors border cursor-pointer ${
                  accessibilitySettings.contrastMode === 'high'
                    ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                    : 'bg-zinc-900/90 text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800'
                }`}
                title="Accessibility & Inclusive Communication"
                aria-label="Accessibility & Inclusive Communication"
              >
                <Accessibility className="w-4 h-4" />
              </button>

              {showAccMenu && (
                <div
                  id="mobile-acc-dropdown-menu"
                  className="absolute right-0 mt-2 w-[calc(100vw-2.5rem)] max-w-xs sm:w-72 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl py-2.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-zinc-800"
                >
                  <div className="px-3 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Accessibility className="w-4 h-4 text-zinc-300" />
                      <p className="text-white font-medium">Inclusive Communication</p>
                    </div>
                  </div>

                  {/* 1. Color Contrast (WCAG & Gov.uk standard) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-300 font-medium">Color Contrast</label>
                      <span className="text-[10px] text-zinc-400">
                        {accessibilitySettings.contrastMode === 'high' ? 'High Contrast' : 'Default'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'default' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'default'
                            ? 'bg-[#E50914] text-white border-red-500 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        Default Dark
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'high' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'high'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        High Contrast
                      </button>
                    </div>
                  </div>


                  {/* 2. Clear Print / Large Print (16pt+ gov.uk recommendation) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Large / Clear Print</label>
                        <span className="text-[10px] text-zinc-400">16pt+ min for sight loss</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            textSize: accessibilitySettings.textSize === 'large' ? 'standard' : 'large',
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.textSize === 'large'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.textSize === 'large' ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 3. Dyslexia-friendly Clear Font */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Dyslexia-Friendly Text</label>
                        <span className="text-[10px] text-zinc-400">Clear sans font & loose tracking</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            dyslexiaFont: !accessibilitySettings.dyslexiaFont,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.dyslexiaFont
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.dyslexiaFont ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 4. Reduced Motion */}
                  <div className="px-3 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Reduce Motion</label>
                        <span className="text-[10px] text-zinc-400">Disable transitions & shakes</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            reduceMotion: !accessibilitySettings.reduceMotion,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.reduceMotion
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.reduceMotion ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {sheetConnected && shows.length > 0 && (
              <button
                id="mobile-quick-add-btn"
                onClick={onOpenAdd}
                className="flex items-center gap-1 bg-[#E50914] hover:bg-[#B80710] text-white text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors shadow-md shadow-red-900/30 cursor-pointer"
                title="Add Show"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Show</span>
              </button>
            )}

            {/* Hamburger Button for Mobile & Tablet */}
            {sheetConnected && (
              <button
                id="mobile-menu-toggle-btn"
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-2 rounded-md transition-colors border ${
                  isMobileMenuOpen
                    ? 'bg-zinc-800 text-white border-red-500'
                    : 'bg-zinc-900/90 text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800'
                }`}
                aria-label="Toggle navigation menu"
                title="Menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : (
                  <div className="relative">
                    <Menu className="w-5 h-5" />
                    {sheetConnected && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE & TABLET EXPANDED DROPDOWN MENU */}
      {isMobileMenuOpen && (
        <div
          id="mobile-dropdown-panel"
          className="xl:hidden bg-[#141414]/98 border-b border-zinc-800 backdrop-blur-xl shadow-2xl px-4 py-4 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200"
        >
          {/* 1. Category Navigation Links */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2">
              Browse Categories
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 pt-1">
              <button
                id="mobile-dropdown-home"
                onClick={() => {
                  onSelectPlatform('all');
                  handleMobileNavClick('all');
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  activeFilter === 'all' && selectedPlatform === 'all'
                    ? 'bg-[#E50914] text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>🏠 Home</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                id="mobile-dropdown-series"
                onClick={() => handleMobileNavClick('Series')}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === 'Series'
                    ? 'bg-[#E50914] text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" />
                  <span>Series</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                id="mobile-dropdown-movies"
                onClick={() => handleMobileNavClick('Movie')}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === 'Movie'
                    ? 'bg-[#E50914] text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>Movies</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                id="mobile-dropdown-watching"
                onClick={() => handleMobileNavClick('⏳ Watching')}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === '⏳ Watching'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>⏳ Watching</span>
                {watchingCount > 0 && (
                  <span className="text-[10px] bg-black/40 text-amber-200 font-bold px-1.5 py-0.5 rounded">
                    {watchingCount}
                  </span>
                )}
              </button>

              <button
                id="mobile-dropdown-watched"
                onClick={() => handleMobileNavClick('✅ Watched')}
                className={`col-span-2 md:col-span-4 w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === '✅ Watched'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>✅ Watched</span>
                {watchedCount > 0 && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-700/50">
                    {watchedCount}
                  </span>
                )}
              </button>

              <button
                id="mobile-dropdown-wishlist"
                onClick={() => handleMobileNavClick('🎁 Wishlist')}
                className={`col-span-2 md:col-span-4 w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>🎁 Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="text-[10px] bg-amber-950 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-700/50">
                    {wishlistCount} titles
                  </span>
                )}
              </button>

              <button
                id="mobile-dropdown-stats-btn"
                onClick={() => {
                  if (onOpenDashboard) onOpenDashboard();
                  setIsMobileMenuOpen(false);
                }}
                className="col-span-2 md:col-span-4 w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-red-500/60 shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-red-500" />
                  <span>Stats & Analytics Dashboard</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>

          {/* 2. All Streaming Platforms */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-red-500" />
                Streaming Platforms
              </p>
              {selectedPlatform !== 'all' && (
                <button
                  onClick={() => onSelectPlatform('all')}
                  className="text-[10px] text-red-400 hover:text-red-300 underline"
                >
                  Reset Platform
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => {
                  onSelectPlatform('all');
                  handleMobileNavClick('All Titles');
                }}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedPlatform === 'all' && activeFilter === 'All Titles'
                    ? 'bg-[#E50914] text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                All Platforms (Show All)
              </button>
              {availablePlatforms.map((p) => {
                const isSelected = selectedPlatform === p.raw;
                return (
                  <button
                    key={p.raw}
                    onClick={() => handleMobilePlatformClick(p.raw)}
                    className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white font-bold'
                        : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <span>{p.raw}</span>
                    {p.count > 0 && (
                      <span className="text-[10px] opacity-75 font-mono">({p.count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Actions & Integrations */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2">
              Actions & Tools
            </p>

            <div className="grid grid-cols-1 gap-2">
              {/* Google Sheets Sync Button */}
              <button
                id="mobile-dropdown-sync-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenSync();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium border transition-colors ${
                  sheetConnected
                    ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw
                    className={`w-4 h-4 ${sheetConnected ? 'text-emerald-400' : 'text-zinc-400'} ${
                      isSyncing ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{sheetConnected ? 'Auto-Sync Active' : 'Google Sheets Sync'}</span>
                </div>
                {sheetConnected ? (
                  <span className="flex items-center gap-1 text-[10px] bg-emerald-900/80 text-emerald-200 px-2 py-0.5 rounded font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                    Connect
                  </span>
                )}
              </button>
            </div>
          </div>



          {/* 5. Account / User Sign-in Section */}
          <div className="pt-2 border-t border-zinc-800">
            {user ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/90 border border-zinc-800">
                <div className="flex items-center gap-2 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-red-500 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.displayName || 'Account'}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                  </div>
                </div>

                <button
                  id="mobile-signout-btn"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onSignOut();
                  }}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 px-2.5 py-1.5 rounded transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                id="mobile-signin-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onSignIn();
                }}
                className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 hover:bg-zinc-100 text-xs font-semibold py-2.5 px-3 rounded-md shadow transition-colors"
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
            )}
          </div>
        </div>
      )}
    </header>
  );
}
