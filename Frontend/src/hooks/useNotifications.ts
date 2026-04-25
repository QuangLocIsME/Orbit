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
import { isAuthenticated } from '@/lib/auth';
import { toast } from '@/components/ui/sonner';
import { useAppStore } from '@/stores/appStore';
import { apiFetch } from '@/lib/api-client';

const STORAGE_KEY = 'orbit_notifications';
const MAX_NOTIFICATIONS = 50;

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

function loadFromStorage(): Notification[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Notification[]) : [];
    } catch {
        return [];
    }
}

function saveToStorage(notifications: Notification[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch { /* quota exceeded — ignore */ }
}

function mapApiToNotification(api: ApiNotification): Notification {
    if (api.refType === 'invite' && api.inviteData) {
        return {
            id: `invite:${api.inviteData.inviteId}`,
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
}

export function useNotifications(): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<Notification[]>(() => {
        if (typeof window === 'undefined') return [];
        return loadFromStorage();
    });
    const [unseenCount, setUnseenCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const projects = useAppStore((s) => s.projects);

    // Fetch notifications from API on mount (for offline persistence)
    useEffect(() => {
        if (!isAuthenticated()) return;

        setIsLoading(true);
        apiFetch('/api/notifications')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data?.notifications) {
                    const apiNotifications = data.data.notifications as ApiNotification[];
                    const mapped = apiNotifications.map(mapApiToNotification);
                    const apiUnseenCount = data.data.unseenCount ?? mapped.filter((n) => !n.seen).length;
                    setUnseenCount(apiUnseenCount);
                    // Merge: prefer API data, keep local realtime ones that aren't in API
                    setNotifications((prev) => {
                        const apiIds = new Set(mapped.map((n) => n.id));
                        const localOnly = prev.filter((n) => !apiIds.has(n.id));
                        // Deduplicate API results by id, keeping first occurrence
                        const seenIds = new Set<string>();
                        const dedupedMapped = mapped.filter((n) => {
                            if (seenIds.has(n.id)) return false;
                            seenIds.add(n.id);
                            return true;
                        });
                        const merged = [...dedupedMapped, ...localOnly].slice(0, MAX_NOTIFICATIONS);
                        saveToStorage(merged);
                        return merged;
                    });
                }
            })
            .catch(() => {
                // Fallback to localStorage if API fails
                const stored = loadFromStorage();
                if (stored.length > 0) {
                    setNotifications(stored);
                }
            })
            .finally(() => setIsLoading(false));
    }, []);

    const push = useCallback((n: Notification) => {
        setNotifications((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            const next = [{ ...n, seen: false }, ...prev].slice(0, MAX_NOTIFICATIONS);
            saveToStorage(next);
            setUnseenCount((c) => c + 1);
            return next;
        });
    }, []);

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
            saveToStorage(next);
            setUnseenCount((c) => c + 1);
            return next;
        });
    }, [resolveProjectName]);

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
            saveToStorage(next);
            return next;
        });

        const socket = getSocket();

        const handler = (n: Notification) => {
            push(n);
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
    }, [push, handleInviteNew, resolveProjectName]);

    const markRead = useCallback((id: string) => {
        // Optimistic update — clicking also marks as seen
        setNotifications((prev) => {
            const next = prev.map((n) => (n.id === id ? { ...n, read: true, seen: true } : n));
            saveToStorage(next);
            return next;
        });
        setUnseenCount((c) => Math.max(0, c - 1));
        // Sync with backend
        const dbId = id.startsWith('invite:') ? id.replace('invite:', '') : id;
        apiFetch(`/api/notifications/${dbId}/read`, { method: 'PATCH' }).catch(() => {
            // Revert on failure
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false, seen: false } : n)));
            setUnseenCount((c) => c + 1);
        });
    }, []);

    const markSeen = useCallback((id: string) => {
        // Mark as seen (opened dropdown) without marking as read
        setNotifications((prev) => {
            const next = prev.map((n) => (n.id === id ? { ...n, seen: true } : n));
            saveToStorage(next);
            return next;
        });
        setUnseenCount((c) => Math.max(0, c - 1));
        // Sync with backend
        const dbId = id.startsWith('invite:') ? id.replace('invite:', '') : id;
        apiFetch(`/api/notifications/${dbId}/seen`, { method: 'PATCH' }).catch(() => {
            // Revert on failure
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, seen: false } : n)));
            setUnseenCount((c) => c + 1);
        });
    }, []);

    const markAllRead = useCallback(() => {
        // Optimistic update
        setNotifications((prev) => {
            const next = prev.map((n) => ({ ...n, read: true, seen: true }));
            saveToStorage(next);
            return next;
        });
        setUnseenCount(0);
        // Sync with backend
        apiFetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => {
            // Revert on failure
            setNotifications((prev) => {
                const next = prev.map((n) => ({ ...n, read: false, seen: false }));
                saveToStorage(next);
                return next;
            });
        });
    }, []);

    const markAllSeen = useCallback(() => {
        // Optimistic update — mark all as seen but keep unread
        setNotifications((prev) => {
            const next = prev.map((n) => ({ ...n, seen: true }));
            saveToStorage(next);
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
                        const mapped = (data.data.notifications as ApiNotification[]).map(mapApiToNotification);
                        setNotifications(mapped);
                        saveToStorage(mapped);
                    }
                });
        });
    }, []);

    const clearAll = useCallback(() => {
        // Optimistic update
        setNotifications([]);
        saveToStorage([]);
        // Sync with backend
        apiFetch('/api/notifications/clear', { method: 'DELETE' }).catch(() => {
            // Revert on failure — reload from API
            apiFetch('/api/notifications')
                .then((res) => res.json())
                .then((data) => {
                    if (data.success && data.data?.notifications) {
                        const mapped = (data.data.notifications as ApiNotification[]).map(mapApiToNotification);
                        setNotifications(mapped);
                        saveToStorage(mapped);
                    }
                });
        });
    }, []);

    const deleteNotification = useCallback((id: string) => {
        // Optimistic update
        setNotifications((prev) => {
            const next = prev.filter((n) => n.id !== id);
            saveToStorage(next);
            return next;
        });
        // Sync with backend — keep the full id including 'invite:' prefix
        apiFetch(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {
            // Revert on failure — reload from API
            apiFetch('/api/notifications')
                .then((res) => res.json())
                .then((data) => {
                    if (data.success && data.data?.notifications) {
                        const mapped = (data.data.notifications as ApiNotification[]).map(mapApiToNotification);
                        setNotifications(mapped);
                        saveToStorage(mapped);
                    }
                });
        });
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;
    const inviteUnreadCount = notifications.filter((n) => n.id.startsWith('invite:') && !n.read).length;

    return { notifications, unreadCount, unseenCount, inviteUnreadCount, markRead, markSeen, markAllRead, markAllSeen, clearAll, deleteNotification, isLoading };
}
