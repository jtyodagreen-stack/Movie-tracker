/**
 * Bulletproof Storage Shield for Safari Private Browsing & Restricted Environments
 * In iOS 17/18 Safari Private Browsing with "Advanced Tracking and Fingerprinting Protection",
 * accessing or writing to localStorage / sessionStorage can throw SecurityError or QuotaExceededError.
 * This shield guarantees that storage calls NEVER throw an unhandled exception.
 */

if (typeof window !== 'undefined') {
  const createMemoryStorage = (): Storage => {
    const memoryStore: Record<string, string> = {};
    return {
      getItem(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      },
      setItem(key: string, value: string): void {
        memoryStore[key] = String(value);
      },
      removeItem(key: string): void {
        delete memoryStore[key];
      },
      clear(): void {
        for (const k of Object.keys(memoryStore)) {
          delete memoryStore[k];
        }
      },
      key(index: number): string | null {
        const keys = Object.keys(memoryStore);
        return keys[index] ?? null;
      },
      get length(): number {
        return Object.keys(memoryStore).length;
      },
    };
  };

  // Test and wrap localStorage
  try {
    const testKey = '__sb_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
  } catch {
    console.warn('[SafeStorage] localStorage is restricted (Safari Private Browsing). Activating in-memory storage fallback.');
    try {
      Object.defineProperty(window, 'localStorage', {
        value: createMemoryStorage(),
        configurable: true,
        writable: true,
      });
    } catch {}
  }

  // Test and wrap sessionStorage
  try {
    const testKey = '__sb_test__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
  } catch {
    console.warn('[SafeStorage] sessionStorage is restricted (Safari Private Browsing). Activating in-memory storage fallback.');
    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: createMemoryStorage(),
        configurable: true,
        writable: true,
      });
    } catch {}
  }
}

export {};
