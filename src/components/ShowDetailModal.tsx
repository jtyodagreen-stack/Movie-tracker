import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Play,
  Check,
  Star,
  Tv,
  Calendar,
  Layers,
  FileText,
  User,
  Trash2,
  Save,
  Plus,
  Minus,
  Sparkles,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { ShowItem, WatchStatus, ShowType, PRESET_PLATFORMS } from '../types';
import ImageUploader from './ImageUploader';
import { normalizeSeasonStr, normalizeEpisodeStr, normalizePlatform, parseGoogleSheetsDate } from '../services/sheetsService';
import { getOptimizedBackdrop } from '../utils/imageOptimizer';

interface ShowDetailModalProps {
  show: ShowItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedShow: ShowItem) => void;
  onDelete: (show: ShowItem) => void;
  sheetConnected: boolean;
  sheetPlatforms?: string[];
  sheetViewers?: string[];
  sheetGenres?: string[];
  onMoveToWishlist?: (show: ShowItem) => Promise<void>;
  onMoveToMaster?: (show: ShowItem) => Promise<void>;
  masterSheetName?: string;
  wishlistSheetName?: string;
}

const DEFAULT_PLATFORMS = PRESET_PLATFORMS;

const DEFAULT_VIEWERS: string[] = [];

const GENRE_PRESETS = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Family',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'Animation',
  'Documentary',
  'War',
];

