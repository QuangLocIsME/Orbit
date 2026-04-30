'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Calendar, MessageSquare, User, Briefcase, Clock, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type ProjectRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

interface TaskAttachment {
  name: string;
  size: number;
  url: string;
  mimeType?: string;
  uploadedAt?: string;
}

interface TaskDetailData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeIds?: string[];
  assigneeName?: string;
  assigneeNames?: string[];
  reviewerIds?: string[];
  reviewerNames?: string[];
  dueDate?: string;
  tags: string[];
  linkedUrl?: string;
  attachments?: TaskAttachment[];
}

interface CommentItem {
  id: string;
  author: string;
  authorId?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  avatar?: string;
}

interface WorkflowStage {
  id: string;
  label: string;
}

interface TaskDetailPageProps {
  projectPublicId: string;
  taskId: string;
  packageId?: string | null;
  onClose?: () => void;
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

const priorityColor: Record<TaskPriority, string> = {
  low: 'bg-teal-50 text-teal-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-red-50 text-red-700',
  urgent: 'bg-red-50 text-red-700',
};

const fallbackStages: WorkflowStage[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

// Normalize stage ID - only lowercase and replace spaces if it's text-based
const normalizeStageId = (value: string) => {
  const str = String(value || '').trim();
  // If it's a numeric ID (like "1", "2"), keep as-is
  if (/^\d+$/.test(str)) return str;
  // Otherwise lowercase and replace spaces with dashes
  return str.toLowerCase().replace(/\s+/g, '-');
};

const toDisplayTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

export default function TaskDetailPage({ projectPublicId, taskId, packageId = null, onClose }: TaskDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [projectRole, setProjectRole] = useState<ProjectRole>('member');
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>(fallbackStages);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renamingAttachmentIdx, setRenamingAttachmentIdx] = useState<number | null>(null);
  const [attachmentRenameValue, setAttachmentRenameValue] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [linkedCR, setLinkedCR] = useState<{ id: string; title: string } | null>(null);
  const [crList, setCrList] = useState<{ publicId: string; crId: string; title: string }[]>([]);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);

