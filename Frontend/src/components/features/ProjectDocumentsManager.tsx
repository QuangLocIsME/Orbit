'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  FileText, Folder, Image as ImageIcon, FolderPlus, Upload, ChevronRight,
  Eye, Download, Trash2, Pencil, Clock, X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useAppStore } from '@/stores/appStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import VersionHistoryModal from './VersionHistoryModal';
import { getProjectTabCache, setProjectTabCache } from '@/stores/projectDetailCacheStore';

// Helper function to download file from URL
const handleDownloadFile = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch {
    toast.error('Failed to download file');
  }
};

interface ProjectDocumentsManagerProps {
  projectId: string;
  packageId?: string | null;
  canManage?: boolean;
  initialFileId?: string | null;
  projectRole?: 'owner' | 'admin' | 'member' | 'viewer';
}

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  category?: string;
  size?: string;
  author?: string;
  updatedAt?: string;
  s3Url?: string;
  mimeType?: string;
  folderPath?: string;
  isIfc?: boolean;
  versionId?: string;
  conversionStatus?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'NOT_SUPPORTED';
  conversionError?: string;
  versionNumber?: number;
  versionLabel?: string;
  versionDescription?: string;
  versionGroupId?: string;
  versionCount?: number;
  isPackage?: boolean;
  icon?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

function findNodeById(node: TreeNode | null, id: string): TreeNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function buildBreadcrumbs(root: TreeNode | null, currentId: string): TreeNode[] {
  if (!root) return [];

  const path: TreeNode[] = [];
  const dfs = (node: TreeNode): boolean => {
    path.push(node);
    if (node.id === currentId) return true;
    for (const child of node.children || []) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  };

  dfs(root);
  return path;
}

function isInPackageFolder(nodeId: string): boolean {
  return nodeId.includes('/pkg/');
}

function findFileNodeByName(node: TreeNode | null, fileName: string): TreeNode | null {
  if (!node) return null;
  if (node.type === 'file' && node.name?.toLowerCase() === fileName.toLowerCase()) return node;
  for (const child of node.children || []) {
    const found = findFileNodeByName(child, fileName);
    if (found) return found;
  }
  return null;
}

function findNodePath(root: TreeNode | null, targetId: string): string[] {
  if (!root) return [];
  const path: string[] = [];
  const dfs = (node: TreeNode): boolean => {
    path.push(node.id);
    if (node.id === targetId) return true;
    for (const child of node.children || []) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  };
  dfs(root);
  return path;
}

function getInitialFolderId(root: TreeNode | null, fileId: string): string {
  if (!root) return '';
  if (root.id === fileId) return '';
  const fileNode = findNodeById(root, fileId);
  if (!fileNode || fileNode.type === 'file') {
    const parent = findParentOf(root, fileId);
    return parent ? parent.id : root.id;
  }
  return fileNode.id;
}

function findParentOf(root: TreeNode, targetId: string): TreeNode | null {
  for (const child of root.children || []) {
    if (child.id === targetId) return root;
    const found = findParentOf(child, targetId);
    if (found) return found;
  }
  return null;
}

function formatRelativeTime(value?: string) {
  if (!value) return 'recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 60) return `${Math.max(mins, 1)} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  return `${days} days ago`;
}

function deriveLocation(
  currentFolder: TreeNode | null,
  packageNode: TreeNode | null
): { packageId: string; folderType: 'files' | 'images'; folderPath: string } {
  const targetId = currentFolder?.id || packageNode?.id || 'root';

  if (targetId === 'root') {
    return { packageId: '', folderType: 'files', folderPath: '' };
  }

  const marker = '/pkg/';
  const pkgIndex = targetId.indexOf(marker);

  if (pkgIndex !== -1) {
    const pathAfterPkg = targetId.slice(pkgIndex + marker.length);
    const segments = pathAfterPkg.split('/').filter(Boolean);
    const packageId = segments[0] || '';
    const folderPath = segments.slice(1).join('/');
    return { packageId, folderType: 'files', folderPath };
  }

  const rootPrefix = 'root/';
  const folderPath = targetId.startsWith(rootPrefix) ? targetId.slice(rootPrefix.length) : '';
  return { packageId: '', folderType: 'files', folderPath };
}

