import React from 'react';
import toast from 'react-hot-toast';
import { ShowItem } from '../types';

const NOTIF_KEY = 'showtracker_24h_notifications';
const NOTIFIED_KEY = 'showtracker_sent_notifications';

export function getNotificationShowIds(): string[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function isNotificationEnabled(showId: string): boolean {
  const ids = getNotificationShowIds();
  return ids.includes(showId);
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (e) {
    console.warn('Browser notification permission request skipped/blocked by iframe context:', e);
  }

  return false;
}

/**
 * Dispatches 24h Premiere Reminder alert
 */
export function send24hNotificationAlert(show: ShowItem) {
  const title = show.title;
  const platform = show.platform || 'TV';
  const releaseInfo = show.releaseDate || show.releaseNote || 'Tomorrow';

  // In-App Toast Alert Card
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out'
        } max-w-md w-full bg-zinc-950 border-2 border-amber-500/80 shadow-2xl rounded-xl p-4 pointer-events-auto flex items-start gap-3.5 text-white ring-1 ring-amber-500/30`}
      >
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0 text-amber-400 text-xl font-black shadow">
          ⏰
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
              🔔 24h Premiere Alert
            </span>
            <span className="text-[10px] font-mono text-zinc-400">COMING SOON</span>
          </div>
          <h4 className="text-sm font-black text-white truncate">{title}</h4>
          <p className="text-xs text-amber-200/90 leading-snug">
            Premieres in less than 24 hours on <span className="text-amber-400 font-bold">{platform}</span>! ({releaseInfo})
          </p>
        </div>
      </div>
    ),
    { duration: 7000 }
  );

  // Native Browser Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`⏰ 24h Premiere Alert: ${title}`, {
        body: `${title} premieres tomorrow on ${platform}! (${releaseInfo})`,
        icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
      });
    } catch (e) {
      console.warn('Native notification notice:', e);
    }
  } else {
    requestBrowserNotificationPermission().then((granted) => {
      if (granted) {
        try {
          new Notification(`⏰ 24h Premiere Alert: ${title}`, {
            body: `${title} premieres tomorrow on ${platform}! (${releaseInfo})`,
            icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
          });
        } catch (e) {}
      }
    });
  }
}

/**
 * Dispatches "OUT NOW!" release moment alert when countdown reaches 00:00:00
 */
export function sendOutNowNotificationAlert(show: ShowItem) {
  const title = show.title;
  const platform = show.platform || 'TV';

  // In-App Toast Alert Card
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out'
        } max-w-md w-full bg-zinc-950 border-2 border-emerald-500/90 shadow-2xl rounded-xl p-4 pointer-events-auto flex items-start gap-3.5 text-white ring-1 ring-emerald-500/40`}
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 text-emerald-400 text-xl font-black shadow animate-bounce">
          🎉
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
              🎉 OUT NOW!
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">RELEASED</span>
          </div>
          <h4 className="text-sm font-black text-white truncate">{title}</h4>
          <p className="text-xs text-emerald-200/90 leading-snug">
            Available to watch now on <span className="text-emerald-300 font-bold">{platform}</span>!
          </p>
        </div>
      </div>
    ),
    { duration: 10000 }
  );

  // Native Browser Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`🎉 OUT NOW: ${title}!`, {
        body: `${title} is now available to watch on ${platform}!`,
        icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
        requireInteraction: true,
      });
    } catch (e) {
      console.warn('Native notification notice:', e);
    }
  } else {
    requestBrowserNotificationPermission().then((granted) => {
      if (granted) {
        try {
          new Notification(`🎉 OUT NOW: ${title}!`, {
            body: `${title} is now available to watch on ${platform}!`,
            icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
            requireInteraction: true,
          });
        } catch (e) {}
      }
    });
  }
}

export async function toggleShowNotification(show: ShowItem): Promise<boolean> {
  const ids = getNotificationShowIds();
  const exists = ids.includes(show.id);

  if (exists) {
    // Disable notification
    const updated = ids.filter((id) => id !== show.id);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    toast(`🔕 Release notification turned off for ${show.title}`, {
      icon: '🔕',
      style: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46' },
    });
    return false;
  } else {
    // Enable notification
    const updated = [...ids, show.id];
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));

    // Check release time to send immediate appropriate alert confirmation
    const targetTime = parseReleaseDateToTimestamp(show.releaseDate);
    const now = Date.now();

    if (targetTime && targetTime - now <= 0) {
      sendOutNowNotificationAlert(show);
    } else {
      send24hNotificationAlert(show);
    }

    return true;
  }
}

