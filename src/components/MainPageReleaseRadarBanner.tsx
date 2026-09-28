import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Clock, CheckCircle2 } from 'lucide-react';
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

  // Find the single closest upcoming show
  const featuredShow = useMemo(() => {
    if (!shows || shows.length === 0) return null;

    const showsWithParsedDates = shows
      .map((s) => ({
        ...s,
        parsedDate: parseShowDate(s.releaseDate || s.nextAirDate),
      }))
      .filter((s) => s.parsedDate !== null) as (ShowItem & { parsedDate: Date })[];

    if (showsWithParsedDates.length > 0) {
      // Sort by future release date
      const future = showsWithParsedDates
        .filter((s) => s.parsedDate.getTime() >= now.getTime() - 24 * 60 * 60 * 1000)
        .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      if (future.length > 0) return future[0];

      // Fallback to the most recent date
      return showsWithParsedDates[0];
    }

    // Check if any show has a releaseNote or premiere note (e.g. Season 2 Premiere, 2026, etc.)
    const showWithNote = shows.find((s) => Boolean(s.releaseNote?.trim()));
    if (showWithNote) {
      return {
        ...showWithNote,
        parsedDate: null,
      };
    }

    return null;
  }, [shows, now]);

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
    if (!featuredShow || !featuredShow.parsedDate) return false;
    return featuredShow.parsedDate.getTime() - now.getTime() <= 0;
  }, [featuredShow, now]);

  if (!featuredShow) return null;

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
              featuredShow.backdropUrl || featuredShow.posterUrl
            )})`,
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Left Title & Info */}
          <div className="flex items-center gap-4 sm:gap-5 w-full lg:w-auto">
            <img
              src={getOptimizedPoster(featuredShow.posterUrl)}
              alt={featuredShow.title}
              className="w-16 sm:w-20 aspect-[2/3] object-cover rounded-xl border border-zinc-700 shadow-xl shrink-0 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => onOpenDetails(featuredShow)}
            />

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-black uppercase tracking-wider flex items-center gap-1 shadow">
                  <Clock className="w-3 h-3" /> Live Premiere Countdown
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {featuredShow.platform}
                </span>
              </div>

              <h3
                onClick={() => onOpenDetails(featuredShow)}
                className="text-lg sm:text-2xl font-black text-white tracking-tight line-clamp-1 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {featuredShow.title}
              </h3>

              <p className="text-xs text-amber-300/90 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {featuredShow.releaseNote ||
                    (featuredShow.parsedDate
                      ? `Target Premiere: ${formatToDDMMYYYY(featuredShow.parsedDate)}${
                          featuredShow.parsedDate.getHours() !== 0 ||
                          featuredShow.parsedDate.getMinutes() !== 0
                            ? ` at ${String(featuredShow.parsedDate.getHours()).padStart(2, '0')}:${String(
                                featuredShow.parsedDate.getMinutes()
                              ).padStart(2, '0')}`
                            : ''
                        }`
                      : 'Airing Soon')}
                </span>
              </p>
            </div>
          </div>

          {/* Right Live Countdown Ticker */}
          <div className="flex items-center w-full lg:w-auto justify-end">
            {featuredShow.parsedDate ? (
              (() => {
                const clock = getCountdownClock(featuredShow.parsedDate);
                if (clock.isPast) {
                  return (
                    <div className="flex items-center gap-2.5 bg-zinc-950/90 px-5 py-3.5 rounded-2xl border border-emerald-500/50 animate-out-now-flash shadow-xl">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-pulse" />
                      <span className="text-base sm:text-xl font-black text-emerald-300 uppercase tracking-wider drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                        OUT NOW ON {featuredShow.platform}!
                      </span>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center gap-2 sm:gap-3 md:gap-4 bg-zinc-950/90 px-3 sm:px-5 py-3 sm:py-3.5 rounded-2xl border border-amber-500/30 shadow-xl">
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-400 font-mono tracking-tight">
                        {String(clock.days).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Days</span>
                    </div>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-600 pb-3">:</span>
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                        {String(clock.hours).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Hours</span>
                    </div>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-600 pb-3">:</span>
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                        {String(clock.minutes).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Mins</span>
                    </div>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-600 pb-3">:</span>
                    <div className="flex flex-col items-center px-1.5 sm:px-3">
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-red-400 font-mono tracking-tight">
                        {String(clock.seconds).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Secs</span>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
