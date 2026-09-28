import React, { useMemo, useState, useEffect } from 'react';
import { Play, Star, ChevronRight, Info, Calendar, Clock, Bell, BellRing } from 'lucide-react';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';
import { isNotificationEnabled, toggleShowNotification, isShowOutNow, parseReleaseDateToTimestamp } from '../services/notificationService';

interface ShowcaseSectionProps {
  shows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
}

export default function ShowcaseSection({
  shows,
  onOpenDetails,
}: ShowcaseSectionProps) {
  const [notifState, setNotifState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const map: Record<string, boolean> = {};
    shows.forEach((s) => {
      map[s.id] = isNotificationEnabled(s.id);
    });
    setNotifState(map);
  }, [shows]);

  const handleToggleNotif = async (e: React.MouseEvent, show: ShowItem) => {
    e.stopPropagation();
    e.preventDefault();
    const enabled = await toggleShowNotification(show);
    setNotifState((prev) => ({ ...prev, [show.id]: enabled }));
  };
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
      .slice(0, 6);
  }, [shows]);

  // Top Rated titles (4-5 stars)
  const topRatedList = useMemo(() => {
    return shows
      .filter((s) => {
        const stars = s.ratingNum || (s.rating ? (s.rating.match(/⭐/g) || []).length : 0);
        return stars >= 4 || (s.rating && (s.rating.toLowerCase().includes('excellent') || s.rating.toLowerCase().includes('great')));
      })
      .sort((a, b) => (b.ratingNum || 0) - (a.ratingNum || 0))
      .slice(0, 6);
  }, [shows]);

  // Coming Soon titles with upcoming release dates or active 24h OUT NOW status
  const comingSoonList = useMemo(() => {
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    return shows
      .filter((s) => {
        if (!s.releaseDate && !s.releaseNote) return false;
        if (s.releaseDate) {
          const ts = parseReleaseDateToTimestamp(s.releaseDate);
          if (ts && now - ts > TWENTY_FOUR_HOURS_MS) {
            // Expired (more than 24h past release)
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (a.releaseDate && b.releaseDate) {
          const tsA = parseReleaseDateToTimestamp(a.releaseDate) || 0;
          const tsB = parseReleaseDateToTimestamp(b.releaseDate) || 0;
          return tsA - tsB;
        }
        if (a.releaseDate) return -1;
        if (b.releaseDate) return 1;
        return 0;
      })
      .slice(0, 6);
  }, [shows]);

  if (shows.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Active Watching In-Progress */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
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
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                            {show.platform && (
                              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {show.platform}
                              </span>
                            )}
                            <span>{show.type === 'Movie' ? 'Movie' : `${show.seasons} • Ep ${cur}/${max}`}</span>
                          </div>
                          {show.type === 'Series' && (
                            <div className="w-32 bg-zinc-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-mono font-bold text-amber-400">{progress}%</span>
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
        </div>

        {/* Top Rated Titles */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
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
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1 flex-wrap">
                            <div className="flex items-center gap-0.5 bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star
                                  key={i}
                                  className={`w-2.5 h-2.5 ${
                                    i <= stars
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'fill-zinc-800 text-zinc-700'
                                  }`}
                                />
                              ))}
                              <span className="text-[9px] font-bold text-amber-400 ml-1">
                                {stars === 5 ? '5/5' : `${stars}/5`}
                              </span>
                            </div>
                            {show.genre && <span className="truncate max-w-[80px]">• {show.genre}</span>}
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

        {/* Coming Soon & Premieres Section */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                <h3 className="text-sm font-bold text-white tracking-tight">Upcoming Release Dates</h3>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
                {comingSoonList.length} upcoming
              </span>
            </div>

            {comingSoonList.length > 0 ? (
              <div className="space-y-2.5">
                {comingSoonList.map((show) => {
                  const outNow = isShowOutNow(show);
                  const dateStr = outNow ? '🎉 OUT NOW' : (show.releaseDate || show.releaseNote || 'Coming Soon');

                  return (
                    <div
                      key={show.id}
                      onClick={() => onOpenDetails(show)}
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {show.platform && (
                              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {show.platform}
                              </span>
                            )}
                            {outNow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-950/90 border border-emerald-600/80 px-2 py-0.5 rounded shadow animate-pulse">
                                🎉 OUT NOW!
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-800/60 px-1.5 py-0.2 rounded">
                                <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span className="truncate max-w-[130px]">{dateStr}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!outNow && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleNotif(e, show)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              notifState[show.id]
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30 shadow'
                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-white hover:bg-zinc-700'
                            }`}
                            title={notifState[show.id] ? '24h Release Alert Active (Click to disable)' : 'Alert me 24 hours before release'}
                          >
                            {notifState[show.id] ? (
                              <BellRing className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            ) : (
                              <Bell className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center space-y-1 my-auto">
                <Calendar className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">No shows with upcoming release dates</p>
                <p className="text-[10px] text-zinc-600">Add a release date or premiere note to any show to list it here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
