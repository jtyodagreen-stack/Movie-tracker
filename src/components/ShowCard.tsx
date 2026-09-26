import { useState, useRef, useEffect } from 'react';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';

interface ShowCardProps {
  show: ShowItem;
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  className?: string;
  onHoverEnter?: (show: ShowItem, rect: { top: number; left: number; width: number; height: number }) => void;
  onHoverLeave?: () => void;
}

export default function ShowCard({
  show,
  onOpenDetails,
  onIncrementEpisode,
  onToggleStatus,
  className,
  onHoverEnter,
  onHoverLeave,
}: ShowCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Clean up timeouts on unmount
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

  const handleActivation = (e: React.MouseEvent | React.TouchEvent) => {
    // Instantly clear any pending hover timeouts when activation starts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || !window.matchMedia('(hover: hover)').matches);
    
    if (isMobile) {
      e.preventDefault();
      e.stopPropagation();
      if (onHoverEnter && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        onHoverEnter(show, {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    } else {
      onOpenDetails(show);
    }
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
      handleActivation(e);
    }
  };

  const handleMouseEnter = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      setIsHovered(true);
      
      // True Netflix Hover: wait 450ms before opening the expanded portal, or 50ms if another portal is already active
      if (onHoverEnter && cardRef.current) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        const isAnyPortalActive = !!document.querySelector('.netflix-hover-portal-active');
        const delay = isAnyPortalActive ? 50 : 450;
        
        hoverTimeoutRef.current = setTimeout(() => {
          if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            onHoverEnter(show, {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            });
          }
        }, delay);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (onHoverLeave) {
      onHoverLeave();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    handleActivation(e);
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
      ref={cardRef}
      id={`show-card-${show.id}`}
      role="button"
      className={`group relative cursor-pointer hover-lift-card focus:outline-none select-none touch-manipulation active:scale-[0.98] transition-transform ${
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
      {/* Card Thumbnail */}
      <div className="relative w-full aspect-video rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md transition-all">
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