  // Get current userId from localStorage
  const getCurrentUserId = () => {
    try {
      const u = localStorage.getItem('orbit_user');
      if (u) return JSON.parse(u).id;
    } catch { /* ignore */ }
    return '';
  };

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [detailRes, commentsRes, projectsRes, workflowRes] = await Promise.all([
          apiFetch('/api/tasks/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: projectPublicId, packageId, taskId }),
          }),
          apiFetch('/api/tasks/comments/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectId: projectPublicId, packageId, taskId }),
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
              assigneeId: String(t.assigneeId || ''),
              assigneeIds: Array.isArray(t.assigneeIds) ? t.assigneeIds : [],
              assigneeName: t.assigneeName || '',
              assigneeNames: Array.isArray(t.assigneeNames) ? t.assigneeNames : [],
              reviewerIds: Array.isArray(t.reviewerIds) ? t.reviewerIds : [],
              reviewerNames: Array.isArray(t.reviewerNames) ? t.reviewerNames : [],
              dueDate: t.dueDate || '',
              tags: Array.isArray(t.tags) ? t.tags : [],
              linkedUrl: t.linkedUrl || '',
              attachments: Array.isArray(t.attachments) ? t.attachments : [],
            });
            if (!cancelled) {
              setAttachments(Array.isArray(t.attachments) ? t.attachments : []);
            }
            // Load linked CR info if this task is linked to a CR
            if (t.linkedUrl?.startsWith('cr:') && !cancelled) {
              const crId = t.linkedUrl.replace('cr:', '');
              const crRes = await apiFetch('/api/change-requests/detail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ crId }),
              });
              if (crRes.ok && !cancelled) {
                const crPayload = await crRes.json();
                const crData = crPayload?.data;
                if (crData) {
                  setLinkedCR({ id: crData.publicId || crId, title: crData.title || crData.crId || 'Change Request' });
                }
              }
            }
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
                authorId: String(c.authorId || c.author?._id || ''),
                author: String(c.authorName || c.author?.fullName || 'Unknown'),
                content: String(c.content || ''),
                createdAt: String(c.createdAt || ''),
                updatedAt: c.updatedAt ? String(c.updatedAt) : undefined,
                isEdited: Boolean(c.isEdited),
                avatar: c.avatar || c.author?.avatar || '',
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

        // Load CR list for linking
        const crListRes = await apiFetch(`/api/projects/${projectPublicId}/change-requests`);
        if (crListRes.ok && !cancelled) {
          const crPayload = await crListRes.json();
          const list = Array.isArray(crPayload?.data) ? crPayload.data : [];
          setCrList(list.map((cr: any) => ({ publicId: cr.publicId, crId: cr.crId, title: cr.title || cr.crId || cr.publicId })));
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
  }, [projectPublicId, packageId, taskId]);

  const dueDateLabel = useMemo(() => {
    if (!task?.dueDate) return 'No due date';
    const d = new Date(task.dueDate);
    if (Number.isNaN(d.getTime())) return task.dueDate;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [task?.dueDate]);

  const canReviewAndMoveStage = useMemo(() => {
    if (!task) return false;
    const allIds = [
      task.assigneeId,
      ...(task.assigneeIds || []),
      ...(task.reviewerIds || []),
    ].filter(Boolean);
    return projectRole === 'owner'
      || projectRole === 'admin'
      || projectRole === 'manager'
      || (projectRole === 'member' && allIds.includes(currentUserId));
  }, [currentUserId, projectRole, task]);

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
        body: JSON.stringify({ projectId: projectPublicId, packageId, taskId, content }),
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
          authorId: String(c?.authorId || currentUserId || ''),
          author: String(c?.authorName || c?.author?.fullName || 'You'),
          content: String(c?.content || content),
          createdAt: String(c?.createdAt || new Date().toISOString()),
          avatar: c?.avatar || '',
        },
        ...prev,
      ]);
      setCommentInput('');
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to post comment');
    }
  };

  const startEdit = (comment: CommentItem) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent('');
  };

  const saveEdit = async (commentId: string) => {
    if (!editingContent.trim()) return;
    try {
      const res = await apiFetch('/api/tasks/comments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ commentId, content: editingContent.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, content: data.data.content, isEdited: true, updatedAt: data.data.updatedAt } : c
        ));
        cancelEdit();
      } else {
        toast.error(data.message || 'Failed to update comment');
      }
    } catch {
      toast.error('Failed to update comment');
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const res = await apiFetch('/api/tasks/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast.success('Comment deleted');
      } else {
        toast.error(data.message || 'Failed to delete comment');
      }
    } catch {
      toast.error('Failed to delete comment');
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
          packageId,
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

  const linkToCR = async (crPublicId: string) => {
    try {
      const res = await apiFetch('/api/change-requests/link-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ crId: crPublicId, taskId }),
      });
      const data = await res.json();
      if (data.success) {
        setTask(prev => prev ? { ...prev, linkedUrl: `cr:${crPublicId}` } : prev);
        const cr = crList.find(c => c.publicId === crPublicId);
        setLinkedCR({ id: crPublicId, title: cr?.title || crPublicId });
        setShowLinkDropdown(false);
        toast.success('Linked to Change Request');
      } else {
        toast.error(data.message || 'Failed to link task');
      }
    } catch {
      toast.error('Failed to link task');
    }
  };

  const unlinkFromCR = async () => {
    if (!linkedCR) return;
    try {
      const res = await apiFetch('/api/change-requests/unlink-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ crId: linkedCR.id, taskId }),
      });
      const data = await res.json();
      if (data.success) {
        setTask(prev => prev ? { ...prev, linkedUrl: '' } : prev);
        setLinkedCR(null);
        toast.success('Unlinked from Change Request');
      } else {
        toast.error(data.message || 'Failed to unlink task');
      }
    } catch {
      toast.error('Failed to unlink task');
    }
  };

  const handleAttachmentUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingAttachment(true);
    try {
      const form = new FormData();
      form.append('taskId', taskId);
      Array.from(fileList).forEach(f => form.append('attachments', f));
      const res = await apiFetch('/api/tasks/upload-attachments', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success && data.data?.attachments) {
        setAttachments(prev => [...prev, ...data.data.attachments]);
        toast.success(`${data.data.attachments.length} file(s) uploaded`);
      } else {
        toast.error(data.message || 'Failed to upload files');
      }
    } catch {
      toast.error('Failed to upload files');
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (index: number) => {
    try {
      const res = await apiFetch('/api/tasks/delete-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, attachmentIndex: index }),
      });
      const data = await res.json();
      if (data.success) {
        setAttachments(prev => prev.filter((_, i) => i !== index));
        toast.success('Attachment deleted');
      } else {
        toast.error(data.message || 'Failed to delete attachment');
      }
    } catch {
      toast.error('Failed to delete attachment');
    }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-foreground">{task.title}</h2>
              <span className={cn('shrink-0 rounded-md border-0 px-2.5 py-1 text-xs font-medium', priorityColor[task.priority])}>
                {task.priority}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{task.description || 'No description.'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB] hover:text-[#364153] transition-colors"
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
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
            <p className="text-[11px] text-muted-foreground">Assignees</p>
            {(task.assigneeNames && task.assigneeNames.length > 0) ? (
              <p className="text-sm font-medium">{task.assigneeNames.join(', ')}</p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Unassigned</p>
            )}
          </div>
        </div>

        {(task.reviewerNames && task.reviewerNames.length > 0) && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Reviewers</p>
              <p className="text-sm font-medium">{task.reviewerNames.join(', ')}</p>
            </div>
          </div>
        )}

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
        <p className="text-xs text-muted-foreground">Only owner/admin/manager or the assigned member can review and move stage.</p>
      )}

      <div className="h-px bg-border" />

      {/* Change Request Link Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Change Request
          </p>
          {linkedCR && (
            <button
              onClick={unlinkFromCR}
              className="text-[11px] text-[#6A7282] hover:text-[#DC2626] transition-colors"
            >
              Unlink
            </button>
          )}
        </div>

        {linkedCR ? (
          <a
            href={`/projects/${projectPublicId}?tab=changes&crId=${linkedCR.id}`}
            className="flex items-center gap-2 rounded-[8px] border border-[#155DFC] bg-[#EEF2FF] px-3 py-2 hover:bg-[#E0E7FF] transition-colors"
          >
            <svg className="h-4 w-4 shrink-0 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-[#155DFC] truncate">{linkedCR.title}</span>
          </a>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowLinkDropdown(!showLinkDropdown)}
              className="flex items-center gap-2 rounded-[8px] border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-3 py-2 w-full text-sm text-[#6A7282] hover:border-[#155DFC] hover:text-[#155DFC] transition-colors"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Link to Change Request
            </button>
            {showLinkDropdown && crList.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-[8px] border border-[#E5E7EB] bg-white shadow-lg max-h-[200px] overflow-y-auto">
                {crList.map(cr => (
                  <button
                    key={cr.publicId}
                    onClick={() => linkToCR(cr.publicId)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F3F4F6] transition-colors border-b border-[#F3F4F6] last:border-0"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate text-[#101828]">{cr.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-[#6A7282]">{cr.crId}</span>
                  </button>
                ))}
              </div>
            )}
            {showLinkDropdown && crList.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-[8px] border border-[#E5E7EB] bg-white shadow-lg px-3 py-2 text-sm text-[#6A7282] text-center">
                No change requests available
              </div>
            )}
          </div>
        )}
      </div>

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

      {task.linkedUrl && !task.linkedUrl.startsWith('cr:') && (
        <a href={task.linkedUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm text-[#155DFC] hover:underline">
          Linked Drawing / Model
        </a>
      )}

      {/* Attachments Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
            <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z"/>
            <path d="M9.33333 1.33333V5.33333H13.3333"/>
          </svg>
          <h3 className="text-sm font-semibold">Attachments</h3>
          {attachments.length > 0 && (
            <span className="ml-auto inline-flex h-5 items-center rounded-full bg-muted px-2 text-[10px] font-medium text-muted-foreground">{attachments.length}</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".ifc,.rvt,.dwg,.dxf,.nwd,.nwf,.nwc,.skp,.fbx,.obj,.3ds,.step,.stp,.pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={e => { void handleAttachmentUpload(e.target.files); }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAttachment}
            className="ml-auto flex items-center gap-1 rounded-md border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-2.5 py-1 text-xs text-[#6A7282] hover:border-[#155DFC] hover:text-[#155DFC] transition-colors disabled:opacity-50"
          >
            {uploadingAttachment ? (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
            )}
            Add file
          </button>
        </div>

        {attachments.length > 0 ? (
          <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6]">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-[#6A7282]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
                  <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z"/>
                  <path d="M9.33333 1.33333V5.33333H13.3333"/>
                </svg>
                <div className="min-w-0 flex-1">
                  {renamingAttachmentIdx === i ? (
                    <input
                      autoFocus
                      type="text"
                      value={attachmentRenameValue}
                      onChange={e => setAttachmentRenameValue(e.target.value)}
                      onBlur={() => setRenamingAttachmentIdx(null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') setRenamingAttachmentIdx(null);
                        if (e.key === 'Escape') setRenamingAttachmentIdx(null);
                      }}
                      className="w-full text-[14px] text-[#101828] border border-[#155DFC] rounded px-1 py-0.5 outline-none bg-white"
                    />
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[14px] text-[#101828] hover:text-[#155DFC] truncate block cursor-pointer"
                      title="Double-click to rename"
                      onDoubleClick={() => {
                        setRenamingAttachmentIdx(i);
                        setAttachmentRenameValue(att.name);
                      }}
                    >
                      {att.name}
                    </a>
                  )}
                  <p className="text-[11px] text-[#6A7282]">{fmtSize(att.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteAttachment(i)}
                  className="shrink-0 p-1 text-[#99A1AF] hover:text-[#DC2626] transition-colors rounded"
                  title="Remove attachment"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#9CA3AF]">No attachments.</p>
        )}
      </div>

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
              <div key={comment.id} className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-muted/30 group">
                {comment.avatar ? (
                  <img
                    src={comment.avatar}
                    alt={comment.author}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full object-cover text-xs font-semibold text-white"
                  />
                ) : (
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
                )}
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
                    {comment.isEdited && <span className="text-[11px] text-muted-foreground/60 italic">(Edited)</span>}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-[#155DFC] focus:outline-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(comment.id)}
                          className="px-3 py-1 text-xs font-medium bg-[#155DFC] text-white rounded-lg hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{comment.content}</p>
                  )}
                  {(currentUserId === comment.authorId) && !editingCommentId && (
                    <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {currentUserId === comment.authorId && (
                        <button
                          onClick={() => startEdit(comment)}
                          className="text-[11px] text-muted-foreground hover:text-[#155DFC]"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => setPendingDeleteCommentId(comment.id)}
                        className="text-[11px] text-muted-foreground hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!pendingDeleteCommentId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteCommentId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Do you want to delete this comment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteCommentId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (!pendingDeleteCommentId) return;
                void deleteComment(pendingDeleteCommentId);
                setPendingDeleteCommentId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
