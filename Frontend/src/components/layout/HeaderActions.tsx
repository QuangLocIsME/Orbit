'use client';

import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from '@/components/ui/sonner';
import type { InviteNotification } from '@/lib/socket';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface PendingInvite extends InviteNotification {
  dismissed?: boolean;
  inviteStatus?: 'pending' | 'accepted' | 'revoked';
}

export default function HeaderActions() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeInvite, setActiveInvite] = useState<PendingInvite | null>(null);
  const activeInviteRef = useRef<PendingInvite | null>(null);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('orbit-theme', next);
  };

  useEffect(() => {
    const saved = localStorage.getItem('orbit-theme') as 'light' | 'dark' | null;
    const initial: 'light' | 'dark' = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationListRef = useRef<HTMLDivElement>(null);
  const firstUnreadIdRef = useRef<string | null>(null);

  const { notifications, unseenCount, unreadCount, markRead, markSeen, markAllRead, markAllSeen, clearAll, deleteNotification } = useNotifications();
  const totalUnseen = unseenCount;

  useEffect(() => { activeInviteRef.current = activeInvite; }, [activeInvite]);

  const prevUnreadRef = useRef<number>(0);
  const [badgeAnimating, setBadgeAnimating] = useState(false);

  // Animate badge when count increases (new notification arrives)
  useEffect(() => {
      if (totalUnseen > prevUnreadRef.current && prevUnreadRef.current > 0) {
      setBadgeAnimating(true);
      const t = setTimeout(() => setBadgeAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = totalUnseen;
  }, [totalUnseen]);

  // Auto-scroll to first unread notification when dropdown opens
  useEffect(() => {
    if (!showNotifications) return;
    const firstUnread = notifications.find((n) => !n.read);
    if (!firstUnread) return;
    const el = document.getElementById(`notif-${firstUnread.id}`);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [showNotifications, notifications]);

  const resolveInviteFromNotification = (n: { id: string; title: string; message?: string; link?: string; createdAt: string; inviteData?: InviteNotification }): PendingInvite => {
    const fallbackInviteId = n.id.replace('invite:', '');
    const fallbackPayload: PendingInvite = {
      inviteId: fallbackInviteId,
      token: undefined,
      projectId: '',
      projectName: n.message?.match(/Join\s+"([^"]+)"/)?.[1] || 'a project',
      role: n.message?.match(/as\s+(.+)$/)?.[1] || 'member',
      inviterName: n.title?.replace(/\s+invited you$/i, '') || 'Someone',
      acceptUrl: n.link,
      createdAt: n.createdAt,
      dismissed: false,
      inviteStatus: 'pending',
    };

    return { ...(n.inviteData ?? fallbackPayload), dismissed: false, inviteStatus: 'pending' };
  };

  const fetchInviteStatus = async (inviteId: string): Promise<'pending' | 'accepted' | 'revoked'> => {
    try {
      const res = await apiFetch(`/api/invites/${inviteId}/status`);
      const data = await res.json();
      if (data.success && data.data?.status) {
        return data.data.status;
      }
    } catch { /* ignore */ }
    return 'pending';
  };

  const handleAcceptInvite = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      const res = await apiFetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.token || invite.inviteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to accept invite');
        return;
      }
      toast.success(`You joined "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch {
      toast.error('Failed to accept invite');
    }
  };

  const handleDeclineInvite = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      const res = await apiFetch('/api/invites/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.inviteId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || 'Failed to decline invite');
        return;
      }
      toast.info(`Declined invite to "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch {
      toast.error('Failed to decline invite');
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-1">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        )}
      </button>

      {/* Notifications */}
      <div ref={notificationRef} className="relative">
        <button
          onClick={() => {
            setShowNotifications(!showNotifications);
            if (!showNotifications) {
              markAllSeen();
            }
          }}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
          title="Notifications"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {totalUnseen > 0 && (
            <span
              suppressHydrationWarning
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white',
                badgeAnimating && 'animate-bounce'
              )}
            >
              {totalUnseen > 9 ? '9+' : totalUnseen}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {showNotifications && ReactDOM.createPortal((
          <div
            className="fixed right-6 top-14 w-80 rounded-xl border border-border bg-card shadow-xl z-[99999]"
            style={{ position: 'fixed', right: '1.5rem', top: '3.5rem' }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-card-foreground">Notifications</h3>
                {totalUnseen > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                    {totalUnseen} new
                  </span>
                )}
              </div>
              {totalUnseen > 0 && (
                <button
                  onClick={() => {
                    markAllSeen();
                    markAllRead();
                    toast.success('All notifications marked as read');
                  }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                  <svg className="h-8 w-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    id={`notif-${n.id}`}
                    className="group relative"
                  >
                    <button
                      onClick={() => {
                        markRead(n.id);
                        if (n.id.startsWith('invite:')) {
                          markRead(n.id);
                          const invite = resolveInviteFromNotification(n);
                          fetchInviteStatus(invite.inviteId).then((status) => {
                            setActiveInvite({ ...invite, inviteStatus: status });
                          });
                          setShowNotifications(false);
                          return;
                        }
                        if (n.link) {
                          const match = n.link.match(/\/projects\/([^/]+)/);
                          if (match) {
                            window.location.href = `/projects/${match[1]}?tab=tasks`;
                          } else {
                            window.location.href = n.link;
                          }
                          return;
                        }
                      }}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted',
                        !n.seen && 'bg-indigo-50/50'
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                        {n.type === 'success' ? '✓' : n.type === 'warning' ? '⚠' : n.type === 'error' ? '✕' : 'ℹ'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm truncate', !n.seen && 'font-medium text-foreground')}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.message}</p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.seen && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                        toast.success('Notification deleted');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md bg-muted/80 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                      aria-label="Delete notification"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ), document.body)}
      </div>

      {/* Invite Modal */}
      {activeInvite && ReactDOM.createPortal((
        <>
          <div
            className="fixed inset-0 z-[99998] bg-black/50"
            onClick={() => {
              setActiveInvite(null);
              activeInviteRef.current = null;
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-[99999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex flex-col gap-2 text-center sm:text-left">
              <h2 className="text-lg font-semibold text-card-foreground">
                {activeInvite?.inviterName} invited you to join
              </h2>
              <div className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                {activeInvite?.projectAvatar ? (
                  <img
                    src={activeInvite.projectAvatar}
                    alt={activeInvite.projectName}
                    className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-[#E5E7EB]"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 border border-[#E5E7EB] bg-[#EFF6FF] text-[#155DFC] font-semibold text-sm">
                    {activeInvite?.projectName?.slice(0, 2).toUpperCase() || 'PR'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#101828] truncate">{activeInvite?.projectName || 'Project'}</p>
                  <p className="text-xs text-[#6A7282] mt-0.5">
                    Role: <span className="capitalize font-medium">{activeInvite?.role || 'member'}</span>
                  </p>
                </div>
              </div>
              {activeInvite?.inviteStatus !== 'pending' ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-green-700">You've already responded to this invitation</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Would you like to accept this invitation?
                </p>
              )}
            </div>
            {activeInvite?.inviteStatus !== 'pending' ? (
              <div className="mt-5">
                <button
                  onClick={() => {
                    setActiveInvite(null);
                    activeInviteRef.current = null;
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 border bg-background shadow-xs hover:bg-muted"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2 mt-5 sm:flex-row sm:justify-end">
                <button
                  onClick={handleDeclineInvite}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 border bg-background shadow-xs hover:bg-muted"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptInvite}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-[#155DFC] text-white hover:bg-blue-700"
                >
                  Accept
                </button>
              </div>
            )}
          </div>
        </>
      ), document.body)}
    </div>
  );
}
