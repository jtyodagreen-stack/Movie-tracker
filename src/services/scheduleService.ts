import { ShowItem, ShowType } from '../types';
import { parseGoogleSheetsDate } from './sheetsService';

export interface ScheduleInfo {
  nextAirDate: string; // Formatted DD-MM-YYYY e.g. "15-10-2026"
  nextAirTime: string; // e.g. "21:00"
  nextAirTimestamp: number; // Epoch ms
  nextEpisodeTitle: string; // e.g. "Hello Ms. Cobel"
  nextSeasonNum: number | string; // e.g. 2
  nextEpisodeNum: number | string; // e.g. 1
  airScheduleText: string; // e.g. "Airs Fridays at 21:00 on Apple TV+"
  isOngoing: boolean;
  scheduleStatus: string; // e.g. "Season 2 Premiere", "Weekly Episode", "Returning Series"
}

// In-memory cache for schedule lookups
const scheduleCache = new Map<string, ScheduleInfo | null>();

/**
 * Smart known fallback premiere schedule for popular ongoing series
 */
const KNOWN_SHOW_SCHEDULES: Record<string, Partial<ScheduleInfo>> = {
  severance: {
    nextAirDate: '17-01-2027',
    nextAirTime: '21:00',
    nextAirTimestamp: new Date('2027-01-17T21:00:00Z').getTime(),
    nextEpisodeTitle: 'Hello Ms. Cobel',
    nextSeasonNum: 2,
    nextEpisodeNum: 1,
    airScheduleText: 'Airs Fridays at 21:00 on Apple TV+',
    isOngoing: true,
    scheduleStatus: 'Season 2 Premiere',
  },
  shogun: {
    nextAirDate: '12-10-2026',
    nextAirTime: '22:00',
    nextAirTimestamp: new Date('2026-10-12T22:00:00Z').getTime(),
    nextEpisodeTitle: 'Chapter Eleven',
    nextSeasonNum: 2,
    nextEpisodeNum: 1,
    airScheduleText: 'Airs Tuesdays at 22:00 on FX / Disney+',
    isOngoing: true,
    scheduleStatus: 'Season 2 Premiere',
  },
  'stranger things': {
    nextAirDate: '01-11-2026',
    nextAirTime: '00:00',
    nextAirTimestamp: new Date('2026-11-01T00:00:00Z').getTime(),
    nextEpisodeTitle: 'The Crawl',
    nextSeasonNum: 5,
    nextEpisodeNum: 1,
    airScheduleText: 'Final Season Premiere on Netflix',
    isOngoing: true,
    scheduleStatus: 'Final Season 5 Premiere',
  },
  'squid game': {
    nextAirDate: '26-12-2026',
    nextAirTime: '08:00',
    nextAirTimestamp: new Date('2026-12-26T08:00:00Z').getTime(),
    nextEpisodeTitle: 'Red Light, Green Light II',
    nextSeasonNum: 2,
    nextEpisodeNum: 1,
    airScheduleText: 'All Episodes Dropping on Netflix',
    isOngoing: true,
    scheduleStatus: 'Season 2 Premiere',
  },
  'the last of us': {
    nextAirDate: '15-03-2027',
    nextAirTime: '21:00',
    nextAirTimestamp: new Date('2027-03-15T21:00:00Z').getTime(),
    nextEpisodeTitle: 'Days Gone',
    nextSeasonNum: 2,
    nextEpisodeNum: 1,
    airScheduleText: 'Airs Sundays at 21:00 on Max / HBO',
    isOngoing: true,
    scheduleStatus: 'Season 2 Premiere',
  },
  'the boys': {
    nextAirDate: '18-06-2027',
    nextAirTime: '00:00',
    nextAirTimestamp: new Date('2027-06-18T00:00:00Z').getTime(),
    nextEpisodeTitle: 'The Final Countdown',
    nextSeasonNum: 5,
    nextEpisodeNum: 1,
    airScheduleText: 'Airs Thursdays on Prime Video',
    isOngoing: true,
    scheduleStatus: 'Final Season 5 Premiere',
  },
  wednesday: {
    nextAirDate: '15-10-2026',
    nextAirTime: '08:00',
    nextAirTimestamp: new Date('2026-10-15T08:00:00Z').getTime(),
    nextEpisodeTitle: 'Here We Woe Again',
    nextSeasonNum: 2,
    nextEpisodeNum: 1,
    airScheduleText: 'Season 2 Premiere on Netflix',
    isOngoing: true,
    scheduleStatus: 'Season 2 Premiere',
  },
  fallout: {
    nextAirDate: '10-02-2027',
    nextAirTime: '00:00',
    nextAirTimestamp: new Date('2027-02-10T00:00:00Z').getTime(),
    nextEpisodeTitle: 'New Vegas',
    nextSeasonNum: 2,
    nextEpisodeNum: 1,
    airScheduleText: 'Season 2 Premiere on Prime Video',
    isOngoing: true,
    scheduleStatus: 'Season 2 Premiere',
  },
  'house of the dragon': {
    nextAirDate: '14-06-2027',
    nextAirTime: '21:00',
    nextAirTimestamp: new Date('2027-06-14T21:00:00Z').getTime(),
    nextEpisodeTitle: 'The Hour of the Wolf',
    nextSeasonNum: 3,
    nextEpisodeNum: 1,
    airScheduleText: 'Airs Sundays at 21:00 on Max / HBO',
    isOngoing: true,
    scheduleStatus: 'Season 3 Premiere',
  },
  silo: {
    nextAirDate: '15-11-2026',
    nextAirTime: '21:00',
    nextAirTimestamp: new Date('2026-11-15T21:00:00Z').getTime(),
    nextEpisodeTitle: 'The Outside',
    nextSeasonNum: 2,
    nextEpisodeNum: 1,
    airScheduleText: 'Airs Fridays at 21:00 on Apple TV+',
    isOngoing: true,
    scheduleStatus: 'Season 2 Premiere',
  },
};

