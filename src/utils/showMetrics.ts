import { ShowItem } from '../types';
import { parseAnyDate } from './dateUtils';
import { getShowAddedTimestamp } from './addTimestampStore';

/**
 * Normalizes and extracts numeric rating (1-5) from ratingNum or rating string.
 */
export function getShowRatingNumber(show: ShowItem): number {
  if (typeof show.ratingNum === 'number' && show.ratingNum > 0) {
    return show.ratingNum;
  }
  if (!show.rating) return 0;

  const str = String(show.rating).toLowerCase().trim();

  // Count star emojis if present
  const starCount = (str.match(/⭐/g) || []).length;
  if (starCount > 0) return starCount;

  // Text keyword matching
  if (str.includes('excellent') || str.includes('5 star') || str.includes('masterpiece') || str.includes('5/5')) return 5;
  if (str.includes('great') || str.includes('4 star') || str.includes('4/5')) return 4;
  if (str.includes('good') || str.includes('3 star') || str.includes('3/5')) return 3;
  if (str.includes('fair') || str.includes('2 star') || str.includes('2/5')) return 2;
  if (str.includes('poor') || str.includes('1 star') || str.includes('1/5')) return 1;

  // Parse leading numbers e.g. "4.5", "5"
  const match = str.match(/^([1-5])(\.[0-9])?/);
  if (match) {
    return Math.min(5, Math.max(1, parseFloat(match[0])));
  }

  return 0;
}

/**
 * Returns true if the show has a 4 or 5 star rating (Masterpiece / Top Rated).
 */
export function isTopRatedShow(show: ShowItem): boolean {
  return getShowRatingNumber(show) >= 4;
}

/**
 * Calculates standardized progress percentage (0 - 100) for a show or movie.
 * - For Movies (type === 'Movie'):
 *   - Watched -> 100%
 *   - Watching / In Progress / Paused -> 50%
 *   - Not Started / Wishlist -> 0%
 * - For TV Series:
 *   - Watched -> 100%
 *   - Watching -> calculated (episodes / maxEp) * 100 (min 10% when watching)
 */
export function calculateShowProgress(show: ShowItem): number {
  if (!show) return 0;

  const isMovie =
    show.type === 'Movie' ||
    String(show.maxEp || '').toLowerCase().includes('movie') ||
    String(show.episodes || '').toLowerCase().includes('movie') ||
    (parseInt(String(show.maxEp || '').replace(/[^0-9]/g, '')) === 1 &&
      parseInt(String(show.seasons || '').replace(/[^0-9]/g, '')) <= 1);

  const statusStr = String(show.status || '').toLowerCase();
  const isWatched = statusStr.includes('watched') || statusStr.includes('completed') || statusStr.includes('✅');
  const isWatching = statusStr.includes('watching') || statusStr.includes('in progress') || statusStr.includes('⏳');
  const isPaused = statusStr.includes('paused') || statusStr.includes('⏸️');

  if (isMovie) {
    if (isWatched) return 100;
    if (isWatching || isPaused) return 50;

    const curEp = parseInt(String(show.episodes || '').replace(/[^0-9]/g, '')) || 0;
    if (curEp >= 1) return 100;

    return 0;
  }

  // TV Series
  if (isWatched) return 100;

  const currentEpNum = parseInt(String(show.episodes || '').replace(/[^0-9]/g, '')) || 0;
  const maxEpNum = Math.max(1, parseInt(String(show.maxEp || '').replace(/[^0-9]/g, '')) || 8);

  let progress = Math.min(100, Math.max(0, Math.round((currentEpNum / maxEpNum) * 100)));

  if (isWatching && progress === 0) {
    progress = 10;
  }

  return progress;
}

/**
 * Calculates standardized stats across the app.
 */
