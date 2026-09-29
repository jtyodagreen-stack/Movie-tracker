import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Clock, CheckCircle2, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { ShowItem } from '../types';
import { getOptimizedPoster, getOptimizedBackdrop } from '../utils/imageOptimizer';
import { parseAnyDate, formatToDDMMYYYY } from '../utils/dateUtils';
import { checkAndTrigger24hNotifications } from '../services/notificationService';

interface MainPageReleaseRadarBannerProps {
  shows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
}

export default function MainPageReleaseRadarBanner({
  shows,
  onOpenDetails,
}: MainPageReleaseRadarBannerProps) {
  const [now, setNow] = useState<Date>(new Date());
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Check notifications on tick
    checkAndTrigger24hNotifications(shows);

    const interval = setInterval(() => {
      setNow(new Date());
      checkAndTrigger24hNotifications(shows);
    }, 1000);
    return () => clearInterval(interval);
  }, [shows]);

  // Helper to parse date string into Date object
  const parseShowDate = (dateStr?: string): Date | null => {
    return parseAnyDate(dateStr);
  };

  // Compile all upcoming shows with release dates or premiere notes
  const upcomingList = useMemo(() => {
    if (!shows || shows.length === 0) return [];

    const parsed = shows
      .filter((s) => Boolean(s.releaseDate || s.releaseNote || s.nextAirDate))
      .map((s) => ({
        ...s,
        parsedDate: parseShowDate(s.releaseDate || s.nextAirDate),
      }));

    return parsed.sort((a, b) => {
      const nowMs = now.getTime();
      const timeA = a.parsedDate ? a.parsedDate.getTime() : nowMs + 86400000 * 365;
      const timeB = b.parsedDate ? b.parsedDate.getTime() : nowMs + 86400000 * 365;

      // Future dates first, closest date first
      const aIsFuture = timeA >= nowMs - 24 * 60 * 60 * 1000;
      const bIsFuture = timeB >= nowMs - 24 * 60 * 60 * 1000;

      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      return timeA - timeB;
    });
  }, [shows, now]);

  const activeShow = useMemo(() => {
    if (upcomingList.length === 0) return null;
    return upcomingList[currentIndex % upcomingList.length];
  }, [upcomingList, currentIndex]);

  // Countdown clock calculation
  const getCountdownClock = (targetDate: Date) => {
    const total = targetDate.getTime() - now.getTime();
    if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds, isPast: false };
  };

  const isFeaturedShowReleased = useMemo(() => {
    if (!activeShow || !activeShow.parsedDate) return false;
    return activeShow.parsedDate.getTime() - now.getTime() <= 0;
  }, [activeShow, now]);

  if (!activeShow) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : upcomingList.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % upcomingList.length);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-6">
      <div className={`relative rounded-2xl overflow-hidden border shadow-2xl p-4 sm:p-6 transition-all ${
        isFeaturedShowReleased 
          ? 'border-emerald-500/50 bg-gradient-to-r from-zinc-950 via-emerald-950/20 to-zinc-950 animate-banner-out-now' 
          : 'border-amber-500/40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950'
      }`}>
        {/* Background Backdrop Glow */}
        <div
          className="absolute inset-0 opacity-15 bg-cover bg-center blur-lg pointer-events-none"
          style={{
            backgroundImage: `url(${getOptimizedBackdrop(
              activeShow.backdropUrl || activeShow.posterUrl
            )})`,
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Left Title & Info */}
          <div className="flex items-center gap-4 sm:gap-5 w-full lg:w-auto">
            <img
              src={getOptimizedPoster(activeShow.posterUrl)}
              alt={activeShow.title}
              className="w-16 sm:w-20 aspect-[2/3] object-cover rounded-xl border border-zinc-700 shadow-xl shrink-0 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => onOpenDetails(activeShow)}
            />

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-black uppercase tracking-wider flex items-center gap-1 shadow">
                  <Clock className="w-3 h-3" /> Live Premiere Countdown
                </span>
                {upcomingList.length > 1 && (
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="hover:text-white p-0.5 rounded hover:bg-zinc-800 transition-colors"
                      title="Previous upcoming premiere"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <span>
                      {(currentIndex % upcomingList.length) + 1} of {upcomingList.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="hover:text-white p-0.5 rounded hover:bg-zinc-800 transition-colors"
                      title="Next upcoming premiere"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {activeShow.platform && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {activeShow.platform}
                  </span>
                )}
              </div>

              <h3
                onClick={() => onOpenDetails(activeShow)}
                className="text-lg sm:text-2xl font-black text-white tracking-tight line-clamp-1 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {activeShow.title}
              </h3>

              <p className="text-xs text-amber-300/90 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  {activeShow.releaseNote ||
                    (activeShow.parsedDate
                      ? `Target Premiere: ${formatToDDMMYYYY(activeShow.parsedDate)}${
                          activeShow.parsedDate.getHours() !== 0 ||
                          activeShow.parsedDate.getMinutes() !== 0
                            ? ` at ${String(activeShow.parsedDate.getHours()).padStart(2, '0')}:${String(
                                activeShow.parsedDate.getMinutes()
                              ).padStart(2, '0')}`
                            : ''
                        }`
                      : 'Airing Soon')}
                </span>
              </p>
            </div>
          </div>

          {/* Right Live Countdown Ticker */}
          <div className="flex items-center w-full md:w-auto justify-center md:justify-end">
            {activeShow.parsedDate ? (
              (() => {
                const clock = getCountdownClock(activeShow.parsedDate);
                if (clock.isPast) {
                  return (
                    <div className="flex items-center gap-2.5 bg-zinc-950/90 px-5 py-3.5 rounded-2xl border border-emerald-500/50 animate-out-now-flash shadow-xl">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-pulse" />
                      <span className="text-base sm:text-xl font-black text-emerald-300 uppercase tracking-wider drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                        OUT NOW ON {activeShow.platform || 'Streaming'}!
                      </span>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center gap-2 sm:gap-3 md:gap-4 bg-zinc-950/90 px-3 sm:px-5 py-3 sm:py-3.5 rounded-2xl border border-amber-500/30 shadow-xl">
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-400 font-mono tracking-tight">
                        {String(clock.days).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Days</span>
                    </div>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-600 pb-3">:</span>
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-mono tracking-tight">
                        {String(clock.hours).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Hours</span>
                    </div>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-600 pb-3">:</span>
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-mono tracking-tight">
                        {String(clock.minutes).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Mins</span>
                    </div>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-600 pb-3">:</span>
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black text-red-400 font-mono tracking-tight">
                        {String(clock.seconds).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Secs</span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <button
                type="button"
                onClick={() => onOpenDetails(activeShow)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all"
              >
                View Premiere Details
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
