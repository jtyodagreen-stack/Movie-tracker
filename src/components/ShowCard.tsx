import { useState, useRef } from 'react';
import { Play, Plus, Check, Info, Star } from 'lucide-react';
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
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

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
      setIsHovered(true);
    }
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

  return (
    <div
      id={`show-card-${show.id}`}
      role="button"
      className={`group relative cursor-pointer hover-lift-card focus:outline-none select-none touch-manipulation active:scale-[0.98] transition-transform ${
        className || 'flex-shrink-0 w-44 sm:w-56 md:w-64'
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(show);
        }
      }}
    >
      {/* Card Thumbnail */}
      <div className="relative aspect-[16/10] w-full rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md group-hover:border-zinc-500 transition-all">
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

        {/* Hover Quick Actions Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 flex flex-col justify-end transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-1.5 pb-1">
            {!isMovie && (
              <button
                id={`quick-play-${show.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrementEpisode(show);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onIncrementEpisode(show);
                }}
                className="w-8 h-8 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-transform hover:scale-110 shadow-lg cursor-pointer"
                title={
                  currentEpNum >= maxEpNum
                    ? `Next Season: S${currentSsnNum + 1} E1`
                    : `Next Episode: Ep ${currentEpNum + 1}`
                }
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
            )}

            <button
              id={`quick-status-${show.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(show);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleStatus(show);
              }}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-transform hover:scale-110 shadow-lg cursor-pointer ${
                isWatched
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-zinc-800/90 hover:bg-zinc-700 border-zinc-600 text-white'
              }`}
              title={isWatched ? 'Mark as Watching' : 'Mark as Watched'}
            >
              <Check className="w-4 h-4" />
            </button>

            <button
              id={`quick-info-${show.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(show);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenDetails(show);
              }}
              className="w-8 h-8 rounded-full bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white flex items-center justify-center ml-auto transition-transform hover:scale-110 cursor-pointer"
              title="Show Details"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-300 font-medium">
            {show.ratingNum && show.ratingNum > 0 ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{show.ratingNum}/5</span>
              </span>
            ) : (
              <span className="text-zinc-400 font-medium">Unrated</span>
            )}
            <span>
              {isMovie ? (show.year || 'Movie') : `${formatS(show.seasons)}:${formatE(show.episodes)}/${formatE(show.maxEp)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Under-Card Information */}
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
    </div>
  );
}
