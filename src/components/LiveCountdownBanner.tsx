import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sparkles,
  Calendar,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  Radio,
  Tv,
  RefreshCw,
  Bell,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ShowItem } from '../types';
import { getCountdownTimeRemaining, fetchLiveShowSchedule, attachScheduleToShow, formatDDMMYYYY } from '../services/scheduleService';
import { getOptimizedPoster, getOptimizedBackdrop } from '../utils/imageOptimizer';

interface LiveCountdownBannerProps {
  shows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  onUpdateShow?: (show: ShowItem) => void;
}

export default function LiveCountdownBanner({
  shows,
  onOpenDetails,
  onToggleStatus,
  onUpdateShow,
}: LiveCountdownBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tickerTime, setTickerTime] = useState(Date.now());

  // Ticking 1-second timer for live countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter shows that have upcoming air dates or are series marked as watching / wishlist
  const upcomingShows = useMemo(() => {
    return shows
      .filter((s) => {
        // Must be Series or have schedule info
        if (s.type === 'Movie') return false;
        if (s.nextAirTimestamp && s.nextAirTimestamp > Date.now()) return true;
        // Also include active Watching/Wishlist series
        return s.status === '⏳ Watching' || s.isWishlist;
      })
      .sort((a, b) => {
        const timeA = a.nextAirTimestamp || Date.now() + 86400000 * 30;
        const timeB = b.nextAirTimestamp || Date.now() + 86400000 * 30;
        return timeA - timeB;
      });
  }, [shows]);

  // Active show in the countdown banner
  const currentShow = upcomingShows[activeIndex % Math.max(1, upcomingShows.length)] || null;

  // Auto-fetch schedule for current show if missing nextAirTimestamp
  useEffect(() => {
    if (!currentShow) return;
    if (!currentShow.nextAirTimestamp && onUpdateShow) {
      let isMounted = true;
      (async () => {
        const sched = await fetchLiveShowSchedule(currentShow.title, currentShow.imdbId);
        if (sched && isMounted) {
          const updated = attachScheduleToShow(currentShow, sched);
          onUpdateShow(updated);
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [currentShow?.id, currentShow?.nextAirTimestamp, onUpdateShow]);

  if (!currentShow || upcomingShows.length === 0) return null;

  // Calculate live ticking time remaining
  const targetTimestamp = currentShow.nextAirTimestamp || Date.now() + 86400000 * 14;
  const countdown = getCountdownTimeRemaining(targetTimestamp);

  const formattedAirDate = currentShow.nextAirDate || formatDDMMYYYY(targetTimestamp);
  const episodeStr = currentShow.nextSeasonNum && currentShow.nextEpisodeNum
    ? `S${currentShow.nextSeasonNum} E${currentShow.nextEpisodeNum}`
    : `${currentShow.seasons || 'S2'} ${currentShow.episodes || 'E1'}`;

  const handleManualRefreshSchedule = async () => {
    if (!currentShow) return;
    setIsRefreshing(true);
    try {
      const sched = await fetchLiveShowSchedule(currentShow.title, currentShow.imdbId);
      if (sched && onUpdateShow) {
        const updated = attachScheduleToShow(currentShow, sched);
        onUpdateShow(updated);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const backdropImage = getOptimizedBackdrop(
    currentShow.backdropUrl || currentShow.posterUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1600&auto=format&fit=crop'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-red-600/40 shadow-2xl shadow-red-950/30 group">
        {/* Background Image Scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src={backdropImage}
            alt={currentShow.title}
            className="w-full h-full object-cover object-center filter brightness-[0.30] saturate-[1.2] blur-[1px] transform scale-105 transition-all duration-700 group-hover:scale-100"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 p-4 sm:p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Column: Live Indicator, Title & Airing Metadata */}
          <div className="space-y-3 max-w-2xl">
            {/* Header Badge Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white font-extrabold text-[11px] uppercase tracking-wider shadow-lg shadow-red-950/80 animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                <span>Live Premiere Tracker</span>
              </span>

              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-900/90 text-amber-300 border border-amber-500/40">
                {currentShow.scheduleStatus || 'Season Premiere'}
              </span>

              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-black/80 text-zinc-300 border border-zinc-700/60">
                {currentShow.platform}
              </span>
            </div>

            {/* Show Title */}
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
                {currentShow.title}
              </h2>
              {currentShow.nextEpisodeTitle && (
                <p className="text-xs sm:text-sm text-zinc-300 font-semibold mt-1 flex items-center gap-2">
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded">
                    {episodeStr}
                  </span>
                  <span className="truncate">"{currentShow.nextEpisodeTitle}"</span>
                </p>
              )}
            </div>

            {/* Air Schedule Detail Line */}
            <div className="flex items-center gap-4 text-xs sm:text-sm text-zinc-300 flex-wrap">
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Air Date: <strong className="font-mono text-white font-bold">{formattedAirDate}</strong></span>
              </span>

              {currentShow.nextAirTime && (
                <span className="flex items-center gap-1.5 text-zinc-300 font-mono">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{currentShow.nextAirTime} GMT</span>
                </span>
              )}

              {currentShow.airScheduleText && (
                <span className="text-zinc-400 font-medium hidden md:inline">
                  • {currentShow.airScheduleText}
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Ticking Live Countdown Clock Box */}
          <div className="flex flex-col items-center w-full md:items-end md:w-auto gap-3 shrink-0">
            {/* Clock Ticker Units Grid */}
            <div translate="no" className="notranslate bg-zinc-900/90 border border-red-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Days */}
              <div className="flex flex-col items-center justify-center min-w-[50px] sm:min-w-[62px] p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="text-2xl sm:text-4xl font-black font-mono text-white tracking-wider">
                  {String(countdown.days).padStart(2, '0')}
                </span>
                <span className="text-[9px] uppercase font-bold text-zinc-400 mt-0.5">Days</span>
              </div>

              <span className="text-lg font-bold" style={{ color: '#ef4444' }}>:</span>

              {/* Hours */}
              <div className="flex flex-col items-center justify-center min-w-[50px] sm:min-w-[62px] p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="text-2xl sm:text-4xl font-black font-mono text-amber-400 tracking-wider">
                  {String(countdown.hours).padStart(2, '0')}
                </span>
                <span className="text-[9px] uppercase font-bold text-zinc-400 mt-0.5">Hours</span>
              </div>

              <span className="text-lg font-bold" style={{ color: '#ef4444' }}>:</span>

              {/* Minutes */}
              <div className="flex flex-col items-center justify-center min-w-[50px] sm:min-w-[62px] p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="text-2xl sm:text-4xl font-black font-mono text-white tracking-wider">
                  {String(countdown.minutes).padStart(2, '0')}
                </span>
                <span className="text-[9px] uppercase font-bold text-zinc-400 mt-0.5">Mins</span>
              </div>

              <span className="text-lg font-bold" style={{ color: '#ef4444' }}>:</span>

              {/* Seconds */}
              <div
                className="flex flex-col items-center justify-center min-w-[50px] sm:min-w-[62px] p-2 bg-zinc-950 rounded-lg border border-zinc-800"
                style={{ outline: '1px solid rgba(239, 68, 68, 0.4)' }}
              >
                <span
                  className="text-2xl sm:text-4xl font-black font-mono tracking-wider animate-pulse"
                  style={{ color: '#ef4444' }}
                >
                  {String(countdown.seconds).padStart(2, '0')}
                </span>
                <span
                  className="text-[9px] uppercase font-bold mt-0.5"
                  style={{ color: '#f87171' }}
                >
                  Secs
                </span>
              </div>
            </div>

            {/* Banner Buttons */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onOpenDetails(currentShow)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-lg shadow-lg hover:shadow-red-950/60 transition-all cursor-pointer active:scale-95"
              >
                <Info className="w-4 h-4" />
                <span>View Details & Schedule</span>
              </button>

              <button
                type="button"
                onClick={handleManualRefreshSchedule}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                title="Fetch latest air dates from TVMaze"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              </button>

              {upcomingShows.length > 1 && (
                <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : upcomingShows.length - 1))}
                    className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Previous upcoming show"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-mono text-zinc-400 px-1">
                    {activeIndex + 1}/{upcomingShows.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveIndex((prev) => (prev + 1) % upcomingShows.length)}
                    className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Next upcoming show"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Carousel pills selector at bottom if multiple upcoming shows */}
        {upcomingShows.length > 1 && (
          <div className="relative z-10 px-4 sm:px-8 py-2 bg-zinc-950/90 border-t border-zinc-900 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider shrink-0 mr-1">
              Upcoming Premieres ({upcomingShows.length}):
            </span>
            {upcomingShows.map((s, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-red-600 text-white font-extrabold shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{s.title}</span>
                  {s.nextAirDate && (
                    <span className="text-[10px] font-mono opacity-80">({s.nextAirDate})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
