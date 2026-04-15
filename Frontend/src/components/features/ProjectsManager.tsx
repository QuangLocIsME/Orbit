'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { motion } from 'framer-motion';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NewProjectButton } from './CreateProjectModal';
import type { CreatedProjectPayload } from './CreateProjectModal';
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
  isFavorite?: boolean;
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

// Project type configuration
const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  construction: {
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    label: 'Construction',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  },
  design: {
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    label: 'Design',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
  },
  software: {
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    label: 'Software',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
  },
  research: {
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    label: 'Research',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
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
    projectType: (project.industry || 'software').toLowerCase(),
    isFavorite: project.isFavorite || false,
    folderIds: Array.isArray(project.folderIds) ? project.folderIds : [],
    role: project.role as Project['role'],
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
  return mapApiProjectToUiProject({
    publicId: project.publicId,
    name: project.name,
    description: project.description,
    industry: project.industry,
    coverImageUrl: project.coverImageUrl,
    role: project.role,
    status: project.status,
  });
}

// Folder Icon Component
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

// Create Folder Modal
function CreateFolderModal({ 
  isOpen, 
  onClose, 
  onCreateFolder 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCreateFolder: (folder: { name: string; description: string; color: string }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedColor('blue');
    }
  }, [isOpen]);

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
            <h2 className="text-lg font-semibold text-gray-900">Create New Folder</h2>
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
              Create Folder
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
}: {
  folder: Folder;
  onClick: () => void;
}) {
  const colorConfig = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  });

  return (
    <button
      ref={setNodeRef}
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
    </button>
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
        onClick={e => e.stopPropagation()}
        className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        View
      </a>
    </div>
  );
}

// Project List Item Component (for list view)
function ProjectListItem({ project, isDragging = false }: { project: Project; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: `project:${project.id}`,
    data: { type: 'project', projectId: project.id },
  });
  const type = TYPE_CONFIG[project.projectType || 'software'] || TYPE_CONFIG.software;
  const status = STATUS_COLORS[project.status || 'active'] || STATUS_COLORS.active;
  const progress = project.progress || 0;

  return (
    <motion.a
      ref={setNodeRef}
      href={`/projects/${project.id}`}
      {...attributes}
      {...listeners}
      layout
      transition={{ type: 'spring', stiffness: 140, damping: 24, mass: 1.1 }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ? transition.replace(/\d+(\.\d+)?ms/g, '260ms') : undefined,
      }}
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-gray-100 bg-white transition-[transform,opacity] duration-200',
        (isDragging || isSortableDragging) && 'scale-[0.98] opacity-80 pointer-events-none'
      )}
    >
      {/* Type Icon */}
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', type.bg)}>
        <span className={type.color}>{type.icon}</span>
      </div>

      {/* Project Info */}
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-gray-900">{project.name}</h3>
        <p className="text-sm text-gray-500 line-clamp-1">{project.description}</p>
        
        {/* Stats Row */}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-medium text-gray-700">{progress}%</span>
          </div>
          
          {/* Team */}
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {project.teamMembers || 0}
          </span>
          
          {/* Issues */}
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {project.issues || 0}
          </span>
          
          {/* Time */}
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatRelativeTime(project.lastVisited)}
          </span>
          
          {/* Category Tag */}
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', type.bg, type.color)}>
            {type.label}
          </span>
        </div>
      </div>

      {/* Status Badge */}
      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', status.bg, status.text)}>
        {project.status}
      </span>
    </motion.a>
  );
}

