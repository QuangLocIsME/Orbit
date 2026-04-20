'use client';

import { useState, useEffect } from 'react';
import { navigate } from 'astro:transitions/client';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface OpenProject {
  id: string;
  title: string;
  path: string;
}

interface TabItem {
  id: string;
  label: string;
}

interface ProjectTopBarProps {
  projectName: string;
  projectSlug: string;
  packageName?: string;
  activeTab?: string;
  isFavorite?: boolean;
  onTabChange?: (tabId: string) => void;
  onFavoriteChange?: (isFavorite: boolean) => void;
  projectRole?: 'owner' | 'admin' | 'member' | 'viewer';
  tabs?: TabItem[];
}

export default function ProjectTopBar({ projectName, projectSlug, packageName, activeTab: externalActiveTab, isFavorite: initialFavorite = false, onTabChange, onFavoriteChange, projectRole, tabs }: ProjectTopBarProps) {
  const [openProjects, setOpenProjects] = useState<OpenProject[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [displayProjectName, setDisplayProjectName] = useState(projectName);
  const [internalActiveTab, setInternalActiveTab] = useState('overview');
  const activeTab = (externalActiveTab ?? internalActiveTab);

  // Get current userId from localStorage to scope open-projects per user
  const userId = (() => {
    try {
      const u = localStorage.getItem('orbit_user');
      if (u) return JSON.parse(u).id;
    } catch { /* ignore */ }
    return null;
  })();

  const storageKey = userId ? `orbit-open-projects:${userId}` : 'orbit-open-projects';

  useEffect(() => {
    setIsFavorite(initialFavorite);
  }, [initialFavorite]);

  useEffect(() => {
    // Load open projects from localStorage
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setOpenProjects(JSON.parse(stored));
    }

    // Add current project to open projects
    setOpenProjects(prev => {
      const exists = prev.some(p => p.id === projectSlug);
      if (!exists) {
        const newProjects = [...prev, {
          id: projectSlug,
          title: projectName,
          path: `/projects/${projectSlug}`
        }];
        localStorage.setItem(storageKey, JSON.stringify(newProjects));
        return newProjects;
      }
      return prev;
    });
  }, [storageKey, projectSlug, projectName]);

  // Listen for localStorage changes (from other tabs/components)
  useEffect(() => {
    const handleProjectUpdate = (e: CustomEvent<{ projectId: string; title: string }>) => {
      if (e.detail.projectId === projectSlug) {
        setDisplayProjectName(e.detail.title);
        setOpenProjects(prev => prev.map(p => 
          p.id === projectSlug ? { ...p, title: e.detail.title } : p
        ));
      }
    };

    window.addEventListener('orbit:project-updated', handleProjectUpdate as EventListener);
    return () => window.removeEventListener('orbit:project-updated', handleProjectUpdate as EventListener);
  }, [projectSlug]);

  // Sync displayProjectName with projectName prop
  useEffect(() => {
    setDisplayProjectName(projectName);
  }, [projectName]);

  const closeProject = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newProjects = openProjects.filter(p => p.id !== projectId);
    setOpenProjects(newProjects);
    localStorage.setItem(storageKey, JSON.stringify(newProjects));
    
    // Navigate to home when closing current project
    if (projectId === projectSlug) {
      navigate('/');
    }
  };

  const goBack = () => {
    window.history.back();
  };

  const goForward = () => {
    window.history.forward();
  };

  const toggleFavorite = async () => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);

    try {
      const res = await apiFetch('/api/projects/favorite/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectSlug }),
      });

      const data = await res.json();
      if (data.success) {
        const newFavoriteState = data.data.isFavorite;
        setIsFavorite(newFavoriteState);
        onFavoriteChange?.(newFavoriteState);
        toast.success(newFavoriteState ? 'Added to favorites' : 'Removed from favorites');
      } else {
        toast.error(data.message || 'Failed to update favorite');
      }
    } catch (error) {
      toast.error('Failed to update favorite');
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  return (
    <>
    {/* Slide-out Sidebar Overlay */}
    {isSidebarOpen && (
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/20" 
          onClick={() => setIsSidebarOpen(false)}
        />
        {/* Sidebar Panel */}
        <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-lg border-r border-gray-200 overflow-auto">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <svg width="28" height="24" viewBox="0 0 29 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.0464 21.9802C20.5435 21.9802 24.9997 17.5239 24.9997 12.0269C24.9997 6.52984 20.5435 2.07361 15.0464 2.07361C9.54937 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 17.5239 9.54937 21.9802 15.0464 21.9802Z" stroke="#1F4CB1" strokeWidth="4.1472"/>
                <path d="M16.5772 16.0603C23.718 11.9375 28.4215 6.71548 27.0826 4.39653C25.7438 2.07758 18.8696 3.53988 11.7288 7.66266C4.58789 11.7854 -0.115579 17.0075 1.22327 19.3265C2.56211 21.6454 9.43628 20.1831 16.5772 16.0603Z" stroke="#C1C7CD" strokeWidth="1.99066" strokeLinecap="round"/>
                <path d="M23.6281 6.98166C21.8976 4.04448 18.7022 2.07361 15.0464 2.07361C9.54938 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 13.4725 5.40133 14.8461 5.95558 16.0857" stroke="#1F4CB1" strokeWidth="4.1472"/>
              </svg>
              <span className="text-[14px] font-medium text-[#111827]">ORBIT Workspace</span>
            </a>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Quick Navigation */}
          <div className="p-4">
            <div className="space-y-1">
              <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-[#111827] hover:bg-gray-50 transition-colors">
                <svg className="h-4 w-4 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </a>
              <a href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-[#111827] hover:bg-gray-50 transition-colors">
                <svg className="h-4 w-4 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Projects
              </a>
              <a href="/packages" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-[#111827] hover:bg-gray-50 transition-colors">
                <svg className="h-4 w-4 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Packages
              </a>
              <a href="/templates" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-[#111827] hover:bg-gray-50 transition-colors">
                <svg className="h-4 w-4 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Templates
              </a>
              <a href="/trash" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-[#111827] hover:bg-gray-50 transition-colors">
                <svg className="h-4 w-4 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Trash
              </a>
            </div>
          </div>
        </div>
      </div>
    )}

    <div className="flex flex-col border-b border-border bg-white fixed top-0 left-0 right-0 z-40">
      {/* Top row - Tabs bar */}
      <div className="flex h-11 items-center px-3 bg-gray-50 border-b border-gray-100">
        {/* Left side - Logo */}
        <div className="flex items-center gap-2">
          {/* ORBIT Logo */}
          <a href="/" className="flex items-center">
            <svg width="28" height="24" viewBox="0 0 29 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.0464 21.9802C20.5435 21.9802 24.9997 17.5239 24.9997 12.0269C24.9997 6.52984 20.5435 2.07361 15.0464 2.07361C9.54937 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 17.5239 9.54937 21.9802 15.0464 21.9802Z" stroke="#1F4CB1" strokeWidth="4.1472"/>
              <path d="M16.5772 16.0603C23.718 11.9375 28.4215 6.71548 27.0826 4.39653C25.7438 2.07758 18.8696 3.53988 11.7288 7.66266C4.58789 11.7854 -0.115579 17.0075 1.22327 19.3265C2.56211 21.6454 9.43628 20.1831 16.5772 16.0603Z" stroke="#C1C7CD" strokeWidth="1.99066" strokeLinecap="round"/>
              <path d="M23.6281 6.98166C21.8976 4.04448 18.7022 2.07361 15.0464 2.07361C9.54938 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 13.4725 5.40133 14.8461 5.95558 16.0857" stroke="#1F4CB1" strokeWidth="4.1472"/>
            </svg>
          </a>

          {/* Panel toggle icon - opens slide-out sidebar */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200"
            aria-label="Toggle sidebar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
              <path strokeWidth="2" d="M9 3v18" />
            </svg>
          </button>
        </div>

        {/* Separator */}
        <div className="mx-3 h-5 w-px bg-gray-300" />

        {/* Project tabs */}
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {openProjects.map((project) => (
            <a
              key={project.id}
              href={project.path}
              className={`group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                project.id === projectSlug
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:bg-gray-100'
              }`}
            >
              {/* Green dot for active project */}
              <span className={`h-2 w-2 rounded-full ${project.id === projectSlug ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <span className="truncate max-w-[150px]">{project.title}</span>
              {/* Close button */}
              <button
                onClick={(e) => closeProject(project.id, e)}
                className={`ml-1 flex h-4 w-4 items-center justify-center rounded transition-colors ${
                  project.id === projectSlug
                    ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600'
                }`}
                aria-label="Close tab"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </a>
          ))}
        </div>

        {/* Right side - Close button */}
        <button
          onClick={() => navigate('/')}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close project"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Bottom row - Breadcrumb and actions */}
      <div className="flex h-12 items-center justify-between px-4">
        {/* Left side - Navigation and breadcrumb */}
        <div className="flex items-center gap-3">
          {/* Back/Forward buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={goBack}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Go back"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goForward}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Go forward"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <a href="/projects" className="text-gray-500 hover:text-gray-700 transition-colors">Projects</a>
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {packageName ? (
              <>
                <a href={`/projects/${projectSlug}`} className="text-gray-500 hover:text-gray-700 transition-colors">{displayProjectName}</a>
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-gray-900">{packageName}</span>
              </>
            ) : (
              <span className="font-medium text-gray-900">{displayProjectName}</span>
            )}
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {/* 3D Viewer button */}
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            3D Viewer
          </button>

          {/* History button */}
          <button className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Favorite button */}
          <button
            onClick={toggleFavorite}
            disabled={isTogglingFavorite}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100",
              isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400 hover:text-gray-600"
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <svg
              className="h-5 w-5"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>

          {/* Share button */}
          <button className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>

          {/* More options button */}
          <button className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Third row - Navigation tabs */}
      <div className="flex h-9 items-center px-6 border-t border-gray-100">
        <nav className="flex items-center">
          {(tabs ?? [
            { id: 'overview', label: 'Overview' },
            ...(packageName ? [] : [{ id: 'packages', label: 'Packages' }]),
            { id: 'documents', label: 'Documents' },
            ...(packageName ? [] : [
              { id: 'versions', label: 'Versions' },
              { id: 'changes', label: 'Changes' },
            ]),
            { id: 'tasks', label: 'Tasks' },
            ...(packageName ? [] : [
              { id: 'clashes', label: 'Clashes' },
              { id: 'teams', label: 'Teams' },
            ]),
            { id: 'activity', label: 'Activity' },
            ...(projectRole === 'admin' || projectRole === 'owner' ? [{ id: 'settings', label: 'Settings' }] : []),
          ]).map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (packageName) {
                    try {
                      sessionStorage.setItem('projectActiveTab', tab.id);
                    } catch {
                      // ignore storage errors and continue navigation
                    }
                    navigate(`/projects/${projectSlug}`);
                    return;
                  }
                  setInternalActiveTab(tab.id);
                  onTabChange?.(tab.id);
                  window.dispatchEvent(new CustomEvent('orbit:topbar-tab-change', { detail: { tabId: tab.id } }));
                }}
                className={`px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
    </>
  );
}
