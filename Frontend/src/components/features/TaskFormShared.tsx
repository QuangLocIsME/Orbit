/**
 * Shared form components used by both CreateTaskModal and ChangesTab.
 * Contains: FileIcon, Avatar, MemberPicker, AttachPicker, AffectedModelsPicker, CommentSection.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { prefetchApiCache, listenToSwMessages } from '@/lib/sw-utils';
import { Loader2, Send, MessageSquare, ChevronDown } from 'lucide-react';
import { getProjectTabCache, mergeProjectTabCache } from '@/stores/projectDetailCacheStore';

// ─── Constants & Helpers ───────────────────────────────────────────────────────

export const MAX_ATTACH_SIZE = 50 * 1024 * 1024; // 50 MB

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── FileIcon ─────────────────────────────────────────────────────────────────

export function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
      <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z"/>
      <path d="M9.33333 1.33333V5.33333H13.3333"/>
    </svg>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  name?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
  avatarSrc?: string | null;
  avatarUrl?: string | null;
}

export function Avatar({ name, color = '#6366f1', size = 'xs', avatarSrc, avatarUrl }: AvatarProps) {
  const imageUrl = avatarSrc || avatarUrl;
  const initials = (name || '')
    .split(' ')
    .map(w => w?.[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  const sizes = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-7 w-7 text-[11px]',
  };
  const sizeClass = sizes[size];
  return imageUrl ? (
    <img
      src={imageUrl}
      alt={name || initials}
      title={name}
      className={cn('rounded-full object-cover shrink-0', sizeClass)}
    />
  ) : (
    <span
      title={name}
      className={cn('inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0', sizeClass)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

// ─── MemberPicker ─────────────────────────────────────────────────────────────

interface MemberOption {
  publicId: string;
  userId: string;
  role?: string;
  user?: { fullName?: string; email?: string; name?: string; avatar?: string | null } | null;
  avatarUrl?: string | null;
}

interface MemberPickerProps {
  label: string;
  members?: MemberOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Which field to use as the selection value and for comparison. Defaults to 'publicId'. */
  valueKey?: 'publicId' | 'userId';
}