// Project Grid Card Component (for grid view)
function ProjectGridCard({ project, isDragging = false }: { project: Project; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: `project:${project.id}`,
    data: { type: 'project', projectId: project.id },
  });
  const type = TYPE_CONFIG[project.projectType || 'software'] || TYPE_CONFIG.software;
  const status = STATUS_COLORS[project.status || 'active'] || STATUS_COLORS.active;
  const progress = project.progress || 0;

  return (
    <motion.a
      ref={setNodeRef}
      href={`/projects/${project.id}`}
      {...attributes}
      {...listeners}
      layout
      transition={{ type: 'spring', stiffness: 150, damping: 26, mass: 1.05 }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group flex h-full min-h-[340px] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white transition-[transform,opacity] duration-200',
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
        {/* Fallback gradient with icon */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          project.thumbnail ? "hidden" : "",
          project.projectType === 'software' && "bg-gradient-to-br from-cyan-50 to-cyan-100",
          project.projectType === 'design' && "bg-gradient-to-br from-purple-50 to-purple-100",
          project.projectType === 'construction' && "bg-gradient-to-br from-blue-50 to-blue-100",
          project.projectType === 'research' && "bg-gradient-to-br from-teal-50 to-teal-100",
          !project.projectType && "bg-gradient-to-br from-gray-50 to-gray-100"
        )}>
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-xl",
            project.projectType === 'software' && "bg-cyan-500 text-white",
            project.projectType === 'design' && "bg-purple-500 text-white",
            project.projectType === 'construction' && "bg-blue-500 text-white",
            project.projectType === 'research' && "bg-teal-500 text-white",
            !project.projectType && "bg-gray-500 text-white"
          )}>
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {project.projectType === 'software' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />}
              {project.projectType === 'design' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />}
              {project.projectType === 'construction' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
              {project.projectType === 'research' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />}
              {!project.projectType && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />}
            </svg>
          </div>
        </div>
        {/* Favorite Star */}
        {project.isFavorite && (
          <div className="absolute left-3 top-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 shadow-lg">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        )}
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
            {project.teamMembers || 0}
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
    </motion.a>
  );
}

