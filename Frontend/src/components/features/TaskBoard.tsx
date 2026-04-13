import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

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

type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';

interface Task {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: TaskStatus;
  tags: string[];
  linkedItem?: { type: 'link'; name: string };
  comments: number;
  attachments: number;
  dueDate: string;
  assigneeId: string;
}

interface TaskMember {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

const taskColumns = [
  { id: 'backlog',      label: 'Backlog',      icon: 'circle' },
  { id: 'todo',         label: 'To Do',         icon: 'circle' },
  { id: 'in-progress',  label: 'In Progress',  icon: 'clock'  },
  { id: 'review',       label: 'Review',        icon: 'clock'  },
  { id: 'done',         label: 'Done',          icon: 'check'  },
] as const;

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-[#FEE2E2] text-[#DC2626]',
  high:   'bg-[#FEE2E2] text-[#DC2626]',
  medium: 'bg-[#F0F9FF] text-[#0069A8]',
  low:    'bg-[#F3F4F6] text-[#364153]',
};

// ─── Sortable Task Card ───────────────────────────────────────────────────────

function SortableTaskCard({
  task,
  assignee,
  onClick,
}: {
  task: Task;
  assignee?: TaskMember;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

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
      onClick={onClick}
      className={cn(
        'bg-white rounded-[10px] border border-[#E5E7EB] p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow',
        isDragging && 'shadow-lg border-[#155DFC]'
      )}
    >
      <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[12px] mb-2', PRIORITY_STYLE[task.priority])}>
        {task.priority}
      </span>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="text-left text-[14px] font-normal text-[#101828] mb-2 block w-full hover:text-[#155DFC] hover:underline"
      >
        {task.title}
      </button>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-[6px] bg-[#F3F4F6] px-2 py-0.5 text-[12px] text-[#4A5565]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {task.linkedItem && (
        <div className="flex items-center gap-1 mb-3">
          <svg className="h-3.5 w-3.5 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          <span className="text-[12px] text-[#155DFC]">{task.linkedItem.name}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[12px] text-[#6A7282]">
          {task.comments > 0 && (
            <div className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              {task.comments}
            </div>
          )}
          {task.attachments > 0 && (
            <div className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              {task.attachments}
            </div>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {formatDate(task.dueDate)}
            </div>
          )}
        </div>
        {assignee && (
          <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white', assignee.color)}>
            {assignee.avatar}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Column Header ────────────────────────────────────────────────────────────

function ColumnHeader({ label, icon, count, columnId }: { label: string; icon: string; count: number; columnId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center justify-between mb-3 rounded transition-colors',
        isOver && 'bg-[#EFF6FF] ring-2 ring-[#155DFC]'
      )}
    >
      <div className="flex items-center gap-2">
        {icon === 'circle' && <div className="h-4 w-4 rounded-full border-2 border-[#D1D5DC]" />}
        {icon === 'clock' && (
          <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v6l4 2" />
          </svg>
        )}
        {icon === 'check' && (
          <svg className="h-4 w-4 text-[#009966]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        )}
        <span className="text-[14px] font-normal text-[#101828]">{label}</span>
        <span className="text-[12px] text-[#6A7282] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{count}</span>
      </div>
      <button className="p-1 hover:bg-gray-100 rounded">
        <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
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
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (taskId: string) => void;
  onAddTask: () => void;
}

export default function TaskBoard({
  tasks,
  teamMembers,
  loading,
  onTaskStatusChange,
  onTaskClick,
  onAddTask,
}: TaskBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: any) => {
    setOverId(event.over?.id ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    setOverId(null);

    if (!over) return;

    const draggedTaskId = String(active.id);

    // Dropped on a column header (column id matches column.id)
    const targetColumn = taskColumns.find((c) => c.id === over.id);
    if (targetColumn) {
      onTaskStatusChange(draggedTaskId, targetColumn.id as TaskStatus);
      return;
    }

    // Dropped on another task — find its column
    const targetTask = tasks.find((t) => t.id === over.id);
    if (targetTask) {
      onTaskStatusChange(draggedTaskId, targetTask.status);
    }
  }, [tasks, onTaskStatusChange]);

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;

  // Always call hooks before any early returns — hooks must run on every render in the same order
  const columnDropRefs = taskColumns.map((column) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { setNodeRef, isOver } = useDroppable({ id: column.id });
    return { setNodeRef, isOver };
  });

  if (loading) {
    return <div className="py-12 text-center text-[14px] text-[#6A7282]">Loading tasks...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 min-w-max pb-4">
        {taskColumns.map((column, idx) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          const taskIds = columnTasks.map((t) => t.id);
          const { setNodeRef: setColumnRef, isOver: isOverColumn } = columnDropRefs[idx];

          return (
            <div
              key={column.id}
              ref={setColumnRef}
              className={cn(
                'w-[280px] flex flex-col rounded-lg p-1 transition-all',
                isOverColumn && 'bg-[#EFF6FF] ring-2 ring-[#155DFC] ring-opacity-50'
              )}
            >
              <ColumnHeader
                label={column.label}
                icon={column.icon}
                count={columnTasks.length}
                columnId={column.id}
              />

              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 min-h-[80px]">
                  {columnTasks.map((task) => {
                    const assignee = teamMembers.find((m) => m.id === task.assigneeId);
                    return (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        assignee={assignee}
                        onClick={() => onTaskClick(task.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>

              <button
                onClick={onAddTask}
                className="mt-2 w-full py-2 rounded-[10px] border border-dashed border-[#D1D5DC] text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors"
              >
                + Add task
              </button>
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskGhost task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
