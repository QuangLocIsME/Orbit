'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { FileText, FolderPlus, Upload, Image as ImageIcon } from 'lucide-react';

interface PackageDetailPageProps {
  packageId: string;
}

interface PackageItem {
  publicId: string;
  projectId: string;
  name: string;
  description: string;
  status: string;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  icon?: string;
  children?: TreeNode[];
  s3Url?: string;
  category?: string;
}

export default function PackageDetailPage({ packageId }: PackageDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState<PackageItem | null>(null);
  const [documentsTree, setDocumentsTree] = useState<TreeNode | null>(null);

  const [selectedFolderType, setSelectedFolderType] = useState<'files' | 'images'>('files');
  const [folderName, setFolderName] = useState('');
  const [parentPath, setParentPath] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolderPath, setUploadFolderPath] = useState('');

  const projectId = pkg?.projectId || '';

  const loadPackage = async () => {
    const projectsRes = await apiFetch('/api/projects/me');
    if (!projectsRes.ok) throw new Error('Không thể tải projects');
    const projectPayload = await projectsRes.json();
    const projects = Array.isArray(projectPayload?.data) ? projectPayload.data : [];

    for (const project of projects) {
      const listRes = await apiFetch('/api/projects/packages/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId: project.publicId, listType: 'all' }),
      });
      if (!listRes.ok) continue;
      const payload = await listRes.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const found = items.find((p: any) => p.publicId === packageId);
      if (found) {
        setPkg(found);
        return found;
      }
    }

    throw new Error('Không tìm thấy package hoặc bạn không có quyền truy cập');
  };

  const loadDocuments = async (pid: string) => {
    const res = await apiFetch('/api/projects/packages/documents/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ projectId: pid }),
    });

    if (!res.ok) throw new Error('Không thể tải documents');
    const payload = await res.json();

    const root = payload?.data?.tree as TreeNode;
    const packageNode = root?.children?.find((node) => node.id?.includes(`/pkg/${packageId}`));
    setDocumentsTree(packageNode || null);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const found = await loadPackage();
      if (found?.projectId) {
        await loadDocuments(found.projectId);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải package');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [packageId]);

  const folderOptions = useMemo(() => {
    const options: string[] = [''];
    const walk = (node?: TreeNode) => {
      if (!node || node.type !== 'folder') return;
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'folder') {
            options.push(child.name);
            walk(child);
          }
        }
      }
    };
    walk(documentsTree || undefined);
    return Array.from(new Set(options));
  }, [documentsTree]);

  const createFolder = async () => {
    if (!projectId) return toast.error('Missing project');
    if (!folderName.trim()) return toast.error('Tên folder bắt buộc');

    const res = await apiFetch('/api/projects/packages/documents/folders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        projectId,
        packageId,
        folderType: selectedFolderType,
        folderName: folderName.trim(),
        parentPath: parentPath.trim(),
      }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || 'Tạo folder thất bại');
    }

    setFolderName('');
    setParentPath('');
    await loadDocuments(projectId);
  };

  const uploadDocument = async () => {
    if (!projectId) return toast.error('Missing project');
    if (!uploadFile) return toast.error('Vui lòng chọn file');

    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('packageId', packageId);
    formData.append('folderType', uploadFile.type.startsWith('image/') ? 'images' : 'files');
    formData.append('folderPath', uploadFolderPath.trim());
    formData.append('file', uploadFile);

    setUploading(true);
    try {
      const res = await apiFetch('/api/projects/packages/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Upload thất bại');
      }

      toast.success(payload?.mode === 'queue' ? 'File lớn đã đưa vào queue xử lý nền' : 'Upload thành công');
      setUploadFile(null);
      setUploadFolderPath('');
      await loadDocuments(projectId);
    } finally {
      setUploading(false);
    }
  };

  const renderNode = (node: TreeNode) => {
    if (node.type === 'file') {
      return (
        <li key={node.id} className="ml-6 py-1 text-sm text-gray-700">
          <a href={node.s3Url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-blue-600">
            {node.category === 'Image' ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {node.name}
          </a>
        </li>
      );
    }

    return (
      <li key={node.id} className="py-1">
        <div className="font-medium text-gray-800">{node.name}</div>
        {node.children && node.children.length > 0 && (
          <ul className="ml-4 border-l border-gray-200 pl-3">
            {node.children.map((child) => renderNode(child))}
          </ul>
        )}
      </li>
    );
  };

  if (loading) {
    return <div className="px-6 py-8 text-sm text-gray-500">Loading package...</div>;
  }

  if (!pkg) {
    return <div className="px-6 py-8 text-sm text-red-600">Không tìm thấy package.</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6 lg:px-[80px] xl:px-[160px]">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{pkg.name}</h1>
        <p className="mt-1 text-sm text-gray-600">{pkg.description || 'No description'}</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-900">Create Folder</p>
          <div className="space-y-2">
            <select
              value={selectedFolderType}
              onChange={(e) => setSelectedFolderType(e.target.value as 'files' | 'images')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="files">Files</option>
              <option value="images">Images</option>
            </select>
            <input
              value={parentPath}
              onChange={(e) => setParentPath(e.target.value)}
              placeholder="Parent path (optional)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button onClick={() => createFolder().catch((e) => toast.error(e.message))} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <FolderPlus className="h-4 w-4" />
              Create Folder
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-900">Upload File / Image</p>
          <div className="space-y-2">
            <select
              value={uploadFolderPath}
              onChange={(e) => setUploadFolderPath(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {folderOptions.map((opt, idx) => (
                <option key={`${opt}-${idx}`} value={opt}>{opt || '(root)'}</option>
              ))}
            </select>
            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <button
              disabled={!uploadFile || uploading}
              onClick={uploadDocument}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-gray-900">Documents Tree</p>
        {!documentsTree ? (
          <p className="text-sm text-gray-500">Chưa có dữ liệu documents cho package này.</p>
        ) : (
          <ul>{renderNode(documentsTree)}</ul>
        )}
      </div>
    </div>
  );
}
