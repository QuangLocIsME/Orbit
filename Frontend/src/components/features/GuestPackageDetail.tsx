'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, Clock, FileText, Users, ChevronRight, Eye, Loader2, AlertCircle, Tag, Folder, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSocket, joinPackage, leavePackage } from '@/lib/socket';

interface WorkflowStage {
  id: string;
  label: string;
  description?: string;
  _id?: string;
}

interface DocumentTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  icon?: string;
  children?: DocumentTreeNode[];
  category?: string;
  size?: string;
  updatedAt?: string;
  author?: string;
  mimeType?: string;
  folderPath?: string;
  s3Key?: string;
  s3Url?: string;
  versionNumber?: number;
  versionLabel?: string;
  versionDescription?: string;
  versionGroupId?: string;
  versionId?: string;
  versionCount?: number;
  conversionStatus?: string;
  conversionError?: string;
  isIfc?: boolean;
  approvalStatus?: string;
}

interface GuestPackageDetailProps {
    projectPublicId: string;
    packageId: string;
    guestToken: string;
    projectName: string;
    packageName: string;
    onBack?: () => void;
}

interface TaskItem {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    tags: string[];
    assigneeName?: string;
    assigneeId?: string;
    dueDate?: string | null;
    commentsCount?: number;
}

interface MemberItem {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string;
    avatarUrl: string | null;
    color: string;
}

interface PackageFull {
    publicId: string;
    projectId: string;
    name: string;
    description: string;
    status: string;
    lifecycleStatus?: string;
    progress?: number;
    dueDate?: string;
    creatorId?: string;
    creatorName?: string;
    teamMembers: MemberItem[];
    totalTasks: number;
    completedTasks: number;
    documentsCount: number;
}

type TabId = 'overview' | 'tasks' | 'documents' | 'team';

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

