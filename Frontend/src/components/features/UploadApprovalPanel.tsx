'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { getSocket, joinProject, leaveProject } from '@/lib/socket';
import { getProjectTabCache, mergeProjectTabCache } from '@/stores/projectDetailCacheStore';
import {
  CheckCircle, XCircle, Clock, FileText, Image as ImageIcon,
  Download, Eye, ChevronDown, ChevronUp, Loader2,
  AlertCircle, Box, Plus
} from 'lucide-react';
import { CommentSection } from './TaskFormShared';
import XktViewerDialog from './XktViewerDialog';

interface ApprovalUploader {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface ApprovalItem {
  publicId: string;
  documentId: string;
  jobId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  folderType: string;
  folderPath: string;
  versionGroupId: string | null;
  versionNumber: number;
  versionLabel: string;
  versionDescription: string;
  isNewVersion: boolean;
  status: 'pending' | 'approved' | 'rejected';
  fileUrl: string;
  s3Key: string;
  supabaseFileKey: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string;
  approvedAt: string | null;
  uploader: ApprovalUploader | null;
  conversionStatus: string | null;
  createdAt: string;
  updatedAt: string;
  packageId: string | null;
  packageName: string | null;
}

interface UploadApprovalPanelProps {
  projectId: string;
  projectRole?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return ImageIcon;
  return FileText;
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ name, avatar, size = 'sm' }: { name: string; avatar: string | null; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]';
  if (avatar) {
    return <img src={avatar} alt={name} className={`${sizeClass} rounded-full object-cover`} />;
  }
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <div className={`${sizeClass} rounded-full ${getAvatarColor(name)} flex items-center justify-center font-semibold text-white`}>
      {initial}
    </div>
  );
}

function isIfcFile(mimeType: string, fileName: string): boolean {
  return mimeType?.includes('ifc') || /\.(ifc|rvt|dwg)$/i.test(fileName);
}

function ConversionStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === 'READY') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#ECFDF5] text-[#007A55] font-medium">
        <CheckCircle className="h-3 w-3" />
        Ready to View
      </span>
    );
  }
  if (status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#EEF2FF] text-[#4F39F6] font-medium">
        <Loader2 className="h-3 w-3 animate-spin" />
        Converting to XKT...
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#FEE2E2] text-[#DC2626] font-medium">
        <AlertCircle className="h-3 w-3" />
        Conversion Failed
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#FEF3C7] text-[#B45309] font-medium">
        <Clock className="h-3 w-3" />
        Queued for conversion
      </span>
    );
  }
  return null;
}

function ApprovalStatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#FEF3C7] text-[#B45309] font-medium">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#ECFDF5] text-[#007A55] font-medium">
        <CheckCircle className="h-3 w-3" />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#FEE2E2] text-[#DC2626] font-medium">
      <XCircle className="h-3 w-3" />
      Rejected
    </span>
  );
}

function CrVersionStatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#FEF3C7] text-[#B45309] font-medium">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#ECFDF5] text-[#007A55] font-medium">
        <CheckCircle className="h-3 w-3" />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[#FEE2E2] text-[#DC2626] font-medium">
      <XCircle className="h-3 w-3" />
      Rejected
    </span>
  );
}

interface ChangeRequest {
  publicId: string;
  crId: string;
  title: string;
  status: string;
  priority: string;
  description: string;
}

