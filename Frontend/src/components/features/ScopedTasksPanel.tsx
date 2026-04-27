'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import CreateTaskModal from './CreateTaskModal';
import TaskBoard, { type WorkflowStage } from './TaskBoard';
import TaskCalendar from './TaskCalendar';
import TaskDetailPage from './TaskDetailPage';
import WorkflowTemplatesDropdown from './WorkflowTemplatesDropdown';

type ProjectRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface ScopedTaskScope {
  type: 'project' | 'package';
  projectId: string;
  packageId?: string | null;
}

interface ScopedTasksPanelProps {
  scope: ScopedTaskScope;
  projectRole?: ProjectRole;
  variant?: 'full' | 'compact';
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

interface ModelFile { id: string; name: string; folderPath?: string; }
interface TeamMemberForTask { userId: string; user?: { fullName: string }; role: string; }

interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: string;
  tags: string[];
  linkedItem?: { type: 'link'; name: string };
  comments: number;
  attachments: number;
  dueDate: string;
  assigneeId: string;
  assigneeIds?: string[];
  reviewerIds?: string[];
}

interface EditTaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  assigneeId: string;
  assigneeIds?: string[];
  reviewerIds?: string[];
  dueDate: string;
  tags: string[];
  linkedItems: string;
}
type CalendarTaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type LinkedSuggestionItem = { label: string; value: string };

const avatarColors = ['bg-pink-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500'];
const MODEL_EXT = /\.(ifc|rvt|dwg|dxf|nwd|nwf|nwc|skp|fbx|obj|3ds|step|stp)$/i;

