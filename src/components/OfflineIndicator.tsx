import React, { useEffect } from 'react';
import { getOfflineQueue, clearOfflineQueue } from '../services/offlineQueue';

interface OfflineIndicatorProps {
  onSyncOfflineQueue?: (queue: any[]) => Promise<void>;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onSyncOfflineQueue }) => {
  useEffect(() => {
    const updateOnlineStatus = async () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const queue = getOfflineQueue();

      if (online && queue.length > 0 && onSyncOfflineQueue) {
        try {
          await onSyncOfflineQueue(queue);
          clearOfflineQueue();
        } catch (e) {
          console.error('Failed to sync offline queue upon reconnection', e);
        }
      }
    };

    const handleOnline = () => updateOnlineStatus();
    const handleOffline = () => {};

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onSyncOfflineQueue]);

  return null;
};

