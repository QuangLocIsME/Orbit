/**
 * useNotifications — subscribes to real-time notification events and
 * maintains an in-memory list. Notifications are persisted in
 * sessionStorage so they survive page navigation within the same tab.
 */

import { useEffect, useState, useCallback } from 'react';
import { getSocket, type Notification } from '@/lib/socket';
import { isAuthenticated } from '@/lib/auth';

const STORAGE_KEY = 'orbit_notifications';
const MAX_NOTIFICATIONS = 50;

function loadFromStorage(): Notification[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Notification[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch { /* quota exceeded — ignore */ }
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>(loadFromStorage);

  const push = useCallback((n: Notification) => {
    setNotifications((prev) => {
      const next = [n, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;

    const socket = getSocket();

    const handler = (n: Notification) => {
      push(n);
    };

    socket.on('notification:new', handler);

    return () => {
      socket.off('notification:new', handler);
    };
  }, [push]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveToStorage(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead, clearAll };
}
