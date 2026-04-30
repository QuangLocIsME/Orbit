import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = string;

export interface WorkflowStage {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

interface Task {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: TaskStatus;
  tags: string[];
  linkedItem?: { type: 'link'; name: string; crId?: string };
  comments: number;
  attachments: number;
  dueDate: string;
  assigneeId: string;
  assigneeIds?: string[];
  reviewerIds?: string[];
  projectId?: string;
}

interface TaskMember {
  id: string;
  name: string;
  color: string;
  avatar: string;
  avatarUrl: string | null;
}

type ProjectRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

const canManageTask = (role: ProjectRole) => ['owner', 'admin', 'manager'].includes(role);

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-[#FEE2E2] text-[#DC2626]',
  high:   'bg-[#FEE2E2] text-[#DC2626]',
  medium: 'bg-[#F0F9FF] text-[#0069A8]',
  low:    'bg-[#F3F4F6] text-[#364153]',
};

// ─── Sortable Task Card ───────────────────────────────────────────────────────

function SortableTaskCard({
  task,
  teamMembers,
  onClick,
  canManage,
  onEditRequest,
  onDeleteRequest,
  workflowStages,
}: {
  task: Task;
  teamMembers: TaskMember[];
  onClick: () => void;
  canManage: boolean;
  onEditRequest: (task: Task) => void;
  onDeleteRequest: (taskId: string) => void;
  workflowStages?: { id: string; name: string; color?: string }[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const assigneeIds = task.assigneeIds || [];
  const allAssigneeIds = [...new Set([task.assigneeId, ...assigneeIds].filter(Boolean))];
  const assignees = allAssigneeIds
    .map((id) => teamMembers.find((m) => m.id === id))
    .filter(Boolean) as TaskMember[];

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={canManage ? handleContextMenu : undefined}
      className={cn(
        'group bg-white rounded-[10px] border border-[#E5E7EB] p-2 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow',
        isDragging && 'shadow-lg border-[#155DFC]'
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-start gap-1.5 min-w-0 flex-1" onClick={onClick}>
          <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] shrink-0', PRIORITY_STYLE[task.priority])}>
            {task.priority}
          </span>
          {workflowStages && workflowStages.length > 0 && (() => {
            const stage = workflowStages.find(s => s.id === task.status);
            if (!stage) return null;
            return (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] shrink-0 bg-[#F3F4F6] text-[#364153]"
                style={stage.color ? { backgroundColor: `${stage.color}20`, color: stage.color } : undefined}
              >
                {stage.name}
              </span>
            );
          })()}
        </div>
      </div>
      <div className="mt-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="text-left text-[13px] font-normal text-[#101828] block w-full hover:text-[#155DFC] hover:underline"
        >
          {task.title}
        </button>
      </div>

      {/* tags, linkedItem, stats */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {task.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-[6px] bg-[#F3F4F6] px-1.5 py-0.5 text-[11px] text-[#4A5565]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {task.linkedItem && (
        <div className="flex items-center gap-1 mb-2">
          <svg className="h-3 w-3 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          {task.linkedItem.crId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/projects/${task.projectId}?tab=changes&crId=${task.linkedItem!.crId}`;
              }}
              className="text-[11px] text-[#155DFC] hover:underline"
            >
              {task.linkedItem.name}
            </button>
          ) : (
            <span className="text-[11px] text-[#155DFC]">{task.linkedItem.name}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-[#6A7282]">
        {task.comments > 0 && (
          <div className="flex items-center gap-0.5">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            {task.comments}
          </div>
        )}
        {task.attachments > 0 && (
          <div className="flex items-center gap-0.5">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
            {task.attachments}
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-0.5">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {formatDate(task.dueDate)}
          </div>
        )}
      </div>

      {assignees.length > 0 && (
        <div className="flex -space-x-1 mt-1.5">
          {assignees.map((a) => (
            <div
              key={a.id}
              className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white ring-2 ring-white overflow-hidden',
                !a.avatarUrl ? a.color : ''
              )}
              title={a.name}
            >
              {a.avatarUrl ? (
                <img
                  src={a.avatarUrl}
                  alt={a.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                a.avatar
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-[99999] w-36 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 text-[13px]"
          style={{ top: menuPos.y, left: menuPos.x }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEditRequest(task); }}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-[#101828]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setDeleteConfirmOpen(true); }}
            className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{task.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              onClick={() => { setDeleteConfirmOpen(false); onDeleteRequest(task.id); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Column Wrapper (handles droppable) ────────────────────────────────────────

function StageColumn({
  stageId,
  label,
  icon,
  count,
  children,
  onAddTask,
  variant,
}: {
  stageId: string;
  label: string;
  icon: string;
  count: number;
  children: React.ReactNode;
  onAddTask: () => void;
  variant?: 'pending-review';
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const isPendingReview = variant === 'pending-review';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-[280px] flex flex-col rounded-lg p-1 transition-all',
        isOver && 'bg-[#EFF6FF] ring-2 ring-[#155DFC] ring-opacity-50'
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          'flex items-center justify-between mb-3 rounded transition-colors',
          isPendingReview && 'bg-[#FEF3C7] border-b border-[#FCD34D]',
          isOver && 'bg-[#EFF6FF] ring-2 ring-[#155DFC]'
        )}
      >
        <div className="flex items-center gap-2">
          {icon === 'circle' && <div className="h-4 w-4 rounded-full border-2 border-[#D1D5DC]" />}
          {icon === 'clock' && (
            isPendingReview ? (
              <svg className="h-4 w-4 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 6v6l4 2" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 6v6l4 2" />
              </svg>
            )
          )}
          {icon === 'check' && (
            <svg className="h-4 w-4 text-[#009966]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          )}
          <span className={cn('text-[14px] font-normal text-[#101828]', isPendingReview && 'text-[#92400E]')}>{label}</span>
          <span className={cn('text-[12px] px-1.5 py-0.5 rounded', isPendingReview ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F3F4F6] text-[#6A7282]')}>{count}</span>
        </div>
        {!isPendingReview && (
          <button className="p-1 hover:bg-gray-100 rounded">
            <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </div>

      {children}

      {!isPendingReview && (
        <button
          onClick={onAddTask}
          className="mt-2 w-full py-2 rounded-[10px] border border-dashed border-[#D1D5DC] text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors"
        >
          + Add task
        </button>
      )}
    </div>
  );
}

// ─── Drag Overlay Ghost ───────────────────────────────────────────────────────

function TaskGhost({ task }: { task: Task }) {
  return (
    <div className="bg-white rounded-[10px] border-2 border-[#155DFC] p-3 shadow-xl opacity-95 w-[268px] rotate-1 pointer-events-none">
      <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[12px] mb-2', PRIORITY_STYLE[task.priority])}>
        {task.priority}
      </span>
      <p className="text-[14px] font-normal text-[#101828]">{task.title}</p>
    </div>
  );
}

// ─── Main TaskBoard ──────────────────────────────────────────────────────────

interface TaskBoardProps {
  tasks: Task[];
  teamMembers: TaskMember[];
  loading: boolean;
  stages: WorkflowStage[];
  projectRole?: ProjectRole;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (taskId: string) => void;
  onAddTask: (stageId?: string) => void;
  onEditRequest: (task: Task) => void;
  onDeleteRequest: (taskId: string) => void;
}

export default function TaskBoard({
  tasks,
  teamMembers,
  loading,
  stages,
  projectRole = 'member',
  onTaskStatusChange,
  onTaskClick,
  onAddTask,
  onEditRequest,
  onDeleteRequest,
}: TaskBoardProps) {
  const manageTask = canManageTask(projectRole);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);

    if (!over) return;

    const draggedTaskId = String(active.id);

    const targetStage = stages.find((s) => s.id === over.id);
    if (targetStage) {
      onTaskStatusChange(draggedTaskId, targetStage.id);
      return;
    }

    const targetTask = tasks.find((t) => t.id === over.id);
    if (targetTask) {
      onTaskStatusChange(draggedTaskId, targetTask.status);
    }
  }, [tasks, stages, onTaskStatusChange]);

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;

  if (loading) {
    return <div className="py-12 text-center text-[14px] text-[#6A7282]">Loading tasks...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 min-w-max pb-4">
        {stages.map((stage, idx) => {
          const icon = idx === 0 ? 'circle' : idx === stages.length - 1 ? 'check' : 'clock';
          const stageTasks = tasks.filter((t) => t.status === stage.id);
          const taskIds = stageTasks.map((t) => t.id);

          return (
            <StageColumn
              key={stage.id}
              stageId={stage.id}
              label={stage.name}
              icon={icon}
              count={stageTasks.length}
              onAddTask={() => onAddTask(stage.id)}
            >
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 min-h-[80px]">
                  {stageTasks.map((task) => {
                    const assigneeIds = task.assigneeIds || [];
                    const allIds = [...new Set([task.assigneeId, ...assigneeIds].filter(Boolean))];
                    const assignees = allIds
                      .map((id) => teamMembers.find((m) => m.id === id))
                      .filter(Boolean) as TaskMember[];
                    return (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        teamMembers={assignees}
                        canManage={manageTask}
                        onClick={() => onTaskClick(task.id)}
                        onEditRequest={onEditRequest}
                        onDeleteRequest={onDeleteRequest}
                        workflowStages={stages}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </StageColumn>
          );
        })}

        {/* Pending Review column for CR-linked tasks awaiting approval */}
        {(() => {
          const pendingTasks = tasks.filter((t) => t.status === 'pending-review');
          if (pendingTasks.length === 0) return null;
          return (
            <StageColumn
              key="pending-review"
              stageId="pending-review"
              label="Pending Review"
              icon="clock"
              count={pendingTasks.length}
              onAddTask={() => {}}
              variant="pending-review"
            >
              <SortableContext items={pendingTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 min-h-[80px]">
                  {pendingTasks.map((task) => {
                    const assigneeIds = task.assigneeIds || [];
                    const allIds = [...new Set([task.assigneeId, ...assigneeIds].filter(Boolean))];
                    const assignees = allIds
                      .map((id) => teamMembers.find((m) => m.id === id))
                      .filter(Boolean) as TaskMember[];
                    return (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        teamMembers={assignees}
                        canManage={manageTask}
                        onClick={() => onTaskClick(task.id)}
                        onEditRequest={onEditRequest}
                        onDeleteRequest={onDeleteRequest}
                        workflowStages={stages}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </StageColumn>
          );
        })()}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskGhost task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
