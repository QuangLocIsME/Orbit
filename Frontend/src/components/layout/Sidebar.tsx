import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { syncCurrentUser, signOut, getCurrentUser, type User } from '../../lib/auth';
import { useAppStore, type ApiProject } from '../../stores/appStore';
import { apiFetch } from '../../lib/api-client';
import { useNotifications } from '@/hooks/useNotifications';
import { openNotificationTarget } from '@/lib/notification-actions';
import { toast } from 'sonner';

interface SidebarProps {
  currentPath: string;
}

let sidebarUserCache: User | null = null;
let sidebarCollapsedCache = false;

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: 'favorites' | 'shared' | 'private';
  isFavorite?: boolean;
  coverImageUrl?: string;
  role?: 'admin' | 'member' | 'viewer' | 'owner';
  sortOrder?: number;
}

const mainNavItems = [
  { title: 'Home', href: '/home', icon: 'home' },
  { title: 'Projects', href: '/projects', icon: 'folder' },
  { title: 'Workflow Templates', href: '/templates', icon: 'template' },
  { title: 'Trash', href: '/trash', icon: 'trash' },
];

const IconMap: Record<string, React.FC<{ className?: string }>> = {
  home: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  folder: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  template: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  trash: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  project: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  chevronRight: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  star: ({ className }) => (
    <svg className={className} fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
};

export default function Sidebar({ currentPath }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(sidebarCollapsedCache);
  const [activePath, setActivePath] = useState(() =>
    typeof window === 'undefined' ? currentPath : window.location.pathname
  );
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('orbit-theme') as 'light' | 'dark' | 'system') || 'light';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'account' | 'community' | 'notifications' | 'security'>('account');
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const { unseenCount, markAllSeen, notifications, markRead, markAllRead, deleteNotification } = useNotifications();
  const totalUnseen = unseenCount;

  // Fetch projects from API
  const fetchProjects = async () => {
    try {
      const res = await apiFetch('/api/projects/me');
      if (res.ok) {
        const data = await res.json();
        const mappedProjects: Project[] = (data.data || []).map((p: ApiProject) => ({
          id: p.publicId,
          slug: p.publicId,
          name: p.name,
          description: p.description,
          category: 'shared' as const,
          isFavorite: p.isFavorite === true,
          coverImageUrl: p.coverImageUrl,
          role: p.role as Project['role'],
          sortOrder: (p as any).sortOrder || 0,
        }));
        setProjects(mappedProjects);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  // Fetch projects from API
  useEffect(() => {
    fetchProjects();
  }, []);

  // Listen for project events (window events) to refresh sidebar
  useEffect(() => {
    const handleProjectRemoved = () => fetchProjects();
    const handleProjectCreated = () => fetchProjects();
    const handleFavoriteToggledLocal = () => fetchProjects();

    window.addEventListener('orbit:project-removed', handleProjectRemoved);
    window.addEventListener('orbit:project-created', handleProjectCreated);
    window.addEventListener('orbit:favorite-toggled', handleFavoriteToggledLocal);

    return () => {
      window.removeEventListener('orbit:project-removed', handleProjectRemoved);
      window.removeEventListener('orbit:project-created', handleProjectCreated);
      window.removeEventListener('orbit:favorite-toggled', handleFavoriteToggledLocal);
    };
  }, []);

  // Show cached user immediately (module + localStorage), then refresh from backend
  useEffect(() => {
    if (sidebarUserCache) {
      setAuthUser(sidebarUserCache);
    } else {
      const cached = getCurrentUser();
      if (cached) {
        sidebarUserCache = cached;
        setAuthUser(cached);
      }
    }

    syncCurrentUser().then((user) => {
      if (user) {
        sidebarUserCache = user;
        setAuthUser(user);
      }
    }).catch(() => {
      // Silently swallow errors — the store hydration handles auth state.
      // No unhandled promise rejection will be raised.
    });
  }, []);

  // Sync avatar from appStore when it changes (WebSocket update)
  const storeAuth = useAppStore((s) => s.auth);
  useEffect(() => {
    if (storeAuth?.avatar !== authUser?.avatar) {
      setAuthUser((prev) => prev ? { ...prev, avatar: storeAuth?.avatar ?? null } : prev);
      if (storeAuth) {
        sidebarUserCache = { ...(sidebarUserCache ?? getCurrentUser()!), avatar: storeAuth.avatar ?? null };
      }
    }
  }, [storeAuth?.avatar]);

  // Apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else if (currentTheme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
    localStorage.setItem('orbit-theme', currentTheme);
  }, [currentTheme]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      const target = event.target as Node;
      const insideNotificationButton = notificationRef.current?.contains(target);
      const insideNotificationPanel = notificationPanelRef.current?.contains(target);
      if (!insideNotificationButton && !insideNotificationPanel) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // Listen for sidebar toggle from TopBar
  useEffect(() => {
    const handleToggle = () => {
      setIsCollapsed(prev => {
        const next = !prev;
        sidebarCollapsedCache = next;
        return next;
      });
    };
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  // Keep active path in sync when using client router transitions
  useEffect(() => {
    const syncPath = () => setActivePath(window.location.pathname);

    syncPath();
    window.addEventListener('popstate', syncPath);
    document.addEventListener('astro:page-load', syncPath as EventListener);

    return () => {
      window.removeEventListener('popstate', syncPath);
      document.removeEventListener('astro:page-load', syncPath as EventListener);
    };
  }, []);

  const displayName = authUser?.fullName || 'Workspace';
  const displayInitials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'W';

  // FAVORITES shows only projects with isFavorite: true
  // Sort each group by sortOrder
  const sortByOrder = (arr: Project[]) => [...arr].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const favorites = sortByOrder(projects.filter(p => p.isFavorite === true));
  // MY PROJECTS: role === 'owner' (user created/owns)
  const myProjects = sortByOrder(projects.filter(p => p.role === 'owner' && !p.isFavorite));
  // SHARED: role !== 'owner' (invited to project or assigned other roles)
  const shared = sortByOrder(projects.filter(p => p.role !== 'owner' && !p.isFavorite));

  return (
    <aside
      className={cn(
        'orbit-sidebar-shell flex h-full flex-col border-r border-sidebar-border bg-sidebar',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* User Profile Header */}
      <div className="relative border-b border-sidebar-border" ref={userMenuRef}>
        <div className="flex h-14 items-center justify-between px-4">
          {/* User Info */}
          <button
            onClick={() => !isCollapsed && setIsUserMenuOpen(!isUserMenuOpen)}
            className={cn(
              'flex items-center gap-3 transition-colors hover:bg-sidebar-accent rounded-lg',
              isCollapsed && 'justify-center'
            )}
          >
            <div className={cn('flex items-center gap-3', isCollapsed && 'hidden')}>
              {authUser?.avatar ? (
                <img src={authUser.avatar} alt={displayName} className="flex h-8 w-8 items-center justify-center rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#155DFC] text-xs font-medium text-white flex-shrink-0">
                  {displayInitials}
                </div>
              )}
              <span className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</span>
            </div>
            {isCollapsed && (
              authUser?.avatar ? (
                <img src={authUser.avatar} alt={displayName} className="flex h-8 w-8 items-center justify-center rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#155DFC] text-xs font-medium text-white">
                  {displayInitials}
                </div>
              )
            )}
          </button>

          {/* Chevron + Notification Button */}
          <div className="flex items-center gap-2">
            {/* Chevron */}
            {!isCollapsed && (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <svg
                  className={cn('h-4 w-4 transition-transform', isUserMenuOpen && 'rotate-180')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Notification Bell */}
            <div ref={notificationRef} className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markAllSeen();
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Notifications"
                title="Notifications"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {totalUnseen > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] w-auto items-center justify-center rounded-full border-2 border-sidebar bg-red-500 px-1 text-[10px] font-medium text-white">
                    {totalUnseen > 9 ? '9+' : totalUnseen}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && ReactDOM.createPortal((
                <div
                  ref={notificationPanelRef}
                  className="fixed left-[280px] top-[60px] w-80 rounded-xl border border-border bg-card shadow-xl z-[99999]"
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
                            onClick={() => {
                              markRead(n.id);
                              setShowNotifications(false);
                              openNotificationTarget(n);
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
          </div>
        </div>

        {/* Dropdown Menu */}
        {isUserMenuOpen && !isCollapsed && (
          <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 shadow-lg">
            {/* User Info */}
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-zinc-700 px-4 pb-3">
              <div className="relative">
                {authUser?.avatar ? (
                  <img src={authUser.avatar} alt={displayName} className="flex h-10 w-10 items-center justify-center rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white">
                    {displayInitials}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUserMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
                >
                  <svg className="h-3 w-3 text-gray-600 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{authUser?.email || ''}</p>
              </div>
            </div>

            {/* Theme Submenu */}
            <div className="py-1 border-b border-gray-100 dark:border-zinc-700">
              <div className="relative">
                <button
                  onClick={() => setIsThemeSubmenuOpen(!isThemeSubmenuOpen)}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span>Theme</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">{currentTheme}</span>
                    <svg className={cn("h-4 w-4 transition-transform", isThemeSubmenuOpen && "rotate-90")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
                {isThemeSubmenuOpen && (
                  <div className="bg-gray-50 dark:bg-zinc-800 py-1">
                    {(['light', 'dark', 'system'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => {
                          setCurrentTheme(theme);
                          setIsThemeSubmenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-8 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-foreground"
                      >
                        <span className="capitalize">{theme}</span>
                        {currentTheme === theme && (
                          <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1 border-b border-gray-100 dark:border-zinc-700">
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  window.location.href = '/settings/my-account';
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>

              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create workspace profile</span>
              </button>
            </div>

            {/* Current Account */}
            {authUser && (
              <div className="py-1 border-b border-gray-100 dark:border-zinc-700">
                <p className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase">Logged in as</p>
                <div className="flex items-center gap-3 px-4 py-2">
                  {authUser?.avatar ? (
                    <img src={authUser.avatar} alt={displayName} className="flex h-8 w-8 items-center justify-center rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white">
                      {displayInitials}
                    </div>
                  )}
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{authUser.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{authUser.email}</p>
                  </div>
                  <svg className="h-4 w-4 text-indigo-600 shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Logout */}
            <div className="pt-1">
              <button
                onClick={() => signOut()}
                className="flex w-full items-center justify-between px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <div className="flex items-center gap-3">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Log out</span>
                </div>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = IconMap[item.icon];
            const isActive = activePath === item.href || (item.href !== '/home' && activePath.startsWith(item.href));

            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={cn(
                    'orbit-nav-item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-white dark:bg-zinc-700 text-foreground shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-500/20'
                      : 'text-muted-foreground hover:bg-white/60 dark:hover:bg-zinc-700/60 hover:text-foreground active:bg-white dark:active:bg-zinc-700 active:shadow-sm'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </a>
              </li>
            );
          })}
        </ul>

        {/* Project Groups */}
        {!isCollapsed && (
          <ProjectGroup title="FAVORITES" projects={favorites} currentPath={currentPath} storageKey="orbit-favorites" />
        )}
        {!isCollapsed && (
          <ProjectGroup title="MY PROJECTS" projects={myProjects} currentPath={currentPath} storageKey="orbit-my-projects" />
        )}
        {!isCollapsed && (
          <ProjectGroup title="SHARED" projects={shared} currentPath={currentPath} storageKey="orbit-shared" />
        )}
      </nav>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-stretch justify-start bg-black/40" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="relative flex h-full w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden border-r border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="overflow-x-auto border-b border-gray-200 dark:border-zinc-700 px-4">
              <div className="flex min-w-max">
                {(['account', 'community', 'notifications', 'security'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={cn(
                      'px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
                      settingsTab === tab
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {settingsTab === 'account' && (
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      {authUser?.avatar ? (
                        <img src={authUser.avatar} alt={displayName} className="flex h-16 w-16 items-center justify-center rounded-full object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-xl font-medium text-white">
                          {displayInitials}
                        </div>
                      )}
                      <button className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700">
                        <svg className="h-3.5 w-3.5 text-gray-600 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Name</p>
                          <p className="max-w-[180px] truncate text-sm font-medium">{displayName}</p>
                        </div>
                        <button className="text-xs text-indigo-600 hover:underline">Change</button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="max-w-[180px] truncate text-sm font-medium">{authUser?.email || ''}</p>
                        </div>
                        <button className="text-xs text-indigo-600 hover:underline">Change</button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">User ID</p>
                          <p className="max-w-[180px] truncate text-sm font-medium">{authUser?.id || ''}</p>
                        </div>
                        <button className="text-xs text-indigo-600 hover:underline">View</button>
                      </div>
                    </div>
                  </div>

                  {/* Upgrade Plan */}
                  <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4">
                    <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">Upgrade ORBIT plan</h3>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">Get access to premium features and unlimited projects.</p>
                    <button className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      Upgrade now
                    </button>
                  </div>

                  {/* Your Workspaces */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Your workspaces</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-zinc-700 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium text-sm">W</div>
                          <span className="text-sm font-medium">Main Workspace</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Owner</span>
                      </div>
                    </div>
                  </div>

                  {/* Language */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Language</p>
                      <p className="text-xs text-muted-foreground">Select your preferred language</p>
                    </div>
                    <select className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-foreground px-3 py-2 text-sm">
                      <option>English</option>
                      <option>Vietnamese</option>
                      <option>Japanese</option>
                    </select>
                  </div>

                  {/* Theme — connected to currentTheme state */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Theme</p>
                        <p className="text-xs text-muted-foreground">Customize appearance</p>
                      </div>
                      <select
                        value={currentTheme}
                        onChange={(e) => setCurrentTheme(e.target.value as 'light' | 'dark' | 'system')}
                        className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-foreground px-3 py-2 text-sm"
                      >
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between mt-3 ml-4">
                      <span className="text-sm text-muted-foreground">Enhance contrast</span>
                      <button className="relative h-5 w-9 rounded-full bg-gray-200 dark:bg-zinc-700 transition-colors">
                        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* New Features */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">New features</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Closed captions</span>
                        <span className="rounded bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">Beta</span>
                      </div>
                      <button className="relative h-5 w-9 rounded-full bg-gray-200 dark:bg-zinc-700 transition-colors">
                        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* Library Settings */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Library settings</p>
                      <p className="text-xs text-muted-foreground">Manage your content library</p>
                    </div>
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* View History */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">View history preferences</p>
                      <p className="text-xs text-muted-foreground">Control your viewing history</p>
                    </div>
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* Delete Account */}
                  <div className="border-t border-gray-200 dark:border-zinc-700 pt-6">
                    <button className="text-sm text-red-600 hover:underline">Delete account</button>
                  </div>
                </div>
              )}

              {settingsTab === 'community' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Community Settings</h3>
                  <p className="text-sm text-muted-foreground mt-1">Manage your community preferences</p>
                </div>
              )}

              {settingsTab === 'notifications' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Notification Settings</h3>
                  <p className="text-sm text-muted-foreground mt-1">Control your notification preferences</p>
                </div>
              )}

              {settingsTab === 'security' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Security Settings</h3>
                  <p className="text-sm text-muted-foreground mt-1">Manage your security options</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

interface ProjectGroupProps {
  title: string;
  projects: Project[];
  currentPath: string;
  storageKey: string;
}

function ProjectGroup({ title, projects, currentPath, storageKey }: ProjectGroupProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });

  const [localProjects, setLocalProjects] = useState(projects);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  const toggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, String(next)); } catch {}
      return next;
    });
  };

  const saveProjectOrder = async (projectIds: string[]) => {
    try {
      await fetch('/api/projects/order/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectIds }),
      });
    } catch {
      toast.error('Failed to save project order');
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedId(projectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', projectId);
  };

  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId !== projectId) {
      setDragOverId(projectId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setLocalProjects((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === draggedId);
      const toIdx = prev.findIndex((p) => p.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      saveProjectOrder(reordered.map((p) => p.id));
      return reordered;
    });

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverId(null);
    }
  };

  if (localProjects.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={`${storageKey}-content`}
        className="mb-2 flex w-full items-center gap-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
      >
        <span className="group-hover:text-foreground relative flex w-4 h-4 shrink-0 items-center justify-center text-muted-foreground transition-all duration-150">
          <span className={cn('text-[11px] leading-none transition-transform duration-150', isOpen ? 'rotate-90' : '')}>{'>'}</span>
        </span>
        <span>{title}</span>
      </button>
      {isOpen && (
        <AnimatePresence initial={false}>
        <ul id={`${storageKey}-content`} className="space-y-1">
          {localProjects.map((project) => {
            const isActive = currentPath === `/projects/${project.slug}`;
            const isDragging = draggedId === project.id;
            const isDragOver = dragOverId === project.id;

            return (
              <motion.li
                key={project.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                draggable
                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent<HTMLElement>, project.id)}
                onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent<HTMLElement>, project.id)}
                onDrop={(e) => handleDrop(e as unknown as React.DragEvent<HTMLElement>, project.id)}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
                className={cn(
                  'relative rounded-lg transition-all duration-150',
                  isDragging && 'opacity-40',
                  isDragOver && 'before:absolute before:-left-1 before:top-0 before:bottom-0 before:w-0.5 before:bg-indigo-400 before:rounded-full'
                )}
              >
                <a
                  href={`/projects/${project.slug}`}
                  draggable={false}
                  onDragStart={(e) => {
                    e.preventDefault();
                    const img = new Image();
                    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    e.dataTransfer.setDragImage(img, 0, 0);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                    isActive
                      ? 'bg-gray-100 dark:bg-zinc-700 text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-foreground active:bg-gray-200 dark:active:bg-zinc-600'
                  )}
                >
                  <IconMap.project className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">{project.name}</span>
                  <AnimatePresence>
                    {project.isFavorite && (
                      <motion.span
                        key="star-icon"
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <IconMap.star className="h-4 w-4 shrink-0 text-yellow-500" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </a>
              </motion.li>
            );
          })}
        </ul>
        </AnimatePresence>
      )}
    </div>
  );
}