export default function ProjectDocumentsManager({ projectId, packageId = null, canManage = true, initialFileId = null, projectRole = 'member' }: ProjectDocumentsManagerProps) {
  const cacheProjectId = packageId ? `${projectId}:package:${packageId}` : projectId;
  const [loading, setLoading] = useState(true);
  const [rootTree, setRootTree] = useState<TreeNode | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [memberNameMap, setMemberNameMap] = useState<Record<string, string>>({});

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [hoveredId, setHoveredId] = useState<string>('');
  const [renamingNodeId, setRenamingNodeId] = useState<string>('');
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string>('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [previewTextContent, setPreviewTextContent] = useState<string>('');
  const [previewTextFileName, setPreviewTextFileName] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [previewXlsxData, setPreviewXlsxData] = useState<{ sheets: Record<string, any[][]>; sheetNames: string[]; fileName: string } | null>(null);
  const [isLoadingXlsx, setIsLoadingXlsx] = useState(false);
  const [previewXlsxTab, setPreviewXlsxTab] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [versionHistoryFile, setVersionHistoryFile] = useState<TreeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Version modal state - show before uploading
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadVersion, setPendingUploadVersion] = useState('');
  const [pendingUploadDescription, setPendingUploadDescription] = useState('');

  const [contextMenu, setContextMenu] = useState<{
    node: TreeNode;
    x: number;
    y: number;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const registerProjectCallback = useAppStore((s) => s.registerProjectCallback);

  // Real-time: refresh documents when another user creates/upload/deletes
  useEffect(() => {
    const cleanupDocuments = registerProjectCallback(projectId, 'documents:refresh', () => {
      loadDocumentsRef.current();
    });
    const cleanupConversion = registerProjectCallback(projectId, 'document:conversion-updated', () => {
      loadDocumentsRef.current();
    });
    return () => {
      cleanupDocuments();
      cleanupConversion();
    };
  }, [registerProjectCallback, projectId]);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const loadDocuments = async () => {
    const endpoint = packageId
      ? '/api/projects/packages/documents/package/list'
      : '/api/projects/packages/documents/list';
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(packageId ? { projectId, packageId } : { projectId }),
    });
    if (!res.ok) throw new Error('Failed to load documents');

    const payload = await res.json();
    const nextTree = payload?.data?.tree || null;
    setRootTree(nextTree);
    setProjectTabCache(cacheProjectId, 'documents', { rootTree: nextTree });
  };
  const loadDocumentsRef = useRef(loadDocuments);
  loadDocumentsRef.current = loadDocuments;

  const refresh = async () => {
    setLoading(true);
    try {
      await loadDocuments();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getProjectTabCache<{ rootTree: TreeNode | null }>(cacheProjectId, 'documents');
    if (cached?.data) {
      setRootTree(cached.data.rootTree || null);
      setLoading(false);
      loadDocuments().catch(() => {});
      return;
    }

    refresh();
  }, [cacheProjectId, projectId, packageId]);

  useEffect(() => {
    let cancelled = false;
    const loadMemberNames = async () => {
      try {
        const res = await fetch('/api/projects/member-list', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        if (!res.ok) return;
        const payload = await res.json();
        const members = Array.isArray(payload?.data) ? payload.data : [];
        const map: Record<string, string> = {};
        for (const member of members) {
          const userId = String(member?.userId || '');
          const displayName = String(member?.user?.fullName || member?.user?.name || member?.user?.email || '').trim();
          if (userId && displayName) {
            map[userId] = displayName;
          }
        }
        if (!cancelled) setMemberNameMap(map);
      } catch {
        if (!cancelled) setMemberNameMap({});
      }
    };
    loadMemberNames();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const initialFileIdRef = useRef<string | null>(initialFileId);

  useEffect(() => {
    if (!rootTree || !initialFileIdRef.current) return;
    const fileId = initialFileIdRef.current;
    initialFileIdRef.current = null;
    const path = findNodePath(rootTree, fileId);
    if (path.length <= 1) return;
    for (let i = 1; i < path.length - 1; i++) {
      const node = findNodeById(rootTree, path[i]);
      if (node?.type === 'folder') {
        setCurrentFolderId(path[i]);
      }
    }
  }, [rootTree, currentFolderId]);

  useEffect(() => {
    if (!rootTree || !hoveredId) return;
    if (hoveredId !== initialFileId) return;
    setHoveredId('');
  }, [currentFolderId]);

  const packageNode = useMemo(() => {
    if (!rootTree) return null;
    return rootTree;
  }, [rootTree]);

  useEffect(() => {
    if (packageNode) {
      setCurrentFolderId(packageNode.id);
    }
  }, [packageNode?.id]);

  const currentFolder = useMemo(() => {
    if (!packageNode) return null;
    return findNodeById(packageNode, currentFolderId) || packageNode;
  }, [packageNode, currentFolderId]);

  const breadcrumbs = useMemo(() => {
    if (!packageNode || !currentFolder) return [];
    return buildBreadcrumbs(packageNode, currentFolder.id);
  }, [packageNode, currentFolder]);

  const createFolder = async () => {
    if (!canManage) {
      toast.error('You do not have permission to create folders');
      return;
    }
    if (!folderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }
    const location = deriveLocation(currentFolder, packageNode);

    const packageId = location.packageId;

    const res = await fetch('/api/projects/packages/documents/folders/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        projectId,
        packageId,
        folderType: location.folderType,
        folderName: folderName.trim(),
        parentPath: location.folderPath,
      }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || 'Failed to create folder');
    }

    setFolderName('');
    setIsCreateFolderOpen(false);
    await loadDocuments();
  };

  const uploadFile = async (file: File, versionLabel: string, versionDescription: string): Promise<void> => {
    if (!canManage) {
      throw new Error('You do not have permission to upload files');
    }
    const location = deriveLocation(currentFolder, packageNode);
    const packageId = location.packageId;
    const folderType = location.folderType;

    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('packageId', packageId);
    formData.append('folderType', folderType);
    formData.append('folderPath', location.folderPath);
    formData.append('file', file);
    formData.append('versionLabel', versionLabel);
    formData.append('versionDescription', versionDescription);

    const res = await fetch('/api/projects/packages/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || `Upload failed (${res.status})`);
    }

    toast.success(
      payload?.data?.approvalStatus === 'pending'
        ? `${file.name} submitted for approval (${versionLabel})`
        : payload?.mode === 'queue'
          ? `Queued: ${file.name}`
          : payload?.data?.isNewVersion
            ? `${file.name} updated to version ${payload.data.versionNumber}`
            : `Uploaded: ${file.name}`
    );
  };

  // Version info shared across all queued files (set from modal)
  const [queueVersionLabel, setQueueVersionLabel] = useState('');
  const [queueVersionDescription, setQueueVersionDescription] = useState('');

  const processUploadQueue = async () => {
    const currentQueue = uploadQueue;
    if (currentQueue.length === 0) {
      setIsUploading(false);
      setUploadProgress({ done: 0, total: 0 });
      return;
    }

    setIsUploading(true);
    const [current, ...rest] = currentQueue;
    setUploadProgress((prev) => ({
      done: prev.done + 1,
      total: prev.total > 0 ? prev.total : currentQueue.length,
    }));

    try {
      await uploadFile(current, queueVersionLabel || 'v1.0.0', queueVersionDescription);
      await loadDocuments();
    } catch (error) {
      toast.error(`Upload failed: ${current.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsUploading(false);
    setUploadQueue(rest);
  };

  // Trigger queue processing whenever queue changes
  useEffect(() => {
    if (uploadQueue.length > 0 && !isUploading) {
      processUploadQueue();
    } else if (uploadQueue.length === 0 && !isUploading) {
      setIsUploading(false);
      setUploadProgress({ done: 0, total: 0 });
    }
  }, [uploadQueue, isUploading]);

  const handleDelete = async (node: TreeNode) => {
    if (!canManage) {
      toast.error('You do not have permission to delete');
      return;
    }
    const endpoint = node.type === 'folder'
      ? '/api/projects/packages/documents/folder/delete'
      : '/api/projects/packages/documents/file/delete';

    const body = node.type === 'folder'
      ? { projectId, folderId: node.id }
      : { projectId, fileId: node.id };

    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || 'Delete failed');
    }

    toast.success(node.type === 'folder' ? 'Folder deleted successfully' : 'File deleted successfully');
    await loadDocuments();
  };

  const startRename = (node: TreeNode) => {
    setRenamingNodeId(node.id);
    setRenameValue(node.name);
    setRenameError('');
  };

  const handleDoubleClickName = (node: TreeNode) => {
    if (!canManage) return;
    if (packageNode?.isPackage || isInPackageFolder(currentFolderId)) return;
    startRename(node);
  };

  const handleSingleClickFolder = (child: TreeNode) => {
    if (child.icon !== 'package') setCurrentFolderId(child.id);
  };

  const isInPackageContext = packageNode?.isPackage || isInPackageFolder(currentFolderId);
  const isPackageMode = Boolean(packageId);
  const resolveAuthorName = (authorId?: string) => {
    if (!authorId) return '';
    return memberNameMap[authorId] || authorId;
  };
  const visibleChildren = useMemo(() => {
    const nodes = currentFolder?.children || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((node) => String(node.name || '').toLowerCase().includes(q));
  }, [currentFolder?.children, searchQuery]);

  const submitRename = async (node: TreeNode) => {
    if (!canManage) {
      toast.error('You do not have permission to rename');
      return;
    }
    if (!renameValue.trim()) {
      setRenamingNodeId('');
      setRenameError('');
      return;
    }

    const trimmedNewName = renameValue.trim();
    if (trimmedNewName === node.name) {
      setRenamingNodeId('');
      setRenameValue('');
      setRenameError('');
      return;
    }

    const endpoint = node.type === 'folder'
      ? '/api/projects/packages/documents/folder/rename'
      : '/api/projects/packages/documents/file/rename';

    const body = node.type === 'folder'
      ? { projectId, folderId: node.id, newName: renameValue.trim() }
      : { projectId, fileId: node.id, newName: renameValue.trim() };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        let msg = payload?.message || 'Rename failed';

        if (res.status === 400) {
          msg = payload?.message || 'Invalid folder name';
        } else if (res.status === 403) {
          msg = payload?.message || 'You do not have permission to rename this folder';
        } else if (res.status === 404) {
          msg = payload?.message || 'Folder not found';
        } else if (res.status === 409) {
          msg = payload?.message || 'A folder with this name already exists';
        }

        setRenameError(msg);
        toast.error(msg);
        return;
      }

      setRenamingNodeId('');
      setRenameValue('');
      setRenameError('');
      toast.success(node.type === 'folder' ? `Folder renamed to "${trimmedNewName}"` : `File renamed to "${trimmedNewName}"`);
      await loadDocuments();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Rename failed';
      setRenameError(msg);
      toast.error(msg);
    }
  };

  const openIfcViewer = (node: TreeNode) => {
    const targetVersionId = node.versionId || node.id;
    window.location.href = `/project/${projectId}/${node.id}/${targetVersionId}`;
  };

  const retryIfcConversion = async (node: TreeNode) => {
    const res = await apiFetch('/api/projects/packages/documents/retry-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        projectId,
        fileId: node.id,
        versionId: node.versionId || node.id,
      }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || 'Failed to retry IFC conversion');
    }

    toast.success('Queued IFC conversion');
    await loadDocuments();
  };

  const getIfcTooltip = (node: TreeNode) => {
    if (!node.isIfc) return 'View';
    if (node.conversionStatus === 'READY') return 'Open 3D viewer';
    if (node.conversionStatus === 'FAILED') return node.conversionError || 'Conversion failed. Click to retry';
    if (node.conversionStatus === 'PROCESSING' || node.conversionStatus === 'PENDING') return 'Đang xử lý mô hình...';
    return 'IFC viewer is not ready';
  };

  if (loading) {
    return <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px] text-sm text-gray-500">Loading documents...</div>;
  }

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        {!isPackageMode && <h2 className="text-[24px] font-normal text-[#101828]">Documents & Drawings</h2>}

        {isPackageMode && (
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="h-10 w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] pl-9 pr-3 text-sm text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isPackageMode && (
            <button
              onClick={() => setIsCreateFolderOpen(true)}
              disabled={!canManage}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-gray-200 bg-white px-5 min-w-[160px] text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              Create Folder
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !canManage}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#155DFC] px-5 min-w-[160px] text-[13px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {isUploading
              ? `Uploading ${uploadProgress.done + 1}/${uploadProgress.total}...`
              : uploadQueue.length > 0
                ? `${uploadQueue.length} queued...`
                : isPackageMode
                  ? 'Upload'
                  : 'Upload Files'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.length === 0) return;
              const [first, ...rest] = files;

              // Check if this file matches an existing file to suggest next version
              const existingFile = findFileNodeByName(rootTree, first.name);
              let suggestedVersion = 'v1.0.0';

              if (existingFile) {
                try {
                  const res = await fetch('/api/projects/packages/documents/suggest-version', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ projectId, fileId: existingFile.id }),
                  });
                  const data = await res.json();
                  if (data.success && data.data?.versionLabel) {
                    suggestedVersion = data.data.versionLabel;
                  }
                } catch {
                  // fallback to default
                }
              }

              setPendingUploadFile(first);
              setPendingUploadVersion(suggestedVersion);
              setPendingUploadDescription('');
              setVersionModalOpen(true);
              setUploadProgress((prev) => ({
                done: prev.done,
                total: prev.total + files.length,
              }));
              if (rest.length > 0) {
                setUploadQueue((prev) => [...prev, ...rest]);
              }
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
        </div>
      </div>

      {!isPackageMode && breadcrumbs.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          {breadcrumbs.map((node, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={node.id} className="inline-flex items-center gap-2">
                {idx > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(node.id)}
                  className={
                    isLast
                      ? 'text-left text-base font-semibold text-[#101828]'
                      : 'hover:text-gray-800'
                  }
                >
                  {node.name}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        {!isPackageMode && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {!currentFolder ? (
            <p className="p-4 text-sm text-gray-500">No documents in this package yet.</p>
          ) : visibleChildren.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">This folder is empty.</p>
          ) : (
            <ul>
              {visibleChildren.map((child, idx) => {
                const isLast = idx === visibleChildren.length - 1;
                if (child.type === 'folder') {
                  return (
                    <li
                      key={child.id}
                      className={!isLast ? 'border-b border-gray-200' : ''}
                      onMouseEnter={() => setHoveredId(child.id)}
                      onMouseLeave={() => setHoveredId('')}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!canManage || packageNode?.isPackage || isInPackageFolder(currentFolderId)) return;
                        setContextMenu({ node: child, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <div className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50">
                        <button onClick={() => handleSingleClickFolder(child)} className="flex items-center gap-4 text-left">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                            <Folder className="h-5 w-5 text-gray-500" />
                          </span>
                        </button>

                        {renamingNodeId === child.id ? (
                          <div className="flex flex-col flex-1">
                            <input
                              value={renameValue}
                              onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                              onBlur={() => submitRename(child)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitRename(child);
                                if (e.key === 'Escape') { setRenamingNodeId(''); setRenameError(''); }
                              }}
                              className={`flex-1 rounded border px-2 py-1 text-sm ${renameError ? 'border-red-500' : 'border-gray-200'}`}
                              autoFocus
                            />
                            {renameError && (
                              <span className="mt-1 text-xs text-red-500">{renameError}</span>
                            )}
                          </div>
                        ) : (
                          <div
                            onClick={() => handleSingleClickFolder(child)}
                            onDoubleClick={() => handleDoubleClickName(child)}
                            className={isInPackageContext ? 'flex-1 text-sm font-medium text-[#101828]' : 'flex-1 cursor-pointer text-sm font-medium text-[#101828]'}
                          >
                            {child.name}
                          </div>
                        )}

                        {hoveredId === child.id && (
                          <div className="flex items-center gap-1">
                            {!packageNode?.isPackage && child.icon !== 'package' && !isInPackageFolder(currentFolderId) && (
                              <button
                                onClick={() => setDeleteTarget(child)}
                                className="rounded p-1 text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                }

                const isImage = (child.mimeType || '').startsWith('image/') || child.category === 'Image';
                return (
                  <li
                    key={child.id}
                    className={!isLast ? 'border-b border-gray-200' : ''}
                    onMouseEnter={() => setHoveredId(child.id)}
                    onMouseLeave={() => setHoveredId('')}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!canManage || packageNode?.isPackage || isInPackageFolder(currentFolderId)) return;
                      setContextMenu({ node: child, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <div className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                        {isImage ? <ImageIcon className="h-5 w-5 text-gray-500" /> : <FileText className="h-5 w-5 text-gray-500" />}
                      </span>

                      {renamingNodeId === child.id ? (
                        <div className="flex flex-col flex-1">
                          <input
                            value={renameValue}
                            onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                            onBlur={() => submitRename(child)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitRename(child);
                              if (e.key === 'Escape') { setRenamingNodeId(''); setRenameError(''); }
                            }}
                            className={`flex-1 rounded border px-2 py-1 text-sm ${renameError ? 'border-red-500' : 'border-gray-200'}`}
                            autoFocus
                          />
                          {renameError && (
                            <span className="mt-1 text-xs text-red-500">{renameError}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-1 items-center gap-2">
                          <div
                            onDoubleClick={() => handleDoubleClickName(child)}
                            className={isInPackageContext ? 'text-sm font-medium text-[#101828]' : 'cursor-pointer text-sm font-medium text-[#101828]'}
                          >
                            {child.name}
                          </div>
                          {(child.versionCount ?? 1) > 1 && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                              {child.versionLabel || `v${child.versionNumber}`}
                            </span>
                          )}
                        </div>
                      )}

                      {hoveredId === child.id && (
                        <div className="flex items-center gap-1">
                          {isImage && (
                            <button onClick={() => setPreviewImageUrl(child.s3Url || '')} className="rounded p-1 text-gray-600 hover:bg-gray-100" title="Preview image">
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          {((child.mimeType || '').startsWith('text/') || /\.(txt|md|json|csv|xml|html|css|js|ts|log|ini|cfg|yaml|yml|env|sh|bat|ps1)$/i.test(child.name)) && (
                            <button
                              onClick={async () => {
                                const url = child.s3Url;
                                if (!url) return;
                                setIsLoadingText(true);
                                setPreviewTextFileName(child.name);
                                try {
                                  const res = await fetch(url);
                                  if (!res.ok) throw new Error('Failed to load file');
                                  const text = await res.text();
                                  setPreviewTextContent(text);
                                } catch {
                                  setPreviewTextContent('Failed to load file content.');
                                } finally {
                                  setIsLoadingText(false);
                                }
                              }}
                              className="rounded p-1 text-gray-600 hover:bg-gray-100"
                              title="Preview text file"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          {/\.(xlsx|xls)$/i.test(child.name) && (
                            <button
                              onClick={async () => {
                                const url = child.s3Url;
                                if (!url) return;
                                setIsLoadingXlsx(true);
                                setPreviewXlsxData(null);
                                setPreviewXlsxTab('');
                                try {
                                  const res = await fetch(url);
                                  if (!res.ok) throw new Error('Failed to load file');
                                  const buffer = await res.arrayBuffer();
                                  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                                  const sheets: Record<string, any[][]> = {};
                                  for (const name of workbook.SheetNames) {
                                    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
                                  }
                                  const first = workbook.SheetNames[0];
                                  setPreviewXlsxData({ sheets, sheetNames: workbook.SheetNames, fileName: child.name });
                                  setPreviewXlsxTab(first || '');
                                } catch {
                                  toast.error('Failed to preview XLSX file');
                                } finally {
                                  setIsLoadingXlsx(false);
                                }
                              }}
                              className="rounded p-1 text-gray-600 hover:bg-gray-100"
                              title="Preview XLSX file"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          {child.isIfc && (
                            <button
                              onClick={() => {
                                if (child.conversionStatus === 'READY') {
                                  openIfcViewer(child);
                                  return;
                                }
                                if (child.conversionStatus === 'FAILED') {
                                  retryIfcConversion(child).catch((e: any) => toast.error(e?.message || 'Failed to retry conversion'));
                                  return;
                                }
                              }}
                              disabled={child.conversionStatus === 'PENDING' || child.conversionStatus === 'PROCESSING'}
                              title={getIfcTooltip(child)}
                              className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDownloadFile(child.s3Url || '#', child.name)}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100"
                            title="Download original file"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {!packageNode?.isPackage && !isInPackageFolder(currentFolderId) && (
                            <button
                              onClick={() => setDeleteTarget(child)}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}

        {isPackageMode && (
          <div className="space-y-2">
            {visibleChildren.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[#E5E7EB] bg-white px-4 py-10 text-center text-sm text-[#6A7282]">
                No documents found.
              </div>
            ) : (
              visibleChildren.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3"
                  onMouseEnter={() => setHoveredId(child.id)}
                  onMouseLeave={() => setHoveredId('')}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#DBEAFE]">
                      {child.type === 'folder'
                        ? <Folder className="h-5 w-5 text-[#2563EB]" />
                        : <FileText className="h-5 w-5 text-[#2563EB]" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] text-[#101828]">{child.name}</p>
                        {child.type === 'file' && (child.versionCount ?? 1) > 1 && (
                          <span className="inline-flex items-center gap-1 shrink-0 rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                            {child.versionLabel || `v${child.versionNumber}`}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[12px] text-[#6A7282]">
                        {[
                          child.type === 'folder' ? 'Folder' : (child.size || 'File'),
                          child.author ? `by ${resolveAuthorName(child.author)}` : null,
                          formatRelativeTime(child.updatedAt),
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {hoveredId === child.id && child.type === 'file' && (
                      <>
                        <button
                          onClick={() => handleDownloadFile(child.s3Url || '#', child.name)}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100"
                          title="Download original file"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {/\.(xlsx|xls)$/i.test(child.name) && (
                          <button
                            onClick={async () => {
                              const url = child.s3Url;
                              if (!url) return;
                              setIsLoadingXlsx(true);
                              setPreviewXlsxData(null);
                              setPreviewXlsxTab('');
                              try {
                                const res = await fetch(url);
                                if (!res.ok) throw new Error('Failed to load file');
                                const buffer = await res.arrayBuffer();
                                const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                                const sheets: Record<string, any[][]> = {};
                                for (const name of workbook.SheetNames) {
                                  sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
                                }
                                const first = workbook.SheetNames[0];
                                setPreviewXlsxData({ sheets, sheetNames: workbook.SheetNames, fileName: child.name });
                                setPreviewXlsxTab(first || '');
                              } catch {
                                toast.error('Failed to preview XLSX file');
                              } finally {
                                setIsLoadingXlsx(false);
                              }
                            }}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100"
                            title="Preview XLSX file"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {child.isIfc && (
                          <button
                            onClick={() => {
                              if (child.conversionStatus === 'READY') openIfcViewer(child);
                            }}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100"
                            title={getIfcTooltip(child)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                    <button className="rounded p-1 text-[#99A1AF] hover:bg-gray-100">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {isCreateFolderOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setIsCreateFolderOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Create Folder</h3>
            <p className="mt-1 text-sm text-gray-500">Folder will be created at the current location.</p>

            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
              className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setIsCreateFolderOpen(false)} className="rounded-[10px] px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => createFolder().catch((e: any) => toast.error(e.message))}
                className="rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm font-normal text-white hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewImageUrl('')}>
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img src={previewImageUrl} alt="Preview" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
          </div>
        </div>
      )}

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
            {isLoadingText ? (
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

      {previewXlsxData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewXlsxData(null)}
        >
          <div
            className="relative z-10 flex flex-col w-full max-w-[95vw] h-[85vh] bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                  <svg className="h-4 w-4 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-[#101828]">Excel Preview</h2>
                  <p className="text-[12px] text-[#6A7282] truncate max-w-[300px]" title={previewXlsxData.fileName}>{previewXlsxData.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewXlsxData(null)}
                className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="flex border-b border-[#E5E7EB] shrink-0 overflow-x-auto">
              {previewXlsxData.sheetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setPreviewXlsxTab(name)}
                  className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    previewXlsxTab === name
                      ? 'border-[#155DFC] text-[#155DFC] font-medium'
                      : 'border-transparent text-[#6A7282] hover:text-[#374151]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto bg-white">
              {isLoadingXlsx ? (
                <div className="flex items-center justify-center h-full">
                  <svg className="h-8 w-8 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              ) : previewXlsxData.sheets[previewXlsxTab] ? (
                <>
                <table className="border-collapse text-sm min-w-max">
                  <tbody>
                    {previewXlsxData.sheets[previewXlsxTab].slice(0, 100).map((row: any[], ri: number) => (
                        <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
                          {row.map((cell: any, ci: number) => (
                            <td
                              key={ci}
                              className="border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#374151] whitespace-nowrap"
                              style={{ minWidth: '80px' }}
                            >
                              {cell == null ? '' : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewXlsxData.sheets[previewXlsxTab].length > 100 && (
                    <p className="px-4 py-3 text-xs text-[#6A7282] text-center border-t border-[#E5E7EB]">
                      Showing first 100 rows of {previewXlsxData.sheets[previewXlsxTab].length} rows
                    </p>
                  )}
                </>
              ) : null}
            </div>

            <div className="flex justify-end px-6 py-3 border-t border-[#E5E7EB] shrink-0 bg-white">
              <button
                onClick={() => setPreviewXlsxData(null)}
                className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'file' && (
            <>
              {contextMenu.node.versionCount && contextMenu.node.versionCount > 1 && (
                <>
                  <button
                    onClick={() => {
                      setContextMenu(null);
                      setVersionHistoryFile(contextMenu.node);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Clock className="h-4 w-4 text-gray-400" />
                    Version History
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                </>
              )}
              <button
                onClick={() => {
                  const url = contextMenu.node.s3Url || '#';
                  handleDownloadFile(url, contextMenu.node.name || 'file');
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4 text-gray-400" />
                Download
              </button>
            </>
          )}
          {!packageNode?.isPackage && !isInPackageFolder(currentFolderId) && canManage && (
            <>
              {contextMenu.node.type === 'file' && (
                <div className="mx-3 border-t border-gray-100" />
              )}
              <button
                onClick={() => {
                  setContextMenu(null);
                  startRename(contextMenu.node);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4 text-gray-400" />
                Rename
              </button>
              <div className="mx-3 border-t border-gray-100" />
              <button
                onClick={() => {
                  setContextMenu(null);
                  setDeleteTarget(contextMenu.node);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {deleteTarget?.type === 'folder' ? 'folder' : 'file'} "{deleteTarget?.name}"? {deleteTarget?.type === 'folder' && 'All contents inside will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget).catch((e: any) => toast.error(e.message));
                }
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {versionHistoryFile && (
        <VersionHistoryModal
          projectId={projectId}
          file={versionHistoryFile}
          projectRole={projectRole}
          onClose={() => setVersionHistoryFile(null)}
          onRestore={refresh}
        />
      )}

      {/* Version Input Modal */}
      <Dialog open={versionModalOpen} onOpenChange={(open) => {
        setVersionModalOpen(open);
        if (!open) {
          setPendingUploadFile(null);
          setPendingUploadVersion('');
          setPendingUploadDescription('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Upload File</span>
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {pendingUploadFile?.name}
              </span>
            </DialogTitle>
            <DialogDescription>
              Enter version and description for this upload. It will be submitted for approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Version <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={pendingUploadVersion}
                onChange={(e) => setPendingUploadVersion(e.target.value)}
                placeholder="e.g. v1.0.0"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
                  <p className="mt-1 text-xs text-gray-500">Example: v1.0.0, v1.1.0, v1.2, v2.0.0</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Description / Note
              </label>
              <textarea
                value={pendingUploadDescription}
                onChange={(e) => setPendingUploadDescription(e.target.value)}
                placeholder="Describe the changes or notes for this version..."
                rows={3}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setVersionModalOpen(false);
                setPendingUploadFile(null);
                setPendingUploadVersion('');
                setPendingUploadDescription('');
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!pendingUploadVersion.trim()) {
                  toast.error('Version is required');
                  return;
                }
                if (!pendingUploadFile) return;

                const version = pendingUploadVersion.trim();
                const description = pendingUploadDescription.trim();
                const fileToUpload = pendingUploadFile;

                setVersionModalOpen(false);
                setPendingUploadFile(null);
                setPendingUploadVersion('');
                setPendingUploadDescription('');

                // Add the file to queue with shared version info
                setQueueVersionLabel(version);
                setQueueVersionDescription(description);
                setUploadQueue((prev) => [...prev, fileToUpload]);
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Upload for Approval
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