export default function ShowDetailModal({
  show,
  isOpen,
  onClose,
  onSave,
  onDelete,
  sheetConnected,
  sheetPlatforms = [],
  sheetViewers = [],
  sheetGenres = [],
  onMoveToWishlist,
  onMoveToMaster,
  masterSheetName = 'MASTER TRACKER',
  wishlistSheetName = 'Wishlist',
}: ShowDetailModalProps) {
  const [title, setTitle] = useState(show?.title || '');
  const [type, setType] = useState<ShowType>(show?.type || 'Series');
  const [platform, setPlatform] = useState(normalizePlatform(show?.platform || ''));

  const allPlatforms = useMemo(() => {
    const set = new Set<string>(PRESET_PLATFORMS);
    if (sheetPlatforms && sheetPlatforms.length > 0) {
      sheetPlatforms.forEach((p) => {
        if (p && p.trim()) set.add(p.trim());
      });
    }
    return Array.from(set);
  }, [sheetPlatforms]);
  const [seasons, setSeasons] = useState(show?.seasons || 'S1');
  const [episodes, setEpisodes] = useState(show?.episodes || 'E1');
  const [maxEp, setMaxEp] = useState(show?.maxEp || 'E8');
  const [genre, setGenre] = useState(show?.genre || 'Drama');

  const allGenres = useMemo(() => {
    const set = new Set<string>(GENRE_PRESETS);
    if (sheetGenres && sheetGenres.length > 0) {
      sheetGenres.forEach((g) => {
        if (g && g.trim()) set.add(g.trim());
      });
    }
    return Array.from(set);
  }, [sheetGenres]);
  const [year, setYear] = useState(show?.year ?? new Date().getFullYear().toString());
  const [status, setStatus] = useState<WatchStatus>(show?.status || '⏳ Watching');
  const [ratingNum, setRatingNum] = useState<number>(show?.ratingNum || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [notes, setNotes] = useState(show?.notes || '');
  const [who, setWho] = useState(show?.who || (sheetViewers.length > 0 ? sheetViewers[0] : ''));

  const normalizePriorityLocal = (p?: string): string => {
    if (!p) return '🔴 High';
    const s = p.trim().toLowerCase();
    if (s.includes('high') || s.includes('🔴')) return '🔴 High';
    if (s.includes('medium') || s.includes('mid') || s.includes('🟡')) return '🟡 Medium';
    if (s.includes('low') || s.includes('green') || s.includes('🟢')) return '🟢 Low';
    return '🔴 High';
  };

  const getTodayLocalString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [priority, setPriority] = useState<string>(normalizePriorityLocal(show?.priority));
  const [dateAdded, setDateAdded] = useState<string>(
    parseGoogleSheetsDate(show?.dateAdded || getTodayLocalString())
  );
  const [isWishlistDone, setIsWishlistDone] = useState<boolean>(
    show?.status === '✅ Watched' ||
      String(show?.status || '').toLowerCase().includes('watched') ||
      String(show?.status || '').toUpperCase() === 'DONE'
  );

  useEffect(() => {
    if (show) {
      setTitle(show.title);
      setType(show.type);
      setPlatform(normalizePlatform(show.platform));
      setSeasons(show.seasons);
      setEpisodes(show.episodes);
      setMaxEp(show.maxEp);
      setGenre(show.genre);
      setYear(show.year);
      setStatus(show.status);
      setRatingNum(show.ratingNum || 0);
      setNotes(show.notes);
      setWho(show.who || (sheetViewers.length > 0 ? sheetViewers[0] : ''));
      setPriority(normalizePriorityLocal(show.priority));
      setDateAdded(parseGoogleSheetsDate(show.dateAdded || getTodayLocalString()));
      setIsWishlistDone(
        show.status === '✅ Watched' ||
          String(show.status).toLowerCase().includes('watched') ||
          String(show.status).toUpperCase() === 'DONE'
      );
      const url = show.posterUrl || show.backdropUrl || '';
      setPosterUrl(url);
      setBackdropUrl(url);
    }
  }, [show?.id, show?.who, sheetViewers]);

  useEffect(() => {
    if (!who && sheetViewers.length > 0) {
      setWho(sheetViewers[0]);
    }
  }, [sheetViewers, who]);

  const allViewers = useMemo(() => {
    if (sheetViewers && sheetViewers.length > 0) {
      const seen = new Set<string>();
      const list: string[] = [];
      for (const v of sheetViewers) {
        if (!v) continue;
        const trimmed = v.trim();
        const normalized = trimmed.toLowerCase();
        if (trimmed && !seen.has(normalized)) {
          seen.add(normalized);
          list.push(trimmed);
        }
      }
      return list;
    }
    return who ? [who] : [];
  }, [sheetViewers, who]);

  const initialUrl = show?.posterUrl || show?.backdropUrl || '';
  const [posterUrl, setPosterUrl] = useState<string>(initialUrl);
  const [backdropUrl, setBackdropUrl] = useState<string>(initialUrl);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  if (!isOpen || !show) return null;

  // Parse numerical episode and season info
  const epCurrentNum = parseInt(String(episodes).replace(/[^0-9]/g, '')) || 1;
  const epMaxNum = Math.max(1, parseInt(String(maxEp).replace(/[^0-9]/g, '')) || (type === 'Movie' ? 1 : 8));
  const ssnCurrentNum = parseInt(String(seasons).replace(/[^0-9]/g, '')) || 1;
  const progressPercent = Math.min(100, Math.round((epCurrentNum / epMaxNum) * 100));

  const handleStatusChange = (newStatus: WatchStatus) => {
    setStatus(newStatus);
    setIsWishlistDone(newStatus === '✅ Watched');
  };

  const handleStepEpisode = (delta: number) => {
    if (delta > 0 && epCurrentNum >= epMaxNum) {
      if (type === 'Movie' && epMaxNum === 1) {
        setStatus('✅ Watched');
        return;
      }
      // Reached the end of the season! Advance season to next and reset to Episode 1
      const nextSsn = ssnCurrentNum + 1;
      setSeasons(`S${nextSsn}`);
      setEpisodes('E1');
      setStatus('⏳ Watching');
      return;
    }

    if (delta < 0 && epCurrentNum <= 1 && ssnCurrentNum > 1) {
      // Step back into previous season
      const prevSsn = ssnCurrentNum - 1;
      setSeasons(`S${prevSsn}`);
      setEpisodes(`E${epMaxNum}`);
      return;
    }

    const nextVal = Math.max(1, Math.min(epMaxNum, epCurrentNum + delta));
    const nextEpStr = `E${nextVal}`;
    setEpisodes(nextEpStr);
    if (nextVal >= epMaxNum) {
      setStatus('✅ Watched');
    } else if (status === '✅ Watched' && nextVal < epMaxNum) {
      setStatus('⏳ Watching');
    }
  };

  const handleStepSeason = (delta: number) => {
    const nextSsn = Math.max(1, ssnCurrentNum + delta);
    setSeasons(`S${nextSsn}`);
    setEpisodes('E1');
    setStatus('⏳ Watching');
  };

  const handleSave = () => {
    const getRatingText = (num: number): string => {
      if (num === 1) return '⭐ = Poor';
      if (num === 2) return '⭐⭐ = Fair';
      if (num === 3) return '⭐⭐⭐ = Good';
      if (num === 4) return '⭐⭐⭐⭐ = Great';
      if (num === 5) return '⭐⭐⭐⭐⭐ = Excellent';
      return 'Unrated';
    };
    const starsText = ratingNum > 0 ? getRatingText(ratingNum) : (show.isWishlist ? '' : 'Unrated');
    const unifiedUrl = posterUrl.trim() || backdropUrl.trim();
    const finalStatus: WatchStatus = status;

    const isMovie = type === 'Movie';
    const updated: ShowItem = {
      ...show,
      title,
      type,
      platform,
      seasons: isMovie || show.isWishlist ? '' : normalizeSeasonStr(seasons || 'S1'),
      episodes: isMovie || show.isWishlist ? '' : normalizeEpisodeStr(episodes || 'E1'),
      maxEp: isMovie || show.isWishlist ? '' : normalizeEpisodeStr(maxEp || 'E8'),
      genre: genre || 'Drama',
      year,
      status: finalStatus,
      rating: starsText,
      ratingNum,
      notes,
      who: who.trim() || (sheetViewers.length > 0 ? sheetViewers[0] : ''),
      priority: show.isWishlist ? priority : undefined,
      dateAdded: show.isWishlist ? dateAdded : undefined,
      posterUrl: unifiedUrl,
      backdropUrl: unifiedUrl,
      nextEp: isMovie || show.isWishlist ? false : epCurrentNum < epMaxNum,
      nextSsn: false,
    };
    onSave(updated);
    onClose();
  };

  const activeBackdrop = backdropUrl || posterUrl || show.backdropUrl || show.posterUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1600&auto=format&fit=crop';

  return (
    <div
      id="show-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      style={{ perspective: '1200px' }}
      onClick={onClose}
    >
      <div
        id="show-detail-modal-card"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
        className="relative w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#181818] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Backdrop Banner */}
        <div className="relative aspect-[16/9] sm:aspect-[2.4/1] w-full shrink-0 overflow-hidden bg-zinc-900">
          <img
            src={getOptimizedBackdrop(activeBackdrop)}
            alt={show.title}
            className="w-full h-full object-cover filter brightness-[0.85] contrast-[1.05]"
            style={{ imageRendering: 'auto' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1600&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-transparent to-transparent" />

          {/* Action buttons top right */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
            {show.isWishlist && (
              <span className="text-[10px] sm:text-[11px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-amber-500 text-black border border-amber-400 shadow-xl flex items-center gap-1 sm:gap-1.5 transform -rotate-1">
                <span>🎁</span>
                <span>Wishlist</span>
              </span>
            )}
          </div>

          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 sm:gap-2 z-20">
            <button
              id="detail-top-save-btn"
              onClick={handleSave}
              className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl transition-all cursor-pointer border border-emerald-500/50 hover:scale-105 active:scale-95"
            >
              <Save className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              <span>Save</span>
            </button>
            <button
              id="close-detail-modal-btn"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors border border-zinc-600/50 cursor-pointer shadow-lg"
            >
              <X className="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>

          {/* Hero Content Overlay */}
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-6 sm:right-6 flex flex-col justify-end">
            <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded bg-[#E50914] text-white">
                {platform}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-zinc-900/80 text-zinc-300 border border-zinc-700">
                {genre}
              </span>
              <span className="text-[10px] sm:text-xs text-zinc-400">{year}</span>
            </div>

            <h2 className="text-xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md line-clamp-2">
              {title}
            </h2>
          </div>
        </div>

        {/* Image URL Section (Expandable) */}
        {showImageUploader && (
          <div className="p-4 sm:p-6 bg-zinc-950/90 border-b border-zinc-800 space-y-4 animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#E50914]" />
                <h3 className="text-sm font-bold text-white">Web Image URL</h3>
              </div>

            <ImageUploader
              label="Web Image URL (Poster, Cover, Backdrop & Hero)"
              description="Paste a single direct image link to be used identically across cards, modal cover, backdrop & hero billboard"
              currentUrl={posterUrl || backdropUrl}
              aspectRatio="backdrop"
              onImageSelected={(url) => {
                setPosterUrl(url);
                setBackdropUrl(url);
                setShowImageUploader(false); // Auto-hide after selection
              }}
              onImageRemoved={() => {
                setPosterUrl('');
                setBackdropUrl('');
              }}
            />
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Location & Sheet Move Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Storage Location:</span>
              <div className="flex items-center gap-2">
                {show.isWishlist ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-950/70 border border-amber-800/80 px-2.5 py-1 rounded">
                    <span>🎁 In Wishlist Sheet</span>
                    <span className="hidden sm:inline text-[10px] text-amber-400/80 font-mono">({wishlistSheetName})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-200 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded">
                    <span>📊 In Master Tracker</span>
                    <span className="hidden sm:inline text-[10px] text-zinc-400 font-mono">({masterSheetName})</span>
                  </span>
                )}
              </div>
            </div>

            {show.isWishlist && onMoveToMaster && (
              <button
                type="button"
                id="move-to-master-btn"
                onClick={async () => {
                  await onMoveToMaster(show);
                  onClose();
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md transition-all cursor-pointer shadow"
              >
                <span>📊 Move to Master Tracker</span>
              </button>
            )}

            {!show.isWishlist && onMoveToWishlist && (
              <button
                type="button"
                id="move-to-wishlist-btn"
                onClick={async () => {
                  await onMoveToWishlist(show);
                  onClose();
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-md transition-all cursor-pointer shadow"
              >
                <span>🎁 Move to Wishlist</span>
              </button>
            )}
          </div>

          {/* Progress & Watch Status Card */}
          <div className="p-4 sm:p-5 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-4">
            {/* Top Row: Watch Status & Current Progress Badge */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${type === 'Series' ? 'pb-3 border-b border-zinc-800' : ''}`}>
              <div className="space-y-1.5 flex-1">
                <label htmlFor="detail-status-select" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                  Watch Status
                </label>
                <select
                  id="detail-status-select"
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as WatchStatus)}
                  className={`w-full sm:w-auto text-base font-semibold px-4 py-2.5 rounded-md border focus:outline-none transition-colors appearance-none cursor-pointer shadow-inner ${
                    status === '✅ Watched'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : status === '⏳ Watching'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                      : status === '⏸️ Paused'
                      ? 'bg-blue-950/80 text-blue-300 border-blue-700/60'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}
                >
                  <option value="✅ Watched">✅ Watched</option>
                  <option value="⏳ Watching">⏳ Watching</option>
                  <option value="⏸️ Paused">⏸️ Paused</option>
                  <option value="❌ Dropped">❌ Dropped</option>
                </select>
              </div>

              {type === 'Series' && (
                <div className="space-y-1.5 sm:text-right">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block sm:mr-1">
                    Current Progress
                  </span>
                  <div
                    id="detail-current-progress-badge"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800/90 border border-zinc-700 rounded-md font-mono text-white text-sm font-bold shadow-inner"
                  >
                    <span>{seasons}</span>
                    <span className="text-zinc-500">•</span>
                    <span>{episodes}</span>
                    <span className="text-zinc-400 font-normal text-xs">of {maxEp}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Steppers Grid & Progress Bar (Series only) */}
            {type === 'Series' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Season Stepper */}
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-zinc-800/60 border border-zinc-700/80 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 pl-2">
                      Season
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        id="season-minus-btn"
                        type="button"
                        onClick={() => handleStepSeason(-1)}
                        disabled={ssnCurrentNum <= 1}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title="Previous Season"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-base text-white">
                        {seasons}
                      </span>
                      <button
                        id="season-plus-btn"
                        type="button"
                        onClick={() => handleStepSeason(1)}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title="Next Season"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Episode Stepper */}
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-zinc-800/60 border border-zinc-700/80 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 pl-2">
                      Episode
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        id="episode-minus-btn"
                        type="button"
                        onClick={() => handleStepEpisode(-1)}
                        disabled={epCurrentNum <= 1 && ssnCurrentNum <= 1}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title="Previous Episode"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-base text-white">
                        {episodes}
                      </span>
                      <button
                        id="episode-plus-btn"
                        type="button"
                        onClick={() => handleStepEpisode(1)}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title={epCurrentNum >= epMaxNum ? `Advance to Season ${ssnCurrentNum + 1} E1` : 'Next Episode'}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Season Completion Progress Bar */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider ml-0.5">
                    <span>Season Completion</span>
                    <span className="font-mono text-zinc-200">{progressPercent}%</span>
                  </div>
                  <div
                    id="detail-progress-bar"
                    className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700"
                  >
                    <div
                      className={`h-full transition-all duration-300 ${
                        status === '✅ Watched' ? 'bg-emerald-500' : 'bg-[#E50914]'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Fields Unified Container */}
          <div className="space-y-4">
            {/* Title and Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="sm:col-span-2 space-y-2">
                <label htmlFor="detail-title-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Title *</label>
                <input
                  id="detail-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Severance, Shōgun, Dune..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="detail-type-select" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Format</label>
                <select
                  id="detail-type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as ShowType)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                >
                  <option value="Series">Series (TV)</option>
                  <option value="Movie">Movie (Film)</option>
                </select>
              </div>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 block">Platform</label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allPlatforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                      platform === p
                        ? 'bg-red-600 text-white border-red-500 font-semibold'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="detail-genre-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Genre</label>
                <select
                  id="detail-genre-input"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                >
                  {allGenres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="detail-year-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Release Year</label>
                <select
                  id="detail-year-input"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 font-mono shadow-inner appearance-none"
                >
                  {Array.from({ length: 45 }, (_, i) => {
                    const y = (new Date().getFullYear() + 1 - i).toString();
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                  {year && !Array.from({ length: 45 }, (_, i) => (new Date().getFullYear() + 1 - i).toString()).includes(String(year)) && (
                    <option value={year}>{year}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Wishlist-specific fields vs Master Tracker fields */}
            {show.isWishlist ? (
              <div className="space-y-5 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="detail-wishlist-priority" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                      Priority
                    </label>
                    <select
                      id="detail-wishlist-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-zinc-500 shadow-inner appearance-none"
                    >
                      <option value="🔴 High">🔴 High</option>
                      <option value="🟡 Medium">🟡 Medium</option>
                      <option value="🟢 Low">🟢 Low</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="detail-wishlist-date" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                      Date Added
                    </label>
                    <input
                      id="detail-wishlist-date"
                      type="date"
                      value={dateAdded}
                      onChange={(e) => setDateAdded(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-zinc-500 font-mono shadow-inner relative appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Seasons, Episodes, Max Ep (If Series) */}
                {type === 'Series' && (
                  <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                    <div className="space-y-2">
                      <label htmlFor="detail-season-input-box" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Season</label>
                      <input
                        id="detail-season-input-box"
                        type="text"
                        value={seasons}
                        onChange={(e) => setSeasons(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner"
                        placeholder="S1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="detail-episode-input-box" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Ep</label>
                      <input
                        id="detail-episode-input-box"
                        type="text"
                        value={episodes}
                        onChange={(e) => setEpisodes(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner text-center"
                        placeholder="E1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="detail-max-ep-input-box" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Max</label>
                      <input
                        id="detail-max-ep-input-box"
                        type="text"
                        value={maxEp}
                        onChange={(e) => setMaxEp(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner text-center"
                        placeholder="E8"
                      />
                    </div>
                  </div>
                )}

                {/* Status & Viewer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="detail-status-select" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Watch Status</label>
                    <select
                      id="detail-status-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as WatchStatus)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-4 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none cursor-pointer"
                    >
                      <option value="✅ Watched">✅ Watched</option>
                      <option value="⏳ Watching">⏳ Watching</option>
                      <option value="⏸️ Paused">⏸️ Paused</option>
                      <option value="❌ Dropped">❌ Dropped</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="detail-who-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Viewer (Who)</label>
                    <select
                      id="detail-who-input"
                      value={who}
                      onChange={(e) => setWho(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-4 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                    >
                      {allViewers.length === 0 && (
                        <option value="">No profiles in Lists sheet</option>
                      )}
                      {allViewers.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Rating (Master Tracker only) */}
            {!show.isWishlist && (
              <div className="space-y-1.5 p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold mb-1">
                  <span>Rating</span>
                  <span className="text-amber-400 font-bold">
                    {ratingNum > 0
                      ? `${ratingNum} Stars (${
                          ratingNum === 5
                            ? 'Excellent'
                            : ratingNum === 4
                            ? 'Great'
                            : ratingNum === 3
                            ? 'Good'
                            : ratingNum === 2
                            ? 'Fair'
                            : 'Poor'
                        })`
                      : 'Unrated'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      type="button"
                      onClick={() => setRatingNum(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1 text-zinc-600 cursor-pointer rounded-md hover:bg-zinc-800/50"
                      title={`${star} Star${star > 1 ? 's' : ''}`}
                    >
                      <motion.div
                        animate={{ scale: (hoverRating || ratingNum) >= star ? [1, 1.2, 1] : 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            (hoverRating || ratingNum) >= star
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                              : 'text-zinc-600'
                          }`}
                        />
                      </motion.div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Image Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#E50914]" />
                  Title Artwork (Poster / Cover)
                </label>
                <button
                  id="toggle-detail-modal-image-btn"
                  type="button"
                  onClick={() => setShowImageUploader(!showImageUploader)}
                  className="text-xs text-red-400 hover:text-red-300 underline font-medium cursor-pointer"
                >
                  {showImageUploader ? 'Hide Image Field' : (posterUrl || backdropUrl) ? 'Change Web URL' : '+ Add Image URL'}
                </button>
              </div>

              {showImageUploader ? (
                <ImageUploader
                  label="Poster / Backdrop Image Web Link"
                  description="Paste direct image link (e.g. IMDb, TMDB, Amazon) to update artwork"
                  currentUrl={posterUrl || backdropUrl}
                  aspectRatio="backdrop"
                  onImageSelected={(url) => {
                    setPosterUrl(url);
                    setBackdropUrl(url);
                    setShowImageUploader(false);
                  }}
                  onImageRemoved={() => {
                    setPosterUrl('');
                    setBackdropUrl('');
                  }}
                />
              ) : (posterUrl || backdropUrl) ? (
                <div className="flex items-center gap-3 p-2.5 bg-zinc-900 border border-zinc-700 rounded-lg">
                  <img src={posterUrl || backdropUrl} alt="Preview" className="w-10 h-14 object-cover rounded border border-zinc-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-emerald-400 font-semibold">Web poster/backdrop link attached</p>
                    <p className="text-[11px] text-zinc-400 truncate font-mono">{posterUrl || backdropUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowImageUploader(true)}
                    className="text-xs text-zinc-300 hover:text-white bg-zinc-800 px-2 py-1 rounded border border-zinc-700 cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => setShowImageUploader(true)}
                  className="p-3 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg text-center cursor-pointer bg-zinc-900/40 hover:bg-zinc-900 transition-colors"
                >
                  <p className="text-xs text-zinc-300">
                    <span className="text-red-400 font-semibold underline">Click here to add a custom web image URL</span>
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label htmlFor="detail-notes-input" className="text-xs font-semibold text-zinc-300 block">Notes & Thoughts</label>
              <textarea
                id="detail-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why you're watching, thoughts, reminders..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md p-2.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 shadow-inner"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              id="delete-show-btn"
              onClick={() => onDelete(show)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete from Tracker</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                id="cancel-detail-btn"
                onClick={onClose}
                className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-2 rounded transition-colors"
              >
                Close
              </button>
              <button
                id="save-detail-btn"
                onClick={handleSave}
                className="flex items-center gap-1.5 bg-[#E50914] hover:bg-[#B80710] text-white text-xs sm:text-sm font-semibold px-5 py-2 rounded-md transition-colors shadow-lg shadow-red-900/30"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes {sheetConnected ? 'to Sheets' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
