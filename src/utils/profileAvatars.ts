export interface NetflixAvatar {
  id: string;
  name: string;
  bgColor: string;
}

export const NETFLIX_AVATARS: NetflixAvatar[] = [
  { id: 'classic-red', name: 'Classic Red', bgColor: '#E50914' },
  { id: 'classic-blue', name: 'Classic Blue', bgColor: '#1F6FEB' },
  { id: 'classic-green', name: 'Classic Green', bgColor: '#2EA043' },
  { id: 'classic-yellow', name: 'Classic Yellow', bgColor: '#D29922' },
  { id: 'classic-purple', name: 'Classic Purple', bgColor: '#8957E5' },
  { id: 'classic-pink', name: 'Classic Pink', bgColor: '#F43F5E' },
  { id: 'retro-gamer', name: 'Retro Gamer', bgColor: '#FF5722' },
  { id: 'cinema-buff', name: 'Cinema Buff', bgColor: '#607D8B' },
  { id: 'sci-fi-fan', name: 'Sci-Fi Fan', bgColor: '#00BCD4' },
  { id: 'spooky-ghost', name: 'Spooky Ghost', bgColor: '#9C27B0' },
  { id: 'detective', name: 'Detective', bgColor: '#3F51B5' },
  { id: 'chef', name: 'Gourmet Chef', bgColor: '#4CAF50' },
];

export function getViewerAvatarId(viewer: string, avatars: Record<string, string>): string {
  if (avatars && avatars[viewer]) {
    return avatars[viewer];
  }
  // Deterministic default based on viewer name
  if (!viewer) return 'classic-red';
  let sum = 0;
  for (let i = 0; i < viewer.length; i++) {
    sum += viewer.charCodeAt(i);
  }
  const index = sum % NETFLIX_AVATARS.length;
  return NETFLIX_AVATARS[index].id;
}

export function getStoredViewerAvatars(): Record<string, string> {
  try {
    const saved = localStorage.getItem('showflix_viewer_avatars');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

export function saveStoredViewerAvatars(avatars: Record<string, string>): void {
  try {
    localStorage.setItem('showflix_viewer_avatars', JSON.stringify(avatars));
  } catch (e) {}
}
