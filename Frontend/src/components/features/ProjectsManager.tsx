'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, DragOverlay, PointerSensor, rectIntersection, useDroppable, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NewProjectButton } from './CreateProjectModal';
import type { CreatedProjectPayload } from './CreateProjectModal';
import { loadCustomIndustriesRaw } from './CreateProjectModal';
import { ProjectsSkeleton } from '@/components/ui/skeletons';
import { useAppStore } from '@/stores/appStore';

// Types
interface Folder {
  id: string;
  name: string;
  color: string;
  projectCount: number;
  description?: string;
}

interface ApiFolder {
  publicId: string;
  name: string;
  color?: string;
  description?: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  thumbnail: string;
  lastVisited: string;
  category: string;
  description?: string;
  progress?: number;
  teamMembers?: number;
  issues?: number;
  status?: string;
  projectType?: string;
  industryName?: string;
  customIndustry?: {
    icon: string;
    color: string;
  };
  isFavorite?: boolean;
  sortOrder?: number;
  folderIds?: string[];
  role?: 'admin' | 'member' | 'viewer';
}

interface ApiProject {
  publicId: string;
  name: string;
  description?: string;
  industry?: string;
  coverImageUrl?: string;
  folderId?: string | null;
  folderIds?: string[];
  role?: string;
  status?: string;
  lastVisitedAt?: string | null;
  isFavorite?: boolean;
  sortOrder?: number;
}

interface ProjectsManagerProps {
  initialFolders?: Folder[];
  initialProjects?: Project[];
}

const PROJECTS_CACHE_KEY = 'orbit:projects:me';
const FOLDERS_CACHE_KEY = 'orbit:folders:me';
const PROJECTS_CACHE_TTL_MS = 30_000;
const FOLDERS_CACHE_TTL_MS = 45_000;

// Folder colors matching the design
const FOLDER_COLORS = [
  { id: 'blue', bg: 'bg-blue-100', icon: 'text-blue-500', border: 'border-blue-200' },
  { id: 'red', bg: 'bg-red-100', icon: 'text-red-500', border: 'border-red-200' },
  { id: 'orange', bg: 'bg-orange-100', icon: 'text-orange-500', border: 'border-orange-200' },
  { id: 'pink', bg: 'bg-pink-100', icon: 'text-pink-500', border: 'border-pink-200' },
  { id: 'purple', bg: 'bg-purple-100', icon: 'text-purple-500', border: 'border-purple-200' },
  { id: 'green', bg: 'bg-green-100', icon: 'text-green-500', border: 'border-green-200' },
  { id: 'indigo', bg: 'bg-indigo-100', icon: 'text-indigo-500', border: 'border-indigo-200' },
  { id: 'violet', bg: 'bg-violet-100', icon: 'text-violet-500', border: 'border-violet-200' },
  { id: 'rose', bg: 'bg-rose-100', icon: 'text-rose-500', border: 'border-rose-200' },
  { id: 'yellow', bg: 'bg-yellow-100', icon: 'text-yellow-600', border: 'border-yellow-200' },
  { id: 'cyan', bg: 'bg-cyan-100', icon: 'text-cyan-500', border: 'border-cyan-200' },
  { id: 'gray', bg: 'bg-gray-100', icon: 'text-gray-500', border: 'border-gray-200' },
];

// Project type configuration - matches CreateProjectModal industries
const TYPE_CONFIG: Record<string, { color: string; bg: string; bgSolid: string; icon: React.ReactNode; label: string }> = {
  construction: {
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    bgSolid: 'bg-blue-500',
    label: 'Construction',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  },
  software: {
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    bgSolid: 'bg-cyan-500',
    label: 'Software',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
  },
  marketing: {
    color: 'text-red-600',
    bg: 'bg-red-50',
    bgSolid: 'bg-red-500',
    label: 'Marketing',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
  },
  design: {
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    bgSolid: 'bg-purple-500',
    label: 'Design',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
  },
  research: {
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    bgSolid: 'bg-teal-500',
    label: 'Research',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  finance: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    bgSolid: 'bg-emerald-500',
    label: 'Finance',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
  },
  education: {
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    bgSolid: 'bg-cyan-500',
    label: 'Education',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
  },
  healthcare: {
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    bgSolid: 'bg-rose-500',
    label: 'Healthcare',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
  },
  legal: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    bgSolid: 'bg-emerald-600',
    label: 'Legal',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
  },
  travel: {
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    bgSolid: 'bg-blue-500',
    label: 'Travel',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
  },
  retail: {
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    bgSolid: 'bg-pink-500',
    label: 'Retail',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
  },
  technology: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    bgSolid: 'bg-emerald-500',
    label: 'Technology',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
  },
  energy: {
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    bgSolid: 'bg-amber-500',
    label: 'Energy',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  },
  'food-beverage': {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    bgSolid: 'bg-emerald-500',
    label: 'Food & Beverage',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  entertainment: {
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    bgSolid: 'bg-pink-500',
    label: 'Entertainment',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
  },
  media: {
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    bgSolid: 'bg-blue-500',
    label: 'Media',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  },
  gaming: {
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    bgSolid: 'bg-purple-500',
    label: 'Gaming',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  publishing: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    bgSolid: 'bg-emerald-500',
    label: 'Publishing',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
  },
  startup: {
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    bgSolid: 'bg-rose-500',
    label: 'Startup',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
  },
  other: {
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    bgSolid: 'bg-gray-500',
    label: 'Other',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
  },
  default: {
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    bgSolid: 'bg-gray-500',
    label: 'Project',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
  },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-500', text: 'text-white' },
  review: { bg: 'bg-amber-500', text: 'text-white' },
  paused: { bg: 'bg-gray-500', text: 'text-white' },
  planning: { bg: 'bg-gray-400', text: 'text-white' },
  completed: { bg: 'bg-blue-500', text: 'text-white' },
};

