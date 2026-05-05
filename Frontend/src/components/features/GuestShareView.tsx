'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import {
    Eye, Package, CheckCircle, Clock, Users,
    Loader2, Shield, LogIn, Lock, ChevronRight, FileText, Plus
} from 'lucide-react';

interface ResolvedShare {
    projectId: string;
    packageIds: string[];
    shareType: string;
    shareUrl: string;
    label: string;
    allowedRoles: string[];
    allowedPages: string[];
    allowedTeamIds: string[];
    role: string;
}

interface ProjectInfo {
    publicId: string;
    name: string;
    description: string;
    coverImageUrl?: string | null;
}

interface PackageView {
    publicId: string;
    name: string;
    status: string;
    tasksCount?: number;
    teamCount?: number;
    completedTasks?: number;
}

interface GuestShareViewProps {
    token?: string;
}

const statusColor: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    active: 'bg-blue-100 text-blue-700',
    draft: 'bg-gray-100 text-gray-600',
    archived: 'bg-amber-100 text-amber-700',
};

export default function GuestShareView({ token: initialToken }: GuestShareViewProps) {
    const [token, setToken] = useState<string>(initialToken || '');
    const [resolvedShare, setResolvedShare] = useState<ResolvedShare | null>(null);
    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [packages, setPackages] = useState<PackageView[]>([]);
    const [packageTaskCounts, setPackageTaskCounts] = useState<Record<string, { total: number; completed: number }>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [joinMessage, setJoinMessage] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [joinSuccess, setJoinSuccess] = useState(false);
    const [authUser, setAuthUser] = useState<{ id: string } | null>(null);
    const [authChecked, setAuthChecked] = useState(false);

    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data.success) setAuthUser(data.user);
            }
        } catch { /* silent */ }
        finally { setAuthChecked(true); }
    }, []);

    useEffect(() => { checkAuth(); }, [checkAuth]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const pathParts = window.location.pathname.split('/');
            const shareIndex = pathParts.indexOf('share');
            if (shareIndex !== -1 && pathParts[shareIndex + 1]) {
                setToken(pathParts[shareIndex + 1]);
            }
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        const resolveShare = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/guest/share/resolve/${encodeURIComponent(token)}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setResolvedShare(data.data);
                } else {
                    setError(data.message || 'Share link is invalid or has expired.');
                }
            } catch {
                setError('Failed to load share link. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        resolveShare();
    }, [token]);

    useEffect(() => {
        if (!resolvedShare) return;

        const guestData = {
            projectId: resolvedShare.projectId,
            packageIds: resolvedShare.packageIds,
            shareType: resolvedShare.shareType,
            allowedPages: resolvedShare.allowedPages,
            allowedRoles: resolvedShare.allowedRoles,
            isGuest: true,
            token,
        };
        try { sessionStorage.setItem('orbit_guest_access', JSON.stringify(guestData)); } catch { /* ignore */ }

        const fetchProjectInfo = async () => {
            try {
                const res = await fetch(`/api/guest/project/${encodeURIComponent(resolvedShare.projectId)}?token=${encodeURIComponent(token)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) setProjectInfo(data.data);
                }
            } catch { /* silent */ }
        };

        const fetchPackages = async () => {
            try {
                const res = await fetch(`/api/guest/packages/${encodeURIComponent(resolvedShare.projectId)}?token=${encodeURIComponent(token)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setPackages(Array.isArray(data.data) ? data.data : []);
                    }
                }
            } catch { /* silent */ }
        };

        const fetchTaskCounts = async () => {
            try {
                const res = await fetch(`/api/guest/tasks/${encodeURIComponent(resolvedShare.projectId)}?token=${encodeURIComponent(token)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.data)) {
                        const counts: Record<string, { total: number; completed: number }> = {};
                        data.data.forEach((task: any) => {
                            const pkgId = task.packageId;
                            if (pkgId) {
                                if (!counts[pkgId]) counts[pkgId] = { total: 0, completed: 0 };
                                counts[pkgId].total++;
                                if (['done', 'completed', 'approved'].includes(String(task.status || '').toLowerCase())) {
                                    counts[pkgId].completed++;
                                }
                            }
                        });
                        setPackageTaskCounts(counts);
                    }
                }
            } catch { /* silent */ }
        };

        fetchProjectInfo();
        fetchPackages();
        fetchTaskCounts();
    }, [resolvedShare, token]);

    useEffect(() => {
        if (!resolvedShare || !authChecked) return;
        if (!authUser) return;

        const checkPending = async () => {
            try {
                const res = await apiFetch(`/api/projects/join/list?projectId=${encodeURIComponent(resolvedShare.projectId)}`);
                const data = await res.json();
                if (data.success) {
                    const pending = data.data?.find(
                        (r: { requestedBy: string; status: string }) =>
                            r.requestedBy === authUser.id && r.status === 'pending'
                    );
                    setHasPendingRequest(!!pending);
                }
            } catch { /* silent */ }
        };

        checkPending();
    }, [resolvedShare, authUser, authChecked]);

    const handleJoinRequest = async () => {
        if (!authUser || !resolvedShare) {
            toast.error('Please log in to request to join');
            window.location.href = '/login';
            return;
        }
        setIsJoining(true);
        try {
            const res = await apiFetch('/api/projects/join/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: resolvedShare.projectId, message: joinMessage }),
            });
            const data = await res.json();
            if (data.success) {
                setJoinSuccess(true);
                setHasPendingRequest(true);
                toast.success('Join request sent successfully!');
            } else {
                toast.error(data.message || 'Failed to send join request');
            }
        } catch {
            toast.error('Failed to send join request');
        } finally {
            setIsJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading shared content...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Share Link Unavailable</h1>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                    <a href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        Go to Homepage
                    </a>
                </div>
            </div>
        );
    }

    if (!resolvedShare) return null;

    const isPackagesShare = resolvedShare.shareType === 'packages' && resolvedShare.packageIds.length > 0;
    const shareablePackageIds = new Set(resolvedShare.packageIds);
    const visiblePackages = isPackagesShare
        ? packages.filter(p => shareablePackageIds.has(p.publicId))
        : packages;

    const getStatusClass = (status: string) => {
        const s = String(status || '').toLowerCase();
        return statusColor[s] || 'bg-gray-100 text-gray-600';
    };

    return (
        <div className="min-h-screen bg-[#F2F4F7]">
            {/* ── Header ── */}
            <div className="bg-white border-b border-gray-200">
                {/* Cover */}
                {projectInfo?.coverImageUrl && (
                    <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <img src={projectInfo.coverImageUrl} alt="" className="w-full h-full object-cover opacity-80" />
                    </div>
                )}

                <div className="max-w-6xl mx-auto px-6 lg:px-16 py-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            {/* Back + breadcrumb */}
                            <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                                <a href="/" className="hover:text-gray-600 transition-colors">Home</a>
                                <ChevronRight className="h-3 w-3" />
                                <span className="text-gray-500">Shared with you</span>
                            </div>

                            {/* Project name */}
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                    <Package className="h-5 w-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-bold text-gray-900 truncate">
                                        {projectInfo?.name || 'Shared Project'}
                                    </h1>
                                    {projectInfo?.description && (
                                        <p className="text-sm text-gray-500 line-clamp-1">{projectInfo.description}</p>
                                    )}
                                </div>
                            </div>

                            {/* Meta */}
                            <div className="flex items-center gap-3 mt-3">
                                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    {visiblePackages.length} shared package{visiblePackages.length !== 1 ? 's' : ''}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                    <Shield className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="text-amber-700 font-medium capitalize">{resolvedShare.role}</span>
                                    <span className="text-gray-400">— view only</span>
                                </span>
                            </div>
                        </div>

                        {/* Auth status */}
                        <div className="flex items-center gap-2 shrink-0">
                            {authUser ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full">
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-xs font-medium text-emerald-700">Logged in</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full">
                                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="text-xs font-medium text-gray-600">Not logged in</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="max-w-6xl mx-auto px-6 lg:px-16 py-8">
                <div className="flex gap-8">
                    {/* Main content */}
                    <div className="flex-1 min-w-0">

                        {/* ── Packages Grid (similar to project detail) ── */}
                        {visiblePackages.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-semibold text-gray-900">
                                        {isPackagesShare ? 'Shared Packages' : 'Project Packages'}
                                    </h2>
                                    <span className="text-xs text-gray-400">Click a package to view details</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {visiblePackages.map(pkg => {
                                        const counts = packageTaskCounts[pkg.publicId] || { total: 0, completed: 0 };
                                        const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

                                        return (
                                            <a
                                                key={pkg.publicId}
                                                href={`/${resolvedShare.projectId}/${pkg.publicId}?guest=1&token=${encodeURIComponent(token)}`}
                                                className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
                                            >
                                                {/* Package icon + name */}
                                                <div className="flex items-start gap-3 mb-4">
                                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                                        <Package className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                                                            {pkg.name}
                                                        </h3>
                                                        <span className={cn(
                                                            'mt-1 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full capitalize',
                                                            getStatusClass(pkg.status)
                                                        )}>
                                                            {pkg.status || 'Active'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Stats row */}
                                                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                                    <span className="inline-flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3" />
                                                        {counts.completed}/{counts.total} tasks
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <FileText className="h-3 w-3" />
                                                        View details
                                                    </span>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full transition-all"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <div className="mt-1 text-[10px] text-gray-400 text-right">{progress}% complete</div>
                                            </a>
                                        );
                                    })}
                                </div>

                                {/* Click instruction */}
                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                    <Eye className="h-3.5 w-3.5" />
                                    Click any package card above to view its details — tasks, documents, and more.
                                </div>
                            </div>
                        )}

                        {/* Non-package share: show pages */}
                        {visiblePackages.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <h2 className="text-base font-semibold text-gray-900 mb-4">Shared Content</h2>
                                <p className="text-sm text-gray-500">
                                    You have been granted view access to this project. Contact the project owner to request full member access.
                                </p>
                            </div>
                        )}

                        {/* Guest notice */}
                        <div className="flex items-start gap-2 mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <Shield className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">
                                <span className="font-medium">Guest Access: </span>
                                You have view-only access. You cannot create, edit, or delete content. Request to join the project for full access.
                            </p>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="w-72 shrink-0 space-y-4">
                        {/* Access level */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Access Level</h3>
                            <div className="space-y-2">
                                {resolvedShare.allowedRoles.map(role => (
                                    <div key={role} className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                                            <Shield className="h-3.5 w-3.5 text-amber-600" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 capitalize">{role}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <Eye className="h-3.5 w-3.5" />
                                    View-only access via share link
                                </div>
                            </div>
                        </div>

                        {/* Join request */}
                        {!authUser ? (
                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Want full access?</h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    Log in or create an account to request to join this project as a member.
                                </p>
                                <a
                                    href={`/login?redirect=/share/${token}`}
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Log in to Request Access
                                </a>
                            </div>
                        ) : joinSuccess || hasPendingRequest ? (
                            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                                    <h3 className="text-sm font-semibold text-emerald-900">Request Sent</h3>
                                </div>
                                <p className="text-xs text-emerald-700">
                                    Your request to join this project has been submitted. The project owner will review it.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Request to Join Project</h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    Send a request to become a project member with full access.
                                </p>
                                <textarea
                                    value={joinMessage}
                                    onChange={(e) => setJoinMessage(e.target.value)}
                                    placeholder="Add a message (optional)..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
                                />
                                <button
                                    onClick={handleJoinRequest}
                                    disabled={isJoining}
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isJoining ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                    Send Join Request
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