export function calculateStandardStats(shows: ShowItem[]) {
  const masterShows = shows.filter((s) => !s.isWishlist && s.status !== ('🎁 Wishlist' as any));
  const wishlistShows = shows.filter((s) => s.isWishlist || s.status === ('🎁 Wishlist' as any));

  const watched = shows.filter((s) => s.status === '✅ Watched');
  const watching = shows.filter((s) => s.status === '⏳ Watching');
  const paused = shows.filter((s) => s.status === '⏸️ Paused');
  const dropped = shows.filter((s) => s.status === '❌ Dropped');

  const topRated = shows.filter(isTopRatedShow);

  const movies = shows.filter((s) => s.type === 'Movie');
  const series = shows.filter((s) => s.type === 'Series');

  // Master Tracker Completion Rate (excluding wishlist items)
  const masterCompletionRate =
    masterShows.length > 0 ? Math.round((watched.length / masterShows.length) * 100) : 0;

  // Total Library Completion Rate (including wishlist)
  const totalCompletionRate =
    shows.length > 0 ? Math.round((watched.length / shows.length) * 100) : 0;

  return {
    totalShows: shows.length,
    masterShowsCount: masterShows.length,
    wishlistShowsCount: wishlistShows.length,
    watchedCount: watched.length,
    watchingCount: watching.length,
    pausedCount: paused.length,
    droppedCount: dropped.length,
    topRatedCount: topRated.length,
    moviesCount: movies.length,
    seriesCount: series.length,
    masterCompletionRate,
    totalCompletionRate,
  };
}

/**
 * Normalizes title for duplicate detection and comparison (lower-cased, alphanumeric only, diacritics stripped).
 */
