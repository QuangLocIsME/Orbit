import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { NewProjectButton } from './CreateProjectModal';
import { DashboardSkeleton } from '@/components/ui/skeletons';

// Types
interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnail: string;
  lastVisited: string;
  category: 'favorites' | 'shared' | 'private';
  progress?: number;
  teamMembers?: number;
  issues?: number;
  status?: 'active' | 'review' | 'paused' | 'completed';
  projectType?: 'construction' | 'design' | 'software' | 'research';
  isFavorite?: boolean;
}

interface Event {
  id: string;
  title: string;
  datetime: string;
  project: string;
  attendees: number;
}

interface Task {
  id: string;
  title: string;
  project: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
}

interface SearchResult {
  type: 'project' | 'task' | 'event';
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
}

interface HomeDashboardProps {
  projects: Project[];
  events: Event[];
  tasks: Task[];
  userName: string;
}

// Icons
const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TaskIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const UsersIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const FolderIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// Utility functions
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// Main component
export default function HomeDashboard({ projects, events, tasks }: Omit<HomeDashboardProps, 'userName'> & { userName?: string }) {
  // Sync init from localStorage to avoid flash of wrong name
  const [displayUserName, setDisplayUserName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const u = localStorage.getItem('orbit_user');
      return u ? (JSON.parse(u).fullName || '') : '';
    } catch { return ''; }
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsHydrated(true);
    // Keep in sync if user info was refreshed
    const u = localStorage.getItem('orbit_user');
    if (u) {
      try { setDisplayUserName(JSON.parse(u).fullName || ''); } catch { /* ignore */ }
    }

    // Background prefetch — populate the cache that ProjectsManager reads so
    // navigating to /projects hits sessionStorage instead of making a new API call.
    let cancelled = false;
    const PROJECTS_KEY = 'orbit:projects:me';
    const FOLDERS_KEY  = 'orbit:folders:me';

    function toSlug(name: string): string {
      return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    function mapProject(p: Record<string, unknown>) {
      return {
        id:          p.publicId ?? p.id,
        name:        p.name ?? '',
        slug:        toSlug((p.name as string) || (p.publicId as string) || ''),
        description: p.description ?? '',
        thumbnail:   (p.thumbnailUrl ?? p.thumbnail ?? '') as string,
        lastVisited: p.updatedAt ?? p.lastVisited ?? new Date().toISOString(),
        category:    (p.category ?? 'private') as string,
        progress:    (p.progress ?? 0) as number,
        teamMembers: (p.memberCount ?? p.teamMembers ?? 0) as number,
        issues:      (p.issueCount ?? p.issues ?? 0) as number,
        status:      (p.status ?? 'active') as string,
        projectType: (p.projectType ?? 'software') as string,
        isFavorite:  Boolean(p.isFavorite),
      };
    }
    function mapFolder(f: Record<string, unknown>) {
      return {
        id:       f.publicId ?? f.id,
        name:     f.name ?? '',
        projects: (f.projects ?? []) as unknown[],
        color:    (f.color ?? '#6b7280') as string,
      };
    }

    const existingProjects = sessionStorage.getItem(PROJECTS_KEY);
    if (existingProjects) {
      try {
        const cached = JSON.parse(existingProjects);
        if (cached.expiresAt && cached.expiresAt > Date.now()) return; // still valid
      } catch { /* fall through */ }
    }

    (async () => {
      try {
        const res = await fetch('/api/projects/me', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const raw: Record<string, unknown>[] = Array.isArray(json)
          ? json
          : Array.isArray(json.data) ? json.data : [];
        if (cancelled) return;
        sessionStorage.setItem(PROJECTS_KEY, JSON.stringify({
          data: raw.map(mapProject),
          expiresAt: Date.now() + 30_000,
        }));

        const fRes = await fetch('/api/folders/me', { credentials: 'include' });
        if (!fRes.ok || cancelled) return;
        const fJson = await fRes.json();
        const rawF: Record<string, unknown>[] = Array.isArray(fJson)
          ? fJson
          : Array.isArray(fJson.data) ? fJson.data : [];
        if (cancelled) return;
        sessionStorage.setItem(FOLDERS_KEY, JSON.stringify({
          data: rawF.map(mapFolder),
          expiresAt: Date.now() + 45_000,
        }));
      } catch { /* silently ignore — ProjectsManager has its own fallback */ }
    })();

    return () => { cancelled = true; };
  }, []);

  // Sort projects - prioritize Metro Station and Office Complex first, then by last visited
  const recentProjects = [...projects]
    .sort((a, b) => {
      // Priority projects first
      const priorityOrder = ['metro-station-phase-2', 'office-complex-tower-a'];
      const aIndex = priorityOrder.indexOf(a.slug);
      const bIndex = priorityOrder.indexOf(b.slug);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // Then by last visited
      return new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime();
    })
    .slice(0, 7);

  // Calculate stats
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const totalTasks = tasks.length;
  const pendingTasks = tasks.length - completedTasks.size;
  const upcomingEvents = events.filter(e => new Date(e.datetime) >= new Date()).length;
  const totalIssues = projects.reduce((sum, p) => sum + (p.issues || 0), 0);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search projects
    projects.forEach(p => {
      if (p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)) {
        results.push({
          type: 'project',
          id: p.id,
          title: p.name,
          subtitle: p.description,
          href: `/projects/${p.slug}`
        });
      }
    });

    // Search tasks
    tasks.forEach(t => {
      if (t.title.toLowerCase().includes(query) || t.project.toLowerCase().includes(query)) {
        results.push({
          type: 'task',
          id: t.id,
          title: t.title,
          subtitle: `${t.project} - Due ${formatDate(t.dueDate)}`
        });
      }
    });

    // Search events
    events.forEach(e => {
      if (e.title.toLowerCase().includes(query) || e.project.toLowerCase().includes(query)) {
        results.push({
          type: 'event',
          id: e.id,
          title: e.title,
          subtitle: `${e.project} - ${formatDate(e.datetime)}`
        });
      }
    });

    setSearchResults(results.slice(0, 8));
  }, [searchQuery, projects, tasks, events]);

  // Close search on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTaskComplete = (taskId: string) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 text-red-600 border-red-200';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'low': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  if (!isHydrated) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-normal text-[#101828]">
          Welcome back{displayUserName ? `, ${displayUserName.split(' ')[0]}` : ''}
        </h1>
        <NewProjectButton />
      </div>

      {/* Search Bar with Dropdown */}
      <div ref={searchRef} className="relative max-w-2xl">
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all',
            isSearchFocused 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <SearchIcon />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search projects, files, tasks, or people ..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="rounded p-1 text-muted-foreground hover:bg-gray-100 hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchFocused && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="max-h-80 overflow-y-auto p-2">
              {searchResults.map((result) => (
                <a
                  key={`${result.type}-${result.id}`}
                  href={result.href || '#'}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
                  onClick={() => setIsSearchFocused(false)}
                >
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    result.type === 'project' && 'bg-indigo-100 text-indigo-600',
                    result.type === 'task' && 'bg-amber-100 text-amber-600',
                    result.type === 'event' && 'bg-blue-100 text-blue-600'
                  )}>
                    {result.type === 'project' && <FolderIcon />}
                    {result.type === 'task' && <TaskIcon />}
                    {result.type === 'event' && <CalendarIcon />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{result.type}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {isSearchFocused && searchQuery && searchResults.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg">
            <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Recently Visited Section */}
      <section>
        <div className="mb-4 flex items-center gap-2 text-muted-foreground">
          <ClockIcon />
          <span className="text-sm font-medium">Recently visited</span>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {recentProjects.map((project) => (
            <a
              key={project.id}
              href={`/projects/${project.slug}`}
              className="group w-44 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-gray-300 hover:shadow-lg active:scale-[0.98]"
            >
              <div className="aspect-[4/3] relative overflow-hidden">
                {project.thumbnail ? (
                  <img
                    src={project.thumbnail}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                {/* Fallback gradient */}
                <div className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  project.thumbnail ? "hidden" : "",
                  project.projectType === 'software' && "bg-gradient-to-br from-indigo-100 to-indigo-200",
                  project.projectType === 'design' && "bg-gradient-to-br from-pink-100 to-pink-200",
                  project.projectType === 'construction' && "bg-gradient-to-br from-amber-100 to-amber-200",
                  project.projectType === 'research' && "bg-gradient-to-br from-emerald-100 to-emerald-200",
                  !project.projectType && "bg-gradient-to-br from-gray-100 to-gray-200"
                )}>
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    project.projectType === 'software' && "bg-indigo-500 text-white",
                    project.projectType === 'design' && "bg-pink-500 text-white",
                    project.projectType === 'construction' && "bg-amber-500 text-white",
                    project.projectType === 'research' && "bg-emerald-500 text-white",
                    !project.projectType && "bg-gray-500 text-white"
                  )}>
                    <FolderIcon />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-foreground line-clamp-1">{project.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(project.lastVisited)}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Events and Tasks Grid - styled like Recently visited */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon />
              <span className="text-sm font-medium">Upcoming events</span>
            </div>
            <a href="/events" className="text-xs text-indigo-600 hover:text-indigo-700">View all</a>
          </div>
          <div className="flex flex-col gap-3">
            {events.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <CalendarIcon />
                <p className="mt-2 text-sm text-muted-foreground">No upcoming events</p>
              </div>
            ) : (
              events.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <CalendarIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground">{event.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.datetime)}, {formatTime(event.datetime)}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{event.project}</span>
                      <span>-</span>
                      <div className="flex items-center gap-1">
                        <UsersIcon />
                        <span>{event.attendees}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Your Tasks */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TaskIcon />
              <span className="text-sm font-medium">Your tasks</span>
            </div>
            <span className="text-xs text-muted-foreground">{pendingTasks} pending</span>
          </div>
          <div className="flex flex-col gap-3">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <TaskIcon />
                <p className="mt-2 text-sm text-muted-foreground">No tasks</p>
              </div>
            ) : (
              tasks.map((task) => {
                const isCompleted = completedTasks.has(task.id);
                return (
                  <div 
                    key={task.id} 
                    className={cn(
                      "flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md",
                      isCompleted && "opacity-60"
                    )}
                  >
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        isCompleted 
                          ? "border-green-500 bg-green-500 text-white" 
                          : "border-gray-300 hover:border-indigo-500"
                      )}
                    >
                      {isCompleted && <CheckIcon />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        "text-sm font-medium text-foreground",
                        isCompleted && "line-through"
                      )}>
                        {task.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {task.project} - {formatDate(task.dueDate)}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                      getPriorityStyles(task.priority)
                    )}>
                      {task.priority}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
