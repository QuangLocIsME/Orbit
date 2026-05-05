'use client';

import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { openNotificationTarget } from '@/lib/notification-actions';

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { unseenCount, markAllSeen, notifications, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideButton = dropdownRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideButton && !insidePanel) {
        setShowDropdown(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDropdown(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showDropdown]);

  const handleNotificationClick = (n: typeof notifications[0]) => {
    markRead(n.id);
    setShowDropdown(false);
    openNotificationTarget(n);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
          if (!showDropdown) markAllSeen();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        aria-label="Notifications"
        title="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unseenCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] w-auto items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-medium text-white">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {showDropdown && ReactDOM.createPortal((
        <div
          ref={panelRef}
          className="fixed right-4 top-[88px] w-80 rounded-xl border border-border bg-card shadow-xl z-[99999]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-card-foreground">Notifications</h3>
              {unseenCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                  {unseenCount} new
                </span>
              )}
            </div>
            {unseenCount > 0 && (
              <button
                onClick={() => {
                  markAllSeen();
                  markAllRead();
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
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="group relative"
                >
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${!n.seen ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!n.seen ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-card-foreground truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <a
                href="/notifications"
                className="block text-center text-xs text-indigo-600 hover:underline"
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      ), document.body)}
    </div>
  );
}
