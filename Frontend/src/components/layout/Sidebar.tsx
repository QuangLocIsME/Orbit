import { useState, useEffect, useRef } from 'react';
import { cn } from '../../../lib/utils';
import { getCurrentUser, syncCurrentUser, signOut, type User } from '../../lib/auth';
import type { Project } from '../../types';

// Import mock data
import projectsData from '../../data/projects.json';

interface SidebarProps {
  currentPath: string;
}

const projects = projectsData as Project[];

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
};

export default function Sidebar({ currentPath }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Synchronous init from localStorage avoids flash of wrong user name
  const [authUser, setAuthUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    return getCurrentUser();
  });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('orbit-theme') as 'light' | 'dark' | 'system') || 'system';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'account' | 'community' | 'notifications' | 'security'>('account');
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync user info from backend on mount (keeps localStorage fresh)
  useEffect(() => {
    syncCurrentUser().then((user) => {
      if (user) setAuthUser(user);
    });
  }, []);

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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for sidebar toggle from TopBar
  useEffect(() => {
    const handleToggle = () => {
      setIsCollapsed(prev => !prev);
    };
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  // Display name from real user — no mock fallback
  const displayName = authUser?.fullName || '';
  const displayInitials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // FAVORITES shows only projects with isFavorite: true
  const favorites = projects.filter(p => p.isFavorite === true);
  const shared = projects.filter(p => p.category === 'shared' && !p.isFavorite);
  const privateProjects = projects.filter(p => p.category === 'private' && !p.isFavorite);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* User Profile Header - Notion style */}
      <div className="relative border-b border-sidebar-border" ref={userMenuRef}>
        <button
          onClick={() => !isCollapsed && setIsUserMenuOpen(!isUserMenuOpen)}
          className={cn(
            'flex h-14 w-full items-center justify-between px-4 transition-colors hover:bg-sidebar-accent',
            isCollapsed && 'justify-center'
          )}
        >
          <div className={cn('flex items-center gap-3', isCollapsed && 'hidden')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white">
              {displayInitials}
            </div>
            <span className="text-sm font-medium text-sidebar-foreground">{displayName}</span>
          </div>
          {!isCollapsed && (
            <svg 
              className={cn('h-4 w-4 text-muted-foreground transition-transform', isUserMenuOpen && 'rotate-180')} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          {isCollapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white">
              {displayInitials}
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {isUserMenuOpen && !isCollapsed && (
          <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
            {/* User Info with Edit */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 pb-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white">
                  {displayInitials}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUserMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
                >
                  <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{authUser?.email || 'user@example.com'}</p>
              </div>
            </div>

            {/* Theme Submenu */}
            <div className="py-1 border-b border-gray-100">
              <div className="relative">
                <button 
                  onClick={() => setIsThemeSubmenuOpen(!isThemeSubmenuOpen)}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground"
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
                  <div className="bg-gray-50 py-1">
                    {(['light', 'dark', 'system'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => {
                          setCurrentTheme(theme);
                          setIsThemeSubmenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-8 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
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
            <div className="py-1 border-b border-gray-100">
              <button 
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>

              <button 
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create workspace profile</span>
              </button>
            </div>

            {/* Current Account */}
            {authUser && (
              <div className="py-1 border-b border-gray-100">
                <p className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase">Logged in as</p>
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white">
                    {displayInitials}
                  </div>
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
                className="flex w-full items-center justify-between px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
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
            const isActive = currentPath === item.href || (item.href !== '/home' && currentPath.startsWith(item.href));
            
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-white/60 hover:text-foreground active:bg-white active:shadow-sm'
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
          <>
            <ProjectGroup title="FAVORITES" projects={favorites} currentPath={currentPath} />
            <ProjectGroup title="SHARED" projects={shared} currentPath={currentPath} />
            <ProjectGroup title="PRIVATE" projects={privateProjects} currentPath={currentPath} />
          </>
        )}
      </nav>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setIsSettingsOpen(false)}>
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-gray-100 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              {(['account', 'community', 'notifications', 'security'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSettingsTab(tab)}
                  className={cn(
                    'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
                    settingsTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              {settingsTab === 'account' && (
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-xl font-medium text-white">
                        {displayInitials}
                      </div>
                      <button className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50">
                        <svg className="h-3.5 w-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Name</p>
                          <p className="text-sm font-medium">{displayName}</p>
                        </div>
                        <button className="text-xs text-indigo-600 hover:underline">Change</button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-medium">{authUser?.email || 'user@example.com'}</p>
                        </div>
                        <button className="text-xs text-indigo-600 hover:underline">Change</button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Role</p>
                          <p className="text-sm font-medium">Project Manager</p>
                        </div>
                        <button className="text-xs text-indigo-600 hover:underline">Change</button>
                      </div>
                    </div>
                  </div>

                  {/* Upgrade Plan */}
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                    <h3 className="text-sm font-semibold text-indigo-900">Upgrade ORBIT plan</h3>
                    <p className="text-xs text-indigo-700 mt-1">Get access to premium features and unlimited projects.</p>
                    <button className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      Upgrade now
                    </button>
                  </div>

                  {/* Your Workspaces */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Your workspaces</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 font-medium text-sm">W</div>
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
                    <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <option>English</option>
                      <option>Vietnamese</option>
                      <option>Japanese</option>
                    </select>
                  </div>

                  {/* Theme with Enhance Contrast */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Theme</p>
                        <p className="text-xs text-muted-foreground">Customize appearance</p>
                      </div>
                      <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <option>System</option>
                        <option>Light</option>
                        <option>Dark</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between mt-3 ml-4">
                      <span className="text-sm text-muted-foreground">Enhance contrast</span>
                      <button className="relative h-5 w-9 rounded-full bg-gray-200 transition-colors">
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
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">Beta</span>
                      </div>
                      <button className="relative h-5 w-9 rounded-full bg-gray-200 transition-colors">
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
                  <div className="border-t border-gray-200 pt-6">
                    <button className="text-sm text-red-600 hover:underline">Delete account</button>
                  </div>
                </div>
              )}

              {settingsTab === 'community' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
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
}

function ProjectGroup({ title, projects, currentPath }: ProjectGroupProps) {
  if (projects.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-1">
        {projects.map((project) => {
          const isActive = currentPath === `/projects/${project.slug}`;
          
          return (
            <li key={project.id}>
              <a
                href={`/projects/${project.slug}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                  isActive
                    ? 'bg-gray-100 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-gray-100 hover:text-foreground active:bg-gray-200'
                )}
              >
                <IconMap.project className="h-4 w-4 shrink-0" />
                <span className="truncate">{project.name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
