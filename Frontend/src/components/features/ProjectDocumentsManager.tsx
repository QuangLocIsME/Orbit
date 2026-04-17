'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FileText, Folder, Image as ImageIcon, FolderPlus, Upload, ChevronRight,
  Eye, Download, Trash2, Pencil,
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
}

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  category?: string;
  s3Url?: string;
  mimeType?: string;
  folderPath?: string;
  isIfc?: boolean;
  versionId?: string;
  conversionStatus?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'NOT_SUPPORTED';
  conversionError?: string;
  versionNumber?: number;
  isPackage?: boolean;
  icon?: string;
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

export default function ProjectDocumentsManager({ projectId }: ProjectDocumentsManagerProps) {
  const [loading, setLoading] = useState(true);
  const [rootTree, setRootTree] = useState<TreeNode | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>('');

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [hoveredId, setHoveredId] = useState<string>('');
  const [renamingNodeId, setRenamingNodeId] = useState<string>('');
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string>('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);

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
    const cleanup = registerProjectCallback(projectId, 'documents:refresh', () => {
      loadDocumentsRef.current();
    });
    return cleanup;
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
    const res = await fetch('/api/projects/packages/documents/list', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) throw new Error('Failed to load documents');

    const payload = await res.json();
    setRootTree(payload?.data?.tree || null);
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
    refresh();
  }, [projectId]);

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

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const location = deriveLocation(currentFolder, packageNode);
      const packageId = location.packageId;
      const folderType = location.folderType;

      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('packageId', packageId);
      formData.append('folderType', folderType);
      formData.append('folderPath', location.folderPath);
      formData.append('file', file);

      console.log('[Upload] Starting upload:', {
        fileName: file.name,
        fileSize: file.size,
        projectId,
        packageId,
        folderType,
      });

      const res = await fetch('/api/projects/packages/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      console.log('[Upload] Response status:', res.status);

      const payload = await res.json().catch(() => null);
      console.log('[Upload] Response payload:', payload);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || `Upload failed (${res.status})`);
      }

      toast.success(payload?.mode === 'queue' ? 'Large file queued for background processing' : 'File uploaded successfully');
      await loadDocuments();
    } catch (error) {
      console.error('[Upload] Error:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setPendingUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (node: TreeNode) => {
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
    if (packageNode?.isPackage || isInPackageFolder(currentFolderId)) return;
    startRename(node);
  };

  const handleSingleClickFolder = (child: TreeNode) => {
    if (child.icon !== 'package') setCurrentFolderId(child.id);
  };

  const isInPackageContext = packageNode?.isPackage || isInPackageFolder(currentFolderId);

  const submitRename = async (node: TreeNode) => {
    if (!renameValue.trim()) {
      setRenamingNodeId('');
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
      toast.success('Folder renamed successfully');
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

  useEffect(() => {
    if (pendingUploadFile) {
      uploadFile(pendingUploadFile).catch((err: any) => toast.error(err?.message || 'Upload failed'));
    }
  }, [pendingUploadFile]);

  if (loading) {
    return <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px] text-sm text-gray-500">Loading documents...</div>;
  }

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[24px] font-normal text-[#101828]">Documents & Drawings</h2>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateFolderOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FolderPlus className="h-4 w-4" />
            Create Folder
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload File'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setPendingUploadFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {breadcrumbs.map((node, idx) => (
            <div key={node.id} className="inline-flex items-center gap-2">
              {idx > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              <button
                onClick={() => setCurrentFolderId(node.id)}
                className={idx === breadcrumbs.length - 1 ? 'font-medium text-gray-800' : 'hover:text-gray-800'}
              >
                {node.name}
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-3 text-[22px] font-medium text-[#101828]">{currentFolder?.name || 'All Files'}</h3>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {!currentFolder ? (
            <p className="p-4 text-sm text-gray-500">No documents in this package yet.</p>
          ) : (currentFolder.children || []).length === 0 ? (
            <p className="p-4 text-sm text-gray-500">This folder is empty.</p>
          ) : (
            <ul>
              {(currentFolder.children || []).map((child, idx) => {
                const isLast = idx === (currentFolder.children || []).length - 1;
                if (child.type === 'folder') {
                  return (
                    <li
                      key={child.id}
                      className={!isLast ? 'border-b border-gray-200' : ''}
                      onMouseEnter={() => setHoveredId(child.id)}
                      onMouseLeave={() => setHoveredId('')}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (packageNode?.isPackage || isInPackageFolder(currentFolderId)) return;
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
                      if (packageNode?.isPackage || isInPackageFolder(currentFolderId)) return;
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
                        <div
                          onDoubleClick={() => handleDoubleClickName(child)}
                          className={isInPackageContext ? 'flex-1 text-sm font-medium text-[#101828]' : 'flex-1 cursor-pointer text-sm font-medium text-[#101828]'}
                        >
                          {child.name}
                        </div>
                      )}

                      {hoveredId === child.id && (
                        <div className="flex items-center gap-1">
                          {isImage && (
                            <button onClick={() => setPreviewImageUrl(child.s3Url || '')} className="rounded p-1 text-gray-600 hover:bg-gray-100" title="Preview image">
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
      </div>

      {isCreateFolderOpen && (
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
              <button onClick={() => setIsCreateFolderOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => createFolder().catch((e: any) => toast.error(e.message))}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[160px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {!packageNode?.isPackage && !isInPackageFolder(currentFolderId) && (
            <>
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
    </div>
  );
}
