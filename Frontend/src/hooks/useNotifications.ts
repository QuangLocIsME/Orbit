/**
 * useNotifications — subscribes to real-time notification events and
 * maintains an in-memory list. Notifications are persisted in
 * sessionStorage so they survive page navigation within the same tab.
 *
 * Invite handling:
 * - invite:new → adds to notification list (1 entry per invite, deduped by inviteId)
 * - inviteUnreadCount tracks invites NOT yet marked read
 * - Does NOT show AlertDialog automatically; call showInviteDialog() to open it
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, type Notification, type InviteNotification } from '@/lib/socket';
import { isAuthenticated } from '@/lib/auth';
import { toast } from '@/components/ui/sonner';

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
  inviteUnreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>(loadFromStorage);
  const [inviteUnreadCount, setInviteUnreadCount] = useState(0);

  // Use ref to avoid stale closure in socket handlers
  const setInviteCountRef = useRef(setInviteUnreadCount);
  useEffect(() => { setInviteCountRef.current = setInviteUnreadCount; }, []);

  const push = useCallback((n: Notification) => {
    setNotifications((prev) => {
      // Dedupe by id
      if (prev.some((x) => x.id === n.id)) return prev;
      const next = [n, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(next);
      return next;
    });
  }, []);

  const handleInviteNew = useCallback((data: InviteNotification) => {
    const id = `invite:${data.inviteId}`;
    // Dedupe: only add if not already in list
    setNotifications((prev) => {
      if (prev.some((x) => x.id === id)) return prev;
      const n: Notification = {
        id,
        type: 'info',
        title: `${data.inviterName} invited you`,
        message: `Join "${data.projectName}" as ${data.role}`,
        link: data.acceptUrl,
        createdAt: data.createdAt || new Date().toISOString(),
        read: false,
      };
      const next = [n, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(next);
      return next;
    });
    setInviteUnreadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;

    const socket = getSocket();

    const handler = (n: Notification) => {
      push(n);
    };

    const inviteHandler = (data: InviteNotification) => {
      handleInviteNew(data);
      // Show Sonner toast at bottom-right
      toast(
        `${data.inviterName} invited you to join "${data.projectName}"`,
        {
          duration: Infinity,
          action: {
            label: 'View',
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent('orbit:show-invite-dialog', { detail: data })
              );
            },
          },
        }
      );
    };

    socket.on('notification:new', handler);
    socket.on('invite:new', inviteHandler);

    return () => {
      socket.off('notification:new', handler);
      socket.off('invite:new', inviteHandler);
    };
  }, [push, handleInviteNew]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveToStorage(next);
      return next;
    });
    if (id.startsWith('invite:')) {
      setInviteUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(next);
      return next;
    });
    setInviteUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([]);
    setInviteUnreadCount(0);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, inviteUnreadCount, markRead, markAllRead, clearAll };
}
