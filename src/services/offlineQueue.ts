export interface OfflineAction {
  id: string;
  type: 'ADD_SHOW' | 'UPDATE_SHOW' | 'DELETE_SHOW' | 'SYNC_STATUS';
  payload: any;
  timestamp: number;
}

const QUEUE_KEY = 'bingebox_offline_queue';
const CACHED_SHOWS_KEY = 'bingebox_cached_shows';

export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineAction(type: OfflineAction['type'], payload: any) {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    id: 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type,
    payload,
    timestamp: Date.now(),
  };
  queue.push(newAction);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline action to queue', e);
  }
  return newAction;
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {}
}

export function getCachedShows(): any[] {
  try {
    const raw = localStorage.getItem(CACHED_SHOWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedShows(shows: any[]) {
  try {
    localStorage.setItem(CACHED_SHOWS_KEY, JSON.stringify(shows));
  } catch {}
}
