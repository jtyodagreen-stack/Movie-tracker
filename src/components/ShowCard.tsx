import { useState, useRef, useEffect } from 'react';
import { Play, Check, Star, ThumbsUp, ChevronDown } from 'lucide-react';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';

interface ShowCardProps {
  show: ShowItem;
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  className?: string;
}

export default function ShowCard({
  show,
  onOpenDetails,
  onIncrementEpisode,
  onToggleStatus,
  className,
}: ShowCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartRef.current.x);
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Quick tap with under 12px motion (so horizontal scrolling through carousels is smooth)
    if (dx < 12 && dy < 12 && dt < 450) {
      const target = e.target as HTMLElement;
      if (target.closest(`#quick-play-${show.id}, #quick-status-${show.id}, #quick-info-${show.id}`)) {
        return;
      }
      e.preventDefault();
      onOpenDetails(show);
    }
  };

  const handleMouseEnter = () => {
    // Only activate hover overlay on devices with real hover/mouse pointer
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(true);
      }, 350); // Premium delay to prevent accidental overlays while scrolling
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`#quick-play-${show.id}, #quick-status-${show.id}, #quick-info-${show.id}`)) {
      return;
    }
    onOpenDetails(show);
  };

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
  const currentSsnNum = parseInt(show.seasons.replace(/[^0-9]/g, '')) || 1;
  const progress = Math.min(100, Math.round((currentEpNum / maxEpNum) * 100));

  const isWatched = show.status === '✅ Watched';
  const isWatching = show.status === '⏳ Watching';
  const isMovie = show.type === 'Movie';

  // Quality label based on show metadata or platform
  const qualityBadge = show.platform.toLowerCase().includes('netflix') || show.platform.toLowerCase().includes('disney') ? '4K Ultra HD' : 'HD';

  return (
    <div
      id={`show-card-${show.id}`}
      role="button"
      className={`group relative cursor-pointer focus:outline-none select-none touch-manipulation active:scale-[0.98] transition-all duration-300 ${
        className || 'flex-shrink-0 w-44 sm:w-56 md:w-64'
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(show);
        }
      }}
    >
      {/* 1. Original / Static Card Layout */}
      <div className="relative aspect-[16/10] w-full rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md group-hover:border-zinc-500 transition-all duration-300">
        <img
          src={getOptimizedPoster(show.backdropUrl || show.posterUrl)}
          alt={show.title}
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 filter brightness-95"
          style={{ imageRendering: 'auto' }}
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
          <div className="flex items-center gap-1 max-w-[130px] truncate">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/75 text-zinc-200 backdrop-blur-sm border border-zinc-700/50 truncate">
              {show.platform}
            </span>
            {show.isWishlist && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-black border border-amber-400 shadow-sm shrink-0">
                🎁 Wishlist
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-700">
            {show.genre.split('/')[0].trim()}
          </span>
        </div>

        {/* Bottom progress lines for simple feedback */}
        {!isMovie && isWatching && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
            <div
              className="h-full bg-[#E50914] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {isWatched && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        )}
      </div>

      {/* Under-Card Metadata */}
      <div className="mt-2 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate">
            {show.title}
          </h3>
          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
            {show.year}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1 font-medium text-[11px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWatched
                  ? 'bg-emerald-500'
                  : isWatching
                  ? 'bg-amber-400'
                  : 'bg-zinc-500'
              }`}
            />
            {show.status.replace(/[^a-zA-Z\s]/g, '').trim()}
          </span>

          <span className="text-[11px] text-zinc-500">
            {show.type === 'Series' ? `${formatS(show.seasons)} • ${formatE(show.episodes)}` : 'Movie'}
          </span>
        </div>
      </div>

      {/* 2. Floating Expanded Netflix Hover Detail Card Overlay */}
      <div
        className={`absolute -top-12 left-1/2 -translate-x-1/2 w-[124%] bg-[#181818] rounded-xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.95)] border border-zinc-700/60 z-50 pointer-events-none transition-all duration-300 ease-out origin-center ${
          isHovered
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-90 translate-y-4 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thumbnail within floating card */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900 border-b border-zinc-800">
          <img
            src={getOptimizedPoster(show.backdropUrl || show.posterUrl)}
            alt={show.title}
            className="w-full h-full object-cover object-center filter brightness-95"
          />
          {/* Brand/Platform Overlay Badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <span className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-red-600 text-white shadow-md">
              {show.platform}
            </span>
          </div>

          <div className="absolute bottom-2 left-2 right-2 text-xs font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate text-white uppercase">
            {show.title}
          </div>
        </div>

        {/* Hover details content panel */}
        <div className="p-4 space-y-3 bg-[#181818]">
          {/* Quick Buttons row */}
          <div className="flex items-center gap-2">
            {/* Play/Episode Plus */}
            <button
              id={`quick-play-${show.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onIncrementEpisode(show);
              }}
              className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
              title={isMovie ? 'Quick watch movie' : `Increment to Ep ${currentEpNum + 1}`}
            >
              <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
            </button>

            {/* Complete Checkbox */}
            <button
              id={`quick-status-${show.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(show);
              }}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg cursor-pointer ${
                isWatched
                  ? 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'
                  : 'bg-zinc-800/90 hover:bg-zinc-700 border-zinc-600 text-white'
              }`}
              title={isWatched ? 'Mark as Watching' : 'Mark as Completed'}
            >
              <Check className="w-4 h-4 font-bold" />
            </button>

            {/* Like Thumbs-up button */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="w-9 h-9 rounded-full bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Like / Love"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            {/* Expand Details Arrow button */}
            <button
              id={`quick-info-${show.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(show);
              }}
              className="w-9 h-9 rounded-full bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 hover:text-white flex items-center justify-center ml-auto transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Full Info Modal"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Stats row */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Rating Match */}
            {show.ratingNum && show.ratingNum > 0 ? (
              <span className="text-emerald-500 font-extrabold flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                {Math.round(show.ratingNum * 20)}% Match
              </span>
            ) : (
              <span className="text-zinc-400 font-bold">New Release</span>
            )}

            {/* Year */}
            <span className="text-zinc-300 font-semibold">{show.year}</span>

            {/* Quality Badge */}
            <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 tracking-wider">
              {qualityBadge}
            </span>
          </div>

          {/* Status Tracker and Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5 font-bold">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isWatched ? 'bg-emerald-500' : isWatching ? 'bg-amber-400' : 'bg-zinc-500'
                  }`}
                />
                {show.status}
              </span>
              <span className="font-mono text-zinc-400 text-[11px]">
                {isMovie ? 'Feature Film' : `${formatS(show.seasons)} • Ep ${currentEpNum}/${maxEpNum}`}
              </span>
            </div>

            {/* Series Progress visual tracker line */}
            {!isMovie && isWatching && (
              <div className="space-y-1">
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-[#E50914] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                  <span>Watched progress</span>
                  <span>{progress}% Completed</span>
                </div>
              </div>
            )}
          </div>

          {/* Bulleted Genres tags list */}
          <div className="text-[11px] text-zinc-400 truncate font-semibold border-t border-zinc-800/80 pt-2 flex items-center gap-1">
            <span className="text-zinc-500 uppercase text-[9px] mr-1">Genres:</span>
            {show.genre.split(/[,/]/).map((g) => g.trim()).join(' • ')}
          </div>
        </div>
      </div>
    </div>
  );
}
