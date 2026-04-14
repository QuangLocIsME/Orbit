'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { cn } from '@/lib/utils';

type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';

interface Task {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: TaskStatus;
  tags: string[];
  dueDate: string;
  assigneeId: string;
}

interface TaskMember {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

interface TaskCalendarProps {
  tasks: Task[];
  teamMembers: TaskMember[];
  onTaskClick: (taskId: string) => void;
}

const PRIORITY_BG: Record<string, string> = {
  urgent: 'bg-[#FEE2E2]',
  high: 'bg-[#FEE2E2]',
  medium: 'bg-[#EFF6FF]',
  low: 'bg-[#F3F4F6]',
};

const PRIORITY_TEXT: Record<string, string> = {
  urgent: 'text-[#DC2626]',
  high: 'text-[#DC2626]',
  medium: 'text-[#155DFC]',
  low: 'text-[#364153]',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
};

const STATUS_BG: Record<TaskStatus, string> = {
  backlog: 'bg-[#F3F4F6]',
  todo: 'bg-[#F3F4F6]',
  'in-progress': 'bg-[#EFF6FF]',
  review: 'bg-[#FEF3C7]',
  done: 'bg-[#ECFDF5]',
};

function parseTaskDate(dueDate: string): Date | null {
  if (!dueDate) return null;
  try {
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) {
      // Fallback: try parsing "Apr 14, 2026" format
      const fallback = new Date(dueDate.replace(/(\w+)\s+(\d+),\s+(\d+)/, '$2 $1 $3'));
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
    return d;
  } catch {
    return null;
  }
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TaskCalendar({ tasks, teamMembers, onTaskClick }: TaskCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const d = parseTaskDate(task.dueDate);
      if (!d || Number.isNaN(d.getTime())) continue;
      const key = format(d, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-semibold text-[#101828]">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => {
              const now = new Date();
              setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className="text-[12px] px-2.5 py-1 rounded-[6px] bg-[#F3F4F6] text-[#4A5565] hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-gray-100 transition-colors"
            aria-label="Previous month"
          >
            <svg className="h-4 w-4 text-[#4A5565]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-gray-100 transition-colors"
            aria-label="Next month"
          >
            <svg className="h-4 w-4 text-[#4A5565]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day} className="text-[12px] font-medium text-[#6A7282] text-center py-1.5">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 border border-[#E5E7EB] rounded-[10px] overflow-hidden bg-white">
        {calendarDays.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate.get(dateKey) || [];
          const inCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const isLastRow = idx >= calendarDays.length - 7;

          return (
            <div
              key={dateKey}
              className={cn(
                'flex flex-col min-h-[110px] border-r border-b border-[#E5E7EB] p-1.5 transition-colors',
                !inCurrentMonth && 'bg-[#FAFAFA]',
                idx % 7 === 6 && 'border-r-0',
                isLastRow && 'border-b-0'
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium',
                    isCurrentDay
                      ? 'bg-[#155DFC] text-white'
                      : !inCurrentMonth
                      ? 'text-[#D1D5DC]'
                      : 'text-[#101828]',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-[#6A7282] bg-[#F3F4F6] rounded px-1">
                    {dayTasks.length}
                  </span>
                )}
              </div>

              {/* Task chips */}
              <div className="flex flex-col gap-1 overflow-y-auto flex-1">
                {dayTasks.slice(0, 3).map((task) => {
                  const assignee = teamMembers.find((m) => m.id === task.assigneeId);
                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className={cn(
                        'w-full text-left rounded-[6px] px-1.5 py-1 text-[11px] leading-snug border border-transparent hover:border-[#155DFC] hover:shadow-sm transition-all cursor-pointer',
                        PRIORITY_BG[task.priority],
                        PRIORITY_TEXT[task.priority]
                      )}
                      title={task.title}
                    >
                      <div className="flex items-center gap-1">
                        {assignee && (
                          <div
                            className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                            style={{ backgroundColor: assignee.color }}
                          >
                            {assignee.avatar}
                          </div>
                        )}
                        <span className="truncate">{task.title}</span>
                      </div>
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <button className="text-[11px] text-[#6A7282] text-left px-1.5 hover:text-[#155DFC] transition-colors w-full">
                    +{dayTasks.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', STATUS_BG[status as TaskStatus])} />
            <span className="text-[11px] text-[#6A7282]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
