'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import PackagesManager from './PackagesManager';
import ProjectDocumentsManager from './ProjectDocumentsManager';
import ProjectTopBar from '@/components/layout/ProjectTopBar';
import CreateTaskModal from './CreateTaskModal';
import WorkflowTemplatesDropdown from './WorkflowTemplatesDropdown';
import ClashesTab from './ClashesTab';
import TeamsTab from './TeamsTab';
import ExtensionsTab from './ExtensionsTab';
import SettingsTab from './SettingsTab';


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
  };
}

interface TeamMemberView {
  id: string;
  name: string;
  role: string;
  avatar: string;
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

const mockActivities = [
  { id: '1', action: 'Version 3.2 approved', user: 'Minh Anh', time: '2 hours ago', icon: 'check', color: 'bg-emerald-100 text-emerald-600' },
  { id: '2', action: 'New clash detected', user: 'System', time: '3 hours ago', icon: 'alert', color: 'bg-red-100 text-red-600' },
  { id: '3', action: 'Document uploaded', user: 'Thu Trang', time: '5 hours ago', icon: 'upload', color: 'bg-blue-100 text-blue-600' },
  { id: '4', action: 'Change request submitted', user: 'Tuan Kiet', time: '1 day ago', icon: 'edit', color: 'bg-purple-100 text-purple-600' },
];

const mockMilestones = [
  { id: '1', name: 'Foundation Complete', date: 'Jan 15, 2024', status: 'completed' },
  { id: '2', name: 'Structural Framework', date: 'Apr 30, 2024', status: 'completed' },
  { id: '3', name: 'MEP Installation', date: 'Aug 15, 2024', status: 'in-progress' },
  { id: '4', name: 'Interior Finishing', date: 'Nov 30, 2024', status: 'upcoming' },
  { id: '5', name: 'Final Inspection', date: 'Dec 15, 2025', status: 'upcoming' },
];

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

// Mock change requests data
interface ChangeRequest {
  id: string;
  crId: string;
  status: 'in-progress' | 'approved' | 'completed' | 'pending' | 'rejected';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  assignee: string;
  createdAt: string;
}

const mockChangeRequests: ChangeRequest[] = [
  {
    id: '1',
    crId: 'CR-044',
    status: 'in-progress',
    priority: 'urgent',
    title: 'Relocate main entrance',
    description: 'Building orientation change requires entrance relocation',
    assignee: 'Hoang Nam',
    createdAt: '5 hours ago',
  },
  {
    id: '2',
    crId: 'CR-043',
    status: 'approved',
    priority: 'medium',
    title: 'Update fire safety system',
    description: 'Add additional fire sprinkler heads per regulations',
    assignee: 'Thu Trang',
    createdAt: '1 day ago',
  },
  {
    id: '3',
    crId: 'CR-042',
    status: 'completed',
    priority: 'low',
    title: 'Parking layout modification',
    description: 'Reconfigure parking spaces to meet accessibility standards',
    assignee: 'Tuan Kiet',
    createdAt: '3 days ago',
  },
  {
    id: '4',
    crId: 'CR-041',
    status: 'in-progress',
    priority: 'high',
    title: 'Revise HVAC duct routing in corridor',
    description: 'Optimize duct path to avoid structural beams and reduce pressure loss',
    assignee: 'Ava Collins',
    createdAt: '8 hours ago',
  },
  {
    id: '5',
    crId: 'CR-040',
    status: 'approved',
    priority: 'medium',
    title: 'Structural reinforcement for roof garden',
    description: 'Add steel beams to support additional load from planned roof garden',
    assignee: 'Nathan Reed',
    createdAt: '2 days ago',
  },
];

// Mock Tasks data
interface Task {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  tags: string[];
  linkedItem?: { type: 'link'; name: string };
  comments: number;
  attachments: number;
  dueDate: string;
  assigneeId: string;
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Model revision for Level 3',
    priority: 'medium',
    status: 'backlog',
    tags: ['modeling', '3d'],
    comments: 0,
    attachments: 0,
    dueDate: '',
    assigneeId: '2',
  },
  {
    id: '2',
    title: 'Resolve MEP clash #CH-045',
    priority: 'urgent',
    status: 'todo',
    tags: ['mep', 'clash'],
    linkedItem: { type: 'link', name: 'Duct-Beam Intersection' },
    comments: 5,
    attachments: 0,
    dueDate: 'Dec 10',
    assigneeId: '2',
  },
  {
    id: '3',
    title: 'Prepare site inspection checklist',
    priority: 'low',
    status: 'todo',
    tags: ['site', 'quality'],
    comments: 0,
    attachments: 0,
    dueDate: 'Dec 20',
    assigneeId: '1',
  },
  {
    id: '4',
    title: 'Review foundation drawings',
    priority: 'high',
    status: 'in-progress',
    tags: ['structural', 'drawings'],
    linkedItem: { type: 'link', name: 'Foundation Plan A1' },
    comments: 3,
    attachments: 2,
    dueDate: 'Dec 15',
    assigneeId: '2',
  },
  {
    id: '5',
    title: 'Update architectural elevations',
    priority: 'medium',
    status: 'review',
    tags: ['architecture', 'drawings'],
    linkedItem: { type: 'link', name: 'Facade Material Change' },
    comments: 2,
    attachments: 4,
    dueDate: 'Dec 12',
    assigneeId: '4',
  },
  {
    id: '6',
    title: 'Submit permit documents',
    priority: 'high',
    status: 'done',
    tags: ['permits', 'compliance'],
    comments: 1,
    attachments: 0,
    dueDate: 'Dec 5',
    assigneeId: '5',
  },
];

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

