import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Plus, Check, Info, Star, ThumbsUp, Heart, Bell, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';
import { getOrFetchImdbUrl } from '../services/posterService';
import { formatToDDMMYYYY } from '../utils/dateUtils';
import { isNotificationEnabled, toggleShowNotification, isShowOutNow, isFutureRelease, parseReleaseDateToTimestamp } from '../services/notificationService';
import { fetchLiveTvMazeInfo } from '../services/tvMazeService';

interface NetflixHoverPortalProps {
  show: ShowItem;
  rect: { top: number; left: number; width: number; height: number };
  onClose: () => void;
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  onUpdateRating: (show: ShowItem, ratingNum: number) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function NetflixHoverPortal({
  show,
  rect,
  onClose,
  onOpenDetails,
  onIncrementEpisode,
  onToggleStatus,
  onUpdateRating,
  onMouseEnter,
  onMouseLeave,
}: NetflixHoverPortalProps) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isResolvingImdb, setIsResolvingImdb] = useState(false);
  const [isNotifActive, setIsNotifActive] = useState(() => isNotificationEnabled(show.id));

  useEffect(() => {
    setIsNotifActive(isNotificationEnabled(show.id));
  }, [show.id]);

  const [liveAirstamp, setLiveAirstamp] = useState<string | null>(null);
  const [liveEpisodeNote, setLiveEpisodeNote] = useState<string | null>(null);

  useEffect(() => {
    if (show.releaseDate) {
      setLiveAirstamp(null);
      setLiveEpisodeNote(null);
      return;
    }

    if (show.type !== 'Series') {
      setLiveAirstamp(null);
      setLiveEpisodeNote(null);
      return;
    }

    let isMounted = true;
    fetchLiveTvMazeInfo(show.title).then((info) => {
      if (isMounted && info && info.nextEpisode) {
        setLiveAirstamp(info.nextEpisode.airstamp);
        setLiveEpisodeNote(`S${info.nextEpisode.season} E${info.nextEpisode.number}: ${info.nextEpisode.name}`);
      }
    }).catch((err) => console.warn('Hover TVMaze fetch failed:', err));

    return () => {
      isMounted = false;
    };
  }, [show.id, show.title, show.releaseDate]);

  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const targetSource = show.releaseDate 
      ? parseReleaseDateToTimestamp(show.releaseDate) 
      : liveAirstamp 
        ? new Date(liveAirstamp).getTime() 
        : null;

    if (!targetSource) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const now = Date.now();
      const diff = targetSource - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const d = Math.floor(diff / (24 * 60 * 60 * 1000));
      const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      const s = Math.floor((diff % (60 * 1000)) / 1000);

      setTimeLeft({ d, h, m, s });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [show.releaseDate, liveAirstamp]);

  const handleToggleNotif = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const enabled = await toggleShowNotification(show);
    setIsNotifActive(enabled);
  };

  const handleOpenImdb = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (show.imdbId && show.imdbId.startsWith('tt')) {
      window.open(`https://www.imdb.com/title/${show.imdbId}/`, '_blank', 'noopener,noreferrer');
      return;
    }

    setIsResolvingImdb(true);
    try {
      const url = await getOrFetchImdbUrl(show.title, show.imdbId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setIsResolvingImdb(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cardContentRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  // Mark mounted for transition start and listen for tap outside (critical for mobile/tablet dismiss)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (isMobile) {
        if (cardContentRef.current && !cardContentRef.current.contains(e.target as Node)) {
          onClose();
        }
      } else {
        if (portalRef.current && !portalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [onClose, isMobile]);



  // Safe scale factor based on screen size (subtle 1.2x scale on mobile, full cinematic 1.45x on desktop)
  const scaleFactor = useMemo(() => {
    return isMobile ? 1.2 : 1.45;
  }, [isMobile]);

  // Premium viewport boundary auto-fit math (prevents any visual card bleeding offscreen)
  const placement = useMemo(() => {
    const width = rect.width;
    const height = rect.height;

    // The scale extends the boundaries outward from center
    const expandedWidth = width * scaleFactor;
    const expandedHeight = height * scaleFactor;

    const bleedX = (expandedWidth - width) / 2;
    const bleedY = (expandedHeight - height) / 2;

    const visualLeft = rect.left - bleedX;
    const visualTop = rect.top - bleedY;
    const visualRight = visualLeft + expandedWidth;
    const visualBottom = visualTop + expandedHeight;

    const padding = 10; // 10px safe margin from viewport edge
    let shiftX = 0;
    let shiftY = 0;

    if (typeof window !== 'undefined') {
      // Correct horizontal bleed
      if (visualLeft < padding) {
        shiftX = padding - visualLeft;
      } else if (visualRight > window.innerWidth - padding) {
        shiftX = (window.innerWidth - padding) - visualRight;
      }

      // Correct vertical bleed
      if (visualTop < padding) {
        shiftY = padding - visualTop;
      } else if (visualBottom > window.innerHeight - padding) {
        shiftY = (window.innerHeight - padding) - visualBottom;
      }
    }

    return {
      top: rect.top + window.scrollY + shiftY,
      left: rect.left + window.scrollX + shiftX,
      width,
      height,
    };
  }, [rect, scaleFactor]);

  const formatS = (s: string | number) => {
    const str = String(s).trim();
    if (!str) return 'S1';
    if (/^\d+$/.test(str)) return `S${str}`;
    if (/^[sS]\d+/.test(str)) return `S${str.slice(1)}`;
    return str.startsWith('S') || str.startsWith('s') ? str.toUpperCase() : `S${str}`;
  };

  const formatE = (e: string | number) => {
    const str = String(e).trim();
    if (!str) return 'E1';
    if (/^\d+$/.test(str)) return `E${str}`;
    if (/^[eE]\d+/.test(str)) return `E${str.slice(1)}`;
    return str.startsWith('E') || str.startsWith('e') ? str.toUpperCase() : `E${str}`;
  };

  const currentEpNum = parseInt(show.episodes.replace(/[^0-9]/g, '')) || 1;
  const maxEpNum = parseInt(show.maxEp.replace(/[^0-9]/g, '')) || 8;
  const progress = Math.min(100, Math.round((currentEpNum / maxEpNum) * 100));

  const isWatched = show.status === '✅ Watched';
  const isWatching = show.status === '⏳ Watching';
  const isMovie = show.type === 'Movie';

  // Calculate high match score dynamically based on title characters & ratings for realism
  const matchScore = useMemo(() => {
    const code = show.title.charCodeAt(0) || 75;
    const ratingBonus = show.ratingNum ? show.ratingNum * 3 : 10;
    return 84 + (code % 11) + ratingBonus;
  }, [show.title, show.ratingNum]);

  // Video quality dynamic resolution based on year/genre for high fidelity
  const qualityBadge = useMemo(() => {
    const yr = parseInt(String(show.year)) || 2024;
    if (yr >= 2021) return '4K Ultra HD';
    if (yr >= 2016) return 'HDR';
    return 'HD';
  }, [show.year]);

  // Suggested age rating based on genre tags
  const ageRating = useMemo(() => {
    const g = show.genre.toLowerCase();
    if (g.includes('action') || g.includes('thriller') || g.includes('crime') || g.includes('horror')) return 'TV-MA';
    if (g.includes('drama') || g.includes('romance') || g.includes('comedy')) return 'TV-14';
    return 'PG';
  }, [show.genre]);

  const containerStyle = useMemo(() => {
    if (isMobile) {
      return {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      };
    }
    return {
      position: 'absolute' as const,
      top: placement.top,
      left: placement.left,
      width: placement.width,
      height: placement.height,
      zIndex: 99999,
      transformOrigin: 'center center',
    };
  }, [isMobile, placement]);

  return createPortal(
    <div
      ref={portalRef}
      style={containerStyle}
      onMouseEnter={isMobile ? undefined : onMouseEnter}
      onMouseLeave={isMobile ? undefined : onMouseLeave}
      className="pointer-events-auto selection:bg-[#E50914] selection:text-white netflix-hover-portal-active relative"
    >
      {/* Cinematic Ambient Glow */}
      {!isMobile && (
        <div 
          className="absolute inset-[-30px] z-[-1] opacity-[0.38] blur-[35px] saturate-150 pointer-events-none transition-all duration-300 select-none rounded-xl"
          style={{
            backgroundImage: `url(${getOptimizedPoster(show.backdropUrl || show.posterUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <motion.div
        ref={cardContentRef}
        initial={isMobile ? { scale: 0.9, opacity: 0 } : { scale: 1, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        animate={isMobile ? { scale: 1, opacity: 1 } : {
          scale: scaleFactor,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 25px 4px rgba(0, 0, 0, 0.4)',
        }}
        exit={isMobile ? { scale: 0.9, opacity: 0 } : { scale: 1, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className={isMobile 
          ? "w-full max-w-[340px] bg-[#181818] rounded-2xl overflow-hidden border border-zinc-800 flex flex-col pointer-events-auto shadow-2xl relative" 
          : "w-full bg-[#181818] rounded-xl overflow-hidden border border-zinc-800 flex flex-col pointer-events-auto"
        }
      >
        {/* Cinematic Media Header */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
          <img
            src={getOptimizedPoster(show.backdropUrl || show.posterUrl)}
            alt={show.title}
            className="w-full h-full object-cover object-center filter brightness-95 transform scale-100 animate-kenburns"
            style={{
              animation: 'kenburns-pan-zoom 15s ease-out infinite alternate',
              imageRendering: 'auto',
            }}
          />
          
          {/* Dynamic Scrim & Gradient (Strict ContrastAA Scrim) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/30 to-transparent pointer-events-none" />

          {/* Floating Action Brand Overlay */}
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between z-20 pointer-events-auto">
            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/75 text-zinc-200 backdrop-blur-sm border border-zinc-700/50 shadow-md">
                  {show.platform}
                </span>
                {show.isWishlist && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-black border border-amber-400 shadow-md shrink-0">
                    🎁 Wishlist
                  </span>
                )}
              </div>
              {(show.releaseDate || liveAirstamp) && (
                isShowOutNow(show) ? (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-black border border-emerald-400 shadow-md shrink-0 flex items-center gap-1 animate-pulse">
                    🎉 OUT NOW!
                  </span>
                ) : (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-black border border-amber-300 shadow-md shrink-0 flex items-center gap-0.5">
                    ⏰ {show.releaseDate ? formatToDDMMYYYY(show.releaseDate) : liveAirstamp ? new Date(liveAirstamp).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenImdb}
                disabled={isResolvingImdb}
                className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 active:scale-95 text-black shadow-lg transition-all hover:scale-105 cursor-pointer border border-amber-300/80 disabled:opacity-60"
                title="Open Official IMDb Title Page"
              >
                {isResolvingImdb ? '...' : 'IMDb ↗'}
              </button>
              <span className="hidden sm:block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-700 shadow-md">
                {show.genre.split('/')[0].trim()}
              </span>
            </div>
          </div>

          {/* Close button on mobile top-right */}
          {isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-zinc-700/50 backdrop-blur-sm text-zinc-300 flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer z-50 pointer-events-auto"
              aria-label="Close"
            >
              <span className="text-sm font-bold leading-none">✕</span>
            </button>
          )}

          {/* Floating Quick Title */}
          <div className="absolute bottom-3 left-3 right-3">
            <h4 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight max-w-full truncate shadow-md">
              {show.title}
            </h4>
          </div>
        </div>

        {/* Dynamic Series Progress Bar */}
        {!isMovie && isWatching && (
          <div className="w-full h-1.5 bg-zinc-800">
            <div
              className="h-full bg-[#E50914] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {isWatched && <div className="w-full h-1.5 bg-emerald-500" />}

        {/* Premium Expanded Metadata & Interactive Controls Panel */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 bg-[#181818]">
          {/* Primary Action Buttons Row */}
          <div className="flex items-center gap-2 w-full">
            {!isMovie && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrementEpisode(show);
                }}
                className="flex items-center justify-center gap-1.5 bg-white hover:bg-zinc-200 text-black font-black text-xs sm:text-sm px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full transition-all active:scale-95 shadow-md hover:scale-105 cursor-pointer shrink-0"
                title={`Next Episode: Ep ${currentEpNum + 1}`}
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                <span>Play Ep {currentEpNum}</span>
              </button>
            )}

            {/* Quick Watchlist Status Circle Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(show);
              }}
              className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full border flex items-center justify-center transition-all hover:scale-110 cursor-pointer shrink-0 ${
                isWatched
                  ? 'bg-emerald-600/90 border-emerald-500 text-white hover:bg-emerald-500'
                  : 'bg-zinc-800/90 hover:bg-zinc-700 border-zinc-600 hover:border-zinc-400 text-white'
              }`}
              title={isWatched ? 'Mark as Watching' : 'Mark as Completed'}
            >
              {isWatched ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Notification Alert Toggle (for upcoming releases) */}
            {isFutureRelease(show) && (
              <button
                type="button"
                onClick={handleToggleNotif}
                className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full border flex items-center justify-center transition-all hover:scale-110 cursor-pointer shrink-0 ${
                  isNotifActive
                    ? 'bg-amber-400 text-black border-amber-300 shadow-lg'
                    : 'bg-zinc-800/90 hover:bg-zinc-700 border-zinc-600 hover:border-zinc-400 text-zinc-300'
                }`}
                title={isNotifActive ? '24h Release Alert Active (Click to disable)' : 'Notify me 24 hours before release'}
              >
                {isNotifActive ? (
                  <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current animate-pulse" />
                ) : (
                  <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>
            )}

            {/* Expand Details Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(show);
                onClose();
              }}
              className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-400 text-white flex items-center justify-center ml-auto transition-all hover:scale-110 cursor-pointer shrink-0"
              title="More Info Details"
            >
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Unboxed Micro-Metadata Items (Genre, Year, Series/Movie) */}
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-semibold text-zinc-300 leading-none">
            <span className="text-zinc-100 font-bold truncate max-w-[120px] sm:max-w-none" title={show.genre}>
              {show.genre.split('/')[0].trim()}
            </span>
            <span aria-hidden="true" className="text-zinc-600">•</span>
            <span className="text-zinc-300 font-semibold">{show.year}</span>
            <span aria-hidden="true" className="text-zinc-600">•</span>
            <span className="text-zinc-300 font-semibold">
              {isMovie ? 'Movie' : `${formatS(show.seasons)} • ${formatE(show.episodes)}`}
            </span>
          </div>

          {/* Viewer Profile Name Indicator */}
          {show.who && (
            <div className="text-xs sm:text-sm text-zinc-300 font-medium">
              Watching with: <span className="text-amber-400 font-extrabold">{show.who}</span>
            </div>
          )}

          {/* Release Premiere Info Bar */}
          {(show.releaseDate || show.releaseNote || liveAirstamp || liveEpisodeNote) && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/25 shadow-sm text-xs text-amber-300 font-bold">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-black">
                  <span>⏰</span>
                  <span>Target Premiere</span>
                </span>
                {(show.releaseDate || liveAirstamp) && (
                  <span className="text-zinc-400 font-medium font-mono text-[10px]">
                    {show.releaseDate 
                      ? formatToDDMMYYYY(show.releaseDate) 
                      : liveAirstamp 
                        ? new Date(liveAirstamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) 
                        : ''}
                  </span>
                )}
              </div>

              {/* Ticking Countdown! */}
              {timeLeft ? (
                <div className="space-y-1 pt-1.5 border-t border-amber-500/10">
                  <div className="flex items-center gap-1 font-mono text-amber-400 font-black text-sm">
                    <span className="text-zinc-500 font-sans text-[10px] uppercase font-bold tracking-wider mr-1.5">Starts In:</span>
                    <span>{timeLeft.d}d</span>
                    <span className="text-zinc-600 font-sans font-normal mx-0.5">:</span>
                    <span>{timeLeft.h}h</span>
                    <span className="text-zinc-600 font-sans font-normal mx-0.5">:</span>
                    <span>{timeLeft.m}m</span>
                    <span className="text-zinc-600 font-sans font-normal mx-0.5">:</span>
                    <span className="animate-pulse">{timeLeft.s}s</span>
                  </div>
                  {(show.releaseNote || liveEpisodeNote) && (
                    <p className="text-[10px] text-zinc-400 font-medium line-clamp-1 italic">
                      Note: {show.releaseNote || liveEpisodeNote}
                    </p>
                  )}
                </div>
              ) : isShowOutNow(show) ? (
                <div className="text-emerald-400 font-black animate-pulse flex items-center gap-1 pt-1 border-t border-amber-500/10">
                  <span>🎉 OUT NOW! WATCH NOW!</span>
                </div>
              ) : (
                <div className="text-zinc-400 font-medium pt-1 border-t border-amber-500/10">
                  {show.releaseNote || liveEpisodeNote || 'Airing soon'}
                </div>
              )}
            </div>
          )}

          {/* Synopsis Snippet (Beautifully truncated) */}
          {show.synopsis ? (
            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal line-clamp-3">
              {show.synopsis}
            </p>
          ) : show.notes ? (
            <p className="text-xs sm:text-sm text-zinc-200 italic leading-relaxed font-normal line-clamp-3">
              "{show.notes}"
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-zinc-400 italic leading-relaxed font-normal">
              No overview synopsis has been entered. Custom details may be added directly to your Google Sheet or within the detail panel.
            </p>
          )}

          {/* Dedicated Star Rating Row at the very bottom */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-zinc-800/30 px-3 py-1.5 rounded-full border border-zinc-700/30 backdrop-blur-sm shadow-inner" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => {
                return (
                  <motion.button
                    key={star}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateRating(show, star);
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-0.5 cursor-pointer"
                    title={`Rate ${star} Stars`}
                  >
                    <motion.div
                      animate={{ scale: (hoverRating || show.ratingNum || 0) >= star ? [1, 1.2, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Star
                        className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors ${
                          (hoverRating || show.ratingNum || 0) >= star
                            ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_2px_rgba(245,158,11,0.6)]'
                            : 'text-zinc-600 hover:text-zinc-300'
                        }`}
                      />
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
