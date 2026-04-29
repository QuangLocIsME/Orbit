'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
    Copy, Check, Link2, Loader2, Trash2, ExternalLink,
    Lock, Eye, Users, Plus, Search, X
} from 'lucide-react';

interface PackageItem {
    publicId: string;
    name: string;
    status: string;
}

interface ShareLink {
    id: string;
    shareUrl: string;
    shareType: string;
    packageIds: string[];
    teamIds: string[];
    label: string;
    allowedRoles: string[];
    allowedPages: string[];
    allowedTeamIds: string[];
    createdAt: string;
    expiresAt: string;
}

const ALL_PAGES = [
    { value: 'overview', label: 'Overview' },
    { value: 'documents', label: 'Documents' },
    { value: 'versions', label: 'Versions' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'changes', label: 'Changes' },
    { value: 'clashes', label: 'Clashes' },
];

type ShareScope = 'project' | 'packages';
type AccessRole = 'guest' | 'viewer' | 'member';

interface ShareDialogProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    projectSlug: string;
    currentPackageId?: string;
    projectRole?: 'owner' | 'admin' | 'member' | 'viewer';
}

type EditMode = 'link' | 'new' | 'existing';

const SCOPE_LABELS: Record<ShareScope, { title: string; desc: string }> = {
    project: { title: 'Entire Project', desc: 'Share all packages and pages' },
    packages: { title: 'Specific Packages', desc: 'Choose which packages to share' },
};

const ROLE_OPTIONS: { value: AccessRole; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'guest', label: 'Guest (view-only)', desc: 'Can only view shared pages', icon: <Lock className="h-4 w-4" /> },
    { value: 'viewer', label: 'Viewer', desc: 'Can view all shared pages', icon: <Eye className="h-4 w-4" /> },
    { value: 'member', label: 'Member', desc: 'Broader access to shared content', icon: <Users className="h-4 w-4" /> },
];