// Helper functions
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
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function mapApiProjectToUiProject(project: ApiProject): Project {
  // Try to find custom industry data from localStorage
  let customIndustry: { icon: string; color: string } | undefined;
  if (project.industry) {
    const storedCustoms = loadCustomIndustriesRaw();
    const stored = storedCustoms.find((c) => c.name && project.industry && toSlug(c.name) === toSlug(project.industry));
    if (stored) {
      customIndustry = {
        icon: stored.iconId,
        color: stored.colorId,
      };
    }
  }
  
  return {
    id: project.publicId,
    name: project.name,
    slug: toSlug(project.name || project.publicId),
    thumbnail: project.coverImageUrl || '',
    lastVisited: project.lastVisitedAt ? new Date(project.lastVisitedAt).toISOString() : new Date().toISOString(),
    category: 'shared',
    description: project.description || '',
    progress: 0,
    teamMembers: 0,
    issues: 0,
    status: project.status === 'accepted' ? 'active' : 'planning',
    projectType: project.industry ? toSlug(project.industry) : 'software',
    industryName: project.industry || '',
    isFavorite: project.isFavorite || false,
    sortOrder: project.sortOrder || 0,
    folderIds: Array.isArray(project.folderIds) ? project.folderIds : [],
    role: project.role as Project['role'],
    customIndustry,
  };
}

function mapApiFolderToUiFolder(folder: ApiFolder, projects: Project[]): Folder {
  return {
    id: folder.publicId,
    name: folder.name,
    color: folder.color || 'blue',
    description: folder.description || '',
    projectCount: projects.filter((project) => (project.folderIds || []).includes(folder.publicId)).length,
  };
}

function mapCreatedProjectToUiProject(project: CreatedProjectPayload): Project {
  const baseProject = mapApiProjectToUiProject({
    publicId: project.publicId,
    name: project.name,
    description: project.description,
    industry: project.industry,
    coverImageUrl: project.coverImageUrl,
    role: project.role,
    status: project.status,
    sortOrder: project.sortOrder,
  });
  
  return {
    ...baseProject,
    customIndustry: project.customIndustry,
  };
}

// Folder Icon Component
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

// Create Folder Modal (also used for editing)
function CreateFolderModal({
  isOpen,
  onClose,
  onCreateFolder,
  editFolder,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (folder: { name: string; description: string; color: string }) => void;
  editFolder?: Folder | null;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  useEffect(() => {
    if (isOpen) {
      if (editFolder) {
        setName(editFolder.name);
        setDescription(editFolder.description || '');
        setSelectedColor(editFolder.color || 'blue');
      } else {
        setName('');
        setDescription('');
        setSelectedColor('blue');
      }
    }
  }, [isOpen, editFolder]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateFolder({ name: name.trim(), description: description.trim(), color: selectedColor });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <FolderIcon className="h-5 w-5 text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{editFolder ? 'Edit Folder' : 'Create New Folder'}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Folder Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Campaigns"
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this folder..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">Folder Color</label>
            <div className="grid grid-cols-6 gap-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColor(color.id)}
                  className={cn(
                    'relative flex h-12 w-full items-center justify-center rounded-lg border-2 transition-all',
                    color.bg,
                    selectedColor === color.id ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                  )}
                >
                  <FolderIcon className={cn('h-6 w-6', color.icon)} />
                  {selectedColor === color.id && (
                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editFolder ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Folder Card Component
function FolderCard({
  folder,
  onClick,
  onEdit,
  onDelete,
}: {
  folder: Folder;
  onClick: () => void;
  onEdit: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const colorConfig = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  });

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div ref={setNodeRef} className="relative">
      <button
        onClick={onClick}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left transition-all hover:border-gray-200 hover:shadow-sm',
          isOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'
        )}
      >
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', colorConfig.bg)}>
          <FolderIcon className={cn('h-5 w-5', colorConfig.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-gray-900">{folder.name}</h3>
          <p className="text-xs text-gray-500">{folder.projectCount} projects</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="opacity-0 group-hover:opacity-100 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-3 top-14 z-50 w-36 rounded-xl border border-gray-200 bg-white shadow-lg py-1"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(folder); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(folder); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// Trash Drop Zone Component
function TrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash:zone',
    data: { type: 'trash' },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-all',
        isOver
          ? 'border-red-400 bg-red-50 text-red-600 scale-[1.02]'
          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-500'
      )}
    >
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
        isOver ? 'bg-red-100' : 'bg-gray-100'
      )}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={cn('text-sm font-medium transition-colors', isOver ? 'text-red-700' : 'text-gray-600')}>
          {isOver ? 'Release to move to trash' : 'Trash'}
        </h3>
        <p className="text-xs text-gray-400">Drag a project here to delete</p>
      </div>
      <a
        href="/trash"
        draggable={false}
        onDragStart={(e) => {
          e.preventDefault();
          const img = new Image();
          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          e.dataTransfer.setDragImage(img, 0, 0);
        }}
        onClick={e => e.stopPropagation()}
        className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        View
      </a>
    </div>
  );
}

