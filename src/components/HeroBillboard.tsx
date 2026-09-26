import { useState, useRef } from 'react';
import { Play, Info, Sparkles, ChevronRight, Check, Star } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { ShowItem } from '../types';
import { getOptimizedBackdrop, getOptimizedPoster } from '../utils/imageOptimizer';

interface HeroBillboardProps {
  show: ShowItem | null;
  isLoading?: boolean;
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onSelectNextFeatured?: () => void;
}

export default function HeroBillboard({
  show,
  isLoading = false,
  onOpenDetails,
  onIncrementEpisode,
  onSelectNextFeatured,
}: HeroBillboardProps) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  if (isLoading) {
    return (
      <section className="relative w-full sm:h-[70vh] lg:h-[75vh] sm:min-h-[440px] sm:max-h-[750px] bg-zinc-900 animate-pulse">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col md:flex-row items-start md:items-center justify-end md:justify-between pb-6 sm:pb-12 lg:pb-16 z-10 pt-20 sm:pt-28 gap-4 sm:gap-8">
          <div className="max-w-2xl space-y-4 w-full">
            <Skeleton width={120} height={20} />
            <Skeleton height={80} className="w-full sm:w-3/4" />
            <div className="flex gap-4">
              <Skeleton width={100} height={30} />
              <Skeleton width={100} height={30} />
            </div>
            <Skeleton count={3} />
            <div className="flex gap-3">
              <Skeleton width={150} height={45} borderRadius={6} />
              <Skeleton width={120} height={45} borderRadius={6} />
            </div>
          </div>
          <div className="hidden md:block w-32 lg:w-40 xl:w-48 aspect-[2/3] rounded-lg overflow-hidden">
            <Skeleton height="100%" />
          </div>
        </div>
      </section>
    );
  }

  if (!show) return null;

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

    // Direct intentional tap (less than 12px movement, under 500ms)
    if (dx < 12 && dy < 12 && dt < 500) {
      const target = e.target as HTMLElement;
      // Do not open details if tapping the play or cycle button
      if (target.closest('#hero-play-btn, #hero-cycle-btn')) {
        return;
      }
      e.preventDefault();
      onOpenDetails(show);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('#hero-play-btn, #hero-cycle-btn')) {
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

  // Calculate episode progress
  const currentEpNum = parseInt(show.episodes.replace(/[^0-9]/g, '')) || 1;
  const maxEpNum = parseInt(show.maxEp.replace(/[^0-9]/g, '')) || 8;
  const currentSsnNum = parseInt(show.seasons.replace(/[^0-9]/g, '')) || 1;
  const progressPercent = Math.min(100, Math.round((currentEpNum / maxEpNum) * 100));

  const isWatched = show.status === '✅ Watched';
  const isMovie = show.type === 'Movie';

  return (
    <section
      id="hero-billboard"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className="relative w-full overflow-hidden sm:h-[70vh] lg:h-[75vh] sm:min-h-[440px] sm:max-h-[750px] cursor-pointer group/hero select-none touch-manipulation"
      title="Tap to view show details"
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(show);
        }
      }}
    >
      <div
          key={show.id}
          className="relative sm:absolute sm:inset-0 w-full h-full"
        >
          {/* Backdrop image */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img
              src={getOptimizedBackdrop(show.backdropUrl)}
              alt={show.title}
              className="w-full h-full object-cover object-center transition-transform duration-[14s] ease-out scale-100"
              style={{ 
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                filter: 'brightness(0.8) contrast(1.05)',
                transform: 'scale(1)'
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=2500&auto=format&fit=crop';
              }}
            />
            {/* Cinematic Vignette & Sharpness Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/70 sm:via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/80 to-transparent w-full md:w-3/4" />
          </div>

          {/* Content Container */}
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col md:flex-row items-start md:items-center justify-end md:justify-between pb-6 sm:pb-12 lg:pb-16 z-10 pt-20 sm:pt-28 gap-4 sm:gap-8">
            <div 
              className="max-w-2xl space-y-3 sm:space-y-4"
            >
              {/* Top Tag & Platform */}
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-red-600 text-white shadow-md"
                >
                  Featured {show.type}
                </div>
                {show.isWishlist && (
                  <span
                    className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded bg-amber-500 text-black border border-amber-400 shadow-lg flex items-center gap-1"
                  >
                    🎁 Wishlist
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold bg-zinc-800/90 text-zinc-200 border border-zinc-700 backdrop-blur-sm">
                  {show.platform}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] sm:text-xs font-medium bg-zinc-800/90 text-zinc-300 border border-zinc-700 backdrop-blur-sm">
                  {show.genre}
                </span>
                <span className="text-xs text-zinc-400 font-medium">{show.year}</span>
              </div>

              {/* Title */}
              <h1 
                className="text-3xl sm:text-5xl lg:text-7xl font-black text-white tracking-tighter drop-shadow-2xl uppercase leading-[0.95]"
              >
                {show.title}
              </h1>

              {/* Quick Metrics Bar */}
              <div className="flex items-center gap-4 text-sm font-medium text-zinc-300 flex-wrap">
                {(() => {
                  let stars = show.ratingNum || 0;
                  if (!stars && show.rating) {
                    if (show.rating.toLowerCase().includes('excellent')) stars = 5;
                    else if (show.rating.toLowerCase().includes('great')) stars = 4;
                    else if (show.rating.toLowerCase().includes('good')) stars = 3;
                    else if (show.rating.toLowerCase().includes('fair')) stars = 2;
                    else if (show.rating.toLowerCase().includes('poor')) stars = 1;
                    else {
                      stars = (show.rating.match(/⭐/g) || []).length;
                    }
                  }
                  if (!stars) stars = 4;
                  const label = stars === 5 ? 'Excellent' : stars === 4 ? 'Great' : stars === 3 ? 'Good' : stars === 2 ? 'Fair' : 'Poor';

                  return (
                  <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i <= stars
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-zinc-800 text-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                  );
                })()}
                <span className="text-zinc-500">•</span>
                <span className="text-emerald-400 font-semibold">{show.status}</span>
                {!isMovie && (
                  <>
                    <span className="text-zinc-500">•</span>
                    <span className="bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded text-xs border border-zinc-700">
                      {formatS(show.seasons)} • Ep {currentEpNum} of {maxEpNum}
                    </span>
                  </>
                )}
              </div>

              {/* Progress Bar if Watching (Series only) */}
              {!isMovie && (
                <div className="w-full max-w-md bg-zinc-800/90 rounded-full h-1.5 overflow-hidden border border-zinc-700/50">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className={`h-full ${isWatched ? 'bg-emerald-500' : 'bg-[#E50914]'}`}
                  />
                </div>
              )}

              {/* Synopsis */}
              <p className="text-sm sm:text-base text-zinc-300 line-clamp-3 leading-relaxed drop-shadow max-w-xl font-normal">
                {show.synopsis || show.notes || 'No overview synopsis has been entered. Custom details may be added directly to your Google Sheet or within the detail panel.'}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                {!isMovie && (
                  <button
                    id="hero-play-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncrementEpisode(show);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onIncrementEpisode(show);
                    }}
                    className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-5 sm:px-8 py-2.5 rounded-md transition-all shadow-xl hover:scale-105 active:scale-95 text-sm sm:text-base cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current text-black" />
                    <span>
                      {currentEpNum >= maxEpNum
                        ? `Next Season: S${currentSsnNum + 1} E1`
                        : `Next: ${formatS(show.seasons)}:${formatE(currentEpNum + 1)}`}
                    </span>
                  </button>
                )}

                <button
                  id="hero-info-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(show);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onOpenDetails(show);
                  }}
                  className="flex items-center gap-2 bg-zinc-800/80 hover:bg-zinc-700/90 text-white font-semibold px-4 sm:px-6 py-2.5 rounded-md transition-all backdrop-blur-sm border border-zinc-600/40 hover:scale-105 active:scale-95 text-sm sm:text-base cursor-pointer"
                >
                  <Info className="w-5 h-5 text-zinc-300" />
                  <span>{isMovie ? 'Movie Details' : 'More Info'}</span>
                </button>

                {onSelectNextFeatured && (
                  <button
                    id="hero-cycle-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNextFeatured();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onSelectNextFeatured();
                    }}
                    className="p-2.5 rounded-md bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/50 transition-colors ml-auto sm:ml-2 cursor-pointer active:scale-90"
                    title="Next Featured Title"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Side Small Poster */}
            <div 
              className="hidden md:block w-32 lg:w-40 xl:w-48 aspect-[2/3] rounded-lg overflow-hidden border-4 border-white/10 shadow-2xl transition-all duration-500 shrink-0 mt-auto hover:rotate-0 hover:scale-105"
            >
              <img 
                 src={getOptimizedPoster(show.posterUrl || show.backdropUrl)} 
                 alt={`${show.title} poster`}
                 className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
    </section>
  );
}
