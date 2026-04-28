'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { cn, getTodayLocalDateString, localDateStringToUTCDate } from '@/lib/utils';
import { apiFetch, uploadProjectThumbnail } from '@/lib/api-client';
import { toast } from '@/components/ui/sonner';
import type { Project } from '@/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PackagesManager from './PackagesManager';
import ProjectDocumentsManager from './ProjectDocumentsManager';
import ScopedTasksPanel from './ScopedTasksPanel';
import ScopedActivityPanel from './ScopedActivityPanel';
import ProjectTopBar from '@/components/layout/ProjectTopBar';
import ClashesTab from './clash/ClashesTab';
import { ClashViewerProvider } from './clash/state/clashStore';
import TeamsTab from './TeamsTab';
import ExtensionsTab from './ExtensionsTab';
import SettingsTab from './SettingsTab';
import ChangesTab from './ChangesTab';
import UploadApprovalPanel from './UploadApprovalPanel';
import type { WorkflowStage } from './TaskBoard';
import { getSocket } from '@/lib/socket';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const queryClient = new QueryClient();


interface ProjectDetailPageProps {
  project: {
    publicId: string;
    name: string;
    description?: string;
    industry?: string;
    coverImageUrl?: string;
    role?: string;
    status?: string;
    lastVisited?: string;
    isFavorite?: boolean;
  };
}

interface TeamMemberView {
  id: string;
  name: string;
  role: string;
  avatar: string;
  avatarUrl: string | null;
  color: string;
  isOnline: boolean;
}

const avatarColors = ['bg-pink-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500'];

const getInitials = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const mockTeamMembers: TeamMemberView[] = [];

interface Activity {
  id: string;
  type: string;
  icon: 'check' | 'alert' | 'upload' | 'edit';
  color: string;
  action: string;
  user: string;
  createdAt: string;
}

type ProjectMilestoneStatus = 'completed' | 'in-progress' | 'upcoming';

interface ProjectMilestone {
  id: string;
  name: string;
  dueDate: string;
  status: ProjectMilestoneStatus;
}

type OverviewProjectStatus = 'planning' | 'active' | 'accepted' | 'review' | 'paused' | 'completed';

interface OverviewEditableFields {
  status: OverviewProjectStatus;
  startDate: string;
  deadline: string;
}

// Document structure with nested folders and files
interface DocFile {
  id: string;
  name: string;
  type: 'file';
  category: string;
  size: string;
  updatedAt: string;
  author: string;
  starred?: boolean;
}

interface DocFolder {
  id: string;
  name: string;
  type: 'folder';
  children: (DocFolder | DocFile)[];
}

