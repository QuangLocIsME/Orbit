'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Eye, Loader2, AlertCircle, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskItem {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    tags: string[];
    assigneeName?: string;
    dueDate?: string | null;
    commentsCount?: number;
}

interface GuestScopedTasksPanelProps {
    projectId: string;
    packageId: string;
    guestToken: string;
    variant?: 'full' | 'compact';
}

const PRIORITY_COLORS: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
    done: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-emerald-100 text-emerald-700',
    approved: 'bg-emerald-100 text-emerald-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    active: 'bg-blue-100 text-blue-700',
    review: 'bg-purple-100 text-purple-700',
    backlog: 'bg-gray-100 text-gray-600',
    todo: 'bg-gray-100 text-gray-600',
};

function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GuestScopedTasksPanel({ projectId, packageId, guestToken, variant = 'full' }: GuestScopedTasksPanelProps) {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('list');

    useEffect(() => {
        const loadTasks = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `/api/guest/tasks/${encodeURIComponent(projectId)}?token=${encodeURIComponent(guestToken)}`
                );
                if (!res.ok) throw new Error('Failed to load tasks');
                const payload = await res.json();
                if (!payload.success) throw new Error(payload.message || 'Failed');

                const allTasks: TaskItem[] = (payload.data || [])
                    .filter((t: any) => {
                        if (!packageId) return true;
                        return String(t.packageId) === packageId || !t.packageId;
                    })
                    .map((t: any) => ({
                        id: String(t.publicId || t.id || ''),
                        title: String(t.title || 'Untitled task'),
                        description: String(t.description || ''),
                        status: String(t.status || 'backlog'),
                        priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium') as TaskItem['priority'],
                        tags: Array.isArray(t.tags) ? t.tags : [],
                        assigneeName: t.assigneeName || t.assignee?.fullName || '',
                        dueDate: t.dueDate,
                        commentsCount: t.commentsCount || 0,
                    }));

                setTasks(allTasks);
            } catch (err: any) {
                setError(err?.message || 'Failed to load tasks');
            } finally {
                setLoading(false);
            }
        };

        loadTasks();
    }, [projectId, packageId, guestToken]);

    const getStatusClass = (status: string) => {
        const s = String(status || '').toLowerCase();
        return STATUS_COLORS[s] || 'bg-gray-100 text-gray-600';
    };

    const groupedTasks = tasks.reduce<Record<string, TaskItem[]>>((acc, task) => {
        const stage = String(task.status || 'backlog').toLowerCase();
        if (!acc[stage]) acc[stage] = [];
        acc[stage].push(task);
        return acc;
    }, {});

    const completedCount = tasks.filter(t => ['done', 'completed', 'approved'].includes(String(t.status).toLowerCase())).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 rounded-lg text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                    <CheckCircle className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No tasks yet</p>
                <p className="text-xs text-gray-500">No tasks have been created for this package.</p>
            </div>
        );
    }

    const completedPercent = Math.round((completedCount / Math.max(tasks.length, 1)) * 100);

    return (
        <div className="space-y-4">
            {/* Header stats */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-900">{completedCount}/{tasks.length}</p>
                        <p className="text-[11px] text-gray-500">completed</p>
                    </div>
                </div>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-48">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${completedPercent}%` }}
                    />
                </div>
                <p className="text-xs text-gray-400">{completedPercent}%</p>

                <div className="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={cn(
                            'px-2 py-1 rounded text-xs font-medium transition-colors',
                            viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'
                        )}
                    >
                        List
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('board')}
                        className={cn(
                            'px-2 py-1 rounded text-xs font-medium transition-colors',
                            viewMode === 'board' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'
                        )}
                    >
                        Board
                    </button>
                </div>
            </div>

            {/* Read-only badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <Eye className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                    <span className="font-medium">View-only: </span>You cannot create, edit, or delete tasks. Log in to request full access.
                </p>
            </div>

            {/* List view */}
            {viewMode === 'list' && (
                <div className="space-y-2">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                            <span className={cn('shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize', getStatusClass(task.status))}>
                                {task.status}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                                {task.tags.length > 0 && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <Tag className="h-3 w-3 text-gray-400" />
                                        <span className="text-[10px] text-gray-400">{task.tags.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                            <span className={cn('shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded capitalize', PRIORITY_COLORS[task.priority])}>
                                {task.priority}
                            </span>
                            {task.dueDate && (
                                <span className="shrink-0 text-[11px] text-gray-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(task.dueDate)}
                                </span>
                            )}
                            {task.assigneeName && (
                                <span className="shrink-0 text-[11px] text-gray-500 truncate max-w-[100px]">{task.assigneeName}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Board view */}
            {viewMode === 'board' && (
                <div className="overflow-x-auto">
                    <div className="flex gap-4 min-w-max pb-4">
                        {Object.entries(groupedTasks).map(([stage, stageTasks]) => (
                            <div key={stage} className="w-72 shrink-0">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                                        <span className="text-xs font-semibold text-gray-700 capitalize">{stage}</span>
                                    </div>
                                    <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                        {stageTasks.length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {stageTasks.map(task => (
                                        <div
                                            key={task.id}
                                            className="bg-white rounded-xl border border-gray-200 p-3 space-y-2"
                                        >
                                            <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded capitalize', PRIORITY_COLORS[task.priority])}>
                                                    {task.priority}
                                                </span>
                                                {task.tags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-gray-400">
                                                {task.dueDate && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDate(task.dueDate)}
                                                    </span>
                                                )}
                                                {task.assigneeName && (
                                                    <span className="ml-auto">{task.assigneeName}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
