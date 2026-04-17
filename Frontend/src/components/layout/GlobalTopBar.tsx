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

interface GlobalTopBarProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export default function GlobalTopBar({ activeTab = 'packages', onTabChange }: GlobalTopBarProps) {
  const [openProjects, setOpenProjects] = useState<OpenProject[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const userId = (() => {
    try {
      const u = localStorage.getItem('orbit_user');
      if (u) return JSON.parse(u).id;
    } catch { /* ignore */ }
    return null;
  })();

  const storageKey = userId ? `orbit-open-projects:${userId}` : 'orbit-open-projects';

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setOpenProjects(JSON.parse(stored));
    }
  }, [storageKey]);

  const closeProject = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newProjects = openProjects.filter(p => p.id !== projectId);
    setOpenProjects(newProjects);
    localStorage.setItem(storageKey, JSON.stringify(newProjects));
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'packages', label: 'Packages' },
    { id: 'documents', label: 'Documents' },
    { id: 'versions', label: 'Versions' },
    { id: 'changes', label: 'Changes' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'clashes', label: 'Clashes' },
    { id: 'teams', label: 'Teams' },
    { id: 'extensions', label: 'Extensions' },
  ];

  return (
    <>
    {isSidebarOpen && (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/20"
          onClick={() => setIsSidebarOpen(false)}
        />
        <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-lg border-r border-gray-200 overflow-auto">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <svg width="28" height="24" viewBox="0 0 29 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.0464 21.9802C20.5435 21.9802 24.9997 17.5239 24.9997 12.0269C24.9997 6.52984 20.5435 2.07361 15.0464 2.07361C9.54937 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 17.5239 9.54937 21.9802 15.0464 21.9802Z" stroke="#1F4CB1" strokeWidth="4.1472"/>
                <path d="M16.5772 16.0603C23.718 11.9375 28.4215 6.71548 27.0826 4.39653C25.7438 2.07758 18.8696 3.53988 11.7288 7.66266C4.58789 11.7854 -0.115579 17.0075 1.22327 19.3265C2.56211 21.6454 9.43628 20.1831 16.5772 16.0603Z" stroke="#C1C7CD" strokeWidth="1.99066" strokeLinecap="round"/>
                <path d="M23.6281 6.98166C21.8976 4.04448 18.7022 2.07361 15.0464 2.07361C9.54938 2.07361 5.09314 12.0269 5.09314 12.0269C5.09314 13.4725 5.40133 14.8461 5.95558 16.0857" stroke="#1F4CB1" strokeWidth="4.1472"/>
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
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center">
            <svg width="28" height="24" viewBox="0 0 29 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.0464 21.9802C20.5435 21.9802 24.9997 17.5239 24.9997 12.0269C24.9997 6.52984 20.5435 2.07361 15.0464 2.07361C9.54937 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 17.5239 9.54937 21.9802 15.0464 21.9802Z" stroke="#1F4CB1" strokeWidth="4.1472"/>
              <path d="M16.5772 16.0603C23.718 11.9375 28.4215 6.71548 27.0826 4.39653C25.7438 2.07758 18.8696 3.53988 11.7288 7.66266C4.58789 11.7854 -0.115579 17.0075 1.22327 19.3265C2.56211 21.6454 9.43628 20.1831 16.5772 16.0603Z" stroke="#C1C7CD" strokeWidth="1.99066" strokeLinecap="round"/>
              <path d="M23.6281 6.98166C21.8976 4.04448 18.7022 2.07361 15.0464 2.07361C9.54938 2.07361 5.09314 12.0269 5.09314 12.0269C5.09314 13.4725 5.40133 14.8461 5.95558 16.0857" stroke="#1F4CB1" strokeWidth="4.1472"/>
            </svg>
          </a>
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

        <div className="mx-3 h-5 w-px bg-gray-300" />

        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {openProjects.map((project) => (
            <a
              key={project.id}
              href={project.path}
              className={`group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                'bg-white shadow-sm text-foreground'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-gray-300" />
              <span className="truncate max-w-[150px]">{project.title}</span>
              <button
                onClick={(e) => closeProject(project.id, e)}
                className="ml-1 flex h-4 w-4 items-center justify-center rounded transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Close tab"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </a>
          ))}
        </div>

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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.history.back()}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Go back"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => window.history.forward()}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Go forward"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <a href="/projects" className="text-gray-500 hover:text-gray-700 transition-colors">Projects</a>
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-gray-900">Packages</span>
          </div>
        </div>
      </div>

      {/* Third row - Navigation tabs */}
      <div className="flex h-9 items-center px-6 border-t border-gray-100">
        <nav className="flex items-center">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
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
