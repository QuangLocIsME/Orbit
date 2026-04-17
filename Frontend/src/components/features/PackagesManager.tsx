'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { navigate } from 'astro:transitions/client';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { PackagesSkeleton } from '@/components/ui/skeletons';
import { Search, LayoutGrid, List, Plus, Calendar, Users, Pencil, Trash2 } from 'lucide-react';

type PackageStatus = 'Draft' | 'Active' | 'Archived';

interface ProjectOption {
  publicId: string;
  name: string;
}

interface ProjectMemberOption {
  userId: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}

interface PackageItem {
  publicId: string;
  projectId: string;
  name: string;
  description: string;
  packageType: string;
  status: PackageStatus;
  dueDate: string | null;
  teamMemberIds: string[];
  creatorId: string;
  updatedAt: string;
}

const statusBadge: Record<PackageStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Active: 'bg-emerald-100 text-emerald-700',
  Archived: 'bg-orange-100 text-orange-700',
};

const SELECTED_PROJECT_KEY = 'orbit:selected-project-id';

interface PackagesManagerProps {
  fixedProjectId?: string;
  fixedProjectName?: string;
}

export default function PackagesManager({ fixedProjectId, fixedProjectName }: PackagesManagerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberOption[]>([]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pkg: PackageItem } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [editData, setEditData] = useState({ name: '', description: '', type: 'construction', initialStatus: 'Active' as PackageStatus, dueDate: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<PackageItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newPackage, setNewPackage] = useState({
    name: '',
    description: '',
    type: 'construction',
    initialStatus: 'Active',
    dueDate: '',
    teamMemberIds: [] as string[],
  });

  const selectedProjectName = useMemo(() => {
    if (fixedProjectId) {
      return fixedProjectName || projects.find((p) => p.publicId === fixedProjectId)?.name || '';
    }
    return projects.find((p) => p.publicId === selectedProjectId)?.name || '';
  }, [projects, selectedProjectId, fixedProjectId, fixedProjectName]);

  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter((item) =>
      `${item.name} ${item.description || ''} ${item.packageType || ''}`.toLowerCase().includes(q)
    );
  }, [packages, searchQuery]);

  const loadProjects = async () => {
    const res = await apiFetch('/api/projects/me');
    if (!res.ok) throw new Error('Failed to load projects');

    const payload = await res.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const mapped: ProjectOption[] = items.map((p: any) => ({ publicId: p.publicId, name: p.name }));

    setProjects(mapped);

    if (!mapped.length) {
      setSelectedProjectId('');
      return;
    }

    if (fixedProjectId) {
      const exists = mapped.some((p) => p.publicId === fixedProjectId);
      setSelectedProjectId(exists ? fixedProjectId : '');
      return;
    }

    const saved = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_PROJECT_KEY) : null;
    const hasSaved = saved && mapped.some((p) => p.publicId === saved);
    const nextProjectId = hasSaved ? String(saved) : mapped[0].publicId;
    setSelectedProjectId(nextProjectId);
  };

  const loadPackages = async (projectId: string) => {
    if (!projectId) {
      setPackages([]);
      return;
    }

    const res = await apiFetch('/api/projects/packages/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ projectId, listType: 'active' }),
    });

    if (!res.ok) throw new Error('Failed to load packages');

    const payload = await res.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    setPackages(items);
  };

  const memberColors = ['#EC4899', '#06B6D4', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981'];

  const toInitials = (name: string) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  };

  const loadProjectMembers = async (projectId: string) => {
    if (!projectId) {
      setProjectMembers([]);
      return;
    }

    const res = await apiFetch('/api/projects/member-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ projectId }),
    });

    if (!res.ok) {
      setProjectMembers([]);
      return;
    }

    const payload = await res.json();
    const members = Array.isArray(payload?.data) ? payload.data : [];

    const mappedMembers = members
      .filter((m: any) => m?.status === 'accepted' && m?.userId)
      .map((m: any) => ({
        userId: m.userId,
        name: m?.user?.fullName || m?.user?.email || m.userId,
        role: m.role || 'member',
      }));

    setProjectMembers(
      mappedMembers.map((m: any, index: number) => ({
        ...m,
        initials: toInitials(m.name),
        color: memberColors[index % memberColors.length],
      }))
    );
  };

  const refreshData = async (projectId: string) => {
    await Promise.all([loadPackages(projectId), loadProjectMembers(projectId)]);
  };

  useEffect(() => {
    setIsHydrated(true);

    if (fixedProjectId) {
      setSelectedProjectId(fixedProjectId);
      setLoading(false);
      return;
    }

    setLoading(true);
    loadProjects()
      .catch((err) => toast.error(err?.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [fixedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (!fixedProjectId) {
      localStorage.setItem(SELECTED_PROJECT_KEY, selectedProjectId);
    }
    setLoading(true);
    refreshData(selectedProjectId)
      .catch((err) => toast.error(err?.message || 'Failed to load packages'))
      .finally(() => setLoading(false));
  }, [selectedProjectId, fixedProjectId]);

  const toggleMember = (userId: string) => {
    setNewPackage((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(userId)
        ? prev.teamMemberIds.filter((id) => id !== userId)
        : [...prev.teamMemberIds, userId],
    }));
    setErrors((prev) => { const u = { ...prev }; delete u.members; return u; });
  };

  const resetCreateForm = () => {
    setNewPackage({ name: '', description: '', type: 'construction', initialStatus: 'Active', dueDate: '', teamMemberIds: [] });
    setErrors({});
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, pkg: PackageItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, pkg });
  };

  const handleEdit = useCallback(() => {
    if (!contextMenu) return;
    const pkg = contextMenu.pkg;
    setEditingPackage(pkg);
    setEditData({
      name: pkg.name,
      description: pkg.description || '',
      type: pkg.packageType || 'construction',
      initialStatus: pkg.status || 'Draft',
      dueDate: pkg.dueDate ? String(pkg.dueDate).split('T')[0] : '',
    });
    setShowEditModal(true);
    setContextMenu(null);
  }, [contextMenu]);

  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    setDeletingPackage(contextMenu.pkg);
    setShowDeleteModal(true);
    setContextMenu(null);
  }, [contextMenu]);

  const submitEdit = async () => {
    if (!editingPackage || !editData.name.trim()) return;
    setUpdating(true);
    try {
      const res = await apiFetch('/api/projects/packages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: editingPackage.projectId,
          packageId: editingPackage.publicId,
          name: editData.name.trim(),
          description: editData.description.trim(),
          type: editData.type,
          status: editData.initialStatus,
          dueDate: editData.dueDate || null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.message || 'Failed to update package');
      toast.success('Package updated successfully');
      setShowEditModal(false);
      setEditingPackage(null);
      await refreshData(selectedProjectId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update package');
    } finally {
      setUpdating(false);
    }
  };

  const submitDelete = async () => {
    if (!deletingPackage) return;
    setDeleting(true);
    try {
      const res = await apiFetch('/api/projects/packages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: deletingPackage.projectId,
          packageId: deletingPackage.publicId,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.message || 'Failed to delete package');
      toast.success('Package deleted successfully');
      setShowDeleteModal(false);
      setDeletingPackage(null);
      await refreshData(selectedProjectId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete package');
    } finally {
      setDeleting(false);
    }
  };

  const packageTypeOptions = [
    { id: 'design', label: 'Design', color: 'bg-purple-100 text-purple-600' },
    { id: 'development', label: 'Development', color: 'bg-blue-100 text-blue-600' },
    { id: 'marketing', label: 'Marketing', color: 'bg-pink-100 text-pink-600' },
    { id: 'construction', label: 'Construction', color: 'bg-orange-100 text-orange-600' },
    { id: 'research', label: 'Research', color: 'bg-emerald-100 text-emerald-600' },
    { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-600' },
  ] as const;

  const handleCreatePackage = async () => {
    const newErrors: Record<string, string> = {};
    if (!selectedProjectId) {
      newErrors.project = 'Please select a project';
    }
    if (!newPackage.name.trim()) {
      newErrors.name = 'Package name is required';
    }
    if (!newPackage.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!newPackage.type.trim()) {
      newErrors.type = 'Please select a package type';
    }
    if (newPackage.teamMemberIds.length === 0) {
      newErrors.members = 'At least one team member is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstField = Object.keys(newErrors)[0];
      document.getElementById(`input-${firstField}`)?.focus();
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch('/api/projects/packages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          name: newPackage.name.trim(),
          description: newPackage.description.trim(),
          type: newPackage.type.trim(),
          dueDate: newPackage.dueDate || null,
          teamMemberIds: newPackage.teamMemberIds,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to create package');
      }

      toast.success('Package created successfully');
      setShowCreateModal(false);
      resetCreateForm();
      await refreshData(selectedProjectId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create package');
    } finally {
      setCreating(false);
    }
  };

  if (!isHydrated || loading) return <PackagesSkeleton />;

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-normal text-[#101828]">Packages</h1>
          {!fixedProjectId && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              {projects.map((p) => (
                <option key={p.publicId} value={p.publicId}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedProjectId}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Package
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('rounded-md p-2', viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('rounded-md p-2', viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400')}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filteredPackages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-14 text-center">
          <p className="text-sm text-gray-600">
            {selectedProjectId
              ? `Project "${selectedProjectName}" chưa có package nào.`
              : 'Bạn chưa có project nào để quản lý package.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPackages.map((item) => (
            <div key={item.publicId} className="relative">
              <button
                onClick={() => navigate(`/${selectedProjectId}/${item.publicId}`)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-300 hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate font-medium text-gray-900">{item.name}</h3>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusBadge[item.status] || statusBadge.Draft)}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">{item.description || 'No description'}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{item.teamMemberIds?.length || 0}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No due date'}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPackages.map((item) => (
            <div key={item.publicId} className="relative">
              <button
                onClick={() => navigate(`/${selectedProjectId}/${item.publicId}`)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                className="group flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{item.name}</p>
                  <p className="truncate text-sm text-gray-500">{item.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusBadge[item.status] || statusBadge.Draft)}>{item.status}</span>
                  <span className="text-xs text-gray-500">{item.teamMemberIds?.length || 0} members</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-4 pb-3 sm:p-6 sm:pb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#1F2937] sm:text-[40px]">Create New Package</h2>
                <p className="mt-1 text-sm text-[#6B7280] sm:text-[16px]">Add a new package to organize project components</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
            </div>

            <div className="border-t border-gray-100" />

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 sm:max-h-none sm:space-y-5 sm:p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Package Name <span className="text-red-500">*</span></label>
                <input
                  id="input-name"
                  value={newPackage.name}
                  onChange={(e) => {
                    setNewPackage((prev) => ({ ...prev, name: e.target.value }));
                    setErrors((prev) => { const u = { ...prev }; delete u.name; return u; });
                  }}
                  placeholder="e.g., Architectural Design, MEP Systems..."
                  className={cn(
                    'w-full rounded-xl border px-3 py-2 text-sm sm:px-4 sm:py-3',
                    errors.name ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                  )}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Description <span className="text-red-500">*</span></label>
                <textarea
                  id="input-description"
                  value={newPackage.description}
                  onChange={(e) => {
                    setNewPackage((prev) => ({ ...prev, description: e.target.value }));
                    setErrors((prev) => { const u = { ...prev }; delete u.description; return u; });
                  }}
                  placeholder="Describe the package scope, deliverables, and objectives..."
                  rows={3}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2 text-sm sm:px-4 sm:py-3',
                    errors.description ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                  )}
                />
                {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F2937]">Package Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  {packageTypeOptions.map((opt) => {
                    const active = newPackage.type === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setNewPackage((prev) => ({ ...prev, type: opt.id }));
                          setErrors((prev) => { const u = { ...prev }; delete u.type; return u; });
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-sm',
                          active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                          errors.type && !active ? 'border-red-300' : ''
                        )}
                      >
                        <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8', opt.color)}>
                          {opt.label.charAt(0)}
                        </span>
                        <span className="font-medium text-[#374151]">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.type && <p className="mt-1 text-xs text-red-500">{errors.type}</p>}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Initial Status <span className="text-red-500">*</span></label>
                  <select
                    value={newPackage.initialStatus}
                    onChange={(e) => setNewPackage((prev) => ({ ...prev, initialStatus: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm sm:px-4 sm:py-3"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Due Date</label>
                  <input
                    type="date"
                    value={newPackage.dueDate}
                    onChange={(e) => setNewPackage((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm sm:px-4 sm:py-3"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Assign Team Members <span className="text-red-500">*</span></label>
                <button
                  type="button"
                  onClick={() => setIsMemberDropdownOpen((v) => !v)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm sm:px-4 sm:py-3',
                    errors.members ? 'border-red-500' : 'border-gray-200'
                  )}
                >
                  <span className={newPackage.teamMemberIds.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                    {newPackage.teamMemberIds.length > 0
                      ? `${newPackage.teamMemberIds.length} member${newPackage.teamMemberIds.length > 1 ? 's' : ''} selected`
                      : 'Select members...'}
                  </span>
                  <span className="text-gray-400">⌃</span>
                </button>
                {errors.members && <p className="mt-1 text-xs text-red-500">{errors.members}</p>}

                {isMemberDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                    {projectMembers.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">No members in this project.</p>
                    ) : (
                      projectMembers.map((member) => {
                        const checked = newPackage.teamMemberIds.includes(member.userId);
                        return (
                          <button
                            key={member.userId}
                            type="button"
                            onClick={() => toggleMember(member.userId)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                          >
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: member.color }}
                            >
                              {member.initials}
                            </div>
                            <span className="flex-1 text-sm text-gray-900">{member.name}</span>
                            {checked && (
                              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-4 sm:p-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 sm:px-5 sm:py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePackage}
                disabled={creating || !newPackage.name.trim()}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 sm:px-6 sm:py-2.5"
              >
                {creating ? 'Creating...' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] rounded-xl border border-gray-200 bg-white py-1 shadow-xl ring-1 ring-gray-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={handleEdit}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4 text-gray-500" />
            Edit
          </button>
          <div className="mx-3 border-t border-gray-100" />
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-4 pb-3 sm:p-6 sm:pb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#1F2937] sm:text-2xl">Edit Package</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Update package details</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
            </div>
            <div className="border-t border-gray-100" />
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 sm:max-h-none sm:space-y-5 sm:p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Package Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Package name..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 sm:px-4 sm:py-3"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe the package scope..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 sm:px-4 sm:py-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F2937]">Package Type</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  {packageTypeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEditData((p) => ({ ...p, type: opt.id }))}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs sm:gap-3 sm:px-4 sm:py-4 sm:text-sm',
                        editData.type === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8', opt.color)}>
                        {opt.label.charAt(0)}
                      </span>
                      <span className="font-medium text-[#374151]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Status</label>
                  <select
                    value={editData.initialStatus}
                    onChange={(e) => setEditData((p) => ({ ...p, initialStatus: e.target.value as PackageStatus }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm sm:px-4 sm:py-3"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1F2937] sm:mb-2">Due Date</label>
                  <input
                    type="date"
                    value={editData.dueDate}
                    onChange={(e) => setEditData((p) => ({ ...p, dueDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm sm:px-4 sm:py-3"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-4 sm:p-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 sm:px-5 sm:py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={updating || !editData.name.trim()}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 sm:px-6 sm:py-2.5"
              >
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 sm:p-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-center text-xl font-semibold text-[#1F2937]">Delete Package</h2>
              <p className="mt-3 text-center text-sm text-[#6B7280]">
                Are you sure you want to delete <strong className="text-gray-900">"{deletingPackage.name}"</strong>? This action cannot be undone.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDelete}
                  disabled={deleting}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
