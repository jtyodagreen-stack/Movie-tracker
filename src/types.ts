export type ShowType = 'Series' | 'Movie';

export type WatchStatus = '✅ Watched' | '⏳ Watching' | '⏸️ Paused' | '❌ Dropped';

export const PRESET_PLATFORMS = [
  '📺 Netflix',
  '🛒 Prime Video',
  '⚡ Disney+',
  '🟣 Apple Tv+',
  '🟥 Paramount+',
  '🟪 Max / Hbo',
  '🎬 Sky / Now',
] as const;

export type PresetPlatform = (typeof PRESET_PLATFORMS)[number];

export interface ShowItem {
  id: string;
  title: string;
  type: ShowType;
  platform: string; // e.g., "📺 Netflix", "🛒 Prime Video", "⚡ Disney+", "🟣 Apple Tv+", "🟥 Paramount+", "🟪 Max / Hbo", "🎬 Sky / Now"
  seasons: string; // e.g., "S1", "S3"
  episodes: string; // e.g., "E1", "E8"
  nextEp?: boolean | string;
  nextSsn?: boolean | string;
  genre: string; // e.g., "Drama", "Documentary", "Action"
  year: number | string;
  status: WatchStatus;
  rating: string; // e.g., "⭐⭐⭐⭐⭐ = Excellent"
  ratingNum: number; // e.g. 5, 4, 3
  notes: string;
  who: string; // Viewer profile name
  maxEp: string; // e.g., "E8"
  backdropUrl?: string;
  posterUrl?: string;
  synopsis?: string;
  rowNumber?: number; // 1-indexed row number in the Google Sheet
  isWishlist?: boolean; // Whether the item is on the Wishlist sheet
  sheetTabName?: string; // The specific sheet tab this show belongs to (e.g. MASTER TRACKER, Wishlist)
  priority?: string; // e.g. "High", "Medium", "Low"
  dateAdded?: string; // e.g. "2026-09-21"
}

export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface TrackerStats {
  totalShows: number;
  watched: number;
  watching: number;
  planToWatch: number;
  seriesCount: number;
  moviesCount: number;
}

export interface AccessibilitySettings {
  contrastMode: 'default' | 'high';
  textSize: 'standard' | 'large'; // UK Gov 16pt+ / 125% clear print recommendation
  dyslexiaFont: boolean; // Accessible sans/dyslexic clear font
  reduceMotion: boolean; // WCAG vestibular accessibility
}

export interface CustomFilter {
  id: string;
  name: string;
  status: WatchStatus;
  [key: string]: any;
}

