import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Tv,
  Film,
  CheckCircle2,
  Clock,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Star,
  Award,
  Layers,
  Calendar,
  Bookmark,
  Play,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';

interface DashboardStatsProps {
  shows: ShowItem[];
  onClose: () => void;
  onOpenDetails: (show: ShowItem) => void;
}

const STATUS_COLORS: Record<string, string> = {
  '✅ Watched': '#10b981', // emerald-500
  '⏳ Watching': '#f59e0b', // amber-500
  '🎁 Wishlist': '#e50914', // red-600
  '⏸️ Paused': '#64748b', // slate-500
  '❌ Dropped': '#991b1b', // dark red-800
  'Uncategorized': '#71717a',
};

const PLATFORM_COLORS = [
  '#e50914', // Netflix Red
  '#00a8e1', // Prime Blue
  '#113ccf', // Disney Blue
  '#a855f7', // Apple Purple
  '#0064ff', // Paramount Blue
  '#9333ea', // Max Purple
  '#f97316', // Sky Orange
  '#10b981', // Green
  '#eab308', // Yellow
  '#06b6d4', // Cyan
];

const GENRE_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export default function DashboardStats({
  shows,
  onClose,
  onOpenDetails,
}: DashboardStatsProps) {
  const [filterType, setFilterType] = useState<'All' | 'Series' | 'Movie'>('All');

  // Keyboard shortcut: close with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filter shows based on selected scope
  const filteredShows = useMemo(() => {
    if (filterType === 'All') return shows;
    return shows.filter((s) => s.type === filterType);
  }, [shows, filterType]);

  const totalSeriesCount = useMemo(() => shows.filter((s) => s.type === 'Series').length, [shows]);
  const totalMoviesCount = useMemo(() => shows.filter((s) => s.type === 'Movie').length, [shows]);

  // Overall counts & metrics
  const stats = useMemo(() => {
    const total = filteredShows.length;
    const watched = filteredShows.filter((s) => s.status === '✅ Watched');
    const watching = filteredShows.filter((s) => s.status === '⏳ Watching');
    const wishlist = filteredShows.filter((s) => s.isWishlist || s.status === ('🎁 Wishlist' as any));
    const paused = filteredShows.filter((s) => s.status === '⏸️ Paused');
    const dropped = filteredShows.filter((s) => s.status === '❌ Dropped');

    const moviesCount = filteredShows.filter((s) => s.type === 'Movie').length;
    const seriesCount = filteredShows.filter((s) => s.type === 'Series').length;

    const completionRate = total > 0 ? Math.round((watched.length / total) * 100) : 0;

    // Estimate total watch time
    // Movie: avg 115 minutes
    // Watched series: total seasons * maxEp * 45 minutes
    // Watching series: currentEp * 45 minutes
    let totalMinutes = 0;
    filteredShows.forEach((s) => {
      if (s.type === 'Movie') {
        if (s.status === '✅ Watched') {
          totalMinutes += 115;
        } else if (s.status === '⏳ Watching') {
          totalMinutes += 60;
        }
      } else {
        const curEp = parseInt(String(s.episodes).replace(/[^0-9]/g, '')) || 0;
        const maxEp = parseInt(String(s.maxEp).replace(/[^0-9]/g, '')) || 8;
        const ssn = parseInt(String(s.seasons).replace(/[^0-9]/g, '')) || 1;

        if (s.status === '✅ Watched') {
          totalMinutes += Math.max(1, ssn) * Math.max(curEp, maxEp) * 45;
        } else if (s.status === '⏳ Watching') {
          totalMinutes += Math.max(1, curEp) * 45;
        }
      }
    });

    const watchHours = Math.round(totalMinutes / 60);
    const watchDays = (totalMinutes / (60 * 24)).toFixed(1);

    // Ratings calculation
    const ratedShows = filteredShows.filter((s) => (s.ratingNum && s.ratingNum > 0) || (s.rating && s.rating.includes('⭐')));
    let totalRatingPoints = 0;
    ratedShows.forEach((s) => {
      if (s.ratingNum && s.ratingNum > 0) {
        totalRatingPoints += s.ratingNum;
      } else if (s.rating) {
        const starCount = (s.rating.match(/⭐/g) || []).length;
        if (starCount > 0) totalRatingPoints += starCount;
      }
    });
    const avgRating = ratedShows.length > 0 ? (totalRatingPoints / ratedShows.length).toFixed(1) : 'N/A';

    return {
      total,
      watched: watched.length,
      watching: watching.length,
      wishlist: wishlist.length,
      paused: paused.length,
      dropped: dropped.length,
      moviesCount,
      seriesCount,
      completionRate,
      watchHours,
      watchDays,
      avgRating,
      ratedCount: ratedShows.length,
    };
  }, [filteredShows]);

  // 1. Status Chart Data
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredShows.forEach((s) => {
      const st = s.isWishlist ? '🎁 Wishlist' : (s.status || '⏳ Watching');
      map[st] = (map[st] || 0) + 1;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      fill: STATUS_COLORS[name] || '#64748b',
    }));
  }, [filteredShows]);

  // 2. Platforms Chart Data
  const platformData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredShows.forEach((s) => {
      const p = (s.platform || 'Other').trim();
      const cleanName = p.replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\uFE00-\uFE0F\u1F300-\u1F64F\u1F680-\u1F6FF\s]+/, '') || p;
      map[cleanName] = (map[cleanName] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredShows]);

  // 3. Genres Chart Data
  const genreData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredShows.forEach((s) => {
      const g = (s.genre || 'Other').trim();
      // Split comma separated genres if multiple
      const parts = g.split(/[,/]/).map((item) => item.trim()).filter(Boolean);
      if (parts.length === 0) {
        map['Other'] = (map['Other'] || 0) + 1;
      } else {
        parts.forEach((p) => {
          map[p] = (map[p] || 0) + 1;
        });
      }
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredShows]);

  // 4. Ratings Chart Data
  const ratingData = useMemo(() => {
    const buckets: Record<string, number> = {
      '5 Stars (Excellent)': 0,
      '4 Stars (Great)': 0,
      '3 Stars (Good)': 0,
      '2 Stars (Fair)': 0,
      '1 Star (Poor)': 0,
      'Unrated': 0,
    };

    filteredShows.forEach((s) => {
      let starCount = 0;
      if (s.ratingNum && s.ratingNum > 0) {
        starCount = s.ratingNum;
      } else if (s.rating) {
        if (s.rating.toLowerCase().includes('excellent')) starCount = 5;
        else if (s.rating.toLowerCase().includes('great')) starCount = 4;
        else if (s.rating.toLowerCase().includes('good')) starCount = 3;
        else if (s.rating.toLowerCase().includes('fair')) starCount = 2;
        else if (s.rating.toLowerCase().includes('poor')) starCount = 1;
        else {
          const stars = (s.rating.match(/⭐/g) || []).length;
          if (stars > 0) starCount = stars;
        }
      }

      if (starCount >= 5) buckets['5 Stars (Excellent)']++;
      else if (starCount === 4) buckets['4 Stars (Great)']++;
      else if (starCount === 3) buckets['3 Stars (Good)']++;
      else if (starCount === 2) buckets['2 Stars (Fair)']++;
      else if (starCount === 1) buckets['1 Star (Poor)']++;
      else buckets['Unrated']++;
    });

    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [filteredShows]);

  // 5. Release Years Distribution Data
  const yearData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredShows.forEach((s) => {
      const y = parseInt(String(s.year).replace(/[^0-9]/g, ''));
      if (y && y > 1950 && y < 2035) {
        let bucket = `${y}`;
        if (y < 2010) bucket = '< 2010';
        else if (y <= 2015) bucket = '2010-15';
        map[bucket] = (map[bucket] || 0) + 1;
      } else {
        map['Other'] = (map['Other'] || 0) + 1;
      }
    });

    return Object.entries(map)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [filteredShows]);

  // Currently Watching in-progress titles
  const inProgressList = useMemo(() => {
    return filteredShows
      .filter((s) => s.status === '⏳ Watching')
      .slice(0, 8);
  }, [filteredShows]);

  // Top Rated titles
  const topRatedList = useMemo(() => {
    return filteredShows
      .filter((s) => {
        const stars = s.ratingNum || (s.rating ? (s.rating.match(/⭐/g) || []).length : 0);
        return stars >= 4;
      })
      .slice(0, 8);
  }, [filteredShows]);

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Top Sticky Navigation Bar */}
      <div className="sticky top-16 z-30 bg-[#181818]/95 backdrop-blur-md border-b border-zinc-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
              Stats & Analytics Dashboard
            </h1>
          </div>

          {/* Scope Filter Tabs */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setFilterType('All')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'All'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({shows.length})
            </button>
            <button
              onClick={() => setFilterType('Series')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'Series'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tv className="w-3 h-3" />
              <span>Series ({totalSeriesCount})</span>
            </button>
            <button
              onClick={() => setFilterType('Movie')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'Movie'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>Movies ({totalMoviesCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Banner Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Titles (Red theme) */}
          <div className="bg-[#181818] border border-red-900/50 hover:border-red-600/70 rounded-xl p-4 shadow-md shadow-red-950/20 transition-all">
            <div className="flex items-center justify-between text-red-400 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-400">
                {filterType === 'Series' ? 'Total Series' : filterType === 'Movie' ? 'Total Movies' : 'Total Library'}
              </span>
              <Layers className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-500">{stats.total}</div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
              {filterType === 'Series' ? (
                <span>{stats.seriesCount} Series</span>
              ) : filterType === 'Movie' ? (
                <span>{stats.moviesCount} Movies</span>
              ) : (
                <>
                  <span>{stats.seriesCount} Series</span> • <span>{stats.moviesCount} Movies</span>
                </>
              )}
            </div>
          </div>

          {/* Completion Rate */}
          <div className="bg-[#181818] border border-emerald-900/40 hover:border-emerald-600/50 rounded-xl p-4 shadow-md transition-all">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider">Completion</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{stats.completionRate}%</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              <span className="text-emerald-400 font-bold">{stats.watched}</span> of {stats.total} completed
            </div>
          </div>

          {/* In Progress */}
          <div className="bg-[#181818] border border-amber-900/40 hover:border-amber-600/50 rounded-xl p-4 shadow-md transition-all">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider">Watching</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{stats.watching}</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Active in-progress shows
            </div>
          </div>

          {/* Watched (Green matching Completion) */}
          <div className="bg-[#181818] border border-emerald-900/40 hover:border-emerald-600/50 rounded-xl p-4 shadow-md transition-all">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider">Watched</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{stats.watched}</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Finished & completed shows
            </div>
          </div>

          {/* Wishlist */}
          <div className="bg-[#181818] border border-red-900/40 hover:border-red-600/50 rounded-xl p-4 shadow-md transition-all">
            <div className="flex items-center justify-between text-red-400 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider">Wishlist</span>
              <Bookmark className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-500">{stats.wishlist}</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Queued to watch next
            </div>
          </div>

          {/* Avg Rating */}
          <div className="bg-[#181818] border border-yellow-900/40 hover:border-yellow-600/50 rounded-xl p-4 shadow-md transition-all">
            <div className="flex items-center justify-between text-yellow-400 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider">Avg Rating</span>
              <Star className="w-4 h-4 fill-current text-yellow-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-yellow-400">
              {stats.avgRating !== 'N/A' ? `${stats.avgRating} / 5` : 'N/A'}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Across {stats.ratedCount} rated titles
            </div>
          </div>
        </div>

        {/* Charts Row 1: Status Donut & Platform Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Status Breakdown Donut Chart */}
          <div className="lg:col-span-5 bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Watch Status Distribution</h2>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">{filteredShows.length} titles</span>
            </div>

            <div className="h-64 w-full">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="#181818" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      wrapperStyle={{ outline: 'none' }}
                      contentStyle={{
                        backgroundColor: '#181818',
                        borderColor: '#3f3f46',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
                      }}
                      itemStyle={{ color: '#fff' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(val: any, name: any) => [`${val} titles (${Math.round((Number(val) / stats.total) * 100)}%)`, name]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={32}
                      formatter={(value) => <span className="text-[11px] text-zinc-300">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  No shows to display
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800/80 mt-auto text-center">
              <div className="bg-zinc-900/60 rounded-lg p-2 border border-zinc-800">
                <span className="text-[10px] text-emerald-400 block font-bold">Watched</span>
                <span className="text-sm font-extrabold text-white">{stats.watched}</span>
              </div>
              <div className="bg-zinc-900/60 rounded-lg p-2 border border-zinc-800">
                <span className="text-[10px] text-amber-400 block font-bold">Watching</span>
                <span className="text-sm font-extrabold text-white">{stats.watching}</span>
              </div>
              <div className="bg-zinc-900/60 rounded-lg p-2 border border-zinc-800">
                <span className="text-[10px] text-red-400 block font-bold">Wishlist</span>
                <span className="text-sm font-extrabold text-white">{stats.wishlist}</span>
              </div>
            </div>
          </div>

          {/* Platforms Distribution Bar Chart */}
          <div className="lg:col-span-7 bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-bold text-white tracking-tight">Streaming Platforms Breakdown</h2>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">{platformData.length} active</span>
            </div>

            <div className="h-72 w-full">
              {platformData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData} margin={{ top: 10, right: 10, left: -5, bottom: 45 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#71717a"
                      fontSize={10}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={50}
                      tickFormatter={(val: string) => (val.length > 9 ? `${val.slice(0, 8)}…` : val)}
                    />
                    <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} width={25} />
                    <Tooltip
                      cursor={false}
                      wrapperStyle={{ outline: 'none' }}
                      contentStyle={{
                        backgroundColor: '#181818',
                        borderColor: '#3f3f46',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
                      }}
                      itemStyle={{ color: '#fff' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(val: any) => [`${val} titles`, 'Library Count']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {platformData.map((_, index) => (
                        <Cell key={`bar-${index}`} fill={PLATFORM_COLORS[index % PLATFORM_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  No platforms tracked yet
                </div>
              )}
            </div>

            <div className="text-[11px] text-zinc-400 text-center pt-2 border-t border-zinc-800/80 mt-auto">
              Most tracked platform: <span className="text-white font-bold">{platformData[0]?.name || 'N/A'}</span> ({platformData[0]?.count || 0} titles)
            </div>
          </div>
        </div>

        {/* Charts Row 2: Genre Breakdown & Ratings Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Genres Chart */}
          <div className="lg:col-span-6 bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Top Genres</h2>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">{genreData.length} genres</span>
            </div>

            <div className="h-64 w-full">
              {genreData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={genreData}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: -5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" stroke="#71717a" fontSize={10} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#a1a1aa"
                      fontSize={10}
                      width={75}
                      tickFormatter={(val: string) => (val.length > 10 ? `${val.slice(0, 9)}…` : val)}
                    />
                    <Tooltip
                      cursor={false}
                      wrapperStyle={{ outline: 'none' }}
                      contentStyle={{
                        backgroundColor: '#181818',
                        borderColor: '#3f3f46',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
                      }}
                      itemStyle={{ color: '#fff' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(val: any) => [`${val} titles`, 'Count']}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {genreData.map((_, index) => (
                        <Cell key={`genre-cell-${index}`} fill={GENRE_COLORS[index % GENRE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  No genre data available
                </div>
              )}
            </div>
          </div>

          {/* Ratings Distribution Chart */}
          <div className="lg:col-span-6 bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Ratings Breakdown</h2>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-300 bg-zinc-900/80 px-2.5 py-0.5 rounded-md border border-zinc-800">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span>Avg {stats.avgRating} / 5</span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingData} margin={{ top: 10, right: 10, left: -5, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#71717a"
                    fontSize={10}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} width={25} />
                  <Tooltip
                    cursor={false}
                    wrapperStyle={{ outline: 'none' }}
                    contentStyle={{
                      backgroundColor: '#181818',
                      borderColor: '#3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(val: any) => [`${val} titles`, 'Ratings']}
                  />
                  <Bar dataKey="count" fill="#eab308" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Timeline / Release Years Chart */}
        {yearData.length > 1 && (
          <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Release Years Timeline</h2>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">Distribution over time</span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearData} margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                  <defs>
                    <linearGradient id="yearGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="year" stroke="#71717a" fontSize={10} interval="preserveStartEnd" />
                  <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} width={25} />
                  <Tooltip
                    cursor={false}
                    wrapperStyle={{ outline: 'none' }}
                    contentStyle={{
                      backgroundColor: '#181818',
                      borderColor: '#3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(val: any) => [`${val} titles`, 'Released']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#yearGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bottom Section: Active In-Progress & Masterpiece Titles Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Watching In-Progress */}
          <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-500 fill-current" />
                <h3 className="text-sm font-bold text-white tracking-tight">Currently In-Progress Shows</h3>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
                {inProgressList.length} titles
              </span>
            </div>

            {inProgressList.length > 0 ? (
              <div className="space-y-2.5">
                {inProgressList.map((show) => {
                  const cur = parseInt(String(show.episodes).replace(/[^0-9]/g, '')) || 1;
                  const max = parseInt(String(show.maxEp).replace(/[^0-9]/g, '')) || 8;
                  const progress = Math.min(100, Math.round((cur / max) * 100));

                  return (
                    <div
                      key={show.id}
                      onClick={() => onOpenDetails(show)}
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {show.platform}
                            </span>
                            <span>{show.type === 'Movie' ? 'Movie' : `${show.seasons} • Ep ${cur}/${max}`}</span>
                          </div>
                          {show.type === 'Series' && (
                            <div className="w-36 bg-zinc-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-400">{progress}%</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">No shows currently marked as Watching</p>
            )}
          </div>

          {/* Top Rated Titles */}
          <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Top Rated Titles (4–5 Stars)</h3>
              </div>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-mono font-bold">
                {topRatedList.length} titles
              </span>
            </div>

            {topRatedList.length > 0 ? (
              <div className="space-y-2.5">
                {topRatedList.map((show) => {
                  let stars = show.ratingNum || 0;
                  if (!stars && show.rating) {
                    if (show.rating.toLowerCase().includes('excellent')) stars = 5;
                    else if (show.rating.toLowerCase().includes('great')) stars = 4;
                    else if (show.rating.toLowerCase().includes('good')) stars = 3;
                    else if (show.rating.toLowerCase().includes('fair')) stars = 2;
                    else if (show.rating.toLowerCase().includes('poor')) stars = 1;
                    else {
                      stars = (show.rating.match(/⭐/g) || []).length;
                    }
                  }
                  if (!stars) stars = 5;

                  return (
                    <div
                      key={show.id}
                      onClick={() => onOpenDetails(show)}
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1 flex-wrap">
                             <div className="flex items-center gap-0.5 bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i <= stars
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'fill-zinc-800 text-zinc-700'
                                  }`}
                                />
                              ))}
                              <span className="text-[10px] font-bold text-amber-400 ml-1">
                                {stars === 5 ? 'Excellent' : stars === 4 ? 'Great' : `${stars}/5`}
                              </span>
                            </div>
                            <span>•</span>
                            <span>{show.genre}</span>
                            <span>•</span>
                            <span>{show.year}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Info className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">No titles rated 4 or 5 stars yet</p>
            )}
          </div>
        </div>

        {/* Back to top / Return button */}
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Shows Library</span>
          </button>
        </div>
      </div>
    </div>
  );
}