export function MemberPicker({ label, members = [], selected, onChange, valueKey = 'publicId' }: MemberPickerProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const getValue = (m: MemberOption) => valueKey === 'userId' ? m.userId : m.publicId;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-medium text-[#101828]">{label}</label>
      {!members || members.length === 0 ? (
        <p className="text-[13px] text-[#6A7282]">No team members available.</p>
      ) : (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-left text-[14px] text-[#101828] hover:bg-gray-50 transition-colors flex items-center justify-between"
          >
            <span className="truncate">
              {selected.length > 0 ? `${selected.length} selected` : `Select ${label.toLowerCase()}...`}
            </span>
            <svg className={cn('h-4 w-4 text-[#6A7282] transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-full rounded-[10px] border border-[#E5E7EB] bg-white shadow-lg divide-y divide-[#F3F4F6] max-h-[220px] overflow-y-auto">
              {members.map(m => {
                const val = getValue(m);
                const checked = selected.includes(val);
                const memberName = m.user?.fullName || m.user?.name || m.user?.email || 'Unknown';
                return (
                  <label key={val} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(val)}
                      className="h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]"
                    />
                    <Avatar name={memberName} size="sm" avatarSrc={m.user?.avatar} avatarUrl={m.avatarUrl} />
                    <div className="min-w-0">
                      <p className="text-[14px] text-[#101828] truncate">{memberName}</p>
                      <p className="text-[11px] text-[#6A7282] truncate">{m.role || ''}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(val => {
            const m = members.find(x => getValue(x) === val);
            const memberName = m?.user?.fullName || m?.user?.name || 'Unknown';
            return m ? (
                  <span key={val} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-1 pr-2 py-0.5 text-[11px] text-[#1D4ED8]">
                <Avatar name={memberName} color="#3B82F6" size="xs" avatarSrc={m?.user?.avatar} avatarUrl={m?.avatarUrl} />
                {memberName}
                <button type="button" onClick={() => toggle(val)} className="ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold">x</button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ─── AffectedModelsPicker ─────────────────────────────────────────────────────

interface ModelFileOption {
  id: string;
  name: string;
  folderPath?: string;
}

interface AffectedModelsPickerProps {
  modelFiles?: ModelFileOption[];
  loadingFiles?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function AffectedModelsPicker({
  modelFiles = [],
  loadingFiles = false,
  selected,
  onChange,
}: AffectedModelsPickerProps) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-medium text-[#101828]">Affected Models</label>
      {loadingFiles ? (
        <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">Loading model files...</div>
      ) : modelFiles.length === 0 ? (
        <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">
          No model files found. Upload IFC/RVT/DWG files in the <strong>Documents</strong> tab.
        </div>
      ) : (
        <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto">
          {modelFiles.map(f => (
            <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]">
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                onChange={() => toggle(f.id)}
                className="h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]"
              />
              <FileIcon className="shrink-0 text-[#6A7282]" />
              <div className="min-w-0">
                <p className="text-[14px] text-[#101828] truncate">{f.name}</p>
                {f.folderPath && <p className="text-[11px] text-[#6A7282] truncate">{f.folderPath}</p>}
              </div>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const f = modelFiles.find(m => m.id === id);
            return f ? (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[11px] text-[#1D4ED8]">
                {f.name}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold">x</button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ─── CommentSection ─────────────────────────────────────────────────────────────

export interface CommentItem {
  id: string;
  authorId: string;
  authorName: string;
  avatar?: string | null;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
}

function fmtCommentTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

function nameToColor(name: string) {
  const PALETTE = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface CommentSectionProps {
  type: 'task' | 'change-request' | 'approval';
  targetId: string;
  projectId: string;
  currentUserId: string;
  currentRole?: string;
  onCommentsChange?: (comments: CommentItem[]) => void;
  /** Override moderation check. If not provided, uses (currentUserId === authorId || currentRole === 'admin'). */
  canModerate?: boolean;
  /** Style variant. 'panel' uses UploadCard/Approval style; 'detail' uses TaskDetailPage/ChangesTab style. */
  variant?: 'panel' | 'detail';
  /** Only used when variant='panel' to control the top border separator. */
  borderTop?: boolean;
}

export function CommentSection({
  type,
  targetId,
  projectId,
  currentUserId,
  currentRole,
  onCommentsChange,
  canModerate,
  variant = 'detail',
  borderTop = true,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onCommentsChangeRef = useRef(onCommentsChange);
  const animatedCommentIdsRef = useRef<Set<string>>(new Set());
  const commentCacheProjectId = projectId || targetId;
  const commentCacheScope = type === 'approval' ? 'versions' : type === 'change-request' ? 'changes' : 'tasks';
  const commentCacheKey = `comments:${type}:${targetId}`;

  useEffect(() => {
    onCommentsChangeRef.current = onCommentsChange;
  }, [onCommentsChange]);

  useEffect(() => {
    onCommentsChangeRef.current?.(comments);
  }, [comments]);

  useEffect(() => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    const minHeight = variant === 'panel' ? 44 : 72;
    const maxHeight = variant === 'panel' ? 120 : 160;
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
  }, [commentInput, variant]);

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const checkModerate = (authorId: string) => {
    if (canModerate !== undefined) return canModerate;
    return currentUserId === authorId || currentRole === 'admin';
  };

  // ── Load comments ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const cached = getProjectTabCache<Record<string, CommentItem[]>>(commentCacheProjectId, commentCacheScope);
    const cachedComments = cached?.data?.[commentCacheKey];
    if (cachedComments) {
      setComments(cachedComments);
      setLoading(false);
    } else {
      setLoading(true);
    }
    (async () => {
      try {
        const endpoint = type === 'task'
          ? '/api/tasks/comments/list'
          : type === 'change-request'
          ? '/api/change-requests/comments/list'
          : '/api/approvals/comments/list';
        const body = type === 'task'
          ? JSON.stringify({ taskId: targetId, projectId })
          : type === 'change-request'
          ? JSON.stringify({ crId: targetId, projectId })
          : JSON.stringify({ approvalId: targetId });

        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (res.ok && !cancelled) {
          const d = await res.json();
          let list: CommentItem[] = [];
          if (type === 'approval') {
            list = (Array.isArray(d?.data?.comments) ? d.data.comments : []).map((c: any) => ({
              id: String(c.publicId || c.id || Math.random()),
              authorId: String(c.author?.publicId || c.author?.id || c.authorId || ''),
              authorName: String(c.author?.name || c.authorName || 'Unknown'),
              avatar: c.author?.avatar || c.avatar || null,
              content: String(c.content || ''),
              createdAt: String(c.createdAt || ''),
              updatedAt: c.updatedAt ? String(c.updatedAt) : undefined,
              isEdited: Boolean(c.isEdited),
            }));
          } else {
            list = (Array.isArray(d?.data) ? d.data : []).map((c: any) => ({
              id: String(c.publicId || c.id || Math.random()),
              authorId: String(c.authorId || c.author?._id || ''),
              authorName: String(c.authorName || c.author?.fullName || c.author?.name || 'Unknown'),
              avatar: c.avatar || c.author?.avatar || null,
              content: String(c.content || ''),
              createdAt: String(c.createdAt || ''),
              updatedAt: c.updatedAt ? String(c.updatedAt) : undefined,
              isEdited: Boolean(c.isEdited),
            }));
          }
          setComments(list);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [commentCacheKey, commentCacheProjectId, commentCacheScope, targetId, projectId, type]);

  useEffect(() => {
    mergeProjectTabCache(commentCacheProjectId, commentCacheScope, {
      [commentCacheKey]: comments,
    });
  }, [commentCacheKey, commentCacheProjectId, commentCacheScope, comments]);

  // ── Listen for targeted SW refresh — only update our own comment list ──
  // ChangesTab dispatches a targeted event so we can patch in new comments
  // without re-fetching the entire CR list or re-rendering the parent.
  useEffect(() => {
    const endpoint = getEndpoint();

    // SW REFRESH_RESPONSE: patch in fresh data for our endpoint
    const cleanupSw = listenToSwMessages((msg) => {
      if (msg.type !== 'REFRESH_RESPONSE') return;
      const { route, data } = msg.payload as { route?: string; data?: unknown };
      if (!route || !route.includes(endpoint)) return;

      const raw = (data as any)?.data ?? (Array.isArray(data) ? data : null);
      if (!Array.isArray(raw)) return;

      const incoming: CommentItem[] = raw.map((c: any) => ({
        id: String(c.publicId || c.id || Math.random()),
        authorId: String(c.author?.publicId || c.author?.id || c.authorId || c.author?._id || ''),
        authorName: String(c.authorName || c.author?.fullName || c.author?.name || 'Unknown'),
        avatar: c.avatar || c.author?.avatar || null,
        content: String(c.content || ''),
        createdAt: String(c.createdAt || ''),
        updatedAt: c.updatedAt ? String(c.updatedAt) : undefined,
        isEdited: Boolean(c.isEdited),
      }));

      setComments(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newOnes = incoming.filter(c => !existingIds.has(c.id));
        if (newOnes.length === 0) return prev;
        newOnes.forEach((comment) => animatedCommentIdsRef.current.add(comment.id));
        return [...newOnes, ...prev];
      });
    });

    // Targeted custom event dispatched by ChangesTab / UploadApprovalPanel
    const eventName = `orbit:comments:${endpoint}`;
    const onTargetedRefresh = (e: Event) => {
      const incoming = (e as CustomEvent).detail as CommentItem[] | undefined;
      if (!Array.isArray(incoming)) return;
      setComments(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newOnes = incoming.filter(c => !existingIds.has(c.id));
        if (newOnes.length === 0) return prev;
        newOnes.forEach((comment) => animatedCommentIdsRef.current.add(comment.id));
        return [...newOnes, ...prev];
      });
    };
    window.addEventListener(eventName, onTargetedRefresh);

    return () => {
      cleanupSw();
      window.removeEventListener(eventName, onTargetedRefresh);
    };
  }, [targetId, projectId, type]);

  // ── Post comment ───────────────────────────────────────────────────────────
  const submitComment = async () => {
    const content = commentInput.trim();
    if (!content) return;
    setPosting(true);
    try {
      const endpoint = type === 'task'
        ? '/api/tasks/comments/create'
        : type === 'change-request'
        ? '/api/change-requests/comments/create'
        : '/api/approvals/comments/add';
      const body = type === 'task'
        ? JSON.stringify({ taskId: targetId, projectId, content })
        : type === 'change-request'
        ? JSON.stringify({ crId: targetId, projectId, content })
        : JSON.stringify({ approvalId: targetId, content });

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const d = await res.json();
        if (d.success) {
        let raw: any;
        if (type === 'approval') {
          raw = d.data?.comment;
        } else {
          raw = d.data;
        }
        const newComment: CommentItem = {
          id: String(raw?.publicId || raw?.id || Math.random()),
          authorId: String(raw?.authorId || raw?.author?.id || raw?.author?.publicId || currentUserId),
          authorName: String(raw?.authorName || raw?.author?.fullName || raw?.author?.name || 'You'),
          avatar: raw?.avatar || raw?.author?.avatar || null,
          content: String(raw?.content || content),
          createdAt: String(raw?.createdAt || new Date().toISOString()),
          updatedAt: raw?.updatedAt ? String(raw?.updatedAt) : undefined,
          isEdited: false,
        };
        setComments(prev => {
          const next = [newComment, ...prev];
          return next;
        });
        setCommentInput('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else {
        toast.error(d.message || 'Failed to post comment');
      }
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  // ── Edit comment ───────────────────────────────────────────────────────────
  const startEdit = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const saveEdit = async (commentId: string) => {
    if (type === 'approval') return;
    const content = editingContent.trim();
    if (!content) return;
    try {
      const endpoint = type === 'task' ? '/api/tasks/comments' : '/api/change-requests/comments';
      const res = await apiFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content }),
      });
      const d = await res.json();
      if (d.success) {
        setComments(prev => {
          const next = prev.map(c =>
            c.id === commentId
              ? { ...c, content: d.data.content || content, isEdited: true, updatedAt: d.data.updatedAt || new Date().toISOString() }
              : c
          );
          return next;
        });
        cancelEdit();
      } else {
        toast.error(d.message || 'Failed to update comment');
      }
    } catch {
      toast.error('Failed to update comment');
    }
  };

  // ── Delete comment ────────────────────────────────────────────────────────
  const deleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      let endpoint: string;
      let method = 'DELETE';
      let bodyObj: Record<string, string> = { commentId };

      if (type === 'task') {
        endpoint = '/api/tasks/comments';
      } else if (type === 'change-request') {
        endpoint = '/api/change-requests/comments';
      } else {
        endpoint = '/api/approvals/comments/delete';
        method = 'POST';
        bodyObj = { commentId };
      }

      const res = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });
      const d = await res.json();
      if (d.success) {
        setComments(prev => {
          const next = prev.filter(c => c.id !== commentId);
          return next;
        });
      } else {
        toast.error(d.message || 'Failed to delete comment');
      }
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const isPanel = variant === 'panel';

  const inputRow = (
    <div className={cn('flex gap-2 items-end', isPanel ? 'mt-3' : 'rounded-xl border border-[#E5E7EB] bg-white')}>
      <textarea
        ref={textareaRef}
        placeholder="Write a comment…"
        value={commentInput}
        onChange={autoResize}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submitComment();
          }
        }}
        rows={isPanel ? 1 : 3}
        className={cn(
          'resize-none focus:outline-none focus:ring-0',
          isPanel
            ? 'w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] min-h-[44px] max-h-[120px]'
            : 'w-full rounded-t-xl bg-[#F9FAFB] px-4 py-3 text-sm text-[#101828] placeholder:text-[#9CA3AF] min-h-[72px]'
        )}
        style={{ overflowY: 'auto' }}
      />
      {!isPanel && (
        <div className="flex items-center border-t border-[#E5E7EB] px-3 py-2 shrink-0">
          <span className="text-[11px] text-[#9CA3AF]">Ctrl + Enter to post</span>
        </div>
      )}
      <button
        onClick={submitComment}
        disabled={!commentInput.trim() || posting}
        className={cn(
          'shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed',
          isPanel
            ? 'flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#155DFC] text-white hover:bg-[#0F4FD8] active:scale-95'
            : 'flex items-center gap-1.5 rounded-lg bg-[#155DFC] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0F4FD8] active:scale-95 mr-2'
        )}
      >
        {posting ? (
          <svg className={cn(isPanel ? 'h-4 w-4' : 'h-3 w-3 animate-spin')} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        ) : isPanel ? (
          <Send className="h-4 w-4" />
        ) : (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
        )}
        {!isPanel && (posting ? 'Posting…' : 'Post')}
      </button>
    </div>
  );

  const getEndpoint = () => {
    if (type === 'task') return '/api/tasks/comments/list';
    if (type === 'change-request') return '/api/change-requests/comments/list';
    return '/api/approvals/comments/list';
  };

  const getBody = () => {
    if (type === 'task') return JSON.stringify({ taskId: targetId, projectId });
    if (type === 'change-request') return JSON.stringify({ crId: targetId, projectId });
    return JSON.stringify({ approvalId: targetId });
  };

  // ── Prefetch via SW on mount ───────────────────────────────────────────────
  // Try to get cached data first, then fetch fresh in background.
  // If SW has cache the UI updates from the message listener with no spinner.
  useEffect(() => {
    const endpoint = getEndpoint();
    prefetchApiCache([endpoint]);
  }, [targetId, projectId, type]);

  return (
    <motion.div
      layout={!isPanel}
      className={cn(isPanel && borderTop && 'pt-3 border-t border-[#E5E7EB]', !isPanel && 'border-t border-[#E5E7EB] pt-5')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isPanel ? (
            <MessageSquare className="h-3.5 w-3.5 text-[#6A7282]" />
          ) : (
            <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
            </svg>
          )}
          <span className={cn(isPanel ? 'text-[12px] font-medium text-[#6A7282]' : 'text-sm font-semibold text-[#101828]')}>
            {isPanel
              ? (comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Add comment')
              : 'Comments'}
          </span>
        </div>
        {loading && (
          <svg className="h-3.5 w-3.5 animate-spin text-[#9CA3AF]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {!loading && comments.length > 0 && !isPanel && (
          <span className="ml-auto inline-flex h-5 items-center rounded-full bg-[#F3F4F6] px-2 text-[10px] font-medium text-[#6A7282]">
            {comments.length}
          </span>
        )}
      </div>

      {/* Input */}
      {isPanel ? inputRow : (
        <div>
          {inputRow}
        </div>
      )}

      {/* Comment List */}
      {!loading && comments.length === 0 ? (
        <motion.div
          key="empty-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8 text-center"
        >
          <div className={cn('flex items-center justify-center rounded-full', isPanel ? 'h-10 w-10 bg-[#F3F4F6]' : 'h-10 w-10 bg-[#F3F4F6]')}>
            <svg className={cn('text-[#9CA3AF]', isPanel ? 'h-5 w-5' : 'h-5 w-5')} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
            </svg>
          </div>
          <p className={cn('mt-2', isPanel ? 'text-[12px] text-[#9CA3AF]' : 'text-[13px] text-[#9CA3AF]')}>
            No comments yet. Be the first to comment.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="comment-list"
          layout={!isPanel}
          className={cn(
            'space-y-0',
            isPanel
              ? 'mt-3 max-h-[240px] overflow-y-auto overscroll-contain pr-1'
              : 'pt-3'
          )}
        >
          <AnimatePresence initial={false}>
            {comments.map(c => {
              const canMod = checkModerate(c.authorId);
              const shouldAnimateEntry = animatedCommentIdsRef.current.has(c.id);
              return (
                <motion.div
                  key={c.id}
                  layout={!isPanel}
                  initial={shouldAnimateEntry ? { opacity: 0, y: -8 } : false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  onAnimationComplete={() => {
                    if (shouldAnimateEntry) {
                      animatedCommentIdsRef.current.delete(c.id);
                    }
                  }}
                  className={cn(
                    'group relative',
                    !isPanel && 'rounded-xl p-3 hover:bg-[#F9FAFB] transition-colors mb-2'
                  )}
                >
                  <div className={cn('flex', isPanel ? 'gap-2.5' : 'gap-3')}>
                    {/* Avatar */}
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        alt={c.authorName}
                        className={cn(
                          'rounded-full object-cover shrink-0 ring-1 ring-[#E5E7EB]',
                          isPanel ? 'h-7 w-7 mt-0.5' : 'h-8 w-8 mt-0.5'
                        )}
                      />
                    ) : (
                      <div
                        className={cn(
                          'flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white',
                          isPanel ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs'
                        )}
                        style={{ backgroundColor: nameToColor(c.authorName) }}
                      >
                        {c.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Content */}
                    <div className={cn('flex-1 min-w-0', isPanel ? '' : '')}>
                      {/* Name + Time Row */}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={cn(
                          'font-semibold leading-none',
                          isPanel ? 'text-[13px] text-[#101828]' : 'text-[13px] text-[#101828]'
                        )}>
                          {c.authorName}
                        </span>
                        <span className={cn('text-[11px] leading-none', isPanel ? 'text-[#9CA3AF]' : 'text-[#9CA3AF]')}>
                          {fmtCommentTime(c.createdAt)}
                        </span>
                        {c.isEdited && (
                          <span className={cn('text-[11px] leading-none italic', isPanel ? 'text-[#9CA3AF]' : 'text-[#9CA3AF]')}>
                            (edited)
                          </span>
                        )}
                      </div>

                      {/* Comment Text */}
                      {editingId === c.id ? (
                        <div className={cn('space-y-2', isPanel ? '' : '')}>
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className={cn(
                              'w-full resize-none rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]',
                              isPanel ? '' : 'text-sm'
                            )}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(c.id)}
                              className="px-3 py-1 text-[12px] font-medium rounded-md bg-[#155DFC] text-white hover:bg-[#0F4FD8] transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 text-[12px] font-medium rounded-md text-[#6A7282] hover:text-[#101828] hover:bg-[#F3F4F6] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={cn(
                            'whitespace-pre-wrap break-words leading-relaxed',
                            isPanel ? 'text-[13px] text-[#4A5565]' : 'text-[13px] text-[#374151]'
                          )}>
                            {c.content}
                          </p>

                          {/* Actions */}
                          {canMod && (
                            <div className={cn(
                              'flex items-center gap-3 mt-1',
                              isPanel
                                ? ''
                                : 'opacity-0 group-hover:opacity-100 transition-opacity'
                            )}>
                              {currentUserId === c.authorId && (
                                <button
                                  onClick={() => startEdit(c)}
                                  className={cn(
                                    'text-[11px] font-medium transition-colors',
                                    isPanel
                                      ? 'text-[#9CA3AF] hover:text-[#155DFC]'
                                      : 'text-[#9CA3AF] hover:text-[#155DFC]'
                                  )}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => deleteComment(c.id)}
                                className={cn(
                                  'text-[11px] font-medium transition-colors',
                                  isPanel
                                    ? 'text-[#9CA3AF] hover:text-red-500'
                                    : 'text-[#9CA3AF] hover:text-red-500'
                                )}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── AttachPicker ─────────────────────────────────────────────────────────────

export interface TaskAttachment {
  name: string;
  size: number;
  url: string;
  mimeType?: string;
}

interface AttachFileEntry {
  file: File;
  displayName: string;
}

interface AttachPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  existingAttachments?: TaskAttachment[];
  onRemoveExisting?: (index: number) => void;
}

export function AttachPicker({ files, onChange, existingAttachments = [], onRemoveExisting }: AttachPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const existingRenameInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const [entries, setEntries] = useState<AttachFileEntry[]>([]);

  useEffect(() => {
    setEntries(files.map(f => ({ file: f, displayName: f.name })));
  }, [files]);

  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renamingType, setRenamingType] = useState<'new' | 'existing' | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [existingDisplayNames, setExistingDisplayNames] = useState<Record<number, string>>({});

  const startRename = (type: 'new' | 'existing', idx: number) => {
    setRenamingType(type);
    setRenamingIdx(idx);
    const currentName = type === 'existing'
      ? (existingDisplayNames[idx] ?? existingAttachments[idx]?.name ?? '')
      : (entries[idx]?.displayName ?? '');
    setRenameValue(currentName);
    setTimeout(() => {
      if (type === 'existing') {
        existingRenameInputRef.current?.select();
      } else {
        renameInputRef.current?.select();
      }
    }, 0);
  };

  const commitRename = () => {
    if (renamingIdx === null) return;
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingIdx(null); setRenamingType(null); return; }
    if (renamingType === 'existing') {
      setExistingDisplayNames(prev => ({ ...prev, [renamingIdx]: trimmed }));
    } else {
      setEntries(prev => prev.map((e, i) => i === renamingIdx ? { ...e, displayName: trimmed } : e));
    }
    setRenamingIdx(null);
    setRenamingType(null);
  };

  const cancelRename = () => {
    setRenamingIdx(null);
    setRenamingType(null);
  };

  const add = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid: File[] = [];
    Array.from(incoming).forEach(f => {
      if (f.size > MAX_ATTACH_SIZE) {
        toast.error(`"${f.name}" exceeds 50 MB limit`);
      } else {
        valid.push(f);
      }
    });
    onChange([...files, ...valid]);
  };

  const remove = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  const totalCount = existingAttachments.length + files.length;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-medium text-[#101828]">
        Attachments <span className="font-normal text-[#6A7282]">(max 50 MB each)</span>
      </label>

      {totalCount > 0 && (
        <div className="rounded-[10px] border border-[#E5E7EB] divide-y divide-[#F3F4F6] bg-white">
          {existingAttachments.map((att, i) => {
            const displayName = existingDisplayNames[i] ?? att.name;
            const isRenaming = renamingType === 'existing' && renamingIdx === i;
            return (
              <div key={`existing-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <FileIcon className="shrink-0 text-[#6A7282]" />
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <input
                      ref={existingRenameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') cancelRename();
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
                      onDoubleClick={() => startRename('existing', i)}
                    >
                      {displayName}
                    </a>
                  )}
                  <p className="text-[11px] text-[#6A7282]">{fmtSize(att.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveExisting?.(i)}
                  className="shrink-0 p-1 text-[#99A1AF] hover:text-[#DC2626] transition-colors rounded"
                  title="Remove attachment"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            );
          })}

          {files.map((f, i) => (
            <div key={`new-${i}`} className="flex items-center gap-3 px-4 py-2.5">
              <FileIcon className="shrink-0 text-[#6A7282]" />
              <div className="min-w-0 flex-1">
                {renamingIdx === i ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    className="w-full text-[14px] text-[#101828] border border-[#155DFC] rounded px-1 py-0.5 outline-none bg-white"
                  />
                ) : (
                  <p
                    className="text-[14px] text-[#101828] truncate cursor-pointer hover:text-[#155DFC]"
                    onDoubleClick={() => startRename('new', i)}
                    title="Double-click to rename"
                  >
                    {entries[i]?.displayName ?? f.name}
                  </p>
                )}
                <p className="text-[11px] text-[#6A7282]">{fmtSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 p-1 text-[#99A1AF] hover:text-[#DC2626] transition-colors rounded"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed py-6 cursor-pointer transition-colors',
          drag ? 'border-[#155DFC] bg-[#EFF6FF]' : 'border-[#D1D5DC] bg-[#F9FAFB] hover:border-[#155DFC] hover:bg-[#F0F6FF]'
        )}
      >
        <svg className="h-8 w-8 text-[#99A1AF]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M21.333 21.333L16 16L10.667 21.333" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 16V28" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M27.187 24.52C28.458 23.787 29.431 22.63 29.936 21.246C30.441 19.862 30.447 18.34 29.953 16.952C29.459 15.564 28.495 14.399 27.229 13.656C25.964 12.913 24.477 12.641 23.04 12.88H21.467C21.029 11.207 20.207 9.66 19.067 8.368C17.927 7.077 16.502 6.078 14.905 5.454C13.309 4.829 11.586 4.598 9.879 4.778C8.172 4.959 6.531 5.546 5.096 6.489C3.66 7.433 2.471 8.707 1.626 10.207C0.78 11.707 0.304 13.39 0.238 15.114C0.172 16.839 0.519 18.555 1.249 20.117C1.979 21.68 3.069 23.043 4.427 24.093" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[14px] text-[#364153]">Drop files here or <span className="text-[#155DFC] font-medium">browse</span></p>
        <p className="text-[12px] text-[#6A7282]">PDF, DWG, RVT, IFC, JPG, PNG — max 50 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { add(e.target.files); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}
