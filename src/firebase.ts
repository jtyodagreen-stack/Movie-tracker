import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
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

const TOKEN_KEY = 'bingebox_google_access_token';
const TOKEN_TIME_KEY = 'bingebox_google_token_time';

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
    await getDocFromServer(doc(db, 'user_settings', 'connection_test'));
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
  sheetTitle?: string;
  sheetTabId?: number;
  autoSyncEnabled?: boolean;
}

export async function saveUserSheetConfig(userId: string, config: Partial<UserSheetConfig>) {
  if (!userId) return;
  const path = `user_settings/${userId}`;
  try {
    const dataToSave: Record<string, any> = {
      userId,
      updatedAt: new Date().toISOString(),
    };
    if (config.spreadsheetId !== undefined) dataToSave.spreadsheetId = config.spreadsheetId;
    if (config.sheetName !== undefined) dataToSave.sheetName = config.sheetName;
    if (config.wishlistSheetName !== undefined) dataToSave.wishlistSheetName = config.wishlistSheetName;
    if (config.sheetTitle !== undefined) dataToSave.sheetTitle = config.sheetTitle;
    if (config.sheetTabId !== undefined) dataToSave.sheetTabId = config.sheetTabId;
    if (config.autoSyncEnabled !== undefined) dataToSave.autoSyncEnabled = config.autoSyncEnabled;

    await setDoc(doc(db, 'user_settings', userId), dataToSave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserSheetConfig(userId: string): Promise<UserSheetConfig | null> {
  if (!userId) return null;
  const path = `user_settings/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'user_settings', userId));
    if (snap.exists()) {
      return snap.data() as UserSheetConfig;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Pre-load stored access token on module evaluation
try {
  const savedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (savedToken) {
    cachedAccessToken = savedToken;
  }
} catch (e) {
  // ignore storage errors
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      let token = cachedAccessToken;
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem(TOKEN_KEY);
        if (token) cachedAccessToken = token;
      }

      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedAccessToken = null;
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(TOKEN_TIME_KEY);
        }
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, cachedAccessToken);
        localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
      }
    } catch {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) {
        cachedAccessToken = saved;
        return saved;
      }
    }
  } catch {}
  return null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_TIME_KEY);
      }
    }
  } catch {}
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_TIME_KEY);
    }
  } catch {}
};
