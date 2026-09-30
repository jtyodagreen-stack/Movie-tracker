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
  source: 'imdb' | 'tvmaze' | 'wikipedia' | 'omdb' | 'fallback';
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
  source: 'imdb' | 'tvmaze' | 'wikipedia' | 'omdb';
}

// In-memory cache to prevent redundant network requests
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
    clean.includes('monarch') ||
    clean.includes('defending jacob')
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
    clean.includes('avatar: the last airbender') ||
    clean.includes('peaky blinders') ||
    clean.includes('narcos') ||
    clean.includes('mindhunter') ||
    clean.includes('queen\'s gambit')
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
    clean.includes('curb your enthusiasm') ||
    clean.includes('station eleven') ||
    clean.includes('watchmen')
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
    clean.includes('mr. & mrs. smith') ||
    clean.includes('bosch') ||
    clean.includes('upload')
  ) {
    return '📦 Prime Video';
  }

  // 5. Disney+
  if (
    clean.includes('mandalorian') ||
    clean.includes('loki') ||
    clean.includes('andor') ||
    clean.includes('wanda vision') ||
    clean.includes('wandavision') ||
    clean.includes('ahsoka') ||
    clean.includes('bear') ||
    clean.includes('shogun') ||
    clean.includes('only murders') ||
    clean.includes('acolyte') ||
    clean.includes('agatha all along') ||
    clean.includes('percy jackson') ||
    clean.includes('daredevil') ||
    clean.includes('bad batch') ||
    clean.includes('x-men 97') ||
    clean.includes('skeleton crew')
  ) {
    return '🏰 Disney+';
  }

  // 6. Paramount+
  if (
    clean.includes('yellowstone') ||
    clean.includes('1883') ||
    clean.includes('1923') ||
    clean.includes('mayor of kingstown') ||
    clean.includes('tulsa king') ||
    clean.includes('star trek') ||
    clean.includes('halo') ||
    clean.includes('special ops: lioness') ||
    clean.includes('landman')
  ) {
    return '🔵 Paramount+';
  }

  // 7. Sky / NOW
  if (
    clean.includes('gangs of london') ||
    clean.includes('day of the jackal') ||
    clean.includes('gomorrah') ||
    clean.includes('babylon berlin') ||
    clean.includes('riviera') ||
    clean.includes('sweetpea')
  ) {
    return '🌐 Sky / Now';
  }

  return undefined;
}

/**
 * Searches OMDb API
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
      signal: AbortSignal.timeout(3000),
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
 * Searches TVMaze API (100% free, unmetered, comprehensive TV database with HD posters & schedule)
 */
