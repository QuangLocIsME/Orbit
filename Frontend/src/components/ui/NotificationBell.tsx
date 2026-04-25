'use client';

import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useSocket } from '@/hooks/useSocket';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/socket';

const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const typeStyles: Record<Notification['type'], string> = {
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

const typeIcons: Record<Notification['type'], string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
  const { connected, latency } = useSocket();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<number>(0);
  const [badgeAnimating, setBadgeAnimating] = useState(false);

  // Animate badge when count increases (new notification arrives)
  useEffect(() => {
    const total = unreadCount;
    if (total > prevUnreadRef.current && prevUnreadRef.current > 0) {
      setBadgeAnimating(true);
      const t = setTimeout(() => setBadgeAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = total;
  }, [unreadCount]);

  // Close panel when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-scroll to first unread notification when panel opens
  useEffect(() => {
    if (!open) return;
    const firstUnread = notifications.find((n) => !n.read);
    if (!firstUnread) return;
    const el = document.getElementById(`notif-bell-${firstUnread.id}`);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [open, notifications]);

  return (
    <div className="relative isolate" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            suppressHydrationWarning
            className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white',
              badgeAnimating && 'animate-bounce'
            )}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-80 rounded-xl border bg-popover shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                  {unreadCount} new
                </span>
              )}
              {/* Connection status dot */}
              <span
                className={cn(
                  'inline-flex h-2 w-2 rounded-full',
                  connected ? 'bg-green-500' : 'bg-gray-300'
                )}
                title={connected ? `Connected${latency ? ` · ${latency}ms` : ''}` : 'Disconnected'}
              />
              {connected && latency !== null && (
                <span className="text-[10px] text-muted-foreground">{latency}ms</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllRead();
                    toast.success('All notifications marked as read');
                  }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <BellIcon className="h-8 w-8 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  id={`notif-bell-${n.id}`}
                  onClick={() => {
                    markRead(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent',
                    !n.read && 'bg-indigo-50/50 dark:bg-indigo-950/20'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      typeStyles[n.type]
                    )}
                  >
                    {typeIcons[n.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', !n.read && 'font-medium text-foreground')}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.message}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
