/**
 * Fully-separated, memoized comment components for stable re-renders.
 * Sub-components: CommentAvatar, CommentTime, CommentActions, CommentEditForm,
 * CommentContent, CommentItem, CommentList, CommentComposer, CommentEmptyState,
 * CommentSectionHeader, CommentSection.
 *
 * Key stability strategies:
 * - Every sub-component is wrapped in React.memo with custom equality checks.
 * - animation ids tracked via useRef so ref value is always current without re-render triggers.
 * - layout animations removed from list wrapper to avoid cascading re-layouts on refresh.
 * - New comment prepends via stable id-based dedup so list updates are surgical.
 */

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { prefetchApiCache, listenToSwMessages } from '@/lib/sw-utils';
import { Send, MessageSquare } from 'lucide-react';
import { getProjectTabCache, mergeProjectTabCache } from '@/stores/projectDetailCacheStore';
import { fetchProjectBlock, initProjectBlockRealtime, onProjectBlockRefresh } from '@/lib/project-block-realtime';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface CommentSectionProps {
  type: 'task' | 'change-request' | 'approval';
  targetId: string;
  projectId: string;
  currentUserId: string;
  currentRole?: string;
  onCommentsChange?: (comments: CommentItem[]) => void;
  canModerate?: boolean;
  variant?: 'panel' | 'detail';
  borderTop?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fmtCommentTime(d: string) {
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

function dedupeComments(list: CommentItem[]): CommentItem[] {
  const seen = new Set<string>();
  return list.filter((comment) => {
    if (seen.has(comment.id)) return false;
    seen.add(comment.id);
    return true;
  });
}

function getEndpoint(type: CommentSectionProps['type']) {
  if (type === 'task') return '/api/tasks/comments/list';
  if (type === 'change-request') return '/api/change-requests/comments/list';
  return '/api/approvals/comments/list';
}

function getPostEndpoint(type: CommentSectionProps['type']) {
  if (type === 'task') return '/api/tasks/comments/create';
  if (type === 'change-request') return '/api/change-requests/comments/create';
  return '/api/approvals/comments/add';
}

function getPutEndpoint(type: CommentSectionProps['type']) {
  if (type === 'task') return '/api/tasks/comments';
  return '/api/change-requests/comments';
}

function getDeleteEndpoint(type: CommentSectionProps['type']) {
  if (type === 'task') return '/api/tasks/comments';
  if (type === 'change-request') return '/api/change-requests/comments';
  return '/api/approvals/comments/delete';
}

function getDeleteMethod(type: CommentSectionProps['type']) {
  if (type === 'approval') return 'POST';
  return 'DELETE';
}

function getFetchBody(type: CommentSectionProps['type'], targetId: string, projectId: string) {
  if (type === 'task') return JSON.stringify({ taskId: targetId, projectId });
  if (type === 'change-request') return JSON.stringify({ crId: targetId, projectId });
  return JSON.stringify({ approvalId: targetId });
}

function getPostBody(type: CommentSectionProps['type'], targetId: string, projectId: string, content: string) {
  if (type === 'task') return JSON.stringify({ taskId: targetId, projectId, content });
  if (type === 'change-request') return JSON.stringify({ crId: targetId, projectId, content });
  return JSON.stringify({ approvalId: targetId, content });
}

function normalizeComments(raw: any, type: CommentSectionProps['type']): CommentItem[] {
  if (type === 'approval') {
    return (Array.isArray(raw) ? raw : []).map((c: any) => ({
      id: String(c.publicId || c.id || Math.random()),
      authorId: String(c.author?.publicId || c.author?.id || c.authorId || ''),
      authorName: String(c.author?.name || c.authorName || 'Unknown'),
      avatar: c.author?.avatar || c.avatar || null,
      content: String(c.content || ''),
      createdAt: String(c.createdAt || ''),
      updatedAt: c.updatedAt ? String(c.updatedAt) : undefined,
      isEdited: Boolean(c.isEdited),
    }));
  }
  return (Array.isArray(raw) ? raw : []).map((c: any) => ({
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

// ─── CommentAvatar ─────────────────────────────────────────────────────────────

interface CommentAvatarProps {
  avatarSrc?: string | null;
  authorName: string;
  isPanel: boolean;
}

export const CommentAvatar = memo(function CommentAvatar({ avatarSrc, authorName, isPanel }: CommentAvatarProps) {
  const sizeClass = isPanel ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs';
  const ringClass = isPanel ? 'h-7 w-7' : 'h-8 w-8';

  if (avatarSrc) {
    return (
      <img
        src={avatarSrc}
        alt={authorName}
        className={cn('rounded-full object-cover shrink-0 ring-1 ring-[#E5E7EB]', ringClass)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white',
        sizeClass
      )}
      style={{ backgroundColor: nameToColor(authorName) }}
    >
      {authorName.charAt(0).toUpperCase()}
    </div>
  );
});

// ─── CommentTime ──────────────────────────────────────────────────────────────

interface CommentTimeProps {
  createdAt: string;
  isPanel: boolean;
}

export const CommentTime = memo(function CommentTime({ createdAt, isPanel }: CommentTimeProps) {
  const time = fmtCommentTime(createdAt);
  return (
    <span className={cn('text-[11px] leading-none', isPanel ? 'text-[#9CA3AF]' : 'text-[#9CA3AF]')}>
      {time}
    </span>
  );
}, (prev, next) => prev.createdAt === next.createdAt && prev.isPanel === next.isPanel);

// ─── CommentEditForm ───────────────────────────────────────────────────────────

interface CommentEditFormProps {
  content: string;
  isPanel: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const CommentEditForm = memo(function CommentEditForm({
  content,
  isPanel,
  onChange,
  onSave,
  onCancel,
}: CommentEditFormProps) {
  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full resize-none rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]',
        )}
        rows={2}
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-3 py-1 text-[12px] font-medium rounded-md bg-[#155DFC] text-white hover:bg-[#0F4FD8] transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-[12px] font-medium rounded-md text-[#6A7282] hover:text-[#101828] hover:bg-[#F3F4F6] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.content === next.content &&
  prev.isPanel === next.isPanel &&
  prev.onSave === next.onSave &&
  prev.onCancel === next.onCancel
);

// ─── CommentActions ───────────────────────────────────────────────────────────

interface CommentActionsProps {
  isPanel: boolean;
  isAuthor: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const CommentActions = memo(function CommentActions({
  isPanel,
  isAuthor,
  onEdit,
  onDelete,
}: CommentActionsProps) {
  return (
    <div className={cn(
      'flex items-center gap-3',
      !isPanel && 'opacity-0 group-hover:opacity-100 transition-opacity'
    )}>
      {isAuthor && (
        <button
          onClick={onEdit}
          className="text-[11px] font-medium text-[#9CA3AF] hover:text-[#155DFC] transition-colors"
        >
          Edit
        </button>
      )}
      <button
        onClick={onDelete}
        className="text-[11px] font-medium text-[#9CA3AF] hover:text-red-500 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}, (prev, next) =>
  prev.isPanel === next.isPanel &&
  prev.isAuthor === next.isAuthor &&
  prev.onEdit === next.onEdit &&
  prev.onDelete === next.onDelete
);

// ─── CommentContent ────────────────────────────────────────────────────────────

interface CommentContentProps {
  content: string;
  isPanel: boolean;
  isEditing: boolean;
  editingContent: string;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export const CommentContent = memo(function CommentContent({
  content,
  isPanel,
  isEditing,
  editingContent,
  onEditChange,
  onEditSave,
  onEditCancel,
}: CommentContentProps) {
  if (isEditing) {
    return (
      <CommentEditForm
        content={editingContent}
        isPanel={isPanel}
        onChange={onEditChange}
        onSave={onEditSave}
        onCancel={onEditCancel}
      />
    );
  }

  return (
    <p className={cn(
      'whitespace-pre-wrap break-words leading-relaxed',
      isPanel ? 'text-[13px] text-[#4A5565]' : 'text-[13px] text-[#374151]'
    )}>
      {content}
    </p>
  );
}, (prev, next) =>
  prev.content === next.content &&
  prev.isPanel === next.isPanel &&
  prev.isEditing === next.isEditing &&
  prev.editingContent === next.editingContent &&
  prev.onEditChange === next.onEditChange &&
  prev.onEditSave === next.onEditSave &&
  prev.onEditCancel === next.onEditCancel
);

// ─── CommentItem ───────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: CommentItem;
  isPanel: boolean;
  isAuthor: boolean;
  canModerate: boolean;
  editingId: string | null;
  editingContent: string;
  shouldAnimate: boolean;
  onEdit: (c: CommentItem) => void;
  onDelete: (id: string) => void;
  onEditingChange: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
}

export const CommentItem = memo(function CommentItem({
  comment,
  isPanel,
  isAuthor,
  canModerate,
  editingId,
  editingContent,
  shouldAnimate,
  onEdit,
  onDelete,
  onEditingChange,
  onSaveEdit,
  onCancelEdit,
}: CommentItemProps) {
  const isEditing = editingId === comment.id;

  return (
    <motion.div
      layout={!isPanel}
      initial={shouldAnimate ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn(
        'group relative',
        !isPanel && 'rounded-xl p-3 hover:bg-[#F9FAFB] transition-colors mb-2'
      )}
    >
      <div className={cn('flex', isPanel ? 'gap-2.5' : 'gap-3')}>
        <CommentAvatar
          avatarSrc={comment.avatar}
          authorName={comment.authorName}
          isPanel={isPanel}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className={cn(
              'font-semibold leading-none',
              isPanel ? 'text-[13px] text-[#101828]' : 'text-[13px] text-[#101828]'
            )}>
              {comment.authorName}
            </span>
            <CommentTime createdAt={comment.createdAt} isPanel={isPanel} />
            {comment.isEdited && (
              <span className={cn('text-[11px] leading-none italic', isPanel ? 'text-[#9CA3AF]' : 'text-[#9CA3AF]')}>
                (edited)
              </span>
            )}
          </div>

          <CommentContent
            content={comment.content}
            isPanel={isPanel}
            isEditing={isEditing}
            editingContent={editingContent}
            onEditChange={onEditingChange}
            onEditSave={() => onSaveEdit(comment.id)}
            onEditCancel={onCancelEdit}
          />

          {canModerate && (
            <CommentActions
              isPanel={isPanel}
              isAuthor={isAuthor}
              onEdit={() => onEdit(comment)}
              onDelete={() => onDelete(comment.id)}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => {
  if (prev.comment.id !== next.comment.id) return false;
  if (prev.comment.content !== next.comment.content) return false;
  if (prev.comment.createdAt !== next.comment.createdAt) return false;
  if (prev.comment.isEdited !== next.comment.isEdited) return false;
  if (prev.comment.avatar !== next.comment.avatar) return false;
  if (prev.isPanel !== next.isPanel) return false;
  if (prev.isAuthor !== next.isAuthor) return false;
  if (prev.canModerate !== next.canModerate) return false;
  if (prev.editingId !== next.editingId) return false;
  if (prev.editingContent !== next.editingContent) return false;
  if (prev.shouldAnimate !== next.shouldAnimate) return false;
  return true;
});

// ─── CommentList ───────────────────────────────────────────────────────────────

interface CommentListProps {
  comments: CommentItem[];
  isPanel: boolean;
  editingId: string | null;
  editingContent: string;
  animatedIds: Set<string>;
  currentUserId: string;
  onEdit: (c: CommentItem) => void;
  onDelete: (id: string) => void;
  onEditingChange: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
}

export const CommentList = memo(function CommentList({
  comments,
  isPanel,
  editingId,
  editingContent,
  animatedIds,
  currentUserId,
  onEdit,
  onDelete,
  onEditingChange,
  onSaveEdit,
  onCancelEdit,
}: CommentListProps) {
  return (
    <motion.div
      key="comment-list"
      layout={!isPanel}
      className={cn(
        'space-y-0',
        isPanel ? 'mt-3 max-h-[240px] overflow-y-auto overscroll-contain pr-1' : 'pt-3'
      )}
    >
      <AnimatePresence initial={false}>
        {comments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            isPanel={isPanel}
            isAuthor={currentUserId === c.authorId}
            canModerate={true}
            editingId={editingId}
            editingContent={editingContent}
            shouldAnimate={animatedIds.has(c.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            onEditingChange={onEditingChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}, (prev, next) => {
  if (prev.comments !== next.comments && prev.comments.length !== next.comments.length) return false;
  if (prev.comments.length !== next.comments.length) return false;
  if (prev.isPanel !== next.isPanel) return false;
  if (prev.editingId !== next.editingId) return false;
  if (prev.editingContent !== next.editingContent) return false;
  if (prev.animatedIds !== next.animatedIds) return false;
  return true;
});

// ─── CommentComposer ───────────────────────────────────────────────────────────

interface CommentComposerProps {
  variant: 'panel' | 'detail';
  onSubmit: (content: string) => Promise<boolean>;
}

const CommentComposer = memo(function CommentComposer({ variant, onSubmit }: CommentComposerProps) {
  const [commentInput, setCommentInput] = useState('');
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isPanel = variant === 'panel';

  useEffect(() => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    const minHeight = isPanel ? 44 : 72;
    const maxHeight = isPanel ? 120 : 160;
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
  }, [commentInput, isPanel]);

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const submit = async () => {
    const content = commentInput.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const ok = await onSubmit(content);
      if (ok) {
        setCommentInput('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={cn('flex gap-2 items-end', isPanel ? 'mt-3' : 'rounded-xl border border-[#E5E7EB] bg-white')}>
      <textarea
        ref={textareaRef}
        placeholder="Write a comment..."
        value={commentInput}
        onChange={autoResize}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
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
        onClick={() => { void submit(); }}
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
        {!isPanel && (posting ? 'Posting...' : 'Post')}
      </button>
    </div>
  );
}, (prev, next) => prev.variant === next.variant && prev.onSubmit === next.onSubmit);

// ─── CommentEmptyState ────────────────────────────────────────────────────────

interface CommentEmptyStateProps {
  isPanel: boolean;
}

export const CommentEmptyState = memo(function CommentEmptyState({ isPanel }: CommentEmptyStateProps) {
  return (
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
  );
}, (prev, next) => prev.isPanel === next.isPanel);

// ─── CommentSectionHeader ─────────────────────────────────────────────────────

interface CommentSectionHeaderProps {
  isPanel: boolean;
  commentCount: number;
  loading: boolean;
}

export const CommentSectionHeader = memo(function CommentSectionHeader({
  isPanel,
  commentCount,
  loading,
}: CommentSectionHeaderProps) {
  return (
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
            ? (commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Add comment')
            : 'Comments'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {loading && (
          <svg className="h-3.5 w-3.5 animate-spin text-[#9CA3AF]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {!loading && commentCount > 0 && !isPanel && (
          <span className="inline-flex h-5 items-center rounded-full bg-[#F3F4F6] px-2 text-[10px] font-medium text-[#6A7282]">
            {commentCount}
          </span>
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.isPanel === next.isPanel &&
  prev.commentCount === next.commentCount &&
  prev.loading === next.loading
);

// ─── CommentSection ────────────────────────────────────────────────────────────

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const onCommentsChangeRef = useRef(onCommentsChange);
  const animatedIdsRef = useRef<Set<string>>(new Set());
  const commentCacheProjectId = projectId || targetId;
  const commentCacheScope = type === 'approval' ? 'versions' : type === 'change-request' ? 'changes' : 'tasks';
  const commentCacheKey = `comments:${type}:${targetId}`;

  const isPanel = variant === 'panel';
  const endpoint = useMemo(() => getEndpoint(type), [type]);
  const postEndpoint = useMemo(() => getPostEndpoint(type), [type]);
  const putEndpoint = useMemo(() => getPutEndpoint(type), [type]);
  const deleteEndpoint = useMemo(() => getDeleteEndpoint(type), [type]);
  const deleteMethod = useMemo(() => getDeleteMethod(type), [type]);
  const fetchBody = useMemo(() => getFetchBody(type, targetId, projectId), [type, targetId, projectId]);

  const checkModerate = useCallback((authorId: string) => {
    if (canModerate !== undefined) return canModerate;
    return currentUserId === authorId || currentRole === 'admin';
  }, [canModerate, currentUserId, currentRole]);

  // Keep ref in sync without re-render
  useEffect(() => {
    onCommentsChangeRef.current = onCommentsChange;
  }, [onCommentsChange]);

  useEffect(() => {
    onCommentsChangeRef.current?.(comments);
  }, [comments]);

  // ── Init realtime ───────────────────────────────────────────────────────────
  useEffect(() => {
    initProjectBlockRealtime();
  }, []);

  // ── Load from cache + fetch ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetchProjectBlock<{ items: CommentItem[] }>(projectId, commentCacheScope, commentCacheKey, {
      cacheKey: commentCacheProjectId,
    }).then((block) => {
      if (cancelled || !block?.items) return;
      setComments(block.items);
      setLoading(false);
    });

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
        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: fetchBody,
        });
        if (res.ok && !cancelled) {
          const d = await res.json();
          const list = normalizeComments(
            type === 'approval' ? d?.data?.comments : d?.data,
            type
          );
          setComments(list);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [commentCacheKey, commentCacheProjectId, commentCacheScope, targetId, projectId, type, endpoint, fetchBody]);

  // ── Cache merge ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mergeProjectTabCache(commentCacheProjectId, commentCacheScope, {
      [commentCacheKey]: comments,
    });
  }, [commentCacheKey, commentCacheProjectId, commentCacheScope, comments]);

  // ── Project block refresh ───────────────────────────────────────────────────
  useEffect(() => {
    return onProjectBlockRefresh<{ items: CommentItem[] }>(commentCacheProjectId, commentCacheScope, commentCacheKey, ({ data }) => {
      const block = data as { items?: CommentItem[] } | null;
      if (!block?.items) return;
      setComments(block.items);
      setLoading(false);
    });
  }, [commentCacheKey, commentCacheProjectId, commentCacheScope]);

  // ── SW + custom event refresh ───────────────────────────────────────────────
  useEffect(() => {
    const cleanupSw = listenToSwMessages((msg) => {
      if (msg.type !== 'REFRESH_RESPONSE') return;
      const { route, data } = msg.payload as { route?: string; data?: unknown };
      if (!route || !route.includes(endpoint)) return;

      const raw = (data as any)?.data ?? (Array.isArray(data) ? data : null);
      if (!Array.isArray(raw)) return;

      const incoming = normalizeComments(raw, type);
      setComments(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newOnes = incoming.filter(c => !existingIds.has(c.id));
        if (newOnes.length === 0) return prev;
        newOnes.forEach((comment) => animatedIdsRef.current.add(comment.id));
        return [...newOnes, ...prev];
      });
    });

    const eventName = `orbit:comments:${endpoint}`;
    const onTargetedRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | CommentItem[]
        | { action?: 'append' | 'replace' | 'update' | 'delete'; comments?: CommentItem[]; commentId?: string }
        | undefined;
      if (!detail) return;

      if (Array.isArray(detail)) {
        setComments(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newOnes = detail.filter(c => !existingIds.has(c.id));
          if (newOnes.length === 0) return prev;
          newOnes.forEach((comment) => animatedIdsRef.current.add(comment.id));
          return dedupeComments([...newOnes, ...prev]);
        });
        return;
      }

      const action = detail.action || 'append';
      const incoming = Array.isArray(detail.comments) ? detail.comments : [];

      if (action === 'delete' && detail.commentId) {
        setComments(prev => prev.filter((comment) => comment.id !== detail.commentId));
        return;
      }

      if (action === 'update' && incoming[0]) {
        setComments(prev => prev.map((comment) => comment.id === incoming[0].id ? { ...comment, ...incoming[0] } : comment));
        return;
      }

      if (action === 'replace') {
        setComments(dedupeComments(incoming));
        return;
      }

      if (incoming.length === 0) return;
      setComments(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newOnes = incoming.filter(c => !existingIds.has(c.id));
        if (newOnes.length === 0) return prev;
        newOnes.forEach((comment) => animatedIdsRef.current.add(comment.id));
        return dedupeComments([...newOnes, ...prev]);
      });
    };

    window.addEventListener(eventName, onTargetedRefresh);
    return () => {
      cleanupSw();
      window.removeEventListener(eventName, onTargetedRefresh);
    };
  }, [targetId, projectId, type, endpoint]);

  // ── Post ────────────────────────────────────────────────────────────────────
  const submitComment = useCallback(async (content: string) => {
    if (!content) return false;
    try {
      const res = await apiFetch(postEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: getPostBody(type, targetId, projectId, content),
      });
      const d = await res.json();
      if (d.success) {
        const raw = type === 'approval' ? d.data?.comment : d.data;
        const newComment: CommentItem = {
          id: String(raw?.publicId || raw?.id || Math.random()),
          authorId: String(raw?.authorId || raw?.author?.id || raw?.author?.publicId || currentUserId),
          authorName: String(raw?.authorName || raw?.author?.fullName || raw?.author?.name || 'You'),
          avatar: raw?.avatar || raw?.author?.avatar || null,
          content: String(raw?.content || content),
          createdAt: String(raw?.createdAt || new Date().toISOString()),
          updatedAt: raw?.updatedAt ? String(raw.updatedAt) : undefined,
          isEdited: false,
        };
        animatedIdsRef.current.add(newComment.id);
        setComments(prev => [newComment, ...prev]);
        return true;
      } else {
        toast.error(d.message || 'Failed to post comment');
      }
    } catch {
      toast.error('Failed to post comment');
    }
    return false;
  }, [currentUserId, projectId, targetId, type, postEndpoint]);

  // ── Edit ────────────────────────────────────────────────────────────────────
  const startEdit = useCallback((comment: CommentItem) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingContent('');
  }, []);

  const saveEdit = useCallback(async (commentId: string) => {
    if (type === 'approval') return;
    const content = editingContent.trim();
    if (!content) return;
    try {
      const res = await apiFetch(putEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content }),
      });
      const d = await res.json();
      if (d.success) {
        setComments(prev =>
          prev.map(c =>
            c.id === commentId
              ? { ...c, content: d.data.content || content, isEdited: true, updatedAt: d.data.updatedAt || new Date().toISOString() }
              : c
          )
        );
        cancelEdit();
      } else {
        toast.error(d.message || 'Failed to update comment');
      }
    } catch {
      toast.error('Failed to update comment');
    }
  }, [type, editingContent, putEndpoint, cancelEdit]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteComment = useCallback(async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      const res = await apiFetch(deleteEndpoint, {
        method: deleteMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deleteMethod === 'POST' ? { commentId } : { commentId }),
      });
      const d = await res.json();
      if (d.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      } else {
        toast.error(d.message || 'Failed to delete comment');
      }
    } catch {
      toast.error('Failed to delete comment');
    }
  }, [deleteEndpoint, deleteMethod]);

  // ── Prefetch via SW ─────────────────────────────────────────────────────────
  useEffect(() => {
    prefetchApiCache([endpoint]);
  }, [targetId, projectId, type, endpoint]);

  // Stable animated ids set for memo comparison — we pass a new reference
  // only when size changes, which is fine since CommentList uses
  // prev.animatedIds !== next.animatedIds as a bailout condition.
  const animatedIds = animatedIdsRef.current;

  return (
    <div className={cn(isPanel && borderTop && 'pt-3 border-t border-[#E5E7EB]', !isPanel && 'border-t border-[#E5E7EB] pt-5')}>
      <CommentSectionHeader
        isPanel={isPanel}
        commentCount={comments.length}
        loading={loading}
      />

      <CommentComposer variant={variant} onSubmit={submitComment} />

      {!loading && comments.length === 0 ? (
        <CommentEmptyState isPanel={isPanel} />
      ) : (
        <CommentList
          comments={comments}
          isPanel={isPanel}
          editingId={editingId}
          editingContent={editingContent}
          animatedIds={animatedIds}
          currentUserId={currentUserId}
          onEdit={startEdit}
          onDelete={deleteComment}
          onEditingChange={setEditingContent}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
        />
      )}
    </div>
  );
}