function getInitials(name: string) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function GuestPackageDetail({
    projectPublicId, packageId, guestToken, projectName, packageName, onBack,
}: GuestPackageDetailProps) {
    const [loading, setLoading] = useState(true);
    const [pkg, setPkg] = useState<PackageFull | null>(null);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [stages, setStages] = useState<WorkflowStage[]>([]);
    const [documentsTree, setDocumentsTree] = useState<DocumentTreeNode | null>(null);
    const [documentsTotal, setDocumentsTotal] = useState(0);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [viewMode, setViewMode] = useState<'list' | 'board'>('board');
    const [error, setError] = useState<string | null>(null);

    // Fetch all data
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                const [pkgRes, tasksRes, stagesRes] = await Promise.all([
                    fetch(`/api/guest/package-full/${encodeURIComponent(projectPublicId)}/${encodeURIComponent(packageId)}?token=${encodeURIComponent(guestToken)}`),
                    fetch(`/api/guest/tasks/${encodeURIComponent(projectPublicId)}?token=${encodeURIComponent(guestToken)}&packageId=${encodeURIComponent(packageId)}`),
                    fetch(`/api/guest/workflow/${encodeURIComponent(projectPublicId)}?token=${encodeURIComponent(guestToken)}`),
                ]);

                if (!pkgRes.ok) {
                    const d = await pkgRes.json().catch(() => ({}));
                    throw new Error(d.message || 'Cannot load package');
                }

                const pkgData = await pkgRes.json();
                if (!pkgData.success) throw new Error(pkgData.message || 'Cannot load package');
                setPkg(pkgData.data);

                if (tasksRes.ok) {
                    const tasksData = await tasksRes.json();
                    if (tasksData.success) {
                        const filtered = (tasksData.data || []).filter((t: any) =>
                            String(t.packageId || '') === String(packageId)
                        );
                        setTasks(filtered.map((t: any) => ({
                            id: String(t.publicId || t.id || ''),
                            title: String(t.title || 'Untitled task'),
                            description: String(t.description || ''),
                            status: String(t.status || 'backlog'),
                            priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium') as TaskItem['priority'],
                            tags: Array.isArray(t.tags) ? t.tags : [],
                            assigneeName: t.assigneeName || '',
                            assigneeId: t.assigneeId,
                            dueDate: t.dueDate,
                            commentsCount: t.commentsCount || 0,
                        })));
                    }
                }

                if (stagesRes.ok) {
                    const stagesData = await stagesRes.json();
                    if (stagesData.success) {
                        setStages(stagesData.data?.stages || []);
                    }
                }
            } catch (err: any) {
                setError(err?.message || 'Failed to load package');
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [projectPublicId, packageId, guestToken]);

    // WebSocket for real-time updates
    useEffect(() => {
        const socket = getSocket();
        joinPackage(packageId);

        const handlePackageUpdated = (data: { packageId: string; projectId: string; changes: Record<string, unknown> }) => {
            if (data.packageId === packageId || data.projectId === projectPublicId) {
                setPkg(prev => prev ? { ...prev, ...data.changes } : prev);
            }
        };

        const handleDocumentsRefresh = (data: { projectId: string; packageId: string | null }) => {
            if (data.packageId === packageId) {
                fetch(`/api/guest/documents/${encodeURIComponent(projectPublicId)}/${encodeURIComponent(packageId)}?token=${encodeURIComponent(guestToken)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            setDocumentsTree(data.data.tree);
                            setDocumentsTotal(data.data.total);
                        }
                    })
                    .catch(console.error);
            }
        };

        const handleTaskCompleted = (data: { projectId: string }) => {
            if (data.projectId === projectPublicId) {
                fetch(`/api/guest/tasks/${encodeURIComponent(projectPublicId)}?token=${encodeURIComponent(guestToken)}&packageId=${encodeURIComponent(packageId)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            const filtered = (data.data || []).filter((t: any) =>
                                String(t.packageId || '') === String(packageId)
                            );
                            setTasks(filtered.map((t: any) => ({
                                id: String(t.publicId || t.id || ''),
                                title: String(t.title || 'Untitled task'),
                                description: String(t.description || ''),
                                status: String(t.status || 'backlog'),
                                priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium') as TaskItem['priority'],
                                tags: Array.isArray(t.tags) ? t.tags : [],
                                assigneeName: t.assigneeName || '',
                                assigneeId: t.assigneeId,
                                dueDate: t.dueDate,
                                commentsCount: t.commentsCount || 0,
                            })));
                        }
                    })
                    .catch(console.error);
            }
        };

        socket.on('package:updated', handlePackageUpdated);
        socket.on('documents:refresh', handleDocumentsRefresh);
        socket.on('task:completed', handleTaskCompleted);

        return () => {
            socket.off('package:updated', handlePackageUpdated);
            socket.off('documents:refresh', handleDocumentsRefresh);
            socket.off('task:completed', handleTaskCompleted);
            leavePackage(packageId);
        };
    }, [projectPublicId, packageId, guestToken]);

    // Fetch documents when switching to documents tab
    const fetchDocuments = useCallback(async () => {
        try {
            const res = await fetch(`/api/guest/documents/${encodeURIComponent(projectPublicId)}/${encodeURIComponent(packageId)}?token=${encodeURIComponent(guestToken)}`);
            const data = await res.json();
            if (data.success) {
                setDocumentsTree(data.data.tree);
                setDocumentsTotal(data.data.total);
            }
        } catch (err) {
            console.error('Failed to fetch documents:', err);
        }
    }, [projectPublicId, packageId, guestToken]);

    useEffect(() => {
        if (activeTab === 'documents' && !documentsTree) {
            fetchDocuments();
        }
    }, [activeTab, documentsTree, fetchDocuments]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const lastStageId = stages.length > 0 ? stages[stages.length - 1].id : 'done';
        const completed = tasks.filter(t => String(t.status) === lastStageId).length;
        const inProgress = total - completed;
        return {
            completed,
            inProgress,
            documents: pkg?.documentsCount || 0,
            team: pkg?.teamMembers?.length || 0,
            total,
            completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
    }, [tasks, pkg, stages]);

    const getStatusClass = (status: string) => {
        const s = String(status || '').toLowerCase();
        return STATUS_COLORS[s] || 'bg-gray-100 text-gray-600';
    };

    const groupedTasks = useMemo(() => {
        const groups: Record<string, TaskItem[]> = {};
        stages.forEach(s => { groups[s.id] = []; });
        tasks.forEach(t => {
            const key = String(t.status || '');
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });
        return groups;
    }, [tasks, stages]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                <p className="text-sm text-gray-600">{error}</p>
            </div>
        );
    }

    if (!pkg) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-sm text-gray-500">Package not found.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 lg:px-16 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                    <a href="/" className="hover:text-gray-600">Home</a>
                    <ChevronRight className="h-3 w-3" />
                    <a href={`/projects/${projectPublicId}`} className="hover:text-gray-600">{projectName}</a>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-gray-600">{pkg.name}</span>
                </div>

                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">{pkg.name}</h1>
                        <p className="text-sm text-gray-500 mb-3">{pkg.description || 'No description'}</p>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium capitalize',
                                getStatusClass(pkg.lifecycleStatus || pkg.status)
                            )}>
                                {pkg.lifecycleStatus || pkg.status}
                            </span>
                            {pkg.dueDate && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatDate(pkg.dueDate)}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5" />
                                {stats.completed}/{stats.total} tasks
                            </span>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-3">
                        <div className="relative w-20 h-20">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                                <circle
                                    cx="18" cy="18" r="15.5" fill="none"
                                    stroke="#155DFC" strokeWidth="3"
                                    strokeDasharray={`${stats.completionPercent} 100`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-900">
                                {stats.completionPercent}%
                            </span>
                        </div>

                        {/* Members */}
                        <div className="flex -space-x-2">
                            {(pkg.teamMembers || []).slice(0, 4).map((member) => (
                                member.avatarUrl ? (
                                    <img
                                        key={member.id}
                                        src={member.avatarUrl}
                                        alt={member.name}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white object-cover text-[11px] text-white"
                                        title={member.name}
                                    />
                                ) : (
                                    <span
                                        key={member.id}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] text-white"
                                        style={{ backgroundColor: member.color }}
                                        title={member.name}
                                    >
                                        {member.avatar}
                                    </span>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200">
                {([
                    { id: 'overview', label: 'Overview' },
                    { id: 'tasks', label: 'Tasks' },
                    { id: 'documents', label: 'Documents' },
                    { id: 'team', label: 'Team' },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'h-[38px] border-b-2 px-4 text-sm transition-colors',
                            activeTab === tab.id
                                ? 'border-blue-600 text-blue-600 font-medium'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full text-xs text-amber-700 font-medium">
                    <Eye className="h-3.5 w-3.5" />
                    View Only
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                                <CheckCircle className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                                <p className="text-sm text-gray-500">Completed</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                                <Clock className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                                <p className="text-sm text-gray-500">In Progress</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                                <FileText className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.documents}</p>
                                <p className="text-sm text-gray-500">Documents</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                                <Users className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.team}</p>
                                <p className="text-sm text-gray-500">Team Members</p>
                            </div>
                        </div>
                    </div>

                    {/* Two column: Tasks preview + Due Soon */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Tasks preview */}
                        <div className="rounded-xl border border-gray-200 bg-white p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-gray-400" />
                                    Tasks ({stats.completed}/{stats.total})
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('tasks')}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    View all →
                                </button>
                            </div>
                            {tasks.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">No tasks yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {tasks.slice(0, 5).map(task => (
                                        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                            <span className={cn('shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded capitalize', getStatusClass(task.status))}>
                                                {task.status}
                                            </span>
                                            <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                                            <span className={cn('shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded capitalize', PRIORITY_COLORS[task.priority])}>
                                                {task.priority}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Due soon */}
                        <div className="rounded-xl border border-gray-200 bg-white p-5">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                <Clock className="h-5 w-5 text-gray-400" />
                                Due Soon
                            </h3>
                            {tasks.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">No upcoming deadlines</p>
                            ) : (
                                <div className="space-y-2">
                                    {tasks
                                        .filter(t => t.dueDate && new Date(t.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
                                        .slice(0, 5)
                                        .map(task => (
                                            <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                                <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                                                <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tasks' && (
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">{stats.completed}/{stats.total} completed</span>
                            <div className="h-1.5 bg-gray-200 rounded-full w-48 overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.completionPercent}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{stats.completionPercent}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                                    viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600 bg-gray-100'
                                )}
                            >
                                List
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('board')}
                                className={cn(
                                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                                    viewMode === 'board' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600 bg-gray-100'
                                )}
                            >
                                Board
                            </button>
                        </div>
                    </div>

                    {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20">
                            <CheckCircle className="h-10 w-10 text-gray-300 mb-3" />
                            <p className="text-sm font-medium text-gray-700">No tasks yet</p>
                            <p className="text-xs text-gray-400 mt-1">No tasks have been created for this package.</p>
                        </div>
                    ) : viewMode === 'list' ? (
                        <div className="space-y-2">
                            {tasks.map(task => {
                                const stageLabel = stages.find(s => s.id === task.status)?.label || task.status;
                                return (
                                <div key={task.id} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                    <span className={cn('shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full', getStatusClass(task.status))}>
                                        {stageLabel}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                        {task.tags.length > 0 && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <Tag className="h-3 w-3 text-gray-400" />
                                                <span className="text-[10px] text-gray-400">{task.tags.join(', ')}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className={cn('shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded capitalize', PRIORITY_COLORS[task.priority])}>
                                        {task.priority}
                                    </span>
                                    {task.dueDate && (
                                        <span className="shrink-0 text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDate(task.dueDate)}
                                        </span>
                                    )}
                                    {task.assigneeName && (
                                        <span className="shrink-0 text-xs text-gray-500 truncate max-w-[120px]">{task.assigneeName}</span>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="flex gap-4 min-w-max pb-4">
                                {stages.map(stage => {
                                    const stageTasks = groupedTasks[stage.id] || [];
                                    return (
                                        <div key={stage.id} className="w-72 shrink-0">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                                    <span className="text-xs font-semibold text-gray-700">{stage.label}</span>
                                                </div>
                                                <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                                    {stageTasks.length}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {stageTasks.map(task => (
                                                    <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
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
                                                            {task.assigneeName && <span className="ml-auto">{task.assigneeName}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {stageTasks.length === 0 && (
                                                    <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center">
                                                        <p className="text-xs text-gray-400">No tasks</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Backlog if not in stages */}
                                {(groupedTasks['backlog'] || []).length > 0 && (
                                    <div className="w-72 shrink-0">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                <span className="text-xs font-semibold text-gray-700">Backlog</span>
                                            </div>
                                            <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                                {(groupedTasks['backlog'] || []).length}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {(groupedTasks['backlog'] || []).map(task => (
                                                <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                                                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded capitalize', PRIORITY_COLORS[task.priority])}>
                                                            {task.priority}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'documents' && (
                <DocumentTreeView
                    node={documentsTree}
                    total={documentsTotal}
                    onRefresh={fetchDocuments}
                />
            )}

            {activeTab === 'team' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">Total members: <span className="font-medium text-gray-900">{(pkg.teamMembers || []).length}</span></p>
                    </div>

                    {(pkg.teamMembers || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20">
                            <Users className="h-10 w-10 text-gray-300 mb-3" />
                            <p className="text-sm font-medium text-gray-700">No team members</p>
                            <p className="text-xs text-gray-400 mt-1">This package has no assigned members yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {(pkg.teamMembers || []).map(member => (
                                <div key={member.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                                    {member.avatarUrl ? (
                                        <img src={member.avatarUrl} alt={member.name}
                                            className="w-10 h-10 rounded-full object-cover shrink-0"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                                            style={{ backgroundColor: member.color }}
                                        >
                                            {member.avatar}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                        <span className="mt-0.5 inline-block text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded capitalize">{member.role}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Document Tree View ──────────────────────────────────────────────────────────
interface TreeNodeProps {
    node: DocumentTreeNode;
    depth?: number;
}

function TreeNode({ node, depth = 0 }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(false);

    if (node.type === 'file') {
        return (
            <div className={cn('flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 group', depth > 0 && 'ml-5')}>
                <File className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{node.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        {node.size && <span>{node.size}</span>}
                        {node.versionLabel && <span className="px-1 py-0.5 bg-blue-50 text-blue-600 rounded">{node.versionLabel}</span>}
                        {node.versionCount && node.versionCount > 1 && (
                            <span className="text-gray-400">{node.versionCount} versions</span>
                        )}
                        {node.updatedAt && (
                            <span>{formatDate(node.updatedAt)}</span>
                        )}
                    </div>
                </div>
                <a
                    href={node.s3Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-gray-100"
                    title="Download"
                    onClick={e => e.stopPropagation()}
                >
                    <FileText className="h-4 w-4 text-gray-400" />
                </a>
            </div>
        );
    }

    const hasChildren = node.children && node.children.length > 0;

    return (
        <div>
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn('w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-left', depth > 0 && 'ml-5')}
            >
                <ChevronRight className={cn('h-4 w-4 text-gray-400 shrink-0 transition-transform', expanded && 'rotate-90')} />
                <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
                <span className="text-sm font-medium text-gray-900 flex-1">{node.name}</span>
                {hasChildren && (
                    <span className="text-xs text-gray-400">{node.children!.length}</span>
                )}
            </button>
            {expanded && hasChildren && (
                <div className="mt-1">
                    {node.children!.map(child => (
                        <TreeNode key={child.id} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

interface DocumentTreeViewProps {
    node: DocumentTreeNode | null;
    total: number;
    onRefresh: () => void;
}

function DocumentTreeView({ node, total, onRefresh }: DocumentTreeViewProps) {
    const [loading, setLoading] = useState(false);

    const handleRefresh = async () => {
        setLoading(true);
        await onRefresh();
        setLoading(false);
    };

    if (!node) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20">
                <Loader2 className="h-8 w-8 text-gray-300 mb-3 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Loading documents...</p>
            </div>
        );
    }

    const hasFiles = node.children && node.children.some(c => c.type === 'file');
    const hasFolders = node.children && node.children.some(c => c.type === 'folder');

    if (!hasFiles && !hasFolders) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20">
                <FileText className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">No documents</p>
                <p className="text-xs text-gray-400 mt-1">Documents uploaded to this package will appear here.</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
                    <p className="text-xs text-gray-500">{total} file{total !== 1 ? 's' : ''} total</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    title="Refresh"
                >
                    <svg className={cn('h-4 w-4 text-gray-500', loading && 'animate-spin')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
            <div className="p-3 max-h-[500px] overflow-y-auto">
                {node.children && node.children.map(child => (
                    <TreeNode key={child.id} node={child} />
                ))}
            </div>
        </div>
    );
}