// Main Projects Manager Component
// Props are optional — real data comes from the Zustand store/API, not from Astro SSR.
export default function ProjectsManager(_props?: ProjectsManagerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('orbit-projects-view') as 'grid' | 'list') || 'grid';
  });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isMovingProject, setIsMovingProject] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isTrashing, setIsTrashing] = useState(false);

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
        distance: 6,
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
    : [];

  // Starred projects (favorites) — shown in dedicated section
  const starredProjects = projects
    .filter(p => p.isFavorite)
    .filter(p => !filterStatus || p.status === filterStatus)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // All projects sorted by starred first, then recency
  const allProjects = projects
    .filter(p => !filterStatus || p.status === filterStatus)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime();
    });

  // Get priority projects (when on main view) — non-favorited active/review projects
  const priorityProjects = projects
    .filter(p => !p.isFavorite)
    .filter(p => p.status === 'active' || p.status === 'review')
    .filter(p => !filterStatus || p.status === filterStatus)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
      success: (data) => `${data.name} đã được tạo thành công`,
      error: (err) => err?.message || 'Không thể tạo folder',
    });
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
        toast.error('Failed to move project to trash');
        return;
      }

      toast.success('Project moved to trash', {
        description: 'You can restore it from the Trash page within 30 days.',
        action: { label: 'View Trash', onClick: () => { window.location.href = '/trash'; } },
      });

      await loadProjects(false, { force: true });
    } finally {
      setIsTrashing(false);
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
        setProjects((prev) => arrayMove(prev, activeIndex, overIndex));
      }
    }
  };

  // ── Sync Zustand store → local state. If store is empty, fall back to network fetch. ──
  // Tracks store length so this re-fires if hydration populates the store later.
  const storeProjectsLen = useAppStore(s => s.projects.length);
  useEffect(() => {
    const storeProjects = useAppStore.getState().projects;

    if (storeProjects.length > 0) {
      // Store has data — sync to local state and dismiss skeleton immediately.
      const mapped = storeProjects.map(mapApiProjectToUiProject);
      setProjects(mapped);
      setIsProjectsLoading(false);
      // Always revalidate in background so /projects still triggers fresh API call.
      loadProjects(false, { force: true }).then((fresh) => {
        const source = fresh.length > 0 ? fresh : mapped;
        if (source.length > 0) loadFolders(source, { force: true });
      });
      return;
    }

    // Store is still empty (hydration missed or returned null).
    // Fetch from network so the skeleton resolves instead of hanging forever.
    loadProjects(true, { force: true }).then((fetched) => {
      if (fetched.length > 0) loadFolders(fetched, { force: true });
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
      projectsCacheRef.current = null;
      loadProjectsRef.current(false, { force: true });
    };

    socket.on('cache:invalidate', handleCacheInvalidate);
    socket.on('member:removed', handleMemberRemoved);

    return () => {
      socket.off('project:created', handleCreated);
      socket.off('project:updated', handleUpdated);
      socket.off('cache:invalidate', handleCacheInvalidate);
      socket.off('member:removed', handleMemberRemoved);
    };
  }, []); // intentionally empty — socket events handle their own lifecycle

  if (!isHydrated || isProjectsLoading) return <ProjectsSkeleton />;

  const activeProject = activeProjectId
    ? projects.find((project) => project.id === activeProjectId) || null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
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
          {starredProjects.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Starred
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
                      ? <ProjectGridCard key={project.id} project={project} isDragging={activeProjectId === project.id} />
                      : <ProjectListItem key={project.id} project={project} isDragging={activeProjectId === project.id} />
                  ))}
                </div>
              </SortableContext>
            </section>
          )}

          {/* All Projects Section */}
          <section>
            <h2 className="mb-4 text-sm font-medium text-gray-900">
              {starredProjects.length > 0 ? 'All Projects' : 'Projects'}
            </h2>
            {priorityProjects.length > 0 ? (
              <SortableContext
                items={priorityProjects.map((project) => `project:${project.id}`)}
                strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
              >
              <div className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
                  : 'space-y-3'
              )}>
                {priorityProjects.map((project) => (
                  viewMode === 'grid'
                    ? <ProjectGridCard key={project.id} project={project} isDragging={activeProjectId === project.id} />
                    : <ProjectListItem key={project.id} project={project} isDragging={activeProjectId === project.id} />
                ))}
              </div>
              </SortableContext>
            ) : allProjects.filter(p => !p.isFavorite).length > 0 ? (
              <SortableContext
                items={allProjects.filter(p => !p.isFavorite).map((project) => `project:${project.id}`)}
                strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
              >
              <div className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
                  : 'space-y-3'
              )}>
                {allProjects.filter(p => !p.isFavorite).map((project) => (
                  viewMode === 'grid'
                    ? <ProjectGridCard key={project.id} project={project} isDragging={activeProjectId === project.id} />
                    : <ProjectListItem key={project.id} project={project} isDragging={activeProjectId === project.id} />
                ))}
              </div>
              </SortableContext>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">No projects yet</p>
              </div>
            )}
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
            <div className={cn(
              viewMode === 'grid'
                ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
                : 'space-y-3'
            )}>
              {currentFolderProjects.map((project) => (
                viewMode === 'grid'
                  ? <ProjectGridCard key={project.id} project={project} isDragging={activeProjectId === project.id} />
                  : <ProjectListItem key={project.id} project={project} isDragging={activeProjectId === project.id} />
              ))}
            </div>
            </SortableContext>
          ) : (
            /* Empty Folder State */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-4">
                <FolderIcon className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">This folder is empty</h3>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
                Start adding projects to organize your work. Projects in this folder will appear here.
              </p>
              <NewProjectButton />
            </div>
          )}
        </section>
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onCreateFolder={handleCreateFolder}
      />

      <DragOverlay
        modifiers={[snapCenterToCursor]}
        dropAnimation={{
          duration: 320,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {activeProject ? (
          viewMode === 'grid' ? (
            <div className="w-[280px] opacity-80">
              <ProjectGridCard project={activeProject} />
            </div>
          ) : (
            <div className="w-full max-w-[760px] opacity-80">
              <ProjectListItem project={activeProject} />
            </div>
          )
        ) : null}
      </DragOverlay>

    </div>
    </DndContext>
  );
}

export { CreateFolderModal };
