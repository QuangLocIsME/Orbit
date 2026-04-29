'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn, localDateStringToUTCDate, utcDateStringToLocalDateString } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket';
import { CheckCircle, Clock, FileText, Users, ChevronRight, Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProjectDocumentsManager from './ProjectDocumentsManager';
import ScopedTasksPanel from './ScopedTasksPanel';
import ScopedActivityPanel from './ScopedActivityPanel';

interface PackageDetailPageProps {
  projectPublicId?: string;
  packageId: string;
}

interface PackageItem {
  publicId: string;
  projectId: string;
  name: string;
  description: string;
  status: string;
  lifecycleStatus?: 'Draft' | 'Active' | 'Completed' | 'Archived';
  progress?: number;
  completionCriteria?: {
    completed: boolean;
    hasTasks: boolean;
    allTasksDone: boolean;
    hasDocuments: boolean;
    hasMembers: boolean;
  };
  dueDate?: string;
  creatorId?: string;
  teamMemberIds?: string[];
}

interface TeamMemberView {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  avatarUrl: string | null;
}

interface TaskSummary {
  id: string;
  title: string;
  status: string;
  assigneeName: string;
}

type TabId = 'overview' | 'tasks' | 'documents' | 'team' | 'activity';
type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

const getInitials = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

export default function PackageDetailPage({ projectPublicId, packageId }: PackageDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState<PackageItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [projectRole, setProjectRole] = useState<ProjectRole>('member');
  const [teamMembers, setTeamMembers] = useState<TeamMemberView[]>([]);
  const [recentTasks, setRecentTasks] = useState<TaskSummary[]>([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [allProjectMembers, setAllProjectMembers] = useState<TeamMemberView[]>([]);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);
  const [workflowStages, setWorkflowStages] = useState<{ id: string; name: string }[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');
  const [savingDueDate, setSavingDueDate] = useState(false);
  const canManagePackageMembers = projectRole === 'owner' || projectRole === 'admin';
  const canManagePackageDocuments = projectRole !== 'viewer';
  const canEditPackageMeta = canManagePackageMembers;
  const canEditPackageDueDate = canManagePackageMembers;
  const canEditPackageStatus = canManagePackageMembers;
  const backToPackagesHref = projectPublicId ? `/projects/${projectPublicId}` : '/packages';

  useEffect(() => {
    let cancelled = false;

    const loadPackage = async (): Promise<PackageItem> => {
      if (projectPublicId) {
        const listRes = await apiFetch('/api/projects/packages/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId, listType: 'all' }),
        });
        if (!listRes.ok) throw new Error('Cannot load packages');
        const payload = await listRes.json();
        const items = Array.isArray(payload?.data) ? payload.data : [];
        const found = items.find((item: any) => item.publicId === packageId);
        if (found) return found;
      } else {
        const projectsRes = await apiFetch('/api/projects/me');
        if (!projectsRes.ok) throw new Error('Cannot load projects');
        const projectPayload = await projectsRes.json();
        const projects = Array.isArray(projectPayload?.data) ? projectPayload.data : [];

        for (const project of projects) {
          const listRes = await apiFetch('/api/projects/packages/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: project.publicId, listType: 'all' }),
          });
          if (!listRes.ok) continue;
          const payload = await listRes.json();
          const items = Array.isArray(payload?.data) ? payload.data : [];
          const found = items.find((item: any) => item.publicId === packageId);
          if (found) return found;
        }
      }

      throw new Error('Package not found or you do not have access');
    };

    const refresh = async () => {
      setLoading(true);
      try {
        const found = await loadPackage();
        if (cancelled) return;

        setPkg(found);

        const [projectsRes, membersRes, tasksRes, documentsRes, workflowRes] = await Promise.all([
          apiFetch('/api/projects/me'),
          fetch('/api/projects/member-list', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: found.projectId }),
          }),
          apiFetch('/api/tasks/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: found.projectId, packageId }),
          }),
          apiFetch('/api/projects/packages/documents/package/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: found.projectId, packageId }),
          }),
          apiFetch('/api/projects/workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: found.projectId }),
          }),
        ]);

        if (projectsRes.ok) {
          const payload = await projectsRes.json();
          const projects = Array.isArray(payload?.data) ? payload.data : [];
          const currentProject = projects.find((project: any) => String(project.publicId) === String(found.projectId));
          setProjectRole((currentProject?.role || 'member') as ProjectRole);
        }

        const memberMap = new Map<string, TeamMemberView>();
        if (membersRes.ok) {
          const payload = await membersRes.json();
          const members = Array.isArray(payload?.data) ? payload.data : [];
          members.forEach((member: any) => {
            const name = member?.user?.fullName || member?.user?.name || member?.user?.email || 'Unknown';
            memberMap.set(String(member?.userId || ''), {
              id: String(member?.userId || ''),
              name,
              email: String(member?.user?.email || ''),
              role: String(member?.role || 'member'),
              avatar: getInitials(name),
              avatarUrl: member?.user?.avatar || null,
            });
          });
          const mappedMembers = [...memberMap.values()];
          setAllProjectMembers(mappedMembers);

          const packageMemberIds = new Set([
            ...(Array.isArray(found.teamMemberIds) ? found.teamMemberIds : []),
            ...(found.creatorId ? [found.creatorId] : []),
          ]);

          const scopedMembers = packageMemberIds.size > 0
            ? [...packageMemberIds].map((id) => memberMap.get(id)).filter(Boolean) as TeamMemberView[]
            : [];
          setTeamMembers(scopedMembers);
        } else {
          setAllProjectMembers([]);
          setTeamMembers([]);
        }

        const stages = Array.isArray(workflowRes?.data?.stages) ? workflowRes.data.stages : [];
        setWorkflowStages(stages);
        const lastStageId = stages.length > 0 ? stages[stages.length - 1].id : '';

        if (tasksRes.ok) {
          const payload = await tasksRes.json();
          const tasks = Array.isArray(payload?.data) ? payload.data : [];
          setTotalTasksCount(tasks.length);
          const completedCount = tasks.filter((task: any) => {
            const status = String(task?.status || '').toLowerCase();
            const lastStageLower = lastStageId.toLowerCase();
            return ['done', 'completed', 'approved'].includes(status) || status === lastStageLower;
          }).length;
          setCompletedTasksCount(completedCount);
          setRecentTasks(
            tasks.slice(0, 5).map((task: any) => ({
              id: String(task.publicId || task.id || ''),
              title: String(task.title || 'Untitled task'),
              status: String(task.status || 'backlog'),
              assigneeName: memberMap.get(String(task.assigneeId || ''))?.name || 'Unassigned',
            }))
          );
        } else {
          setTotalTasksCount(0);
          setCompletedTasksCount(0);
          setRecentTasks([]);
        }

        if (documentsRes.ok) {
          const payload = await documentsRes.json();
          setDocumentsCount(Number(payload?.data?.total || 0));
        } else {
          setDocumentsCount(0);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.message || 'Cannot load package');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const refreshTasksAndDocuments = async (projectId: string) => {
      if (cancelled) return;
      try {
        const memberMap = new Map<string, TeamMemberView>();
        allProjectMembers.forEach((m) => memberMap.set(m.id, m));

        const stages = workflowStages;
        const lastStageId = stages.length > 0 ? stages[stages.length - 1].id : '';

        const [tasksRes, documentsRes] = await Promise.all([
          apiFetch('/api/tasks/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId, packageId }),
          }),
          apiFetch('/api/projects/packages/documents/package/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId, packageId }),
          }),
        ]);

        if (cancelled) return;

        if (tasksRes.ok) {
          const payload = await tasksRes.json();
          const tasks = Array.isArray(payload?.data) ? payload.data : [];
          setTotalTasksCount(tasks.length);
          const completedCount = tasks.filter((task: any) => {
            const status = String(task?.status || '').toLowerCase();
            const lastStageLower = lastStageId.toLowerCase();
            return ['done', 'completed', 'approved'].includes(status) || status === lastStageLower;
          }).length;
          setCompletedTasksCount(completedCount);
          setRecentTasks(
            tasks.slice(0, 5).map((task: any) => ({
              id: String(task.publicId || task.id || ''),
              title: String(task.title || 'Untitled task'),
              status: String(task.status || 'backlog'),
              assigneeName: memberMap.get(String(task.assigneeId || ''))?.name || 'Unassigned',
            }))
          );
        }

        if (documentsRes.ok) {
          const payload = await documentsRes.json();
          setDocumentsCount(Number(payload?.data?.total || 0));
        }
      } catch { /* silent refresh */ }
    };

    refresh();

    (window as any).__refreshPackageTasks = async () => {
      if (cancelled || !pkg) return;
      await refreshTasksAndDocuments(pkg.projectId);
    };

    return () => {
      cancelled = true;
      delete (window as any).__refreshPackageTasks;
    };
  }, [packageId, projectPublicId]);

  useEffect(() => {
    setDueDateInput(pkg?.dueDate ? utcDateStringToLocalDateString(String(pkg.dueDate)) : '');
    setIsEditingDueDate(false);
  }, [pkg?.dueDate]);

  useEffect(() => {
    setNameInput(pkg?.name || '');
    setDescriptionInput(pkg?.description || '');
    setIsEditingName(false);
    setIsEditingDescription(false);
  }, [pkg?.description, pkg?.name]);

  useEffect(() => {
    setIsEditingStatus(false);
  }, [pkg?.lifecycleStatus, pkg?.status]);

  useEffect(() => {
    const socket = getSocket();

    const handleTaskCountChanged = (data: { packageId: string; projectId: string }) => {
      if (data.packageId !== packageId) return;
      const refresh = (window as any).__refreshPackageTasks;
      if (refresh) refresh();
    };

    socket.on('package:task-count-changed', handleTaskCountChanged);
    socket.emit('package:join', { packageId });

    return () => {
      socket.off('package:task-count-changed', handleTaskCountChanged);
      socket.emit('package:leave', { packageId });
    };
  }, [packageId]);

  const stats = useMemo(() => {
    const total = Math.max(totalTasksCount, 0);
    const completed = Math.min(Math.max(completedTasksCount, 0), Math.max(total, 1));
    return {
      completed: completedTasksCount,
      inProgress: Math.max(totalTasksCount - completedTasksCount, 0),
      documents: documentsCount,
      team: teamMembers.length,
      totalTasks: totalTasksCount,
      completionPercent: Math.round((completed / Math.max(total, 1)) * 100),
    };
  }, [completedTasksCount, documentsCount, teamMembers.length, totalTasksCount]);

  const filteredTeamMembers = useMemo(() => {
    const q = teamSearchQuery.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((member) =>
      `${member.name} ${member.email || ''} ${member.role || ''}`.toLowerCase().includes(q)
    );
  }, [teamMembers, teamSearchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F4F7]">
        <div className="px-6 lg:px-[80px] xl:px-[160px] py-8">
          <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse mb-4" />
          <div className="h-4 w-72 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!pkg) {
    return <div className="px-6 py-8 text-sm text-red-600">Package not found.</div>;
  }

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-[#DCFCE7] text-[#008236]';
      case 'active': return 'bg-[#DCFCE7] text-[#008236]';
      case 'draft': return 'bg-[#F3F4F6] text-[#4A5565]';
      case 'archived': return 'bg-[#FEF3C7] text-[#A16207]';
      default: return 'bg-[#F3F4F6] text-[#4A5565]';
    }
  };
  const displayStatus = pkg.lifecycleStatus || pkg.status;

  const toggleSelectedMember = (memberId: string) => {
    setSelectedMemberIds((prev) => (
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    ));
  };

  const openAddMemberDialog = () => {
    if (!canManagePackageMembers) {
      toast.error('Only owner/admin can manage package members');
      return;
    }
    const currentIds = new Set([
      ...(Array.isArray(pkg.teamMemberIds) ? pkg.teamMemberIds : []),
      ...(pkg.creatorId ? [pkg.creatorId] : []),
    ]);
    setSelectedMemberIds([...currentIds]);
    setIsAddMemberOpen(true);
  };

  const handleSaveMembers = async () => {
    if (!pkg) return;
    if (!canManagePackageMembers) {
      toast.error('Only owner/admin can manage package members');
      return;
    }
    setSavingMembers(true);
    try {
      const res = await apiFetch('/api/projects/packages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: pkg.projectId,
          packageId: pkg.publicId,
          teamMemberIds: selectedMemberIds,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to update package members');
      }

      const updatedIds = Array.isArray(payload?.data?.teamMemberIds) ? payload.data.teamMemberIds : selectedMemberIds;
      const nextIds = new Set([
        ...updatedIds,
        ...(pkg.creatorId ? [pkg.creatorId] : []),
      ]);
      const map = new Map(allProjectMembers.map((m) => [m.id, m]));
      const scoped = [...nextIds].map((id) => map.get(id)).filter(Boolean) as TeamMemberView[];

      setPkg((prev) => prev ? { ...prev, teamMemberIds: updatedIds } : prev);
      setTeamMembers(scoped);
      setIsAddMemberOpen(false);
      toast.success('Updated package members');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update package members');
    } finally {
      setSavingMembers(false);
    }
  };

  const handleSaveDueDate = async () => {
    if (!pkg) return;
    if (!canEditPackageDueDate) {
      toast.error('Only owner/admin can update due date');
      return;
    }
    const currentDueDate = pkg?.dueDate ? utcDateStringToLocalDateString(String(pkg.dueDate)) : '';
    if (currentDueDate === dueDateInput) {
      return;
    }
    if (!dueDateInput) {
      toast.error('Please select a due date');
      return;
    }

    setSavingDueDate(true);
    try {
      const res = await apiFetch('/api/projects/packages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: pkg.projectId,
          packageId: pkg.publicId,
          dueDate: localDateStringToUTCDate(dueDateInput),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to update due date');
      }

      setPkg((prev) => (prev ? { ...prev, dueDate: localDateStringToUTCDate(dueDateInput) } : prev));
      setIsEditingDueDate(false);
      toast.success('Due date updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update due date');
    } finally {
      setSavingDueDate(false);
    }
  };

  const handleSaveStatus = async (nextStatus: 'Draft' | 'Active' | 'Completed' | 'Archived') => {
    if (!pkg) return;
    if (!canEditPackageStatus) {
      toast.error('Only owner/admin can update status');
      return;
    }

    const currentStatus = String(pkg.lifecycleStatus || pkg.status || '');
    if (currentStatus.toLowerCase() === nextStatus.toLowerCase()) {
      setIsEditingStatus(false);
      return;
    }

    setSavingStatus(true);
    try {
      const res = await apiFetch('/api/projects/packages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: pkg.projectId,
          packageId: pkg.publicId,
          status: nextStatus,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to update status');
      }

      setPkg((prev) => (prev ? { ...prev, status: nextStatus, lifecycleStatus: nextStatus } : prev));
      setIsEditingStatus(false);
      toast.success('Status updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveName = async () => {
    if (!pkg) return;
    if (!canEditPackageMeta) {
      toast.error('Only owner/admin can update package details');
      return;
    }
    const nextName = nameInput.trim();
    if (!nextName) {
      toast.error('Package name is required');
      return;
    }
    if (nextName === (pkg.name || '').trim()) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      const res = await apiFetch('/api/projects/packages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: pkg.projectId,
          packageId: pkg.publicId,
          name: nextName,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.message || 'Failed to update package name');
      setPkg((prev) => (prev ? { ...prev, name: nextName } : prev));
      setIsEditingName(false);
      toast.success('Package name updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update package name');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!pkg) return;
    if (!canEditPackageMeta) {
      toast.error('Only owner/admin can update package details');
      return;
    }
    const nextDescription = descriptionInput.trim();
    const currentDescription = (pkg.description || '').trim();
    if (nextDescription === currentDescription) {
      setIsEditingDescription(false);
      return;
    }

    setSavingDescription(true);
    try {
      const res = await apiFetch('/api/projects/packages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: pkg.projectId,
          packageId: pkg.publicId,
          description: nextDescription,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.message || 'Failed to update package description');
      setPkg((prev) => (prev ? { ...prev, description: nextDescription } : prev));
      setIsEditingDescription(false);
      toast.success('Package description updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update package description');
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white">
        <div className="px-[100px] py-3">
        <div className="space-y-6 py-3 px-6 lg:px-[80px] xl:px-[160px]">
          <div className="flex items-center justify-between mb-4">
            <a href={backToPackagesHref} className="inline-flex items-center justify-center gap-1 text-sm text-[#4A5565] hover:text-[#101828] transition-colors">
              <ChevronRight className="h-4 w-4 rotate-180" />
              Back to Packages
            </a>
          </div>

          <div className="mb-4 flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                {isEditingName ? (
                  <input
                    type="text"
                    value={nameInput}
                    autoFocus
                    disabled={savingName}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={() => {
                      if (!savingName) void handleSaveName();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!savingName) void handleSaveName();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setNameInput(pkg?.name || '');
                        setIsEditingName(false);
                      }
                    }}
                    className="w-full max-w-[560px] rounded-md border border-gray-200 bg-white px-2 py-1 text-[24px] font-normal text-[#101828] outline-none focus:border-indigo-400"
                  />
                ) : (
                  <h1
                    className={cn(
                      'text-[24px] font-normal text-[#101828]',
                      canEditPackageMeta && 'cursor-text'
                    )}
                    onDoubleClick={() => {
                      if (!canEditPackageMeta) return;
                      setNameInput(pkg.name || '');
                      setIsEditingName(true);
                    }}
                    title={canEditPackageMeta ? 'Double click to edit name' : undefined}
                  >
                    {pkg.name}
                  </h1>
                )}
              </div>
              {isEditingDescription ? (
                <textarea
                  value={descriptionInput}
                  autoFocus
                  rows={2}
                  disabled={savingDescription}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  onBlur={() => {
                    if (!savingDescription) void handleSaveDescription();
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      if (!savingDescription) void handleSaveDescription();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setDescriptionInput(pkg?.description || '');
                      setIsEditingDescription(false);
                    }
                  }}
                  className="w-full max-w-[700px] rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[14px] text-[#4A5565] outline-none focus:border-indigo-400"
                />
              ) : (
                <p
                  className={cn(
                    'text-[14px] text-[#4A5565]',
                    canEditPackageMeta && 'cursor-text'
                  )}
                  onDoubleClick={() => {
                    if (!canEditPackageMeta) return;
                    setDescriptionInput(pkg.description || '');
                    setIsEditingDescription(true);
                  }}
                  title={canEditPackageMeta ? 'Double click to edit description' : undefined}
                >
                  {pkg.description || 'No description'}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[#4A5565]">
                {isEditingStatus ? (
                  <select
                    value={displayStatus}
                    autoFocus
                    disabled={savingStatus}
                    onChange={(e) => {
                      const next = e.target.value as 'Draft' | 'Active' | 'Completed' | 'Archived';
                      void handleSaveStatus(next);
                    }}
                    onBlur={() => setIsEditingStatus(false)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-foreground outline-none focus:border-indigo-400"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                ) : (
                  <button
                    type="button"
                    disabled={!canEditPackageStatus || savingStatus}
                    onDoubleClick={() => {
                      if (!canEditPackageStatus) return;
                      setIsEditingStatus(true);
                    }}
                    className={cn(
                      'inline-flex items-center rounded px-2 py-1 text-xs font-normal capitalize transition hover:opacity-90 active:scale-[0.98]',
                      statusColor(displayStatus),
                      !canEditPackageStatus && 'cursor-default'
                    )}
                    title={canEditPackageStatus ? 'Double click to edit status' : undefined}
                  >
                    {displayStatus}
                  </button>
                )}
                {(pkg.dueDate || canEditPackageDueDate) && (
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1}>
                      <rect x="1.5" y="2" width="9" height="8.5" rx="1" />
                      <line x1="4" y1="1" x2="4" y2="3" />
                      <line x1="8" y1="1" x2="8" y2="3" />
                      <line x1="1.5" y1="5" x2="10.5" y2="5" />
                    </svg>
                    {isEditingDueDate ? (
                      <input
                        type="date"
                        value={dueDateInput}
                        autoFocus
                        onChange={(e) => setDueDateInput(e.target.value)}
                        onBlur={() => {
                          setIsEditingDueDate(false);
                          if (!savingDueDate) {
                            void handleSaveDueDate();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setIsEditingDueDate(false);
                            if (!savingDueDate) {
                              void handleSaveDueDate();
                            }
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setDueDateInput(pkg?.dueDate ? utcDateStringToLocalDateString(String(pkg.dueDate)) : '');
                            setIsEditingDueDate(false);
                          }
                        }}
                        className="w-full max-w-[140px] rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-indigo-400"
                        disabled={savingDueDate}
                      />
                    ) : (
                      <button
                        type="button"
                        onDoubleClick={() => {
                          if (!canEditPackageDueDate) return;
                          setDueDateInput(pkg?.dueDate ? utcDateStringToLocalDateString(String(pkg.dueDate)) : '');
                          setIsEditingDueDate(true);
                        }}
                        className={cn(
                          'rounded px-1 text-sm font-medium text-foreground transition hover:bg-gray-100 active:scale-[0.98]',
                          !canEditPackageDueDate && 'cursor-default hover:bg-transparent'
                        )}
                        title={canEditPackageDueDate ? 'Double click to edit due date' : undefined}
                      >
                        {pkg.dueDate ? new Date(String(pkg.dueDate)).toLocaleDateString() : 'Not set'}
                      </button>
                    )}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75h6m-6 4.5h6m-3 4.5H9m8.25 3H6.75A2.25 2.25 0 014.5 16.5V7.5a2.25 2.25 0 012.25-2.25h10.5A2.25 2.25 0 0119.5 7.5v9a2.25 2.25 0 01-2.25 2.25z" />
                  </svg>
                  <span className="rounded px-1 text-sm font-medium text-foreground">
                    {stats.completed}/{stats.totalTasks} tasks
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative h-20 w-20">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="#155DFC"
                      strokeWidth="3"
                      strokeDasharray={`${typeof pkg.progress === 'number' ? pkg.progress : stats.completionPercent} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <span className="text-[14px] text-[#101828]">{typeof pkg.progress === 'number' ? Math.round(pkg.progress) : stats.completionPercent}%</span>
              </div>

              <div className="flex -space-x-2">
                {teamMembers.slice(0, 4).map((member, index) => {
                  const avatarBg = ['#FF2056', '#615FFF', '#00B8DB', '#7CCF00'][index % 4];
                  return (
                    member.avatarUrl ? (
                      <img
                        key={member.id}
                        src={member.avatarUrl}
                        alt={member.name}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white object-cover text-[11px] text-white"
                        title={member.name}
                      />
                    ) : (
                      <span
                        key={member.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] text-white"
                        style={{ backgroundColor: avatarBg }}
                        title={member.name}
                      >
                        {member.avatar}
                      </span>
                    )
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-[#E5E7EB]">
            {([
              { id: 'overview', label: 'Overview' },
              { id: 'tasks', label: 'Tasks' },
              { id: 'documents', label: 'Documents' },
              { id: 'team', label: 'Team' },
              { id: 'activity', label: 'Activity' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'h-[38px] border-b-2 px-3 text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-[#155DFC] text-[#155DFC]'
                    : 'border-transparent text-[#4A5565] hover:text-[#101828]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      <div className="px-[100px] py-0">
        <div className="space-y-4 py-1 px-6 lg:px-[80px] xl:px-[160px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.documents}</p>
                  <p className="text-sm text-muted-foreground">Documents</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.team}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <ScopedActivityPanel
                scope={{ type: 'package', projectId: pkg.projectId, packageId }}
                variant="compact"
                title="Recent Activity"
              />

              <div className="flex h-[300px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Due Soon</h3>
                </div>
                <ScopedTasksPanel
                  scope={{ type: 'package', projectId: pkg.projectId, packageId }}
                  projectRole={projectRole}
                  variant="compact"
                  onTaskClick={() => setActiveTab('tasks')}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="-mx-6 lg:-mx-[80px] xl:-mx-[160px]">
            <ScopedTasksPanel
              scope={{ type: 'package', projectId: pkg.projectId, packageId }}
              projectRole={projectRole}
            />
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="-mx-6 lg:-mx-[80px] xl:-mx-[160px]">
            <ProjectDocumentsManager
              projectId={pkg.projectId}
              packageId={packageId}
              canManage={canManagePackageDocuments}
            />
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-4">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" />
                <input
                  type="text"
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  placeholder="Search team members..."
                  className="h-10 w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] pl-9 pr-3 text-sm text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <p className="text-[13px] text-[#6A7282]">Total members: <span className="font-medium text-[#101828]">{teamMembers.length}</span></p>
              <button
                type="button"
                disabled={!canManagePackageMembers}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 text-sm font-normal text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openAddMemberDialog}
                title={canManagePackageMembers ? 'Add members to this package' : 'Only owner/admin can add members'}
              >
                <Plus className="h-4 w-4" />
                Add Member
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-20">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No team members</h3>
                <p className="text-sm text-gray-500">This package has no assigned members yet</p>
              </div>
            ) : filteredTeamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-16">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-base font-medium text-gray-900">No matching members</h3>
                <p className="mt-1 text-sm text-gray-500">Try another name, email, or role</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
                {filteredTeamMembers.map((member, index) => {
                  const avatarBg = ['#FF2056', '#615FFF', '#00B8DB', '#7CCF00'][index % 4];
                  return (
                  <div key={member.id} className="flex h-[81px] items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="h-12 w-12 rounded-full object-cover flex items-center justify-center text-[16px] font-normal text-white" style={{ backgroundColor: avatarBg }} />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-normal text-white"
                        style={{ backgroundColor: avatarBg }}
                      >
                        {member.avatar}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-[#101828]">{member.name}</p>
                      <p className="truncate text-[12px] text-[#6A7282] capitalize">{member.role}</p>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <ScopedActivityPanel
            scope={{ type: 'package', projectId: pkg.projectId, packageId }}
          />
        )}
        </div>
      </div>

      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Project Members</DialogTitle>
          </DialogHeader>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {allProjectMembers.length === 0 ? (
              <p className="text-sm text-[#6A7282]">No members found in this project.</p>
            ) : (
              allProjectMembers.map((member, index) => {
                const checked = selectedMemberIds.includes(member.id);
                const avatarBg = ['#FF2056', '#615FFF', '#00B8DB', '#7CCF00'][index % 4];
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleSelectedMember(member.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left',
                      checked ? 'border-[#155DFC] bg-blue-50' : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                    )}
                  >
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full object-cover text-xs text-white" />
                    ) : (
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs text-white"
                        style={{ backgroundColor: avatarBg }}
                      >
                        {member.avatar}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[#101828]">{member.name}</span>
                      <span className="block truncate text-xs text-[#6A7282]">{member.email}</span>
                    </span>
                    <span className={cn(
                      'h-4 w-4 rounded border',
                      checked ? 'border-[#155DFC] bg-[#155DFC]' : 'border-[#D0D5DD] bg-white'
                    )} />
                  </button>
                );
              })
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-[#4A5565] hover:bg-gray-100"
              onClick={() => setIsAddMemberOpen(false)}
              disabled={savingMembers}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#155DFC] px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={handleSaveMembers}
              disabled={savingMembers}
            >
              {savingMembers ? 'Saving...' : 'Save'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
