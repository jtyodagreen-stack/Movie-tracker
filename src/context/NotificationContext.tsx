import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getNotificationShowIds, toggleShowNotification, isNotificationEnabled as checkIsNotificationEnabled } from '../services/notificationService';
import { ShowItem } from '../types';

interface NotificationContextType {
  enabledNotificationIds: string[];
  toggleNotification: (show: ShowItem) => Promise<void>;
  isNotificationEnabled: (showOrId: ShowItem | string, optionalTitle?: string) => boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabledNotificationIds, setEnabledNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    setEnabledNotificationIds(getNotificationShowIds());

    const handleNotifChanged = () => {
      setEnabledNotificationIds(getNotificationShowIds());
    };

    window.addEventListener('notification-changed', handleNotifChanged);
    return () => {
      window.removeEventListener('notification-changed', handleNotifChanged);
    };
  }, []);

  const toggleNotification = useCallback(async (show: ShowItem) => {
    await toggleShowNotification(show);
    setEnabledNotificationIds(getNotificationShowIds());
  }, []);

  const isNotificationEnabled = useCallback((showOrId: ShowItem | string, optionalTitle?: string) => {
    return checkIsNotificationEnabled(showOrId, optionalTitle);
  }, [enabledNotificationIds]);

  const value = useMemo(() => ({ enabledNotificationIds, toggleNotification, isNotificationEnabled }), [enabledNotificationIds, toggleNotification, isNotificationEnabled]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
