import './utils/suppressAuthErrors';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  getAdditionalUserInfo,
  updateProfile,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize or reuse Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initial Firestore connection verification
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface UserSheetConfig {
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  showcaseSheetName?: string;
  sheetTitle?: string;
  sheetTabId?: number;
  autoSyncEnabled?: boolean;
  syncFrequency?: number;
  photoURL?: string;
  displayName?: string;
}

export async function saveUserSheetConfig(userId?: string, config: Partial<UserSheetConfig> = {}) {
  // Always resolve to the currently authenticated user's real UID
  const currentUid = auth.currentUser?.uid;
  const targetUid = currentUid || (userId && userId !== 'user_jtyodagreen' ? userId : null);
  
  if (!targetUid || !auth.currentUser) {
    // Cannot write to Firestore if not authenticated as the owner
    return;
  }
  
  const path = `user_settings/${targetUid}`;
  try {
    const dataToSave: Record<string, any> = {
      userId: targetUid,
      updatedAt: new Date().toISOString(),
    };
    if (config.spreadsheetId !== undefined) dataToSave.spreadsheetId = config.spreadsheetId;
    if (config.sheetName !== undefined) dataToSave.sheetName = config.sheetName;
    if (config.wishlistSheetName !== undefined) dataToSave.wishlistSheetName = config.wishlistSheetName;
    if (config.showcaseSheetName !== undefined) dataToSave.showcaseSheetName = config.showcaseSheetName;
    if (config.sheetTitle !== undefined) dataToSave.sheetTitle = config.sheetTitle;
    if (config.sheetTabId !== undefined) dataToSave.sheetTabId = config.sheetTabId;
    if (config.autoSyncEnabled !== undefined) dataToSave.autoSyncEnabled = config.autoSyncEnabled;
    if (config.syncFrequency !== undefined) dataToSave.syncFrequency = config.syncFrequency;
    if (config.photoURL !== undefined) dataToSave.photoURL = config.photoURL;
    if (config.displayName !== undefined) dataToSave.displayName = config.displayName;

    await setDoc(doc(db, 'user_settings', targetUid), dataToSave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserSheetConfig(userId?: string): Promise<UserSheetConfig | null> {
  const currentUid = auth.currentUser?.uid;
  const targetUid = currentUid || (userId && userId !== 'user_jtyodagreen' ? userId : null);
  if (!targetUid || !auth.currentUser) return null;
  
  const path = `user_settings/${targetUid}`;
  try {
    const snap = await getDoc(doc(db, 'user_settings', targetUid));
    if (snap.exists()) {
      return snap.data() as UserSheetConfig;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// State for sign-in flow and token caching
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const getEffectiveUserPhoto = (user: User | null): string | null => {
  const sanitize = (url: string | null | undefined): string | null => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    // Reject and purge any generic third-party unavatar.io links that serve purple/fake avatars
    if (trimmed.includes('unavatar.io')) return null;
    return trimmed;
  };

  // 1. Check direct photoURL on Firebase User object
  if (user?.photoURL) {
    const clean = sanitize(user.photoURL);
    if (clean) return clean;
  }

  // 2. Check provider data (Google provider)
  if (user?.providerData && user.providerData.length > 0) {
    for (const p of user.providerData) {
      const clean = sanitize(p.photoURL);
      if (clean) return clean;
    }
  }

  // 3. Check custom or cached profile in localStorage
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bingebox_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.photoURL) {
          const clean = sanitize(parsed.photoURL);
          if (clean && (!parsed.email || !user || parsed.email === user.email)) {
            return clean;
          } else if (!clean) {
            // Remove corrupted/unavatar cached entry immediately
            localStorage.removeItem('bingebox_user_profile');
          }
        }
      }
    }
  } catch {}

  // Never fall back to unavatar.io
  return null;
};

export const updateUserProfilePhoto = async (
  user: User,
  photoURL: string,
  displayName?: string
): Promise<boolean> => {
  try {
    const cleanURL = photoURL.trim();
    if (!cleanURL || cleanURL.includes('unavatar.io')) return false;

    await updateProfile(user, {
      photoURL: cleanURL,
      displayName: displayName || user.displayName || undefined,
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'bingebox_user_profile',
        JSON.stringify({
          photoURL: cleanURL,
          displayName: displayName || user.displayName || '',
          email: user.email,
        })
      );
    }

    await saveUserSheetConfig(user.uid, {
      photoURL: cleanURL,
      displayName: displayName || user.displayName || undefined,
    });

    return true;
  } catch (err) {
    console.warn('Failed to update user profile photo:', err);
    return false;
  }
};

export const fetchGoogleAccountPhoto = async (
  user: User
): Promise<string | null> => {
  try {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const fresh =
        auth.currentUser.photoURL ||
        auth.currentUser.providerData?.find((p) => p.photoURL)?.photoURL;
      if (fresh && !fresh.includes('unavatar.io')) {
        await updateUserProfilePhoto(user, fresh);
        return fresh;
      }
    }
  } catch (e) {
    console.warn('Firebase user reload failed:', e);
  }
  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Sync profile picture from provider data or cache if user.photoURL is missing or corrupted
      let photo = user.photoURL || user.providerData?.find((p) => p.photoURL)?.photoURL;
      if (photo && photo.includes('unavatar.io')) {
        photo = null;
      }

      if (!photo) {
        try {
          if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('bingebox_user_profile');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.photoURL && !parsed.photoURL.includes('unavatar.io')) {
                photo = parsed.photoURL;
              } else {
                localStorage.removeItem('bingebox_user_profile');
              }
            }
          }
        } catch {}
      }

      if (photo && user.photoURL !== photo) {
        try {
          await updateProfile(user, { photoURL: photo });
        } catch (e) {
          console.warn('Could not update profile photo:', e);
        }
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // We have a user but no access token in memory (e.g. page refresh)
        // We trigger onAuthSuccess with empty token so the UI can show "Connect Sheets" if needed
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    // Create fresh GoogleAuthProvider with full spreadsheets scope for every authorization attempt
    const freshProvider = new GoogleAuthProvider();
    SCOPES.forEach((scope) => freshProvider.addScope(scope));
    freshProvider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, freshProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token from Firebase Auth');
      }

      cachedAccessToken = credential.accessToken;

      // Extract and persist Google account profile details
      const addInfo = getAdditionalUserInfo(result);
      const profilePic =
        (addInfo?.profile as any)?.picture ||
        result.user.photoURL ||
        result.user.providerData?.find((p) => p.photoURL)?.photoURL;
      const profileName = (addInfo?.profile as any)?.name || result.user.displayName;

      if (profilePic && result.user) {
        try {
          if (result.user.photoURL !== profilePic) {
            await updateProfile(result.user, {
              photoURL: profilePic,
              displayName: profileName || result.user.displayName,
            });
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'bingebox_user_profile',
              JSON.stringify({
                photoURL: profilePic,
                displayName: profileName || result.user.displayName,
                email: result.user.email,
              })
            );
          }
          await saveUserSheetConfig(result.user.uid, {
            photoURL: profilePic,
            displayName: profileName || result.user.displayName,
          });
        } catch (e) {
          console.warn('Profile persistence error:', e);
        }
      }

      return { user: result.user, accessToken: cachedAccessToken };
    } catch (popupError: any) {
      const code = popupError?.code;
      if (code === 'auth/popup-closed-by-user') {
        return null;
      }
      console.warn('signInWithPopup notice:', popupError);
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        String(popupError).includes('Pending promise was never set')
      ) {
        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('firebase_redirect_active', 'true');
          }
          const { signInWithRedirect: dynamicSignInWithRedirect } = await import('firebase/auth');
          await dynamicSignInWithRedirect(auth, freshProvider);
        } catch (redirectErr) {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('firebase_redirect_active');
          }
          console.warn('signInWithRedirect notice:', redirectErr);
        }
        return null;
      }
      throw popupError;
    }
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      return null;
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

