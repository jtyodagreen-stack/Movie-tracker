import React, { useMemo } from 'react';
import { Play, Star, ChevronRight, Info } from 'lucide-react';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';

interface ShowcaseSectionProps {
  shows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
}

export default function ShowcaseSection({
  shows,
  onOpenDetails,
}: ShowcaseSectionProps) {
  // Currently Watching in-progress titles
  const inProgressList = useMemo(() => {
    return shows
      .filter((s) => s.status === '⏳ Watching')
      .sort((a, b) => {
        const curA = parseInt(String(a.episodes).replace(/[^0-9]/g, '')) || 1;
        const maxA = parseInt(String(a.maxEp).replace(/[^0-9]/g, '')) || 8;
        const progressA = (curA / maxA);

        const curB = parseInt(String(b.episodes).replace(/[^0-9]/g, '')) || 1;
        const maxB = parseInt(String(b.maxEp).replace(/[^0-9]/g, '')) || 8;
        const progressB = (curB / maxB);

        return progressB - progressA;
      })
      .slice(0, 8);
  }, [shows]);

  // Top Rated titles (4-5 stars)
  const topRatedList = useMemo(() => {
    return shows
      .filter((s) => {
        const stars = s.ratingNum || (s.rating ? (s.rating.match(/⭐/g) || []).length : 0);
        return stars >= 4 || (s.rating && (s.rating.toLowerCase().includes('excellent') || s.rating.toLowerCase().includes('great')));
      })
      .sort((a, b) => (b.ratingNum || 0) - (a.ratingNum || 0))
      .slice(0, 8);
  }, [shows]);

  if (shows.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Watching In-Progress */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-500 fill-current" />
              <h3 className="text-sm font-bold text-white tracking-tight">Currently In-Progress Shows</h3>
            </div>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
              {inProgressList.length} titles
            </span>
          </div>

          {inProgressList.length > 0 ? (
            <div className="space-y-2.5">
              {inProgressList.map((show) => {
                const cur = parseInt(String(show.episodes).replace(/[^0-9]/g, '')) || 1;
                const max = parseInt(String(show.maxEp).replace(/[^0-9]/g, '')) || 8;
                const progress = Math.min(100, Math.round((cur / max) * 100));

                return (
                  <div
                    key={show.id}
                    onClick={() => onOpenDetails(show)}
                    className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                        <img
                          src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                          alt={show.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                          {show.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {show.platform}
                          </span>
                          <span>{show.type === 'Movie' ? 'Movie' : `${show.seasons} • Ep ${cur}/${max}`}</span>
                        </div>
                        {show.type === 'Series' && (
                          <div className="w-36 bg-zinc-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div
                              className="bg-amber-500 h-full rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-mono font-bold text-amber-400">{progress}%</span>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-6 text-center">No shows currently marked as Watching</p>
          )}
        </div>

        {/* Top Rated Titles */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">Top Rated Titles (4–5 Stars)</h3>
            </div>
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-mono font-bold">
              {topRatedList.length} titles
            </span>
          </div>

          {topRatedList.length > 0 ? (
            <div className="space-y-2.5">
              {topRatedList.map((show) => {
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
                if (!stars) stars = 5;

                return (
                  <div
                    key={show.id}
                    onClick={() => onOpenDetails(show)}
                    className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                        <img
                          src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                          alt={show.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                          {show.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1 flex-wrap">
                          <div className="flex items-center gap-0.5 bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i <= stars
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'fill-zinc-800 text-zinc-700'
                                }`}
                              />
                            ))}
                            <span className="text-[10px] font-bold text-amber-400 ml-1">
                              {stars === 5 ? 'Excellent' : stars === 4 ? 'Great' : `${stars}/5`}
                            </span>
                          </div>
                          <span>•</span>
                          <span>{show.genre}</span>
                          <span>•</span>
                          <span>{show.year}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Info className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-6 text-center">No titles rated 4 or 5 stars yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
