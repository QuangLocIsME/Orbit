'use client';

import { useState, useEffect } from 'react';
import { navigate } from 'astro:transitions/client';

interface OpenProject {
  id: string;
  title: string;
  path: string;
}

interface TopBarProps {
  currentPage: string;
  currentPath: string;
}

export default function TopBar({ currentPage, currentPath }: TopBarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openProjects, setOpenProjects] = useState<OpenProject[]>([]);

  // Check if we're on a project page
  const isProjectPage = currentPath.includes('/projects/');
  const currentProjectSlug = isProjectPage ? currentPath.split('/projects/')[1]?.split('/')[0] : null;

  // Load open projects from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('orbit-open-projects');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setOpenProjects(Array.isArray(parsed) ? parsed : []);
      } catch {
        setOpenProjects([]);
      }
    }
  }, []);

  // Update localStorage whenever openProjects changes
  useEffect(() => {
    localStorage.setItem('orbit-open-projects', JSON.stringify(openProjects));
  }, [openProjects]);

  // Listen for project deleted/trashed events
  useEffect(() => {
    const handleProjectRemoved = (e: CustomEvent<{ projectId: string }>) => {
      const { projectId } = e.detail;
      setOpenProjects(prev => {
        const filtered = prev.filter(p => p.id !== projectId);
        return filtered;
      });
    };

    window.addEventListener('orbit:project-removed' as any, handleProjectRemoved);
    return () => {
      window.removeEventListener('orbit:project-removed' as any, handleProjectRemoved);
    };
  }, []);

  // If on a project page, add it to open projects
  useEffect(() => {
    if (isProjectPage && currentProjectSlug) {
      setOpenProjects(prev => {
        const exists = prev.some(p => p.id === currentProjectSlug);
        if (!exists) {
          return [...prev, {
            id: currentProjectSlug,
            title: currentPage,
            path: currentPath
          }];
        } else {
          // Update title if project name changed
          return prev.map(p => 
            p.id === currentProjectSlug 
              ? { ...p, title: currentPage, path: currentPath }
              : p
          );
        }
      });
    }
  }, [isProjectPage, currentProjectSlug, currentPage, currentPath]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    // Dispatch custom event for sidebar to listen
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  const closeProject = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenProjects(prev => {
      return prev.filter(p => p.id !== projectId);
    });
    
    // If closing current project, navigate to home
    if (projectId === currentProjectSlug) {
      navigate('/home');
    }
  };

  const addNewTab = () => {
    navigate('/projects');
  };

  return (
    <div className="flex h-11 items-center border-b border-border bg-gray-50 px-3">
      {/* Left side - Logo and sidebar toggle */}
      <div className="flex items-center gap-2">
        {/* ORBIT Logo */}
        <a href="/home" className="flex items-center">
          <svg width="28" height="24" viewBox="0 0 29 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.0464 21.9802C20.5435 21.9802 24.9997 17.5239 24.9997 12.0269C24.9997 6.52984 20.5435 2.07361 15.0464 2.07361C9.54937 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 17.5239 9.54937 21.9802 15.0464 21.9802Z" stroke="#1F4CB1" strokeWidth="4.1472"/>
            <path d="M16.5772 16.0603C23.718 11.9375 28.4215 6.71548 27.0826 4.39653C25.7438 2.07758 18.8696 3.53988 11.7288 7.66266C4.58789 11.7854 -0.115579 17.0075 1.22327 19.3265C2.56211 21.6454 9.43628 20.1831 16.5772 16.0603Z" stroke="#C1C7CD" strokeWidth="1.99066" strokeLinecap="round"/>
            <path d="M23.6281 6.98166C21.8976 4.04448 18.7022 2.07361 15.0464 2.07361C9.54938 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 13.4725 5.40133 14.8461 5.95558 16.0857" stroke="#1F4CB1" strokeWidth="4.1472"/>
          </svg>
        </a>

        {/* Sidebar toggle icon (panel left) */}
        <button
          onClick={toggleSidebar}
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

      {/* Project tabs - only show when projects are open */}
      {openProjects.length > 0 ? (
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {openProjects.map((project) => (
            <a
              key={project.id}
              href={project.path}
              className={`group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                project.id === currentProjectSlug
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:bg-gray-100'
              }`}
            >
              {/* Project icon */}
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate max-w-[120px]">{project.title}</span>
              {/* Close button */}
              <button
                onClick={(e) => closeProject(project.id, e)}
                className={`ml-1 flex h-4 w-4 items-center justify-center rounded transition-colors ${
                  project.id === currentProjectSlug
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

          {/* Add new tab button */}
          <button
            onClick={addNewTab}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Open new project"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right side — close button */}
      <div className="flex items-center gap-1">
        <button
          className="flex h-7 w-7 items-center justify-center rounded text-[#4A5565] transition-colors hover:bg-gray-100"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