let redirectPromise: Promise<{ user: User; accessToken: string } | null> | null = null;

export const handleRedirectResultOnLoad = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (typeof window !== 'undefined') {
    const isRedirectActive = sessionStorage.getItem('firebase_redirect_active') === 'true';
    if (!isRedirectActive) {
      return null;
    }
  }

  if (redirectPromise) {
    return redirectPromise;
  }

  redirectPromise = (async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('firebase_redirect_active');
      }
      const { getRedirectResult: dynamicGetRedirectResult } = await import('firebase/auth');
      const result = await dynamicGetRedirectResult(auth).catch(() => null);
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
        }

        const addInfo = getAdditionalUserInfo(result);
        const profilePic =
          (addInfo?.profile as any)?.picture ||
          result.user.photoURL ||
          result.user.providerData?.find((p) => p.photoURL)?.photoURL;
        const profileName = (addInfo?.profile as any)?.name || result.user.displayName;

        if (profilePic && result.user) {
          try {
            if (result.user.photoURL !== profilePic) {
              await updateProfile(result.user, {
                photoURL: profilePic,
                displayName: profileName || result.user.displayName,
              });
            }
            if (typeof window !== 'undefined') {
              localStorage.setItem(
                'bingebox_user_profile',
                JSON.stringify({
                  photoURL: profilePic,
                  displayName: profileName || result.user.displayName,
                  email: result.user.email,
                })
              );
            }
            await saveUserSheetConfig(result.user.uid, {
              photoURL: profilePic,
              displayName: profileName || result.user.displayName,
            });
          } catch (e) {
            console.warn('Redirect profile save error:', e);
          }
        }

        return { user: result.user, accessToken: cachedAccessToken || '' };
      }
    } catch (err: any) {
      const errStr = String(err?.message || err);
      if (!errStr.includes('Pending promise was never set')) {
        console.warn('getRedirectResult on load notice:', err);
      }
    }
    return null;
  })();

  return redirectPromise;
};

