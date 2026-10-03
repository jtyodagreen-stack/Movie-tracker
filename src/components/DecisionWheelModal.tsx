import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, Check, RefreshCw, Sparkles, AlertCircle, Eye, Tv } from 'lucide-react';
import { ShowItem } from '../types';

interface DecisionWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistShows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
  onMarkAsWatching?: (show: ShowItem) => void;
}

const WHEEL_COLORS = [
  '#E50914', // Red
  '#FF9900', // Orange
  '#10B981', // Emerald Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#14B8A6', // Teal
  '#84CC16', // Lime
];

export default function DecisionWheelModal({
  isOpen,
  onClose,
  wishlistShows,
  onOpenDetails,
  onMarkAsWatching,
}: DecisionWheelModalProps) {
  // Filter out shows without titles
  const validShows = wishlistShows.filter(s => s.title);
  
  // Let the user select/toggle which shows to include in the spin pool
  const [selectedPool, setSelectedPool] = useState<Record<string, boolean>>({});
  const [currentRotation, setCurrentRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<ShowItem | null>(null);
  const [isTickActive, setIsTickActive] = useState(false);

  const wheelRef = useRef<SVGSVGElement | null>(null);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use a ref to track if we have initialized this open session
  const initializedRef = useRef(false);

  // Initialize pool with all valid shows only once when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!initializedRef.current) {
        const initialPool: Record<string, boolean> = {};
        validShows.forEach(show => {
          initialPool[show.id] = true;
        });
        setSelectedPool(initialPool);
        setWinner(null);
        setCurrentRotation(0);
        setIsSpinning(false);
        initializedRef.current = true;
      }
    } else {
      initializedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Active items for the wheel
  const activeItems = validShows.filter(show => selectedPool[show.id]);
  const numItems = activeItems.length;

  const handleToggleShow = (id: string) => {
    if (isSpinning) return;
    setSelectedPool(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      // Make sure we have at least 2 checked if possible, or support minimum pool
      return updated;
    });
    setWinner(null);
  };

  const handleSelectAll = () => {
    if (isSpinning) return;
    const updated: Record<string, boolean> = {};
    validShows.forEach(show => {
      updated[show.id] = true;
    });
    setSelectedPool(updated);
    setWinner(null);
  };

  const handleDeselectAll = () => {
    if (isSpinning) return;
    setSelectedPool({});
    setWinner(null);
  };

  const handleSpin = () => {
    if (isSpinning || numItems < 2) return;

    setIsSpinning(true);
    setWinner(null);

    // Pick a random index
    const winnerIndex = Math.floor(Math.random() * numItems);
    const chosenShow = activeItems[winnerIndex];

    // Calculate rotation angle using cumulative rotation to ensure "Spin Again" always works flawlessly
    const sliceAngle = 360 / numItems;
    const targetOffset = 360 - (winnerIndex * sliceAngle) - (sliceAngle / 2);
    
    // Spin 8 full times for maximum cinematic suspense
    const extraSpins = 360 * 8; 

    // Find the base angle from our current rotation (removing the remainder of the previous spin)
    const baseAngle = currentRotation - (currentRotation % 360);
    const nextRotation = baseAngle + extraSpins + targetOffset;

    setCurrentRotation(nextRotation);

    // Simulate pointer clicking ticks
    let ticks = 0;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      setIsTickActive(prev => !prev);
      ticks++;
      if (ticks > 25) {
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      }
    }, 120);

    // Wait for animation to finish (4 seconds)
    setTimeout(() => {
      setIsSpinning(false);
      setWinner(chosenShow);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      
      // Celebrate with confetti!
      import('canvas-confetti').then((m) => {
        try {
          const confettiFn = m.default;
          if (typeof confettiFn === 'function') {
            confettiFn({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#E50914', '#FF9900', '#10B981', '#3B82F6', '#EC4899']
            });
          }
        } catch (e) {
          console.warn('Confetti fail:', e);
        }
      }).catch((e) => {
        console.warn('Confetti load fail:', e);
      });
    }, 4000);
  };

  // Generate SVG slice path data
  const generateSlices = () => {
    if (numItems === 0) return [];

    return activeItems.map((item, index) => {
      const angleStep = 360 / numItems;
      const startAngle = index * angleStep;
      const endAngle = (index + 1) * angleStep;

      // Convert degrees to radians for trigonometric calculations
      const rad1 = ((startAngle - 90) * Math.PI) / 180;
      const rad2 = ((endAngle - 90) * Math.PI) / 180;

      // Radius is 150 (center is at 150, 150)
      const r = 150;
      const cx = 150;
      const cy = 150;

      const x1 = cx + r * Math.cos(rad1);
      const y1 = cy + r * Math.sin(rad1);
      const x2 = cx + r * Math.cos(rad2);
      const y2 = cy + r * Math.sin(rad2);

      const largeArcFlag = angleStep > 180 ? 1 : 0;

      const pathData = `
        M ${cx} ${cy}
        L ${x1} ${y1}
        A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}
        Z
      `;

      // Position text in mid angle
      const midAngle = startAngle + angleStep / 2 - 90;
      const textRad = (midAngle * Math.PI) / 180;
      const textX = cx + (r * 0.58) * Math.cos(textRad);
      const textY = cy + (r * 0.58) * Math.sin(textRad);

      return {
        pathData,
        color: WHEEL_COLORS[index % WHEEL_COLORS.length],
        textX,
        textY,
        textAngle: midAngle + 90, // perpendicular rot
        title: item.title,
      };
    });
  };

  const slices = generateSlices();

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      id="decision-wheel-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="decision-wheel-dialog"
        className="relative w-full max-w-4xl bg-[#141414] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Spin Wheel Area */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-900 bg-zinc-950/20 select-none">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-900 mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
              <div>
                <h4 className="text-base font-black text-white">🎰 ShowFlix Decision Wheel</h4>
                <p className="text-[11px] text-zinc-400">Can't decide what to watch? Spin the wheel of Wishlist titles!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Wheel Frame */}
          <div className="relative flex flex-col items-center justify-center my-auto py-2">
            
            {/* Outer Glow Ring */}
            <div className="absolute inset-x-0 top-2 bottom-2 mx-auto w-[290px] h-[290px] sm:w-[316px] sm:h-[316px] rounded-full bg-gradient-to-tr from-red-600/10 via-amber-500/10 to-transparent blur-md pointer-events-none" />

            {/* Selector Pointer Arrow (Pointing Down at Top Center) */}
            <div 
              className={`absolute top-0 z-30 transform -translate-y-1 transition-transform duration-75 ${
                isTickActive ? 'rotate-12 scale-110 text-amber-400' : 'rotate-0 text-red-500'
              }`}
            >
              <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-current drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-white absolute top-[-18px] left-[-5px] shadow" />
            </div>

            {/* Svg Wheel Canvas */}
            <div className="relative w-[280px] h-[280px] sm:w-[310px] sm:h-[310px] bg-zinc-900 border-8 border-zinc-800 rounded-full shadow-2xl overflow-hidden">
              {numItems >= 2 ? (
                <svg
                  ref={wheelRef}
                  viewBox="0 0 300 300"
                  className="w-full h-full transform transition-transform cubic-bezier-0.15, 0.85, 0.35, 1"
                  style={{
                    transform: `rotate(${currentRotation}deg)`,
                    transitionDuration: isSpinning ? '4000ms' : '0ms',
                    transitionProperty: 'transform',
                  }}
                >
                  {slices.map((slice, idx) => (
                    <g key={idx} className="cursor-default">
                      {/* Radial Wedge Segment */}
                      <path
                        d={slice.pathData}
                        fill={slice.color}
                        stroke="#141414"
                        strokeWidth="3"
                        className="hover:opacity-95 transition-opacity"
                      />
                      {/* Wedge text title rotated radial */}
                      <text
                        x={slice.textX}
                        y={slice.textY}
                        fill="#ffffff"
                        fontSize={numItems > 8 ? "9px" : "10px"}
                        fontWeight="900"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        transform={`rotate(${slice.textAngle}, ${slice.textX}, ${slice.textY})`}
                        className="font-sans tracking-wide drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] select-none pointer-events-none uppercase"
                      >
                        {slice.title.length > 11 ? slice.title.slice(0, 9) + '..' : slice.title}
                      </text>
                    </g>
                  ))}
                  
                  {/* Central Peg Decoration */}
                  <circle cx="150" cy="150" r="16" fill="#18181b" stroke="#3f3f46" strokeWidth="2.5" />
                  <circle cx="150" cy="150" r="6" fill="#ffffff" />
                </svg>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                  <AlertCircle className="w-10 h-10 text-zinc-600 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider block mb-1">Insufficient Pool</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">Add or toggle at least 2 shows on the list to spin the wheel!</span>
                </div>
              )}
            </div>

            {/* Spinner Button overlaying center-ish bottom */}
            <div className="mt-5 relative z-20">
              <button
                type="button"
                disabled={isSpinning || numItems < 2}
                onClick={handleSpin}
                className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-zinc-800 disabled:cursor-not-allowed text-white font-extrabold text-xs tracking-wider uppercase px-8 py-3 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 border border-red-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'SPINNING...' : 'SPIN THE WHEEL!'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Configuration & Winner display */}
        <div className="w-full md:w-[360px] p-6 flex flex-col bg-zinc-950/40 max-h-[45vh] md:max-h-full overflow-y-auto">
          
          {/* Header Close button for desktop */}
          <div className="hidden md:flex justify-end mb-4">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {winner ? (
            /* Celebration winner reveal card */
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-4 animate-in zoom-in-95 duration-300">
              <div className="relative">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto animate-bounce shadow-xl">
                  <Sparkles className="w-8 h-8" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">THE WHEEL DECIDED!</span>
                <h3 className="text-xl font-black text-white px-2 leading-tight">
                  {winner.title}
                </h3>
                {winner.platform && (
                  <span className="inline-block text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full mt-1.5 font-bold">
                    {winner.platform}
                  </span>
                )}
              </div>

              {winner.posterUrl && (
                <div className="w-24 h-36 rounded-lg overflow-hidden shadow-lg border border-zinc-800">
                  <img
                    src={winner.posterUrl}
                    alt={winner.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {winner.notes && (
                <p className="text-[11px] text-zinc-400 line-clamp-3 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-900 max-w-xs leading-relaxed italic">
                  "{winner.notes}"
                </p>
              )}

              <div className="flex flex-col gap-2 w-full pt-2">
                {onMarkAsWatching && (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAsWatching(winner);
                      onClose();
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs py-2.5 rounded-xl cursor-pointer transition-colors shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Mark as Watching</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onOpenDetails(winner);
                    onClose();
                  }}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-xs py-2.5 rounded-xl cursor-pointer transition-colors shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5 border border-zinc-700"
                >
                  <Eye className="w-3.5 h-3.5 text-zinc-300" />
                  <span>View Details & Info</span>
                </button>
                <button
                  type="button"
                  onClick={handleSpin}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs py-2.5 rounded-xl cursor-pointer transition-colors shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Spin Again!</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWinner(null)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs py-2 rounded-xl cursor-pointer transition-colors"
                >
                  Adjust Pool / View List
                </button>
              </div>
            </div>
          ) : (
            /* Toggle pool checklist card */
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              <div className="space-y-1 pb-1">
                <h5 className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📝 Spin Pool Selection</span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    ({numItems}/{validShows.length})
                  </span>
                </h5>
                <p className="text-[11px] text-zinc-500">Select which wishlist titles to include in the wheel pool.</p>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-[10px] py-1.5 rounded-lg transition-colors cursor-pointer text-center"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-[10px] py-1.5 rounded-lg transition-colors cursor-pointer text-center"
                >
                  Deselect All
                </button>
              </div>

              {validShows.length > 0 ? (
                <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0 max-h-[30vh] md:max-h-none border border-zinc-900 rounded-xl p-2 bg-zinc-950/30">
                  {validShows.map(show => {
                    const isChecked = selectedPool[show.id] || false;
                    return (
                      <button
                        key={show.id}
                        type="button"
                        onClick={() => handleToggleShow(show.id)}
                        className={`w-full text-left p-2 rounded-lg flex items-center justify-between text-xs transition-colors border ${
                          isChecked
                            ? 'bg-zinc-900/60 border-zinc-800 text-white'
                            : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked ? 'bg-red-600 border-red-500 text-white' : 'border-zinc-700'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                          </div>
                          <span className="font-medium truncate">{show.title}</span>
                        </div>
                        {show.platform && (
                          <span className="text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-900 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                            {show.platform.split(' ').slice(1).join(' ') || show.platform}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-zinc-900 rounded-2xl bg-zinc-950/20 text-center text-zinc-500">
                  <HelpCircle className="w-8 h-8 text-zinc-600 mb-1.5" />
                  <p className="text-xs font-bold text-zinc-400">Wishlist is Empty</p>
                  <p className="text-[10px] text-zinc-500 leading-normal max-w-xs mt-1">
                    Add some titles to your Wishlist first, and they will automatically populate this spin-wheel!
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
