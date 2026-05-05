/**
 * useNotifications — fetches from MongoDB on mount for offline persistence,
 * then subscribes to WebSocket for real-time updates.
 *
 * Flow:
 * 1. On mount → fetch from /api/notifications (loads offline notifications)
 * 2. On WebSocket → add realtime notifications (backend already saved to DB)
 * 3. markRead/markAllRead/clearAll → update localStorage + call backend API
 */

import { useEffect, useState, useCallback } from 'react';
import { getSocket, type Notification, type InviteNotification } from '@/lib/socket';
import { getCurrentUser, isAuthenticated } from '@/lib/auth';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { apiFetch } from '@/lib/api-client';

const STORAGE_KEY = 'orbit_notifications';
const MAX_NOTIFICATIONS = 50;
const SOUND_ENABLED_KEY = 'orbit_notification_sound_enabled';

interface StoredNotificationsPayload {
    userId: string;
    notifications: Notification[];
}

// Shared Audio instance (singleton) — created lazily on first play
let notificationAudio: HTMLAudioElement | null = null;

function getAudioSrc(): string {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/sounds/notification.mp3`;
}

function playNotificationSound(): void {
    try {
        if (!notificationAudio) {
            notificationAudio = new Audio(getAudioSrc());
            notificationAudio.preload = 'auto';
        }
        notificationAudio.currentTime = 0;
        notificationAudio.volume = 0.6;
        notificationAudio.play().catch(() => {
            // Autoplay blocked by browser — silently ignore
        });
    } catch {
        // Audio not supported or file missing
    }
}

function isSoundEnabled(): boolean {
    try {
        const stored = localStorage.getItem(SOUND_ENABLED_KEY);
        if (stored !== null) return stored === 'true';
    } catch { /* localStorage unavailable */ }
    return true; // default: enabled
}

function setSoundEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
    } catch { /* ignore */ }
}

// Backend API response type
interface ApiNotification {
    _id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    link: string;
    read: boolean;
    seen: boolean;
    refType: string | null;
    refId: string | null;
    inviteData?: {
        inviteId: string;
        token?: string;
        projectId?: string;
        projectName?: string;
        projectAvatar?: string;
        role?: string;
        inviterName?: string;
        acceptUrl?: string;
    };
    createdAt: string;
}

function getStoredUserId(): string {
    const user = getCurrentUser();
    return user?.id || user?.publicId || '';
}

function withUserId(n: Notification, userId: string): Notification {
    return userId ? { ...n, userId: n.userId || userId } : n;
}

function dedupeNotifications(notifications: Notification[]): Notification[] {
    const seen = new Set<string>();
    const out: Notification[] = [];
    for (const item of notifications) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
    }
    return out;
}

function loadFromStorage(userId: string): Notification[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Notification[] | StoredNotificationsPayload;
        if (Array.isArray(parsed)) return parsed.map((n) => withUserId(n, userId));
        if (parsed?.userId !== userId) return [];
        return Array.isArray(parsed.notifications)
            ? parsed.notifications.map((n) => withUserId(n, userId))
            : [];
    } catch {
        return [];
    }
}

function saveToStorage(notifications: Notification[], userId: string) {
    try {
        const payload: StoredNotificationsPayload = {
            userId,
            notifications: dedupeNotifications(
                notifications.map((n) => withUserId(n, userId))
            ).slice(0, MAX_NOTIFICATIONS),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch { /* quota exceeded — ignore */ }
}

function mapApiToNotification(api: ApiNotification): Notification {
    if (api.refType === 'invite' && api.inviteData) {
        return {
            id: `invite:${api.inviteData.inviteId}`,
            userId: api.userId,
            type: api.type as Notification['type'],
            title: api.title,
            message: api.message,
            link: api.link,
            read: api.read,
            seen: api.seen,
            createdAt: api.createdAt,
            inviteData: api.inviteData as InviteNotification,
        };
    }
    return {
        id: api._id,
        userId: api.userId,
        type: api.type as Notification['type'],
        title: api.title,
        message: api.message,
        link: api.link,
        read: api.read,
        seen: api.seen,
        createdAt: api.createdAt,
    };
}

export interface UseNotificationsReturn {
    notifications: Notification[];
    unreadCount: number;
    unseenCount: number;
    inviteUnreadCount: number;
    markRead: (id: string) => void;
    markSeen: (id: string) => void;
    markAllRead: () => void;
    markAllSeen: () => void;
    clearAll: () => void;
    deleteNotification: (id: string) => void;
    isLoading: boolean;
    soundEnabled: boolean;
    toggleSound: (enabled: boolean) => void;
}

export function useNotifications(): UseNotificationsReturn {
    const authUser = useAppStore((s) => s.auth);
    const currentUserId = authUser?.id || authUser?.publicId || getStoredUserId();
    const [notifications, setNotifications] = useState<Notification[]>(() => {
        if (typeof window === 'undefined') return [];
        return loadFromStorage(getStoredUserId());
    });
    const [unseenCount, setUnseenCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [soundEnabled, setSoundEnabledState] = useState(() => isSoundEnabled());
    const projects = useAppStore((s) => s.projects);

    const toggleSound = useCallback((enabled: boolean) => {
        setSoundEnabled(enabled);
        setSoundEnabledState(enabled);
    }, []);

    // Fetch notifications from API on mount (for offline persistence)
    useEffect(() => {
        if (!isAuthenticated()) return;

        setIsLoading(true);
        apiFetch('/api/notifications')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data?.notifications) {
                    const apiNotifications = data.data.notifications as ApiNotification[];
                    const mapped = dedupeNotifications(
                        apiNotifications.map(mapApiToNotification).map((n) => withUserId(n, currentUserId))
                    );
                    const apiUnseenCount = data.data.unseenCount ?? mapped.filter((n) => !n.seen).length;
                    setUnseenCount(apiUnseenCount);
                    // DB is the source of truth; localStorage is only an offline cache.
                    const next = mapped.slice(0, MAX_NOTIFICATIONS);
                    setNotifications(next);
                    saveToStorage(next, currentUserId);
                }
            })
            .catch(() => {
                // Fallback to localStorage if API fails
                const stored = loadFromStorage(currentUserId);
                if (stored.length > 0) {
                    setNotifications(stored);
                }
            })
            .finally(() => setIsLoading(false));
    }, [currentUserId]);

    const push = useCallback((n: Notification) => {
        setNotifications((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            const next = [withUserId({ ...n, seen: false }, currentUserId), ...prev].slice(0, MAX_NOTIFICATIONS);
            saveToStorage(next, currentUserId);
            setUnseenCount((c) => c + 1);
            return next;
        });
    }, [currentUserId]);

    const resolveProjectName = useCallback((data: InviteNotification) => {
        const resolvedName = data.projectName && data.projectName !== 'a project'
            ? data.projectName
            : projects.find((p) => String(p.publicId) === String(data.projectId))?.name || 'a project';
        const resolvedAvatar = data.projectAvatar
            || projects.find((p) => String(p.publicId) === String(data.projectId))?.coverImageUrl;
        return { name: resolvedName, avatar: resolvedAvatar };
    }, [projects]);

    const handleInviteNew = useCallback((data: InviteNotification) => {
        const id = `invite:${data.inviteId}`;
        const { name: resolvedProjectName, avatar: resolvedProjectAvatar } = resolveProjectName(data);

        setNotifications((prev) => {
            if (prev.some((x) => x.id === id)) return prev;
            const normalizedInviteData: InviteNotification = {
                ...data,
                projectName: resolvedProjectName,
                projectAvatar: resolvedProjectAvatar,
            };
            const n: Notification = {
                id,
                userId: currentUserId,
                type: 'info',
                title: `${data.inviterName} invited you`,
                message: `Join "${resolvedProjectName}" as ${data.role}`,
                link: data.acceptUrl,
                inviteData: normalizedInviteData,
                createdAt: data.createdAt || new Date().toISOString(),
                read: false,
                seen: false,
            };
            const next = [n, ...prev].slice(0, MAX_NOTIFICATIONS);
            saveToStorage(next, currentUserId);
            setUnseenCount((c) => c + 1);
            return next;
        });
    }, [currentUserId, resolveProjectName]);

    // WebSocket realtime handlers
    useEffect(() => {
        if (!isAuthenticated()) return;

        // Migrate old invite notifications: replace "a project" with real project name
        setNotifications((prev) => {
            const next = prev.map((n) => {
                if (!n.id.startsWith('invite:')) return n;
                const invite = n.inviteData;
                const projectFromStore = invite?.projectId
                    ? projects.find((p) => String(p.publicId) === String(invite.projectId))
                    : undefined;
                const resolvedFromStore = projectFromStore?.name;
                const currentNameFromMessage = n.message?.match(/Join\s+"([^"]+)"/)?.[1];
                const shouldReplace = currentNameFromMessage === 'a project' || invite?.projectName === 'a project';
                if (!shouldReplace || !resolvedFromStore) return n;
                const updatedInvite = invite
                    ? { ...invite, projectName: resolvedFromStore, projectAvatar: projectFromStore?.coverImageUrl || invite.projectAvatar }
                    : invite;
                return {
                    ...n,
                    message: n.message?.replace(/Join\s+"[^"]+"/, `Join "${resolvedFromStore}"`),
                    inviteData: updatedInvite,
                };
            });
            saveToStorage(next, currentUserId);
            return next;
        });

        const socket = getSocket();

        const handler = (n: Notification) => {
            push(n);

            // Play notification sound for online users
            if (soundEnabled) {
                playNotificationSound();
            }

            // Show toast for real-time notifications (skip invites which have their own toast)
            if (n.inviteData) return;
            const title = n.title || 'New notification';
            const message = n.message || '';
            toast(title, {
                description: message || undefined,
                duration: 5000,
            });
        };

        const inviteHandler = (data: InviteNotification) => {
            const { name: resolvedProjectName, avatar: resolvedProjectAvatar } = resolveProjectName(data);
            const normalizedInviteData: InviteNotification = {
                ...data,
                projectName: resolvedProjectName,
                projectAvatar: resolvedProjectAvatar,
            };
            handleInviteNew(normalizedInviteData);
            toast(
                `${normalizedInviteData.inviterName} invited you to join "${normalizedInviteData.projectName}"`,
                {
                    duration: Infinity,
                    action: {
                        label: 'View',
                        onClick: () => {
                            window.dispatchEvent(
                                new CustomEvent('orbit:show-invite-dialog', { detail: normalizedInviteData })
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
    }, [currentUserId, handleInviteNew, projects, push, resolveProjectName, soundEnabled]);

    const markRead = useCallback((id: string) => {
        // Optimistic update — clicking also marks as seen
        setNotifications((prev) => {
            const next = prev.map((n) => (n.id === id ? { ...n, read: true, seen: true } : n));
            saveToStorage(next, currentUserId);
            return next;
        });
        setUnseenCount((c) => Math.max(0, c - 1));
        // Sync with backend
        apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }).catch(() => {
            // Revert on failure
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false, seen: false } : n)));
            setUnseenCount((c) => c + 1);
        });
    }, [currentUserId]);

    const markSeen = useCallback((id: string) => {
        // Mark as seen (opened dropdown) without marking as read
        setNotifications((prev) => {
            const next = prev.map((n) => (n.id === id ? { ...n, seen: true } : n));
            saveToStorage(next, currentUserId);
            return next;
        });
        setUnseenCount((c) => Math.max(0, c - 1));
        // Sync with backend
        apiFetch(`/api/notifications/${encodeURIComponent(id)}/seen`, { method: 'PATCH' }).catch(() => {
            // Revert on failure
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, seen: false } : n)));
            setUnseenCount((c) => c + 1);
        });
    }, [currentUserId]);

    const markAllRead = useCallback(() => {
        // Optimistic update
        setNotifications((prev) => {
            const next = prev.map((n) => ({ ...n, read: true, seen: true }));
            saveToStorage(next, currentUserId);
            return next;
        });
        setUnseenCount(0);
        // Sync with backend
        apiFetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => {
            // Revert on failure
            setNotifications((prev) => {
                const next = prev.map((n) => ({ ...n, read: false, seen: false }));
                saveToStorage(next, currentUserId);
                return next;
            });
        });
    }, [currentUserId]);

    const markAllSeen = useCallback(() => {
        // Optimistic update — mark all as seen but keep unread
        setNotifications((prev) => {
            const next = prev.map((n) => ({ ...n, seen: true }));
            saveToStorage(next, currentUserId);
            return next;
        });
        setUnseenCount(0);
        // Sync with backend
        apiFetch('/api/notifications/mark-all-seen', { method: 'POST' }).catch(() => {
            // Revert on failure — reload from API
            apiFetch('/api/notifications')
                .then((res) => res.json())
                .then((data) => {
                    if (data.success && data.data?.notifications) {
                        const mapped = dedupeNotifications(
                            (data.data.notifications as ApiNotification[]).map(mapApiToNotification).map((n) => withUserId(n, currentUserId))
                        );
                        setNotifications(mapped);
                        saveToStorage(mapped, currentUserId);
                    }
                });
        });
    }, [currentUserId]);

    const clearAll = useCallback(() => {
        // Optimistic update
        setNotifications([]);
        saveToStorage([], currentUserId);
        // Sync with backend
        apiFetch('/api/notifications/clear', { method: 'DELETE' }).catch(() => {
            // Revert on failure — reload from API
            apiFetch('/api/notifications')
                .then((res) => res.json())
                .then((data) => {
                    if (data.success && data.data?.notifications) {
                        const mapped = dedupeNotifications(
                            (data.data.notifications as ApiNotification[]).map(mapApiToNotification).map((n) => withUserId(n, currentUserId))
                        );
                        setNotifications(mapped);
                        saveToStorage(mapped, currentUserId);
                    }
                });
        });
    }, [currentUserId]);

    const deleteNotification = useCallback((id: string) => {
        // Optimistic update
        setNotifications((prev) => {
            const next = prev.filter((n) => n.id !== id);
            saveToStorage(next, currentUserId);
            return next;
        });
        // Sync with backend — keep the full id including 'invite:' prefix
        apiFetch(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {
            // Revert on failure — reload from API
            apiFetch('/api/notifications')
                .then((res) => res.json())
                .then((data) => {
                    if (data.success && data.data?.notifications) {
                        const mapped = dedupeNotifications(
                            (data.data.notifications as ApiNotification[]).map(mapApiToNotification).map((n) => withUserId(n, currentUserId))
                        );
                        setNotifications(mapped);
                        saveToStorage(mapped, currentUserId);
                    }
                });
        });
    }, [currentUserId]);

    const unreadCount = notifications.filter((n) => !n.read).length;
    const inviteUnreadCount = notifications.filter((n) => n.id.startsWith('invite:') && !n.read).length;

    return { notifications, unreadCount, unseenCount, inviteUnreadCount, markRead, markSeen, markAllRead, markAllSeen, clearAll, deleteNotification, isLoading, soundEnabled, toggleSound };
}