export default function ShareDialog({ isOpen, onClose, projectId, projectSlug, currentPackageId, projectRole }: ShareDialogProps) {
    const [editMode, setEditMode] = useState<EditMode>('link');
    const [packages, setPackages] = useState<PackageItem[]>([]);
    const [existingLinks, setExistingLinks] = useState<ShareLink[]>([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    const [loadingLinks, setLoadingLinks] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [pkgSearch, setPkgSearch] = useState('');

    const [scope, setScope] = useState<ShareScope>('project');
    const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
    const [selectedPages, setSelectedPages] = useState<string[]>(['overview', 'documents']);
    const [accessRole, setAccessRole] = useState<AccessRole>('guest');
    const [linkLabel, setLinkLabel] = useState('');
    const [editingLink, setEditingLink] = useState<ShareLink | null>(null);

    const isAdmin = projectRole === 'owner' || projectRole === 'admin';

    const filteredPackages = useMemo(() => {
        if (!pkgSearch.trim()) return packages;
        const q = pkgSearch.toLowerCase();
        return packages.filter(p => p.name.toLowerCase().includes(q));
    }, [packages, pkgSearch]);

    const fetchPackages = useCallback(async () => {
        if (!projectId) return;
        setLoadingPackages(true);
        try {
            const res = await apiFetch('/api/projects/packages/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, listType: 'all' }),
            });
            const data = await res.json();
            if (data.success) {
                setPackages(Array.isArray(data.data) ? data.data : []);
            }
        } catch {
            toast.error('Failed to load packages');
        } finally {
            setLoadingPackages(false);
        }
    }, [projectId]);

    const fetchLinks = useCallback(async () => {
        if (!projectId) return;
        setLoadingLinks(true);
        try {
            const res = await apiFetch(`/api/share/get?projectId=${encodeURIComponent(projectId)}`);
            const data = await res.json();
            if (data.success) {
                setExistingLinks(Array.isArray(data.data) ? data.data : []);
            }
        } catch {
        } finally {
            setLoadingLinks(false);
        }
    }, [projectId]);

    const syncRef = useRef<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            syncRef.current = null;
            fetchPackages();
            fetchLinks();
        }
    }, [isOpen, fetchPackages, fetchLinks]);

    useEffect(() => {
        if (packages.length > 0 && editingLink && syncRef.current !== editingLink.id) {
            const validPkgIds = (editingLink.packageIds || []).filter(id =>
                packages.some(p => p.publicId === id)
            );
            if (validPkgIds.length > 0) {
                setSelectedPackages(new Set(validPkgIds));
            }
            syncRef.current = editingLink.id;
        }
    }, [packages, editingLink]);

    const resetForm = () => {
        setScope('project');
        setSelectedPackages(new Set());
        setSelectedPages(['overview', 'documents']);
        setAccessRole('guest');
        setLinkLabel('');
        setEditingLink(null);
        setPkgSearch('');
        syncRef.current = null;
    };

    const openNewLink = () => {
        resetForm();
        if (currentPackageId) {
            setScope('packages');
            setSelectedPackages(new Set([currentPackageId]));
        }
        setEditMode('new');
    };

    const openEditLink = (link: ShareLink) => {
        setEditingLink(link);
        setLinkLabel(link.label || '');
        setAccessRole((link.allowedRoles?.[0] as AccessRole) || 'guest');
        setSelectedPackages(new Set(link.packageIds || []));

        if (link.packageIds && link.packageIds.length > 0) {
            setScope('packages');
            setSelectedPages(link.allowedPages?.length ? link.allowedPages : ['overview', 'documents']);
        } else {
            setScope('project');
            setSelectedPages(link.allowedPages?.length ? link.allowedPages : ['overview', 'documents']);
        }
        setEditMode('existing');
    };

    const closeEdit = () => {
        resetForm();
        setEditMode('link');
    };

    const togglePackage = (id: string) => {
        setSelectedPackages(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllPackages = () => {
        setSelectedPackages(new Set(packages.map(p => p.publicId)));
    };

    const togglePage = (page: string) => {
        setSelectedPages(prev => {
            if (prev.includes(page)) return prev.filter(p => p !== page);
            return [...prev, page];
        });
    };

    const handleSaveLink = async () => {
        if (!isAdmin) return;
        if (selectedPages.length === 0) {
            toast.error('Please select at least one page');
            return;
        }

        setIsSaving(true);
        try {
            if (editMode === 'existing' && editingLink) {
                const pkgIds = Array.from(selectedPackages);
                const shareType = pkgIds.length > 0 ? 'packages' : 'project';
                const finalPkgIds = pkgIds.length > 0 ? pkgIds : [];

                const res = await apiFetch('/api/share/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shareId: editingLink.id,
                        projectId,
                        shareType,
                        packageIds: finalPkgIds,
                        label: linkLabel,
                        allowedRoles: [accessRole],
                        allowedPages: selectedPages,
                    }),
                });
                const data = await res.json();
                if (data.success && data.data) {
                    setExistingLinks(prev => prev.map(l => l.id === editingLink.id ? data.data : l));
                    toast.success('Link updated');
                    closeEdit();
                } else {
                    toast.error(data.message || 'Failed to update link');
                }
            } else {
                const pkgIds = Array.from(selectedPackages);
                const shareType = pkgIds.length > 0 ? 'packages' : 'project';
                const finalPkgIds = pkgIds.length > 0 ? pkgIds : [];

                const res = await apiFetch('/api/share/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        shareType,
                        packageIds: finalPkgIds,
                        label: linkLabel,
                        allowedRoles: [accessRole],
                        allowedPages: selectedPages,
                    }),
                });
                const data = await res.json();
                if (data.success && data.data) {
                    setExistingLinks(prev => [data.data, ...prev]);
                    toast.success('Share link created');
                    closeEdit();
                } else {
                    toast.error(data.message || 'Failed to create link');
                }
            }
        } catch {
            toast.error('Failed to save share link');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteLink = async (shareId: string) => {
        if (!isAdmin) return;
        try {
            const res = await apiFetch('/api/share/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareId, projectId }),
            });
            const data = await res.json();
            if (data.success) {
                setExistingLinks(prev => prev.filter(l => l.id !== shareId));
                toast.success('Link removed');
            } else {
                toast.error(data.message || 'Failed to remove link');
            }
        } catch {
            toast.error('Failed to remove share link');
        }
    };

    const handleCopy = (linkId: string, url: string) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopiedId(linkId);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (closeEdit(), onClose())}>
            <DialogContent className="max-w-md flex flex-col max-h-[85vh]">
                <DialogHeader className="shrink-0">
                    <div className="flex items-center gap-2">
                        <Link2 className="h-5 w-5 text-blue-600" />
                        <DialogTitle>
                            {editMode === 'link' ? 'Share' : editMode === 'existing' ? 'Edit link' : 'Create link'}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="sr-only">Share project with a link</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {editMode === 'link' ? (
                        <div className="space-y-3">
                            {loadingLinks ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                                </div>
                            ) : existingLinks.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Link2 className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-700 mb-1">No share links yet</p>
                                    <p className="text-xs text-gray-400">Create a link to share your project.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {existingLinks.map(link => (
                                        <div
                                            key={link.id}
                                            onClick={() => isAdmin && openEditLink(link)}
                                            className={cn(
                                                'group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                                                editingLink?.id === link.id
                                                    ? 'border-blue-400 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                                                !isAdmin && 'cursor-default'
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {link.label || `${link.shareType} link`}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                    {link.packageIds && link.packageIds.length > 0 ? (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
                                                            {link.packageIds.length} pkg{link.packageIds.length > 1 ? 's' : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                                            Project
                                                        </span>
                                                    )}
                                                    {link.allowedPages.map(p => (
                                                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                                            {ALL_PAGES.find(x => x.value === p)?.label || p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleCopy(link.id, link.shareUrl); }}
                                                    className={cn(
                                                        'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                                                        copiedId === link.id
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    )}
                                                >
                                                    {copiedId === link.id ? (
                                                        <><Check className="h-3 w-3" /> Copied</>
                                                    ) : (
                                                        <><Copy className="h-3 w-3" /> Copy</>
                                                    )}
                                                </button>
                                                <a
                                                    href={link.shareUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center justify-center h-7 w-7 rounded text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                                {isAdmin && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }}
                                                        className="flex items-center justify-center h-7 w-7 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isAdmin && (
                                <button
                                    onClick={openNewLink}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create new share link
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5 py-1">

                            {/* Scope selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">What to share</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.keys(SCOPE_LABELS) as ShareScope[]).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => {
                                                setScope(s);
                                                if (s === 'project') setSelectedPackages(new Set());
                                            }}
                                            className={cn(
                                                'flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-all',
                                                scope === s
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                            )}
                                        >
                                            <span className={cn('text-sm font-semibold', scope === s ? 'text-blue-700' : 'text-gray-700')}>
                                                {SCOPE_LABELS[s].title}
                                            </span>
                                            <span className={cn('text-[11px]', scope === s ? 'text-blue-500' : 'text-gray-400')}>
                                                {SCOPE_LABELS[s].desc}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Package selector (only when scope is packages) */}
                            {scope === 'packages' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Packages
                                            {selectedPackages.size > 0 && (
                                                <span className="ml-1.5 text-xs text-blue-600 font-normal">
                                                    ({selectedPackages.size} selected)
                                                </span>
                                            )}
                                        </label>
                                        {packages.length > 1 && (
                                            <button
                                                onClick={selectAllPackages}
                                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                Select all
                                            </button>
                                        )}
                                    </div>

                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={pkgSearch}
                                            onChange={(e) => setPkgSearch(e.target.value)}
                                            placeholder="Search packages..."
                                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                                        />
                                        {pkgSearch && (
                                            <button
                                                onClick={() => setPkgSearch('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {loadingPackages ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                        </div>
                                    ) : filteredPackages.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-3">
                                            {pkgSearch ? 'No packages match your search' : 'No packages available'}
                                        </p>
                                    ) : (
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                                            {filteredPackages.map(pkg => (
                                                <label
                                                    key={pkg.publicId}
                                                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className={cn(
                                                        'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                                        selectedPackages.has(pkg.publicId)
                                                            ? 'bg-blue-500 border-blue-500'
                                                            : 'border-gray-300'
                                                    )}>
                                                        {selectedPackages.has(pkg.publicId) && (
                                                            <Check className="h-3 w-3 text-white" />
                                                        )}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPackages.has(pkg.publicId)}
                                                        onChange={() => togglePackage(pkg.publicId)}
                                                        className="sr-only"
                                                    />
                                                    <span className="text-sm text-gray-700 truncate">{pkg.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick select chips */}
                                    {packages.length > 3 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {packages.slice(0, 8).map(pkg => (
                                                <button
                                                    key={pkg.publicId}
                                                    onClick={() => togglePackage(pkg.publicId)}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all',
                                                        selectedPackages.has(pkg.publicId)
                                                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                                    )}
                                                >
                                                    {selectedPackages.has(pkg.publicId) && <Check className="h-2.5 w-2.5" />}
                                                    {pkg.name.length > 15 ? pkg.name.slice(0, 15) + '…' : pkg.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Pages */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">Allowed pages</label>
                                    <button
                                        onClick={() => {
                                            if (selectedPages.length === ALL_PAGES.length) {
                                                setSelectedPages([]);
                                            } else {
                                                setSelectedPages(ALL_PAGES.map(p => p.value));
                                            }
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        {selectedPages.length === ALL_PAGES.length ? 'Deselect all' : 'Select all'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {ALL_PAGES.map(page => (
                                        <button
                                            key={page.value}
                                            onClick={() => togglePage(page.value)}
                                            className={cn(
                                                'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left',
                                                selectedPages.includes(page.value)
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                            )}
                                        >
                                            <div className={cn(
                                                'h-4 w-4 rounded flex items-center justify-center shrink-0',
                                                selectedPages.includes(page.value) ? 'bg-blue-500' : 'bg-gray-200'
                                            )}>
                                                {selectedPages.includes(page.value) && <Check className="h-2.5 w-2.5 text-white" />}
                                            </div>
                                            {page.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Access */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Access permission</label>
                                <div className="space-y-1.5">
                                    {ROLE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setAccessRole(opt.value)}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 transition-all text-left',
                                                accessRole === opt.value
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                            )}
                                        >
                                            <div className={cn(
                                                'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                                                accessRole === opt.value ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                                            )}>
                                                {opt.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn('text-sm font-semibold', accessRole === opt.value ? 'text-blue-700' : 'text-gray-700')}>
                                                    {opt.label}
                                                </p>
                                                <p className="text-[11px] text-gray-400">{opt.desc}</p>
                                            </div>
                                            {accessRole === opt.value && (
                                                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                                    <Check className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Link name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Link name</label>
                                <input
                                    type="text"
                                    value={linkLabel}
                                    onChange={(e) => setLinkLabel(e.target.value)}
                                    placeholder="e.g. Client review link"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                                />
                            </div>

                        </div>
                    )}
                </div>

                <DialogFooter className="shrink-0 pt-3 border-t">
                    {editMode !== 'link' ? (
                        <>
                            <button onClick={closeEdit} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveLink}
                                disabled={isSaving || selectedPages.length === 0}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                {editMode === 'existing' ? 'Save changes' : 'Copy link'}
                            </button>
                        </>
                    ) : isAdmin ? (
                        <button
                            onClick={openNewLink}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Link2 className="h-4 w-4" />
                            Create link
                        </button>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
