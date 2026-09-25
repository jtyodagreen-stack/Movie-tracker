import { useState, useRef, useEffect } from 'react';
import { Play, Plus, Check, Info, Star, ThumbsUp, ChevronDown } from 'lucide-react';
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
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      // Precise delay like Netflix to confirm user intent and feel premium
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(true);
      }, 350);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
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

  // Parse genres to get standard Netflix dot separator style
  const genresArray = show.genre ? show.genre.split(/[\/,·•|]/).map(g => g.trim()).filter(Boolean) : [];
  const formattedGenres = genresArray.slice(0, 3).join(' • ');

  return (
    <div
      id={`show-card-${show.id}`}
      role="button"
      className={`group relative cursor-pointer focus:outline-none select-none touch-manipulation active:scale-[0.98] transition-all duration-300 ${
        isHovered ? 'z-50' : 'hover-lift-card'
      } ${
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
      {/* Base Card Thumbnail */}
      <div className="relative aspect-[16/10] w-full rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md transition-all group-hover:border-zinc-700">
        <img
          src={getOptimizedPoster(show.backdropUrl || show.posterUrl)}
          alt={show.title}
          loading="lazy"
          className="w-full h-full object-cover object-center transition-transform duration-500 filter brightness-95"
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

        {/* Bottom Progress Bar (Series only) */}
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

      {/* Under-Card Information (Always visible on grid, collapses visually on hover) */}
      <div className="mt-2 space-y-0.5 transition-opacity duration-200 group-hover:opacity-20">
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

      {/* Zoomed-in Netflix Hover Card Popup (Desktop Hover Only) */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-[128%] z-50 bg-[#181818] rounded-xl shadow-[0_24px_50px_rgba(0,0,0,0.95)] border border-zinc-800 overflow-hidden pointer-events-none transition-all duration-300 cubic-bezier(0.25, 0.8, 0.25, 1) opacity-0 scale-90 ${
          isHovered ? 'pointer-events-auto opacity-100 scale-100 -translate-y-[15%] shadow-[0_32px_64px_rgba(0,0,0,1)] z-[100]' : ''
        }`}
        style={{
          transformOrigin: 'center center',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetails(show);
        }}
      >
        {/* Banner/Backdrop Image */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
          <img
            src={getOptimizedPoster(show.backdropUrl || show.posterUrl)}
            alt={show.title}
            className="w-full h-full object-cover object-center filter brightness-95"
            style={{ imageRendering: 'auto' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />
          
          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1 pointer-events-none">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/80 text-zinc-200 border border-zinc-700/50">
              {show.platform}
            </span>
            {show.isWishlist && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-black border border-amber-400 shadow-sm shrink-0">
                🎁 Wishlist
              </span>
            )}
          </div>
        </div>

        {/* Info & Metadata Panel */}
        <div className="p-4 bg-[#181818] flex flex-col gap-3">
          {/* Action Row */}
          <div className="flex items-center gap-2">
            {!isMovie ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrementEpisode(show);
                }}
                className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md cursor-pointer"
                title={`Next Episode: Ep ${currentEpNum + 1}`}
              >
                <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(show);
                }}
                className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md cursor-pointer"
                title={isWatched ? 'Mark as Watching' : 'Mark as Watched'}
              >
                <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(show);
              }}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer ${
                isWatched
                  ? 'bg-emerald-600/95 border-emerald-500 text-white hover:bg-emerald-500'
                  : 'bg-zinc-800/90 hover:bg-zinc-700 border-zinc-600 text-white hover:border-zinc-300'
              }`}
              title={isWatched ? 'Mark as Watching' : 'Mark as Watched'}
            >
              <Check className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(show);
              }}
              className="w-9 h-9 rounded-full bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-300 text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md cursor-pointer"
              title="Like"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(show);
              }}
              className="w-9 h-9 rounded-full bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-300 text-white flex items-center justify-center ml-auto transition-transform hover:scale-105 active:scale-95 shadow-md cursor-pointer"
              title="More Info"
            >
              <ChevronDown className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Title & Metadata */}
          <div>
            <h4 className="text-sm font-bold text-white mb-1 leading-tight line-clamp-1">
              {show.title}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap">
              <span className="font-bold text-emerald-400">
                {show.ratingNum ? `${90 + show.ratingNum * 2}% Match` : '98% Match'}
              </span>
              <span>•</span>
              <span className="text-zinc-300 font-medium">
                {show.year}
              </span>
              <span>•</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {show.type}
              </span>
            </div>
          </div>

          {/* Status & Episode Progress details */}
          <div className="text-[11px] text-zinc-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-300">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isWatched
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : isWatching
                      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                      : 'bg-zinc-500'
                  }`}
                />
                {show.status.replace(/[^a-zA-Z\s]/g, '').trim()}
              </span>
              <span>
                {isMovie ? 'Feature Film' : `${formatS(show.seasons)} • ${formatE(show.episodes)}`}
              </span>
            </div>

            {/* Micro progress-bar */}
            {!isMovie && isWatching && (
              <div className="w-full bg-zinc-800 rounded-full h-1 mt-2 overflow-hidden">
                <div
                  className="bg-[#E50914] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Formatted Genre dots */}
          {formattedGenres && (
            <div className="text-[10.5px] font-medium text-zinc-300 tracking-tight leading-relaxed line-clamp-1 border-t border-zinc-800/80 pt-2 mt-0.5">
              {formattedGenres}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
