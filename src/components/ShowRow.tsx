import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ShowItem } from '../types';
import ShowCard from './ShowCard';

interface ShowRowProps {
  id: string;
  title: string;
  subtitle?: string;
  shows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  onTitleClick?: () => void;
}

export default function ShowRow({
  id,
  title,
  subtitle,
  shows,
  onOpenDetails,
  onIncrementEpisode,
  onToggleStatus,
  onTitleClick,
}: ShowRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (shows.length === 0) return null;

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
    const scrollAmount = clientWidth * 0.75;
    rowRef.current.scrollTo({
      left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section id={`row-${id}`} className="relative py-4 group">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 flex items-baseline justify-between">
        <div
          className={`flex items-baseline gap-2 ${
            onTitleClick ? 'cursor-pointer group/title' : ''
          }`}
          onClick={onTitleClick}
        >
          <h2
            className={`text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2 ${
              onTitleClick ? 'group-hover/title:text-red-500 transition-colors' : ''
            }`}
          >
            {title}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
              {shows.length}
            </span>
          </h2>
          {subtitle && (
            <span
              className={`text-xs text-zinc-400 hidden sm:inline ${
                onTitleClick ? 'group-hover/title:text-zinc-300 transition-colors' : ''
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Left Arrow */}
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-20 bg-black/70 hover:bg-black/90 text-white rounded-r-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border-y border-r border-zinc-700/60 backdrop-blur-sm shadow-xl"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrollable Row */}
        <div
          ref={rowRef}
          className="flex items-start gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pt-12 pb-14 px-2 -my-10"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {shows.map((show) => (
            <ShowCard
              key={show.id}
              show={show}
              onOpenDetails={onOpenDetails}
              onIncrementEpisode={onIncrementEpisode}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-20 bg-black/70 hover:bg-black/90 text-white rounded-l-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border-y border-l border-zinc-700/60 backdrop-blur-sm shadow-xl"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
}
