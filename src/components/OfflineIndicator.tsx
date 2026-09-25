import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getOfflineQueue, clearOfflineQueue } from '../services/offlineQueue';

interface OfflineIndicatorProps {
  onSyncOfflineQueue?: (queue: any[]) => Promise<void>;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onSyncOfflineQueue }) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = async () => {
      const online = navigator.onLine;
      setIsOnline(online);
      const queue = getOfflineQueue();
      setPendingCount(queue.length);

      if (online && queue.length > 0 && onSyncOfflineQueue) {
        setIsSyncingQueue(true);
        try {
          await onSyncOfflineQueue(queue);
          clearOfflineQueue();
          setPendingCount(0);
          setSyncSuccessMsg(true);
          setTimeout(() => setSyncSuccessMsg(false), 4000);
        } catch (e) {
          console.error('Failed to sync offline queue upon reconnection', e);
        } finally {
          setIsSyncingQueue(false);
        }
      }
    };

    const handleOnline = () => updateOnlineStatus();
    const handleOffline = () => {
      setIsOnline(false);
      setPendingCount(getOfflineQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onSyncOfflineQueue]);

  if (isOnline && pendingCount === 0 && !syncSuccessMsg) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-zinc-900/95 border border-zinc-700/80 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
      {!isOnline ? (
        <>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="font-semibold text-amber-300">Offline Mode Active</p>
            <p className="text-[10px] text-zinc-400">
              {pendingCount > 0 ? `${pendingCount} action(s) queued locally` : 'Using cached local data'}
            </p>
          </div>
        </>
      ) : isSyncingQueue ? (
        <>
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <div>
            <p className="font-semibold text-emerald-300">Syncing Offline Actions...</p>
            <p className="text-[10px] text-zinc-400">Processing {pendingCount} queued change(s)</p>
          </div>
        </>
      ) : syncSuccessMsg ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-300">Offline Changes Synced!</p>
            <p className="text-[10px] text-zinc-400">All queued actions successfully saved</p>
          </div>
        </>
      ) : null}
    </div>
  );
};
