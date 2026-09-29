import { ShowType } from '../types';
import { getPosterForShow, getBackdropForShow } from '../data/mediaAssets';

export interface PosterSearchResult {
  posterUrl: string;
  backdropUrl?: string;
  matchedTitle: string;
  year?: string;
  genre?: string;
  synopsis?: string;
  type?: ShowType;
  detectedPlatform?: string;
  maxEp?: string;
  seasons?: string;
  cast?: string;
  imdbId?: string;
  source: 'imdb' | 'fallback';
}

export interface PosterCandidate {
  id: string;
  title: string;
  posterUrl: string;
  year?: string;
  type?: string;
  source: string;
  detectedPlatform?: string;
  maxEp?: string;
  cast?: string;
}

export interface LiveSearchItem {
  id: string;
  title: string;
  year?: string;
  type: ShowType;
  posterUrl: string;
  backdropUrl?: string;
  genre?: string;
  synopsis?: string;
  cast?: string;
  platform?: string;
  maxEp?: string;
  imdbId?: string;
  source: 'imdb';
}

// In-memory cache to prevent excessive requests
const searchCache = new Map<string, { result: PosterSearchResult | null; candidates: PosterCandidate[] }>();
const liveSearchCache = new Map<string, LiveSearchItem[]>();

/**
 * Normalizes text for comparison (removes accents, punctuation, lowercase)
 */
function cleanString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Detects the streaming platform from show title & keywords
 */
export function detectPlatformFromTitle(title?: string): string | undefined {
  if (!title) return undefined;
  const clean = title.toLowerCase().trim();

  // 1. Apple TV+
  if (
    clean.includes('ted lasso') ||
    clean.includes('severance') ||
    clean.includes('slow horses') ||
    clean.includes('morning show') ||
    clean.includes('silo') ||
    clean.includes('foundation') ||
    clean.includes('shrinking') ||
    clean.includes('black bird') ||
    clean.includes('pachinko') ||
    clean.includes('for all mankind') ||
    clean.includes('bad sisters') ||
    clean.includes('presumed innocent') ||
    clean.includes('sugar') ||
    clean.includes('dark matter') ||
    clean.includes('monarch')
  ) {
    return '🟣 Apple Tv+';
  }

  // 2. Netflix
  if (
    clean.includes('stranger things') ||
    clean.includes('squid game') ||
    clean.includes('wednesday') ||
    clean.includes('bridgerton') ||
    clean.includes('the crown') ||
    clean.includes('ozark') ||
    clean.includes('black mirror') ||
    clean.includes('money heist') ||
    clean.includes('dark') ||
    clean.includes('you') ||
    clean.includes('cobra kai') ||
    clean.includes('the witcher') ||
    clean.includes('heartstopper') ||
    clean.includes('beef') ||
    clean.includes('3 body problem') ||
    clean.includes('one piece') ||
    clean.includes('avatar: the last airbender')
  ) {
    return '📺 Netflix';
  }

  // 3. Max / HBO
  if (
    clean.includes('last of us') ||
    clean.includes('game of thrones') ||
    clean.includes('house of the dragon') ||
    clean.includes('succession') ||
    clean.includes('sopranos') ||
    clean.includes('the wire') ||
    clean.includes('chernobyl') ||
    clean.includes('euphoria') ||
    clean.includes('white lotus') ||
    clean.includes('barry') ||
    clean.includes('true detective') ||
    clean.includes('peacemaker') ||
    clean.includes('hacks') ||
    clean.includes('penguin') ||
    clean.includes('dune: prophecy') ||
    clean.includes('curb your enthusiasm')
  ) {
    return '🟪 Max / Hbo';
  }

  // 4. Prime Video
  if (
    clean.includes('the boys') ||
    clean.includes('fallout') ||
    clean.includes('rings of power') ||
    clean.includes('invincible') ||
    clean.includes('reacher') ||
    clean.includes('fleabag') ||
    clean.includes('wheel of time') ||
    clean.includes('jack ryan') ||
    clean.includes('good omens') ||
    clean.includes('mrs. maisel') ||
    clean.includes('gen v') ||
    clean.includes('citadel') ||
    clean.includes('mr. & mrs. smith')
  ) {
    return '🛒 Prime Video';
  }

  // 5. Disney+
  if (
    clean.includes('loki') ||
    clean.includes('mandalorian') ||
    clean.includes('andor') ||
    clean.includes('wandavision') ||
    clean.includes('ahsoka') ||
    clean.includes('the bear') ||
    clean.includes('shogun') ||
    clean.includes('shōgun') ||
    clean.includes('only murders in the building') ||
    clean.includes('percy jackson') ||
    clean.includes('agatha') ||
    clean.includes('daredevil') ||
    clean.includes('acolyte') ||
    clean.includes('star wars')
  ) {
    return '⚡ Disney+';
  }

  // 6. Paramount+
  if (
    clean.includes('yellowstone') ||
    clean.includes('yellowjackets') ||
    clean.includes('halo') ||
    clean.includes('tulsa king') ||
    clean.includes('mayor of kingstown') ||
    clean.includes('1883') ||
    clean.includes('1923') ||
    clean.includes('lioness') ||
    clean.includes('star trek') ||
    clean.includes('knuckles')
  ) {
    return '🟥 Paramount+';
  }

  return undefined;
}

