export interface ProfileColorOption {
  hex: string;
  name: string;
  bgClass: string;
  borderClass: string;
}

export const PROFILE_COLOR_PALETTE: ProfileColorOption[] = [
  { hex: '#EF4444', name: 'Crimson Red', bgClass: 'bg-red-500', borderClass: 'border-red-500' },
  { hex: '#F97316', name: 'Vibrant Orange', bgClass: 'bg-orange-500', borderClass: 'border-orange-500' },
  { hex: '#F59E0B', name: 'Amber Gold', bgClass: 'bg-amber-500', borderClass: 'border-amber-500' },
  { hex: '#10B981', name: 'Emerald Green', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-500' },
  { hex: '#06B6D4', name: 'Cyan Aqua', bgClass: 'bg-cyan-500', borderClass: 'border-cyan-500' },
  { hex: '#3B82F6', name: 'Electric Blue', bgClass: 'bg-blue-500', borderClass: 'border-blue-500' },
  { hex: '#6366F1', name: 'Indigo Night', bgClass: 'bg-indigo-500', borderClass: 'border-indigo-500' },
  { hex: '#8B5CF6', name: 'Royal Violet', bgClass: 'bg-purple-500', borderClass: 'border-purple-500' },
  { hex: '#EC4899', name: 'Rose Pink', bgClass: 'bg-pink-500', borderClass: 'border-pink-500' },
  { hex: '#14B8A6', name: 'Teal Mint', bgClass: 'bg-teal-500', borderClass: 'border-teal-500' },
];

/**
 * Resolves a profile viewer's color tag, checking custom assignment first,
 * or deterministically hashing the viewer name to a consistent palette color.
 */
export function getViewerColor(name?: string, customColors?: Record<string, string>): string {
  if (!name) return PROFILE_COLOR_PALETTE[0].hex;
  const trimmed = name.trim();
  if (customColors && customColors[trimmed]) {
    return customColors[trimmed];
  }
  // Deterministic fallback based on name character hash
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PROFILE_COLOR_PALETTE.length;
  return PROFILE_COLOR_PALETTE[index].hex;
}

export function getViewerColorName(hex: string): string {
  const found = PROFILE_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return found ? found.name : 'Custom Tag';
}