export function normalizeTitleForComparison(title: string): string {
  if (!title) return '';
  return String(title)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Deterministically deduplicates shows without dropping separate sheet rows or Wishlist/Master items.
 */
export function deduplicateShowsByTitle(showList: ShowItem[]): ShowItem[] {
  if (!showList || showList.length === 0) return [];

  const map = new Map<string, ShowItem>();

  for (const show of showList) {
    if (!show) continue;
    const normTitle = normalizeTitleForComparison(show.title);
    if (!normTitle && !show.id) continue;

    const viewerKey = String(show.who || '').trim().toLowerCase();
    const primaryKey = normTitle ? `title:${normTitle}::${viewerKey}` : `id:${show.id}`;

    const existing = map.get(primaryKey);
    if (!existing) {
      map.set(primaryKey, show);
    } else {
      const existingRank = Math.max(existing.addedTime || 0, existing.addedRank || 0, existing.sortOrderNum || 0, existing.createdTimestamp || 0);
      const newRank = Math.max(show.addedTime || 0, show.addedRank || 0, show.sortOrderNum || 0, show.createdTimestamp || 0);

      // Master status safeguard: If one item is Master and the other is Wishlist, favor the Master item or the one updated most recently
      let isWishlistFinal = existing.isWishlist;
      if (existing.isWishlist !== show.isWishlist) {
        if (!existing.isWishlist && show.isWishlist) {
          isWishlistFinal = newRank > (existingRank + 1000) ? true : false;
        } else if (existing.isWishlist && !show.isWishlist) {
          isWishlistFinal = false;
        }
      }

      const shouldReplace = newRank >= existingRank;

      if (shouldReplace) {
        map.set(primaryKey, {
          ...existing,
          ...show,
          isWishlist: isWishlistFinal,
          posterUrl: show.posterUrl || existing.posterUrl,
          backdropUrl: show.backdropUrl || existing.backdropUrl,
          notes: show.notes || existing.notes,
          releaseDate: show.releaseDate || existing.releaseDate,
          releaseNote: show.releaseNote || existing.releaseNote,
          who: show.who || existing.who,
          genre: show.genre || existing.genre,
          year: show.year || existing.year,
          ratingNum: show.ratingNum || existing.ratingNum,
          rating: show.rating || existing.rating,
          imdbId: show.imdbId || existing.imdbId,
        });
      } else {
        map.set(primaryKey, {
          ...show,
          ...existing,
          isWishlist: isWishlistFinal,
          posterUrl: existing.posterUrl || show.posterUrl,
          backdropUrl: existing.backdropUrl || show.backdropUrl,
          notes: existing.notes || show.notes,
          releaseDate: existing.releaseDate || show.releaseDate,
          releaseNote: existing.releaseNote || show.releaseNote,
          who: existing.who || existing.who,
          genre: existing.genre || existing.genre,
          year: existing.year || existing.year,
          ratingNum: existing.ratingNum || existing.ratingNum,
          rating: existing.rating || existing.rating,
          imdbId: existing.imdbId || existing.imdbId,
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Rebuilds pure numeric `addedRank` directly from Sheet data on every load.
 * Clears any stale iOS or browser cache.
 * Higher rowNumber = appended later = higher addedRank = newest = first.
 * Completely ignores all timestamps/dates for 100% cross-platform parity.
 */
export function rebuildSheetAddedRanks(showList: ShowItem[]): ShowItem[] {
  if (!showList || showList.length === 0) return [];
  return showList.map((show, idx) => {
    const rowNum = typeof show.rowNumber === 'number' && !isNaN(show.rowNumber) && show.rowNumber > 0
      ? show.rowNumber
      : idx + 1;

    const rank = typeof show.addedRank === 'number' && show.addedRank > 0 ? show.addedRank : rowNum;
    const sortOrder = typeof show.sortOrderNum === 'number' && show.sortOrderNum > 0 ? show.sortOrderNum : rowNum;

    return {
      ...show,
      rowNumber: rowNum,
      addedRank: rank,
      sortOrderNum: sortOrder,
    };
  });
}

export const ensureSortOrderNumbers = rebuildSheetAddedRanks;

/**
 * Sorts shows by Recently Added order (newest added first).
 * Prioritizes active session additions, persistent timestamps, explicit sort orders,
 * then falls back to descending sheet row order.
 */
export function compareByAddedRank(a: ShowItem, b: ShowItem): number {
  if (a.id === b.id) return 0;

  // 1. Newly added titles created in active session take priority
  const sessionA = a.sessionAddedAt || 0;
  const sessionB = b.sessionAddedAt || 0;
  if (sessionA > 0 || sessionB > 0) {
    if (sessionA !== sessionB) return sessionB - sessionA;
  }

  // 2. Persistent add timestamp (guarantees newly added shows stay first across all browser reloads)
  const tsA = a.createdTimestamp || a.addedTime || getShowAddedTimestamp(a) || 0;
  const tsB = b.createdTimestamp || b.addedTime || getShowAddedTimestamp(b) || 0;
  if (tsA > 0 || tsB > 0) {
    if (tsA !== tsB) return tsB - tsA;
  }

  // 3. Explicit sort order / added rank
  const rankA = typeof a.sortOrderNum === 'number' && a.sortOrderNum > 0 ? a.sortOrderNum : (a.addedRank || 0);
  const rankB = typeof b.sortOrderNum === 'number' && b.sortOrderNum > 0 ? b.sortOrderNum : (b.addedRank || 0);
  if (rankA > 0 || rankB > 0) {
    if (rankA !== rankB) return rankB - rankA;
  }

  // 4. Google Sheet row order: Higher rowNumber = newly appended row at bottom of sheet = newest added!
  const rowA = typeof a.rowNumber === 'number' && !isNaN(a.rowNumber) && a.rowNumber > 0 ? a.rowNumber : 0;
  const rowB = typeof b.rowNumber === 'number' && !isNaN(b.rowNumber) && b.rowNumber > 0 ? b.rowNumber : 0;

  if (rowA !== rowB) {
    return rowB - rowA; // DESCENDING: Row 100 (newest) -> Row 99 -> Row 2 (oldest)
  }

  return 0;
}

export const compareRecentlyAdded = compareByAddedRank;

/**
 * Robust helper to check if a show belongs to Wishlist (by boolean flag, sheet tab name, or status).
 */
export function isWishlistShow(s?: ShowItem | null): boolean {
  if (!s) return false;
  if (s.isWishlist === true || String(s.isWishlist) === 'true') return true;
  if (s.sheetTabName && String(s.sheetTabName).toLowerCase().includes('wishlist')) return true;
  if (s.status && (String(s.status).includes('Wishlist') || String(s.status).includes('🎁'))) return true;
  return false;
}