export default function ProjectDetailPage({ project }: ProjectDetailPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberView[]>([]);
  const [documentsCount, setDocumentsCount] = useState(0);

  // Fetch real team members + documents count from backend API
  useEffect(() => {
    let cancelled = false;

    const fetchProjectOverviewData = async () => {
      try {
        const [membersRes, documentsRes] = await Promise.all([
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
              color: avatarColors[index % avatarColors.length],
              isOnline: m?.status === 'accepted',
            };
          });

          if (!cancelled) {
            setTeamMembers(mappedMembers);
          }
        }

        if (documentsRes.ok) {
          const payload = await documentsRes.json();
          const total = Number(payload?.data?.total || 0);
          if (!cancelled) {
            setDocumentsCount(Number.isFinite(total) ? total : 0);
          }
        }
      } catch {
        // Keep default values on error
      }
    };

    fetchProjectOverviewData();
    return () => { cancelled = true; };
  }, [project.publicId]);
  
  // Check for stored tab on mount (used when navigating back from package detail)
  useEffect(() => {
    const storedTab = sessionStorage.getItem('projectActiveTab');
    if (storedTab) {
      setActiveTab(storedTab);
      sessionStorage.removeItem('projectActiveTab');
    }
  }, []);
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
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newRequestPriority, setNewRequestPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newRequestImpact, setNewRequestImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [tasksViewMode, setTasksViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [tasksSearchQuery, setTasksSearchQuery] = useState('');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

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
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
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

  // Mock extended data
  const projectStats = {
    documents: documentsCount,
    versions: 124,
    teamMembers: teamMembers.length,
    openClashes: (project as any).issues || 0,
    startDate: 'Jan 15, 2024',
    deadline: 'Dec 15, 2025',
  };

  return (
    <div className="min-h-screen bg-background pt-[105px]">
      {/* Project Top Bar with Navigation - Fixed */}
      <ProjectTopBar
        projectName={project.name}
        projectSlug={project.publicId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Hero Section - Only show on Overview tab */}
      {activeTab === 'overview' && (
        <div className="relative h-52 flex items-end overflow-hidden">
          {/* Background Image - Use coverImageUrl from API */}
          {project.coverImageUrl ? (
            <img
              src={project.coverImageUrl}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
          
          <div className="relative w-full px-[300px] pb-6">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
              <ClockIcon className="h-4 w-4" />
              <span>Last updated {project.lastVisited ? formatRelativeTime(project.lastVisited) : 'recently'}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{project.name}</h1>
            <p className="text-white/80">{project.description}</p>
          </div>
        </div>
      )}

      {/* Content - With 300px left/right margins */}
      <div className="px-[300px] py-6">
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
            <p className={cn(
              "mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium text-white capitalize",
              getStatusColor(project.status)
            )}>
              {project.status}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground">{project.progress}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</p>
            <p className="mt-1 text-sm font-medium text-foreground">{projectStats.startDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deadline</p>
            <p className="mt-1 text-sm font-medium text-foreground">{projectStats.deadline}</p>
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
        <div className="grid grid-cols-2 gap-6">
          {/* Team Members */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="font-semibold text-foreground">Team members</h3>
            </div>
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="relative">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white", member.color)}>
                      {member.avatar}
                    </div>
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
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-semibold text-foreground">Recent activity</h3>
            </div>
            <div className="space-y-4">
              {mockActivities.map((activity) => (
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.user} • {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Project Milestones */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="font-semibold text-foreground">Project milestones</h3>
          </div>
          <div className="space-y-3">
            {mockMilestones.map((milestone) => (
              <div key={milestone.id} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                <div className={cn(
                  "h-3 w-3 rounded-full",
                  milestone.status === 'completed' && "bg-emerald-500",
                  milestone.status === 'in-progress' && "bg-indigo-500",
                  milestone.status === 'upcoming' && "bg-gray-300"
                )} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{milestone.name}</p>
                  <p className="text-xs text-muted-foreground">{milestone.date}</p>
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full",
                  milestone.status === 'completed' && "bg-emerald-100 text-emerald-700",
                  milestone.status === 'in-progress' && "bg-indigo-100 text-indigo-700",
                  milestone.status === 'upcoming' && "bg-gray-100 text-gray-600"
                )}>
                  {milestone.status === 'completed' ? 'completed' : milestone.status === 'in-progress' ? 'in progress' : 'upcoming'}
                </span>
              </div>
            ))}
          </div>
        </div>
        </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <ProjectDocumentsManager projectId={project.publicId} />
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
            {/* Header */}
            <div className="flex items-center justify-between">
<div>
            <h2 className="text-[24px] font-normal text-[#101828]">Version Control</h2>
          </div>
              {mockVersions.length > 0 && (
                <button 
                  onClick={() => setIsCompareModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] font-normal text-[#364153] transition-colors hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Compare Versions
                </button>
              )}
            </div>

            {/* Empty State - Only show when no versions */}
            {mockVersions.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">This section is under development</h3>
                <p className="text-sm text-gray-500">Version control features will be available soon</p>
              </div>
            )}

            {/* Versions List with Timeline */}
            {mockVersions.length > 0 && (
            <div className="relative">
              {/* Timeline connector line */}
              <div className="absolute left-[47px] top-[60px] bottom-[60px] w-[2px] bg-[#E5E7EB]" />
              
              <div className="space-y-0">
                {mockVersions.map((version, index) => (
                  <div
                    key={version.id}
                    className="relative rounded-[10px] border border-[#E5E7EB] bg-white px-6 py-6 mb-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Version Icon - Blue for current, Green for approved */}
                      <div className={cn(
                        "relative z-10 flex h-12 w-12 items-center justify-center rounded-full shrink-0",
                        version.status === 'current' ? "bg-[#155DFC]" : "bg-[#DCFCE7]"
                      )}>
                        {/* Git branch icon */}
                        <svg className={cn("h-6 w-6", version.status === 'current' ? "text-white" : "text-[#00A63E]")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="3" />
                          <line x1="3" y1="12" x2="9" y2="12" />
                          <line x1="15" y1="12" x2="21" y2="12" />
                        </svg>
                      </div>

                      {/* Version Info */}
                      <div className="flex-1 min-w-0">
                        {/* Title row with badge */}
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-[18px] font-normal text-[#101828]">Version {version.version}</h3>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-normal",
                            version.status === 'current' && "bg-[#DBEAFE] text-[#1447E6]",
                            version.status === 'approved' && "bg-[#DCFCE7] text-[#008236]",
                            version.status === 'pending' && "bg-[#FEF3C7] text-[#B45309]",
                            version.status === 'rejected' && "bg-[#FEE2E2] text-[#DC2626]"
                          )}>
                            {version.status}
                          </span>
                        </div>
                        
                        {/* Filename */}
                        <p className="text-[14px] text-[#4A5565] mb-1">{version.filename}</p>
                        
                        {/* Description */}
                        <p className="text-[14px] text-[#101828] mb-4">{version.description}</p>
                        
                        {/* Metadata row */}
                        <div className="flex items-center gap-4">
                          {/* Author */}
                          <span className="flex items-center gap-2 text-[12px] text-[#6A7282]">
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1}>
                              <path d="M6 5.5a2 2 0 100-4 2 2 0 000 4z" />
                              <path d="M2.5 10.5v-1a3.5 3.5 0 017 0v1" />
                            </svg>
                            {version.author}
                          </span>
                          
                          {/* Date */}
                          <span className="flex items-center gap-2 text-[12px] text-[#6A7282]">
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1}>
                              <rect x="1.5" y="2" width="9" height="8.5" rx="1" />
                              <line x1="4" y1="1" x2="4" y2="3" />
                              <line x1="8" y1="1" x2="8" y2="3" />
                              <line x1="1.5" y1="5" x2="10.5" y2="5" />
                            </svg>
                            {version.updatedAt}
                          </span>
                          
                          {/* Revisions */}
                          <span className="flex items-center gap-2 text-[12px] text-[#6A7282]">
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1}>
                              <path d="M3 1.5v3m0 0L1.5 3m1.5 1.5L4.5 3" />
                              <path d="M9 10.5v-3m0 0l1.5 1.5M9 7.5L7.5 9" />
                              <path d="M4.5 4.5l3 3" />
                            </svg>
                            {version.revisions} revisions
                          </span>
                        </div>
                      </div>

                      {/* View Details Button */}
                      <button
                        onClick={() => {
                          setSelectedVersion(version);
                          setIsVersionDetailOpen(true);
                        }}
                        className="inline-flex items-center gap-2 text-[12px] font-normal text-[#155DFC] hover:text-blue-700 shrink-0"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.17}>
                          <circle cx="7" cy="7" r="2.5" />
                          <path d="M1 7c1.5-3.5 3.5-5 6-5s4.5 1.5 6 5c-1.5 3.5-3.5 5-6 5s-4.5-1.5-6-5z" />
                        </svg>
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        )}

        {/* Changes Tab */}
        {activeTab === 'changes' && (
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
              {mockChangeRequests
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
                  key={cr.id} 
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
                    <p className="text-[14px] text-[#4A5565] mb-4">{cr.description}</p>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-[12px] text-[#6A7282]">
                      <span>Assigned to {cr.assignee}</span>
                      <span>•</span>
                      <span>{cr.createdAt}</span>
                    </div>
                  </div>

                  {/* View Details button */}
                  <button className="shrink-0 inline-flex items-center rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-normal text-[#364153] hover:bg-gray-50 transition-colors">
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col h-full py-6 px-6 lg:px-[80px] xl:px-[160px]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
<div className="flex items-center gap-3">
  {/* Workflow dropdown */}
  <WorkflowTemplatesDropdown 
    selectedWorkflow="construction-standard"
    onSelect={(workflowId) => console.log('Selected workflow:', workflowId)}
    onConfigureClick={() => console.log('Configure workflow clicked')}
  />
  {/* New Task button */}
  <button
  onClick={() => setIsNewTaskModalOpen(true)}
  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors"
  >
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
  New Task
  </button>
  </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 rounded-[10px] bg-[#F3F4F6] p-1">
                <button
                  onClick={() => setTasksViewMode('board')}
                  className={cn(
                    "p-1.5 rounded-[8px] transition-colors",
                    tasksViewMode === 'board' ? "bg-white shadow-sm" : "hover:bg-gray-200"
                  )}
                >
                  <svg className="h-4 w-4 text-[#4A5565]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                    <rect x="2" y="2" width="5" height="5" rx="1" />
                    <rect x="9" y="2" width="5" height="5" rx="1" />
                    <rect x="2" y="9" width="5" height="5" rx="1" />
                    <rect x="9" y="9" width="5" height="5" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setTasksViewMode('list')}
                  className={cn(
                    "p-1.5 rounded-[8px] transition-colors",
                    tasksViewMode === 'list' ? "bg-white shadow-sm" : "hover:bg-gray-200"
                  )}
                >
                  <svg className="h-4 w-4 text-[#4A5565]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                    <path d="M2 4h12M2 8h12M2 12h12" />
                  </svg>
                </button>
                <button
                  onClick={() => setTasksViewMode('calendar')}
                  className={cn(
                    "p-1.5 rounded-[8px] transition-colors",
                    tasksViewMode === 'calendar' ? "bg-white shadow-sm" : "hover:bg-gray-200"
                  )}
                >
                  <svg className="h-4 w-4 text-[#4A5565]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                    <rect x="2" y="3" width="12" height="11" rx="1" />
                    <path d="M2 6h12M5 1v4M11 1v4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center justify-between py-4">
              <div className="relative flex-1 max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={tasksSearchQuery}
                  onChange={(e) => setTasksSearchQuery(e.target.value)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#364153] hover:bg-gray-50">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                  </svg>
                  Filters
                </button>
                <button className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#364153] hover:bg-gray-50">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                    <path d="M8 7.33333C9.47276 7.33333 10.6667 6.13943 10.6667 4.66667C10.6667 3.19391 9.47276 2 8 2C6.52724 2 5.33333 3.19391 5.33333 4.66667C5.33333 6.13943 6.52724 7.33333 8 7.33333Z" />
                    <path d="M3.33333 14V12.6667C3.33333 11.9594 3.61428 11.2811 4.11438 10.781C4.61448 10.281 5.29276 10 6 10H10C10.7072 10 11.3855 10.281 11.8856 10.781C12.3857 11.2811 12.6667 11.9594 12.6667 12.6667V14" />
                  </svg>
                  Assignee
                </button>
                <button className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#364153] hover:bg-gray-50">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                  </svg>
                  Tags
                </button>
              </div>
            </div>

            {/* Board View */}
            {tasksViewMode === 'board' && (
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 min-w-max pb-4">
                  {taskColumns.map((column) => {
                    const columnTasks = mockTasks.filter(t => 
                      t.status === column.id && 
                      t.title.toLowerCase().includes(tasksSearchQuery.toLowerCase())
                    );
                    return (
                      <div key={column.id} className="w-[280px] flex flex-col">
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {column.icon === 'circle' && (
                              <div className="h-4 w-4 rounded-full border-2 border-[#D1D5DC]"></div>
                            )}
                            {column.icon === 'clock' && (
                              <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 6v6l4 2" />
                              </svg>
                            )}
                            {column.icon === 'check' && (
                              <svg className="h-4 w-4 text-[#009966]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <circle cx="12" cy="12" r="9" />
                                <path d="M9 12l2 2 4-4" />
                              </svg>
                            )}
                            <span className="text-[14px] font-normal text-[#101828]">{column.label}</span>
                            <span className="text-[12px] text-[#6A7282] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{columnTasks.length}</span>
                          </div>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </button>
                        </div>

                        {/* Tasks */}
                        <div className="flex flex-col gap-2">
                          {columnTasks.map((task) => {
                            const assignee = mockTeamMembers.find(m => m.id === task.assigneeId);
                            return (
                              <div key={task.id} className="bg-white rounded-[10px] border border-[#E5E7EB] p-3 hover:shadow-sm transition-shadow cursor-pointer">
                                {/* Priority badge */}
                                <span className={cn(
                                  "inline-flex items-center rounded px-2 py-0.5 text-[12px] mb-2",
                                  task.priority === 'urgent' && "bg-[#FEE2E2] text-[#DC2626]",
                                  task.priority === 'high' && "bg-[#FEE2E2] text-[#DC2626]",
                                  task.priority === 'medium' && "bg-[#F0F9FF] text-[#0069A8]",
                                  task.priority === 'low' && "bg-[#F3F4F6] text-[#364153]"
                                )}>
                                  {task.priority}
                                </span>

                                {/* Title */}
                                <h4 className="text-[14px] font-normal text-[#101828] mb-2">{task.title}</h4>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {task.tags.map((tag) => (
                                    <span key={tag} className="inline-flex items-center rounded-[6px] bg-[#F3F4F6] px-2 py-0.5 text-[12px] text-[#4A5565]">
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                {/* Linked item */}
                                {task.linkedItem && (
                                  <div className="flex items-center gap-1 mb-3">
                                    <svg className="h-3.5 w-3.5 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                    </svg>
                                    <span className="text-[12px] text-[#155DFC]">{task.linkedItem.name}</span>
                                  </div>
                                )}

                                {/* Footer: metadata and avatar */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 text-[12px] text-[#6A7282]">
                                    {task.comments > 0 && (
                                      <div className="flex items-center gap-1">
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                        </svg>
                                        {task.comments}
                                      </div>
                                    )}
                                    {task.attachments > 0 && (
                                      <div className="flex items-center gap-1">
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                        </svg>
                                        {task.attachments}
                                      </div>
                                    )}
                                    {task.dueDate && (
                                      <div className="flex items-center gap-1">
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                        </svg>
                                        {task.dueDate}
                                      </div>
                                    )}
                                  </div>
                                  {assignee && (
                                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white", assignee.color)}>
                                      {assignee.avatar}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Add task button */}
                          <button className="w-full py-2 rounded-[10px] border border-dashed border-[#D1D5DC] text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors">
                            + Add task
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List View */}
            {tasksViewMode === 'list' && (
              <div className="flex-1 overflow-auto">
                <div className="rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_120px_120px_150px_100px_80px] gap-4 px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[12px] font-medium text-[#6A7282] uppercase tracking-wide">
                    <div>Task</div>
                    <div>Status</div>
                    <div>Priority</div>
                    <div>Due Date</div>
                    <div>Assignee</div>
                    <div></div>
                  </div>

                  {/* Table Body */}
                  {mockTasks
                    .filter(t => t.title.toLowerCase().includes(tasksSearchQuery.toLowerCase()))
                    .map((task) => {
                      const assignee = mockTeamMembers.find(m => m.id === task.assigneeId);
                      const column = taskColumns.find(c => c.id === task.status);
                      return (
                        <div key={task.id} className="grid grid-cols-[1fr_120px_120px_150px_100px_80px] gap-4 px-4 py-3 border-b border-[#E5E7EB] hover:bg-gray-50 items-center">
                          <div className="flex flex-col gap-1">
                            <span className="text-[14px] text-[#101828]">{task.title}</span>
                            <div className="flex gap-1">
                              {task.tags.map((tag) => (
                                <span key={tag} className="inline-flex items-center rounded-[6px] bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#4A5565]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className={cn(
                              "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                              task.status === 'done' && "bg-[#ECFDF5] text-[#007A55]",
                              task.status === 'in-progress' && "bg-[#EFF6FF] text-[#155DFC]",
                              task.status === 'review' && "bg-[#FEF3C7] text-[#B45309]",
                              task.status === 'todo' && "bg-[#F3F4F6] text-[#364153]",
                              task.status === 'backlog' && "bg-[#F3F4F6] text-[#6A7282]"
                            )}>
                              {column?.label}
                            </span>
                          </div>
                          <div>
                            <span className={cn(
                              "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                              task.priority === 'urgent' && "bg-[#FEE2E2] text-[#DC2626]",
                              task.priority === 'high' && "bg-[#FEE2E2] text-[#DC2626]",
                              task.priority === 'medium' && "bg-[#F0F9FF] text-[#0069A8]",
                              task.priority === 'low' && "bg-[#F3F4F6] text-[#364153]"
                            )}>
                              {task.priority}
                            </span>
                          </div>
                          <div className="text-[14px] text-[#6A7282]">
                            {task.dueDate || '-'}
                          </div>
                          <div>
                            {assignee && (
                              <div className="flex items-center gap-2">
                                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white", assignee.color)}>
                                  {assignee.avatar}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <button className="p-1 hover:bg-gray-100 rounded">
                              <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Calendar View Placeholder */}
            {tasksViewMode === 'calendar' && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <svg className="h-16 w-16 text-[#D1D5DC] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M3 10h18M16 2v4M8 2v4" />
                  </svg>
                  <h3 className="text-[16px] font-medium text-[#101828] mb-1">Calendar View</h3>
                  <p className="text-[14px] text-[#6A7282]">Calendar view coming soon</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* New Change Request Modal */}
        {isNewRequestModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsNewRequestModalOpen(false)}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
              className="relative z-10 w-full max-w-[768px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
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

                {/* Estimated Impact */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">
                    Estimated Impact <span className="text-[#FF2056]">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((impact) => (
                      <button
                        key={impact}
                        onClick={() => setNewRequestImpact(impact)}
                        className={cn(
                          "h-10 rounded-[10px] text-[14px] font-normal capitalize transition-colors text-center",
                          newRequestImpact === impact
                            ? "bg-[#FFFBEB] border-2 border-[#FE9A00] text-[#BB4D00]"
                            : "bg-white border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                        )}
                      >
                        {impact === 'low' ? 'Low' : impact === 'medium' ? 'Medium' : 'High'}
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
                    className="w-full min-h-[77px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4] resize-none"
                  />
                </div>

                {/* Assignee and Discipline */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Assignee */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Assignee</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                        <path d="M8 7.33333C9.47276 7.33333 10.6667 6.13943 10.6667 4.66667C10.6667 3.19391 9.47276 2 8 2C6.52724 2 5.33333 3.19391 5.33333 4.66667C5.33333 6.13943 6.52724 7.33333 8 7.33333Z" />
                        <path d="M3.33333 14V12.6667C3.33333 11.9594 3.61428 11.2811 4.11438 10.781C4.61448 10.281 5.29276 10 6 10H10C10.7072 10 11.3855 10.281 11.8856 10.781C12.3857 11.2811 12.6667 11.9594 12.6667 12.6667V14" />
                      </svg>
                      <select className="w-full h-[37px] appearance-none rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-10 text-[14px] text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4]">
                        <option value=""></option>
                        {mockTeamMembers.map((member) => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Discipline */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Discipline</label>
                    <div className="relative">
                      <select className="w-full h-[37px] appearance-none rounded-[10px] border border-[#E5E7EB] bg-white px-4 pr-10 text-[14px] text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4]">
                        <option value=""></option>
                        <option value="architecture">Architecture</option>
                        <option value="structure">Structure</option>
                        <option value="mep">MEP</option>
                        <option value="civil">Civil</option>
                        <option value="landscape">Landscape</option>
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Detailed Description */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">Detailed Description</label>
                  <textarea
                    placeholder="Provide detailed information about the change, including affected systems, reasoning, and expected outcomes."
                    className="w-full min-h-[117px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4] resize-none"
                  />
                </div>

                {/* Estimated Cost and Duration */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Estimated Cost */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Estimated Cost</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#99A1AF]">$</span>
                      <input
                        type="text"
                        placeholder="e.g., 10,000"
                        className="w-full h-[37px] rounded-[10px] border border-[#E5E7EB] bg-white pl-7 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4]"
                      />
                    </div>
                  </div>

                  {/* Estimated Duration */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-normal text-[#101828]">Estimated Duration</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                        <circle cx="8" cy="8" r="6.5" />
                        <path d="M8 4v4l2.5 2.5" />
                      </svg>
                      <input
                        type="text"
                        placeholder="e.g., 2 weeks"
                        className="w-full h-[37px] rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#00A6F4] focus:outline-none focus:ring-1 focus:ring-[#00A6F4]"
                      />
                    </div>
                  </div>
                </div>

                {/* Reviewers */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">Reviewers</label>
                  <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB]">
                    {mockTeamMembers.map((member) => (
                      <label key={member.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" className="h-4 w-4 rounded border-[#D1D5DC] text-[#155DFC] focus:ring-blue-500" />
                        <svg className="h-4 w-4 text-[#99A1AF]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                          <path d="M8 7.33333C9.47276 7.33333 10.6667 6.13943 10.6667 4.66667C10.6667 3.19391 9.47276 2 8 2C6.52724 2 5.33333 3.19391 5.33333 4.66667C5.33333 6.13943 6.52724 7.33333 8 7.33333Z" />
                          <path d="M3.33333 14V12.6667C3.33333 11.9594 3.61428 11.2811 4.11438 10.781C4.61448 10.281 5.29276 10 6 10H10C10.7072 10 11.3855 10.281 11.8856 10.781C12.3857 11.2811 12.6667 11.9594 12.6667 12.6667V14" />
                        </svg>
                        <span className="text-[14px] text-[#101828]">{member.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Affected Models - Dynamic from project documents */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">Affected Models</label>
                  <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] divide-y divide-[#E5E7EB]">
                    {(() => {
                      // Extract all files from mockDocuments
                      const extractFiles = (folder: DocFolder): { id: string; name: string }[] => {
                        const files: { id: string; name: string }[] = [];
                        folder.children.forEach((child) => {
                          if (child.type === 'file') {
                            files.push({ id: child.id, name: child.name });
                          } else if (child.type === 'folder' && child.children) {
                            files.push(...extractFiles(child));
                          }
                        });
                        return files;
                      };
                      const projectFiles = extractFiles(mockDocuments);
                      return projectFiles.slice(0, 5).map((file) => (
                        <label key={file.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100">
                          <input type="checkbox" className="h-4 w-4 rounded border-[#D1D5DC] text-[#155DFC] focus:ring-blue-500 bg-[#F9FAFB]" />
                          <svg className="h-4 w-4 text-[#6A7282]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                            <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z" />
                            <path d="M9.33333 1.33333V5.33333H13.3333" />
                          </svg>
                          <span className="text-[14px] text-[#101828]">{file.name}</span>
                        </label>
                      ));
                    })()}
                  </div>
                </div>

                {/* Attachments */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal text-[#101828]">Attachments</label>
                  <div className="rounded-[10px] border border-dashed border-[#D1D5DC] bg-[#F9FAFB] py-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                    <svg className="h-8 w-8 text-[#99A1AF] mb-3" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M21.333 21.333L16 16L10.667 21.333" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16 16V28" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M27.187 24.52C28.458 23.787 29.431 22.63 29.936 21.246C30.441 19.862 30.447 18.34 29.953 16.952C29.459 15.564 28.495 14.399 27.229 13.656C25.964 12.913 24.477 12.641 23.04 12.88H21.467C21.029 11.207 20.207 9.66 19.067 8.368C17.927 7.077 16.502 6.078 14.905 5.454C13.309 4.829 11.586 4.598 9.879 4.778C8.172 4.959 6.531 5.546 5.096 6.489C3.66 7.433 2.471 8.707 1.626 10.207C0.78 11.707 0.304 13.39 0.238 15.114C0.172 16.839 0.519 18.555 1.249 20.117C1.979 21.68 3.069 23.043 4.427 24.093" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21.333 21.333L16 16L10.667 21.333" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-[14px] text-[#364153] mb-1">Drop files here or click to upload</p>
                    <p className="text-[12px] text-[#6A7282]">Supported: PDF, DWG, RVT, JPG, PNG (Max 50MB)</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] shrink-0">
                <button 
                  onClick={() => setIsNewRequestModalOpen(false)} 
                  className="text-[14px] font-normal text-[#364153] hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button className="inline-flex items-center gap-2 rounded-[10px] bg-[#93B4FF] px-4 py-2.5 text-[14px] font-normal text-white hover:bg-[#155DFC] transition-colors">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
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
          <ClashesTab />
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <TeamsTab projectPublicId={project.publicId} currentUserRole={project.role as 'admin' | 'member' | 'viewer'} />
        )}

        {/* Extensions Tab */}
        {activeTab === 'extensions' && (
          <ExtensionsTab />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsTab projectName={project.name} projectCode={project.publicId} projectDescription={project.description} />
        )}
  
        {/* Other Tabs - Placeholder (only for tabs without content yet) */}
        {!['overview', 'packages', 'documents', 'versions', 'changes', 'tasks', 'clashes', 'teams', 'extensions', 'settings'].includes(activeTab) && (
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

        {/* Create Task Modal */}
        <CreateTaskModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          onSubmit={(task) => console.log('New task created:', task)}
        />
      </div>
    </div>
  );
}


