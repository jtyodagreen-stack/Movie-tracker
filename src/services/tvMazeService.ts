export interface TvMazeEpisode {
  id: number;
  url: string;
  name: string;
  season: number;
  number: number;
  airdate: string;
  airtime: string;
  airstamp: string;
  runtime: number;
  summary?: string;
}

export interface TvMazeShowInfo {
  id: number;
  name: string;
  status: string; // "Running", "Ended", "To Be Determined", "In Development"
  premiered?: string;
  officialSite?: string;
  nextEpisode?: TvMazeEpisode;
  previousEpisode?: TvMazeEpisode;
}

// In-memory cache for fast instant lookups across cards & modals
const tvMazeMemoryCache = new Map<string, TvMazeShowInfo | null>();

/**
 * Searches TVMaze for a given show title and returns embedded next/previous episode details
 */
export async function fetchLiveTvMazeInfo(title: string): Promise<TvMazeShowInfo | null> {
  if (!title || title.trim().length < 2) return null;

  const cleanKey = title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (tvMazeMemoryCache.has(cleanKey)) {
    return tvMazeMemoryCache.get(cleanKey) || null;
  }

  try {
    const trimmed = title.trim();
    const idMatch = trimmed.match(/(tt\d+)/i);
    let data: any = null;

    if (idMatch) {
      // Direct IMDb ID lookup on TVMaze
      const lookupRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${idMatch[1]}`);
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        if (lookupData && lookupData.id) {
          const detailRes = await fetch(`https://api.tvmaze.com/shows/${lookupData.id}?embed[]=nextepisode&embed[]=previousepisode&embed[]=episodes`);
          if (detailRes.ok) {
            data = await detailRes.json();
          } else {
            data = lookupData;
          }
        }
      }
    }

    if (!data) {
      // Clean URL if present and query TVMaze single search
      const cleanTitle = trimmed.replace(/https?:\/\/[^\s]+/gi, '').trim() || trimmed;
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}&embed[]=nextepisode&embed[]=previousepisode&embed[]=episodes`;
      const res = await fetch(url);
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback to general search query
        try {
          const searchRes = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanTitle)}`);
          if (searchRes.ok) {
            const searchResults = await searchRes.json();
            if (Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0].show?.id) {
              const showId = searchResults[0].show.id;
              const detailRes = await fetch(`https://api.tvmaze.com/shows/${showId}?embed[]=nextepisode&embed[]=previousepisode&embed[]=episodes`);
              if (detailRes.ok) {
                data = await detailRes.json();
              }
            }
          }
        } catch {
          // ignore fallback error
        }
      }
    }

    if (!data) {
      tvMazeMemoryCache.set(cleanKey, null);
      return null;
    }

    const showInfo: TvMazeShowInfo = {
      id: data.id,
      name: data.name,
      status: data.status,
      premiered: data.premiered,
      officialSite: data.officialSite,
    };

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    if (data._embedded) {
      if (data._embedded.nextepisode) {
        const nextEp = data._embedded.nextepisode;
        const nextTime = nextEp.airstamp ? new Date(nextEp.airstamp).getTime() : (nextEp.airdate ? new Date(`${nextEp.airdate}T${nextEp.airtime || '00:00'}`).getTime() : 0);
        // If nextEpisode is future or within 24h of airing, use it
        if (nextTime >= now - TWENTY_FOUR_HOURS_MS) {
          showInfo.nextEpisode = nextEp;
        }
      }

      if (data._embedded.previousepisode) {
        showInfo.previousEpisode = data._embedded.previousepisode;
      }

      // If nextEpisode wasn't set or is already in the past (> 24h ago), search upcoming episodes list for the next future air date
      if (!showInfo.nextEpisode && Array.isArray(data._embedded.episodes)) {
        const upcomingEp = data._embedded.episodes.find((ep: TvMazeEpisode) => {
          if (!ep) return false;
          const epTime = ep.airstamp
            ? new Date(ep.airstamp).getTime()
            : ep.airdate
            ? new Date(`${ep.airdate}T${ep.airtime || '00:00'}`).getTime()
            : 0;
          return epTime > now - TWENTY_FOUR_HOURS_MS;
        });

        if (upcomingEp) {
          showInfo.nextEpisode = upcomingEp;
        }
      }
    }

    tvMazeMemoryCache.set(cleanKey, showInfo);
    return showInfo;
  } catch (err) {
    console.warn('TVMaze fetch error:', err);
    return null;
  }
}