export const getAccessToken = async (forceRefresh = false): Promise<string | null> => {
  if (forceRefresh) {
    console.log('[Auth] Force-refresh of access token requested.');
    cachedAccessToken = null; // Clear the cached invalid token
    if (auth.currentUser) {
      // Retry mechanism for network failures with exponential backoff
      let retries = 3;
      let delay = 1500; // Increased base delay
      while (retries > 0) {
        try {
          await auth.currentUser.getIdToken(true);
          console.log('[Auth] Refreshed Firebase session successfully');
          break;
        } catch (err: any) {
          retries--;
          console.error(`[Auth] Failed to refresh Firebase token (${retries} retries left):`, err);
          if (retries === 0) {
            // If all retries fail, trigger a network check
            if (!navigator.onLine) {
              console.error('[Auth] Network appears offline');
            }
          } else {
            // Wait before retrying with exponential backoff
            console.log(`[Auth] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Increase delay for next retry
          }
        }
      }
    }
  }
  return cachedAccessToken;
};

// Export a safe custom fetch wrapper for Google APIs to handle 403 errors and auto-retry with force-refresh
export const googleFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await fetch(input, init);
  
  if (response.status === 403 || response.status === 401) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('googleapis.com')) {
      console.warn(`[googleFetch] Google API ${response.status} error detected.`);
      
      // Dispatch immediately for 403/401 to prompt re-authentication
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('google-sheets-403'));
      }
      
      // Attempt token refresh if possible
      const freshToken = await getAccessToken(true);
      if (freshToken) {
        const newInit = init ? { ...init } : {};
        const headers = new Headers(newInit.headers || {});
        headers.set('Authorization', `Bearer ${freshToken}`);
        newInit.headers = headers;
        
        console.log('[googleFetch] Retrying Google API call with fresh token...');
        return fetch(input, newInit);
      }
    }
  }
  
  return response;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