// Change requests data
interface ChangeRequest {
  publicId: string;
  crId: string;
  status: 'in-progress' | 'approved' | 'completed' | 'pending' | 'rejected';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedModels: string[];
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// Mock Tasks data
type TaskStatus = string;

interface Task {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: string;
  tags: string[];
  linkedItem?: { type: 'link'; name: string };
  comments: number;
  attachments: number;
  dueDate: string;
  assigneeId: string;
}



const taskColumns = [
  { id: 'backlog', label: 'Backlog', icon: 'circle' },
  { id: 'todo', label: 'To Do', icon: 'circle' },
  { id: 'in-progress', label: 'In Progress', icon: 'clock' },
  { id: 'review', label: 'Review', icon: 'clock' },
  { id: 'done', label: 'Done', icon: 'check' },
] as const;

// Mock versions data
interface Version {
  id: string;
  version: string;
  status: 'current' | 'approved' | 'pending' | 'rejected';
  filename: string;
  description: string;
  author: string;
  authorAvatar: string;
  authorColor: string;
  updatedAt: string;
  revisions: number;
  fileSize: string;
  discipline: string;
  format: string;
  reviewers: { name: string; avatar: string; color: string }[];
  changes: string[];
  affectedElements: string[];
}

const mockVersions: Version[] = [
  {
    id: '1',
    version: '5.0',
    status: 'current',
    filename: 'Platform_Level_B2.rvt',
    description: 'Updated platform edge doors and passenger safety barriers',
    author: 'Minh Anh',
    authorAvatar: 'MA',
    authorColor: 'bg-emerald-500',
    updatedAt: '3 hours ago',
    revisions: 12,
    fileSize: '45.2 MB',
    discipline: 'Architecture',
    format: 'Revit',
    reviewers: [
      { name: 'Hoang Nam', avatar: 'HN', color: 'bg-indigo-500' },
      { name: 'Thu Trang', avatar: 'TT', color: 'bg-blue-500' },
    ],
    changes: [
      'Updated platform edge door specifications to meet safety standards',
      'Added passenger safety barriers at platform edges',
      'Revised door control system integration',
      'Updated emergency release mechanisms',
    ],
    affectedElements: ['Doors', 'Safety Barriers', 'Control Systems', 'Emergency Equipment'],
  },
  {
    id: '2',
    version: '4.1',
    status: 'approved',
    filename: 'Tunnel_Structure_Section_A.ifc',
    description: 'Reinforced tunnel lining and waterproofing details',
    author: 'Nathan Reed',
    authorAvatar: 'NR',
    authorColor: 'bg-blue-500',
    updatedAt: '5 hours ago',
    revisions: 8,
    fileSize: '38.7 MB',
    discipline: 'Structure',
    format: 'IFC',
    reviewers: [
      { name: 'Minh Anh', avatar: 'MA', color: 'bg-emerald-500' },
    ],
    changes: [
      'Enhanced tunnel lining reinforcement',
      'Updated waterproofing membrane specifications',
      'Added drainage system details',
    ],
    affectedElements: ['Tunnel Lining', 'Waterproofing', 'Drainage'],
  },
  {
    id: '3',
    version: '3.8',
    status: 'approved',
    filename: 'MEP_Ventilation_System.rvt',
    description: 'Emergency ventilation and smoke extraction system optimization',
    author: 'Tuan Kiet',
    authorAvatar: 'TK',
    authorColor: 'bg-teal-500',
    updatedAt: '1 day ago',
    revisions: 15,
    fileSize: '52.1 MB',
    discipline: 'MEP',
    format: 'Revit',
    reviewers: [
      { name: 'Hoang Nam', avatar: 'HN', color: 'bg-indigo-500' },
      { name: 'Thu Trang', avatar: 'TT', color: 'bg-blue-500' },
    ],
    changes: [
      'Optimized smoke extraction fan capacity',
      'Updated emergency ventilation protocols',
      'Revised ductwork routing for efficiency',
    ],
    affectedElements: ['Ventilation', 'Smoke Extraction', 'Ductwork'],
  },
  {
    id: '4',
    version: '3.2',
    status: 'approved',
    filename: 'Station_Entrance_Concourse.rvt',
    description: 'Ticketing hall layout and fare gate positioning updated',
    author: 'Jacob Harris',
    authorAvatar: 'JH',
    authorColor: 'bg-purple-500',
    updatedAt: '2 days ago',
    revisions: 10,
    fileSize: '41.3 MB',
    discipline: 'Architecture',
    format: 'Revit',
    reviewers: [
      { name: 'Minh Anh', avatar: 'MA', color: 'bg-emerald-500' },
    ],
    changes: [
      'Reconfigured ticketing machine layout',
      'Updated fare gate positions for better flow',
      'Added accessibility improvements',
    ],
    affectedElements: ['Ticketing', 'Fare Gates', 'Accessibility'],
  },
  {
    id: '5',
    version: '2.9',
    status: 'approved',
    filename: 'Platform_Signage_System.rvt',
    description: 'Wayfinding and platform signage system updates',
    author: 'Thu Trang',
    authorAvatar: 'TT',
    authorColor: 'bg-blue-500',
    updatedAt: '3 days ago',
    revisions: 6,
    fileSize: '28.4 MB',
    discipline: 'Architecture',
    format: 'Revit',
    reviewers: [
      { name: 'Hoang Nam', avatar: 'HN', color: 'bg-indigo-500' },
    ],
    changes: [
      'Updated signage specifications',
      'Added multilingual support',
      'Improved visibility standards',
    ],
    affectedElements: ['Signage', 'Wayfinding', 'Lighting'],
  },
];

const mockDocuments: DocFolder = {
  id: 'root',
  name: 'All Files',
  type: 'folder',
  children: [
    {
      id: '1', name: 'Architecture', type: 'folder',
      children: [
        { id: '1-1', name: 'Floor Plans', type: 'folder', children: [] },
        { id: '1-2', name: 'Elevations', type: 'folder', children: [] },
        { id: '1-3', name: 'Sections', type: 'folder', children: [] },
        { id: '1-4', name: '3D Views', type: 'folder', children: [] },
        { id: '1-5', name: 'Architecture_Master_Model.rvt', type: 'file', category: 'Architecture', size: '412 MB', updatedAt: '1 hour ago', author: 'Minh Khoa', starred: true },
        { id: '1-6', name: 'Facade_Design_Final.rvt', type: 'file', category: 'Architecture', size: '189 MB', updatedAt: '5 hours ago', author: 'Thu Trang' },
        { id: '1-7', name: 'Interior_Layouts.rvt', type: 'file', category: 'Architecture', size: '156 MB', updatedAt: '2 days ago', author: 'Hoang Long' },
      ]
    },
    {
      id: '2', name: 'Structure', type: 'folder',
      children: [
        { id: '2-1', name: 'Structural_Calculations.pdf', type: 'file', category: 'Structure', size: '2.4 MB', updatedAt: '2 hours ago', author: 'Minh Anh' },
        { id: '2-2', name: 'Foundation_Plan.dwg', type: 'file', category: 'Structure', size: '5.1 MB', updatedAt: '5 hours ago', author: 'Hoang Nam' },
      ]
    },
    {
      id: '3', name: 'MEP', type: 'folder',
      children: [
        { id: '3-1', name: 'HVAC Systems', type: 'folder', children: [] },
        { id: '3-2', name: 'Electrical', type: 'folder', children: [] },
        { id: '3-3', name: 'Plumbing', type: 'folder', children: [] },
      ]
    },
    { id: '4', name: 'Coordination', type: 'folder', children: [] },
    { id: '5', name: 'Drawings', type: 'folder', children: [] },
    { id: '6', name: 'Reports', type: 'folder', children: [] },
    { id: '7', name: 'Specifications', type: 'folder', children: [] },
  ]
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
  { id: 'settings', label: 'Settings' },
];

// Icons
const StarIcon = ({ filled = false, className = '' }: { filled?: boolean; className?: string }) => (
  <svg className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const ShareIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

const MoreIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
);

const ClockIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const Cube3DIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

function ProjectDetailPageContent({ project }: ProjectDetailPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isFavorite, setIsFavorite] = useState(project.isFavorite || false);
  const [projectCoverImageUrl, setProjectCoverImageUrl] = useState(project.coverImageUrl || '');
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberView[]>([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [clashCount, setClashCount] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [activitiesVersion, setActivitiesVersion] = useState(0); // Increment to trigger refresh
  const [settingsUpdated, setSettingsUpdated] = useState(0);
  const [dynamicProgress, setDynamicProgress] = useState<number | null>(null);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [newMilestoneStatus, setNewMilestoneStatus] = useState<ProjectMilestoneStatus>('upcoming');
  const [editingDateMilestoneId, setEditingDateMilestoneId] = useState<string | null>(null);
  const [editingStatusMilestoneId, setEditingStatusMilestoneId] = useState<string | null>(null);
  const [overviewEditable, setOverviewEditable] = useState<OverviewEditableFields>({
    status: ((project.status || 'accepted').toLowerCase() as OverviewProjectStatus),
    startDate: '2024-01-15',
    deadline: '2025-12-15',
  });
  const [isEditingOverviewStatus, setIsEditingOverviewStatus] = useState(false);
  const [isEditingOverviewStartDate, setIsEditingOverviewStartDate] = useState(false);
  const [isEditingOverviewDeadline, setIsEditingOverviewDeadline] = useState(false);
  const isMounted = useRef(true);
  const coverUploadInputRef = useRef<HTMLInputElement | null>(null);
  const canEditProjectCover = project.role === 'owner' || project.role === 'admin';

  // Compute effective progress: dynamic (from API) overrides the SSR prop
  const effectiveProgress = dynamicProgress !== null ? dynamicProgress : project.progress;

  // Fetch project progress from /api/projects/me and listen for real-time task changes
  useEffect(() => {
    isMounted.current = true;
    let cancelled = false;

    const fetchProjectProgress = async () => {
      try {
        const res = await apiFetch('/api/projects/me');
        if (!res.ok || cancelled) return;
        const payload = await res.json();
        if (cancelled) return;
        const projects = Array.isArray(payload?.data) ? payload.data : [];
        const current = projects.find(
          (p: any) => String(p.publicId) === String(project.publicId)
        );
        if (current && typeof current.progress === 'number' && isMounted.current) {
          setDynamicProgress(current.progress);
        }
      } catch { /* silent */ }
    };

    fetchProjectProgress();

    const socket = getSocket();
    const handleTaskCountChanged = (data: { projectId: string }) => {
      if (data.projectId !== project.publicId) return;
      fetchProjectProgress();
    };

    socket.on('package:task-count-changed', handleTaskCountChanged);
    socket.emit('project:join', { projectId: project.publicId });

    return () => {
      isMounted.current = false;
      cancelled = true;
      socket.off('package:task-count-changed', handleTaskCountChanged);
      socket.emit('project:leave', { projectId: project.publicId });
    };
  }, [project.publicId]);

  // Fetch real team members + documents count + clash count from backend API
  useEffect(() => {
    let cancelled = false;

    const fetchProjectOverviewData = async () => {
      try {
        const [membersRes, documentsRes, touchRes, clashCountRes, activitiesRes] = await Promise.all([
          fetch('/api/projects/member-list', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: project.publicId }),
          }),
          fetch('/api/projects/packages/documents/list', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: project.publicId }),
          }),
          fetch('/api/projects/touch', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: project.publicId }),
          }),
          apiFetch(`/api/projects/${project.publicId}/navisworks/clashes/count`),
          apiFetch(`/api/projects/${project.publicId}/activities`),
        ]);

        if (membersRes.ok) {
          const payload = await membersRes.json();
          const members = Array.isArray(payload?.data) ? payload.data : [];
          const mappedMembers: TeamMemberView[] = members.map((m: any, index: number) => {
            const name = m?.user?.fullName || m?.user?.name || m?.user?.email || 'Unknown';
            return {
              id: m?.userId || String(index),
              name,
              role: m?.role || 'member',
              avatar: getInitials(name),
              avatarUrl: m?.user?.avatar || null,
              color: avatarColors[index % avatarColors.length],
              isOnline: m?.status === 'accepted',
            };
          });

          if (!cancelled) {
            setTeamMembers(mappedMembers);
            // Update isFavorite from API response
            if (payload?.isFavorite !== undefined) {
              setIsFavorite(payload.isFavorite === true);
            }
          }
        }

        if (documentsRes.ok) {
          const payload = await documentsRes.json();
          const total = Number(payload?.data?.total || 0);
          if (!cancelled) {
            setDocumentsCount(Number.isFinite(total) ? total : 0);
          }
        }

        if (clashCountRes.ok) {
          const payload = await clashCountRes.json();
          if (!cancelled) {
            setClashCount(payload?.total || 0);
          }
        }

        if (activitiesRes.ok) {
          const payload = await activitiesRes.json();
          if (!cancelled) {
            const raw = Array.isArray(payload?.data) ? payload.data : [];
            const sorted = [...raw].sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return isNaN(dateA) || isNaN(dateB) ? 0 : dateB - dateA;
            });
            setActivities(sorted.slice(0, 5));
            // Prefer projectUpdatedAt when available (real project update timestamp)
            setLastActivity(payload?.projectUpdatedAt || payload?.lastActivity || null);
          }
        }
        if (!cancelled) setLoadingActivities(false);
      } catch {
        // Keep default values on error
        if (!cancelled) setLoadingActivities(false);
      }
    };

    fetchProjectOverviewData();
    return () => { cancelled = true; };
  }, [project.publicId, settingsUpdated, activitiesVersion]);
  
  // Handle settings updated - refresh last activity timestamp
  const handleSettingsUpdated = () => {
    setSettingsUpdated(prev => prev + 1);
  };

  const milestoneStorageKey = `orbit-project-milestones:${project.publicId}`;
  const overviewStorageKey = `orbit-project-overview:${project.publicId}`;

  const normalizedStatus = (rawStatus?: string): OverviewProjectStatus => {
    const value = String(rawStatus || '').toLowerCase();
    if (value === 'planning' || value === 'active' || value === 'accepted' || value === 'review' || value === 'paused' || value === 'completed') {
      return value;
    }
    return 'accepted';
  };

  useEffect(() => {
    try {
      const storedMilestones = localStorage.getItem(milestoneStorageKey);
      if (!storedMilestones) {
        setProjectMilestones([]);
        return;
      }
      const parsed = JSON.parse(storedMilestones);
      if (Array.isArray(parsed)) {
        const normalized = parsed.filter((item: any) =>
          typeof item?.id === 'string'
          && typeof item?.name === 'string'
          && typeof item?.dueDate === 'string'
          && (item?.status === 'completed' || item?.status === 'in-progress' || item?.status === 'upcoming')
        );
        setProjectMilestones(normalized);
      } else {
        setProjectMilestones([]);
      }
    } catch {
      setProjectMilestones([]);
    }
  }, [milestoneStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(milestoneStorageKey, JSON.stringify(projectMilestones));
    } catch {
      // Ignore localStorage write failures
    }
  }, [milestoneStorageKey, projectMilestones]);

  useEffect(() => {
    try {
      const rawStored = localStorage.getItem(overviewStorageKey);
      if (!rawStored) {
        setOverviewEditable({
          status: normalizedStatus(project.status),
          startDate: '2024-01-15',
          deadline: '2025-12-15',
        });
        return;
      }
      const parsed = JSON.parse(rawStored);
      setOverviewEditable({
        status: normalizedStatus(parsed?.status || project.status),
        startDate: typeof parsed?.startDate === 'string' ? parsed.startDate : '2024-01-15',
        deadline: typeof parsed?.deadline === 'string' ? parsed.deadline : '2025-12-15',
      });
    } catch {
      setOverviewEditable({
        status: normalizedStatus(project.status),
        startDate: '2024-01-15',
        deadline: '2025-12-15',
      });
    }
  }, [overviewStorageKey, project.status]);

  useEffect(() => {
    try {
      localStorage.setItem(overviewStorageKey, JSON.stringify(overviewEditable));
    } catch {
      // Ignore localStorage write failures
    }
  }, [overviewStorageKey, overviewEditable]);

  const resetMilestoneDraft = () => {
    setNewMilestoneName('');
    setNewMilestoneDueDate('');
    setNewMilestoneStatus('upcoming');
  };

  const handleAddMilestone = () => {
    const trimmedName = newMilestoneName.trim();
    if (!trimmedName) {
      toast.error('Milestone name is required');
      return;
    }
    if (!newMilestoneDueDate) {
      toast.error('Milestone date is required');
      return;
    }

    const createdMilestone: ProjectMilestone = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      dueDate: newMilestoneDueDate,
      status: newMilestoneStatus,
    };

    setProjectMilestones(prev => [...prev, createdMilestone]);
    resetMilestoneDraft();
    setIsAddingMilestone(false);
    toast.success('Milestone added');
  };

  const updateMilestone = (milestoneId: string, updates: Partial<ProjectMilestone>) => {
    setProjectMilestones(prev =>
      prev.map(milestone =>
        milestone.id === milestoneId ? { ...milestone, ...updates } : milestone
      )
    );
  };

  const handleHeroOverlayClick = () => {
    if (!canEditProjectCover || isUploadingCoverImage) return;
    coverUploadInputRef.current?.click();
  };

  const handleHeroCoverFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    if (!canEditProjectCover) {
      toast.error('You do not have permission to update project background');
      return;
    }

    setIsUploadingCoverImage(true);
    try {
      const uploadedUrl = await uploadProjectThumbnail(project.publicId, file);
      setProjectCoverImageUrl(uploadedUrl);
      toast.success('Project background updated');
    } catch {
      toast.error('Failed to update project background');
    } finally {
      setIsUploadingCoverImage(false);
    }
  };
  
  // Check for stored tab on mount (used when navigating back from package detail)
  // Also check URL search params for tab navigation (e.g. from notification links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab && tabs.some(t => t.id === urlTab)) {
      setActiveTab(urlTab);
      params.delete('tab');
      const newSearch = params.toString();
      window.history.replaceState({}, '', newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname);
      return;
    }
    const storedTab = sessionStorage.getItem('projectActiveTab');
    if (storedTab) {
      setActiveTab(storedTab);
      sessionStorage.removeItem('projectActiveTab');
    }
  }, []);

  // Fetch change requests when 'changes' tab is active
  useEffect(() => {
    if (activeTab !== 'changes') return;
    let cancelled = false;

    // Helper to extract IFC files from tree structure
    const extractIfcFiles = (nodes: any[]): { id: string; name: string }[] => {
      const files: { id: string; name: string }[] = [];
      for (const node of nodes) {
        if (node.type === 'file' && node.isIfc) {
          files.push({ id: node.id, name: node.name });
        }
        if (node.children && Array.isArray(node.children)) {
          files.push(...extractIfcFiles(node.children));
        }
      }
      return files;
    };

    // Check localStorage cache first
    const cacheKey = `orbit-ifc-files-${project.publicId}`;
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(`${cacheKey}-time`);
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    const loadIfcFiles = async () => {
      const res = await apiFetch(`/api/projects/packages/documents/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.publicId, includePackages: true }),
      });

      if (res.ok) {
        const payload = await res.json();
        const tree = payload?.data?.tree;
        if (tree && !cancelled) {
          const ifcFiles = extractIfcFiles(tree.children || []);
          setAvailableIfcFiles(ifcFiles);
          // Cache the result
          localStorage.setItem(cacheKey, JSON.stringify(ifcFiles));
          localStorage.setItem(`${cacheKey}-time`, String(Date.now()));
        }
      }
    };

    const fetchChangeRequests = async () => {
      setIsLoadingChangeRequests(true);
      setIsLoadingIfcFiles(true);
      try {
        // Load change requests
        const crRes = await apiFetch(`/api/projects/${project.publicId}/change-requests`);
        if (crRes.ok && !cancelled) {
          const payload = await crRes.json();
          setChangeRequests(payload.data || []);
        }

        // Load IFC files from cache or API
        if (cachedData && cachedTime && Date.now() - Number(cachedTime) < cacheExpiry) {
          try {
            setAvailableIfcFiles(JSON.parse(cachedData));
          } catch {
            await loadIfcFiles();
          }
        } else {
          await loadIfcFiles();
        }
      } catch {
        // Keep empty state on error
      } finally {
        if (!cancelled) {
          setIsLoadingChangeRequests(false);
          setIsLoadingIfcFiles(false);
        }
      }
    };

    fetchChangeRequests();
    return () => { cancelled = true; };
  }, [activeTab, project.publicId]);

  const handleCreateChangeRequest = async () => {
    if (!newRequestTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const res = await apiFetch(`/api/projects/${project.publicId}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRequestTitle,
          description: newRequestDescription,
          detailedDescription: newRequestDetailedDescription,
          priority: newRequestPriority,
          affectedModels: newRequestAffectedModels,
          assignees: newRequestAssignees,
          reviewers: newRequestReviewers,
          discipline: newRequestDiscipline,
          deadline: newRequestDeadline ? localDateStringToUTCDate(newRequestDeadline) : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Change request created');
        setIsNewRequestModalOpen(false);
        setNewRequestTitle('');
        setNewRequestDescription('');
        setNewRequestDetailedDescription('');
        setNewRequestPriority('medium');
        setNewRequestAffectedModels([]);
        setNewRequestAssignees([]);
        setNewRequestReviewers([]);
        setNewRequestAttachments([]);
        setNewRequestDiscipline('');
        setNewRequestDeadline('');
        // Refresh list
        const crRes = await apiFetch(`/api/projects/${project.publicId}/change-requests`);
        if (crRes.ok) {
          const payload = await crRes.json();
          setChangeRequests(payload.data || []);
        }
        // Refresh activities
        setActivitiesVersion(v => v + 1);
      } else {
        toast.error(data.message || 'Failed to create change request');
      }
    } catch {
      toast.error('Failed to create change request');
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 50MB limit`);
        return false;
      }
      return true;
    });
    setNewRequestAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setNewRequestAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  const [docViewMode, setDocViewMode] = useState<'list' | 'grid'>('list');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>(['root']);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [isVersionDetailOpen, setIsVersionDetailOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [baseVersion, setBaseVersion] = useState<string>('');
  const [compareVersion, setCompareVersion] = useState<string>('');
  const [isCompareResultOpen, setIsCompareResultOpen] = useState(false);
  const [crFilter, setCrFilter] = useState<'all' | 'pending' | 'in-progress'>('all');
  const [crSearchQuery, setCrSearchQuery] = useState('');
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [isLoadingChangeRequests, setIsLoadingChangeRequests] = useState(false);
  const [availableIfcFiles, setAvailableIfcFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingIfcFiles, setIsLoadingIfcFiles] = useState(false);
  const [newRequestDetailedDescription, setNewRequestDetailedDescription] = useState('');
  const [newRequestAssignees, setNewRequestAssignees] = useState<string[]>([]);
  const [newRequestReviewers, setNewRequestReviewers] = useState<string[]>([]);
  const [newRequestAttachments, setNewRequestAttachments] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [newRequestDiscipline, setNewRequestDiscipline] = useState('');
  const [newRequestDeadline, setNewRequestDeadline] = useState('');
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newRequestTitle, setNewRequestTitle] = useState('');
  const [newRequestDescription, setNewRequestDescription] = useState('');
  const [newRequestPriority, setNewRequestPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newRequestAffectedModels, setNewRequestAffectedModels] = useState<string[]>([]);
  const [tasksViewMode, setTasksViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [tasksSearchQuery, setTasksSearchQuery] = useState('');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [pendingTaskStageId, setPendingTaskStageId] = useState<string | undefined>(undefined);
  const [tasksData, setTasksData] = useState<Task[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [projectTaskTags, setProjectTaskTags] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedWorkflowStages, setSelectedWorkflowStages] = useState<WorkflowStage[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  // Get current folder based on path
  const getCurrentFolder = (): DocFolder => {
    let current: DocFolder = mockDocuments;
    for (let i = 1; i < currentPath.length; i++) {
      const found = current.children.find(c => c.id === currentPath[i] && c.type === 'folder');
      if (found && found.type === 'folder') {
        current = found;
      }
    }
    return current;
  };

  const currentFolder = getCurrentFolder();
  
  // Get breadcrumb items
  const getBreadcrumbs = (): { id: string; name: string }[] => {
    const crumbs: { id: string; name: string }[] = [{ id: 'root', name: 'All Files' }];
    let current: DocFolder = mockDocuments;
    for (let i = 1; i < currentPath.length; i++) {
      const found = current.children.find(c => c.id === currentPath[i] && c.type === 'folder');
      if (found && found.type === 'folder') {
        crumbs.push({ id: found.id, name: found.name });
        current = found;
      }
    }
    return crumbs;
  };

  const navigateToFolder = (folderId: string) => {
    if (folderId === 'root') {
      setCurrentPath(['root']);
    } else {
      setCurrentPath([...currentPath, folderId]);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const filteredItems = currentFolder.children.filter(item =>
    item.name.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'review': return 'bg-amber-500';
      case 'planning': return 'bg-gray-500';
      case 'paused': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getProjectTypeIcon = () => {
    switch (project.projectType) {
      case 'software':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />;
      case 'design':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />;
      case 'construction':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />;
      case 'research':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />;
      default:
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />;
    }
  };

  const loadProjectTasks = useCallback(async () => {
    setIsTasksLoading(true);
    try {
      const response = await apiFetch('/api/tasks/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId: project.publicId }),
      });

      // Tasks API is not ready yet in backend/frontend proxy; keep UI stable without crashing.
      if (response.status === 404) {
        setTasksData([]);
        return;
      }

      if (!response.ok) {
        setTasksData([]);
        return;
      }

      const payload = await response.json();
      const rawTasks = Array.isArray(payload?.data) ? payload.data : [];

      const mapped: Task[] = rawTasks.map((t: any) => ({
        id: String(t.publicId || t.id || ''),
        title: String(t.title || 'Untitled task'),
        priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium') as Task['priority'],
        status: String(t.status || 'backlog'),
        tags: Array.isArray(t.tags) ? t.tags : [],
        linkedItem: t.linkedUrl ? { type: 'link', name: t.linkedUrl } : undefined,
        comments: Number(t.commentsCount || 0),
        attachments: Number(t.attachmentsCount || 0),
        dueDate: t.dueDate || '',
        assigneeId: String(t.assigneeId || ''),
      }));

      setTasksData(mapped);
    } catch {
      setTasksData([]);
    } finally {
      setIsTasksLoading(false);
    }
  }, [project.publicId]);

  useEffect(() => {
    if (activeTab !== 'tasks') return;
    loadProjectTasks();
  }, [activeTab, loadProjectTasks]);

  const handleTaskStatusChange = useCallback((taskId: string, newStatus: string) => {
    setTasksData(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
    // TODO: sync with backend API when ready
  }, []);

  const filteredTasks = useMemo(
    () => tasksData.filter((t) => t.title.toLowerCase().includes(tasksSearchQuery.toLowerCase())),
    [tasksData, tasksSearchQuery]
  );

  useEffect(() => {
    let cancelled = false;

    const loadProjectWorkflowData = async () => {
      try {
        const res = await apiFetch('/api/projects/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId: project.publicId }),
        });

        if (!res.ok) return;

        const payload = await res.json();
        const data = payload?.data || {};
        
        // Load task tags
        const tags = Array.isArray(data.taskTags) ? data.taskTags : [];
        if (!cancelled) {
          setProjectTaskTags(tags.map((t: any) => String(t?.name || '').toLowerCase()).filter(Boolean));
        }
        
        // Load workflow stages and template ID
        if (!cancelled) {
          const stages = Array.isArray(data.stages) ? data.stages : [];
          if (stages.length > 0) {
            setSelectedWorkflowStages(stages.map((s: any) => ({
              id: String(s.id || ''),
              name: String(s.label || s.name || ''),
              description: String(s.description || ''),
            })));
          }
          // Set workflow template ID if available
          if (data.workflowTemplateId) {
            setSelectedWorkflowId(data.workflowTemplateId);
          }
        }
      } catch {
        // keep empty => CreateTaskModal fallback handles it
      }
    };

    loadProjectWorkflowData();
    return () => {
      cancelled = true;
    };
  }, [project.publicId]);

  // Mock extended data
  const projectStats = {
    documents: documentsCount,
    versions: 124,
    teamMembers: teamMembers.length,
    openClashes: clashCount,
    startDate: formatDate(overviewEditable.startDate),
    deadline: formatDate(overviewEditable.deadline),
  };

  const visibleTeamMembers = teamMembers.slice(0, 3);
  const hiddenTeamMembers = teamMembers.slice(3);

  return (
    <div className="min-h-screen bg-background pt-[105px]">
      {/* Project Top Bar with Navigation - Fixed */}
      <ProjectTopBar
        projectName={project.name}
        projectSlug={project.publicId}
        activeTab={activeTab}
        isFavorite={isFavorite}
        onTabChange={setActiveTab}
        onFavoriteChange={setIsFavorite}
        projectRole={project.role as 'owner' | 'admin' | 'member' | 'viewer'}
      />

      {/* Hero Section - Only show on Overview tab */}
      {activeTab === 'overview' && (
        <div className="group relative h-52 flex items-end overflow-hidden">
          {/* Background Image - Use coverImageUrl from API */}
          {projectCoverImageUrl ? (
            <img
              src={projectCoverImageUrl}
              alt={project.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className={cn(
              "absolute inset-0",
              project.industry === 'software' && "bg-gradient-to-r from-indigo-600 to-blue-600",
              project.industry === 'design' && "bg-gradient-to-r from-purple-600 to-pink-600",
              project.industry === 'construction' && "bg-gradient-to-r from-slate-700 to-slate-900",
              project.industry === 'research' && "bg-gradient-to-r from-teal-600 to-emerald-600",
              !project.industry && "bg-gradient-to-r from-gray-600 to-gray-800"
            )}>
              {/* Background pattern overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
            </div>
          )}
          
          {/* Dark overlay for text readability */}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent",
              canEditProjectCover && !isUploadingCoverImage && "cursor-pointer"
            )}
            onClick={handleHeroOverlayClick}
            role={canEditProjectCover ? 'button' : undefined}
            aria-label={canEditProjectCover ? 'Upload project background' : undefined}
            title={canEditProjectCover ? 'Click to upload project background' : undefined}
          />

          <input
            ref={coverUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleHeroCoverFileChange}
          />

          {canEditProjectCover && (
            <button
              type="button"
              onClick={handleHeroOverlayClick}
              className={cn(
                "absolute bottom-3 right-3 z-20 inline-flex items-center gap-1 rounded-md border border-white/30 bg-black/45 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-sm transition",
                "opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/60 active:scale-[0.98]",
                isUploadingCoverImage && "cursor-not-allowed opacity-100"
              )}
              disabled={isUploadingCoverImage}
              title="Upload project background"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V8m0 0l-3 3m3-3l3 3M5 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9" />
              </svg>
              {isUploadingCoverImage ? 'Uploading...' : 'Upload'}
            </button>
          )}
          
          <div className="relative w-full px-[100px] pb-6">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
              <ClockIcon className="h-4 w-4" />
              <span>Last updated {lastActivity ? formatRelativeTime(lastActivity) : project.lastVisited ? formatRelativeTime(project.lastVisited) : 'recently'}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{project.name}</h1>
            <p className="text-white/80">{project.description}</p>
          </div>
        </div>
      )}

      {/* Content - With 300px left/right margins */}
      <div className="px-[100px] py-6">
        {/* Packages Tab Content */}
        {activeTab === 'packages' && (
          <PackagesManager fixedProjectId={project.publicId} fixedProjectName={project.name} />
        )}

{/* Overview Tab Content */}
  {activeTab === 'overview' && (
  <div className="py-6 px-6 lg:px-[80px] xl:px-[160px]">
  {/* Stats Row */}
  <div className="grid grid-cols-4 gap-4 rounded-xl border border-gray-200 bg-white p-4 mb-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
            {isEditingOverviewStatus ? (
              <select
                value={overviewEditable.status}
                autoFocus
                onChange={(e) => setOverviewEditable(prev => ({ ...prev, status: e.target.value as OverviewProjectStatus }))}
                onBlur={() => setIsEditingOverviewStatus(false)}
                className="mt-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-foreground outline-none focus:border-indigo-400"
              >
                <option value="planning">planning</option>
                <option value="active">active</option>
                <option value="accepted">accepted</option>
                <option value="review">review</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
              </select>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingOverviewStatus(true)}
                className={cn(
                  "mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium text-white capitalize transition hover:opacity-90 active:scale-[0.98]",
                  getStatusColor(overviewEditable.status)
                )}
                title="Click to edit status"
              >
                {overviewEditable.status}
              </button>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${effectiveProgress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground">{effectiveProgress}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</p>
            {isEditingOverviewStartDate ? (
              <input
                type="date"
                value={overviewEditable.startDate}
                autoFocus
                onChange={(e) => setOverviewEditable(prev => ({ ...prev, startDate: e.target.value }))}
                onBlur={() => setIsEditingOverviewStartDate(false)}
                className="mt-1 w-full max-w-[140px] rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-indigo-400"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingOverviewStartDate(true)}
                className="mt-1 rounded px-1 text-sm font-medium text-foreground transition hover:bg-gray-100 active:scale-[0.98]"
                title="Click to edit start date"
              >
                {projectStats.startDate}
              </button>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deadline</p>
            {isEditingOverviewDeadline ? (
              <input
                type="date"
                value={overviewEditable.deadline}
                autoFocus
                onChange={(e) => setOverviewEditable(prev => ({ ...prev, deadline: e.target.value }))}
                onBlur={() => setIsEditingOverviewDeadline(false)}
                className="mt-1 w-full max-w-[140px] rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-indigo-400"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingOverviewDeadline(true)}
                className="mt-1 rounded px-1 text-sm font-medium text-foreground transition hover:bg-gray-100 active:scale-[0.98]"
                title="Click to edit deadline"
              >
                {projectStats.deadline}
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{projectStats.documents}</p>
              <p className="text-sm text-muted-foreground">Documents</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{projectStats.versions}</p>
              <p className="text-sm text-muted-foreground">Versions</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{projectStats.teamMembers}</p>
              <p className="text-sm text-muted-foreground">Team Members</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{projectStats.openClashes}</p>
              <p className="text-sm text-muted-foreground">Open Clashes</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-2 items-stretch gap-6">
          {/* Team Members */}
          <div className="flex h-[300px] flex-col rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="font-semibold text-foreground">Team members</h3>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
              {visibleTeamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="relative">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="flex h-10 w-10 items-center justify-center rounded-full object-cover text-sm font-medium text-white" />
                    ) : (
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white", member.color)}>
                        {member.avatar}
                      </div>
                    )}
                    {member.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </div>
              ))}

              {hiddenTeamMembers.length > 0 && (
                <details className="group rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
                    +{hiddenTeamMembers.length} more members
                  </summary>
                  <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
                    {hiddenTeamMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <div className="relative">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.name} className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white", member.color)}>
                              {member.avatar}
                            </div>
                          )}
                          {member.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">{member.name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="flex h-[300px] flex-col rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-semibold text-foreground">Recent activity</h3>
            </div>

            {loadingActivities ? (
              <div className="flex h-full items-center justify-center">
                <svg className="h-6 w-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
                  <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload documents or create change requests to see activity here</p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", activity.color)}>
                      {activity.icon === 'check' && (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {activity.icon === 'alert' && (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      {activity.icon === 'upload' && (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                      {activity.icon === 'edit' && (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="truncate text-sm font-medium text-foreground">{activity.action}</p>
                      <p className="truncate text-xs text-muted-foreground">{activity.user} • {formatRelativeTime(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Project Milestones */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="font-semibold text-foreground">Project milestones</h3>
            </div>
            {!isAddingMilestone && (
              <button
                type="button"
                onClick={() => setIsAddingMilestone(true)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <span className="text-sm leading-none">+</span>
                Add
              </button>
            )}
          </div>

          {isAddingMilestone && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
              <div className="space-y-2">
                <input
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  placeholder="Milestone name"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newMilestoneDueDate}
                    onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                  <select
                    value={newMilestoneStatus}
                    onChange={(e) => setNewMilestoneStatus(e.target.value as ProjectMilestoneStatus)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="in-progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetMilestoneDraft();
                      setIsAddingMilestone(false);
                    }}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {projectMilestones.length > 0 ? (
            <div className="space-y-3">
              {projectMilestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="group flex items-center gap-4 rounded-md border-b border-gray-100 px-2 py-2 transition-colors hover:bg-gray-50/80 last:border-0"
                >
                  <div className={cn(
                    "h-3 w-3 rounded-full",
                    milestone.status === 'completed' && "bg-emerald-500",
                    milestone.status === 'in-progress' && "bg-indigo-500",
                    milestone.status === 'upcoming' && "bg-gray-300"
                  )} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{milestone.name}</p>
                    {editingDateMilestoneId === milestone.id ? (
                      <input
                        type="date"
                        value={milestone.dueDate}
                        autoFocus
                        onChange={(e) => updateMilestone(milestone.id, { dueDate: e.target.value })}
                        onBlur={() => setEditingDateMilestoneId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            setEditingDateMilestoneId(null);
                          }
                        }}
                        className="mt-1 w-[145px] rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-muted-foreground outline-none focus:border-indigo-400"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingDateMilestoneId(milestone.id)}
                        className="mt-1 rounded px-1 text-left text-xs text-muted-foreground transition hover:bg-gray-100 hover:text-gray-700 active:scale-[0.98]"
                        title="Click to edit date"
                      >
                        {new Date(`${milestone.dueDate}T00:00:00`).toLocaleDateString()}
                      </button>
                    )}
                  </div>
                  {editingStatusMilestoneId === milestone.id ? (
                    <select
                      value={milestone.status}
                      autoFocus
                      onChange={(e) => updateMilestone(milestone.id, { status: e.target.value as ProjectMilestoneStatus })}
                      onBlur={() => setEditingStatusMilestoneId(null)}
                      className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 outline-none focus:border-indigo-400"
                    >
                      <option value="upcoming">upcoming</option>
                      <option value="in-progress">in progress</option>
                      <option value="completed">completed</option>
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingStatusMilestoneId(milestone.id)}
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium transition hover:opacity-90 active:scale-[0.97]",
                        milestone.status === 'completed' && "bg-emerald-100 text-emerald-700",
                        milestone.status === 'in-progress' && "bg-indigo-100 text-indigo-700",
                        milestone.status === 'upcoming' && "bg-gray-100 text-gray-600"
                      )}
                      title="Click to edit status"
                    >
                      {milestone.status === 'completed' ? 'completed' : milestone.status === 'in-progress' ? 'in progress' : 'upcoming'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No milestones yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Milestones will appear here after users add them when creating or updating the project.
              </p>
            </div>
          )}
        </div>
        </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <ProjectDocumentsManager projectId={project.publicId} />
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <UploadApprovalPanel projectId={project.publicId} projectRole={project.role as 'owner' | 'admin' | 'member' | 'viewer'} />
        )}
        {/* Changes Tab */}
        {activeTab === 'changes' && (
          <ChangesTab projectPublicId={project.publicId} onActivityAdded={() => setActivitiesVersion(v => v + 1)} />
        )}
        {activeTab === 'changes_DISABLED_INLINE' && (
          <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
            {/* Header */}
            <div className="flex items-center justify-between">
<div>
            <h2 className="text-[24px] font-normal text-[#101828]">Change Requests</h2>
          </div>
              <button 
                onClick={() => setIsNewRequestModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Request
              </button>
            </div>

            {/* Filters and Search */}
            <div className="flex items-center gap-4">
              {/* Filter tabs */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCrFilter('all')}
                  className={cn(
                    "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
                    crFilter === 'all' 
                      ? "bg-[#F0F9FF] text-[#0069A8]" 
                      : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setCrFilter('pending')}
                  className={cn(
                    "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
                    crFilter === 'pending' 
                      ? "bg-[#F0F9FF] text-[#0069A8]" 
                      : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
                  )}
                >
                  Pending
                </button>
                <button
                  onClick={() => setCrFilter('in-progress')}
                  className={cn(
                    "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
                    crFilter === 'in-progress' 
                      ? "bg-[#F0F9FF] text-[#0069A8]" 
                      : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
                  )}
                >
                  In Progress
                </button>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search change requests..."
                  value={crSearchQuery}
                  onChange={(e) => setCrSearchQuery(e.target.value)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Change Requests List */}
            <div className="rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden">
              {isLoadingChangeRequests ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : changeRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-[#6A7282]">No change requests yet</p>
                  <p className="text-[12px] text-[#9CA3AF] mt-1">Create your first change request</p>
                </div>
              ) : (
                changeRequests
                  .filter(cr => {
                    if (crFilter === 'pending') return cr.status === 'pending';
                    if (crFilter === 'in-progress') return cr.status === 'in-progress';
                    return true;
                  })
                  .filter(cr =>
                    cr.title.toLowerCase().includes(crSearchQuery.toLowerCase()) ||
                    cr.crId.toLowerCase().includes(crSearchQuery.toLowerCase()) ||
                    cr.description.toLowerCase().includes(crSearchQuery.toLowerCase())
                  )
                  .map((cr, index, arr) => (
                    <div
                      key={cr.publicId}
                      className={cn(
                        "flex items-start gap-4 px-6 py-6",
                        index !== arr.length - 1 && "border-b border-[#E5E7EB]"
                      )}
                    >
                      {/* Icon - Document with edit */}
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-[10px] shrink-0",
                        (cr.status === 'in-progress' || cr.status === 'pending') && "bg-[#EEF2FF]",
                        (cr.status === 'approved' || cr.status === 'completed') && "bg-[#ECFDF5]"
                      )}>
                        <svg
                          className="h-6 w-6"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12.659 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8.00001C20.0008 7.68312 19.9388 7.36921 19.8176 7.0764C19.6964 6.78359 19.5185 6.51768 19.294 6.29401L15.706 2.70601C15.4823 2.48153 15.2164 2.30357 14.9236 2.18239C14.6308 2.06122 14.3169 1.99923 14 2.00001H6C5.46957 2.00001 4.96086 2.21072 4.58579 2.58579C4.21071 2.96087 4 3.46957 4 4.00001V13.34"
                            stroke={(cr.status === 'in-progress' || cr.status === 'pending') ? "#4F39F6" : "#009966"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M14 2V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H20"
                            stroke={(cr.status === 'in-progress' || cr.status === 'pending') ? "#4F39F6" : "#009966"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10.378 12.6219C10.7762 12.224 11.3162 12.0007 11.8791 12.001C12.442 12.0013 12.9817 12.2251 13.3795 12.6234C13.7773 13.0216 14.0007 13.5615 14.0004 14.1244C14.0001 14.6873 13.7762 15.227 13.378 15.6249L8.36002 20.6369C8.1224 20.8746 7.82869 21.0486 7.50602 21.1429L4.63902 21.9799C4.55298 22.005 4.46176 22.0065 4.37493 21.9842C4.2881 21.962 4.20885 21.9168 4.14547 21.8534C4.08209 21.79 4.03691 21.7108 4.01467 21.6239C3.99242 21.5371 3.99393 21.4459 4.01902 21.3599L4.85502 18.4909C4.9494 18.1686 5.12341 17.8752 5.36102 17.6379L10.378 12.6219Z"
                            stroke={(cr.status === 'in-progress' || cr.status === 'pending') ? "#4F39F6" : "#009966"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* ID and badges row */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[14px] font-mono text-[#101828]">{cr.crId}</span>
                          {/* Status badge */}
                          <span className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                            cr.status === 'in-progress' && "bg-[#EEF2FF] text-[#432DD7]",
                            cr.status === 'approved' && "bg-[#ECFDF5] text-[#007A55]",
                            cr.status === 'completed' && "bg-[#ECFDF5] text-[#007A55]",
                            cr.status === 'pending' && "bg-[#FEF3C7] text-[#B45309]",
                            cr.status === 'rejected' && "bg-[#FEE2E2] text-[#DC2626]"
                          )}>
                            {cr.status}
                          </span>
                          {/* Priority badge */}
                          <span className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                            cr.priority === 'urgent' && "bg-[#FFF1F2] text-[#C70036]",
                            cr.priority === 'high' && "bg-[#FFF1F2] text-[#C70036]",
                            cr.priority === 'medium' && "bg-[#F0F9FF] text-[#0069A8]",
                            cr.priority === 'low' && "bg-[#F3F4F6] text-[#364153]"
                          )}>
                            {cr.priority}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-[14px] font-normal text-[#101828] mb-1">{cr.title}</h3>

                        {/* Description */}
                        <p className="text-[14px] text-[#4A5565] mb-4 line-clamp-2">{cr.description}</p>

                        {/* Affected Models */}
                        {cr.affectedModels && cr.affectedModels.length > 0 && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[12px] text-[#6A7282]">Affected Models:</span>
                            <div className="flex flex-wrap gap-1">
                              {cr.affectedModels.slice(0, 3).map((model, i) => (
                                <span key={i} className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] text-[#4A5565]">
                                  {model}
                                </span>
                              ))}
                              {cr.affectedModels.length > 3 && (
                                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] text-[#6A7282]">
                                  +{cr.affectedModels.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-[12px] text-[#6A7282]">
                          {cr.assignedTo && (
                            <>
                              <span>Assigned to {cr.assignedTo}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>{new Date(cr.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* View Details button */}
                      <button className="shrink-0 inline-flex items-center rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-normal text-[#364153] hover:bg-gray-50 transition-colors">
                        View Details
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <ScopedTasksPanel
            scope={{ type: 'project', projectId: project.publicId }}
            projectRole={project.role as 'owner' | 'admin' | 'member' | 'viewer'}
          />
        )}

        {/* New Change Request Modal — disabled, handled by ChangesTab */}
        {false && isNewRequestModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsNewRequestModalOpen(false)}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
              className="relative z-10 w-full max-w-[700px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EFF6FF]">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4.16667V15.8333" stroke="#155DFC" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4.16667 10H15.8333" stroke="#155DFC" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[18px] font-normal text-[#101828]">Create New Change Request</h2>
                    <p className="text-[12px] text-[#6A7282]">Submit a change request for review</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsNewRequestModalOpen(false)} 
                  className="p-2 text-[#6A7282] hover:text-gray-600 rounded-[10px] hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {/* Title */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">
                    Title <span className="text-[#FF2056]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter change request title..."
                    value={newRequestTitle}
                    onChange={(e) => setNewRequestTitle(e.target.value)}
                    className="w-full h-[37px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4]"
                  />
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">
                    Priority <span className="text-[#FF2056]">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => setNewRequestPriority(priority)}
                        className={cn(
                          "h-10 rounded-[10px] text-[14px] font-normal capitalize transition-colors text-center",
                          newRequestPriority === priority
                            ? "bg-[#F0F9FF] border-2 border-[#00A6F4] text-[#0069A8]"
                            : "bg-white border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                        )}
                      >
                        {priority === 'low' ? 'Low' : priority === 'medium' ? 'Medium' : priority === 'high' ? 'High' : 'Urgent'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">
                    Description <span className="text-[#FF2056]">*</span>
                  </label>
                  <textarea
                    placeholder="Brief description of the requested change..."
                    value={newRequestDescription}
                    onChange={(e) => setNewRequestDescription(e.target.value)}
                    className="w-full min-h-[77px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4] resize-none"
                  />
                </div>

                {/* Detailed Description */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">Detailed Description</label>
                  <textarea
                    placeholder="Provide detailed information about the change, including affected systems, reasoning, and expected outcomes..."
                    value={newRequestDetailedDescription}
                    onChange={(e) => setNewRequestDetailedDescription(e.target.value)}
                    className="w-full min-h-[100px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4] resize-none"
                  />
                </div>

                {/* Two Column Layout: Discipline & Deadline */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Discipline */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Discipline</label>
                    <select
                      value={newRequestDiscipline}
                      onChange={(e) => setNewRequestDiscipline(e.target.value)}
                      className="w-full h-[37px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4]"
                    >
                      <option value="">Select discipline...</option>
                      <option value="Architecture">Architecture</option>
                      <option value="Structure">Structure</option>
                      <option value="MEP">MEP</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="Civil">Civil</option>
                      <option value="Landscape">Landscape</option>
                      <option value="Interior">Interior</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Deadline */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Deadline</label>
                    <input
                      type="date"
                      value={newRequestDeadline}
                      onChange={(e) => setNewRequestDeadline(e.target.value)}
                      min={getTodayLocalDateString()}
                      className="w-full h-[37px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4]"
                    />
                  </div>
                </div>

                {/* Two Column Layout: Assignee & Reviewers */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Assignee */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Assignee</label>
                    <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB] max-h-[150px] overflow-y-auto">
                      {teamMembers.length === 0 ? (
                        <div className="px-4 py-3 text-[14px] text-[#6A7282]">No team members available</div>
                      ) : (
                        teamMembers.map((member) => (
                          <label key={member.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={newRequestAssignees.includes(member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewRequestAssignees([...newRequestAssignees, member.id]);
                                } else {
                                  setNewRequestAssignees(newRequestAssignees.filter(id => id !== member.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-[#D1D5DC] text-[#155DFC] focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="flex h-7 w-7 items-center justify-center rounded-full object-cover text-[11px] font-medium text-white" />
                              ) : (
                                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium text-white", member.color)}>
                                  {member.avatar}
                                </div>
                              )}
                              <span className="text-[14px] text-[#101828]">{member.name}</span>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    {newRequestAssignees.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {newRequestAssignees.map(id => {
                          const member = teamMembers.find(m => m.id === id);
                          return member ? (
                            <span key={id} className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[12px] text-blue-700">
                              {member.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reviewers */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Reviewers</label>
                    <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB] max-h-[150px] overflow-y-auto">
                      {teamMembers.length === 0 ? (
                        <div className="px-4 py-3 text-[14px] text-[#6A7282]">No team members available</div>
                      ) : (
                        teamMembers.map((member) => (
                          <label key={member.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={newRequestReviewers.includes(member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewRequestReviewers([...newRequestReviewers, member.id]);
                                } else {
                                  setNewRequestReviewers(newRequestReviewers.filter(id => id !== member.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-[#D1D5DC] text-[#155DFC] focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="flex h-7 w-7 items-center justify-center rounded-full object-cover text-[11px] font-medium text-white" />
                              ) : (
                                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium text-white", member.color)}>
                                  {member.avatar}
                                </div>
                              )}
                              <span className="text-[14px] text-[#101828]">{member.name}</span>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    {newRequestReviewers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {newRequestReviewers.map(id => {
                          const member = teamMembers.find(m => m.id === id);
                          return member ? (
                            <span key={id} className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[12px] text-purple-700">
                              {member.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Affected Models */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">Affected Models</label>
                  {isLoadingIfcFiles ? (
                    <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] py-4 px-4 text-[14px] text-[#6A7282]">
                      Loading IFC files...
                    </div>
                  ) : availableIfcFiles.length === 0 ? (
                    <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] py-4 px-4 text-[14px] text-[#6A7282]">
                      No IFC files available. Upload IFC files to see them here.
                    </div>
                  ) : (
                    <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] divide-y divide-[#E5E7EB] max-h-[150px] overflow-y-auto">
                      {availableIfcFiles.map((file) => (
                        <label key={file.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-100">
                          <input
                            type="checkbox"
                            checked={newRequestAffectedModels.includes(file.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRequestAffectedModels([...newRequestAffectedModels, file.id]);
                              } else {
                                setNewRequestAffectedModels(newRequestAffectedModels.filter(id => id !== file.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-[#D1D5DC] text-[#155DFC] focus:ring-blue-500"
                          />
                          <svg className="h-4 w-4 text-[#6A7282]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                            <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z" />
                            <path d="M9.33333 1.33333V5.33333H13.3333" />
                          </svg>
                          <span className="text-[14px] text-[#101828]">{file.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">Attachments <span className="text-[#6A7282] font-normal">(Max 50MB)</span></label>
                  
                  {/* Selected files list */}
                  {newRequestAttachments.length > 0 && (
                    <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] divide-y divide-[#E5E7EB]">
                      {newRequestAttachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <svg className="h-4 w-4 text-[#6A7282] shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                              <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z" />
                              <path d="M9.33333 1.33333V5.33333H13.3333" />
                            </svg>
                            <div className="min-w-0">
                              <p className="text-[14px] text-[#101828] truncate">{file.name}</p>
                              <p className="text-[12px] text-[#6A7282]">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="p-1 text-[#6A7282] hover:text-red-500 transition-colors shrink-0"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className="rounded-[10px] border-2 border-dashed border-[#D1D5DC] bg-[#F9FAFB] py-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-[#155DFC] transition-colors"
                    onClick={() => document.getElementById('cr-file-input')?.click()}
                  >
                    <svg className="h-8 w-8 text-[#99A1AF] mb-2" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M21.333 21.333L16 16L10.667 21.333" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16 16V28" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M27.187 24.52C28.458 23.787 29.431 22.63 29.936 21.246C30.441 19.862 30.447 18.34 29.953 16.952C29.459 15.564 28.495 14.399 27.229 13.656C25.964 12.913 24.477 12.641 23.04 12.88H21.467C21.029 11.207 20.207 9.66 19.067 8.368C17.927 7.077 16.502 6.078 14.905 5.454C13.309 4.829 11.586 4.598 9.879 4.778C8.172 4.959 6.531 5.546 5.096 6.489C3.66 7.433 2.471 8.707 1.626 10.207C0.78 11.707 0.304 13.39 0.238 15.114C0.172 16.839 0.519 18.555 1.249 20.117C1.979 21.68 3.069 23.043 4.427 24.093" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-[14px] text-[#364153] mb-1">Drop files here or click to upload</p>
                    <p className="text-[12px] text-[#6A7282]">PDF, DWG, RVT, JPG, PNG</p>
                    <input
                      id="cr-file-input"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const validFiles = files.filter(file => {
                          const maxSize = 50 * 1024 * 1024;
                          if (file.size > maxSize) {
                            toast.error(`${file.name} exceeds 50MB limit`);
                            return false;
                          }
                          return true;
                        });
                        setNewRequestAttachments(prev => [...prev, ...validFiles]);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] shrink-0">
                <button 
                  onClick={() => {
                    setIsNewRequestModalOpen(false);
                    setNewRequestTitle('');
                    setNewRequestDescription('');
                    setNewRequestDetailedDescription('');
                    setNewRequestPriority('medium');
                    setNewRequestAffectedModels([]);
                    setNewRequestAssignees([]);
                    setNewRequestReviewers([]);
                    setNewRequestAttachments([]);
                    setNewRequestDiscipline('');
                    setNewRequestDeadline('');
                  }} 
                  className="text-[14px] font-normal text-[#364153] hover:text-gray-900 transition-colors px-4 py-2"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateChangeRequest}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[14px] font-normal text-white hover:bg-[#155DFC]/90 transition-colors"
                >
                  Create Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Compare Versions Modal */}
        {isCompareModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsCompareModalOpen(false)}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
              className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">Compare Versions</h2>
                <button 
                  onClick={() => setIsCompareModalOpen(false)} 
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* Base Version */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Version</label>
                  <div className="relative">
                    <select
                      value={baseVersion}
                      onChange={(e) => setBaseVersion(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Select version...</option>
                      {mockVersions.map((v) => (
                        <option key={v.id} value={v.id}>Version {v.version} - {v.filename}</option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>

                {/* Compare With */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Compare With</label>
                  <div className="relative">
                    <select
                      value={compareVersion}
                      onChange={(e) => setCompareVersion(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Select version...</option>
                      {mockVersions.filter(v => v.id !== baseVersion).map((v) => (
                        <option key={v.id} value={v.id}>Version {v.version} - {v.filename}</option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                <button 
                  onClick={() => setIsCompareModalOpen(false)} 
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (baseVersion && compareVersion) {
                      setIsCompareModalOpen(false);
                      setIsCompareResultOpen(true);
                    }
                  }}
                  disabled={!baseVersion || !compareVersion}
                  className="flex-1 px-4 py-3 rounded-lg bg-indigo-400 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Compare
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Compare Result Modal */}
        {isCompareResultOpen && baseVersion && compareVersion && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsCompareResultOpen(false)}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
              className="relative z-10 w-full max-w-[1280px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#FAF5FF]">
                    <svg className="h-5 w-5 text-[#9810FA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-normal text-[#101828]">Version Comparison</h2>
                    <p className="text-xs text-[#6A7282]">
                      Version {mockVersions.find(v => v.id === baseVersion)?.version} vs Version {mockVersions.find(v => v.id === compareVersion)?.version}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCompareResultOpen(false)} 
                  className="p-2 text-[#6A7282] hover:text-gray-600 rounded-[10px] hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Side by side comparison */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Base Version */}
                  {(() => {
                    const base = mockVersions.find(v => v.id === baseVersion);
                    if (!base) return null;
                    return (
                      <div className="space-y-4">
                        {/* Version Header Card - Blue highlight for Base */}
                        <div className="rounded-[10px] bg-[#EFF6FF] border-2 border-[#BEDBFF] p-[18px]">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-base font-normal text-[#101828]">Version {base.version}</h3>
                            <span className="inline-flex items-center rounded px-2 py-1 text-xs font-normal bg-[#DBEAFE] text-[#1447E6]">
                              Base
                            </span>
                          </div>
                          <p className="text-sm text-[#4A5565]">{base.filename}</p>
                        </div>

                        {/* Metadata Card */}
                        <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
                          <h4 className="text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3">Metadata</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Author</span>
                              <span className="text-sm text-[#101828]">{base.author}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Date</span>
                              <span className="text-sm text-[#101828]">{base.updatedAt}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">File Size</span>
                              <span className="text-sm text-[#101828]">{base.fileSize}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Discipline</span>
                              <span className="text-sm text-[#101828]">{base.discipline}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Revisions</span>
                              <span className="text-sm text-[#101828]">{base.revisions} revisions</span>
                            </div>
                          </div>
                        </div>

                        {/* Changes Card */}
                        <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
                          <h4 className="text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3">Changes</h4>
                          <ul className="space-y-2">
                            {base.changes.map((change, i) => (
                              <li key={i} className="flex items-start gap-3 text-sm text-[#4A5565]">
                                <span className="text-[#155DFC] font-bold">•</span>
                                {change}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Affected Elements Card */}
                        <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
                          <h4 className="text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3">Affected Elements</h4>
                          <div className="flex flex-wrap gap-2">
                            {base.affectedElements.map((element, i) => (
                              <span key={i} className="inline-flex items-center rounded px-2 py-1 text-xs text-[#364153] bg-[#F3F4F6] border border-[#E5E7EB]">
                                {element}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Compare Version */}
                  {(() => {
                    const compare = mockVersions.find(v => v.id === compareVersion);
                    if (!compare) return null;
                    return (
                      <div className="space-y-4">
                        {/* Version Header Card - Green highlight for Compare */}
                        <div className="rounded-[10px] bg-[#F0FDF4] border-2 border-[#BBF7D0] p-[18px]">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-base font-normal text-[#101828]">Version {compare.version}</h3>
                            <span className="inline-flex items-center rounded px-2 py-1 text-xs font-normal bg-[#DCFCE7] text-[#15803D]">
                              Compare
                            </span>
                          </div>
                          <p className="text-sm text-[#4A5565]">{compare.filename}</p>
                        </div>

                        {/* Metadata Card */}
                        <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
                          <h4 className="text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3">Metadata</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Author</span>
                              <span className="text-sm text-[#101828]">{compare.author}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Date</span>
                              <span className="text-sm text-[#101828]">{compare.updatedAt}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">File Size</span>
                              <span className="text-sm text-[#101828]">{compare.fileSize}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Discipline</span>
                              <span className="text-sm text-[#101828]">{compare.discipline}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-[#6A7282]">Revisions</span>
                              <span className="text-sm text-[#101828]">{compare.revisions} revisions</span>
                            </div>
                          </div>
                        </div>

                        {/* Changes Card */}
                        <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
                          <h4 className="text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3">Changes</h4>
                          <ul className="space-y-2">
                            {compare.changes.map((change, i) => (
                              <li key={i} className="flex items-start gap-3 text-sm text-[#4A5565]">
                                <span className="text-[#15803D] font-bold">•</span>
                                {change}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Affected Elements Card */}
                        <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
                          <h4 className="text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3">Affected Elements</h4>
                          <div className="flex flex-wrap gap-2">
                            {compare.affectedElements.map((element, i) => (
                              <span key={i} className="inline-flex items-center rounded px-2 py-1 text-xs text-[#364153] bg-[#F3F4F6] border border-[#E5E7EB]">
                                {element}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] bg-white rounded-b-[10px]">
                <button 
                  onClick={() => setIsCompareResultOpen(false)} 
                  className="text-sm font-medium text-[#6A7282] hover:text-gray-900 transition-colors"
                >
                  Close
                </button>
                <div className="flex items-center gap-3">
                  <button className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#364153] transition-colors hover:bg-gray-50">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Report
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                    View in 3D
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Version Detail Modal */}
        {isVersionDetailOpen && selectedVersion && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsVersionDetailOpen(false)}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
              className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">Version {selectedVersion.version}</h2>
                  <p className="text-sm text-gray-500">{selectedVersion.filename}</p>
                </div>
                <button 
                  onClick={() => setIsVersionDetailOpen(false)} 
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-6">
                {/* Info Boxes */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Version Information */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Version Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Status</span>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          selectedVersion.status === 'current' && "bg-blue-100 text-blue-700",
                          selectedVersion.status === 'approved' && "bg-green-100 text-green-700"
                        )}>
                          {selectedVersion.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Author</span>
                        <span className="text-sm font-medium text-gray-900">{selectedVersion.author}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Date Modified</span>
                        <span className="text-sm font-medium text-gray-900">{selectedVersion.updatedAt}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Revisions</span>
                        <span className="text-sm font-medium text-gray-900">{selectedVersion.revisions} revisions</span>
                      </div>
                    </div>
                  </div>

                  {/* File Details */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">File Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">File Size</span>
                        <span className="text-sm font-medium text-gray-900">{selectedVersion.fileSize}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Discipline</span>
                        <span className="text-sm font-medium text-gray-900">{selectedVersion.discipline}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Format</span>
                        <span className="text-sm font-medium text-gray-900">{selectedVersion.format}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Reviewers</span>
                        <span className="text-sm font-medium text-gray-900">{selectedVersion.reviewers.length} people</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Changes */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Detailed Changes</h3>
                  <ul className="space-y-2">
                    {selectedVersion.changes.map((change, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Affected Elements & Reviewers */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Affected Elements */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Affected Elements
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedVersion.affectedElements.map((element, index) => (
                        <span key={index} className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {element}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reviewers */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Reviewers
                    </h3>
                    <div className="flex items-center gap-3">
                      {selectedVersion.reviewers.map((reviewer, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-white", reviewer.color)}>
                            {reviewer.avatar}
                          </div>
                          <span className="text-sm text-gray-700">{reviewer.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                <button 
                  onClick={() => setIsVersionDetailOpen(false)} 
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Close
                </button>
                <div className="flex items-center gap-3">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                    View in 3D
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Folder Modal */}
        {isNewFolderModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsNewFolderModalOpen(false)}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
              className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">Create New Folder</h2>
                <button 
                  onClick={() => setIsNewFolderModalOpen(false)} 
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Folder name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                <button 
                  onClick={() => setIsNewFolderModalOpen(false)} 
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => { console.log('Creating folder:', newFolderName); setIsNewFolderModalOpen(false); setNewFolderName(''); }}
                  disabled={!newFolderName}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {isUploadModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsUploadModalOpen(false)}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
              className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">Upload Files</h2>
                <button 
                  onClick={() => setIsUploadModalOpen(false)} 
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 mb-4 group-hover:bg-indigo-100 transition-colors">
                    <svg className="h-7 w-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">PDF, DWG, RVT, IFC, NWC or other files up to 500MB</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                <button 
                  onClick={() => setIsUploadModalOpen(false)} 
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clashes Tab */}
        {activeTab === 'clashes' && (
          <ClashesTab
            projectPublicId={project.publicId}
            projectDisplayName={project.name}
            currentUserRole={project.role as 'owner' | 'admin' | 'member' | 'viewer'}
          />
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <TeamsTab projectPublicId={project.publicId} currentUserRole={project.role as 'admin' | 'member' | 'viewer'} />
        )}

        {/* Extensions Tab */}
        {activeTab === 'extensions' && (
          <ExtensionsTab />
        )}

        {/* Activity Tab — full feed (overview shows compact recent list separately) */}
        {activeTab === 'activity' && (
          <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
            <ScopedActivityPanel
              scope={{ type: 'project', projectId: project.publicId }}
            />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsTab
            projectName={project.name}
            projectCode={project.publicId}
            projectDescription={project.description}
            projectPublicId={project.publicId}
            projectCoverImageUrl={projectCoverImageUrl}
            onSettingsUpdated={handleSettingsUpdated}
            onActivityAdded={() => setActivitiesVersion(v => v + 1)}
          />
        )}
  
        {/* Other Tabs - Placeholder (only for tabs without content yet) */}
        {!['overview', 'packages', 'documents', 'versions', 'changes', 'tasks', 'clashes', 'teams', 'extensions', 'activity', 'settings'].includes(activeTab) && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 capitalize">{activeTab}</h3>
            <p className="text-sm text-muted-foreground">This section is under development</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default function ProjectDetailPage({ project }: ProjectDetailPageProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ClashViewerProvider>
        <ProjectDetailPageContent project={project} />
      </ClashViewerProvider>
    </QueryClientProvider>
  );
}


