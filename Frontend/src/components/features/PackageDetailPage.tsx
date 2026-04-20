'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  FileText,
  FolderPlus,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  Users,
  Activity as ActivityIcon,
  Settings,
  MoreHorizontal,
  ChevronRight,
  Plus,
  Search,
  Download,
  Upload as UploadIcon,
  X,
} from 'lucide-react';

interface PackageDetailPageProps {
  projectPublicId?: string;
  packageId: string;
}

interface PackageItem {
  publicId: string;
  projectId: string;
  name: string;
  description: string;
  status: string;
  dueDate?: string;
  teamMembers?: number;
  completedTasks?: number;
  totalTasks?: number;
  documentCount?: number;
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

type TabId = 'overview' | 'tasks' | 'documents' | 'team' | 'activity';

export default function PackageDetailPage({ projectPublicId, packageId }: PackageDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState<PackageItem | null>(null);
  const [documentsTree, setDocumentsTree] = useState<TreeNode | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    const handleTabChange = (e: CustomEvent<{ tabId: string }>) => {
      const tab = e.detail.tabId as TabId;
      if (['overview', 'tasks', 'documents', 'team', 'activity'].includes(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('orbit:topbar-tab-change', handleTabChange as EventListener);
    return () => window.removeEventListener('orbit:topbar-tab-change', handleTabChange as EventListener);
  }, []);

  const [selectedFolderType, setSelectedFolderType] = useState<'files' | 'images'>('files');
  const [folderName, setFolderName] = useState('');
  const [parentPath, setParentPath] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolderPath, setUploadFolderPath] = useState('');

  const [showAddTask, setShowAddTask] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const [tasks, setTasks] = useState<{ id: string; title: string; status: string; assignee: string }[]>([]);
  const [teamMembers] = useState<{ id: string; name: string; email: string; role: string; avatar: string }[]>([]);
  const [activities] = useState<{ id: string; action: string; user: string; time: string }[]>([]);

  const projectId = projectPublicId || pkg?.projectId || '';

  const loadPackage = async () => {
    if (projectPublicId) {
      const listRes = await apiFetch('/api/projects/packages/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId, listType: 'all' }),
      });
      if (!listRes.ok) throw new Error('Không thể tải packages');
      const payload = await listRes.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const found = items.find((p: any) => p.publicId === packageId);
      if (found) {
        setPkg(found);
        return found;
      }
      throw new Error('Không tìm thấy package hoặc bạn không có quyền truy cập');
    }

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
    setShowCreateFolder(false);
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
      setShowUpload(false);
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

  const stats = {
    completed: pkg?.completedTasks ?? 0,
    inProgress: pkg?.totalTasks ? (pkg.totalTasks - (pkg.completedTasks ?? 0)) : 0,
    documents: pkg?.documentCount ?? 0,
    team: pkg?.teamMembers ?? 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F4F7]">
        <div className="px-[300px] py-8">
          <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse mb-4" />
          <div className="h-4 w-72 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!pkg) {
    return <div className="px-6 py-8 text-sm text-red-600">Không tìm thấy package.</div>;
  }

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-emerald-500';
      case 'in progress': return 'bg-blue-500';
      case 'review': return 'bg-amber-500';
      case 'pending': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4F7]">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-[300px] pt-6 pb-4">
          {/* Back + Actions row */}
          <div className="flex items-center justify-between mb-4">
            <a href={projectPublicId ? `/projects/${projectPublicId}` : '/dashboard'} className="inline-flex items-center gap-1 text-sm text-[#4A5565] hover:text-[#101828] transition-colors">
              <ChevronRight className="h-4 w-4 rotate-180" />
              Back
            </a>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#364153] transition-colors hover:bg-gray-50">
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button className="inline-flex items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white p-1.5 text-[#364153] transition-colors hover:bg-gray-50">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Package Name + Description */}
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[24px] font-semibold text-[#101828]">{pkg.name}</h1>
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white capitalize", statusColor(pkg.status))}>
                {pkg.status}
              </span>
            </div>
            <p className="text-[14px] text-[#6A7282]">{pkg.description || 'No description'}</p>
          </div>

          {/* Meta Row: Due Date + Progress Ring + Team Avatars */}
          <div className="flex items-center gap-6">
            {pkg.dueDate && (
              <div className="flex items-center gap-2 text-[12px] text-[#6A7282]">
                <svg className="h-4 w-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="1.5" y="2" width="9" height="8.5" rx="1" />
                  <line x1="4" y1="1" x2="4" y2="3" />
                  <line x1="8" y1="1" x2="8" y2="3" />
                  <line x1="1.5" y1="5" x2="10.5" y2="5" />
                </svg>
                Due: {pkg.dueDate}
              </div>
            )}
            {/* Progress Ring */}
            <div className="flex items-center gap-2">
              <div className="relative h-8 w-8">
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke="#155DFC"
                    strokeWidth="3"
                    strokeDasharray={`${((pkg.completedTasks ?? 0) / Math.max(pkg.totalTasks ?? 1, 1)) * 100} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#101828]">
                  {Math.round(((pkg.completedTasks ?? 0) / Math.max(pkg.totalTasks ?? 1, 1)) * 100)}%
                </span>
              </div>
              <span className="text-[12px] text-[#6A7282]">
                {pkg.completedTasks ?? 0}/{pkg.totalTasks ?? 0} tasks
              </span>
            </div>
            {/* Team Avatars */}
            {(pkg.teamMembers ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-[12px] text-[#6A7282]">
                <div className="flex -space-x-2">
                  {Array.from({ length: Math.min(pkg.teamMembers ?? 0, 3) }).map((_, i) => (
                    <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-[10px] font-medium text-white">
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                {pkg.teamMembers! > 3 && <span className="ml-1">+{pkg.teamMembers! - 3}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-[300px] py-6">
        {/* ============ OVERVIEW TAB ============ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.documents}</p>
                  <p className="text-sm text-muted-foreground">Documents</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.team}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Recent Activity */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ActivityIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Recent Activity</h3>
                </div>
                {activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <ActivityIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">No recent activity</p>
                    <p className="text-xs text-gray-400 mt-1">Activity will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.map((a) => (
                      <div key={a.id} className="flex items-start gap-3">
                        <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-500" />
                        <div>
                          <p className="text-sm text-foreground">{a.action}</p>
                          <p className="text-xs text-muted-foreground">{a.user} · {a.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Tasks */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Recent Tasks</h3>
                </div>
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <CheckCircle className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">No tasks yet</p>
                    <p className="text-xs text-gray-400 mt-1">Tasks will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{t.title}</p>
                          <p className="text-xs text-muted-foreground">{t.assignee}</p>
                        </div>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          t.status === 'completed' && "bg-emerald-100 text-emerald-700",
                          t.status === 'in progress' && "bg-blue-100 text-blue-700",
                          t.status === 'review' && "bg-amber-100 text-amber-700",
                          t.status === 'pending' && "bg-gray-100 text-gray-600"
                        )}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ TASKS TAB ============ */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowAddTask(true)}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>
            </div>

            {/* Task List */}
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-20">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <CheckCircle className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks yet</h3>
                <p className="text-sm text-gray-500 mb-4">Get started by creating your first task</p>
                <button
                  onClick={() => setShowAddTask(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        task.status === 'completed' ? "bg-emerald-500" :
                        task.status === 'in progress' ? "bg-blue-500" :
                        task.status === 'review' ? "bg-amber-500" : "bg-gray-400"
                      )} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.assignee}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      task.status === 'completed' && "bg-emerald-100 text-emerald-700",
                      task.status === 'in progress' && "bg-blue-100 text-blue-700",
                      task.status === 'review' && "bg-amber-100 text-amber-700",
                      task.status === 'pending' && "bg-gray-100 text-gray-600"
                    )}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ DOCUMENTS TAB ============ */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 max-w-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-medium text-[#364153] transition-colors hover:bg-gray-50"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create Folder
                </button>
                <button
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <UploadIcon className="h-4 w-4" />
                  Upload
                </button>
              </div>
            </div>

            {/* Documents Tree */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="mb-3 text-sm font-medium text-gray-900">Documents Tree</p>
              {!documentsTree ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">No documents data yet</p>
                  <p className="text-xs text-gray-400 mt-1">Upload files or create a new folder</p>
                </div>
              ) : (
                <ul>{renderNode(documentsTree)}</ul>
              )}
            </div>
          </div>
        )}

        {/* ============ TEAM TAB ============ */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-[#101828]">Team Members</h2>
              <button
                onClick={() => setShowAddMember(true)}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Member
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-20">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No team members</h3>
                <p className="text-sm text-gray-500 mb-4">Add members to collaborate on this package</p>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Member
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-600">
                      {member.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      <span className="inline-flex items-center mt-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                        {member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ ACTIVITY TAB ============ */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-[#101828]">Activity Feed</h2>
              <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground">
                <option value="all">All Activities</option>
                <option value="tasks">Tasks</option>
                <option value="documents">Documents</option>
                <option value="team">Team</option>
              </select>
            </div>

            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-20">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <ActivityIcon className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No activity yet</h3>
                <p className="text-sm text-gray-500">Activity will appear here as things happen</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activities.map((a, i) => (
                  <div key={a.id} className="relative flex gap-4 py-4 border-b border-gray-100 last:border-0">
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-sm text-foreground">{a.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.user} · {a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============ MODALS ============ */}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddTask(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#101828]">Add Task</h2>
              <button onClick={() => setShowAddTask(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Task Title</label>
                <input
                  type="text"
                  placeholder="Enter task title"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Assignee</label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground">
                  <option value="">Select assignee</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Status</label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground">
                  <option value="pending">Pending</option>
                  <option value="in progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddTask(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#364153] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="rounded-lg bg-[#155DFC] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUpload(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#101828]">Upload File / Image</h2>
              <button onClick={() => setShowUpload(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Folder</label>
                <select
                  value={uploadFolderPath}
                  onChange={(e) => setUploadFolderPath(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground"
                >
                  {folderOptions.map((opt, idx) => (
                    <option key={`${opt}-${idx}`} value={opt}>{opt || '(root)'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowUpload(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#364153] hover:bg-gray-50"
              >
                Cancel
              </button>
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
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateFolder(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#101828]">Create Folder</h2>
              <button onClick={() => setShowCreateFolder(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Folder Type</label>
                <select
                  value={selectedFolderType}
                  onChange={(e) => setSelectedFolderType(e.target.value as 'files' | 'images')}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="files">Files</option>
                  <option value="images">Images</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Parent Path (optional)</label>
                <select
                  value={parentPath}
                  onChange={(e) => setParentPath(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground"
                >
                  {folderOptions.map((opt, idx) => (
                    <option key={`${opt}-${idx}`} value={opt}>{opt || '(root)'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Folder Name</label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateFolder(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#364153] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createFolder().catch((e) => toast.error(e.message))}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FolderPlus className="h-4 w-4" />
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddMember(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#101828]">Add Team Member</h2>
              <button onClick={() => setShowAddMember(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Email Address</label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#364153]">Role</label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddMember(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#364153] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="rounded-lg bg-[#155DFC] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
