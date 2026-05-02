'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type ProjectRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

interface VersionUser {
  id: string;
  name: string;
  avatar: string | null;
}

interface Version {
  publicId: string;
  originalName: string;
  versionNumber: number;
  versionLabel: string;
  versionDescription?: string;
  versionGroupId: string;
  uuidv7: string | null;
  size: number;
  mimeType: string;
  s3Url: string;
  supabaseFileUrl?: string;
  uploadedBy: string;
  uploadedByUser?: VersionUser | null;
  conversionStatus: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

interface VersionHistoryModalProps {
  projectId: string;
  file: {
    id: string;
    name: string;
    versionGroupId?: string;
    versionNumber?: number;
    versionCount?: number;
    isIfc?: boolean;
    conversionStatus?: string;
    s3Url?: string;
  };
  projectRole?: ProjectRole;
  onClose: () => void;
  onRestore?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtRel(d: string) {
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
  const PALETTE = ['#6366F1','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function VersionHistoryModal({ projectId, file, projectRole = 'member', onClose, onRestore }: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingRestore, setPendingRestore] = useState<Version | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingVersion, setRejectingVersion] = useState<Version | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const canApprove = projectRole === 'owner' || projectRole === 'admin' || projectRole === 'manager';

  const fetchVersions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiFetch(
        `/api/projects/packages/documents/${projectId}/versions/${file.versionGroupId}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load versions');
      }
      setVersions(data.data.versions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load version history');
      toast.error(err.message || 'Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!file.versionGroupId) {
      setError('Version group not found');
      setIsLoading(false);
      return;
    }
    fetchVersions();
  }, [projectId, file.versionGroupId, refreshKey]);

  const handleDownload = async (version: Version) => {
    const url = version.supabaseFileUrl || version.s3Url;
    if (!url || url === '#') {
      toast.error('Download URL not available');
      return;
    }
    setDownloadingId(version.publicId);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseName = (file.name || 'file').replace(/\.[^.]+$/, '');
      const safeName = baseName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      const ext = version.originalName?.match(/\.[^.]+$/)?.[0] || '';
      link.href = objectUrl;
      link.download = `${safeName}_v${version.versionNumber}${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast.success('Download started');
    } catch {
      toast.error('Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = (version: Version) => {
    const url = version.supabaseFileUrl || version.s3Url;
    if (!url || url === '#') {
      toast.error('Preview URL not available');
      return;
    }
    const ext = (version.originalName || file.name || '').replace(/.*\./, '').toLowerCase();
    const name = `${(file.name || 'file').replace(/\.[^.]+$/, '')}_v${version.versionNumber}.${ext}`;
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewContent(null);
    setPreviewLoading(true);

    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name);
    if (isImage) {
      setPreviewContent('__IMAGE__');
      setPreviewLoading(false);
      return;
    }

    fetch(url)
      .then(r => r.text())
      .then(text => { setPreviewContent(text); setPreviewLoading(false); })
      .catch(() => {
        setPreviewContent('Failed to load file content.');
        setPreviewLoading(false);
      });
  };

  const handleRestoreClick = (version: Version) => {
    if (restoringId) return;
    setPendingRestore(version);
  };

  const handleConfirmRestore = async (skipIntermediate: boolean) => {
    if (!pendingRestore) return;

    setRestoringId(pendingRestore.publicId);
    setPendingRestore(null);
    try {
      const url = new URL(
        `/api/projects/packages/documents/${projectId}/versions/${pendingRestore.versionGroupId}/restore/${pendingRestore.publicId}`,
        window.location.origin
      );
      url.searchParams.set('skipIntermediate', String(skipIntermediate));

      const res = await apiFetch(url.toString(), {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to restore version');
      }
      const restoredAs = data.data?.versionNumber ?? pendingRestore.versionNumber + 1;
      const restoredLabel = data.data?.versionLabel || (() => {
        const maj = Math.floor(restoredAs);
        const min = Math.round((restoredAs - maj) * 100);
        return `v${maj}.${Math.min(99, Math.max(0, min))}`;
      })();
      toast.success(
        skipIntermediate
          ? `Restored to ${pendingRestore.versionLabel} as ${restoredLabel} — pending approval`
          : `Restored to ${pendingRestore.versionLabel} (current is now ${restoredLabel}) — pending approval`
      );
      setRefreshKey((k) => k + 1);
      onRestore?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore version');
    } finally {
      setRestoringId(null);
    }
  };

  const handleApprove = async (version: Version) => {
    setApprovingId(version.publicId);
    try {
      const res = await apiFetch('/api/approvals/by-document/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          documentId: version.publicId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to approve upload');
      }
      toast.success(`"${version.versionLabel}" approved`);
      setRefreshKey((k) => k + 1);
      onRestore?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve upload');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingVersion) return;
    setRejectingId(rejectingVersion.publicId);
    try {
      const res = await apiFetch('/api/approvals/by-document/reject', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          documentId: rejectingVersion.publicId,
          reason: rejectReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reject upload');
      }
      toast.success(`"${rejectingVersion.versionLabel}" rejected`);
      setRejectingVersion(null);
      setRejectReason('');
      setRefreshKey((k) => k + 1);
      onRestore?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject upload');
    } finally {
      setRejectingId(null);
    }
  };

  const visibleVersions = versions.filter((v) => {
    if (canApprove) return true;
    return v.approvalStatus !== 'pending';
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-[680px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EEF2FF]">
              <svg className="h-5 w-5 text-[#4F39F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[#101828]">Version History</h2>
              <p className="text-[12px] text-[#6A7282] truncate max-w-[300px]" title={file.name}>{file.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <svg className="h-8 w-8 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FEE2E2] mb-3">
                <svg className="h-7 w-7 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                </svg>
              </div>
              <p className="text-[14px] font-medium text-[#101828]">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] text-[#364153] hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {!isLoading && !error && visibleVersions.length === 0 && versions.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] mb-3">
                <svg className="h-7 w-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <p className="text-[14px] font-medium text-[#101828]">No approved versions yet</p>
              <p className="text-[12px] text-[#6A7282] mt-1">Submitted versions are waiting for approval</p>
            </div>
          )}

          {!isLoading && !error && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] mb-3">
                <svg className="h-7 w-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                </svg>
              </div>
              <p className="text-[14px] font-medium text-[#101828]">No version history found</p>
              <p className="text-[12px] text-[#6A7282] mt-1">Upload a new version to start tracking history</p>
            </div>
          )}

          {!isLoading && !error && visibleVersions.length > 0 && (
            <div className="rounded-[10px] border border-[#E5E7EB] overflow-hidden">
              {visibleVersions.map((version, idx) => {
                const uploader = version.uploadedByUser;
                const uploaderName = uploader?.name || 'Unknown';
                const isLatest = idx === 0;
                const isPending = version.approvalStatus === 'pending';
                const isRejected = version.approvalStatus === 'rejected';
                const isApproved = version.approvalStatus === 'approved';
                const canAct = canApprove && isPending;

                return (
                  <div
                    key={version.publicId}
                    className={cn(
                      'flex items-start gap-4 px-6 py-5 transition-colors',
                      isLatest ? 'bg-[#F0F9FF]/40' : 'bg-white',
                      idx !== visibleVersions.length - 1 && 'border-b border-[#E5E7EB]',
                      isRejected && 'opacity-60'
                    )}
                  >
                    {/* File icon */}
                    <div className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]',
                      isLatest ? 'bg-[#EEF2FF]' : 'bg-[#F3F4F6]'
                    )}>
                      {version.mimeType?.startsWith('image/') ? (
                        <svg className="h-5 w-5 text-[#4F39F6]" viewBox="0 0 20 20" fill="none">
                          <path d="M4 3.5A1.5 1.5 0 015.5 2h9A1.5 1.5 0 0116 3.5v13a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 014 16.5v-13z" stroke="#4F39F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M6.5 9.5l2.5 3 1.5-2 3.5 4.5" stroke="#4F39F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="7.5" cy="5.5" r="1" fill="#4F39F6"/>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-[#6A7282]" viewBox="0 0 20 20" fill="none">
                          <path d="M4 3.5A1.5 1.5 0 015.5 2h5.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0114.5 18h-9A1.5 1.5 0 014 16.5v-13z" stroke="#6A7282" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M7 7h6M7 10h6M7 13h4" stroke="#6A7282" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={cn(
                          'text-[14px] font-semibold',
                          isLatest ? 'text-[#432DD7]' : 'text-[#101828]'
                        )}>
                          {version.versionLabel}
                        </span>
                        {isLatest && (
                          <span className="rounded px-2 py-0.5 text-[12px] bg-[#EEF2FF] text-[#432DD7] font-medium">
                            Latest
                          </span>
                        )}
                        {isPending && (
                          <span className="rounded px-2 py-0.5 text-[12px] bg-[#FEF3C7] text-[#92400E] font-medium">
                            Pending
                          </span>
                        )}
                        {isRejected && (
                          <span className="rounded px-2 py-0.5 text-[12px] bg-[#FEE2E2] text-[#991B1B] font-medium">
                            Rejected
                          </span>
                        )}
                        {isApproved && !isPending && !isLatest && (
                          <span className="rounded px-2 py-0.5 text-[12px] bg-[#DCFCE7] text-[#166534] font-medium">
                            Approved
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[#6A7282]">
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                          </svg>
                          {formatFileSize(version.size)}
                        </span>
                        <span>·</span>
                        <span>{fmtRel(version.createdAt)}</span>
                        {isPending && (
                          <>
                            <span>·</span>
                            <span className="text-[#F59E0B] font-medium">Awaiting approval</span>
                          </>
                        )}
                        {isRejected && (
                          <>
                            <span>·</span>
                            <span className="text-[#DC2626] font-medium">Rejected</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Approval actions — shown for approvers on pending versions */}
                        {canAct && (
                          <>
                            <button
                              onClick={() => handleApprove(version)}
                              disabled={approvingId === version.publicId}
                              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#059669] bg-[#059669] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#047857] transition-colors disabled:opacity-50"
                              title="Approve this version"
                            >
                              {approvingId === version.publicId ? (
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                                </svg>
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => { setRejectingVersion(version); setRejectReason(''); }}
                              disabled={rejectingId === version.publicId}
                              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#DC2626] bg-white px-3 py-1.5 text-[12px] font-medium text-[#DC2626] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
                              title="Reject this version"
                            >
                              {rejectingId === version.publicId ? (
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              )}
                              Reject
                            </button>
                          </>
                        )}

                        {/* Restore — only for approved, non-latest versions */}
                        {!isLatest && !isPending && !isRejected && (
                          <button
                            onClick={() => handleRestoreClick(version)}
                            disabled={restoringId === version.publicId}
                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#FFFBEB] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors disabled:opacity-50"
                          >
                            {restoringId === version.publicId ? (
                              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
                              </svg>
                            )}
                            Restore
                          </button>
                        )}

                        {/* Preview — disabled for pending/rejected */}
                        <button
                          onClick={() => handlePreview(version)}
                          disabled={isPending || isRejected}
                          title={isPending ? 'Cannot preview pending version' : isRejected ? 'Cannot preview rejected version' : 'Preview'}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors',
                            isPending || isRejected
                              ? 'border-[#E5E7EB] bg-gray-50 text-[#9CA3AF] cursor-not-allowed opacity-50'
                              : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F0F9FF] hover:border-[#155DFC] hover:text-[#155DFC]'
                          )}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                          Preview
                        </button>

                        {/* Download — disabled for pending/rejected */}
                        <button
                          onClick={() => handleDownload(version)}
                          disabled={downloadingId === version.publicId || isPending || isRejected}
                          title={isPending ? 'Cannot download pending version' : isRejected ? 'Cannot download rejected version' : 'Download'}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors',
                            isPending || isRejected
                              ? 'border-[#E5E7EB] bg-gray-50 text-[#9CA3AF] cursor-not-allowed opacity-50'
                              : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F9FAFB]'
                          )}
                        >
                          {downloadingId === version.publicId ? (
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
                            </svg>
                          )}
                          Download
                        </button>
                      </div>
                      {/* Uploader */}
                      <div className="flex items-center gap-1.5">
                        {uploader?.avatar ? (
                          <img
                            src={uploader.avatar}
                            alt={uploaderName}
                            className="h-5 w-5 rounded-full object-cover"
                            title={uploaderName}
                          />
                        ) : (
                          <div
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                            style={{ backgroundColor: nameToColor(uploaderName) }}
                            title={uploaderName}
                          >
                            {uploaderName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[11px] text-[#6A7282]">{uploaderName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Restore Confirmation Modal */}
        {pendingRestore && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center" onClick={() => setPendingRestore(null)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div
              className="relative z-10 w-full max-w-[420px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFFBEB]">
                  <svg className="h-5 w-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-semibold text-[#101828]">Restore Version</h3>
                  <p className="text-[13px] text-[#6A7282] mt-1">
                    Restore <span className="font-semibold text-[#101828]">"{file.name}"</span> to{' '}
                    <span className="font-mono font-semibold text-[#101828]">{pendingRestore.versionLabel}</span>?
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={() => handleConfirmRestore(true)}
                  className="w-full rounded-[10px] bg-[#155DFC] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Restore after {pendingRestore.versionLabel}
                </button>
                <button
                  onClick={() => handleConfirmRestore(false)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] font-medium text-[#364153] hover:bg-gray-50 transition-colors"
                >
                  Create as latest version
                </button>
                <button
                  onClick={() => setPendingRestore(null)}
                  className="w-full px-4 py-2 text-[14px] text-[#6A7282] hover:text-[#101828] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Confirmation Modal */}
        {rejectingVersion && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center" onClick={() => setRejectingVersion(null)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div
              className="relative z-10 w-full max-w-[420px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2]">
                  <svg className="h-5 w-5 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-semibold text-[#101828]">Reject Version</h3>
                  <p className="text-[13px] text-[#6A7282] mt-1">
                    Are you sure you want to reject{' '}
                    <span className="font-semibold text-[#101828]">"{rejectingVersion.versionLabel}"</span>?
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-[13px] font-medium text-[#364153] mb-1.5">
                  Reason <span className="text-[#9CA3AF] font-normal">(optional)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this version is being rejected..."
                  rows={3}
                  className="w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex flex-col gap-2 mt-5">
                <button
                  onClick={handleReject}
                  disabled={rejectingId !== null}
                  className="w-full rounded-[10px] bg-[#DC2626] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {rejectingId !== null ? 'Rejecting...' : 'Reject Version'}
                </button>
                <button
                  onClick={() => setRejectingVersion(null)}
                  className="w-full px-4 py-2 text-[14px] text-[#6A7282] hover:text-[#101828] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewUrl && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewUrl(null)}>
            <div className="relative z-10 flex flex-col w-full max-w-[1000px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EEF2FF]">
                    <svg className="h-4 w-4 text-[#4F39F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold text-[#101828]">Preview</h2>
                    <p className="text-[12px] text-[#6A7282] truncate max-w-[400px]" title={previewName}>{previewName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#F9FAFB]">
                {previewLoading ? (
                  <svg className="h-8 w-8 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : previewContent === '__IMAGE__' ? (
                  <img
                    src={previewUrl!}
                    alt={previewName}
                    className="max-h-[75vh] max-w-full object-contain"
                    onError={() => { toast.error('Failed to load preview image'); }}
                  />
                ) : (
                  <pre className="w-full h-[75vh] p-4 text-[13px] font-mono text-[#374151] bg-white overflow-auto whitespace-pre-wrap break-all rounded-[8px] border border-[#E5E7EB]">
                    {previewContent}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
