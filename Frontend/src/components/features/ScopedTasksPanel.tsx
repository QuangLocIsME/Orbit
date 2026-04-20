'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import CreateTaskModal from './CreateTaskModal';
import TaskBoard, { type WorkflowStage } from './TaskBoard';
import TaskCalendar from './TaskCalendar';
import TaskDetailPage from './TaskDetailPage';
import WorkflowTemplatesDropdown from './WorkflowTemplatesDropdown';

type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ScopedTaskScope {
  type: 'project' | 'package';
  projectId: string;
  packageId?: string | null;
}

interface ScopedTasksPanelProps {
  scope: ScopedTaskScope;
  projectRole?: ProjectRole;
}

interface TeamMemberView {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  isOnline: boolean;
}

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
}
type CalendarTaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';

const avatarColors = ['bg-pink-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500'];

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

export default function ScopedTasksPanel({ scope, projectRole = 'member' }: ScopedTasksPanelProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMemberView[]>([]);
  const [tasksViewMode, setTasksViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [tasksSearchQuery, setTasksSearchQuery] = useState('');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [pendingTaskStageId, setPendingTaskStageId] = useState<string | undefined>(undefined);
  const [tasksData, setTasksData] = useState<TaskItem[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [projectTaskTags, setProjectTaskTags] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedWorkflowStages, setSelectedWorkflowStages] = useState<WorkflowStage[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  const canCreateTask = projectRole !== 'viewer';
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

      const mapped: TaskItem[] = rawTasks.map((t: any) => ({
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
  }, [scopeRequestBody]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    let cancelled = false;

    const loadProjectWorkflowData = async () => {
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
        if (!cancelled) {
          setProjectTaskTags(tags.map((t: any) => String(t?.name || '').toLowerCase()).filter(Boolean));
        }

        if (!cancelled) {
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
        }
      } catch {
        // CreateTaskModal already has fallback stages.
      }
    };

    loadProjectWorkflowData();
    return () => {
      cancelled = true;
    };
  }, [scope.projectId]);

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

  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    if (!canCreateTask) return;

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
  }, [canCreateTask, scopeRequestBody, tasksData]);

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
      <div className="flex h-full flex-col py-6 px-6 lg:px-[80px] xl:px-[160px]">
        <div className="flex items-center justify-between gap-4 py-2">
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
                          <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white', assignee.color)}>
                            {assignee.avatar}
                          </span>
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
          }}
          assigneeOptions={teamMembers.map((m) => ({ id: m.id, name: m.name }))}
          tagOptions={projectTaskTags}
          workflowStages={selectedWorkflowStages}
          defaultStageId={pendingTaskStageId}
          onSubmit={async (task) => {
            try {
              const response = await apiFetch('/api/tasks/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                  ...scopeRequestBody,
                  title: task.title,
                  status: task.status,
                  priority: task.priority,
                  description: task.description,
                  assigneeId: task.assignee || undefined,
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

  return (
    <div className="flex flex-col h-full py-6 px-6 lg:px-[80px] xl:px-[160px]">
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <WorkflowTemplatesDropdown
            selectedWorkflow={selectedWorkflowId}
            projectId={scope.projectId}
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
            onTaskStatusChange={handleTaskStatusChange}
            onTaskClick={setSelectedTaskId}
            onAddTask={(stageId) => {
              if (!canCreateTask) return;
              setPendingTaskStageId(stageId);
              setIsNewTaskModalOpen(true);
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
                        <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white', assignee.color)}>
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
        }}
        assigneeOptions={teamMembers.map((m) => ({ id: m.id, name: m.name }))}
        tagOptions={projectTaskTags}
        workflowStages={selectedWorkflowStages}
        defaultStageId={pendingTaskStageId}
        onSubmit={async (task) => {
          try {
            const response = await apiFetch('/api/tasks/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                ...scopeRequestBody,
                title: task.title,
                status: task.status,
                priority: task.priority,
                description: task.description,
                assigneeId: task.assignee || undefined,
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
