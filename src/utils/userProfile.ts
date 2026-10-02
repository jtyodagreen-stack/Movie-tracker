import type { User } from 'firebase/auth';

export const DEFAULT_USER_EMAIL = '';
export const DEFAULT_USER_NAME = 'User';

// SVG data URI of the official Google Account profile picture
export const GOOGLE_AVATAR_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a73e8"/>
      <stop offset="100%" stop-color="#0d47a1"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#gGrad)"/>
  <text x="50%" y="54%" font-family="Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">J</text>
</svg>
`.trim())}`;

export const DEFAULT_PROFILE_PICTURE = `https://ui-avatars.com/api/?name=User&background=1a73e8&color=ffffff&bold=true&rounded=true&size=128`;

/**
 * Custom helper to request high-res profile photo from Google servers.
 * Changing the size suffix (e.g. from =s96-c to =s256-c) naturally bypasses CDNs
 * and browser caches without adding query parameters that trigger 403 Forbidden errors.
 */
export function optimizeGooglePhotoUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  let cleanUrl = url.trim();

  if (cleanUrl.includes('googleusercontent.com')) {
    // Strip any query parameters completely (e.g. ?cb=..., &cb=...) to prevent 403 errors
    cleanUrl = cleanUrl.split(/[?&]/)[0];

    // Replace any existing size parameter (e.g. =s96-c, =s96, =s120) with high-res s256-c
    const sizeParamRegex = /=[sS]\d+(-[cc])?$/;
    if (sizeParamRegex.test(cleanUrl)) {
      cleanUrl = cleanUrl.replace(sizeParamRegex, '=s256-c');
    } else {
      // If it doesn't have a size suffix, append '=s256-c' directly
      cleanUrl = cleanUrl + '=s256-c';
    }
  }

  return cleanUrl;
}

/**
 * Returns the active user's profile photo URL, prioritizing local storage cache,
 * raw Google providerData details, and falling back to user.photoURL.
 */
export function getProfilePicture(user?: any | null): string {
  // 1. Prioritize live User Google photo URL over cached/saved data
  if (user?.photoURL && typeof user.photoURL === 'string' && user.photoURL.includes('googleusercontent.com')) {
    return optimizeGooglePhotoUrl(user.photoURL);
  }

  // 2. Prioritize live Provider Google photo URL
  if (user?.providerData && Array.isArray(user.providerData)) {
    for (const p of user.providerData) {
      if (p?.photoURL && typeof p.photoURL === 'string' && p.photoURL.includes('googleusercontent.com')) {
        return optimizeGooglePhotoUrl(p.photoURL);
      }
    }
  }

  // 3. Fallback to local storage cache if live profile is missing
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showflix_user_profile') || localStorage.getItem('bingebox_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.photoURL && typeof parsed.photoURL === 'string' && parsed.photoURL.trim().length > 0) {
          if (!parsed.email || !user || !user.email || parsed.email === user.email) {
            return optimizeGooglePhotoUrl(parsed.photoURL);
          }
        }
      }
    }
  } catch {}

  // 4. Fallback to standard photoURL
  if (user?.photoURL && typeof user.photoURL === 'string' && user.photoURL.trim().length > 0) {
    return optimizeGooglePhotoUrl(user.photoURL);
  }

  return DEFAULT_PROFILE_PICTURE;
}

/**
 * Returns the user's display name or sensible default.
 */
export function getProfileDisplayName(user?: any | null): string {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showflix_user_profile') || localStorage.getItem('bingebox_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.displayName && typeof parsed.displayName === 'string' && parsed.displayName.trim().length > 0) {
          if (!parsed.email || !user || !user.email || parsed.email === user.email) {
            return parsed.displayName.trim();
          }
        }
      }
    }
  } catch {}

  if (user?.displayName && user.displayName.trim().length > 0) {
    return user.displayName;
  }
  if (user?.email && user.email.includes('@')) {
    const prefix = user.email.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return DEFAULT_USER_NAME;
}

/**
 * Returns the user's email or default email.
 */
export function getProfileEmail(user?: { email?: string | null } | null): string {
  return user?.email || DEFAULT_USER_EMAIL;
}

/**
 * Creates the default Google Account user profile object.
 */
export const DEFAULT_PROFILE_USER: User = {
  uid: 'user_default',
  email: DEFAULT_USER_EMAIL,
  displayName: DEFAULT_USER_NAME,
  photoURL: DEFAULT_PROFILE_PICTURE,
  emailVerified: true,
  isAnonymous: false,
  metadata: {} as any,
  providerData: [
    {
      providerId: 'google.com',
      uid: DEFAULT_USER_EMAIL,
      displayName: DEFAULT_USER_NAME,
      email: DEFAULT_USER_EMAIL,
      phoneNumber: null,
      photoURL: DEFAULT_PROFILE_PICTURE,
    },
  ],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => '',
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  providerId: 'firebase',
};