export function enableShowNotificationSilent(showId: string) {
  const ids = getNotificationShowIds();
  if (!ids.includes(showId)) {
    const updated = [...ids, showId];
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  }
}

function getSentNotifiedKeys(): string[] {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markNotifiedSent(key: string) {
  const sent = getSentNotifiedKeys();
  if (!sent.includes(key)) {
    sent.push(key);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(sent));
  }
}

/**
 * Robustly parses release date strings (supports "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", ISO strings, etc.)
 */
export function parseReleaseDateToTimestamp(dateStr?: string): number | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  if (!str) return null;

  // Split date and optional time
  const spaceSplit = str.split(/[ T]+/);
  const datePart = spaceSplit[0];
  const timePart = spaceSplit[1] || '00:00';

  const timeParts = timePart.split(':');
  const hours = parseInt(timeParts[0] || '0', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);

  const delimiters = ['-', '/'];
  for (const delim of delimiters) {
    const parts = datePart.split(delim);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD-MM-YYYY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const parsed = new Date(year, month, day, hours, minutes);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
      } else if (parts[0].length === 4) {
        // YYYY-MM-DD
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const parsed = new Date(year, month, day, hours, minutes);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
      }
    }
  }

  const stdParsed = new Date(str);
  if (!isNaN(stdParsed.getTime())) {
    return stdParsed.getTime();
  }

  return null;
}

/**
 * Checks if a show's release date/time has passed and it is currently within 24 hours of release ("Out Now").
 * After 24 hours have passed since release, this returns false so the card returns back to normal display.
 */
export function isShowOutNow(show: ShowItem): boolean {
  if (!show.releaseDate) return false;
  const targetTime = parseReleaseDateToTimestamp(show.releaseDate);
  if (!targetTime) return false;

  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  const elapsed = now - targetTime;
  return elapsed >= 0 && elapsed <= TWENTY_FOUR_HOURS_MS;
}

/**
 * Checks if a show has a future release date that has not yet arrived.
 */
export function isFutureRelease(show: ShowItem): boolean {
  if (!show.releaseDate) return false;
  const targetTime = parseReleaseDateToTimestamp(show.releaseDate);
  if (!targetTime) return false;
  return targetTime > Date.now();
}

/**
 * Checks all shows with notifications enabled:
 * 1. Triggers 24-hour reminder when premiere is within 24 hours.
 * 2. Triggers "OUT NOW!" alert when countdown hits 0 / release time reached.
 */
export function checkAndTrigger24hNotifications(shows: ShowItem[]): number {
  const enabledIds = getNotificationShowIds();
  const sentKeys = getSentNotifiedKeys();
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  let sentCount = 0;

  shows.forEach((show) => {
    if (!enabledIds.includes(show.id)) return;
    if (!show.releaseDate) return;

    const targetTime = parseReleaseDateToTimestamp(show.releaseDate);
    if (!targetTime) return;

    const timeDiff = targetTime - now;

    // 1. Stage 1: 24-Hour Premiere Alert (within 24h before premiere)
    if (timeDiff > 0 && timeDiff <= TWENTY_FOUR_HOURS_MS) {
      const notificationKey = `${show.id}_${show.releaseDate}_24h`;
      if (!sentKeys.includes(notificationKey)) {
        send24hNotificationAlert(show);
        markNotifiedSent(notificationKey);
        sentCount++;
      }
    }

    // 2. Stage 2: "OUT NOW!" Release Alert (countdown reached 0 / release date reached, valid for 48h past)
    if (timeDiff <= 0 && timeDiff >= -48 * 60 * 60 * 1000) {
      const outNowKey = `${show.id}_${show.releaseDate}_out_now`;
      if (!sentKeys.includes(outNowKey)) {
        sendOutNowNotificationAlert(show);
        markNotifiedSent(outNowKey);
        sentCount++;
      }
    }
  });

  return sentCount;
}
