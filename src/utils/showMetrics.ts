import { ShowItem } from '../types';

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