// Helper to get type config - handles both predefined and custom industries
function getProjectTypeConfig(
  projectType: string | undefined, 
  industryName: string | undefined,
  customIndustry?: { icon: string; color: string }
) {
  if (!projectType && !industryName) return TYPE_CONFIG.software;
  
  const typeKey = projectType?.toLowerCase();
  if (typeKey && TYPE_CONFIG[typeKey]) {
    return TYPE_CONFIG[typeKey];
  }
  
  // Handle custom industries with user-selected icon and color
  if (industryName) {
    const colorClass = customIndustry?.color || 'gray';
    return {
      color: `text-${colorClass}-600`,
      bg: `bg-${colorClass}-50`,
      bgSolid: `bg-${colorClass}-500`,
      label: industryName,
      icon: getCustomIconById(customIndustry?.icon || 'building'),
    };
  }
  
  return TYPE_CONFIG.software;
}

// Get custom icon SVG by icon ID
function getCustomIconById(iconId: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    building: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    code: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    megaphone: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
    scale: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
    palette: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
    chart: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    bank: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
    music: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
    cloud: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
    heart: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    scissors: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>,
    book: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  };
  return icons[iconId] || icons.building;
}

// Project List Item Component (for list view)
function ProjectListItem({ project, isDragging = false, memberCounts, onToggleFavorite }: { project: Project; isDragging?: boolean; memberCounts: Record<string, number>; onToggleFavorite?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: `project:${project.id}`,
    data: { type: 'project', projectId: project.id },
  });
  const type = getProjectTypeConfig(project.projectType, project.industryName, project.customIndustry);
  const status = STATUS_COLORS[project.status || 'active'] || STATUS_COLORS.active;
  const progress = project.progress || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const memberCount = memberCounts[project.id] ?? project.teamMembers ?? 0;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      transition={{ type: 'spring', stiffness: 140, damping: 24, mass: 1.1 }}
      className={cn(
        'group relative flex items-stretch gap-0 overflow-hidden rounded-xl border border-gray-100 bg-white transition-all duration-200',
        (isDragging || isSortableDragging) && 'scale-[0.98] opacity-80 pointer-events-none',
        !isDragging && !isSortableDragging && 'hover:border-gray-200 hover:shadow-sm'
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ? transition.replace(/\d+(\.\d+)?ms/g, '260ms') : undefined,
      }}
    >
      {/* Left accent bar */}
      <div className={cn('w-1 shrink-0 rounded-l-xl', type.bgSolid || type.bg)} />

      {/* Main content — clickable link */}
      <a
        href={`/projects/${project.id}`}
        draggable={false}
        onDragStart={(e) => {
          e.preventDefault();
          const img = new Image();
          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          e.dataTransfer.setDragImage(img, 0, 0);
        }}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3"
        onClick={(e) => {
          // Let dnd-kit handle drag, only navigate on simple click
          if (e.defaultPrevented) return;
        }}
      >
        {/* Type Icon */}
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', type.bg)}>
          <span className={type.color}>{type.icon}</span>
        </div>

        {/* Project Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-gray-900 text-sm">{project.name}</h3>
            {project.isFavorite && (
              <svg className="h-3.5 w-3.5 shrink-0 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">{project.description || type.label}</p>
        </div>

        {/* Stats Row */}
        <div className="hidden shrink-0 items-center gap-6 xl:flex">
          {/* Progress */}
          <div className="flex w-24 items-center gap-2">
            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-medium text-gray-600 tabular-nums">{progress}%</span>
          </div>

          {/* Members */}
          <div className="flex w-16 items-center gap-1.5 text-xs text-gray-500">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="tabular-nums">{memberCount}</span>
          </div>

          {/* Issues */}
          {(project.issues ?? 0) > 0 && (
            <div className="flex w-16 items-center gap-1.5 text-xs text-red-500">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="tabular-nums">{project.issues}</span>
            </div>
          )}

          {/* Last visited */}
          <div className="flex w-24 items-center gap-1.5 text-xs text-gray-400">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">{formatRelativeTime(project.lastVisited)}</span>
          </div>
        </div>

        {/* Type + Status badges — mobile friendly */}
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium xl:hidden', type.bg, type.color)}>
            {type.label}
          </span>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium capitalize', status.bg, status.text)}>
            {project.status}
          </span>
        </div>
      </a>

      {/* Hover Actions */}
      <div className="flex shrink-0 items-center gap-1 pr-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {/* Star / Unstar */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite?.(project.id);
          }}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            project.isFavorite
              ? "text-amber-400 hover:bg-amber-50"
              : "text-gray-400 hover:bg-amber-50 hover:text-amber-500"
          )}
          title={project.isFavorite ? 'Unstar' : 'Star'}
        >
          {project.isFavorite ? (
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
        </button>

        {/* Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
              <a
                href={`/projects/${project.id}`}
                draggable={false}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Open Project
              </a>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Move to Trash
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Project Grid Card Component (for grid view)
function ProjectGridCard({ project, isDragging = false, memberCounts, onToggleFavorite }: { project: Project; isDragging?: boolean; memberCounts: Record<string, number>; onToggleFavorite?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: `project:${project.id}`,
    data: { type: 'project', projectId: project.id },
  });
  const type = getProjectTypeConfig(project.projectType, project.industryName, project.customIndustry);
  const status = STATUS_COLORS[project.status || 'active'] || STATUS_COLORS.active;
  const progress = project.progress || 0;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if dnd-kit detected a drag (the distance threshold)
    if ((e.target as HTMLElement).closest('button, [role="button"]')) return;
    window.location.href = `/projects/${project.id}`;
  };

  return (
    <motion.div
      ref={setNodeRef}
      onClick={handleCardClick}
      {...attributes}
      {...listeners}
      layout
      transition={{ type: 'spring', stiffness: 150, damping: 26, mass: 1.05 }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group flex h-full min-h-[340px] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white transition-[transform,opacity] duration-200 cursor-pointer',
        (isDragging || isSortableDragging) && 'scale-[0.98] opacity-40 pointer-events-none'
      )}
    >
      {/* Image - show real image if available, fallback to gradient */}
      <div className="relative h-36 overflow-hidden">
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
        {/* Fallback gradient with icon - use type config */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          project.thumbnail ? "hidden" : ""
        )}>
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-xl",
            type.bg,
            type.color
          )}>
            {type.icon}
          </div>
        </div>
        {/* Favorite Star */}
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite?.(project.id);
          }}
          className="absolute left-3 top-3 cursor-pointer"
        >
          {project.isFavorite ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 shadow-lg transition-transform hover:scale-110">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 opacity-0 backdrop-blur-sm shadow-sm transition-all duration-150 group-hover:opacity-100 hover:scale-110">
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          )}
        </div>
        {/* Status Badge */}
        <div className="absolute right-3 top-3">
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', status.bg, status.text)}>
            {project.status}
          </span>
        </div>
        {/* Type Badge */}
        <div className="absolute bottom-3 left-3">
          <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', type.bg, type.color)}>
            {type.icon}
            {type.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 font-medium text-gray-900 line-clamp-1">{project.name}</h3>
        <p className="mb-3 text-xs text-gray-500 line-clamp-1">{project.description}</p>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium text-gray-900">{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {memberCounts[project.id] ?? project.teamMembers ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {project.issues || 0}
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatRelativeTime(project.lastVisited)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// Main Projects Manager Component
// Props are optional — real data comes from the Zustand store/API, not from Astro SSR.
export default function ProjectsManager(_props?: ProjectsManagerProps) {
  // Read sessionStorage cache synchronously on mount — no async, no skeleton flicker.
  const getCachedProjects = (): Project[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem('orbit:projects:me');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { data: Project[]; expiresAt: number };
      if (parsed.expiresAt > Date.now() && Array.isArray(parsed.data)) return parsed.data;
    } catch { /* ignore */ }
    return [];
  };

  const getCachedFolders = (): Folder[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem('orbit:folders:me');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { data: ApiFolder[]; expiresAt: number };
      if (parsed.expiresAt > Date.now() && Array.isArray(parsed.data)) {
        const projects = getCachedProjects();
        return parsed.data.map((f) => mapApiFolderToUiFolder(f, projects));
      }
    } catch { /* ignore */ }
    return [];
  };

  // Track whether we have cache — determines if we can skip skeleton
  const hasSessionCache = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = sessionStorage.getItem('orbit:projects:me');
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { expiresAt: number };
      return parsed.expiresAt > Date.now();
    } catch { return false; }
  })();

  const [isHydrated, setIsHydrated] = useState(false);
  const [folders, setFolders] = useState<Folder[]>(() => getCachedFolders());
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects());
  // Only show skeleton if we have NO cache AND not hydrated yet
  const [isProjectsLoading, setIsProjectsLoading] = useState(!hasSessionCache);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('orbit-projects-view') as 'grid' | 'list') || 'grid';
  });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isMovingProject, setIsMovingProject] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isTrashing, setIsTrashing] = useState(false);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const memberCountsCacheRef = useRef<{ data: Record<string, number>; expiresAt: number } | null>(null);

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('orbit-projects-view', viewMode);
  }, [viewMode]);
  const projectsCacheRef = useRef<{ data: Project[]; expiresAt: number } | null>(null);
  const foldersCacheRef = useRef<{ data: ApiFolder[]; expiresAt: number } | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const loadProjectsRef = useRef<(showLoading?: boolean, options?: { force?: boolean }) => Promise<Project[]>>(
    async () => [] as Project[]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0,
      },
    })
  );

  // Get projects for current folder using folderId from project data
  const getProjectsForFolder = (folderId: string) => {
    return projects.filter(p => (p.folderIds || []).includes(folderId));
  };

  // Filter folders by search
  const filteredFolders = folders.filter(
    f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get filtered projects (when viewing a folder)
  const currentFolderProjects = currentFolder
    ? getProjectsForFolder(currentFolder.id)
        .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter(p => !filterStatus || p.status === filterStatus)
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    : [];

  // Starred projects (favorites) — shown in dedicated section
  const starredProjects = projects
    .filter(p => p.isFavorite)
    .filter(p => !filterStatus || p.status === filterStatus)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  // All projects sorted by starred first, then by sortOrder
  const allProjects = projects
    .filter(p => !filterStatus || p.status === filterStatus)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    });

  // Get priority projects (when on main view) — non-favorited active/review projects
  const priorityProjects = projects
    .filter(p => !p.isFavorite)
    .filter(p => p.status === 'active' || p.status === 'review')
    .filter(p => !filterStatus || p.status === filterStatus)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  // Handle create folder
  const handleCreateFolder = async (folderData: { name: string; description: string; color: string }) => {
    const requestPromise = (async () => {
      const response = await fetch('/api/folders/create', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(folderData),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Create folder failed');
      }

      const updatedProjects = await loadProjects(false, { force: true });
      await loadFolders(updatedProjects, { force: true });
      return folderData;
    })();

    await toast.promise(requestPromise, {
      loading: 'Creating folder...',
      success: (data) => `${data.name} has been created successfully`,
      error: (err) => err?.message || 'Failed to create folder',
    });
  };

  const handleEditFolder = async (folderData: { name: string; description: string; color: string }) => {
    if (!editingFolder) return;
    const requestPromise = (async () => {
      const response = await fetch(`/api/folders/${editingFolder.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(folderData),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Update folder failed');
      }

      const updatedProjects = await loadProjects(false, { force: true });
      await loadFolders(updatedProjects, { force: true });
      return folderData;
    })();

    await toast.promise(requestPromise, {
      loading: 'Updating folder...',
      success: () => `Folder updated successfully`,
      error: (err) => err?.message || 'Failed to update folder',
    });
    setEditingFolder(null);
  };

  const handleDeleteFolder = async (folder: Folder) => {
    setDeletingFolder(folder);
  };

  const confirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    const folderName = deletingFolder.name;
    const requestPromise = (async () => {
      const response = await fetch(`/api/folders/${deletingFolder.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Delete folder failed');
      }

      if (currentFolder?.id === deletingFolder.id) {
        setCurrentFolder(null);
      }
      const updatedProjects = await loadProjects(false, { force: true });
      await loadFolders(updatedProjects, { force: true });
    })();

    await toast.promise(requestPromise, {
      loading: 'Deleting folder...',
      success: () => `${folderName} has been deleted`,
      error: (err) => err?.message || 'Failed to delete folder',
    });
    setDeletingFolder(null);
  };

  const upsertProject = useCallback((nextProject: Project) => {
    setProjects((prev) => {
      const exists = prev.some((item) => item.id === nextProject.id);
      if (exists) {
        return prev.map((item) => (item.id === nextProject.id ? { ...item, ...nextProject } : item));
      }
      return [nextProject, ...prev];
    });
  }, []);

  const handleProjectCreated = async (project: CreatedProjectPayload) => {
    upsertProject(mapCreatedProjectToUiProject(project));
    const updatedProjects = await loadProjects(false, { force: true });
    await loadFolders(updatedProjects, { force: true });
  };

  const loadProjects = useCallback(async (
    showLoading = false,
    options?: { force?: boolean }
  ): Promise<Project[]> => {
    const shouldForce = options?.force === true;

    if (!shouldForce && projectsCacheRef.current && projectsCacheRef.current.expiresAt > Date.now()) {
      const cached = projectsCacheRef.current.data;
      setProjects(cached);
      return cached;
    }

    // ── 1. Check Zustand store (populated by DashboardLayout on app init) ────
    // Use getState() for stable read inside callbacks — avoids stale closures.
    const storeProjects = useAppStore.getState().projects;
    if (!shouldForce && storeProjects.length > 0) {
      const nextProjects = storeProjects.map(mapApiProjectToUiProject);
      setProjects(nextProjects);
      return nextProjects;
    }

    // ── 2. Check sessionStorage cache ─────────────────────────────────────────
    if (!shouldForce && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(PROJECTS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { data: Project[]; expiresAt: number };
          if (parsed.expiresAt > Date.now() && Array.isArray(parsed.data)) {
            projectsCacheRef.current = parsed;
            setProjects(parsed.data);
            return parsed.data;
          }
        }
      } catch {
        // ignore cache parse errors
      }
    }

    if (showLoading) setIsProjectsLoading(true);

    try {
      const response = await fetch('/api/projects/me', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) return [];

      const payload = await response.json();
      const apiProjects: ApiProject[] = Array.isArray(payload?.data) ? payload.data : [];
      const nextProjects = apiProjects.map(mapApiProjectToUiProject);
      const cacheValue = { data: nextProjects, expiresAt: Date.now() + PROJECTS_CACHE_TTL_MS };

      projectsCacheRef.current = cacheValue;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(cacheValue));
      }
      // Keep Zustand store in sync so other pages don't refetch
      useAppStore.getState().setProjects(apiProjects);
      setProjects(nextProjects);
      return nextProjects;
    } catch {
      return [];
    } finally {
      if (showLoading) setIsProjectsLoading(false);
    }
  }, []); // deps intentionally empty — all reads via getState() / stable refs
  loadProjectsRef.current = loadProjects;

  const loadMemberCounts = useCallback(async (projectsSource: Project[]) => {
    if (projectsSource.length === 0) return;

    if (memberCountsCacheRef.current && memberCountsCacheRef.current.expiresAt > Date.now()) {
      setMemberCounts(memberCountsCacheRef.current.data);
      return;
    }

    try {
      const projectIds = projectsSource.map((p) => p.id);
      const res = await fetch('/api/projects/member-counts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectIds }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMemberCounts(data.data);
        memberCountsCacheRef.current = {
          data: data.data,
          expiresAt: Date.now() + 60000,
        };
      }
    } catch { /* silent */ }
  }, []);

  const loadFolders = useCallback(async (
    projectsSource: Project[],
    options?: { force?: boolean }
  ) => {
    const shouldForce = options?.force === true;

    if (!shouldForce && foldersCacheRef.current && foldersCacheRef.current.expiresAt > Date.now()) {
      setFolders(foldersCacheRef.current.data.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
      return;
    }

    // ── 1. Check Zustand store via getState() ────────────────────────────────
    const storeFolders = useAppStore.getState().folders;
    if (!shouldForce && storeFolders.length > 0) {
      setFolders(storeFolders.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
      return;
    }

    // ── 2. Check sessionStorage cache ─────────────────────────────────────────
    if (!shouldForce && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(FOLDERS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { data: ApiFolder[]; expiresAt: number };
          if (parsed.expiresAt > Date.now() && Array.isArray(parsed.data)) {
            foldersCacheRef.current = parsed;
            setFolders(parsed.data.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
            return;
          }
        }
      } catch {
        // ignore cache parse errors
      }
    }

    try {
      const response = await fetch('/api/folders/me', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) return;

      const payload = await response.json();
      const apiFolders: ApiFolder[] = Array.isArray(payload?.data) ? payload.data : [];
      const cacheValue = { data: apiFolders, expiresAt: Date.now() + FOLDERS_CACHE_TTL_MS };

      foldersCacheRef.current = cacheValue;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(FOLDERS_CACHE_KEY, JSON.stringify(cacheValue));
      }
      // Keep Zustand store in sync
      useAppStore.getState().setFolders(apiFolders);
      setFolders(apiFolders.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
    } catch {
      // keep fallback folders if API fails
    }
  }, []); // deps intentionally empty — all reads via getState()

  const handleDropProjectToFolder = async (projectId: string, folderId: string) => {
    if (isMovingProject) return;
    setIsMovingProject(true);

    try {
      const response = await fetch('/api/projects/move-folder', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ projectId, folderId }),
      });

      if (!response.ok) {
        return;
      }

      const updatedProjects = await loadProjects(false, { force: true });
      await loadFolders(updatedProjects, { force: true });
    } finally {
      setIsMovingProject(false);
    }
  };

  const handleTrashProject = async (projectId: string) => {
    if (isTrashing) return;
    setIsTrashing(true);

    // Optimistically remove from list
    setProjects(prev => prev.filter(p => p.id !== projectId));

    try {
      const response = await fetch('/api/projects/trash', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        // Rollback on failure
        await loadProjects(false, { force: true });
        let errorMessage = 'Failed to move project to trash';
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch {}
        toast.error(errorMessage);
        return;
      }

      // Dispatch event to remove from TopBar tabs
      window.dispatchEvent(new CustomEvent('orbit:project-removed', { 
        detail: { projectId } 
      }));

      toast.success('Project moved to trash', {
        description: 'You can restore it from the Trash page within 30 days.',
        action: { label: 'View Trash', onClick: () => { window.location.href = '/trash'; } },
      });

      await loadProjects(false, { force: true });
    } finally {
      setIsTrashing(false);
    }
  };

  const toggleFavorite = async (projectId: string) => {
    try {
      const response = await fetch('/api/projects/favorite/toggle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        toast.error('Failed to update favorite');
        return;
      }

      const data = await response.json();
      const newFavoriteState = data?.data?.isFavorite ?? false;

      // Update local state
      setProjects((prev) => prev.map((p) =>
        p.id === projectId ? { ...p, isFavorite: newFavoriteState } : p
      ));

      // Update Zustand store
      const store = useAppStore.getState();
      const updated = store.projects.map((p) =>
        p.publicId === projectId ? { ...p, isFavorite: newFavoriteState } : p
      );
      store.setProjects(updated);

      // Dispatch event to refresh sidebar favorites
      window.dispatchEvent(new CustomEvent('orbit:favorite-toggled', {
        detail: { projectId, isFavorite: newFavoriteState }
      }));

      toast.success(newFavoriteState ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      toast.error('Failed to update favorite');
    }
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


  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (!id.startsWith('project:')) return;
    setActiveProjectId(id.replace('project:', ''));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveProjectId(null);

    if (!activeId.startsWith('project:')) return;
    const draggedProjectId = activeId.replace('project:', '');

    if (overId === 'trash:zone') {
      await handleTrashProject(draggedProjectId);
      return;
    }

    if (overId?.startsWith('folder:')) {
      const folderId = overId.replace('folder:', '');
      await handleDropProjectToFolder(draggedProjectId, folderId);
      return;
    }

    if (overId?.startsWith('project:') && overId !== activeId) {
      const activeIndex = projects.findIndex((p) => p.id === draggedProjectId);
      const overProjectId = overId.replace('project:', '');
      const overIndex = projects.findIndex((p) => p.id === overProjectId);
      if (activeIndex >= 0 && overIndex >= 0) {
        setProjects((prev) => {
          const reordered = arrayMove(prev, activeIndex, overIndex);
          saveProjectOrder(reordered.map((p) => p.id));
          return reordered;
        });
      }
    }
  };

  // ── Sync Zustand store → local state. If store is empty, fall back to network fetch. ──
  // Tracks store length so this re-fires if hydration populates the store later.
  const storeProjectsLen = useAppStore(s => s.projects.length);
  useEffect(() => {
    // Read cache synchronously first — already baked into initial state above.
    // Only fetch if session cache is empty AND store is empty.
    const storeProjects = useAppStore.getState().projects;
    const hasSessionCache = (() => {
      try {
        return sessionStorage.getItem('orbit:projects:me') !== null;
      } catch { return false; }
    })();

    if (storeProjects.length > 0) {
      // Store has data — sync to local state (data already visible from cache).
      const mapped = storeProjects.map(mapApiProjectToUiProject);
      setProjects(mapped);
      setIsProjectsLoading(false);
      // Always revalidate in background so /projects still triggers fresh API call.
      loadProjects(false, { force: true }).then((fresh) => {
        const source = fresh.length > 0 ? fresh : mapped;
        if (source.length > 0) loadFolders(source, { force: true });
        loadMemberCounts(source);
      });
      return;
    }

    if (hasSessionCache) {
      // Session cache exists — data already visible. Revalidate in background silently.
      loadProjects(false, { force: true }).then((fetched) => {
        if (fetched.length > 0) loadFolders(fetched, { force: true });
        loadMemberCounts(fetched);
      });
      return;
    }

    // No cache, no store — must fetch. Show skeleton only in this rare case.
    loadProjects(true, { force: true }).then((fetched) => {
      if (fetched.length > 0) loadFolders(fetched, { force: true });
      loadMemberCounts(fetched);
    });
  }, [storeProjectsLen]); // fires on mount (0) and again when hydration populates the store (N)

  // Close filter menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { setIsHydrated(true); }, []);

  // ── Socket: reuse the singleton from the store — no duplicate connections ─────
  useEffect(() => {
    const storeSocket = useAppStore.getState().socket;
    if (storeSocket) socketRef.current = storeSocket;

    const handleCreated = (payload: { project?: CreatedProjectPayload; data?: CreatedProjectPayload } | CreatedProjectPayload) => {
      const incoming = 'publicId' in payload ? payload : payload.project || payload.data;
      if (!incoming?.publicId) return;
      upsertProject(mapCreatedProjectToUiProject(incoming));
    };

    const handleUpdated = (payload: { project?: CreatedProjectPayload; data?: CreatedProjectPayload } | CreatedProjectPayload) => {
      const incoming = 'publicId' in payload ? payload : payload.project || payload.data;
      if (!incoming?.publicId) return;
      upsertProject(mapCreatedProjectToUiProject(incoming));
    };

    const socket = storeSocket ?? socketRef.current;
    if (!socket) return;

    socket.on('project:created', handleCreated);
    socket.on('project:updated', handleUpdated);

    // Refresh member counts when team membership changes
    const handleMemberJoined = (payload: { projectId: string }) => {
      if (!payload?.projectId) return;
      setMemberCounts(prev => ({ ...prev, [payload.projectId]: (prev[payload.projectId] || 0) + 1 }));
      memberCountsCacheRef.current = null;
      loadProjectsRef.current(false, { force: true });
    };

    socket.on('project:member:joined', handleMemberJoined);

    // Reload projects when cache is invalidated (e.g. invite accepted, member removed)
    const handleCacheInvalidate = (payload: { data: { cacheTypes: string[]; userId: string } }) => {
      const { cacheTypes } = payload.data ?? {};
      if (!Array.isArray(cacheTypes)) return;
      if (cacheTypes.includes('projects')) {
        // Invalidate local cache so next load fetches fresh data
        projectsCacheRef.current = null;
        loadProjectsRef.current(false, { force: true });
      }
    };

    // If current user is removed from a project while staying on /projects,
    // remove it from UI immediately, then revalidate in background.
    const handleMemberRemoved = (payload: { projectId: string }) => {
      if (!payload?.projectId) return;
      setProjects((prev) => prev.filter((p) => p.id !== payload.projectId));
      setMemberCounts(prev => {
        const next = { ...prev };
        delete next[payload.projectId];
        return next;
      });
      projectsCacheRef.current = null;
      memberCountsCacheRef.current = null;
      loadProjectsRef.current(false, { force: true });
    };

    socket.on('cache:invalidate', handleCacheInvalidate);
    socket.on('member:removed', handleMemberRemoved);

    return () => {
      socket.off('project:created', handleCreated);
      socket.off('project:updated', handleUpdated);
      socket.off('project:member:joined', handleMemberJoined);
      socket.off('member:removed', handleMemberRemoved);
      socket.off('cache:invalidate', handleCacheInvalidate);
    };
  }, []); // intentionally empty — socket events handle their own lifecycle

  // Only show skeleton on initial load when there's no cache at all
  if (!isHydrated && !hasSessionCache) return <ProjectsSkeleton />;

  const activeProject = activeProjectId
    ? projects.find((project) => project.id === activeProjectId) || null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <NewProjectButton onProjectCreated={handleProjectCreated} />

        <button
          onClick={() => setShowFolderModal(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]"
        >
          <FolderIcon className="h-4 w-4" />
          New Folder
        </button>

        {/* Search */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter & View Toggle */}
        <div className="flex items-center gap-2">
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all',
                filterStatus
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter
            </button>
            
            {showFilterMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
                <button
                  onClick={() => { setFilterStatus(null); setShowFilterMenu(false); }}
                  className={cn('flex w-full items-center px-3 py-2 text-sm', !filterStatus ? 'bg-gray-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50')}
                >
                  All Projects
                </button>
                {['active', 'review', 'paused', 'planning', 'completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => { setFilterStatus(status); setShowFilterMenu(false); }}
                    className={cn('flex w-full items-center px-3 py-2 text-sm capitalize', filterStatus === status ? 'bg-gray-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50')}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {currentFolder && (
        <nav className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCurrentFolder(null)}
            className="text-gray-500 hover:text-gray-900 transition-colors"
          >
            Projects
          </button>
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-900">{currentFolder.name}</span>
        </nav>
      )}

      {/* Main Content */}
      {!currentFolder ? (
        <>
          {/* Folders + Trash Section */}
          <section>
            <h2 className="mb-4 text-sm font-medium text-gray-900">Folders</h2>
            {filteredFolders.length > 0 ? (
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                {filteredFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onClick={() => setCurrentFolder(folder)}
                    onEdit={(f) => { setEditingFolder(f); setShowFolderModal(true); }}
                    onDelete={(f) => handleDeleteFolder(f)}
                  />
                ))}
                <TrashDropZone />
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                <TrashDropZone />
              </div>
            )}
          </section>

          {/* Starred / Favorited Projects Section */}
          <AnimatePresence>
            {starredProjects.length > 0 && (
              <motion.section
                key="favorites-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Favorites
                </h2>
                <SortableContext
                  items={starredProjects.map((project) => `project:${project.id}`)}
                  strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
                >
                  <div className={cn(
                    viewMode === 'grid'
                      ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
                      : 'space-y-3'
                  )}>
                    {starredProjects.map((project) => (
                      viewMode === 'grid'
                        ? <motion.div key={project.id} layout>
                            <ProjectGridCard project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                          </motion.div>
                        : <motion.div key={project.id} layout>
                            <ProjectListItem project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                          </motion.div>
                    ))}
                  </div>
                </SortableContext>
              </motion.section>
            )}
          </AnimatePresence>

          {/* All Projects Section */}
          <section>
            <h2 className="mb-4 text-sm font-medium text-gray-900">
              {starredProjects.length > 0 ? 'All Projects' : 'Projects'}
            </h2>
            <SortableContext
              items={priorityProjects.length > 0 ? priorityProjects.map((project) => `project:${project.id}`) : allProjects.filter(p => !p.isFavorite).map((project) => `project:${project.id}`)}
              strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
            >
              <AnimatePresence mode="popLayout">
                {priorityProjects.length > 0 ? (
                  <div className={cn(
                    viewMode === 'grid'
                      ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
                      : 'space-y-3'
                  )}>
                    {priorityProjects.map((project) => (
                      viewMode === 'grid'
                        ? <motion.div key={project.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                            <ProjectGridCard project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                          </motion.div>
                        : <motion.div key={project.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                            <ProjectListItem project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                          </motion.div>
                    ))}
                  </div>
                ) : allProjects.filter(p => !p.isFavorite).length > 0 ? (
                  <div className={cn(
                    viewMode === 'grid'
                      ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
                      : 'space-y-3'
                  )}>
                    {allProjects.filter(p => !p.isFavorite).map((project) => (
                      viewMode === 'grid'
                        ? <motion.div key={project.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                            <ProjectGridCard project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                          </motion.div>
                        : <motion.div key={project.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                            <ProjectListItem project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                          </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center"
                  >
                    <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">No projects yet</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </SortableContext>
          </section>
        </>
      ) : (
        /* Folder Detail View */
        <section>
          {currentFolderProjects.length > 0 ? (
            <SortableContext
              items={currentFolderProjects.map((project) => `project:${project.id}`)}
              strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
            >
            <AnimatePresence mode="popLayout">
            <div className={cn(
              viewMode === 'grid'
                ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
                : 'space-y-3'
            )}>
              {currentFolderProjects.map((project) => (
                viewMode === 'grid'
                  ? <motion.div key={project.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                      <ProjectGridCard project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                    </motion.div>
                  : <motion.div key={project.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                      <ProjectListItem project={project} isDragging={activeProjectId === project.id} memberCounts={memberCounts} onToggleFavorite={toggleFavorite} />
                    </motion.div>
              ))}
            </div>
            </AnimatePresence>
            </SortableContext>
          ) : (
            /* Empty Folder State */
            <motion.div
              key="folder-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-4">
                <FolderIcon className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">This folder is empty</h3>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
                Start adding projects to organize your work. Projects in this folder will appear here.
              </p>
              <NewProjectButton />
            </motion.div>
          )}
        </section>
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showFolderModal}
        onClose={() => { setShowFolderModal(false); setEditingFolder(null); }}
        onCreateFolder={editingFolder ? handleEditFolder : handleCreateFolder}
        editFolder={editingFolder}
      />

      {/* Delete Folder Confirmation */}
      {deletingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeletingFolder(null)} />
          <div className="relative z-50 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Folder</h3>
                <p className="text-sm text-gray-500">Are you sure you want to delete "{deletingFolder.name}"? Projects inside will not be deleted.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingFolder(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFolder}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <DragOverlay>
        {activeProject ? (
          viewMode === 'grid' ? (
            <div className="w-[280px] rounded-xl border border-gray-200 bg-white shadow-2xl ring-2 ring-blue-400/30 overflow-hidden">
              <div className="relative h-24 overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100">
                {activeProject.thumbnail ? (
                  <img
                    src={activeProject.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : null}
              </div>
              <div className="p-3">
                <h4 className="font-medium text-gray-900 text-sm truncate">{activeProject.name}</h4>
                <p className="text-xs text-gray-500 mt-0.5 truncate">/projects/{activeProject.slug}</p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[760px] rounded-xl border border-gray-200 bg-white shadow-2xl ring-2 ring-blue-400/30 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-gray-900 text-sm truncate">{activeProject.name}</h4>
                  <p className="text-xs text-gray-500 truncate">/projects/{activeProject.slug}</p>
                </div>
              </div>
            </div>
          )
        ) : null}
      </DragOverlay>

    </div>
    </DndContext>
  );
}

export { CreateFolderModal };
