'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

interface TaskDetailData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: TaskPriority;
  assigneeName?: string;
  dueDate?: string;
  tags: string[];
  linkedUrl?: string;
}

interface CommentItem {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface WorkflowStage {
  id: string;
  label: string;
}

interface TaskDetailPageProps {
  projectPublicId: string;
  taskId: string;
}

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const fallbackStages: WorkflowStage[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

const normalizeStageId = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

export default function TaskDetailPage({ projectPublicId, taskId }: TaskDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [projectRole, setProjectRole] = useState<ProjectRole>('member');
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>(fallbackStages);
  const [updatingStage, setUpdatingStage] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [detailRes, commentsRes, projectsRes, workflowRes] = await Promise.all([
          apiFetch('/api/tasks/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: projectPublicId, taskId }),
          }),
          apiFetch('/api/tasks/comments/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: projectPublicId, taskId }),
          }),
          apiFetch('/api/projects/me', {
            method: 'GET',
            headers: { Accept: 'application/json' },
          }),
          apiFetch('/api/projects/workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: projectPublicId }),
          }),
        ]);

        if (detailRes.ok) {
          const payload = await detailRes.json();
          const t = payload?.data;
          if (!cancelled && t) {
            setTask({
              id: String(t.publicId || t.id || taskId),
              title: String(t.title || 'Untitled task'),
              description: String(t.description || ''),
              status: normalizeStageId(String(t.status || 'backlog')),
              priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium') as TaskPriority,
              assigneeName: t.assigneeName || t.assignee?.fullName || '',
              dueDate: t.dueDate || '',
              tags: Array.isArray(t.tags) ? t.tags : [],
              linkedUrl: t.linkedUrl || '',
            });
          }
        } else if (!cancelled) {
          toast.error('Failed to load task detail');
        }

        if (commentsRes.ok) {
          const payload = await commentsRes.json();
          const list = Array.isArray(payload?.data) ? payload.data : [];
          if (!cancelled) {
            setComments(
              list.map((c: any) => ({
                id: String(c.publicId || c.id || Math.random()),
                author: String(c.authorName || c.author?.fullName || 'Unknown'),
                content: String(c.content || ''),
                createdAt: String(c.createdAt || ''),
              }))
            );
          }
        }

        if (projectsRes.ok) {
          const payload = await projectsRes.json();
          const list = Array.isArray(payload?.data) ? payload.data : [];
          const currentProject = list.find((p: any) => String(p.publicId) === String(projectPublicId));
          const role = String(currentProject?.role || 'member') as ProjectRole;
          if (!cancelled) setProjectRole(role);
        }

        if (workflowRes.ok) {
          const payload = await workflowRes.json();
          const stagesRaw = Array.isArray(payload?.data?.stages) ? payload.data.stages : [];
          const stages = stagesRaw
            .map((s: any) => {
              const rawId = String(s.id || s.key || s.name || '').trim();
              if (!rawId) return null;
              return { id: normalizeStageId(rawId), label: String(s.label || s.name || rawId) } as WorkflowStage;
            })
            .filter(Boolean) as WorkflowStage[];

          if (!cancelled && stages.length > 0) setWorkflowStages(stages);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load task detail');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectPublicId, taskId]);

  const dueDateLabel = useMemo(() => {
    if (!task?.dueDate) return 'No due date';
    const d = new Date(task.dueDate);
    if (Number.isNaN(d.getTime())) return task.dueDate;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [task?.dueDate]);

  const canReviewAndMoveStage = projectRole === 'admin' || projectRole === 'owner';

  const currentStage = useMemo(
    () => workflowStages.find((s) => s.id === normalizeStageId(task?.status || '')),
    [workflowStages, task?.status]
  );

  const submitComment = async () => {
    const content = commentInput.trim();
    if (!content) return;

    try {
      const res = await apiFetch('/api/tasks/comments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId, taskId, content }),
      });

      if (!res.ok) {
        toast.error('Failed to post comment');
        return;
      }

      const payload = await res.json();
      const c = payload?.data;
      setComments((prev) => [
        {
          id: String(c?.publicId || c?.id || `${Date.now()}`),
          author: String(c?.authorName || c?.author?.fullName || 'You'),
          content: String(c?.content || content),
          createdAt: String(c?.createdAt || new Date().toISOString()),
        },
        ...prev,
      ]);
      setCommentInput('');
    } catch {
      toast.error('Failed to post comment');
    }
  };

  const updateStage = async (nextStageId: string) => {
    if (!task || !canReviewAndMoveStage || task.status === nextStageId) return;

    setUpdatingStage(true);
    try {
      const res = await apiFetch('/api/tasks/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: projectPublicId,
          taskId,
          status: nextStageId,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to update task stage');
        return;
      }

      setTask((prev) => (prev ? { ...prev, status: nextStageId } : prev));
      toast.success('Task stage updated');
    } catch {
      toast.error('Failed to update task stage');
    } finally {
      setUpdatingStage(false);
    }
  };

  if (loading) {
    return <div className="px-6 py-6 text-sm text-muted-foreground">Loading task detail...</div>;
  }

  if (!task) {
    return <div className="px-6 py-6 text-sm text-muted-foreground">Task not found.</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6 lg:px-[80px] xl:px-[160px]">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-medium text-[#101828]">{task.title}</h1>
            <p className="mt-2 text-sm text-[#4A5565]">{task.description || 'No description.'}</p>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium capitalize', priorityStyles[task.priority])}>
            {task.priority}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#4A5565] md:grid-cols-2">
          <p>
            Status:{' '}
            <span className="font-medium text-[#101828] capitalize">{currentStage?.label || task.status}</span>
          </p>
          <p>
            Assignee: <span className="font-medium text-[#101828]">{task.assigneeName || 'Unassigned'}</span>
          </p>
          <p>
            Due Date: <span className="font-medium text-[#101828]">{dueDateLabel}</span>
          </p>
          <p>
            Role: <span className="font-medium text-[#101828] capitalize">{projectRole}</span>
          </p>
        </div>

        {canReviewAndMoveStage && (
          <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6A7282]">Review & Stage Control</p>
            <div className="flex flex-wrap gap-2">
              {workflowStages.map((stage) => (
                <button
                  key={stage.id}
                  disabled={updatingStage || task.status === stage.id}
                  onClick={() => updateStage(stage.id)}
                  className={cn(
                    'rounded-[8px] border px-3 py-1.5 text-xs transition-colors',
                    task.status === stage.id
                      ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]'
                      : 'border-[#D1D5DC] bg-white text-[#364153] hover:bg-gray-50',
                    (updatingStage || task.status === stage.id) && 'cursor-not-allowed opacity-70'
                  )}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!canReviewAndMoveStage && (
          <p className="mt-4 text-xs text-[#6A7282]">
            You can view and comment on this task. Only Admin/Owner can review and move stage.
          </p>
        )}

        {task.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5565]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {task.linkedUrl && (
          <a
            href={task.linkedUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm text-[#155DFC] hover:underline"
          >
            Linked Drawing / Model
          </a>
        )}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-[16px] font-medium text-[#101828]">Comments</h2>

        <div className="mt-4 flex gap-2">
          <input
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Write a comment..."
            className="h-10 flex-1 rounded-[10px] border border-[#E5E7EB] px-3 text-sm focus:border-[#2B7FFF] focus:outline-none"
          />
          <button onClick={submitComment} className="rounded-[10px] bg-[#155DFC] px-4 text-sm text-white hover:bg-blue-700">
            Post
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-[#6A7282]">No comments yet.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#101828]">{c.author}</p>
                  <p className="text-xs text-[#6A7282]">{new Date(c.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-sm text-[#4A5565]">{c.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