/**
 * Queries OMDb API for high-resolution official IMDb posters and metadata (supports both titles and IMDb IDs/URLs)
 */
async function searchOMDb(
  query: string,
  preferredType?: ShowType
): Promise<{ posterUrl?: string; synopsis?: string; year?: string; genre?: string; title?: string; type?: ShowType; imdbId?: string }> {
  try {
    const trimmed = query.trim();
    const idMatch = trimmed.match(/(tt\d+)/i);
    let param = idMatch ? `i=${idMatch[1]}` : `t=${encodeURIComponent(trimmed)}`;
    if (!idMatch && preferredType) {
      param += `&type=${preferredType === 'Movie' ? 'movie' : 'series'}`;
    }

    const res = await fetch(`https://www.omdbapi.com/?${param}&apikey=trilogy`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return {};
    const data = await res.json();
    if (data && data.Response === 'True') {
      const posterUrl = data.Poster && data.Poster !== 'N/A' ? data.Poster : undefined;
      const synopsis = data.Plot && data.Plot !== 'N/A' ? data.Plot : undefined;
      const year = data.Year && data.Year !== 'N/A' ? data.Year.substring(0, 4) : undefined;
      const genre = data.Genre && data.Genre !== 'N/A' ? data.Genre.split(',')[0].trim() : undefined;
      const title = data.Title && data.Title !== 'N/A' ? data.Title : undefined;
      const type = data.Type === 'movie' ? 'Movie' : 'Series';
      const imdbId = data.imdbID;
      return { posterUrl, synopsis, year, genre, title, type, imdbId };
    }
  } catch {
    // Ignore error
  }
  return {};
}

/**
 * Searches IMDb's official suggestion engine for ultra-accurate movie & TV metadata and high-res posters
 */
export async function searchIMDb(
  query: string,
  preferredType?: ShowType
): Promise<{ result: PosterSearchResult | null; candidates: PosterCandidate[]; liveItems: LiveSearchItem[] }> {
  try {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return { result: null, candidates: [], liveItems: [] };

    const candidates: PosterCandidate[] = [];
    const liveItems: LiveSearchItem[] = [];
    let bestMatch: PosterSearchResult | null = null;

    // 1. Check OMDb first (handles direct IMDb IDs like tt27675583 and exact title lookups reliably)
    const idMatch = trimmed.match(/(tt\d+)/i);
    const omdbData = await searchOMDb(trimmed, preferredType);
    if (omdbData.posterUrl || omdbData.title) {
      const matchTitle = omdbData.title || trimmed;
      const detectedPlatform = detectPlatformFromTitle(matchTitle);
      bestMatch = {
        posterUrl: omdbData.posterUrl!,
        backdropUrl: omdbData.posterUrl,
        matchedTitle: matchTitle,
        year: omdbData.year,
        genre: omdbData.genre,
        synopsis: omdbData.synopsis,
        type: omdbData.type || 'Series',
        imdbId: omdbData.imdbId,
        detectedPlatform,
        source: 'imdb',
      };

      liveItems.push({
        id: `omdb-${omdbData.imdbId || '1'}`,
        title: matchTitle,
        year: omdbData.year,
        type: omdbData.type || 'Series',
        posterUrl: omdbData.posterUrl!,
        backdropUrl: omdbData.posterUrl,
        genre: omdbData.genre,
        synopsis: omdbData.synopsis,
        platform: detectedPlatform,
        imdbId: omdbData.imdbId,
        source: 'imdb',
      });

      candidates.push({
        id: `omdb-${omdbData.imdbId || '1'}`,
        title: matchTitle,
        posterUrl: omdbData.posterUrl!,
        year: omdbData.year,
        type: omdbData.type || 'Series',
        source: 'IMDb',
        detectedPlatform,
      });

      // If query was a direct IMDb URL or ID, return exact official match immediately!
      if (idMatch) {
        return { result: bestMatch, candidates, liveItems };
      }
    }

    const clean = cleanString(trimmed);
    if (!clean) {
      return { result: bestMatch, candidates, liveItems };
    }

    let data: any = null;

    // 2. IMDb v3 suggestion endpoint
    try {
      const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(clean)}.json`, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch {
      // Ignore
    }

    // 3. IMDb v2 suggestion fallback
    if (!data || !Array.isArray(data.d) || data.d.length === 0) {
      try {
        const firstChar = clean[0].toLowerCase();
        const res2 = await fetch(`https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(clean)}.json`, {
          signal: AbortSignal.timeout(3500),
        });
        if (res2.ok) {
          data = await res2.json();
        }
      } catch {
        // Ignore
      }
    }

    const cleanQuery = cleanString(trimmed);

    if (data && Array.isArray(data.d)) {
      for (const item of data.d) {
        if (!item || !item.l) continue;
        const qLower = (item.q || item.qid || '').toLowerCase();
        if (item.qid === 'person' || qLower === 'actor' || qLower === 'actress' || qLower === 'director') continue;

        const titleName = String(item.l).trim();
        const cleanTitle = cleanString(titleName);

        const isMovie = qLower.includes('feature') || qLower.includes('movie') || qLower.includes('film');
        const isSeries = qLower.includes('series') || qLower.includes('tv') || qLower.includes('mini') || qLower.includes('episode');
        const detectedType: ShowType = isMovie ? 'Movie' : isSeries ? 'Series' : 'Series';

        const year = (cleanTitle === cleanQuery && omdbData.year) ? omdbData.year : (item.y ? String(item.y) : item.yr ? String(item.yr).split('–')[0].trim() : omdbData.year);
        let rawPoster = item.i?.imageUrl || '';
        if (rawPoster) {
          rawPoster = rawPoster.replace(/_V1_.*\.jpg$/, '_V1_FMjpg_UX800_.jpg');
        }

        const posterUrl = rawPoster || omdbData.posterUrl || getPosterForShow(titleName, omdbData.genre || 'Drama');
        const backdropUrl = rawPoster || omdbData.posterUrl || getBackdropForShow(titleName, omdbData.genre || 'Drama');

        const detectedPlatform = detectPlatformFromTitle(titleName);

        // Check if already added
        if (liveItems.some((li) => cleanString(li.title) === cleanTitle)) continue;

        const liveItem: LiveSearchItem = {
          id: `imdb-${item.id || Math.random()}`,
          title: titleName,
          year,
          type: detectedType,
          posterUrl,
          backdropUrl,
          cast: item.s,
          platform: detectedPlatform,
          imdbId: item.id,
          source: 'imdb',
        };
        liveItems.push(liveItem);

        candidates.push({
          id: `imdb-${item.id || Math.random()}`,
          title: titleName,
          posterUrl,
          year,
          type: detectedType,
          source: 'IMDb',
          detectedPlatform,
          cast: item.s,
        });

        const matchObj: PosterSearchResult = {
          posterUrl,
          backdropUrl,
          matchedTitle: titleName,
          year,
          genre: omdbData.genre,
          synopsis: omdbData.synopsis,
          type: detectedType,
          cast: item.s,
          imdbId: item.id,
          detectedPlatform,
          source: 'imdb',
        };

        if (!bestMatch) {
          bestMatch = matchObj;
        } else if (cleanTitle === cleanQuery && (!preferredType || matchObj.type === preferredType)) {
          bestMatch = matchObj;
        }
      }
    }

    return { result: bestMatch, candidates, liveItems };
  } catch {
    return { result: null, candidates: [], liveItems: [] };
  }
}

/**
 * IMDb live search suggestions
 */
export async function searchLiveSuggestions(
  query: string,
  preferredType?: ShowType
): Promise<LiveSearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = `imdb_live__${trimmed.toLowerCase()}__${preferredType || 'all'}`;
  if (liveSearchCache.has(cacheKey)) {
    return liveSearchCache.get(cacheKey)!;
  }

  try {
    const imdbRes = await searchIMDb(trimmed, preferredType);
    let items = imdbRes.liveItems.slice(0, 8);

    if (items.length === 0) {
      // Fallback OMDb direct suggestion if IMDb v3 suggestions return empty
      const omdb = await searchOMDb(trimmed, preferredType);
      if (omdb.posterUrl) {
        items = [{
          id: 'omdb-fallback-1',
          title: trimmed,
          year: omdb.year,
          type: preferredType || 'Series',
          posterUrl: omdb.posterUrl,
          backdropUrl: omdb.posterUrl,
          genre: omdb.genre,
          synopsis: omdb.synopsis,
          platform: detectPlatformFromTitle(trimmed),
          source: 'imdb',
        }];
      }
    }

    liveSearchCache.set(cacheKey, items);
    return items;
  } catch {
    return [];
  }
}

/**
 * Automatically fetches high-definition official poster artwork and metadata exclusively from IMDb & OMDb
 */
export async function autoFetchPoster(
  title: string,
  preferredType: ShowType = 'Series',
  genre: string = 'Drama'
): Promise<{ result: PosterSearchResult; candidates: PosterCandidate[] }> {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length < 2) {
    const defaultPoster = getPosterForShow(trimmed, genre);
    const defaultBackdrop = getBackdropForShow(trimmed, genre);
    return {
      result: {
        posterUrl: defaultPoster,
        backdropUrl: defaultBackdrop,
        matchedTitle: trimmed,
        genre,
        type: preferredType,
        source: 'fallback',
      },
      candidates: [],
    };
  }

  const cacheKey = `imdb_omdb__${trimmed.toLowerCase()}__${preferredType}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)!;
    if (cached.result) {
      return { result: cached.result, candidates: cached.candidates };
    }
  }

  const imdbRes = await searchIMDb(trimmed, preferredType);
  let finalResult: PosterSearchResult | null = imdbRes.result;

  if (finalResult) {
    if (!finalResult.genre) {
      finalResult.genre = genre;
    }
    if (!finalResult.detectedPlatform) {
      finalResult.detectedPlatform = detectPlatformFromTitle(finalResult.matchedTitle);
    }
  }

  if (!finalResult || !finalResult.posterUrl || finalResult.posterUrl.includes('placeholder')) {
    const defaultPoster = getPosterForShow(trimmed, genre);
    const defaultBackdrop = getBackdropForShow(trimmed, genre);
    finalResult = {
      posterUrl: defaultPoster,
      backdropUrl: defaultBackdrop,
      matchedTitle: trimmed,
      genre,
      type: preferredType,
      source: 'fallback',
    };
  }

  const output = {
    result: finalResult,
    candidates: imdbRes.candidates.length > 0 ? imdbRes.candidates.slice(0, 8) : [{
      id: 'fallback-1',
      title: trimmed,
      posterUrl: finalResult.posterUrl,
      source: 'IMDb'
    }],
  };

  searchCache.set(cacheKey, output);
  return output;
}