export default function UploadApprovalPanel({ projectId, projectRole }: UploadApprovalPanelProps) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [crVersions, setCrVersions] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCrVersions, setLoadingCrVersions] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ id: string; reason: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string>('');
  const [previewTextFileName, setPreviewTextFileName] = useState<string>('');
  const [isLoadingTextPreview, setIsLoadingTextPreview] = useState(false);
  const [xktViewerState, setXktViewerState] = useState<{
    projectId: string;
    fileId: string;
    versionId: string;
    fileName: string;
  } | null>(null);

  // Create version modal state
  const [createVersionModal, setCreateVersionModal] = useState(false);
  const [createVersionCrId, setCreateVersionCrId] = useState('');
  const [createVersionLabel, setCreateVersionLabel] = useState('');
  const [createVersionSubmitting, setCreateVersionSubmitting] = useState(false);

  // CR version action state
  const [crVersionActionLoading, setCrVersionActionLoading] = useState<string | null>(null);
  const [crVersionRejectReason, setCrVersionRejectReason] = useState<{ id: string; reason: string } | null>(null);

  // CR version file conversion status: Record<sourceDocumentId, conversionStatus>
  const [crFileConversionStatus, setCrFileConversionStatus] = useState<Record<string, string>>({});

  const fetchCrFileConversionStatus = async (documentId: string, fileName?: string): Promise<{ fileId: string; status: string } | null> => {
    const cacheKey = documentId || fileName || '';
    if (cacheKey && crFileConversionStatus[cacheKey]) return { fileId: cacheKey, status: crFileConversionStatus[cacheKey] };
    try {
      const res = await apiFetch('/api/projects/packages/documents/view-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fileId: documentId || '',
          versionId: documentId || '',
          fileName: fileName || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        const resolvedFileId = data.data.fileId || cacheKey;
        const resolvedStatus = data.data.status || 'NOT_SUPPORTED';
        setCrFileConversionStatus(prev => ({ ...prev, [resolvedFileId]: resolvedStatus }));
        return { fileId: resolvedFileId, status: resolvedStatus };
      }
    } catch { /* silent */ }
    return null;
  };

  const retryConversion = async (fileId: string, fileName: string, onStatusUpdate: (status: string) => void) => {
    toast.loading('Re-queuing conversion...', { id: `retry-${fileId || fileName}` });
    try {
      const res = await apiFetch('/api/projects/packages/documents/retry-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fileId: fileId || '',
          versionId: fileId || '',
          fileName: fileName || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        onStatusUpdate('PROCESSING');
        toast.success('Conversion re-queued', { id: `retry-${fileId || fileName}` });
      } else {
        toast.error(data.message || 'Failed to re-queue conversion', { id: `retry-${fileId || fileName}` });
      }
    } catch {
      toast.error('Failed to re-queue conversion', { id: `retry-${fileId || fileName}` });
    }
  };

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const canApprove = projectRole === 'owner' || projectRole === 'admin' || projectRole === 'manager';

  const fetchApprovals = async () => {
    try {
      const res = await apiFetch('/api/approvals/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        const raw = data.data.approvals || [];
        const seen = new Set<string>();
        const deduped = raw.filter((a: ApprovalItem) => {
          if (seen.has(a.publicId)) return false;
          seen.add(a.publicId);
          return true;
        });
        setApprovals(deduped);
        mergeProjectTabCache(projectId, 'versions', {
          approvals: deduped,
          crVersions,
          changeRequests,
        });
      }
    } catch { /* silent */ }
  };

  const fetchCrVersions = async () => {
    setLoadingCrVersions(true);
    try {
      const res = await apiFetch(`/api/change-requests/versions/by-project/${projectId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setCrVersions(data.data || []);
        mergeProjectTabCache(projectId, 'versions', {
          approvals,
          crVersions: data.data || [],
          changeRequests,
        });
      }
    } catch { /* silent */ } finally {
      setLoadingCrVersions(false);
    }
  };

  const fetchChangeRequests = async () => {
    try {
      const res = await apiFetch(`/api/projects-by-id/${projectId}/change-requests`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setChangeRequests(data.data || []);
        mergeProjectTabCache(projectId, 'versions', {
          approvals,
          crVersions,
          changeRequests: data.data || [],
        });
      }
    } catch { /* silent */ }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchApprovals(), fetchCrVersions(), fetchChangeRequests()]);
    setLoading(false);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (projectId) {
      const cached = getProjectTabCache<{
        approvals?: ApprovalItem[];
        crVersions?: any[];
        changeRequests?: ChangeRequest[];
      }>(projectId, 'versions');

      if (cached?.data) {
        if (cached.data.approvals) setApprovals(cached.data.approvals);
        if (cached.data.crVersions) setCrVersions(cached.data.crVersions);
        if (cached.data.changeRequests) setChangeRequests(cached.data.changeRequests);
        setLoading(false);
        loadAll().catch(() => {});
        return;
      }

      loadAll();
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();
    joinProject(projectId);
    const handleApprovalNew = () => { fetchApprovals(); };
    const handleApprovalUpdated = () => { fetchApprovals(); };
    const handleApprovalDeleted = () => { fetchApprovals(); };
    const handleApprovalCommentChanged = () => { fetchApprovals(); };
    const handleConversionUpdated = (payload: { projectId: string; documentId: string; versionId: string; conversionStatus?: string; status?: string; conversionError?: string }) => {
      if (payload.projectId !== projectId) return;
      const nextStatus = payload.conversionStatus || payload.status;
      if (!nextStatus) return;
      setApprovals(prev => prev.map(a => (
        a.documentId === payload.documentId || a.documentId === payload.versionId
          ? { ...a, conversionStatus: nextStatus }
          : a
      )));
    };
    socket.on('approval:new', handleApprovalNew);
    socket.on('approval:updated', handleApprovalUpdated);
    socket.on('approval:deleted', handleApprovalDeleted);
    socket.on('approval:comment_added', handleApprovalCommentChanged);
    socket.on('approval:comment_deleted', handleApprovalCommentChanged);
    socket.on('document:conversion-updated', handleConversionUpdated);
    return () => {
      socket.off('approval:new', handleApprovalNew);
      socket.off('approval:updated', handleApprovalUpdated);
      socket.off('approval:deleted', handleApprovalDeleted);
      socket.off('approval:comment_added', handleApprovalCommentChanged);
      socket.off('approval:comment_deleted', handleApprovalCommentChanged);
      socket.off('document:conversion-updated', handleConversionUpdated);
      leaveProject(projectId);
    };
  }, [projectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const handleApprove = async (approval: ApprovalItem) => {
    setActionLoading(approval.publicId);
    try {
      const res = await apiFetch('/api/approvals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: approval.publicId, projectId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Approved: ${approval.originalName}`);
        const isIcf = isIfcFile(approval.mimeType, approval.originalName);
        setApprovals(prev =>
          prev.map(a => a.publicId === approval.publicId ? {
            ...a,
            status: 'approved' as const,
            conversionStatus: isIcf ? (a.conversionStatus || 'PENDING') : a.conversionStatus,
          } : a)
        );
      } else {
        toast.error(data.message || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve upload');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (approval: ApprovalItem) => {
    const reason = rejectReason?.id === approval.publicId ? rejectReason.reason : '';
    setActionLoading(approval.publicId);
    try {
      const res = await apiFetch('/api/approvals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: approval.publicId, projectId, reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Rejected: ${approval.originalName}`);
        setApprovals(prev =>
          prev.map(a => a.publicId === approval.publicId ? { ...a, status: 'rejected' as const } : a)
        );
        setRejectReason(null);
      } else {
        toast.error(data.message || 'Failed to reject');
      }
    } catch {
      toast.error('Failed to reject upload');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateVersion = async () => {
    if (!createVersionCrId) {
      toast.error('Please select a Change Request');
      return;
    }
    setCreateVersionSubmitting(true);
    try {
      const res = await apiFetch(`/api/change-requests/${createVersionCrId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, versionLabel: createVersionLabel.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Version created successfully');
        setCreateVersionModal(false);
        setCreateVersionCrId('');
        setCreateVersionLabel('');
        fetchCrVersions();
      } else {
        toast.error(data.message || 'Failed to create version');
      }
    } catch {
      toast.error('Failed to create version');
    } finally {
      setCreateVersionSubmitting(false);
    }
  };

  const handleApproveCrVersion = async (versionId: string, crId: string) => {
    setCrVersionActionLoading(versionId);
    try {
      const res = await apiFetch(`/api/change-requests/${crId}/versions/${versionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Version approved — files published');
        setCrVersions(prev =>
          prev.map(v => v.publicId === versionId ? { ...v, status: 'approved' } : v)
        );
        fetchApprovals();
      } else {
        toast.error(data.message || 'Failed to approve version');
      }
    } catch {
      toast.error('Failed to approve version');
    } finally {
      setCrVersionActionLoading(null);
    }
  };

  const handleRejectCrVersion = async (versionId: string, crId: string) => {
    const reason = crVersionRejectReason?.id === versionId ? crVersionRejectReason.reason : '';
    setCrVersionActionLoading(versionId);
    try {
      const res = await apiFetch(`/api/change-requests/${crId}/versions/${versionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Version rejected');
        setCrVersions(prev =>
          prev.map(v => v.publicId === versionId ? { ...v, status: 'rejected' } : v)
        );
        setCrVersionRejectReason(null);
      } else {
        toast.error(data.message || 'Failed to reject version');
      }
    } catch {
      toast.error('Failed to reject version');
    } finally {
      setCrVersionActionLoading(null);
    }
  };

  const getCurrentUserId = (): string | null => {
    try {
      const u = localStorage.getItem('orbit_user');
      if (u) return JSON.parse(u).id;
    } catch { /* ignore */ }
    return null;
  };

  const filteredApprovals = approvals
    .filter(a => filter === 'all' || a.status === filter)
    .filter((a, idx, arr) => arr.findIndex(x => x.publicId === a.publicId) === idx);

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  // Build unified list: uploads + CR versions sorted by date
  type UnifiedItem =
    | { type: 'upload'; data: ApprovalItem; sortDate: Date }
    | { type: 'crversion'; data: any; sortDate: Date };

  const uploadItems: UnifiedItem[] = filteredApprovals.map(a => ({
    type: 'upload',
    data: a,
    sortDate: new Date(a.createdAt),
  }));

  const crVersionItems: UnifiedItem[] = crVersions.map(v => ({
    type: 'crversion',
    data: v,
    sortDate: new Date(v.createdAt),
  }));

  const unifiedItems = [...uploadItems, ...crVersionItems].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  const totalPages = Math.max(1, Math.ceil(unifiedItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = unifiedItems.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] font-normal text-[#101828]">Version Control</h2>
        {canApprove && (
          <button
            onClick={() => setCreateVersionModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#155DFC] h-10 px-5 min-w-[150px] text-[13px] font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Version
          </button>
        )}
      </div>

      {/* Stats / Filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          { key: 'all',      label: 'Total',    count: approvals.length,                                              cardStyle: 'bg-[#F3F4F6] text-[#101828]', ringColor: '#101828' },
          { key: 'pending',  label: 'Pending',  count: pendingCount,                                                 cardStyle: 'bg-[#FEF3C7] text-[#CA8A04]', ringColor: '#CA8A04' },
          { key: 'approved', label: 'Approved', count: approvals.filter(a => a.status === 'approved').length,          cardStyle: 'bg-[#ECFDF5] text-[#007A55]', ringColor: '#007A55' },
          { key: 'rejected', label: 'Rejected', count: approvals.filter(a => a.status === 'rejected').length,          cardStyle: 'bg-[#FEE2E2] text-[#DC2626]', ringColor: '#DC2626' },
        ] as const).map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter(s.key)}
            className={cn(
              'rounded-[10px] px-4 py-3 text-left transition-all',
              s.cardStyle,
              filter === s.key ? 'ring-2 ring-offset-1' : 'hover:opacity-90'
            )}
            style={filter === s.key ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${s.ringColor}` } : undefined}
          >
            <p className="text-[28px] leading-[32px]">{loading ? '—' : s.count}</p>
            <p className="text-[14px]">{s.label}</p>
          </button>
        ))}
      </div>

      {/* ── Unified List ────────────────────────────────────────────────── */}
      <div className="rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="h-8 w-8 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : unifiedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] mb-3">
              <svg className="h-7 w-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <p className="text-[14px] font-medium text-[#101828]">
              {filter === 'pending' ? 'No pending uploads' : `No ${filter} uploads`}
            </p>
            <p className="text-[12px] text-[#6A7282] mt-1">
              {filter === 'pending' ? 'All uploads have been reviewed' : 'No uploads match this filter'}
            </p>
          </div>
        ) : (
          paginatedItems.map((item) => {
            if (item.type === 'upload') {
              return <UploadCard key={item.data.publicId} item={item} />;
            } else {
              return <CrVersionCard key={item.data.publicId} item={item} />;
            }
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && unifiedItems.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-[12px] text-[#6A7282]">
            Showing {Math.min((safePage - 1) * ITEMS_PER_PAGE + 1, unifiedItems.length)}–{Math.min(safePage * ITEMS_PER_PAGE, unifiedItems.length)} of {unifiedItems.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-4 w-4 rotate-90" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'flex h-8 min-w-[32px] items-center justify-center rounded-[8px] border px-2 text-[12px] transition-colors',
                  page === safePage
                    ? 'border-[#155DFC] bg-[#155DFC] text-white font-medium'
                    : 'border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-gray-50'
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* XKT 3D Viewer Dialog */}
      {xktViewerState && (
        <XktViewerDialog
          projectId={xktViewerState.projectId}
          fileId={xktViewerState.fileId}
          versionId={xktViewerState.versionId}
          fileName={xktViewerState.fileName}
          onClose={() => setXktViewerState(null)}
        />
      )}

      {/* Text Preview Dialog */}
      {previewTextContent !== '' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setPreviewTextContent(''); setPreviewTextFileName(''); }}>
          <div
            className="relative z-10 flex flex-col w-full max-w-4xl mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EEF2FF]">
                  <svg className="h-4 w-4 text-[#4F39F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-[#101828]">Text Preview</h2>
                  <p className="text-[12px] text-[#6A7282] truncate max-w-[300px]" title={previewTextFileName}>{previewTextFileName}</p>
                </div>
              </div>
              <button
                onClick={() => { setPreviewTextContent(''); setPreviewTextFileName(''); }}
                className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            {isLoadingTextPreview ? (
              <div className="flex items-center justify-center flex-1 py-16">
                <svg className="h-8 w-8 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
            ) : (
              <pre className="flex-1 overflow-auto px-6 py-4 text-[13px] font-mono text-[#374151] bg-[#F9FAFB] whitespace-pre-wrap break-all">
                {previewTextContent}
              </pre>
            )}
            <div className="flex justify-end px-6 py-3 border-t border-[#E5E7EB] shrink-0 bg-white">
              <button
                onClick={() => { setPreviewTextContent(''); setPreviewTextFileName(''); }}
                className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Modal */}
      {createVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setCreateVersionModal(false)}>
          <div
            className="relative z-10 flex flex-col w-full max-w-md mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EEF2FF]">
                  <svg className="h-4 w-4 text-[#4F39F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-[#101828]">Create Version</h2>
                  <p className="text-[12px] text-[#6A7282]">Create a snapshot of a Change Request</p>
                </div>
              </div>
              <button
                onClick={() => setCreateVersionModal(false)}
                className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] text-[#6A7282] font-medium block mb-1.5">Change Request</label>
                <select
                  value={createVersionCrId}
                  onChange={(e) => setCreateVersionCrId(e.target.value)}
                  className="w-full h-[40px] rounded-[10px] border border-[#E5E7EB] px-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] bg-white"
                >
                  <option value="">Select a Change Request...</option>
                  {changeRequests.map(cr => (
                    <option key={cr.publicId} value={cr.publicId}>
                      {cr.crId} — {cr.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[12px] text-[#6A7282] font-medium block mb-1.5">Version Label (optional)</label>
                <input
                  type="text"
                  value={createVersionLabel}
                  onChange={(e) => setCreateVersionLabel(e.target.value)}
                  placeholder="e.g. Final version, Milestone 1"
                  className="w-full h-[40px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] shrink-0">
              <button
                onClick={() => setCreateVersionModal(false)}
                className="px-4 py-2 text-[13px] text-[#6A7282] hover:text-[#101828] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={createVersionSubmitting || !createVersionCrId}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#007A55] px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createVersionSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Upload Card ────────────────────────────────────────────────────────────────
  function UploadCard({ item }: { item: { type: 'upload'; data: ApprovalItem } }) {
    const approval = item.data;
    const FileIcon = getFileIcon(approval.mimeType);
    const isExpanded = expandedId === approval.publicId;
    const isActing = actionLoading === approval.publicId;
    const [commentCount, setCommentCount] = useState(0);

    return (
      <div className="px-6 py-5">
        {/* Top row: icon + info + status + expand */}
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]',
            approval.status === 'pending' ? 'bg-[#EEF2FF]' : approval.status === 'approved' ? 'bg-[#ECFDF5]' : 'bg-[#FEE2E2]'
          )}>
            <FileIcon className={cn('h-5 w-5',
              approval.status === 'pending' ? 'text-[#4F39F6]' : approval.status === 'approved' ? 'text-[#007A55]' : 'text-[#DC2626]'
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#101828] truncate">{approval.originalName}</p>
                <div className="flex items-center gap-2 text-[12px] text-[#6A7282] mt-0.5">
                  <span className="font-mono text-[#155DFC] font-medium">{approval.versionLabel}</span>
                  {approval.isNewVersion && (
                    <span className="rounded px-2 py-0.5 bg-[#EEF2FF] text-[#432DD7] font-medium">New version</span>
                  )}
                  {approval.packageName && (
                    <span className="flex items-center gap-1 rounded px-2 py-0.5 bg-[#F0FDF4] text-[#15803D] font-medium">
                      <Box className="h-3 w-3" />
                      {approval.packageName}
                    </span>
                  )}
                  <span>{formatFileSize(approval.size)}</span>
                  <span className="rounded px-2 py-0.5 bg-[#F3F4F6] text-[#6A7282] font-medium">Upload</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ApprovalStatusBadge status={approval.status} />
                <button
                  onClick={() => setExpandedId(isExpanded ? null : approval.publicId)}
                  className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#6A7282] hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {approval.uploader && (
                <>
                  <Avatar name={approval.uploader.name} avatar={approval.uploader.avatar} />
                  <span className="text-[11px] text-[#6A7282]">
                    by <span className="font-medium text-[#101828]">{approval.uploader.name}</span>
                  </span>
                </>
              )}
              <span className="text-[11px] text-[#6A7282]">{formatTimestamp(approval.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
            <div className="grid grid-cols-2 gap-4 text-[14px] mb-4">
              <div>
                <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold">Version Label</p>
                <p className="font-medium text-[#101828]">{approval.versionLabel}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold">Version #</p>
                <p className="font-medium text-[#101828]">v{approval.versionNumber}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold">Type</p>
                <p className="font-medium text-[#101828] truncate">{approval.mimeType || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold">Size</p>
                <p className="font-medium text-[#101828]">{formatFileSize(approval.size)}</p>
              </div>
              {approval.folderPath && (
                <div className="col-span-2">
                  <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold">Folder</p>
                  <p className="font-medium text-[#101828]">{approval.folderPath}</p>
                </div>
              )}
              {approval.packageName && (
                <div className="col-span-2">
                  <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold">Package</p>
                  <p className="font-medium text-[#101828] flex items-center gap-1.5">
                    <Box className="h-3.5 w-3.5 text-[#15803D]" />
                    {approval.packageName}
                  </p>
                </div>
              )}
              {approval.versionDescription && (
                <div className="col-span-2">
                  <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold">Description</p>
                  <p className="font-medium text-[#101828]">{approval.versionDescription}</p>
                </div>
              )}
              {approval.status === 'rejected' && approval.rejectionReason && (
                <div className="col-span-2">
                  <p className="text-[11px] text-[#DC2626] uppercase tracking-wide font-semibold">Rejection Reason</p>
                  <p className="font-medium text-[#DC2626]">{approval.rejectionReason}</p>
                </div>
              )}
            </div>

            {isIfcFile(approval.mimeType, approval.originalName) && approval.conversionStatus && (
              <div className="mb-4 p-3 rounded-[8px] bg-[#F9FAFB] border border-[#E5E7EB]">
                <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold mb-2">Model Preview Conversion</p>
                <ConversionStatusBadge status={approval.conversionStatus} />
              </div>
            )}

            <div className="flex gap-2 mb-4">
              {isIfcFile(approval.mimeType, approval.originalName) && (
                <button
                  onClick={() => {
                    if (approval.conversionStatus === 'READY') {
                      setXktViewerState({
                        projectId,
                        fileId: approval.documentId,
                        versionId: approval.documentId,
                        fileName: approval.originalName,
                      });
                    } else if (approval.conversionStatus === 'PROCESSING') {
                      toast.info('Model is still being converted. Please wait...');
                    } else {
                      retryConversion(approval.documentId, approval.originalName, (newStatus) => {
                        setApprovals(prev => prev.map(a =>
                          a.publicId === approval.publicId ? { ...a, conversionStatus: newStatus } : a
                        ));
                      });
                    }
                  }}
                  disabled={approval.conversionStatus === 'PROCESSING'}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors',
                    approval.conversionStatus === 'READY'
                      ? 'border-[#155DFC] bg-[#155DFC]/5 text-[#155DFC] hover:bg-[#155DFC]/10 font-medium cursor-pointer'
                      : approval.conversionStatus === 'PROCESSING'
                      ? 'border-[#E5E7EB] bg-white text-[#6A7282] cursor-not-allowed opacity-60'
                      : 'border-[#E5E7EB] bg-white text-[#6A7282] hover:border-[#FCA5A5] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer'
                  )}
                >
                  <Box className="h-3.5 w-3.5" />
                  3D Preview
                  {approval.conversionStatus === 'PROCESSING' && <Loader2 className="h-3 w-3 animate-spin" />}
                </button>
              )}

              {approval.fileUrl && /\.(txt|md|json|csv|xml|html|css|js|ts|log|ini|cfg|yaml|yml|env|sh|bat|ps1)$/i.test(approval.originalName) ? (
                <button
                  onClick={async () => {
                    setIsLoadingTextPreview(true);
                    setPreviewTextFileName(approval.originalName);
                    try {
                      const res = await fetch(approval.fileUrl);
                      if (!res.ok) throw new Error('Failed to load file');
                      const text = await res.text();
                      setPreviewTextContent(text);
                    } catch {
                      setPreviewTextContent('Failed to load file content.');
                    } finally {
                      setIsLoadingTextPreview(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />Preview
                </button>
              ) : null}

              {approval.fileUrl && (
                <a href={approval.fileUrl} download={approval.originalName}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors">
                  <Download className="h-3.5 w-3.5" />Download
                </a>
              )}
            </div>

            {approval.status === 'pending' && canApprove && (
              <div className="pt-3 border-t border-[#E5E7EB]">
                {rejectReason?.id === approval.publicId ? (
                  <div className="mb-3">
                    <label className="text-[12px] text-[#6A7282] font-medium block mb-1.5">Rejection Reason (optional)</label>
                    <textarea
                      value={rejectReason.reason}
                      onChange={(e) => setRejectReason({ id: approval.publicId, reason: e.target.value })}
                      placeholder="Explain why this upload is being rejected..."
                      rows={2}
                      className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
                    />
                  </div>
                ) : null}

                <div className="flex gap-2">
                  {rejectReason?.id === approval.publicId ? (
                    <>
                      <button onClick={() => handleReject(approval)} disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#DC2626] px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Confirm Reject
                      </button>
                      <button onClick={() => setRejectReason(null)}
                        className="px-4 py-2 text-[13px] text-[#6A7282] hover:text-[#101828] transition-colors">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setRejectReason({ id: approval.publicId, reason: '' })} disabled={isActing}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#FEF2F2] hover:border-[#FCA5A5] hover:text-[#DC2626] transition-colors disabled:opacity-50">
                      <XCircle className="h-3.5 w-3.5" />Reject
                    </button>
                  )}
                  <button onClick={() => handleApprove(approval)} disabled={isActing}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] bg-[#007A55] px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                </div>
              </div>
            )}

            {approval.status === 'pending' && !canApprove && (
              <div className="pt-3 border-t border-[#E5E7EB]">
                <p className="text-[12px] text-[#B45309] flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Only owner, admin, or manager can approve uploads
                </p>
              </div>
            )}
          </div>
        )}

        {/* Comment section */}
        <div className="mt-4">
          <CommentSection
            type="approval"
            targetId={approval.publicId}
            projectId={projectId}
            currentUserId={getCurrentUserId() || ''}
            canModerate={canApprove}
            variant="panel"
            borderTop={true}
            onCommentsChange={(comments) => setCommentCount(comments.length)}
          />
        </div>
      </div>
    );
  }

  // ── CR Version Card ──────────────────────────────────────────────────────────
  function CrVersionCard({ item }: { item: { type: 'crversion'; data: any } }) {
    const version = item.data;
    const isExpanded = expandedId === version.publicId;
    const cr = version.changeRequest || {};
    const status = version.status || 'pending';
    const isActing = crVersionActionLoading === version.publicId;

    return (
      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]',
            status === 'pending' ? 'bg-[#EEF2FF]' : status === 'approved' ? 'bg-[#ECFDF5]' : 'bg-[#FEE2E2]'
          )}>
            <svg className={cn('h-5 w-5',
              status === 'pending' ? 'text-[#4F39F6]' : status === 'approved' ? 'text-[#007A55]' : 'text-[#DC2626]'
            )} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#101828] truncate">{cr.title || version.versionLabel || `Version ${version.versionNumber}`}</p>
                <div className="flex items-center gap-2 text-[12px] text-[#6A7282] mt-0.5 flex-wrap">
                  <span className="font-mono text-[#155DFC] font-medium">{version.versionLabel || `v${version.versionNumber}`}</span>
                  {cr.crId && (
                    <span className="rounded px-2 py-0.5 bg-[#EEF2FF] text-[#432DD7] font-medium">{cr.crId}</span>
                  )}
                  <span>{formatFileSize(version.resultFiles?.reduce((acc: number, f: any) => acc + (f.size || 0), 0) || 0)}</span>
                  <span className="rounded px-2 py-0.5 bg-[#EEF2FF] text-[#4F39F6] font-medium">CR Version</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CrVersionStatusBadge status={status} />
                <button
                  onClick={() => setExpandedId(isExpanded ? null : version.publicId)}
                  className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#6A7282] hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#6A7282]">
              {cr.priority && (
                <span className={cn(
                  'rounded px-2 py-0.5 font-medium',
                  cr.priority === 'urgent' ? 'bg-[#FEE2E2] text-[#DC2626]' :
                  cr.priority === 'high' ? 'bg-[#FEF3C7] text-[#CA8A04]' :
                  cr.priority === 'medium' ? 'bg-[#EEF2FF] text-[#4F39F6]' :
                  'bg-[#F3F4F6] text-[#6A7282]'
                )}>
                  {cr.priority}
                </span>
              )}
              {version.snapshot?.taskIds?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Box className="h-3 w-3" />
                  {version.snapshot.taskIds.length} task(s)
                </span>
              )}
              <span>{formatTimestamp(version.createdAt)}</span>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
            {cr.description && (
              <p className="text-[13px] text-[#4A5565] mb-4">{cr.description}</p>
            )}

            {/* Linked Tasks */}
            {version.snapshot?.taskIds?.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold mb-2">
                  Linked Tasks ({version.snapshot.taskIds.length})
                </p>
                <div className="space-y-2">
                  {version.snapshot.taskIds.map((taskId: string, idx: number) => (
                    <TaskChip key={idx} taskId={taskId} projectId={projectId} />
                  ))}
                </div>
              </div>
            )}

            {/* Result Files */}
            {version.resultFiles?.length > 0 ? (
              <div className="mb-4">
                <p className="text-[11px] text-[#6A7282] uppercase tracking-wide font-semibold mb-2">Files ({version.resultFiles.length})</p>
                <div className="space-y-2">
                  {version.resultFiles.map((file: any, idx: number) => {
                    const isText = /\.(txt|md|json|csv|xml|html|css|js|ts|log|ini|cfg|yaml|yml|env|sh|bat|ps1)$/i.test(file.name);
                    const isIfc = isIfcFile(file.mimeType, file.name);
                    const fileStatus = isIfc ? crFileConversionStatus[file.sourceDocumentId || file.name] : null;

                    return (
                    <div key={idx} className="flex items-center justify-between rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-[#6A7282] shrink-0" />
                        <span className="text-[13px] text-[#101828] truncate">{file.name}</span>
                        <span className="text-[11px] text-[#9CA3AF] shrink-0">{formatFileSize(file.size)}</span>
                        {fileStatus && fileStatus !== 'READY' && fileStatus !== 'PROCESSING' && (
                          <span className="text-[11px] text-[#6A7282] shrink-0">({fileStatus.toLowerCase()})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isIfc && (
                          <button
                            onClick={async () => {
                              const key = file.sourceDocumentId || file.name;
                              let status = crFileConversionStatus[key];
                              let resolvedFileId = key;

                              if (!status) {
                                const result = await fetchCrFileConversionStatus(file.sourceDocumentId || '', file.name);
                                if (result) {
                                  status = result.status;
                                  resolvedFileId = result.fileId;
                                }
                              }

                              if (status === 'READY') {
                                setXktViewerState({
                                  projectId,
                                  fileId: resolvedFileId,
                                  versionId: resolvedFileId,
                                  fileName: file.name,
                                });
                              } else {
                                await retryConversion(resolvedFileId, file.name, (newStatus) => {
                                  setCrFileConversionStatus(prev => ({ ...prev, [resolvedFileId]: newStatus }));
                                });
                              }
                            }}
                            disabled={fileStatus === 'PROCESSING'}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors',
                              fileStatus === 'READY'
                                ? 'border-[#155DFC] bg-[#155DFC]/5 text-[#155DFC] hover:bg-[#155DFC]/10 font-medium cursor-pointer'
                                : fileStatus === 'PROCESSING'
                                ? 'border-[#E5E7EB] bg-white text-[#6A7282] cursor-not-allowed opacity-60'
                                : 'border-[#E5E7EB] bg-white text-[#6A7282] hover:border-[#FCA5A5] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer'
                            )}
                          >
                            <Box className="h-3.5 w-3.5" />
                            3D Preview
                            {fileStatus === 'PROCESSING' && <Loader2 className="h-3 w-3 animate-spin" />}
                          </button>
                        )}
                        {file.url && isText ? (
                          <button
                            onClick={async () => {
                              setIsLoadingTextPreview(true);
                              setPreviewTextFileName(file.name);
                              try {
                                const res = await fetch(file.url);
                                if (!res.ok) throw new Error('Failed to load file');
                                const text = await res.text();
                                setPreviewTextContent(text);
                              } catch {
                                setPreviewTextContent('Failed to load file content.');
                              } finally {
                                setIsLoadingTextPreview(false);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />Preview
                          </button>
                        ) : null}
                        {file.url && !isText && !isIfc ? (
                          <a href={file.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors">
                            <Eye className="h-3.5 w-3.5" />Preview
                          </a>
                        ) : null}
                        {file.url && (
                          <a href={file.url} download={file.name}
                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors">
                            <Download className="h-3.5 w-3.5" />Download
                          </a>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-[#E5E7EB] rounded-[8px] mb-4">
                <svg className="h-6 w-6 text-[#9CA3AF] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p className="text-[12px] text-[#9CA3AF]">No files in this version</p>
              </div>
            )}

            {/* Rejection reason */}
            {status === 'rejected' && version.rejectionReason && (
              <div className="mb-4 p-3 rounded-[8px] bg-[#FEE2E2] border border-[#FCA5A5]">
                <p className="text-[11px] text-[#DC2626] uppercase tracking-wide font-semibold mb-1">Rejection Reason</p>
                <p className="text-[13px] text-[#991B1B]">{version.rejectionReason}</p>
              </div>
            )}

            {status === 'pending' && canApprove && (
              <div className="pt-3 border-t border-[#E5E7EB]">
                {(crVersionRejectReason?.id) === version.publicId ? (
                  <div className="mb-3">
                    <label className="text-[12px] text-[#6A7282] font-medium block mb-1.5">Rejection Reason (optional)</label>
                    <textarea
                      value={crVersionRejectReason!.reason}
                      onChange={(e) => setCrVersionRejectReason({ id: version.publicId, reason: e.target.value })}
                      placeholder="Explain why this version is being rejected..."
                      rows={2}
                      className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
                    />
                  </div>
                ) : null}

                <div className="flex gap-2">
                  {crVersionRejectReason?.id === version.publicId ? (
                    <>
                      <button
                        onClick={() => handleRejectCrVersion(version.publicId, cr.publicId)}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#DC2626] px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => setCrVersionRejectReason(null)}
                        className="px-4 py-2 text-[13px] text-[#6A7282] hover:text-[#101828] transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setCrVersionRejectReason({ id: version.publicId, reason: '' })}
                      disabled={isActing}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#FEF2F2] hover:border-[#FCA5A5] hover:text-[#DC2626] transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />Reject
                    </button>
                  )}
                  <button
                    onClick={() => handleApproveCrVersion(version.publicId, cr.publicId)}
                    disabled={isActing}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] bg-[#007A55] px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                </div>
              </div>
            )}

            {status === 'pending' && !canApprove && (
              <div className="pt-3 border-t border-[#E5E7EB]">
                <p className="text-[12px] text-[#B45309] flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Only owner, admin, or manager can approve CR versions
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Task Chip ────────────────────────────────────────────────────────────────
  function TaskChip({ taskId, projectId }: { taskId: string; projectId: string }) {
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!taskId || !projectId) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const res = await apiFetch('/api/tasks/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, taskId }),
          });
          if (res.ok && !cancelled) {
            const d = await res.json();
            if (d.success) setTask(d.data || null);
          }
        } catch { /* silent */ }
        finally { if (!cancelled) setLoading(false); }
      })();
      return () => { cancelled = true; };
    }, [taskId, projectId]);

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'done': return 'bg-[#ECFDF5] text-[#007A55]';
        case 'in-progress': return 'bg-[#EEF2FF] text-[#4F39F6]';
        case 'review': return 'bg-[#FEF3C7] text-[#B45309]';
        case 'todo': return 'bg-[#F3F4F6] text-[#6A7282]';
        case 'blocked': return 'bg-[#FEE2E2] text-[#DC2626]';
        default: return 'bg-[#F3F4F6] text-[#6A7282]';
      }
    };

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'urgent': return 'bg-[#FEE2E2] text-[#DC2626]';
        case 'high': return 'bg-[#FEF3C7] text-[#CA8A04]';
        case 'medium': return 'bg-[#EEF2FF] text-[#4F39F6]';
        default: return 'bg-[#F3F4F6] text-[#6A7282]';
      }
    };

    const handleNavigate = () => {
      if (taskId && projectId) {
        window.location.href = `/projects/${projectId}/tasks/${taskId}`;
      }
    };

    if (loading) {
      return (
        <div className="flex items-center gap-2 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#155DFC]" />
          <span className="text-[12px] text-[#6A7282]">Loading task...</span>
        </div>
      );
    }

    if (!task) {
      return (
        <div
          onClick={handleNavigate}
          className="flex items-center gap-2 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <Box className="h-4 w-4 text-[#6A7282]" />
          <span className="text-[13px] text-[#6A7282] truncate">{taskId}</span>
          <span className="ml-auto text-[11px] text-[#9CA3AF]">View</span>
        </div>
      );
    }

    return (
      <div
        onClick={handleNavigate}
        className="flex items-center justify-between gap-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Box className="h-4 w-4 text-[#6A7282] shrink-0" />
          <span className={cn('text-[12px] font-medium truncate', task.title ? 'text-[#101828]' : 'text-[#6A7282]')}>
            {task.title || 'Untitled Task'}
          </span>
          {task.status && (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0', getStatusColor(task.status))}>
              {task.status}
            </span>
          )}
          {task.priority && (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0', getPriorityColor(task.priority))}>
              {task.priority}
            </span>
          )}
          {task.assignee && (
            <Avatar name={task.assignee.name || task.assignee.email || '?'} avatar={task.assignee.avatar || null} size="sm" />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.attachments?.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-[#6A7282]">
              <FileText className="h-3 w-3" />
              {task.attachments.length}
            </span>
          )}
          <span className="rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] text-[#364153]">
            View
          </span>
        </div>
      </div>
    );
  }
}
