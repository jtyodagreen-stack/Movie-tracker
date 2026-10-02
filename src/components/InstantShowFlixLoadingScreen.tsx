import { useState, useEffect } from 'react';

interface InstantShowFlixLoadingScreenProps {
  message?: string;
  onFinish?: () => void;
  minDurationMs?: number;
}

export default function InstantShowFlixLoadingScreen({
  message = 'Loading your ShowFlix library...',
  onFinish,
  minDurationMs = 1200,
}: InstantShowFlixLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(p);

      if (elapsed >= minDurationMs) {
        clearInterval(interval);
        setIsFadingOut(true);
        setTimeout(() => {
          if (onFinish) onFinish();
        }, 350); // 350ms smooth CSS fade-out
      }
    }, 25);

    return () => clearInterval(interval);
  }, [minDurationMs, onFinish]);

  return (
    <div
      id="instant-showflix-loading-screen"
      data-preserve-theme="true"
      onClick={() => {
        // Instant click/tap anywhere to skip
        setIsFadingOut(true);
        setTimeout(() => {
          if (onFinish) onFinish();
        }, 120);
      }}
      className={`fixed inset-0 z-[99999] bg-[#141414] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-300 ease-out cursor-pointer ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: '#141414',
        backgroundImage:
          'radial-gradient(circle at center, rgba(229, 9, 20, 0.35) 0%, rgba(20, 20, 20, 0.98) 65%, #141414 100%)',
      }}
    >
      {/* Ambilight Background Glow */}
      <div
        className="absolute w-[380px] h-[380px] sm:w-[550px] sm:h-[550px] rounded-full blur-[110px] pointer-events-none animate-pulse"
        style={{
          backgroundColor: 'rgba(229, 9, 20, 0.28)',
          boxShadow: '0 0 150px rgba(229, 9, 20, 0.4)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm px-4 text-center">
        {/* Original Red "N" Box Logo (Strictly preserved from theme changes) */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center transform transition-transform duration-500 hover:scale-105 animate-bounce-short shadow-[0_0_60px_rgba(229,9,20,0.8),0_0_20px_rgba(229,9,20,0.5)] border border-white/20"
            style={{
              backgroundColor: '#E50914',
              color: '#ffffff',
            }}
          >
            <span
              className="font-black text-white text-5xl sm:text-6xl tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              style={{ color: '#ffffff' }}
            >
              N
            </span>
          </div>

          {/* SHOWFLIX Brand Name */}
          <div className="text-3xl sm:text-4xl font-black tracking-[0.2em] uppercase text-white drop-shadow-[0_0_20px_rgba(229,9,20,0.8)]">
            SHOW
            <span
              style={{ color: '#E50914', textShadow: '0 0 25px rgba(229,9,20,0.9)' }}
            >
              FLIX
            </span>
          </div>
        </div>

        {/* Ambilight Progress Loading Bar Container */}
        <div className="w-60 sm:w-68 space-y-2.5 pt-1">
          <div className="w-full bg-zinc-900/90 rounded-full h-2 overflow-hidden border border-zinc-700/60 p-0.5 shadow-[0_0_20px_rgba(229,9,20,0.3)]">
            <div
              className="h-full rounded-full transition-all duration-75 ease-out shadow-[0_0_15px_rgba(229,9,20,1)]"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #E50914 0%, #ff4d4d 60%, #f59e0b 100%)',
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 px-1">
            <span className="truncate max-w-[190px]">{message}</span>
            <span className="font-mono font-bold" style={{ color: '#E50914' }}>
              {progress}%
            </span>
          </div>
        </div>

        <p className="mt-5 text-[10px] text-zinc-500 italic">
          Click anywhere to skip
        </p>
      </div>
    </div>
  );
}