async function searchTVMaze(query: string): Promise<LiveSearchItem[]> {
  try {
    const cleanQ = query.trim();
    if (!cleanQ) return [];

    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanQ)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];

    const data: Array<{ show: any }> = await res.json();
    if (!Array.isArray(data)) return [];

    const results: LiveSearchItem[] = [];

    for (const item of data) {
      const show = item.show;
      if (!show || !show.name) continue;

      const title = show.name;
      const year = show.premiered ? show.premiered.substring(0, 4) : undefined;
      const posterUrl = show.image?.original || show.image?.medium || '';
      const genre = Array.isArray(show.genres) && show.genres.length > 0 ? show.genres[0] : 'Drama';
      const synopsis = show.summary ? show.summary.replace(/<[^>]+>/g, '').trim() : undefined;
      const imdbId = show.externals?.imdb || undefined;
      const detectedPlatform = detectPlatformFromTitle(title) || (show.webChannel?.name ? `📺 ${show.webChannel.name}` : show.network?.name ? `📺 ${show.network.name}` : undefined);

      results.push({
        id: `tvmaze-${show.id}`,
        title,
        year,
        type: 'Series',
        posterUrl,
        backdropUrl: posterUrl,
        genre,
        synopsis,
        platform: detectedPlatform,
        imdbId,
        source: 'tvmaze',
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Searches Wikipedia API (100% global coverage for movies, classics, anime, and shows with HD media posters)
 */
async function searchWikipedia(query: string): Promise<LiveSearchItem[]> {
  try {
    const cleanQ = query.trim();
    if (!cleanQ || cleanQ.length < 2) return [];

    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(
      cleanQ + ' film OR television series'
    )}&gsrlimit=5&prop=pageimages|extracts|info&pithumbsize=1000&exintro=1&explaintext=1`;

    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return [];

    const results: LiveSearchItem[] = [];

    for (const pageId in pages) {
      const page = pages[pageId];
      if (!page || !page.title) continue;

      let cleanTitle = page.title
        .replace(/\s*\((film|movie|TV series|series|miniseries|anime|season \d+)[^)]*\)/i, '')
        .trim();

      const posterUrl = page.thumbnail?.source || '';
      const synopsis = page.extract ? page.extract.substring(0, 300).trim() + '...' : undefined;
      const isMovie = page.title.toLowerCase().includes('film') || page.title.toLowerCase().includes('movie');

      results.push({
        id: `wiki-${page.pageid}`,
        title: cleanTitle,
        type: isMovie ? 'Movie' : 'Series',
        posterUrl,
        backdropUrl: posterUrl,
        synopsis,
        platform: detectPlatformFromTitle(cleanTitle),
        source: 'wikipedia',
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Searches IMDb's official suggestion engine across multiple formats and endpoints
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

    // 1. Check direct IMDb ID or URL (e.g. tt1234567 or imdb.com/title/tt...)
    const idMatch = trimmed.match(/(tt\d+)/i);
    const omdbData = await searchOMDb(trimmed, preferredType);
    if (omdbData.posterUrl || omdbData.title) {
      const matchTitle = omdbData.title || trimmed;
      const detectedPlatform = detectPlatformFromTitle(matchTitle);
      bestMatch = {
        posterUrl: omdbData.posterUrl || getPosterForShow(matchTitle, omdbData.genre || 'Drama'),
        backdropUrl: omdbData.posterUrl || getBackdropForShow(matchTitle, omdbData.genre || 'Drama'),
        matchedTitle: matchTitle,
        year: omdbData.year,
        genre: omdbData.genre,
        synopsis: omdbData.synopsis,
        type: omdbData.type || preferredType || 'Series',
        imdbId: omdbData.imdbId,
        detectedPlatform,
        source: 'imdb',
      };

      liveItems.push({
        id: `omdb-${omdbData.imdbId || '1'}`,
        title: matchTitle,
        year: omdbData.year,
        type: omdbData.type || preferredType || 'Series',
        posterUrl: omdbData.posterUrl || getPosterForShow(matchTitle, omdbData.genre || 'Drama'),
        backdropUrl: omdbData.posterUrl,
        genre: omdbData.genre,
        synopsis: omdbData.synopsis,
        platform: detectedPlatform,
        imdbId: omdbData.imdbId,
        source: 'omdb',
      });

      candidates.push({
        id: `omdb-${omdbData.imdbId || '1'}`,
        title: matchTitle,
        posterUrl: omdbData.posterUrl || getPosterForShow(matchTitle, omdbData.genre || 'Drama'),
        year: omdbData.year,
        type: omdbData.type || preferredType || 'Series',
        source: 'IMDb',
        detectedPlatform,
      });

      if (idMatch) {
        return { result: bestMatch, candidates, liveItems };
      }
    }

    // 2. Format query properly for IMDb endpoints (using underscore encoding and space encoding)
    const rawLower = trimmed.toLowerCase();
    const queryUnder = rawLower.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const firstChar = queryUnder[0] || 'a';

    let imdbData: any = null;

    // Try IMDb endpoints in parallel with timeout
    const imdbUrls = [
      `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(queryUnder)}.json`,
      `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(queryUnder)}.json`,
      `https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(queryUnder)}.json`,
      `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(cleanString(trimmed))}.json`,
    ];

    for (const u of imdbUrls) {
      try {
        const res = await fetch(u, { signal: AbortSignal.timeout(2800) });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.d) && json.d.length > 0) {
            imdbData = json;
            break;
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    const cleanQuery = cleanString(trimmed);

    // Process IMDb response items
    if (imdbData && Array.isArray(imdbData.d)) {
      for (const item of imdbData.d) {
        if (!item || !item.l) continue;
        const qLower = (item.q || item.qid || '').toLowerCase();
        
        // Strict Filter: Exclude people, actors, directors, writers, video games, podcasts, music albums, etc.
        if (
          item.qid === 'person' ||
          qLower.includes('actor') ||
          qLower.includes('actress') ||
          qLower.includes('director') ||
          qLower.includes('writer') ||
          qLower.includes('producer') ||
          qLower.includes('video game') ||
          qLower.includes('podcast') ||
          qLower.includes('music') ||
          qLower.includes('game')
        ) {
          continue;
        }

        const titleName = String(item.l).trim();
        const cleanTitle = cleanString(titleName);

        const isMovie = qLower.includes('feature') || qLower.includes('movie') || qLower.includes('film');
        const isSeries = qLower.includes('series') || qLower.includes('tv') || qLower.includes('mini') || qLower.includes('episode') || qLower.includes('show');
        
        // Focus strictly on movies and series/TV
        if (!isMovie && !isSeries && qLower && !qLower.includes('feature') && !qLower.includes('series') && !qLower.includes('tv')) {
          continue;
        }

        const detectedType: ShowType = isMovie ? 'Movie' : 'Series';

        const year = (cleanTitle === cleanQuery && omdbData.year) ? omdbData.year : (item.y ? String(item.y) : item.yr ? String(item.yr).split('–')[0].trim() : omdbData.year);
        
        let rawPoster = item.i?.imageUrl || '';
        if (rawPoster) {
          rawPoster = rawPoster.replace(/_V1_.*\.jpg$/, '_V1_FMjpg_UX1000_.jpg');
        }

        const posterUrl = rawPoster || omdbData.posterUrl || getPosterForShow(titleName, omdbData.genre || 'Drama');
        const backdropUrl = rawPoster || omdbData.posterUrl || getBackdropForShow(titleName, omdbData.genre || 'Drama');
        const detectedPlatform = detectPlatformFromTitle(titleName);

        if (!liveItems.some((li) => cleanString(li.title) === cleanTitle)) {
          liveItems.push({
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
          });
        }

        if (!candidates.some((c) => cleanString(c.title) === cleanTitle)) {
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
        }

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
        } else if (cleanTitle === cleanQuery) {
          bestMatch = matchObj;
        }
      }
    }

    // 3. Fallback to TVMaze & Wikipedia if IMDb results are sparse
    if (liveItems.length < 4) {
      const [tvmazeItems, wikiItems] = await Promise.all([
        searchTVMaze(trimmed),
        searchWikipedia(trimmed),
      ]);

      for (const item of tvmazeItems) {
        if (!liveItems.some((li) => cleanString(li.title) === cleanString(item.title))) {
          liveItems.push(item);
          candidates.push({
            id: item.id,
            title: item.title,
            posterUrl: item.posterUrl,
            year: item.year,
            type: item.type,
            source: 'TVMaze',
            detectedPlatform: item.platform,
          });
          if (!bestMatch && item.posterUrl) {
            bestMatch = {
              posterUrl: item.posterUrl,
              backdropUrl: item.backdropUrl,
              matchedTitle: item.title,
              year: item.year,
              genre: item.genre,
              synopsis: item.synopsis,
              type: item.type,
              imdbId: item.imdbId,
              detectedPlatform: item.platform,
              source: 'tvmaze',
            };
          }
        }
      }

      for (const item of wikiItems) {
        if (!liveItems.some((li) => cleanString(li.title) === cleanString(item.title))) {
          liveItems.push(item);
          candidates.push({
            id: item.id,
            title: item.title,
            posterUrl: item.posterUrl,
            year: item.year,
            type: item.type,
            source: 'Wikipedia',
            detectedPlatform: item.platform,
          });
          if (!bestMatch && item.posterUrl) {
            bestMatch = {
              posterUrl: item.posterUrl,
              backdropUrl: item.backdropUrl,
              matchedTitle: item.title,
              year: item.year,
              genre: item.genre,
              synopsis: item.synopsis,
              type: item.type,
              detectedPlatform: item.platform,
              source: 'wikipedia',
            };
          }
        }
      }
    }

    return { result: bestMatch, candidates, liveItems };
  } catch (err) {
    console.warn('IMDb search engine error:', err);
    return { result: null, candidates: [], liveItems: [] };
  }
}

/**
 * Live search suggestions with 100% guarantee
 */
export async function searchLiveSuggestions(
  query: string,
  preferredType?: ShowType
): Promise<LiveSearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = `live_sug_${trimmed.toLowerCase()}__${preferredType || 'all'}`;
  if (liveSearchCache.has(cacheKey)) {
    return liveSearchCache.get(cacheKey)!;
  }

  try {
    const imdbRes = await searchIMDb(trimmed, preferredType);
    let items = imdbRes.liveItems.slice(0, 10);

    // If still empty, add default candidate
    if (items.length === 0) {
      items = [
        {
          id: 'typed-entry-1',
          title: trimmed,
          type: preferredType || 'Series',
          posterUrl: getPosterForShow(trimmed, 'Drama'),
          backdropUrl: getBackdropForShow(trimmed, 'Drama'),
          platform: detectPlatformFromTitle(trimmed),
          source: 'imdb',
        },
      ];
    }

    liveSearchCache.set(cacheKey, items);
    return items;
  } catch {
    return [
      {
        id: 'typed-entry-fallback',
        title: trimmed,
        type: preferredType || 'Series',
        posterUrl: getPosterForShow(trimmed, 'Drama'),
        backdropUrl: getBackdropForShow(trimmed, 'Drama'),
        platform: detectPlatformFromTitle(trimmed),
        source: 'imdb',
      },
    ];
  }
}

/**
 * Automatically fetches high-definition official poster artwork and metadata
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

  const cacheKey = `auto_fetch_${trimmed.toLowerCase()}__${preferredType}`;
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

  if (!finalResult || !finalResult.posterUrl) {
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
    candidates:
      imdbRes.candidates.length > 0
        ? imdbRes.candidates.slice(0, 10)
        : [
            {
              id: 'fallback-1',
              title: trimmed,
              posterUrl: finalResult.posterUrl,
              source: 'IMDb',
            },
          ],
  };

  searchCache.set(cacheKey, output);
  return output;
}

/**
 * Returns direct IMDb URL for title (e.g. https://www.imdb.com/title/tt1234567/).
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