/**
 * Returns direct IMDb URL for title (e.g. https://www.imdb.com/title/tt1234567/).
 * If existingImdbId is missing, dynamically looks up the IMDb ID by title.
 */
export async function getOrFetchImdbUrl(
  title: string,
  existingImdbId?: string
): Promise<string> {
  if (existingImdbId && existingImdbId.startsWith('tt')) {
    return `https://www.imdb.com/title/${existingImdbId}/`;
  }

  const trimmed = title.trim();
  const idMatch = trimmed.match(/(tt\d+)/i);
  if (idMatch) {
    return `https://www.imdb.com/title/${idMatch[1]}/`;
  }

  try {
    const omdb = await searchOMDb(trimmed);
    if (omdb.imdbId) {
      return `https://www.imdb.com/title/${omdb.imdbId}/`;
    }

    const imdbRes = await searchIMDb(trimmed);
    if (imdbRes.result?.imdbId) {
      return `https://www.imdb.com/title/${imdbRes.result.imdbId}/`;
    }

    if (imdbRes.liveItems && imdbRes.liveItems[0]?.imdbId) {
      return `https://www.imdb.com/title/${imdbRes.liveItems[0].imdbId}/`;
    }
  } catch (err) {
    console.warn('IMDb ID resolve notice:', err);
  }

  return `https://www.imdb.com/find?q=${encodeURIComponent(trimmed)}`;
}