const getInitials = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatIsoDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export default function ScopedTasksPanel({ scope, projectRole = 'member', variant = 'full' }: ScopedTasksPanelProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMemberView[]>([]);
  const [modelFiles, setModelFiles] = useState<ModelFile[]>([]);
  const [loadingModelFiles, setLoadingModelFiles] = useState(false);
  const [teamMembersForTask, setTeamMembersForTask] = useState<TeamMemberForTask[]>([]);
  const [tasksViewMode, setTasksViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [tasksSearchQuery, setTasksSearchQuery] = useState('');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [listContextMenu, setListContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);
  const [pendingTaskStageId, setPendingTaskStageId] = useState<string | undefined>(undefined);
  const [tasksData, setTasksData] = useState<TaskItem[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [projectTaskTags, setProjectTaskTags] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<EditTaskData | null>(null);

  // Open task from URL query param (e.g., from notification link)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const taskParam = params.get('taskId');
    if (taskParam && !selectedTaskId) {
      setSelectedTaskId(taskParam);
    }
  }, [selectedTaskId]);
  const [selectedWorkflowStages, setSelectedWorkflowStages] = useState<WorkflowStage[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [linkedItemSuggestions, setLinkedItemSuggestions] = useState<LinkedSuggestionItem[]>([]);

  const canCreateTask = projectRole !== 'viewer';
  const canManageWorkflow = projectRole === 'owner' || projectRole === 'admin';
  const canManageTask = ['owner', 'admin', 'manager'].includes(projectRole);
  const hasExistingTasks = tasksData.length > 0;
  const workflowDisabledReason = hasExistingTasks
    ? 'Workflow selection is locked because this project already has tasks.'
    : (!canManageWorkflow ? 'Only project owner/admin can change workflow' : undefined);
  const currentUserId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem('orbit_user');
      return raw ? String(JSON.parse(raw).id || '') : '';
    } catch {
      return '';
    }
  }, []);
  const scopeRequestBody = useMemo(
    () => ({
      projectId: scope.projectId,
      ...(scope.type === 'package' && scope.packageId ? { packageId: scope.packageId } : {}),
    }),
    [scope.packageId, scope.projectId, scope.type]
  );

  useEffect(() => {
    let cancelled = false;

    const loadTeamMembers = async () => {
      try {
        const membersRes = await fetch('/api/projects/member-list', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId: scope.projectId }),
        });

        if (!membersRes.ok) return;

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
        }
      } catch {
        if (!cancelled) {
          setTeamMembers([]);
        }
      }
    };

    loadTeamMembers();
    return () => {
      cancelled = true;
    };
  }, [scope.projectId]);

  // Load model files for Affected Models picker
  useEffect(() => {
    let cancelled = false;
    setLoadingModelFiles(true);

    const loadModelFiles = async () => {
      try {
        const res = await apiFetch('/api/projects/packages/documents/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: scope.projectId, includePackages: true }),
        });
        if (!res.ok) return;

        const payload = await res.json();
        const flatten = (nodes: any[]): any[] => {
          const out: any[] = [];
          for (const n of nodes ?? []) {
            if (n.type === 'file' && MODEL_EXT.test(n.name || '')) {
              out.push({ id: n.id, name: n.name, folderPath: n.folderPath });
            }
            if (n.children) out.push(...flatten(n.children));
          }
          return out;
        };

        if (!cancelled) {
          setModelFiles(flatten(payload?.data?.tree?.children || []));
        }
      } catch {
        if (!cancelled) setModelFiles([]);
      } finally {
        if (!cancelled) setLoadingModelFiles(false);
      }
    };

    loadModelFiles();
    return () => { cancelled = true; };
  }, [scope.projectId, scope.packageId, scope.type]);

  // Map team members for CreateTaskModal's MemberPicker from existing teamMembers
  useEffect(() => {
    setTeamMembersForTask(teamMembers.map((m) => ({
      userId: m.id,
      user: { fullName: m.name },
      role: m.role,
    })));
  }, [teamMembers]);

  const loadTasks = useCallback(async () => {
    setIsTasksLoading(true);
    try {
      const response = await apiFetch('/api/tasks/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(scopeRequestBody),
      });

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
      const scopedTasks = rawTasks.filter((task: any) => {
        const taskPackageId = String(task?.packageId || '').trim();
        if (scope.type === 'package') {
          return Boolean(scope.packageId) && taskPackageId === String(scope.packageId);
        }
        return taskPackageId.length === 0;
      });

      const mapped: TaskItem[] = scopedTasks.map((t: any) => ({
        id: String(t.publicId || t.id || ''),
        title: String(t.title || 'Untitled task'),
        description: String(t.description || ''),
        priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium') as TaskItem['priority'],
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
  }, [scope.packageId, scope.type, scopeRequestBody]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const loadProjectWorkflowData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/projects/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId: scope.projectId }),
      });

      if (!res.ok) return;

      const payload = await res.json();
      const data = payload?.data || {};
      const tags = Array.isArray(data.taskTags) ? data.taskTags : [];
      setProjectTaskTags(tags.map((t: any) => String(t?.name || '').toLowerCase()).filter(Boolean));

      const stages = Array.isArray(data.stages) ? data.stages : [];
      if (stages.length > 0) {
        setSelectedWorkflowStages(stages.map((s: any) => ({
          id: String(s.id || ''),
          name: String(s.label || s.name || ''),
          description: String(s.description || ''),
        })));
      }
      if (data.workflowTemplateId) {
        setSelectedWorkflowId(data.workflowTemplateId);
      }
    } catch {
      // CreateTaskModal already has fallback stages.
    }
  }, [scope.projectId]);

  const persistNewTaskTags = useCallback(async (submittedTags: string[]) => {
    const normalizedSubmittedTags = Array.from(
      new Set((submittedTags || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean))
    );
    if (normalizedSubmittedTags.length === 0) return;

    const knownTags = new Set(projectTaskTags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean));
    const newTags = normalizedSubmittedTags.filter((t) => !knownTags.has(t));
    if (newTags.length === 0) return;

    try {
      const workflowRes = await apiFetch('/api/projects/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId: scope.projectId }),
      });
      if (!workflowRes.ok) return;

      const workflowPayload = await workflowRes.json().catch(() => null);
      const workflowData = workflowPayload?.data || {};
      const existingTaskTags = Array.isArray(workflowData?.taskTags) ? workflowData.taskTags : [];
      const existingNames = new Set(
        existingTaskTags.map((tag: any) => String(tag?.name || '').trim().toLowerCase()).filter(Boolean)
      );

      const tagsToAppend = newTags
        .filter((name) => !existingNames.has(name))
        .map((name) => ({
          id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          description: '',
          color: '#6366F1',
        }));
      if (tagsToAppend.length === 0) return;

      const updateRes = await apiFetch('/api/projects/workflow/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: scope.projectId,
          template: workflowData?.template,
          stages: workflowData?.stages,
          settings: workflowData?.settings,
          taskTags: [...existingTaskTags, ...tagsToAppend],
        }),
      });
      if (!updateRes.ok) return;

      setProjectTaskTags((prev) => Array.from(new Set([...prev, ...newTags])));
    } catch {
      // Non-blocking: task create/update should still continue.
    }
  }, [projectTaskTags, scope.projectId]);

  useEffect(() => {
    let cancelled = false;
    loadProjectWorkflowData();

    const handleWorkflowApplied = () => {
      if (!cancelled) {
        void loadProjectWorkflowData();
      }
    };
    window.addEventListener('workflow-applied', handleWorkflowApplied);
    return () => {
      cancelled = true;
      window.removeEventListener('workflow-applied', handleWorkflowApplied);
    };
  }, [loadProjectWorkflowData]);

  const filteredTasks = useMemo(
    () => tasksData.filter((t) => t.title.toLowerCase().includes(tasksSearchQuery.toLowerCase())),
    [tasksData, tasksSearchQuery]
  );
  const calendarTasks = useMemo(
    () => filteredTasks
      .filter((t) => ['backlog', 'todo', 'in-progress', 'review', 'done'].includes(t.status))
      .map((t) => ({ ...t, status: t.status as CalendarTaskStatus })),
    [filteredTasks]
  );
  useEffect(() => {
    let cancelled = false;

    const flattenDocumentNodes = (nodes: any[], result: any[] = []): any[] => {
      for (const node of nodes || []) {
        if (node?.type === 'file') result.push(node);
        if (Array.isArray(node?.children) && node.children.length > 0) {
          flattenDocumentNodes(node.children, result);
        }
      }
      return result;
    };

    const loadLinkedSuggestions = async () => {
      try {
        const documentEndpoint = scope.type === 'package' && scope.packageId
          ? '/api/projects/packages/documents/package/list'
          : '/api/projects/packages/documents/list';
        const documentBody = scope.type === 'package' && scope.packageId
          ? { projectId: scope.projectId, packageId: scope.packageId }
          : { projectId: scope.projectId };

        const [documentsRes, changesRes, clashesRes] = await Promise.all([
          apiFetch(documentEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(documentBody),
          }),
          apiFetch(`/api/projects/${scope.projectId}/change-requests`),
          apiFetch(`/api/projects/${encodeURIComponent(scope.projectId)}/navisworks/clashes`),
        ]);

        const nextSuggestions: LinkedSuggestionItem[] = [];
        const baseProjectPath = `/projects/${scope.projectId}`;
        const scopedPrefix = scope.type === 'package' && scope.packageId
          ? `${baseProjectPath}/packages/${scope.packageId}`
          : baseProjectPath;

        if (documentsRes.ok) {
          const payload = await documentsRes.json();
          const tree = payload?.data?.tree;
          const files = flattenDocumentNodes(tree?.children || []);
          for (const file of files.slice(0, 30)) {
            const name = String(file?.name || '').trim();
            if (!name) continue;
            nextSuggestions.push({
              label: `[Document] ${name}`,
              value: file?.s3Url || `${scopedPrefix}?tab=documents`,
            });
          }
        }

        if (changesRes.ok) {
          const payload = await changesRes.json();
          const changes = Array.isArray(payload?.data) ? payload.data : [];
          for (const cr of changes.slice(0, 30)) {
            const crId = String(cr?.publicId || '');
            const title = String(cr?.title || '').trim();
            if (!crId || !title) continue;
            nextSuggestions.push({
              label: `[Change Request] ${title}`,
              value: `${scopedPrefix}?tab=changes&crId=${encodeURIComponent(crId)}`,
            });
          }
        }

        if (clashesRes.ok) {
          const payload = await clashesRes.json();
          const clashes = Array.isArray(payload?.clashes) ? payload.clashes : [];
          for (const clash of clashes.slice(0, 30)) {
            const clashId = String(clash?.id || '');
            const title = String(clash?.title || '').trim();
            if (!clashId || !title) continue;
            nextSuggestions.push({
              label: `[Clash] ${title}`,
              value: `${scopedPrefix}?tab=clashes&clashId=${encodeURIComponent(clashId)}`,
            });
          }
        }

        const deduped = Array.from(
          new Map(nextSuggestions.map((item) => [`${item.label}::${item.value}`, item])).values()
        );

        if (!cancelled) {
          setLinkedItemSuggestions(deduped);
        }
      } catch {
        if (!cancelled) {
          setLinkedItemSuggestions([]);
        }
      }
    };

    loadLinkedSuggestions();
    return () => {
      cancelled = true;
    };
  }, [scope.packageId, scope.projectId, scope.type]);

  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    if (!canCreateTask) return;
    const targetTask = tasksData.find((t) => t.id === taskId);
    if (!targetTask) return;
    const assigneeIds = targetTask.assigneeIds || [];
    const reviewerIds = targetTask.reviewerIds || [];
    const allIds = [targetTask.assigneeId, ...assigneeIds, ...reviewerIds].filter(Boolean);
    const canMoveStage =
      projectRole === 'owner' ||
      projectRole === 'admin' ||
      projectRole === 'manager' ||
      (projectRole === 'member' && allIds.includes(currentUserId));
    if (!canMoveStage) {
      toast.error('Only owner/admin/manager, assignees, or reviewers can move this task.');
      return;
    }

    const previousTasks = tasksData;
    setTasksData((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const response = await apiFetch('/api/tasks/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...scopeRequestBody,
          taskId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        setTasksData(previousTasks);
        toast.error('Failed to update task status');
      }
    } catch {
      setTasksData(previousTasks);
      toast.error('Failed to update task status');
    }
  }, [canCreateTask, currentUserId, projectRole, scopeRequestBody, tasksData]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const res = await apiFetch('/api/tasks/', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.success) {
        setTasksData(prev => prev.filter(t => t.id !== taskId));
        if (selectedTaskId === taskId) setSelectedTaskId(null);
        toast.success('Task deleted');
      } else {
        toast.error(data.message || 'Failed to delete task');
      }
    } catch {
      toast.error('Failed to delete task');
    }
  }, [selectedTaskId]);

  // Close list context menu on outside click
  const listMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listContextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setListContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setListContextMenu(null); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [listContextMenu]);

  const isPackageScope = scope.type === 'package';
  const resolveStageName = useCallback((status: string) => {
    const stage = selectedWorkflowStages.find((s) => s.id === status);
    return stage?.name || status;
  }, [selectedWorkflowStages]);

  const priorityBadgeClass = (priority: TaskItem['priority']) => cn(
    'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
    priority === 'urgent' && 'bg-[#FEE2E2] text-[#DC2626]',
    priority === 'high' && 'bg-[#FEE2E2] text-[#DC2626]',
    priority === 'medium' && 'bg-[#FEF9C3] text-[#A16207]',
    priority === 'low' && 'bg-[#F3F4F6] text-[#364153]'
  );

  const stageBadgeClass = (stageName: string) => {
    const normalized = stageName.toLowerCase();
    if (normalized.includes('complete') || normalized.includes('done')) {
      return 'bg-[#DCFCE7] text-[#008236]';
    }
    if (normalized.includes('progress') || normalized.includes('doing')) {
      return 'bg-[#DFEAFF] text-[#155DFC]';
    }
    if (normalized.includes('pending') || normalized.includes('backlog') || normalized.includes('todo')) {
      return 'bg-[#F3F4F6] text-[#6A7282]';
    }
    return 'bg-[#F3F4F6] text-[#364153]';
  };

  if (isPackageScope) {
    return (
      <div className="flex h-full flex-col py-1 px-6 lg:px-[80px] xl:px-[160px]">
        <div className="flex items-center justify-between gap-4 pt-0 pb-6">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search tasks..."
              value={tasksSearchQuery}
              onChange={(e) => setTasksSearchQuery(e.target.value)}
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] pl-9 pr-4 py-2 text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsNewTaskModalOpen(true)}
            disabled={!canCreateTask}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#155DFC] px-5 text-[14px] font-normal text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Task
          </button>
        </div>

        <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
          {isTasksLoading ? (
            <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4 text-sm text-[#6A7282]">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#E5E7EB] bg-white p-8 text-center text-sm text-[#6A7282]">
              No tasks found.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const assignee = teamMembers.find((m) => m.id === task.assigneeId);
              const stageName = resolveStageName(task.status);
              const isCompleted = stageName.toLowerCase().includes('complete') || stageName.toLowerCase().includes('done');
              const dueDateText = formatIsoDate(task.dueDate);

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-left transition-colors hover:border-[#D0D5DD] hover:bg-[#FAFAFA]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-medium text-[#101828]">{task.title}</p>
                        <span className={priorityBadgeClass(task.priority)}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[12px] text-[#4A5565]">
                        {task.description || 'No description'}
                      </p>
                    </div>
                    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[12px] font-medium', stageBadgeClass(stageName))}>
                      {stageName}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {assignee ? (
                        <>
                          {assignee.avatarUrl ? (
                            <img src={assignee.avatarUrl} alt={assignee.name} className="inline-flex h-5 w-5 items-center justify-center rounded-full object-cover" />
                          ) : (
                            <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white', assignee.color)}>
                              {assignee.avatar}
                            </span>
                          )}
                          <span className="text-[12px] text-[#4A5565]">{assignee.name}</span>
                        </>
                      ) : (
                        <span className="text-[12px] text-[#99A1AF]">Unassigned</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[12px] text-[#6A7282]">
                      {isCompleted && dueDateText && (
                        <span className="text-[#008236]">Completed {dueDateText}</span>
                      )}
                      {dueDateText && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v11.25M3 18.75A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75M3 10.5h18" />
                          </svg>
                          Due {dueDateText}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <Dialog open={!!selectedTaskId} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
          <DialogContent className="max-w-[calc(100%-2rem)] w-[1100px] max-h-[90vh] overflow-y-auto p-0">
            {selectedTaskId && (
              <TaskDetailPage
                projectPublicId={scope.projectId}
                packageId={scope.packageId ?? null}
                taskId={selectedTaskId}
              />
            )}
          </DialogContent>
        </Dialog>

        <CreateTaskModal
          isOpen={isNewTaskModalOpen}
          onClose={() => {
            setIsNewTaskModalOpen(false);
            setPendingTaskStageId(undefined);
            setEditingTask(null);
          }}
          editTask={editingTask}
          onUpdate={async (taskId, task) => {
            try {
              await persistNewTaskTags(task.tags);
              const res = await apiFetch('/api/tasks/', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  taskId,
                  title: task.title,
                  status: task.status,
                  priority: task.priority,
                  description: task.description,
                  assigneeIds: task.assigneeIds,
                  reviewerIds: task.reviewerIds,
                  dueDate: task.dueDate || undefined,
                  linkedUrl: task.linkedItems || undefined,
                  tags: task.tags,
                }),
              });
              const data = await res.json();
              if (data.success) {
                toast.success('Task updated');
                setEditingTask(null);
                await loadTasks();
              } else {
                toast.error(data.message || 'Failed to update task');
              }
            } catch {
              toast.error('Failed to update task');
            }
          }}
          tagOptions={projectTaskTags}
          linkedItemSuggestions={linkedItemSuggestions}
          workflowStages={selectedWorkflowStages}
          defaultStageId={pendingTaskStageId}
          modelFiles={modelFiles}
          loadingFiles={loadingModelFiles}
          teamMembers={teamMembersForTask}
          onSubmit={async (task) => {
            try {
              await persistNewTaskTags(task.tags);
              const response = await apiFetch('/api/tasks/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                  ...scopeRequestBody,
                  title: task.title,
                  status: task.status,
                  priority: task.priority,
                  description: task.description,
                  assigneeIds: task.assigneeIds,
                  reviewerIds: task.reviewerIds,
                  dueDate: task.dueDate || undefined,
                  linkedUrl: task.linkedItems || undefined,
                  tags: task.tags,
                }),
              });

              if (response.status === 404) {
                toast.error('Tasks API is not available yet');
                return;
              }

              if (!response.ok) {
                const payload = await response.json().catch(() => null);
                toast.error(payload?.message || 'Failed to create task');
                return;
              }

              toast.success('Task created');
              await loadTasks();
            } catch {
              toast.error('Failed to create task');
            }
          }}
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex-1 overflow-y-auto pr-1">
        {isTasksLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          </div>
        ) : tasksData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No tasks yet</p>
            <p className="text-xs text-gray-400 mt-1">Tasks created in this package will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasksData.slice(0, 5).map((task) => {
              const assignee = teamMembers.find((m) => m.id === task.assigneeId);
              const stageName = resolveStageName(task.status);
              const isCompleted = stageName.toLowerCase().includes('complete') || stageName.toLowerCase().includes('done');

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignee ? assignee.name : 'Unassigned'}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize bg-[#F3F4F6] text-[#364153]">
                    {isCompleted ? 'Done' : stageName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full py-6 px-6 lg:px-[80px] xl:px-[160px]">
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <WorkflowTemplatesDropdown
            selectedWorkflow={selectedWorkflowId}
            projectId={scope.projectId}
            canApply={canManageWorkflow}
            disabledReason={workflowDisabledReason}
            onSelect={(workflowId, stages) => {
              setSelectedWorkflowId(workflowId);
              setSelectedWorkflowStages(stages);
            }}
            onConfigureClick={() => undefined}
          />
          <button
            onClick={() => setIsNewTaskModalOpen(true)}
            disabled={!canCreateTask}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Task
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-[10px] bg-[#F3F4F6] p-1">
          <button
            onClick={() => setTasksViewMode('board')}
            className={cn(
              'p-1.5 rounded-[8px] transition-colors',
              tasksViewMode === 'board' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
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
              'p-1.5 rounded-[8px] transition-colors',
              tasksViewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
            )}
          >
            <svg className="h-4 w-4 text-[#4A5565]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
          </button>
          <button
            onClick={() => setTasksViewMode('calendar')}
            className={cn(
              'p-1.5 rounded-[8px] transition-colors',
              tasksViewMode === 'calendar' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
            )}
          >
            <svg className="h-4 w-4 text-[#4A5565]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
              <rect x="2" y="3" width="12" height="11" rx="1" />
              <path d="M2 6h12M5 1v4M11 1v4" />
            </svg>
          </button>
        </div>
      </div>

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
      </div>

      {tasksViewMode === 'board' && (
        <div className="flex-1 overflow-x-auto">
          <TaskBoard
            tasks={filteredTasks}
            teamMembers={teamMembers}
            loading={isTasksLoading}
            stages={selectedWorkflowStages}
            projectRole={projectRole}
            onTaskStatusChange={handleTaskStatusChange}
            onTaskClick={setSelectedTaskId}
            onAddTask={(stageId) => {
              if (!canCreateTask) return;
              setPendingTaskStageId(stageId);
              setIsNewTaskModalOpen(true);
            }}
            onEditRequest={(task) => {
              if (!canManageTask) return;
              const fullTask = tasksData.find(t => t.id === task.id);
              if (fullTask) {
                setEditingTask({
                  id: fullTask.id,
                  title: fullTask.title,
                  status: fullTask.status,
                  priority: fullTask.priority,
                  description: fullTask.description,
                  assigneeId: fullTask.assigneeId,
                  assigneeIds: fullTask.assigneeIds,
                  reviewerIds: fullTask.reviewerIds,
                  dueDate: fullTask.dueDate,
                  tags: fullTask.tags,
                  linkedItems: fullTask.linkedItem?.name || '',
                });
                setIsNewTaskModalOpen(true);
              }
            }}
            onDeleteRequest={(taskId) => {
              if (!canManageTask) return;
              handleDeleteTask(taskId);
            }}
          />
        </div>
      )}

      {tasksViewMode === 'list' && (
        <div className="flex-1 overflow-auto">
          <div className="rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px_150px_100px_80px] gap-4 px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[12px] font-medium text-[#6A7282] uppercase tracking-wide">
              <div>Task</div>
              <div>Status</div>
              <div>Priority</div>
              <div>Due Date</div>
              <div>Assignee</div>
              <div></div>
            </div>

            {filteredTasks.map((task) => {
              const assignee = teamMembers.find((m) => m.id === task.assigneeId);
              const stage = selectedWorkflowStages.find((s) => s.id === task.status);
              return (
                <div key={task.id} className="grid grid-cols-[1fr_120px_120px_150px_100px_80px] gap-4 px-4 py-3 border-b border-[#E5E7EB] hover:bg-gray-50 items-center">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className="text-left text-[14px] text-[#101828] hover:text-[#155DFC] hover:underline"
                    >
                      {task.title}
                    </button>
                    <div className="flex gap-1">
                      {task.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-[6px] bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#4A5565]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[12px] bg-[#F3F4F6] text-[#364153]">
                      {stage?.name || task.status}
                    </span>
                  </div>
                  <div>
                    <span className={cn(
                      'inline-flex items-center rounded px-2 py-0.5 text-[12px]',
                      task.priority === 'urgent' && 'bg-[#FEE2E2] text-[#DC2626]',
                      task.priority === 'high' && 'bg-[#FEE2E2] text-[#DC2626]',
                      task.priority === 'medium' && 'bg-[#F0F9FF] text-[#0069A8]',
                      task.priority === 'low' && 'bg-[#F3F4F6] text-[#364153]'
                    )}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="text-[14px] text-[#6A7282]">
                    {task.dueDate ? formatDate(task.dueDate) : '-'}
                  </div>
                  <div>
                    {assignee && (
                      <div className="flex items-center gap-2">
                        {assignee.avatarUrl ? (
                          <img src={assignee.avatarUrl} alt={assignee.name} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white', assignee.color)}>
                            {assignee.avatar}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    {canManageTask ? (
                      <div className="relative" ref={listMenuRef}>
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            setListContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id });
                          }}
                        >
                          <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                          </svg>
                        </button>
                        {listContextMenu?.taskId === task.id && (
                          <div
                            className="fixed z-[99999] w-36 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 text-[13px]"
                            style={{ top: listContextMenu.y, left: listContextMenu.x }}
                          >
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-[#101828]"
                              onClick={() => { setSelectedTaskId(task.id); setListContextMenu(null); }}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
                              onClick={() => { handleDeleteTask(task.id); setListContextMenu(null); }}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-6" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tasksViewMode === 'calendar' && (
        <div className="flex-1 overflow-auto">
          <TaskCalendar
            tasks={calendarTasks}
            teamMembers={teamMembers}
            onTaskClick={setSelectedTaskId}
          />
        </div>
      )}

      <Dialog open={!!selectedTaskId} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] w-[1100px] max-h-[90vh] overflow-y-auto p-0">
          {selectedTaskId && (
            <TaskDetailPage
              projectPublicId={scope.projectId}
              packageId={scope.type === 'package' ? scope.packageId ?? null : null}
              taskId={selectedTaskId}
            />
          )}
        </DialogContent>
      </Dialog>

      <CreateTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => {
          setIsNewTaskModalOpen(false);
          setPendingTaskStageId(undefined);
          setEditingTask(null);
        }}
        editTask={editingTask}
        onUpdate={async (taskId, task) => {
          try {
            await persistNewTaskTags(task.tags);
            const res = await apiFetch('/api/tasks/', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskId,
                title: task.title,
                status: task.status,
                priority: task.priority,
                description: task.description,
                assigneeIds: task.assigneeIds,
                reviewerIds: task.reviewerIds,
                dueDate: task.dueDate || undefined,
                linkedUrl: task.linkedItems || undefined,
                tags: task.tags,
              }),
            });
            const data = await res.json();
            if (data.success) {
              toast.success('Task updated');
              setEditingTask(null);
              await loadTasks();
            } else {
              toast.error(data.message || 'Failed to update task');
            }
          } catch {
            toast.error('Failed to update task');
          }
        }}
        tagOptions={projectTaskTags}
        linkedItemSuggestions={linkedItemSuggestions}
        workflowStages={selectedWorkflowStages}
          defaultStageId={pendingTaskStageId}
          modelFiles={modelFiles}
          loadingFiles={loadingModelFiles}
          teamMembers={teamMembersForTask}
          onSubmit={async (task) => {
            try {
              await persistNewTaskTags(task.tags);
              const response = await apiFetch('/api/tasks/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                ...scopeRequestBody,
                title: task.title,
                status: task.status,
                priority: task.priority,
                description: task.description,
                assigneeIds: task.assigneeIds,
                reviewerIds: task.reviewerIds,
                dueDate: task.dueDate || undefined,
                linkedUrl: task.linkedItems || undefined,
                tags: task.tags,
              }),
            });

            if (response.status === 404) {
              toast.error('Tasks API is not available yet');
              return;
            }

            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              toast.error(payload?.message || 'Failed to create task');
              return;
            }

            toast.success('Task created');
            await loadTasks();
          } catch {
            toast.error('Failed to create task');
          }
        }}
      />
    </div>
  );
}
