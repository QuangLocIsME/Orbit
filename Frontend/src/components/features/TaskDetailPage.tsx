'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Calendar, MessageSquare, User, Briefcase, Clock, Send } from 'lucide-react';

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
  avatar?: string;
}

interface WorkflowStage {
  id: string;
  label: string;
}

interface TaskDetailPageProps {
  projectPublicId: string;
  taskId: string;
}

const statusToneById: Record<string, string> = {
  backlog: 'bg-slate-100 text-slate-600',
  todo: 'bg-blue-50 text-blue-600',
  'in-progress': 'bg-amber-50 text-amber-600',
  review: 'bg-orange-50 text-orange-600',
  done: 'bg-emerald-50 text-emerald-600',
  approved: 'bg-emerald-50 text-emerald-600',
  draft: 'bg-slate-100 text-slate-600',
  revision: 'bg-purple-50 text-purple-600',
  testing: 'bg-cyan-50 text-cyan-600',
};

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-teal-50 text-teal-700' },
  medium: { label: 'Medium', color: 'bg-amber-50 text-amber-700' },
  high: { label: 'High', color: 'bg-red-50 text-red-700' },
  urgent: { label: 'Urgent', color: 'bg-red-50 text-red-700' },
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

const toDisplayTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

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
                avatar: c.author?.avatar || '',
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
          avatar: c?.author?.avatar || '',
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
    return <div className="p-6 text-sm text-muted-foreground">Loading task detail...</div>;
  }

  if (!task) {
    return <div className="p-6 text-sm text-muted-foreground">Task not found.</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">{task.title}</h2>
            <p className="text-sm text-muted-foreground">{task.description || 'No description.'}</p>
          </div>
          <span className={cn('shrink-0 rounded-md border-0 px-2.5 py-1 text-xs font-medium', priorityConfig[task.priority].color)}>
            {priorityConfig[task.priority].label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Status</p>
            <p className={cn('text-sm font-medium', statusToneById[task.status] || 'text-foreground')}>
              {currentStage?.label || task.status}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Assignee</p>
            <p className="text-sm font-medium">{task.assigneeName || 'Unassigned'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Due Date</p>
            <p className="text-sm font-medium">{dueDateLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Role</p>
            <p className="text-sm font-medium capitalize">{projectRole}</p>
          </div>
        </div>
      </div>

      {canReviewAndMoveStage ? (
        <div className="space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Review & Stage Control
          </p>
          <div className="flex flex-wrap gap-2">
            {workflowStages.map((stage) => (
              <button
                key={stage.id}
                disabled={updatingStage || task.status === stage.id}
                onClick={() => updateStage(stage.id)}
                className={cn(
                  'h-8 rounded-md border px-3 text-xs transition-all',
                  task.status === stage.id
                    ? 'bg-foreground text-background shadow-sm'
                    : 'border-border bg-background hover:bg-muted',
                  (updatingStage || task.status === stage.id) && 'cursor-not-allowed opacity-70'
                )}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only Admin/Owner can review and move stage.</p>
      )}

      {(task.tags.length > 0 || task.linkedUrl) && <div className="h-px bg-border" />}

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5565]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {task.linkedUrl && (
        <a href={task.linkedUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm text-[#155DFC] hover:underline">
          Linked Drawing / Model
        </a>
      )}

      <div className="h-px bg-border" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Comments</h3>
          {comments.length > 0 && (
            <span className="ml-auto inline-flex h-5 items-center rounded-full bg-muted px-2 text-[10px] font-medium text-muted-foreground">{comments.length}</span>
          )}
        </div>

        {/* Input box */}
        <div className="rounded-xl border border-border bg-background shadow-sm">
          <textarea
            placeholder="Write a comment…"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            className="w-full resize-none rounded-t-xl bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none min-h-[72px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment();
            }}
          />
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground/60">Ctrl + Enter to post</span>
            <button
              onClick={submitComment}
              disabled={!commentInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-40 hover:opacity-80"
            >
              <Send className="h-3 w-3" />
              Post
            </button>
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">
              <MessageSquare className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">No comments yet.</p>
          </div>
        ) : (
          <div className="space-y-1 pt-1">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-muted/30">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: (() => {
                    const PALETTE = ['#6366F1','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
                    let h = 0;
                    for (let i = 0; i < (comment.author || '').length; i++) h = (comment.author || '').charCodeAt(i) + ((h << 5) - h);
                    return PALETTE[Math.abs(h) % PALETTE.length];
                  })() }}
                >
                  {String(comment.author || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{comment.author}</span>
                    <span className="text-[11px] text-muted-foreground/60" title={toDisplayTime(comment.createdAt)}>
                      {(() => {
                        const diff = Date.now() - new Date(comment.createdAt).getTime();
                        const m = Math.floor(diff / 60000);
                        if (m < 1) return 'just now';
                        if (m < 60) return `${m}m ago`;
                        const h = Math.floor(m / 60);
                        if (h < 24) return `${h}h ago`;
                        const d = Math.floor(h / 24);
                        return d < 7 ? `${d}d ago` : new Date(comment.createdAt).toLocaleDateString();
                      })()}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
