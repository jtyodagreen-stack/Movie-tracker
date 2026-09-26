import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Star, Tv, Film, Sparkles, Save, Image as ImageIcon } from 'lucide-react';
import { ShowItem, ShowType, WatchStatus, PRESET_PLATFORMS } from '../types';
import { getBackdropForShow, getPosterForShow } from '../data/mediaAssets';
import ImageUploader from './ImageUploader';
import { normalizeSeasonStr, normalizeEpisodeStr, normalizePlatform, parseGoogleSheetsDate } from '../services/sheetsService';

interface AddShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newShow: ShowItem) => void;
  sheetConnected: boolean;
  defaultViewer?: string;
  sheetPlatforms?: string[];
  sheetViewers?: string[];
  sheetGenres?: string[];
  initialIsWishlist?: boolean;
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

export default function AddShowModal({
  isOpen,
  onClose,
  onAdd,
  sheetConnected,
  defaultViewer = '',
  sheetPlatforms = [],
  sheetViewers = [],
  sheetGenres = [],
  initialIsWishlist = false,
  masterSheetName = 'MASTER TRACKER',
  wishlistSheetName = 'Wishlist',
}: AddShowModalProps) {
  const [destination, setDestination] = useState<'master' | 'wishlist'>(
    initialIsWishlist ? 'wishlist' : 'master'
  );
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ShowType>('Series');
  const [platform, setPlatform] = useState<string>(
    sheetPlatforms.length > 0 ? normalizePlatform(sheetPlatforms[0]) : '📺 Netflix'
  );
  const [seasons, setSeasons] = useState('S1');
  const [episodes, setEpisodes] = useState('E1');
  const [maxEp, setMaxEp] = useState('E8');
  const [genre, setGenre] = useState('Drama');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [status, setStatus] = useState<WatchStatus>('⏳ Watching');
  const [ratingNum, setRatingNum] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [who, setWho] = useState(defaultViewer || (sheetViewers.length > 0 ? sheetViewers[0] : ''));
  const [priority, setPriority] = useState('🔴 High');

  useEffect(() => {
    if (!who && sheetViewers.length > 0) {
      setWho(sheetViewers[0]);
    }
  }, [sheetViewers, who]);

  const getTodayLocalString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [dateAdded, setDateAdded] = useState(getTodayLocalString());
  const [isWishlistDone, setIsWishlistDone] = useState(false);

  const allGenres = useMemo(() => {
    const set = new Set<string>(GENRE_PRESETS);
    if (sheetGenres && sheetGenres.length > 0) {
      sheetGenres.forEach((g) => {
        if (g && g.trim()) set.add(g.trim());
      });
    }
    return Array.from(set);
  }, [sheetGenres]);

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
  const [posterUrl, setPosterUrl] = useState('');
  const [showImageUpload, setShowImageUpload] = useState(false);

  const allPlatforms = PRESET_PLATFORMS;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const resolvedPlatform = platform;
    const getRatingText = (num: number): string => {
      if (num === 1) return '⭐ = Poor';
      if (num === 2) return '⭐⭐ = Fair';
      if (num === 3) return '⭐⭐⭐ = Good';
      if (num === 4) return '⭐⭐⭐⭐ = Great';
      if (num === 5) return '⭐⭐⭐⭐⭐ = Excellent';
      return 'Unrated';
    };
    const starsText =
      destination === 'wishlist'
        ? ''
        : ratingNum > 0
        ? getRatingText(ratingNum)
        : 'Unrated';
    const finalRatingNum = destination === 'wishlist' ? 0 : ratingNum;
    const id = `show-${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const finalImg = posterUrl.trim();
    const finalStatus: WatchStatus =
      destination === 'wishlist'
        ? (isWishlistDone ? '✅ Watched' : '⏳ Watching')
        : status;

    const isMovie = type === 'Movie';
    const isWishlist = destination === 'wishlist';

    const newShow: ShowItem = {
      id,
      title: title.trim(),
      type,
      platform: resolvedPlatform,
      seasons: isMovie || isWishlist ? '' : normalizeSeasonStr(seasons.trim() || 'S1'),
      episodes: isMovie || isWishlist ? '' : normalizeEpisodeStr(episodes.trim() || 'E1'),
      maxEp: isMovie || isWishlist ? '' : normalizeEpisodeStr(maxEp.trim() || 'E8'),
      nextEp: isMovie || isWishlist ? false : true,
      nextSsn: false,
      genre: genre.trim() || 'Drama',
      year: year.trim() || new Date().getFullYear().toString(),
      status: finalStatus,
      rating: starsText,
      ratingNum: finalRatingNum,
      notes: notes.trim(),
      who: who.trim() || (sheetViewers.length > 0 ? sheetViewers[0] : ''),
      isWishlist,
      sheetTabName: isWishlist ? (wishlistSheetName || 'Wishlist') : (masterSheetName || 'MASTER TRACKER'),
      priority: isWishlist ? (priority.trim() || 'High') : undefined,
      dateAdded: isWishlist ? (dateAdded.trim() || new Date().toISOString().split('T')[0]) : undefined,
      backdropUrl: finalImg || getBackdropForShow(title, genre),
      posterUrl: finalImg || getPosterForShow(title, genre),
    };

    onAdd(newShow);
    setTitle('');
    setNotes('');
    setPosterUrl('');
    setRatingNum(0);
    onClose();
  };

  return (
    <div
      id="add-show-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="add-show-modal-dialog"
        className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#181818] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#E50914] flex items-center justify-center text-white font-bold shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Add New Show or Movie
              </h2>
              <p className="text-xs text-zinc-400">
                Log a new title to your tracker {sheetConnected ? '& sync with Google Sheets' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="add-show-form"
              id="add-top-save-btn"
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer border border-emerald-500/50"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Title</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button
              id="close-add-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form id="add-show-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Destination Sheet Selector */}
          <div className="space-y-1.5 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">Save Destination</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {destination === 'wishlist' ? `Target Sheet: ${wishlistSheetName || '📋  WISHLIST'}` : `Target Sheet: ${masterSheetName || 'MASTER TRACKER'}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="dest-master-btn"
                onClick={() => setDestination('master')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  destination === 'master'
                    ? 'bg-zinc-800 text-white border border-zinc-600 shadow-sm'
                    : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <span>📊 Master Tracker</span>
              </button>
              <button
                type="button"
                id="dest-wishlist-btn"
                onClick={() => setDestination('wishlist')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  destination === 'wishlist'
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500 shadow-sm ring-1 ring-emerald-500/40'
                    : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <span>📋 Wishlist Sheet</span>
              </button>
            </div>
          </div>

          {/* Title and Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="sm:col-span-2 space-y-2">
              <label htmlFor="new-show-title" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Title *</label>
              <input
                id="new-show-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Severance, Shōgun, Dune..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 shadow-inner"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="new-show-type" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Format</label>
              <select
                id="new-show-type"
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
                  className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
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
              <label htmlFor="new-show-genre" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Genre</label>
              <select
                id="new-show-genre"
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
              <label htmlFor="new-show-year" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Release Year</label>
              <select
                id="new-show-year"
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
              </select>
            </div>
          </div>

          {/* Wishlist-specific fields vs Master Tracker fields */}
          {destination === 'wishlist' ? (
            <div className="space-y-5 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg pb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="wishlist-priority" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                    Priority
                  </label>
                  <select
                    id="wishlist-priority"
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
                  <label htmlFor="wishlist-date-added" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                    Date Added
                  </label>
                  <input
                    id="wishlist-date-added"
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
                      <label htmlFor="new-show-season" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Season</label>
                      <input
                        id="new-show-season"
                        type="text"
                        value={seasons}
                        onChange={(e) => setSeasons(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner"
                        placeholder="S1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="new-show-episode" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Ep</label>
                      <input
                        id="new-show-episode"
                        type="text"
                        value={episodes}
                        onChange={(e) => setEpisodes(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner text-center"
                        placeholder="E1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="new-show-max-ep" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Max</label>
                      <input
                        id="new-show-max-ep"
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
                  <label htmlFor="new-show-status" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Watch Status</label>
                  <select
                    id="new-show-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WatchStatus)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-4 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                  >
                    <option value="✅ Watched">✅ Watched</option>
                    <option value="⏳ Watching">⏳ Watching</option>
                    <option value="⏸️ Paused">⏸️ Paused</option>
                    <option value="❌ Dropped">❌ Dropped</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="new-show-who" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Viewer (Who)</label>
                  <select
                    id="new-show-who"
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
          {destination === 'master' && (
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
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingNum(star === ratingNum ? 0 : star)}
                    className="p-1 text-zinc-600 hover:text-amber-400 hover:scale-110 active:scale-95 transition-all cursor-pointer rounded-md hover:bg-zinc-800/50"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-7 h-7 transition-all ${
                        star <= ratingNum
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                          : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    />
                  </button>
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
                id="toggle-add-modal-image-btn"
                type="button"
                onClick={() => setShowImageUpload(!showImageUpload)}
                className="text-xs text-red-400 hover:text-red-300 underline font-medium cursor-pointer"
              >
                {showImageUpload ? 'Hide Image Field' : posterUrl ? 'Change Web URL' : '+ Add Image URL'}
              </button>
            </div>

            {showImageUpload ? (
              <ImageUploader
                label="Poster Image Web Link"
                description={
                  destination === 'wishlist'
                    ? 'Paste direct image link (e.g. IMDb, TMDB, Amazon) to add to your wishlist'
                    : 'Paste direct image link (e.g. IMDb, TMDB, Amazon) to save to your tracker'
                }
                currentUrl={posterUrl}
                aspectRatio="poster"
                onImageSelected={(url) => {
                  setPosterUrl(url);
                  setShowImageUpload(false); // Auto-hide after selection
                }}
                onImageRemoved={() => setPosterUrl('')}
              />
            ) : posterUrl ? (
              <div className="flex items-center gap-3 p-2.5 bg-zinc-900 border border-zinc-700 rounded-lg">
                <img src={posterUrl} alt="Preview" className="w-10 h-14 object-cover rounded border border-zinc-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-400 font-semibold">Web poster link attached</p>
                  <p className="text-[11px] text-zinc-400 truncate font-mono">{posterUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImageUpload(true)}
                  className="text-xs text-zinc-300 hover:text-white bg-zinc-800 px-2 py-1 rounded border border-zinc-700"
                >
                  Change
                </button>
              </div>
            ) : (
              <div
                onClick={() => setShowImageUpload(true)}
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
            <label htmlFor="new-show-notes" className="text-xs font-semibold text-zinc-300 block">Notes & Thoughts</label>
            <textarea
              id="new-show-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why you're watching, thoughts, reminders..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md p-2.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-zinc-400 hover:text-white px-4 py-2"
            >
              Cancel
            </button>
            <button
              id="submit-add-show-btn"
              type="submit"
              className="flex items-center gap-1.5 bg-[#E50914] hover:bg-[#B80710] text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-md shadow-lg shadow-red-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Tracker</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