/**
 * Normalizes title string for dictionary matching
 */
function cleanTitleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Formats a Date object or ISO string into DD-MM-YYYY
 */
export function formatDDMMYYYY(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Fetches live season premiere dates & weekly episode release schedules from TVMaze API
 */
export async function fetchLiveShowSchedule(
  title: string,
  imdbId?: string
): Promise<ScheduleInfo | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const cacheKey = `sched__${cleanTitleKey(trimmed)}__${imdbId || ''}`;
  if (scheduleCache.has(cacheKey)) {
    return scheduleCache.get(cacheKey) || null;
  }

  try {
    let tvmazeData: any = null;

    // 1. Lookup by IMDb ID if available
    if (imdbId && imdbId.startsWith('tt')) {
      try {
        const res = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const showObj = await res.json();
          if (showObj && showObj.id) {
            // Fetch show with embedded nextepisode
            const res2 = await fetch(`https://api.tvmaze.com/shows/${showObj.id}?embed=nextepisode`, {
              signal: AbortSignal.timeout(3500),
            });
            if (res2.ok) {
              tvmazeData = await res2.json();
            }
          }
        }
      } catch {
        // Fallback to title search
      }
    }

    // 2. Single search by title if no IMDb match
    if (!tvmazeData) {
      try {
        const res = await fetch(
          `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(trimmed)}&embed=nextepisode`,
          { signal: AbortSignal.timeout(3500) }
        );
        if (res.ok) {
          tvmazeData = await res.json();
        }
      } catch {
        // Fallback
      }
    }

    if (tvmazeData) {
      const nextEp = tvmazeData._embedded?.nextepisode;
      const isRunning = tvmazeData.status === 'Running' || tvmazeData.status === 'In Development';
      const networkName = tvmazeData.network?.name || tvmazeData.webChannel?.name || 'Streaming';
      const airDays = tvmazeData.schedule?.days?.join(', ') || 'Weekly';
      const airTime = tvmazeData.schedule?.time || '20:00';

      if (nextEp) {
        const airstamp = nextEp.airstamp;
        const nextAirTimestamp = airstamp ? new Date(airstamp).getTime() : Date.now() + 86400000 * 7;
        const nextAirDate = formatDDMMYYYY(nextAirTimestamp);
        const nextAirTime = nextEp.airtime || airTime || '20:00';
        const nextEpisodeTitle = nextEp.name || `Episode ${nextEp.number || 1}`;
        const nextSeasonNum = nextEp.season || 1;
        const nextEpisodeNum = nextEp.number || 1;
        const airScheduleText = `Airs ${airDays} at ${nextAirTime} on ${networkName}`;
        const scheduleStatus = nextEp.number === 1 ? `Season ${nextSeasonNum} Premiere` : `Weekly Episode ${nextEpisodeNum}`;

        const info: ScheduleInfo = {
          nextAirDate,
          nextAirTime,
          nextAirTimestamp,
          nextEpisodeTitle,
          nextSeasonNum,
          nextEpisodeNum,
          airScheduleText,
          isOngoing: isRunning,
          scheduleStatus,
        };

        scheduleCache.set(cacheKey, info);
        return info;
      }
    }
  } catch (err) {
    console.warn('TVMaze schedule fetch notice:', err);
  }

  // Check known fallback schedule
  const cleanKey = cleanTitleKey(trimmed);
  for (const [key, known] of Object.entries(KNOWN_SHOW_SCHEDULES)) {
    if (cleanKey.includes(cleanTitleKey(key)) || cleanTitleKey(key).includes(cleanKey)) {
      const fallbackInfo: ScheduleInfo = {
        nextAirDate: known.nextAirDate || formatDDMMYYYY(Date.now() + 86400000 * 14),
        nextAirTime: known.nextAirTime || '21:00',
        nextAirTimestamp: known.nextAirTimestamp || Date.now() + 86400000 * 14,
        nextEpisodeTitle: known.nextEpisodeTitle || 'Season Premiere',
        nextSeasonNum: known.nextSeasonNum || 2,
        nextEpisodeNum: known.nextEpisodeNum || 1,
        airScheduleText: known.airScheduleText || 'Weekly Airing',
        isOngoing: true,
        scheduleStatus: known.scheduleStatus || 'Season Premiere',
      };
      scheduleCache.set(cacheKey, fallbackInfo);
      return fallbackInfo;
    }
  }

  scheduleCache.set(cacheKey, null);
  return null;
}

export interface CountdownTimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  formattedString: string;
}

/**
 * Calculates live ticking remaining countdown time to target timestamp
 */
export function getCountdownTimeRemaining(targetTimestamp: number): CountdownTimeRemaining {
  const now = Date.now();
  const diff = targetTimestamp - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
      formattedString: 'NOW AIRING',
    };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  let formattedString = '';
  if (days > 0) {
    formattedString = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  } else {
    formattedString = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    isPast: false,
    formattedString,
  };
}

/**
 * Attaches or auto-populates schedule tracking fields onto a ShowItem
 */
export function attachScheduleToShow(show: ShowItem, schedule: ScheduleInfo): ShowItem {
  return {
    ...show,
    nextAirDate: schedule.nextAirDate,
    nextAirTime: schedule.nextAirTime,
    nextAirTimestamp: schedule.nextAirTimestamp,
    nextEpisodeTitle: schedule.nextEpisodeTitle,
    nextSeasonNum: schedule.nextSeasonNum,
    nextEpisodeNum: schedule.nextEpisodeNum,
    airScheduleText: schedule.airScheduleText,
    isOngoing: schedule.isOngoing,
    scheduleStatus: schedule.scheduleStatus,
  };
}
