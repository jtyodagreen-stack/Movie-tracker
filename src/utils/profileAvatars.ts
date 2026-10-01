export interface ProfileAvatarOption {
  id: string;
  name: string;
  category: 'classic' | 'fun' | 'cinema';
  svgOrEmoji: string;
  bgGradient: string;
  borderColor: string;
}

export const NETFLIX_AVATARS: ProfileAvatarOption[] = [
  // 1. Classic Netflix Smile Tiles
  {
    id: 'netflix-red',
    name: 'Netflix Classic Red',
    category: 'classic',
    svgOrEmoji: 'face-smile',
    bgGradient: 'from-red-600 to-rose-700',
    borderColor: '#E50914',
  },
  {
    id: 'netflix-yellow',
    name: 'Sunny Yellow',
    category: 'classic',
    svgOrEmoji: 'face-smile',
    bgGradient: 'from-amber-400 to-yellow-600',
    borderColor: '#F59E0B',
  },
  {
    id: 'netflix-blue',
    name: 'Electric Blue',
    category: 'classic',
    svgOrEmoji: 'face-smile',
    bgGradient: 'from-blue-500 to-indigo-700',
    borderColor: '#3B82F6',
  },
  {
    id: 'netflix-green',
    name: 'Emerald Green',
    category: 'classic',
    svgOrEmoji: 'face-smile',
    bgGradient: 'from-emerald-400 to-teal-700',
    borderColor: '#10B981',
  },
  {
    id: 'netflix-purple',
    name: 'Royal Purple',
    category: 'classic',
    svgOrEmoji: 'face-smile',
    bgGradient: 'from-purple-500 to-violet-800',
    borderColor: '#8B5CF6',
  },
  {
    id: 'netflix-pink',
    name: 'Neon Pink',
    category: 'classic',
    svgOrEmoji: 'face-smile',
    bgGradient: 'from-pink-500 to-rose-600',
    borderColor: '#EC4899',
  },

  // 2. Cinema & Streaming
  {
    id: 'popcorn',
    name: 'Movie Popcorn',
    category: 'cinema',
    svgOrEmoji: '🍿',
    bgGradient: 'from-amber-500 to-red-600',
    borderColor: '#F59E0B',
  },
  {
    id: 'clapper',
    name: 'Director Clapper',
    category: 'cinema',
    svgOrEmoji: '🎬',
    bgGradient: 'from-zinc-700 to-zinc-900',
    borderColor: '#E50914',
  },
  {
    id: 'crown',
    name: 'Crown Royal',
    category: 'cinema',
    svgOrEmoji: '👑',
    bgGradient: 'from-amber-300 via-amber-500 to-yellow-700',
    borderColor: '#F59E0B',
  },
  {
    id: 'superhero',
    name: 'Hero Emblem',
    category: 'cinema',
    svgOrEmoji: '🦸',
    bgGradient: 'from-blue-600 to-red-600',
    borderColor: '#3B82F6',
  },
  {
    id: 'gamer',
    name: 'Retro Gamer',
    category: 'cinema',
    svgOrEmoji: '🎮',
    bgGradient: 'from-purple-600 to-indigo-900',
    borderColor: '#8B5CF6',
  },

  // 3. Fun Characters
  {
    id: 'ninja',
    name: 'Shadow Ninja',
    category: 'fun',
    svgOrEmoji: '🥷',
    bgGradient: 'from-zinc-800 to-black',
    borderColor: '#EF4444',
  },
  {
    id: 'robot',
    name: 'Sci-Fi Bot',
    category: 'fun',
    svgOrEmoji: '🤖',
    bgGradient: 'from-cyan-500 to-blue-700',
    borderColor: '#06B6D4',
  },
  {
    id: 'alien',
    name: 'Cosmic Alien',
    category: 'fun',
    svgOrEmoji: '👽',
    bgGradient: 'from-emerald-500 to-green-900',
    borderColor: '#10B981',
  },
  {
    id: 'cat',
    name: 'Cool Cat',
    category: 'fun',
    svgOrEmoji: '🐱',
    bgGradient: 'from-orange-400 to-amber-600',
    borderColor: '#F97316',
  },
  {
    id: 'dog',
    name: 'Party Dog',
    category: 'fun',
    svgOrEmoji: '🐶',
    bgGradient: 'from-teal-400 to-cyan-700',
    borderColor: '#14B8A6',
  },
  {
    id: 'detective',
    name: 'Detective',
    category: 'fun',
    svgOrEmoji: '🕵️',
    bgGradient: 'from-amber-700 to-zinc-900',
    borderColor: '#D97706',
  },
  {
    id: 'fire',
    name: 'Flame Star',
    category: 'fun',
    svgOrEmoji: '🔥',
    bgGradient: 'from-orange-500 to-red-700',
    borderColor: '#EF4444',
  },
];

const LOCAL_STORAGE_KEY = 'showflix_viewer_avatars_v1';

export function getStoredViewerAvatars(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveStoredViewerAvatars(avatars: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(avatars));
  } catch (e) {
    // ignore
  }
}

export function getViewerAvatarId(viewerName?: string, customAvatars?: Record<string, string>): string {
  if (!viewerName) return 'netflix-red';
  const trimmed = viewerName.trim();
  if (customAvatars && customAvatars[trimmed]) {
    return customAvatars[trimmed];
  }
  const stored = getStoredViewerAvatars();
  if (stored[trimmed]) {
    return stored[trimmed];
  }
  // Deterministic fallback based on name
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % NETFLIX_AVATARS.length;
  return NETFLIX_AVATARS[index].id;
}

export function findAvatarOption(avatarId?: string): ProfileAvatarOption {
  const found = NETFLIX_AVATARS.find((a) => a.id === avatarId);
  return found || NETFLIX_AVATARS[0];
}
