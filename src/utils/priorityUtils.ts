export interface PriorityIndicatorConfig {
  label: string;
  tooltip: string;
  className: string;
  level: 'high' | 'medium' | 'low' | 'custom';
}

/**
 * Normalizes and extracts visual configuration for any Priority level.
 * Guarantees 100% visual consistency across cards, hover portals, and modals.
 */
export function getPriorityIndicator(priority?: string, isWishlist?: boolean): PriorityIndicatorConfig | null {
  // Priority is strictly for wishlist items only
  if (!isWishlist) return null;

  const raw = String(priority || '').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('high') || lower.includes('🔴')) {
    return {
      label: '🔴 High',
      tooltip: 'High Priority',
      className: '!bg-red-600 !text-white !border-red-500 font-black shadow-sm ring-1 !ring-red-500/40',
      level: 'high',
    };
  }

  if (lower.includes('medium') || lower.includes('mid') || lower.includes('yellow') || lower.includes('🟡')) {
    return {
      label: '🟡 Medium',
      tooltip: 'Medium Priority',
      className: '!bg-amber-400 !text-black !border-amber-300 font-extrabold shadow-sm ring-1 !ring-amber-400/40',
      level: 'medium',
    };
  }

  if (lower.includes('low') || lower.includes('green') || lower.includes('🟢')) {
    return {
      label: '🟢 Low',
      tooltip: 'Low Priority',
      className: '!bg-emerald-600 !text-white !border-emerald-500 font-extrabold shadow-sm ring-1 !ring-emerald-500/40',
      level: 'low',
    };
  }

  if (isWishlist) {
    if (raw) {
      return {
        label: raw,
        tooltip: `${raw} Priority`,
        className: 'bg-amber-500 text-black border-amber-400 font-bold shadow-sm',
        level: 'custom',
      };
    }
    // Wishlist items default to 🔴 High Priority
    return {
      label: '🔴 High',
      tooltip: 'High Priority',
      className: 'bg-red-600 text-white border-red-500 font-black shadow-sm ring-1 ring-red-500/40',
      level: 'high',
    };
  }

  if (raw) {
    return {
      label: raw,
      tooltip: `${raw} Priority`,
      className: 'bg-zinc-800 text-zinc-200 border-zinc-700 font-medium shadow-sm',
      level: 'custom',
    };
  }

  return null;
}
