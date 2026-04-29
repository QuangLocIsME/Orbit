import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { NewProjectButton } from './CreateProjectModal';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/appStore';
import { apiFetch } from '@/lib/api-client';
import { loadCustomIndustriesRaw } from './CreateProjectModal';

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
  projectType?: string;
  industryName?: string;
  customIndustry?: {
    icon: string;
    color: string;
  };
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
  projectPublicId: string;
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

  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 30) return 'Just now';
  if (diffHours < 1) return `${diffMins} min ago`;
  if (diffDays < 1) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function toSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const PROJECT_TYPE_VISUALS: Record<string, {
  gradient: string;
  badge: string;
  iconPath: string;
}> = {
  software: {
    gradient: 'bg-gradient-to-br from-cyan-50 to-cyan-100',
    badge: 'bg-cyan-500 text-white',
    iconPath: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  design: {
    gradient: 'bg-gradient-to-br from-purple-50 to-purple-100',
    badge: 'bg-purple-500 text-white',
    iconPath: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  },
  construction: {
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100',
    badge: 'bg-blue-500 text-white',
    iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  research: {
    gradient: 'bg-gradient-to-br from-teal-50 to-teal-100',
    badge: 'bg-teal-500 text-white',
    iconPath: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  marketing: {
    gradient: 'bg-gradient-to-br from-red-50 to-red-100',
    badge: 'bg-red-500 text-white',
    iconPath: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  },
  default: {
    gradient: 'bg-gradient-to-br from-gray-50 to-gray-100',
    badge: 'bg-gray-500 text-white',
    iconPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  },
};

const CUSTOM_COLOR_VISUALS: Record<string, { gradient: string; badge: string }> = {
  red: { gradient: 'bg-gradient-to-br from-red-50 to-red-100', badge: 'bg-red-500 text-white' },
  orange: { gradient: 'bg-gradient-to-br from-orange-50 to-orange-100', badge: 'bg-orange-500 text-white' },
  amber: { gradient: 'bg-gradient-to-br from-amber-50 to-amber-100', badge: 'bg-amber-500 text-white' },
  green: { gradient: 'bg-gradient-to-br from-green-50 to-green-100', badge: 'bg-green-500 text-white' },
  teal: { gradient: 'bg-gradient-to-br from-teal-50 to-teal-100', badge: 'bg-teal-500 text-white' },
  blue: { gradient: 'bg-gradient-to-br from-blue-50 to-blue-100', badge: 'bg-blue-500 text-white' },
  purple: { gradient: 'bg-gradient-to-br from-purple-50 to-purple-100', badge: 'bg-purple-500 text-white' },
  pink: { gradient: 'bg-gradient-to-br from-pink-50 to-pink-100', badge: 'bg-pink-500 text-white' },
  violet: { gradient: 'bg-gradient-to-br from-violet-50 to-violet-100', badge: 'bg-violet-500 text-white' },
  gray: { gradient: 'bg-gradient-to-br from-gray-50 to-gray-100', badge: 'bg-gray-500 text-white' },
  yellow: { gradient: 'bg-gradient-to-br from-yellow-50 to-yellow-100', badge: 'bg-yellow-500 text-white' },
  rose: { gradient: 'bg-gradient-to-br from-rose-50 to-rose-100', badge: 'bg-rose-500 text-white' },
};

const CUSTOM_ICON_PATHS: Record<string, string> = {
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  code: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  megaphone: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  scale: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
  palette: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  bank: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z',
  music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  cloud: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  scissors: 'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
};

// Main component
export default function HomeDashboard({ userName: initialUserName }: HomeDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, tasksRes] = await Promise.all([
          apiFetch('/api/projects/me'),
          apiFetch('/api/tasks/my', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 20 }) }),
        ]);

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          // Map API response to component's expected format
          const mappedProjects: Project[] = (projectsData.data || []).map((p: {
            publicId: string;
            name: string;
            industry?: string;
            description?: string;
            coverImageUrl?: string;
            status?: string;
            role?: string;
            folderId?: string | null;
            lastVisitedAt?: string | null;
          }) => {
            const industryName = String(p.industry || '');
            const customIndustries = loadCustomIndustriesRaw();
            const customMatch = customIndustries.find((item) => toSlug(item.name) === toSlug(industryName));
            return {
            id: p.publicId,
            slug: p.publicId,
            name: p.name,
            description: p.description,
            thumbnail: p.coverImageUrl || '',
            lastVisited: p.lastVisitedAt ? new Date(p.lastVisitedAt).toISOString() : new Date().toISOString(),
            category: 'shared' as const,
            status: (p.status as Project['status']) || 'active',
            projectType: toSlug(industryName || 'software'),
            industryName,
            customIndustry: customMatch ? { icon: customMatch.iconId, color: customMatch.colorId } : undefined,
            isFavorite: false,
          };
          });
          setProjects(mappedProjects);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          // Map API response to component's expected format
          const mappedTasks: Task[] = (tasksData.data || []).map((t: {
            publicId?: string;
            _id?: string;
            title: string;
            projectName?: string;
            projectPublicId?: string;
            projectId?: string;
            dueDate: string;
            priority: 'high' | 'medium' | 'low';
          }) => ({
            id: t.publicId || t._id || '',
            title: t.title,
            project: t.projectName || 'Unknown Project',
            projectPublicId: t.projectPublicId || t.projectId || '',
            dueDate: t.dueDate,
            priority: t.priority,
          }));
          setTasks(mappedTasks);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
    // Priority: 1. Zustand store (populated by DashboardLayout), 2. localStorage fallback
    const storeAuth = useAppStore.getState().auth;
    if (storeAuth?.fullName) {
      setDisplayUserName(storeAuth.fullName);
      return;
    }
    const u = localStorage.getItem('orbit_user');
    if (u) {
      try { setDisplayUserName(JSON.parse(u).fullName || ''); } catch { /* ignore */ }
    }
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
          subtitle: `${t.project} - Due ${formatDate(t.dueDate)}`,
          href: t.projectPublicId ? `/projects/${t.projectPublicId}/tasks/${t.id}` : undefined,
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

  if (!isHydrated || loading) return <Skeleton />;

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
          {recentProjects.map((project) => {
            const typeKey = toSlug(project.projectType || project.industryName || '');
            const baseVisual = PROJECT_TYPE_VISUALS[typeKey];
            const customColor = project.customIndustry?.color ? CUSTOM_COLOR_VISUALS[project.customIndustry.color] : null;
            const customIconPath = project.customIndustry?.icon ? CUSTOM_ICON_PATHS[project.customIndustry.icon] : null;
            const visual = baseVisual || (customColor ? {
              gradient: customColor.gradient,
              badge: customColor.badge,
              iconPath: customIconPath || CUSTOM_ICON_PATHS.building,
            } : PROJECT_TYPE_VISUALS.default);
            return (
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
                  visual.gradient
                )}>
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    visual.badge
                  )}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={visual.iconPath} />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-foreground line-clamp-1">{project.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(project.lastVisited)}</p>
              </div>
            </a>
            );
          })}
        </div>
      </section>

      {/* Events and Tasks Grid - styled like Recently visited */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <section aria-label="Upcoming events" className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon />
              <h2 className="text-sm font-medium">Upcoming events</h2>
            </div>
          </div>
          <div className="flex flex-col gap-3" role="list" aria-label="Event list">
            {events.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center" role="listitem">
                <CalendarIcon />
                <p className="mt-2 text-sm text-muted-foreground">No upcoming events</p>
              </div>
            ) : (
              events.map((event) => (
                <div
                  role="listitem"
                  data-cursor-element-id={`event-item-${event.id}`}
                  key={event.id} 
                  className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <CalendarIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
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
        <section aria-label="Your tasks" className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TaskIcon />
              <h2 className="text-sm font-medium">Your tasks</h2>
            </div>
            <span className="text-xs text-muted-foreground">{pendingTasks} pending</span>
          </div>
          <div className="flex flex-col gap-3" role="list" aria-label="Task list">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center" role="listitem">
                <TaskIcon />
                <p className="mt-2 text-sm text-muted-foreground">No tasks</p>
              </div>
            ) : (
              [...tasks]
                .sort((a, b) => {
                  const isACompleted = completedTasks.has(a.id);
                  const isBCompleted = completedTasks.has(b.id);
                  if (isACompleted !== isBCompleted) return isACompleted ? 1 : -1;
                  const now = new Date().getTime();
                  const diffA = Math.abs(new Date(a.dueDate).getTime() - now);
                  const diffB = Math.abs(new Date(b.dueDate).getTime() - now);
                  return diffA - diffB;
                })
                .slice(0, 5)
                .map((task) => {
                const isCompleted = completedTasks.has(task.id);
                return (
                  <div 
                    role="listitem"
                    data-cursor-element-id={`task-item-${task.id}`}
                    key={task.id} 
                    onClick={() => window.location.href = `/projects/${task.projectPublicId}?tab=tasks`}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md cursor-pointer",
                      isCompleted && "opacity-60"
                    )}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
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
                        {task.project}{task.dueDate ? ` - ${formatDate(task.dueDate)}` : ''}
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
