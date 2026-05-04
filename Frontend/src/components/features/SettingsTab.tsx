'use client';
// Settings Tab v1.0.72
import { useState, useRef, useEffect, useCallback } from 'react';
import { navigate } from 'astro:transitions/client';
import { cn } from '@/lib/utils';
import { apiFetch, uploadProjectThumbnail, uploadProjectAvatar, deleteProjectAvatar, updateProject, fetchProjectRoles, createProjectRole, updateProjectRole, deleteProjectRole, fetchProjectReport, exportProjectReport, type ProjectReportData } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { workflowTemplateService, type WorkflowTemplate } from '@/lib/workflow-template-service';
import { toast } from '@/components/ui/sonner';
import { WorkflowEditor, type StageData } from './workflow-editor/WorkflowEditor';
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
import { Settings, FileText, ListTodo, GitBranch, Shield, Users, Bell, Plug, Plus, Pencil, X, Trash2, GripVertical, Eye, EyeOff, LayoutGrid, FolderOpen, FileText as FileDoc, GitCompare, RefreshCcw, AlertTriangle, Puzzle, Save, Tag, Lock, Check, Mail, MessageSquare, Clock, Zap, Link2, Calendar, FileUp, Box, Globe, Scissors, Database, BookOpen, BarChart3, Folder, Code, Loader2, Upload, ChevronRight, CheckCircle2, UserPlus, Copy, Key, Circle, Eye as EyeIcon } from 'lucide-react';

// Project Templates data
interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  pages: { name: string; icon: string }[];
}

const projectTemplates: ProjectTemplate[] = [
  {
    id: '1',
    name: 'Construction & BIM',
    description: 'For construction and BIM projects',
    icon: 'cube',
    pages: [
      { name: 'Overview', icon: 'grid' },
      { name: 'Packages', icon: 'folder' },
      { name: 'Documents', icon: 'file' },
      { name: 'Versions', icon: 'git' },
      { name: 'Changes', icon: 'refresh' },
      { name: 'Clashes', icon: 'alert' },
      { name: '3D Viewer', icon: 'cube' },
    ],
  },
  {
    id: '2',
    name: 'Software Development',
    description: 'For software and tech projects',
    icon: 'code',
    pages: [
      { name: 'Overview', icon: 'grid' },
      { name: 'Code', icon: 'code' },
      { name: 'Database', icon: 'database' },
      { name: 'Versions', icon: 'git' },
      { name: 'Tasks', icon: 'refresh' },
      { name: 'Team', icon: 'users' },
    ],
  },
  {
    id: '3',
    name: 'Education & Learning',
    description: 'For schools and educational projects',
    icon: 'book',
    pages: [
      { name: 'Overview', icon: 'grid' },
      { name: 'Lessons', icon: 'book' },
      { name: 'Resources', icon: 'folder' },
      { name: 'Assignments', icon: 'refresh' },
      { name: 'Students', icon: 'users' },
    ],
  },
  {
    id: '4',
    name: 'General Project',
    description: 'Basic project management',
    icon: 'folder',
    pages: [
      { name: 'Overview', icon: 'grid' },
      { name: 'Files', icon: 'file' },
      { name: 'Tasks', icon: 'refresh' },
      { name: 'Team', icon: 'users' },
      { name: 'Analytics', icon: 'chart' },
    ],
  },
];

// Page icon options
const pageIconOptions = [
  { id: 'grid', icon: LayoutGrid },
  { id: 'folder', icon: FolderOpen },
  { id: 'file', icon: FileDoc },
  { id: 'git', icon: GitCompare },
  { id: 'refresh', icon: RefreshCcw },
  { id: 'alert', icon: AlertTriangle },
  { id: 'puzzle', icon: Puzzle },
  { id: 'users', icon: Users },
  { id: 'cube', icon: Box },
  { id: 'code', icon: Code },
  { id: 'database', icon: Database },
  { id: 'book', icon: BookOpen },
  { id: 'folder2', icon: Folder },
  { id: 'chart', icon: BarChart3 },
  { id: 'settings', icon: Settings },
  { id: 'zap', icon: Zap },
];

// Roles data
interface Role {
  id: string;
  name: string;
  accessLevel: 'full' | 'high' | 'medium' | 'minimal';
  isSystem: boolean;
  memberCount: number;
  description: string;
  permissions: string[];
  color: string;
}

const defaultRoles: Role[] = [
  { id: '1', name: 'Project Owner', accessLevel: 'full', isSystem: true, memberCount: 1, description: 'Full control over the project and all settings', permissions: ['All Permissions'], color: '#8B5CF6' },
  { id: '2', name: 'Admin', accessLevel: 'high', isSystem: true, memberCount: 2, description: 'Can manage project, members, and approve changes', permissions: ['View All', 'Edit All', 'Delete Content', 'Manage Team', 'Approve Changes'], color: '#EF4444' },
  { id: '3', name: 'Manager', accessLevel: 'high', isSystem: true, memberCount: 3, description: 'Can manage tasks, approve changes, and assign work', permissions: ['View All', 'Edit All', 'Approve Changes', 'Assign Tasks', 'Manage Workflow'], color: '#EF4444' },
  { id: '4', name: 'Member', accessLevel: 'medium', isSystem: false, memberCount: 5, description: 'Can create and edit content, submit changes', permissions: ['View All', 'Edit Own', 'Create Content', 'Submit Changes'], color: '#10B981' },
  { id: '5', name: 'Viewer', accessLevel: 'minimal', isSystem: false, memberCount: 0, description: 'View-only access to project content', permissions: ['View All'], color: '#6B7280' },
];

// Permission categories
interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const permissionCategories: PermissionCategory[] = [
  { id: 'documents', name: 'Documents & Drawings', description: 'Access and manage project documents', icon: 'file' },
  { id: 'versions', name: 'Version Control', description: 'View and create revisions', icon: 'git' },
  { id: 'tasks', name: 'Tasks & Workflows', description: 'Manage tasks and workflows', icon: 'list' },
  { id: 'packages', name: 'Packages', description: 'Manage project packages', icon: 'package' },
  { id: 'clashes', name: 'Clash Detection', description: 'View and resolve clashes', icon: 'alert' },
  { id: 'viewer', name: '3D Viewer', description: 'Access 3D model viewer', icon: 'box' },
  { id: 'settings', name: 'Project Settings', description: 'Modify project settings', icon: 'settings' },
  { id: 'members', name: 'Member Management', description: 'Invite and manage members', icon: 'users' },
];

// Team members data
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedDate: string;
  avatar?: string;
}

const defaultTeamMembers: TeamMember[] = [
  { id: '1', name: 'Nguyen Van An', email: 'an.nguyen@orbit.vn', role: 'Owner', joinedDate: 'Jan 15, 2024' },
  { id: '2', name: 'Tran Thi Binh', email: 'binh.tran@orbit.vn', role: 'Admin', joinedDate: 'Feb 20, 2024' },
  { id: '3', name: 'Le Van Cuong', email: 'cuong.le@orbit.vn', role: 'Admin', joinedDate: 'Mar 10, 2024' },
  { id: '4', name: 'Pham Thi Dung', email: 'dung.pham@orbit.vn', role: 'Member', joinedDate: 'Apr 5, 2024' },
];

// Notification settings
interface NotificationSetting {
  id: string;
  category: string;
  title: string;
  description: string;
  email: boolean;
  inApp: boolean;
  push: boolean;
}

const defaultNotifications: NotificationSetting[] = [
  { id: '1', category: 'Tasks', title: 'Task assigned to you', description: 'When someone assigns a task to you', email: true, inApp: true, push: true },
  { id: '2', category: 'Tasks', title: 'Task status changed', description: 'When a task you created or assigned changes status', email: true, inApp: true, push: false },
  { id: '3', category: 'Tasks', title: 'Task comment', description: 'When someone comments on your task', email: false, inApp: true, push: true },
  { id: '4', category: 'Documents', title: 'Document uploaded', description: 'When a new document is uploaded to the project', email: true, inApp: true, push: false },
  { id: '5', category: 'Documents', title: 'Document updated', description: 'When a document you follow is updated', email: false, inApp: true, push: false },
  { id: '6', category: 'Changes', title: 'Change request submitted', description: 'When someone submits a change request', email: true, inApp: true, push: true },
  { id: '7', category: 'Changes', title: 'Change approved/rejected', description: 'When your change request is reviewed', email: true, inApp: true, push: true },
  { id: '8', category: 'Team', title: 'Member joined', description: 'When a new member joins the project', email: false, inApp: true, push: false },
  { id: '9', category: 'Team', title: 'Member role changed', description: 'When your role is updated', email: true, inApp: true, push: true },
];

// Integration data
interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: 'storage' | 'communication' | 'project' | 'cad';
}

const defaultIntegrations: Integration[] = [
  { id: '1', name: 'Google Drive', description: 'Sync files and documents with Google Drive', icon: 'drive', connected: true, category: 'storage' },
  { id: '2', name: 'Dropbox', description: 'Connect your Dropbox account for file storage', icon: 'dropbox', connected: false, category: 'storage' },
  { id: '3', name: 'OneDrive', description: 'Microsoft OneDrive integration', icon: 'onedrive', connected: false, category: 'storage' },
  { id: '4', name: 'Slack', description: 'Send notifications to Slack channels', icon: 'slack', connected: false, category: 'communication' },
  { id: '5', name: 'Discord', description: 'Get real-time activity notifications with rich embeds', icon: 'discord', connected: false, category: 'communication' },
  { id: '6', name: 'Microsoft Teams', description: 'Integrate with Microsoft Teams', icon: 'teams', connected: false, category: 'communication' },
  { id: '7', name: 'Jira', description: 'Sync tasks with Jira projects', icon: 'jira', connected: false, category: 'project' },
  { id: '7', name: 'Autodesk BIM 360', description: 'Connect to Autodesk BIM 360', icon: 'autodesk', connected: true, category: 'cad' },
  { id: '8', name: 'Revit Cloud', description: 'Sync Revit models from cloud', icon: 'revit', connected: false, category: 'cad' },
];

// Task Tags data
interface TaskTag {
  id: string;
  name: string;
  description: string;
  color: string;
}

const defaultTaskTags: TaskTag[] = [
  { id: '1', name: 'structural', description: 'Structural engineering tasks', color: '#6366F1' },
  { id: '2', name: 'mep', description: 'MEP related tasks', color: '#3B82F6' },
  { id: '3', name: 'architecture', description: 'Architectural design tasks', color: '#10B981' },
  { id: '4', name: 'civil', description: 'Civil engineering tasks', color: '#6B7280' },
  { id: '5', name: 'drawings', description: 'Drawing documentation', color: '#14B8A6' },
  { id: '6', name: 'clash', description: 'Clash resolution tasks', color: '#EF4444' },
  { id: '7', name: 'review', description: 'Review and approval tasks', color: '#F97316' },
  { id: '8', name: 'urgent', description: 'High priority urgent tasks', color: '#DC2626' },
  { id: '9', name: 'design', description: 'Design related tasks', color: '#8B5CF6' },
  { id: '10', name: 'coordination', description: 'Coordination tasks', color: '#F59E0B' },
];

// Navigation Pages data
interface NavigationPage {
  id: string;
  name: string;
  icon: string;
  isDefault: boolean;
  isVisible: boolean;
}

const defaultNavigationPages: NavigationPage[] = [
  { id: '1', name: 'Overview', icon: 'grid', isDefault: true, isVisible: true },
  { id: '2', name: 'Packages', icon: 'folder', isDefault: true, isVisible: true },
  { id: '3', name: 'Documents', icon: 'file', isDefault: true, isVisible: true },
  { id: '4', name: 'Versions', icon: 'git', isDefault: true, isVisible: true },
  { id: '5', name: 'Changes', icon: 'refresh', isDefault: true, isVisible: true },
  { id: '6', name: 'Clashes', icon: 'alert', isDefault: false, isVisible: true },
  { id: '7', name: 'Extensions', icon: 'puzzle', isDefault: false, isVisible: true },
];

interface Discipline {
  id: string;
  name: string;
  description: string;
  color: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SettingsTabProps {
  projectName?: string;
  projectCode?: string;
  projectDescription?: string;
  projectPublicId?: string;
  projectCoverImageUrl?: string;
  projectType?: 'construction' | 'design' | 'software' | 'research';
  onSettingsUpdated?: () => void;
  onActivityAdded?: () => void; // Trigger refresh activities
}

const settingsMenuItems = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'workflow', label: 'Workflow', icon: GitBranch },
  { id: 'roles', label: 'Roles', icon: Users },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

const defaultDisciplines: Discipline[] = [
  { id: '1', name: 'Architecture', description: 'Architectural design and planning', color: 'bg-purple-100 text-purple-600' },
  { id: '2', name: 'Structure', description: 'Structural engineering and analysis', color: 'bg-blue-100 text-blue-600' },
  { id: '3', name: 'MEP', description: 'Mechanical, Electrical & Plumbing', color: 'bg-indigo-100 text-indigo-600' },
  { id: '4', name: 'Coordination', description: 'Project coordination and management', color: 'bg-orange-100 text-orange-600' },
  { id: '5', name: 'Drawings', description: 'Construction drawings and documentation', color: 'bg-teal-100 text-teal-600' },
];

export default function SettingsTab({
  projectName = 'Metro Station - Phase 2',
  projectCode = 'MS-P2-2025',
  projectDescription = '',
  projectPublicId = '',
  projectCoverImageUrl = '',
  projectType = 'construction',
  onSettingsUpdated,
  onActivityAdded
}: SettingsTabProps) {
  const [activeMenu, setActiveMenu] = useState('general');
  const [name, setName] = useState(projectName);
  const [code, setCode] = useState(projectCode);
  const [description, setDescription] = useState(projectDescription);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [navigationPages, setNavigationPages] = useState<NavigationPage[]>(defaultNavigationPages);
  const [taskTags, setTaskTags] = useState<TaskTag[]>(defaultTaskTags);
  const [isLoadingTaskTags, setIsLoadingTaskTags] = useState(false);
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(defaultTeamMembers);
  const [selectedRole, setSelectedRole] = useState('Admin');
  const [notifications, setNotifications] = useState<NotificationSetting[]>(defaultNotifications);
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [discordEnabled, setDiscordEnabled] = useState(false);

  // Reports state
  const [reportData, setReportData] = useState<ProjectReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'csv' | 'xlsx' | null>(null);
  const [permissionMatrix, setPermissionMatrix] = useState<Record<string, Record<string, string>>>({
    'Owner': { documents: 'manage', versions: 'manage', tasks: 'manage', packages: 'manage', clashes: 'manage', viewer: 'manage', settings: 'manage', members: 'manage' },
    'Admin': { documents: 'manage', versions: 'manage', tasks: 'manage', packages: 'manage', clashes: 'edit', viewer: 'manage', settings: 'edit', members: 'edit' },
    'Member': { documents: 'edit', versions: 'edit', tasks: 'edit', packages: 'view', clashes: 'view', viewer: 'view', settings: 'none', members: 'none' },
    'Viewer': { documents: 'view', versions: 'view', tasks: 'view', packages: 'view', clashes: 'view', viewer: 'view', settings: 'none', members: 'none' },
  });
  
  // Add Discipline Modal state
  const [showAddDisciplineModal, setShowAddDisciplineModal] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [newDisciplineDescription, setNewDisciplineDescription] = useState('');
  const [newDisciplineColor, setNewDisciplineColor] = useState('#6366f1');
  
  // Templates Modal state
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  
  // Add Page Modal state
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPageIcon, setNewPageIcon] = useState('file');
  
  // Track if pages have been modified
  const [pagesModified, setPagesModified] = useState(false);
  
  // Save success message
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // General settings save state
  const [generalSaveState, setGeneralSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  // Discipline validation error
  const [disciplineNameError, setDisciplineNameError] = useState(false);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  
  // Edit Discipline Modal state
  const [showEditDisciplineModal, setShowEditDisciplineModal] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null);
  
  // Project thumbnail
  const [projectThumbnail, setProjectThumbnail] = useState<string | null>(projectCoverImageUrl || null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(projectCoverImageUrl || null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null); // Chưa upload, chờ Save Changes
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null); // Preview tạm
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Template apply success
  const [templateApplied, setTemplateApplied] = useState<string | null>(null);
  
  // Edit Page Modal state
  const [showEditPageModal, setShowEditPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState<NavigationPage | null>(null);
  
  const [editingTag, setEditingTag] = useState<TaskTag | null>(null);
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editTagName, setEditTagName] = useState('');
  const [editTagDescription, setEditTagDescription] = useState('');
  const [editTagColor, setEditTagColor] = useState('#6366F1');
  
  // Workflow state
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [showCreateWorkflowModal, setShowCreateWorkflowModal] = useState(false);
  const [showEditWorkflowModal, setShowEditWorkflowModal] = useState(false);
  const [showDeleteWorkflowModal, setShowDeleteWorkflowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [workflowTemplatesLoading, setWorkflowTemplatesLoading] = useState(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [workflowSettings, setWorkflowSettings] = useState({
    autoAssign: false,
    notifyStatusChange: false,
    requireApproval: false
  });
  
  // Invite Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  
  // Permissions save state
  const [permissionsSaveState, setPermissionsSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  // Invite permissions state
  const [invitePermissions, setInvitePermissions] = useState({
    documents: 'Edit',
    versions: 'Edit',
    tasks: 'Edit',
    packages: 'Edit'
  });
  
  // Workflow apply state
  const [workflowApplyState, setWorkflowApplyState] = useState<'idle' | 'applying' | 'success'>('idle');
  
  // Create Role Modal state
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#6366f1');
  const [newRolePermissionLevel, setNewRolePermissionLevel] = useState('medium');
  const [newRoleContentPerms, setNewRoleContentPerms] = useState({
    viewAll: false,
    editOwn: false,
    editAll: false,
    createContent: false,
    deleteContent: false,
    approveChanges: false,
    submitChanges: false
  });
  const [newRoleTeamPerms, setNewRoleTeamPerms] = useState({
    viewTeam: false,
    manageTeam: false,
    assignTasks: false,
    manageRoles: false
  });
  const [newRoleSettingsPerms, setNewRoleSettingsPerms] = useState({
    viewSettings: false,
    manageSettings: false,
    manageWorkflow: false,
    manageIntegrations: false
  });
  
  // Add Tag Modal state
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366F1');
  const [isSavingTag, setIsSavingTag] = useState(false);
  
  // API Key state
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Notifications save state
  const [notificationsSaveState, setNotificationsSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  
  // Delete Project Modal state
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [deleteProjectConfirmText, setDeleteProjectConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDisciplines = useCallback(async () => {
    if (!projectPublicId) return;
    setIsLoadingDisciplines(true);
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/disciplines`);
      const data = res.ok ? await res.json() : null;
      if (data?.data) {
        setDisciplines(data.data.map((d: any) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          color: d.color,
          createdBy: d.createdBy,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })));
      }
    } catch {
      // keep stale disciplines
    } finally {
      setIsLoadingDisciplines(false);
    }
  }, [projectPublicId]);

  useEffect(() => {
    void loadDisciplines();
  }, [loadDisciplines]);

  const fetchWorkflowTemplates = useCallback(async () => {
    setWorkflowTemplatesLoading(true);
    try {
      const [myRes, downloadedRes, libraryRes] = await Promise.all([
        workflowTemplateService.getMyTemplates({ limit: 100 }),
        workflowTemplateService.getDownloadedTemplates({ limit: 100 }),
        workflowTemplateService.getTemplates({ limit: 100, sort: 'recent' }),
      ]);

      const byId = new Map<string, WorkflowTemplate>();
      [...myRes.templates, ...downloadedRes.templates, ...libraryRes.templates].forEach((template) => {
        if (!template?.publicId) return;
        if (!byId.has(template.publicId)) {
          byId.set(template.publicId, template);
        }
      });

      setWorkflowTemplates(Array.from(byId.values()));
    } catch (error) {
      console.error('Failed to fetch workflow templates:', error);
    } finally {
      setWorkflowTemplatesLoading(false);
    }
  }, []);

  // Fetch available workflow templates (my + downloaded + template library)
  useEffect(() => {
    void fetchWorkflowTemplates();

    // Listen for workflow changes (including copied/deleted templates)
    const handleWorkflowChanged = () => {
      void fetchWorkflowTemplates();
    };
    window.addEventListener('workflow-created', handleWorkflowChanged);
    window.addEventListener('workflow-updated', handleWorkflowChanged);
    window.addEventListener('workflow-deleted', handleWorkflowChanged);

    return () => {
      window.removeEventListener('workflow-created', handleWorkflowChanged);
      window.removeEventListener('workflow-updated', handleWorkflowChanged);
      window.removeEventListener('workflow-deleted', handleWorkflowChanged);
    };
  }, [fetchWorkflowTemplates]);

  const handleDeleteDiscipline = async (id: string) => {
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/disciplines/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDisciplines(prev => prev.filter(d => d.id !== id));
        toast.success('Discipline deleted');
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to delete discipline');
      }
    } catch {
      toast.error('Failed to delete discipline');
    }
  };

  const handleDeleteProject = async () => {
    if (deleteProjectConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const response = await apiFetch(`/api/projects/trash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData?.message || 'Failed to delete project');
        return;
      }
      
      toast.success('Project moved to trash');
      navigate('/projects');
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Handle General Settings Save
  const handleSaveGeneralSettings = async () => {
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setGeneralSaveState('saving');
    try {
      let finalCoverImageUrl: string | undefined;

      // Nếu có file avatar mới, upload trước
      if (pendingAvatarFile) {
        const publicUrl = await uploadProjectAvatar(projectPublicId, pendingAvatarFile);
        finalCoverImageUrl = publicUrl;
        // Xóa preview tạm, dùng URL thật
        setPendingAvatarFile(null);
        setPendingAvatarPreview(null);
        setCoverImageUrl(publicUrl);
      }

      const updates: { name: string; description: string; coverImageUrl?: string } = {
        name: name.trim(),
        description: description.trim(),
      };

      if (finalCoverImageUrl) {
        updates.coverImageUrl = finalCoverImageUrl;
      } else if (coverImageUrl) {
        updates.coverImageUrl = coverImageUrl;
      }

      await updateProject(projectPublicId, updates);
      setGeneralSaveState('success');
      toast.success('Settings saved successfully');
      setCoverImageUrl(null);
      onSettingsUpdated?.();
      onActivityAdded?.(); // Trigger activities refresh

      // Update project name in localStorage for TopBar
      try {
        const userId = (() => {
          try {
            const u = localStorage.getItem('orbit_user');
            if (u) return JSON.parse(u).id;
          } catch { /* ignore */ }
          return null;
        })();
        const storageKey = userId ? `orbit-open-projects:${userId}` : 'orbit-open-projects';
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const projects = JSON.parse(stored);
          const updatedProjects = projects.map((p: { id: string; title: string; path: string }) =>
            p.id === projectPublicId ? { ...p, title: name.trim() } : p
          );
          localStorage.setItem(storageKey, JSON.stringify(updatedProjects));
          // Dispatch custom event for TopBar to update immediately
          window.dispatchEvent(new CustomEvent('orbit:project-updated', {
            detail: { projectId: projectPublicId, title: name.trim() }
          }));
        }
      } catch { /* ignore localStorage errors */ }
    } catch {
      setGeneralSaveState('error');
      toast.error('Failed to save settings');
    }
    setTimeout(() => setGeneralSaveState('idle'), 3000);
  };
  
  // Handle Change Image
  const handleChangeImage = () => {
    fileInputRef.current?.click();
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const preview = reader.result as string;
      setPendingAvatarPreview(preview); // Chỉ preview tạm
      setProjectThumbnail(preview); // Preview trên UI
    };
    reader.readAsDataURL(file);

    // Lưu file để upload khi nhấn Save Changes
    setPendingAvatarFile(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Handle Edit Discipline
  const handleEditDiscipline = (discipline: Discipline) => {
    setEditingDiscipline(discipline);
    setNewDisciplineName(discipline.name);
    setNewDisciplineDescription(discipline.description);
    setNewDisciplineColor(discipline.color || '#6366f1');
    setShowEditDisciplineModal(true);
  };
  
  const handleSaveEditedDiscipline = async () => {
    if (!newDisciplineName.trim()) {
      setDisciplineNameError(true);
      return;
    }
    if (!editingDiscipline) return;

    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/disciplines/${editingDiscipline.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDisciplineName.trim(),
          description: newDisciplineDescription.trim(),
          color: newDisciplineColor,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDisciplines(prev => prev.map(d =>
          d.id === editingDiscipline.id
            ? { ...d, name: data.data.name, description: data.data.description, color: data.data.color }
            : d
        ));
        toast.success('Discipline updated');
        onActivityAdded?.(); // Trigger activities refresh
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to update discipline');
      }
    } catch {
      toast.error('Failed to update discipline');
    } finally {
      setShowEditDisciplineModal(false);
      setEditingDiscipline(null);
      setNewDisciplineName('');
      setNewDisciplineDescription('');
      setDisciplineNameError(false);
    }
  };
  
  // Handle Toggle Page Visibility
  const handleTogglePageVisibility = (id: string) => {
    setNavigationPages(navigationPages.map(p => 
      p.id === id ? { ...p, isVisible: !p.isVisible } : p
    ));
    setPagesModified(true);
  };
  
  // Handle Delete Page
  const handleDeletePage = (id: string) => {
    setNavigationPages(navigationPages.filter(p => p.id !== id));
    setPagesModified(true);
  };
  
  // Handle Edit Page
  const handleEditPage = (page: NavigationPage) => {
    setEditingPage(page);
    setNewPageName(page.name);
    setNewPageIcon(page.icon);
    setShowEditPageModal(true);
  };
  
  const handleSaveEditedPage = () => {
    if (!newPageName.trim()) return;
    if (editingPage) {
      setNavigationPages(navigationPages.map(p => 
        p.id === editingPage.id 
          ? { ...p, name: newPageName.trim(), icon: newPageIcon }
          : p
      ));
      setShowEditPageModal(false);
      setEditingPage(null);
      setNewPageName('');
      setNewPageIcon('file');
      setPagesModified(true);
    }
  };
  
  // Handle Edit Tag
  const handleEditTag = (tag: TaskTag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagDescription(tag.description);
    setEditTagColor(tag.color);
    setShowEditTagModal(true);
  };
  
  const handleSaveEditedTag = async () => {
    if (!editingTag || !editTagName.trim()) return;

    const previous = taskTags;
    const next = taskTags.map((tag) =>
      tag.id === editingTag.id
        ? {
            ...tag,
            name: editTagName.trim().toLowerCase(),
            description: editTagDescription.trim(),
            color: editTagColor,
          }
        : tag
    );

    setTaskTags(next);

    try {
      const ok = await persistTaskTags(next);
      if (!ok) {
        setTaskTags(previous);
        toast.error('Failed to update tag');
        return;
      }
    } catch {
      setTaskTags(previous);
      toast.error('Failed to update tag');
      return;
    }

    setShowEditTagModal(false);
    setEditingTag(null);
    setEditTagName('');
    setEditTagDescription('');
    setEditTagColor('#6366F1');
  };

  const persistTaskTags = async (nextTags: TaskTag[]) => {
    if (!projectPublicId) return true;

    const response = await apiFetch('/api/projects/workflow/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        projectId: projectPublicId,
        taskTags: nextTags.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          color: t.color,
        })),
      }),
    });

    return response.ok;
  };

  const handleApplyWorkflow = async () => {
    if (!projectPublicId) return;
    if (!selectedWorkflow) {
      toast.error('Please select a workflow template first');
      return;
    }

    setWorkflowApplyState('applying');
    try {
      const applyRes = await apiFetch('/api/projects/workflow/apply-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: projectPublicId,
          workflowTemplateId: selectedWorkflow,
        }),
      });

      if (!applyRes.ok) {
        const errorPayload = await applyRes.json().catch(() => null);
        toast.error(errorPayload?.message || 'Failed to apply workflow template');
        setWorkflowApplyState('idle');
        return;
      }

      const settingsRes = await apiFetch('/api/projects/workflow/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          projectId: projectPublicId,
          settings: {
            autoAssign: workflowSettings.autoAssign,
            notifyStatusChange: workflowSettings.notifyStatusChange,
            requireApproval: workflowSettings.requireApproval,
          },
        }),
      });

      if (!settingsRes.ok) {
        const errorPayload = await settingsRes.json().catch(() => null);
        toast.error(errorPayload?.message || 'Workflow template applied, but failed to save workflow settings');
        setWorkflowApplyState('idle');
        return;
      }

      setWorkflowApplyState('success');
      window.dispatchEvent(new CustomEvent('workflow-applied', {
        detail: { projectId: projectPublicId, workflowId: selectedWorkflow },
      }));
      toast.success('Workflow applied successfully');
      onActivityAdded?.();
      setTimeout(() => setWorkflowApplyState('idle'), 3000);
    } catch {
      toast.error('Failed to apply workflow');
      setWorkflowApplyState('idle');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadWorkflowData = async () => {
      if (!projectPublicId) return;

      setIsLoadingTaskTags(true);
      try {
        const response = await apiFetch('/api/projects/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId }),
        });

        if (!response.ok) return;

        const payload = await response.json();

        // Set workflowTemplateId from project
        const workflowTemplateId = payload?.data?.workflowTemplateId;
        if (!cancelled && workflowTemplateId) {
          setSelectedWorkflow(workflowTemplateId);
        }

        const settings = payload?.data?.settings;
        if (!cancelled && settings) {
          setWorkflowSettings({
            autoAssign: Boolean(settings.autoAssign),
            notifyStatusChange: Boolean(settings.notifyStatusChange),
            requireApproval: Boolean(settings.requireApproval),
          });
        }

        const tags = Array.isArray(payload?.data?.taskTags) ? payload.data.taskTags : [];
        if (!cancelled && tags.length > 0) {
          setTaskTags(
            tags.map((t: any) => ({
              id: String(t.id || Date.now()),
              name: String(t.name || '').toLowerCase(),
              description: String(t.description || ''),
              color: String(t.color || '#6366F1'),
            }))
          );
        }
      } catch {
        // keep default tags
      } finally {
        if (!cancelled) setIsLoadingTaskTags(false);
      }
    };

    loadWorkflowData();

    // Listen for workflow applied to project
    const handleWorkflowApplied = () => loadWorkflowData();
    window.addEventListener('workflow-applied', handleWorkflowApplied);

    return () => {
      cancelled = true;
      window.removeEventListener('workflow-applied', handleWorkflowApplied);
    };
  }, [projectPublicId]);

  const loadRoles = useCallback(async (options?: { cancelled?: () => boolean }) => {
    if (!projectPublicId) return;

    setIsLoadingRoles(true);
    try {
      const data = await fetchProjectRoles(projectPublicId);
      if (!options?.cancelled?.() && Array.isArray(data) && data.length > 0) {
        setRoles(data);
      }
    } catch {
      // keep default roles on error
    } finally {
      if (!options?.cancelled?.()) setIsLoadingRoles(false);
    }
  }, [projectPublicId]);

  // Load roles from API
  useEffect(() => {
    let cancelled = false;

    void loadRoles({ cancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadRoles]);

  useEffect(() => {
    if (!projectPublicId) return;

    const socket = getSocket();
    socket.emit('project:join', { projectId: projectPublicId });

    const isThisProject = (payload?: { projectId?: string }) => payload?.projectId === projectPublicId;
    const handleDisciplinesChanged = (payload?: { projectId?: string }) => {
      if (isThisProject(payload)) void loadDisciplines();
    };
    const handleRolesChanged = (payload?: { projectId?: string }) => {
      if (isThisProject(payload)) void loadRoles();
    };
    const handleWorkflowChanged = (payload?: { projectId?: string }) => {
      if (!isThisProject(payload)) return;
      window.dispatchEvent(new CustomEvent('workflow-applied', { detail: payload }));
    };
    const handleProjectUpdated = (payload?: { projectId?: string; changes?: Record<string, unknown> }) => {
      if (!isThisProject(payload)) return;
      const changes = payload?.changes || {};
      if ('workflow' in changes || 'workflowTemplateId' in changes || 'taskTags' in changes || 'settings' in changes) {
        window.dispatchEvent(new CustomEvent('workflow-applied', { detail: payload }));
      }
    };
    const handleWorkflowTemplateChanged = () => {
      void fetchWorkflowTemplates();
    };

    socket.on('disciplines:changed', handleDisciplinesChanged);
    socket.on('roles:changed', handleRolesChanged);
    socket.on('project:member:joined', handleRolesChanged);
    socket.on('project:member:left', handleRolesChanged);
    socket.on('project:member:role-updated', handleRolesChanged);
    socket.on('project:workflow-updated', handleWorkflowChanged);
    socket.on('project:updated', handleProjectUpdated);
    socket.on('workflow-template:changed', handleWorkflowTemplateChanged);

    return () => {
      socket.off('disciplines:changed', handleDisciplinesChanged);
      socket.off('roles:changed', handleRolesChanged);
      socket.off('project:member:joined', handleRolesChanged);
      socket.off('project:member:left', handleRolesChanged);
      socket.off('project:member:role-updated', handleRolesChanged);
      socket.off('project:workflow-updated', handleWorkflowChanged);
      socket.off('project:updated', handleProjectUpdated);
      socket.off('workflow-template:changed', handleWorkflowTemplateChanged);
      socket.emit('project:leave', { projectId: projectPublicId });
    };
  }, [projectPublicId, loadDisciplines, loadRoles, fetchWorkflowTemplates]);

  // Load report data when switching to Reports tab
  useEffect(() => {
    if (activeMenu !== 'reports') return;
    if (!projectPublicId) return;
    if (reportData !== null) return; // already loaded

    let cancelled = false;
    const loadReport = async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        const data = await fetchProjectReport(projectPublicId);
        if (!cancelled) setReportData(data);
      } catch (err: any) {
        if (!cancelled) setReportError(err?.message || 'Failed to load report data');
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [activeMenu, projectPublicId, reportData]);

  const handleDeleteTag = async (id: string) => {
    const previous = taskTags;
    const next = taskTags.filter((t) => t.id !== id);
    setTaskTags(next);

    try {
      const ok = await persistTaskTags(next);
      if (!ok) {
        setTaskTags(previous);
        toast.error('Failed to delete tag');
      }
    } catch {
      setTaskTags(previous);
      toast.error('Failed to delete tag');
    }
  };

  const handleExportReport = async (format: 'pdf' | 'csv' | 'xlsx') => {
    if (!projectPublicId) return;
    setExportingFormat(format);
    try {
      const response = await exportProjectReport(projectPublicId, format);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : format;
      a.download = `project-report-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} report exported successfully`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to export ${format.toUpperCase()} report`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDeleteRole = async (id: string) => {
    const previous = roles;
    const next = roles.filter(r => r.id !== id);
    setRoles(next);

    if (!projectPublicId) {
      setRoles(previous);
      return;
    }

    try {
      await deleteProjectRole(id);
    } catch {
      setRoles(previous);
      toast.error('Failed to delete role');
    }
  };

  const handleToggleNotification = (id: string, channel: 'email' | 'inApp' | 'push') => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, [channel]: !n[channel] } : n
    ));
  };

  const handleToggleIntegration = (id: string) => {
    setIntegrations(integrations.map(i => 
      i.id === id ? { ...i, connected: !i.connected } : i
    ));
  };

  const handlePermissionChange = (role: string, category: string, level: string) => {
    setPermissionMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role], [category]: level }
    }));
  };

  const getAccessLevelBadge = (level: 'full' | 'high' | 'medium' | 'minimal') => {
    switch (level) {
      case 'full': return { text: 'Full Access', bg: 'bg-purple-100', color: 'text-purple-600' };
      case 'high': return { text: 'High Access', bg: 'bg-red-100', color: 'text-red-600' };
      case 'medium': return { text: 'Medium Access', bg: 'bg-blue-100', color: 'text-blue-600' };
      case 'minimal': return { text: 'Minimal Access', bg: 'bg-gray-100', color: 'text-gray-600' };
    }
  };

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      '#6366f1': 'bg-indigo-100 text-indigo-600',
      '#8B5CF6': 'bg-purple-100 text-purple-600',
      '#3B82F6': 'bg-blue-100 text-blue-600',
      '#10B981': 'bg-emerald-100 text-emerald-600',
      '#F97316': 'bg-orange-100 text-orange-600',
      '#14B8A6': 'bg-teal-100 text-teal-600',
      '#EF4444': 'bg-red-100 text-red-600',
      '#F59E0B': 'bg-amber-100 text-amber-600',
      '#6B7280': 'bg-gray-100 text-gray-600',
      '#EC4899': 'bg-pink-100 text-pink-600',
      '#84CC16': 'bg-lime-100 text-lime-600',
      '#06B6D4': 'bg-cyan-100 text-cyan-600',
    };
    const hex = color.startsWith('#') ? color : `#${color}`;
    return colorMap[hex] || 'bg-indigo-100 text-indigo-600';
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Owner': return { bg: 'bg-purple-100', color: 'text-purple-600' };
      case 'Admin': return { bg: 'bg-red-100', color: 'text-red-600' };
      case 'Member': return { bg: 'bg-blue-100', color: 'text-blue-600' };
      case 'Viewer': return { bg: 'bg-gray-100', color: 'text-gray-600' };
      default: return { bg: 'bg-gray-100', color: 'text-gray-600' };
    }
  };

  const handleAddDiscipline = async () => {
    if (!newDisciplineName.trim()) {
      setDisciplineNameError(true);
      return;
    }
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/disciplines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDisciplineName.trim(),
          description: newDisciplineDescription.trim(),
          color: newDisciplineColor,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDisciplines(prev => [...prev, data.data]);
        toast.success('Discipline added');
        onActivityAdded?.(); // Trigger activities refresh
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to add discipline');
      }
    } catch {
      toast.error('Failed to add discipline');
    } finally {
      setNewDisciplineName('');
      setNewDisciplineDescription('');
      setNewDisciplineColor('#6366f1');
      setDisciplineNameError(false);
      setShowAddDisciplineModal(false);
    }
  };

  const resetAndCloseModal = () => {
    setNewDisciplineName('');
    setNewDisciplineDescription('');
    setNewDisciplineColor('#6366f1');
    setDisciplineNameError(false);
    setShowAddDisciplineModal(false);
    setShowEditDisciplineModal(false);
    setEditingDiscipline(null);
  };

  const handleApplyTemplate = (template: ProjectTemplate) => {
    const newPages = template.pages.map((page, index) => ({
      id: `template-${Date.now()}-${index}`,
      name: page.name,
      icon: page.icon,
      isDefault: index < 4,
      isVisible: true,
    }));
    setNavigationPages(newPages);
    setPagesModified(true);
    setTemplateApplied(template.name);
    setTimeout(() => setTemplateApplied(null), 3000);
    setShowTemplatesModal(false);
  };

  const handleAddPage = () => {
    if (newPageName.trim()) {
      const newPage: NavigationPage = {
        id: Date.now().toString(),
        name: newPageName.trim(),
        icon: newPageIcon,
        isDefault: false,
        isVisible: true,
      };
      setNavigationPages([...navigationPages, newPage]);
      setNewPageName('');
      setNewPageIcon('file');
      setPagesModified(true);
      setShowAddPageModal(false);
    }
  };

  const handleSavePages = () => {
    setPagesModified(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'cube': return Box;
      case 'code': return Code;
      case 'book': return BookOpen;
      case 'folder': return Folder;
      default: return Folder;
    }
  };

  const getPageIcon = (iconName: string) => {
    switch (iconName) {
      case 'grid': return LayoutGrid;
      case 'folder': return FolderOpen;
      case 'file': return FileDoc;
      case 'git': return GitCompare;
      case 'refresh': return RefreshCcw;
      case 'alert': return AlertTriangle;
      case 'puzzle': return Puzzle;
      case 'users': return Users;
      case 'cube': return Box;
      case 'code': return Code;
      case 'database': return Database;
      case 'book': return BookOpen;
      case 'folder2': return Folder;
      case 'chart': return BarChart3;
      case 'settings': return Settings;
      case 'zap': return Zap;
      default: return FileDoc;
    }
  };

  return (
    <>
    {/* Add Discipline Modal */}
    {showAddDisciplineModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={resetAndCloseModal} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Add New Discipline</h2>
            <button 
              onClick={resetAndCloseModal}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Discipline Name */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">
                Discipline Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newDisciplineName}
                onChange={(e) => {
                  setNewDisciplineName(e.target.value);
                  if (e.target.value.trim()) setDisciplineNameError(false);
                }}
                placeholder="e.g., Civil Engineering"
                className={cn(
                  "w-full rounded-[10px] border bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1",
                  disciplineNameError 
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                    : "border-[#E5E7EB] focus:border-[#155DFC] focus:ring-[#155DFC]"
                )}
              />
              {disciplineNameError && (
                <p className="text-[13px] text-red-500 mt-1">Discipline name is required</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Description</label>
              <textarea
                value={newDisciplineDescription}
                onChange={(e) => setNewDisciplineDescription(e.target.value)}
                placeholder="Brief description of this discipline..."
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>

            {/* Color */}
            <div className="mb-2">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Color</label>
              <div className="flex items-center gap-3">
                <div 
                  className="h-12 w-16 rounded-[10px] border border-[#E5E7EB]"
                  style={{ backgroundColor: newDisciplineColor }}
                />
                <input
                  type="text"
                  value={newDisciplineColor}
                  onChange={(e) => setNewDisciplineColor(e.target.value)}
                  className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                />
                <label
                  htmlFor="color-picker"
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Pick Color
                </label>
                <input
                  type="color"
                  value={newDisciplineColor}
                  onChange={(e) => setNewDisciplineColor(e.target.value)}
                  className="sr-only"
                  id="color-picker"
                />
              </div>
              <p className="text-[13px] text-[#6A7282] mt-2">Choose a color to represent this discipline</p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={resetAndCloseModal}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddDiscipline}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Add Discipline
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Project Templates Modal */}
    {showTemplatesModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => setShowTemplatesModal(false)} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[600px] max-w-[90vw] max-h-[85vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Project Templates</h2>
            <button 
              onClick={() => setShowTemplatesModal(false)}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1">
            <div className="space-y-4">
              {projectTemplates.map((template) => {
                const TemplateIcon = getTemplateIcon(template.icon);
                return (
                  <div key={template.id} className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]">
                          <TemplateIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-[16px] font-medium text-[#101828]">{template.name}</h3>
                          <p className="text-[14px] text-[#6A7282]">{template.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleApplyTemplate(template)}
                        className="rounded-[10px] bg-[#155DFC] h-9 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {template.pages.map((page, index) => {
                        const PageIcon = getPageIcon(page.icon);
                        return (
                          <div key={index} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] text-[13px] text-[#374151]">
                            <PageIcon className="h-3.5 w-3.5" />
                            {page.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Add New Page Modal */}
    {showAddPageModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => setShowAddPageModal(false)} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Add New Page</h2>
            <button 
              onClick={() => setShowAddPageModal(false)}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Page Name */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Page Name</label>
              <input
                type="text"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g., 3D Viewer, Reports, Analytics"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
            </div>

            {/* Select Icon */}
            <div className="mb-2">
              <label className="block text-[14px] font-medium text-[#374151] mb-3">Select Icon</label>
              <div className="grid grid-cols-4 gap-3">
                {pageIconOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setNewPageIcon(option.id)}
                      className={cn(
                        "h-16 rounded-[10px] border-2 flex items-center justify-center transition-all",
                        newPageIcon === option.id
                          ? "border-[#155DFC] bg-[#EEF2FF] text-[#155DFC]"
                          : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#9CA3AF]"
                      )}
                    >
                      <IconComponent className="h-6 w-6" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={() => setShowAddPageModal(false)}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPage}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Add Page
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="flex h-full">
      {/* Settings Sidebar - Fixed full screen height, no scroll */}
      <div className="w-[220px] border-r border-[#E5E7EB] bg-[#F9FAFB] flex flex-col fixed left-0 top-[105px] bottom-0 overflow-visible z-10">
<div className="p-8 flex-1">
  <h3 className="text-[14px] font-normal text-[#616874] uppercase tracking-wider mb-3">Project Settings</h3>
          <div className="flex flex-col gap-1">
            {settingsMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-normal transition-all duration-150 text-left",
                    activeMenu === item.id
                      ? "bg-white text-[#111827] shadow-sm"
                      : "text-[#616874] hover:bg-white/60 hover:text-[#111827] active:bg-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        
{/* Delete Project Button */}
  <div className="p-8 shrink-0">
  <button 
    onClick={() => setShowDeleteProjectModal(true)}
    className="flex items-center gap-2 text-[14px] font-normal text-red-500 hover:text-red-600 transition-colors"
  >
  <Trash2 className="h-4 w-4" />
  Delete Project
  </button>
  </div>
  </div>

      {/* Main Content - Scrollable, with left margin for fixed sidebar */}
      <div className="flex-1 overflow-y-auto ml-[220px]">
        {activeMenu === 'general' && (
          <div className="py-6 px-6 lg:px-[40px] xl:px-[80px]">
            <div className="max-w-[560px]">
              <h2 className="text-[24px] font-normal text-[#101828] mb-6">General Settings</h2>

            {/* Project Thumbnail */}
            <div className="mb-6">
              <label className="block text-[14px] font-normal text-[#101828] mb-2">Project Thumbnail</label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-32 rounded-[10px] border border-[#E5E7EB] bg-gray-100 overflow-hidden flex items-center justify-center relative">
                  {projectThumbnail ? (
                    <img 
                      src={projectThumbnail} 
                      alt="Project thumbnail" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className={cn(
                      "h-full w-full flex items-center justify-center",
                      projectType === 'software' && "bg-gradient-to-br from-cyan-50 to-cyan-100",
                      projectType === 'design' && "bg-gradient-to-br from-purple-50 to-purple-100",
                      projectType === 'construction' && "bg-gradient-to-br from-blue-50 to-blue-100",
                      projectType === 'research' && "bg-gradient-to-br from-teal-50 to-teal-100",
                      !projectType && "bg-gradient-to-br from-gray-50 to-gray-100"
                    )}>
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        projectType === 'software' && "bg-cyan-500 text-white",
                        projectType === 'design' && "bg-purple-500 text-white",
                        projectType === 'construction' && "bg-blue-500 text-white",
                        projectType === 'research' && "bg-teal-500 text-white",
                        !projectType && "bg-gray-500 text-white"
                      )}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {projectType === 'software' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />}
                          {projectType === 'design' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />}
                          {projectType === 'construction' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
                          {projectType === 'research' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />}
                          {!projectType && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />}
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleChangeImage}
                    className="inline-flex items-center gap-2 text-[14px] text-[#155DFC] hover:underline"
                  >
                    <Upload className="h-4 w-4" />
                    Change image
                  </button>
                  {(coverImageUrl || pendingAvatarPreview) && (
                    <button
                      onClick={async () => {
                        // Nếu chỉ là preview tạm (chưa save), bỏ preview là đủ
                        if (pendingAvatarPreview) {
                          setPendingAvatarFile(null);
                          setPendingAvatarPreview(null);
                          // Reset về ảnh đã lưu trước đó (hoặc placeholder)
                          setProjectThumbnail(coverImageUrl || '');
                          return;
                        }
                        // Nếu có ảnh đã lưu, xóa trên server
                        if (!projectPublicId) return;
                        try {
                          await deleteProjectAvatar(projectPublicId);
                          setCoverImageUrl(null);
                          setProjectThumbnail('');
                          toast.success('Avatar removed');
                        } catch {
                          toast.error('Failed to remove avatar');
                        }
                      }}
                      className="inline-flex items-center gap-2 text-[14px] text-red-500 hover:text-red-600 hover:underline"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Project Name */}
            <div className="mb-6">
              <label className="block text-[14px] font-normal text-[#101828] mb-2">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-[14px] font-normal text-[#101828] mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>


            {/* Disciplines Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-medium text-[#101828]">Disciplines</h3>
                <button 
                  onClick={() => setShowAddDisciplineModal(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-9 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Add Discipline
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {isLoadingDisciplines && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#155DFC]" />
                  </div>
                )}
                {!isLoadingDisciplines && disciplines.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <FileText className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-[14px] text-[#6A7282] mb-1">No disciplines yet</p>
                    <p className="text-[13px] text-[#9CA3AF]">Add a discipline to organize change requests</p>
                  </div>
                )}
                {!isLoadingDisciplines && disciplines.map((discipline) => (
                  <div
                    key={discipline.id}
                    className="flex items-center justify-between p-4 rounded-[10px] border border-[#E5E7EB] bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", getColorClass(discipline.color))}>
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-[14px] font-medium text-[#101828]">{discipline.name}</h4>
                        <p className="text-[13px] text-[#6A7282]">{discipline.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEditDiscipline(discipline)}
                        className="p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDiscipline(discipline.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Changes Button */}
              <div className="flex justify-end mt-8">
                {generalSaveState === 'success' && (
                  <div className="flex items-center gap-2 mr-4 text-[14px] text-green-600">
                    <Check className="h-4 w-4" />
                    Settings saved successfully!
                  </div>
                )}
                <button 
                  onClick={handleSaveGeneralSettings}
                  disabled={generalSaveState === 'saving'}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                    generalSaveState === 'saving' 
                      ? "bg-blue-400 text-white cursor-not-allowed"
                      : "bg-[#155DFC] text-white hover:bg-blue-700"
                  )}
                >
                  {generalSaveState === 'saving' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pages Tab */}
        {activeMenu === 'pages' && (
          <div className="p-6">
            <h2 className="text-[24px] font-normal text-[#101828] mb-6">Custom Pages</h2>

            {/* Save Success Message */}
            {showSaveSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[14px] flex items-center gap-2">
                <Check className="h-4 w-4" />
                Pages saved successfully!
              </div>
            )}
            
            {/* Template Applied Message */}
            {templateApplied && (
              <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[14px] flex items-center gap-2">
                <Check className="h-4 w-4" />
                Template "{templateApplied}" applied successfully!
              </div>
            )}

            {/* Quick Start with Templates */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-medium text-[#101828] mb-1">Quick Start with Templates</h3>
                  <p className="text-[14px] text-[#6A7282]">Apply a pre-configured page layout based on your project type</p>
                </div>
                <button 
                  onClick={() => setShowTemplatesModal(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Browse Templates
                </button>
              </div>
            </div>

            {/* Navigation Pages */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-medium text-[#101828]">Navigation Pages</h3>
                <button 
                  onClick={() => setShowAddPageModal(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-9 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Page
                </button>
              </div>

              <div className="space-y-0 divide-y divide-[#E5E7EB]">
                {navigationPages.map((page) => (
                  <div key={page.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      {/* Drag Handle */}
                      <button className="text-[#9CA3AF] hover:text-[#6A7282] cursor-grab">
                        <GripVertical className="h-5 w-5" />
                      </button>

                      {/* Icon */}
                      <div className="h-10 w-10 rounded-[8px] bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]">
                        {(() => {
                          const PageIconComponent = getPageIcon(page.icon);
                          return <PageIconComponent className="h-5 w-5" />;
                        })()}
                      </div>

                      {/* Name and Status */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[14px] font-medium", page.isVisible ? "text-[#101828]" : "text-[#9CA3AF]")}>{page.name}</span>
                          {page.isDefault && (
                            <span className="text-[11px] font-medium text-[#10B981] bg-[#D1FAE5] px-2 py-0.5 rounded">Default</span>
                          )}
                          {!page.isVisible && (
                            <span className="text-[11px] font-medium text-[#6A7282] bg-[#F3F4F6] px-2 py-0.5 rounded">Hidden</span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#6A7282]">{page.isVisible ? 'Visible in navigation' : 'Hidden from navigation'}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleTogglePageVisibility(page.id)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          page.isVisible 
                            ? "text-[#10B981] hover:bg-emerald-50" 
                            : "text-[#9CA3AF] hover:bg-gray-100"
                        )}
                        title={page.isVisible ? 'Hide page' : 'Show page'}
                      >
                        {page.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button 
                        onClick={() => handleEditPage(page)}
                        className="p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
                        title="Edit page"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!page.isDefault && (
                        <button 
                          onClick={() => handleDeletePage(page.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          title="Delete page"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tip */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 mb-6">
              <p className="text-[14px] text-[#374151]">
                <span className="mr-2">💡</span>
                <span className="font-medium">Tip:</span> Drag pages to reorder them. Default pages cannot be deleted but can be hidden.
              </p>
            </div>

            {/* Save Changes Button */}
            <div className="flex justify-end">
              <button 
                onClick={handleSavePages}
                disabled={!pagesModified}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  pagesModified
                    ? "bg-[#155DFC] text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeMenu === 'tasks' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[24px] font-normal text-[#101828]">Task Tags Management</h2>
              <button 
                onClick={() => setShowAddTagModal(true)}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Tag
              </button>
            </div>

            <div className="space-y-3">
              {taskTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-4 rounded-[12px] border border-[#E5E7EB] bg-white"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="h-10 w-10 rounded-[8px] flex items-center justify-center"
                      style={{ backgroundColor: `${tag.color}15` }}
                    >
                      <Tag className="h-5 w-5" style={{ color: tag.color }} />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-medium text-[#101828]">{tag.name}</h4>
                      <p className="text-[13px] text-[#6A7282]">{tag.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEditTag(tag)}
                      className="p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
                      title="Edit tag"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTag(tag.id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      title="Delete tag"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Tab */}
        {activeMenu === 'workflow' && (
          <div className="p-6">
            <h2 className="text-[24px] font-normal text-[#101828] mb-8">Workflow Configuration</h2>

            {/* Select Workflow Template */}
            <div className="mb-8">
              <p className="text-[14px] text-[#6A7282] mb-4">Select Workflow Template</p>
              
              <div className="space-y-4">
                {/* User's Workflow Templates */}
                {workflowTemplates.length > 0 && workflowTemplates.map((template) => (
                  <div
                    key={template.publicId}
                    onClick={() => setSelectedWorkflow(template.publicId)}
                    className={cn(
                      "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                      selectedWorkflow === template.publicId
                        ? "border-[#155DFC] bg-[#F8FAFF]"
                        : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6A7282]">
                          <GitBranch className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-[16px] font-medium text-[#101828]">{template.name}</h3>
                          <p className="text-[14px] text-[#6A7282] mb-3">{template.description || 'Custom workflow'}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {template.stages.slice(0, 5).map((stage, idx) => (
                              <span key={stage.id || idx} className="flex items-center">
                                <span className="px-3 py-1 rounded bg-[#F3F4F6] text-[13px] text-[#374151]">{stage.name}</span>
                                {idx < Math.min(template.stages.length - 1, 4) && <ChevronRight className="h-4 w-4 text-[#9CA3AF] mx-1" />}
                              </span>
                            ))}
                            {template.stages.length > 5 && (
                              <span className="px-2 py-1 text-[12px] text-[#6A7282]">+{template.stages.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedWorkflow === template.publicId && (
                          <CheckCircle2 className="h-5 w-5 text-[#155DFC]" />
                        )}
                        {/* Edit Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkflow(template);
                            setShowEditWorkflowModal(true);
                          }}
                          className="p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingWorkflow(template);
                            setShowDeleteWorkflowModal(true);
                          }}
                          className="p-2 rounded-lg text-[#6A7282] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Create Custom Workflow */}
                <div
                  onClick={() => setShowCreateWorkflowModal(true)}
                  className={cn(
                    "group rounded-[12px] border-2 p-5 cursor-pointer transition-all flex items-center justify-center min-h-[140px]",
                    "border-[#E5E7EB] bg-white hover:border-[#155DFC] hover:bg-[#F8FAFF]"
                  )}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] transition-colors group-hover:bg-[#E0E7FF] group-hover:text-[#155DFC]">
                      <Plus className="h-6 w-6" />
                    </div>
                    <span className="text-[14px] font-medium text-[#374151]">Create Workflow</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow Settings */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-8">
              <h3 className="text-[16px] font-medium text-[#101828] mb-5">Workflow Settings</h3>
              
              <div className="space-y-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={workflowSettings.autoAssign}
                    onChange={(e) => setWorkflowSettings({...workflowSettings, autoAssign: e.target.checked})}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#155DFC] focus:ring-[#155DFC]" 
                  />
                  <div>
                    <span className="text-[14px] font-medium text-[#101828]">Auto-assign tasks</span>
                    <p className="text-[13px] text-[#6A7282]">Automatically assign tasks based on team member roles</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={workflowSettings.notifyStatusChange}
                    onChange={(e) => setWorkflowSettings({...workflowSettings, notifyStatusChange: e.target.checked})}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#155DFC] focus:ring-[#155DFC]" 
                  />
                  <div>
                    <span className="text-[14px] font-medium text-[#101828]">Notify on status change</span>
                    <p className="text-[13px] text-[#6A7282]">Send notifications when task status changes</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={workflowSettings.requireApproval}
                    onChange={(e) => setWorkflowSettings({...workflowSettings, requireApproval: e.target.checked})}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#155DFC] focus:ring-[#155DFC]" 
                  />
                  <div>
                    <span className="text-[14px] font-medium text-[#101828]">Require approval for completion</span>
                    <p className="text-[13px] text-[#6A7282]">Tasks must be approved before marking as done</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              {workflowApplyState === 'success' && (
                <div className="flex items-center gap-2 text-[14px] text-green-600">
                  <Check className="h-4 w-4" />
                  Workflow applied successfully!
                </div>
              )}
              <button className="h-10 px-5 rounded-[10px] text-[14px] font-medium text-[#374151] hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleApplyWorkflow}
                disabled={workflowApplyState === 'applying'}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  workflowApplyState === 'applying' 
                    ? "bg-blue-400 text-white cursor-not-allowed"
                    : "bg-[#155DFC] text-white hover:bg-blue-700"
                )}
              >
                {workflowApplyState === 'applying' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Apply Workflow
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeMenu === 'permissions' && (
          <div className="p-6">
            <h2 className="text-[24px] font-normal text-[#101828] mb-6">Permissions & Access Control</h2>

            {/* Role Permissions Matrix */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6">
              <h3 className="text-[14px] font-medium text-[#6A7282] mb-4">Role Permissions Matrix</h3>
              
              {/* Role Tabs */}
              <div className="flex items-center gap-2 mb-6 border-b border-[#E5E7EB] pb-4">
                {['Owner', 'Admin', 'Member', 'Viewer'].map((role) => {
                  const badge = getRoleBadge(role);
                  const count = role === 'Owner' ? 1 : role === 'Admin' ? 3 : role === 'Member' ? 12 : 5;
                  return (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5 transition-colors",
                        selectedRole === role ? `${badge.bg} ${badge.color}` : "text-[#6A7282] hover:bg-gray-100"
                      )}
                    >
                      {role}
                      <span className={cn("text-[12px]", selectedRole === role ? badge.color : "text-[#9CA3AF]")}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Role Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded text-[12px] font-medium", getRoleBadge(selectedRole).bg, getRoleBadge(selectedRole).color)}>{selectedRole}</span>
                  <span className="text-[13px] text-[#6A7282] bg-[#F3F4F6] px-2 py-0.5 rounded">Default Role</span>
                </div>
                <span className="text-[13px] text-[#6A7282]">{selectedRole === 'Admin' ? '3' : selectedRole === 'Owner' ? '1' : selectedRole === 'Member' ? '12' : '5'} members with this role</span>
              </div>

              {/* Permission Categories */}
              <div className="space-y-0 divide-y divide-[#E5E7EB]">
                {permissionCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6A7282]">
                        {category.icon === 'file' && <FileDoc className="h-4 w-4" />}
                        {category.icon === 'git' && <GitCompare className="h-4 w-4" />}
                        {category.icon === 'list' && <ListTodo className="h-4 w-4" />}
                        {category.icon === 'package' && <FolderOpen className="h-4 w-4" />}
                        {category.icon === 'alert' && <AlertTriangle className="h-4 w-4" />}
                        {category.icon === 'box' && <Box className="h-4 w-4" />}
                        {category.icon === 'settings' && <Settings className="h-4 w-4" />}
                        {category.icon === 'users' && <Users className="h-4 w-4" />}
                      </div>
                      <div>
                        <h4 className="text-[14px] font-medium text-[#101828]">{category.name}</h4>
                        <p className="text-[13px] text-[#6A7282]">{category.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {['none', 'view', 'edit', 'manage'].map((level) => (
                        <button
                          key={level}
                          onClick={() => handlePermissionChange(selectedRole, category.id, level)}
                          className={cn(
                            "px-3 py-1.5 rounded text-[13px] font-medium capitalize transition-colors",
                            permissionMatrix[selectedRole]?.[category.id] === level
                              ? level === 'manage' ? "bg-orange-100 text-orange-600" :
                                level === 'edit' ? "bg-green-100 text-green-600" :
                                level === 'view' ? "bg-blue-100 text-blue-600" :
                                "bg-gray-100 text-gray-600"
                              : "text-[#6A7282] hover:bg-gray-50"
                          )}
                        >
                          {level === 'none' ? 'None' : level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Members */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-medium text-[#101828]">Team Members</h3>
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-9 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Invite
                </button>
              </div>

              <div className="space-y-0 divide-y divide-[#E5E7EB]">
                {teamMembers.map((member) => {
                  const badge = getRoleBadge(member.role);
                  return (
                    <div key={member.id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#155DFC] flex items-center justify-center text-white text-[14px] font-medium">
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-[14px] font-medium text-[#101828]">{member.name}</h4>
                          <p className="text-[13px] text-[#6A7282]">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn("px-2 py-0.5 rounded text-[12px] font-medium", badge.bg, badge.color)}>{member.role}</span>
                        <span className="text-[13px] text-[#6A7282]">Joined {member.joinedDate}</span>
                        <button 
                          onClick={() => setShowInviteModal(true)}
                          className="p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
                          title="Edit member"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {member.role !== 'Owner' && (
                          <button 
                            onClick={() => setTeamMembers(teamMembers.filter(m => m.id !== member.id))}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Permission Levels Legend */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6">
              <h3 className="text-[14px] font-medium text-[#101828] mb-4">Permission Levels</h3>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <div>
                    <span className="text-[14px] font-medium text-orange-600">Manage</span>
                    <p className="text-[12px] text-[#6A7282]">Full control</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <div>
                    <span className="text-[14px] font-medium text-green-600">Edit</span>
                    <p className="text-[12px] text-[#6A7282]">Modify content</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <div>
                    <span className="text-[14px] font-medium text-blue-600">View</span>
                    <p className="text-[12px] text-[#6A7282]">Read-only access</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  <div>
                    <span className="text-[14px] font-medium text-gray-600">None</span>
                    <p className="text-[12px] text-[#6A7282]">No access</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Changes */}
            <div className="flex items-center justify-end gap-3">
              {permissionsSaveState === 'success' && (
                <div className="flex items-center gap-2 text-[14px] text-green-600">
                  <Check className="h-4 w-4" />
                  Permissions saved successfully!
                </div>
              )}
              <button 
                onClick={async () => {
                  setPermissionsSaveState('saving');
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  setPermissionsSaveState('success');
                  setTimeout(() => setPermissionsSaveState('idle'), 3000);
                }}
                disabled={permissionsSaveState === 'saving'}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  permissionsSaveState === 'saving' 
                    ? "bg-blue-400 text-white cursor-not-allowed"
                    : "bg-[#155DFC] text-white hover:bg-blue-700"
                )}
              >
                {permissionsSaveState === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeMenu === 'roles' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[24px] font-normal text-[#101828]">Role Management</h2>
              <button 
                onClick={() => setShowCreateRoleModal(true)}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Role
              </button>
            </div>

            <div className="space-y-4">
              {roles.map((role) => {
                const badge = getAccessLevelBadge(role.accessLevel);
                return (
                  <div key={role.id} className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div 
                          className="h-12 w-12 rounded-[10px] flex items-center justify-center"
                          style={{ backgroundColor: `${role.color}15` }}
                        >
                          <Shield className="h-6 w-6" style={{ color: role.color }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[16px] font-medium text-[#101828]">{role.name}</h3>
                            <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium", badge.bg, badge.color)}>{badge.text}</span>
                            {role.isSystem && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#F3F4F6] text-[11px] font-medium text-[#6A7282]">
                                <Lock className="h-3 w-3" />
                                System Role
                              </span>
                            )}
                          </div>
                          <p className="text-[14px] text-[#6A7282] mb-3">{role.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {role.permissions.slice(0, 5).map((perm, idx) => (
                              <span key={idx} className="px-2 py-1 rounded bg-[#F3F4F6] text-[12px] text-[#374151]">{perm}</span>
                            ))}
                            {role.permissions.length > 5 && (
                              <span className="px-2 py-1 rounded bg-[#F3F4F6] text-[12px] text-[#6A7282]">+{role.permissions.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-[#6A7282]">
                          <Users className="h-4 w-4" />
                          <span className="text-[14px]">{role.memberCount}</span>
                        </div>
                        {!role.isSystem && (
                          <>
                            <button className="p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteRole(role.id)}
                              className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeMenu === 'notifications' && (
          <div className="p-6">
            <h2 className="text-[24px] font-normal text-[#101828] mb-6">Notification Settings</h2>

            {/* Notification Channels Header */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
              <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
                <h3 className="text-[16px] font-medium text-[#101828]">Notification Channels</h3>
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2 text-[13px] text-[#6A7282]">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-[#6A7282]">
                    <Bell className="h-4 w-4" />
                    In-App
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-[#6A7282]">
                    <MessageSquare className="h-4 w-4" />
                    Push
                  </div>
                </div>
              </div>

              {/* Group by category */}
              {['Tasks', 'Documents', 'Changes', 'Team'].map((category) => (
                <div key={category}>
                  <div className="px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <h4 className="text-[13px] font-medium text-[#374151] uppercase tracking-wide">{category}</h4>
                  </div>
                  {notifications.filter(n => n.category === category).map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] last:border-b-0">
                      <div>
                        <h4 className="text-[14px] font-medium text-[#101828]">{notification.title}</h4>
                        <p className="text-[13px] text-[#6A7282]">{notification.description}</p>
                      </div>
                      <div className="flex items-center gap-8">
                        {/* Email Toggle */}
                        <button 
                          onClick={() => handleToggleNotification(notification.id, 'email')}
                          className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center transition-colors border-2",
                            notification.email ? "bg-[#155DFC] border-[#155DFC] text-white" : "bg-white border-[#D1D5DB]"
                          )}
                        >
                          {notification.email && <Check className="h-3 w-3" />}
                        </button>
                        {/* In-App Toggle */}
                        <button 
                          onClick={() => handleToggleNotification(notification.id, 'inApp')}
                          className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center transition-colors border-2",
                            notification.inApp ? "bg-[#155DFC] border-[#155DFC] text-white" : "bg-white border-[#D1D5DB]"
                          )}
                        >
                          {notification.inApp && <Check className="h-3 w-3" />}
                        </button>
                        {/* Push Toggle */}
                        <button 
                          onClick={() => handleToggleNotification(notification.id, 'push')}
                          className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center transition-colors border-2",
                            notification.push ? "bg-[#155DFC] border-[#155DFC] text-white" : "bg-white border-[#D1D5DB]"
                          )}
                        >
                          {notification.push && <Check className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Quiet Hours */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-medium text-[#101828]">Quiet Hours</h3>
                    <p className="text-[14px] text-[#6A7282]">Pause notifications during specific hours</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#155DFC]"></div>
                </label>
              </div>
              <div className="flex items-center gap-4 ml-13">
                <div>
                  <label className="text-[13px] text-[#6A7282] mb-1 block">From</label>
                  <input type="time" defaultValue="22:00" className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-[14px]" />
                </div>
                <div>
                  <label className="text-[13px] text-[#6A7282] mb-1 block">To</label>
                  <input type="time" defaultValue="08:00" className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-[14px]" />
                </div>
              </div>
            </div>

            {/* Save Changes */}
            <div className="flex items-center justify-end gap-3">
              {notificationsSaveState === 'success' && (
                <div className="flex items-center gap-2 text-[14px] text-green-600">
                  <Check className="h-4 w-4" />
                  Notification settings saved!
                </div>
              )}
              <button 
                onClick={async () => {
                  setNotificationsSaveState('saving');
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  setNotificationsSaveState('success');
                  setTimeout(() => setNotificationsSaveState('idle'), 3000);
                }}
                disabled={notificationsSaveState === 'saving'}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  notificationsSaveState === 'saving' 
                    ? "bg-blue-400 text-white cursor-not-allowed"
                    : "bg-[#155DFC] text-white hover:bg-blue-700"
                )}
              >
                {notificationsSaveState === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeMenu === 'reports' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[24px] font-normal text-[#101828]">Project Reports</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!projectPublicId) return;
                    setReportLoading(true);
                    setReportError(null);
                    setReportData(null);
                    void fetchProjectReport(projectPublicId).then(data => setReportData(data)).catch((e: any) => setReportError(e?.message || 'Failed')).finally(() => setReportLoading(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Export Formats */}
            <div className="mb-8">
              <h3 className="text-[16px] font-medium text-[#101828] mb-4">Export Report</h3>
              <p className="text-[14px] text-[#6A7282] mb-4">
                Export a comprehensive project report with documents, tasks, progress, and recent activities. Reports reflect data at the time of export.
              </p>
              <div className="flex flex-wrap gap-3">
                {/* PDF Export */}
                <button
                  onClick={() => handleExportReport('pdf')}
                  disabled={exportingFormat !== null || !projectPublicId}
                  className="inline-flex items-center gap-2.5 rounded-[10px] border border-[#E5E7EB] bg-white px-5 py-3 text-[14px] font-medium text-[#101828] hover:bg-gray-50 hover:border-[#155DFC] hover:text-[#155DFC] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {exportingFormat === 'pdf' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#155DFC]" />
                  ) : (
                    <FileDoc className="h-5 w-5 text-red-500" />
                  )}
                  <div className="text-left">
                    <div>PDF</div>
                    <div className="text-[11px] font-normal text-[#9CA3AF]">Portable Document Format</div>
                  </div>
                </button>

                {/* CSV Export */}
                <button
                  onClick={() => handleExportReport('csv')}
                  disabled={exportingFormat !== null || !projectPublicId}
                  className="inline-flex items-center gap-2.5 rounded-[10px] border border-[#E5E7EB] bg-white px-5 py-3 text-[14px] font-medium text-[#101828] hover:bg-gray-50 hover:border-[#10B981] hover:text-[#10B981] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {exportingFormat === 'csv' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
                  ) : (
                    <FileText className="h-5 w-5 text-green-600" />
                  )}
                  <div className="text-left">
                    <div>CSV</div>
                    <div className="text-[11px] font-normal text-[#9CA3AF]">Comma-Separated Values</div>
                  </div>
                </button>

                {/* XLSX Export */}
                <button
                  onClick={() => handleExportReport('xlsx')}
                  disabled={exportingFormat !== null || !projectPublicId}
                  className="inline-flex items-center gap-2.5 rounded-[10px] border border-[#E5E7EB] bg-white px-5 py-3 text-[14px] font-medium text-[#101828] hover:bg-gray-50 hover:border-[#10B981] hover:text-[#10B981] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {exportingFormat === 'xlsx' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
                  ) : (
                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                  )}
                  <div className="text-left">
                    <div>XLSX</div>
                    <div className="text-[11px] font-normal text-[#9CA3AF]">Excel Spreadsheet</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Report Preview */}
            <div>
              <h3 className="text-[16px] font-medium text-[#101828] mb-4">Report Preview</h3>

              {reportLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#155DFC]" />
                  <span className="ml-3 text-[14px] text-[#6A7282]">Loading report data...</span>
                </div>
              )}

              {reportError && !reportLoading && (
                <div className="rounded-[12px] border border-red-200 bg-red-50 p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-[14px] font-medium text-red-600">{reportError}</p>
                  <p className="text-[12px] text-red-400 mt-1">
                    You may not have permission to view reports. Only Admin, Manager, or Member roles can export.
                  </p>
                </div>
              )}

              {reportData && !reportLoading && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-[8px] bg-[#EFF6FF] flex items-center justify-center">
                          <FileDoc className="h-5 w-5 text-[#155DFC]" />
                        </div>
                        <span className="text-[13px] font-medium text-[#6A7282]">Documents</span>
                      </div>
                      <div className="text-[28px] font-semibold text-[#101828]">{reportData.summary.totalDocuments}</div>
                      <div className="text-[12px] text-[#9CA3AF] mt-0.5">{reportData.summary.totalSizeMB} MB total</div>
                    </div>

                    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-[8px] bg-[#F0FDF4] flex items-center justify-center">
                          <ListTodo className="h-5 w-5 text-[#10B981]" />
                        </div>
                        <span className="text-[13px] font-medium text-[#6A7282]">Total Tasks</span>
                      </div>
                      <div className="text-[28px] font-semibold text-[#101828]">{reportData.summary.totalTasks}</div>
                      <div className="text-[12px] text-[#9CA3AF] mt-0.5">
                        {reportData.summary.completedTasks} completed · {reportData.summary.pendingTasks} pending
                      </div>
                    </div>

                    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-[8px] bg-[#FEF3C7] flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-[#F59E0B]" />
                        </div>
                        <span className="text-[13px] font-medium text-[#6A7282]">Progress</span>
                      </div>
                      <div className="text-[28px] font-semibold text-[#101828]">{reportData.summary.progressPercent}%</div>
                      <div className="mt-2 h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#10B981] transition-all duration-500"
                          style={{ width: `${reportData.summary.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Task Count by Status */}
                  {Object.keys(reportData.taskCountByStatus).length > 0 && (
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                      <h4 className="text-[14px] font-medium text-[#101828] mb-4">Task Count by Status</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Object.entries(reportData.taskCountByStatus).map(([status, count]) => {
                          const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                            backlog: { bg: 'bg-[#F3F4F6]', text: 'text-[#6A7282]', border: 'border-[#E5E7EB]' },
                            'to-do': { bg: 'bg-[#EFF6FF]', text: 'text-[#155DFC]', border: 'border-blue-200' },
                            'in-progress': { bg: 'bg-[#FFFBEB]', text: 'text-[#F59E0B]', border: 'border-amber-200' },
                            review: { bg: 'bg-[#F5F3FF]', text: 'text-[#8B5CF6]', border: 'border-purple-200' },
                            done: { bg: 'bg-[#F0FDF4]', text: 'text-[#10B981]', border: 'border-green-200' },
                          };
                          const colors = statusColors[status] || statusColors.backlog;
                          const displayStatus = status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                          return (
                            <div key={status} className={cn('rounded-[8px] border p-3 text-center', colors.bg, colors.border)}>
                              <div className={cn('text-[18px] font-semibold', colors.text)}>{count}</div>
                              <div className={cn('text-[11px] font-medium mt-0.5', colors.text)}>{displayStatus}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recent Activities */}
                  <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                    <h4 className="text-[14px] font-medium text-[#101828] mb-4">Recent Activities</h4>
                    {reportData.recentActivities.length === 0 ? (
                      <p className="text-[13px] text-[#9CA3AF] py-4 text-center">No recent activities to display.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.recentActivities.slice(0, 10).map((activity, index) => (
                          <div key={index} className="flex items-start gap-3 py-2 border-b border-[#F3F4F6] last:border-0">
                            <div className="h-2 w-2 rounded-full bg-[#155DFC] mt-2 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-[#374151]">{activity.description}</p>
                              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                                {activity.timestamp ? new Date(activity.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Export Time Disclaimer */}
                  <div className="flex items-start gap-2 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] px-4 py-3">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#92400E]">
                      Reports reflect data at the time of export. Only authorized users (Admin, Manager, Member roles) can export project reports.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeMenu === 'integrations' && (
          <div className="p-6">
            <h2 className="text-[24px] font-normal text-[#101828] mb-6">Integrations</h2>

            {/* Connected Integrations */}
            <div className="mb-6">
              <h3 className="text-[16px] font-medium text-[#101828] mb-4">Connected</h3>
              <div className="grid grid-cols-1 gap-4">
                {integrations.filter(i => i.connected).map((integration) => (
                  <div key={integration.id} className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center">
                          {integration.icon === 'drive' && <Globe className="h-6 w-6 text-[#4285F4]" />}
                          {integration.icon === 'slack' && <MessageSquare className="h-6 w-6 text-[#E01E5A]" />}
                          {integration.icon === 'discord' && (
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                            </svg>
                          )}
                          {integration.icon === 'autodesk' && <Box className="h-6 w-6 text-[#0696D7]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[16px] font-medium text-[#101828]">{integration.name}</h4>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[11px] font-medium text-green-600">
                              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Connected
                            </span>
                          </div>
                          <p className="text-[14px] text-[#6A7282]">{integration.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-4 py-2 rounded-lg text-[14px] font-medium text-[#374151] hover:bg-gray-100 transition-colors">
                          Configure
                        </button>
                        <button 
                          onClick={() => handleToggleIntegration(integration.id)}
                          className="px-4 py-2 rounded-lg text-[14px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Integrations by Category */}
            {['storage', 'communication', 'project', 'cad'].map((category) => {
              const availableInCategory = integrations.filter(i => !i.connected && i.category === category);
              if (availableInCategory.length === 0) return null;
              
              const categoryLabels: Record<string, string> = {
                storage: 'Cloud Storage',
                communication: 'Communication',
                project: 'Project Management',
                cad: 'CAD & BIM Tools'
              };
              
              return (
                <div key={category} className="mb-6">
                  <h3 className="text-[16px] font-medium text-[#101828] mb-4">{categoryLabels[category]}</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {availableInCategory.map((integration) => (
                      <div key={integration.id} className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center">
                              {integration.icon === 'dropbox' && <Box className="h-6 w-6 text-[#0061FF]" />}
                              {integration.icon === 'onedrive' && <Globe className="h-6 w-6 text-[#0078D4]" />}
                              {integration.icon === 'teams' && <Users className="h-6 w-6 text-[#6264A7]" />}
                              {integration.icon === 'jira' && <Zap className="h-6 w-6 text-[#0052CC]" />}
                              {integration.icon === 'revit' && <Box className="h-6 w-6 text-[#0696D7]" />}
                            </div>
                            <div>
                              <h4 className="text-[14px] font-medium text-[#101828]">{integration.name}</h4>
                              <p className="text-[13px] text-[#6A7282]">{integration.description}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleToggleIntegration(integration.id)}
                            className="inline-flex items-center gap-2 rounded-[10px] border border-[#155DFC] bg-white h-9 px-4 text-[14px] font-medium text-[#155DFC] hover:bg-blue-50 transition-colors"
                          >
                            <Link2 className="h-4 w-4" />
                            Connect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Discord Webhook */}
            <div className="rounded-[12px] border border-[#5865F2] bg-white p-5 mt-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 rounded-[10px] bg-[#5865F2]/10 flex items-center justify-center shrink-0">
                  <svg className="h-7 w-7 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[16px] font-semibold text-[#101828]">Discord Webhook</h3>
                    {discordEnabled && discordWebhook && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[11px] font-medium text-green-600">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-[#6A7282]">Send real-time activity notifications to your Discord channel with rich embeds</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={discordEnabled}
                    onChange={(e) => {
                      setDiscordEnabled(e.target.checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#5865F2] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                    Webhook URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={discordWebhook}
                      onChange={(e) => setDiscordWebhook(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-[8px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-[#5865F2] focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                    />
                    <button
                      onClick={async () => {
                        try {
                          const res = await apiFetch('/api/projects/integrations/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              projectId: projectPublicId,
                              discordWebhook,
                              discordEnabled,
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setIntegrations(prev => prev.map(i =>
                              i.id === '5' ? { ...i, connected: discordEnabled && Boolean(discordWebhook) } : i
                            ));
                          }
                        } catch { /* ignore */ }
                      }}
                      className="inline-flex items-center gap-2 rounded-[8px] bg-[#5865F2] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#4752C4] transition-colors shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="rounded-[8px] bg-[#F9FAFB] border border-[#E5E7EB] p-3">
                  <p className="text-[12px] font-medium text-[#374151] mb-2">Events that will be sent:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Task created/updated/deleted/moved', icon: 'T' },
                      { label: 'Folder created/renamed/deleted', icon: 'F' },
                      { label: 'File uploaded/renamed/deleted', icon: 'f' },
                    ].map((event) => (
                      <div key={event.label} className="flex items-center gap-2 text-[12px] text-[#6A7282]">
                        <div className="h-5 w-5 rounded bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {event.icon}
                        </div>
                        {event.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* API Access */}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-medium text-[#101828]">API Access</h3>
                    <p className="text-[14px] text-[#6A7282]">Generate API keys to integrate with custom applications</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const key = 'sk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
                    setGeneratedApiKey(key);
                    setShowApiKeyModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Key className="h-4 w-4" />
                  Generate API Key
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    
    {/* Edit Discipline Modal */}
    {showEditDisciplineModal && editingDiscipline && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={resetAndCloseModal} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Edit Discipline</h2>
            <button 
              onClick={resetAndCloseModal}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Discipline Name */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">
                Discipline Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newDisciplineName}
                onChange={(e) => {
                  setNewDisciplineName(e.target.value);
                  if (e.target.value.trim()) setDisciplineNameError(false);
                }}
                placeholder="e.g., Civil Engineering"
                className={cn(
                  "w-full rounded-[10px] border bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1",
                  disciplineNameError 
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                    : "border-[#E5E7EB] focus:border-[#155DFC] focus:ring-[#155DFC]"
                )}
              />
              {disciplineNameError && (
                <p className="text-[13px] text-red-500 mt-1">Discipline name is required</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-2">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Description</label>
              <textarea
                value={newDisciplineDescription}
                onChange={(e) => setNewDisciplineDescription(e.target.value)}
                placeholder="Brief description of this discipline..."
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>

            {/* Color */}
            <div className="mb-2">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Color</label>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex-shrink-0 border border-[#E5E7EB]"
                  style={{ backgroundColor: newDisciplineColor }}
                />
                <input
                  type="text"
                  value={newDisciplineColor}
                  onChange={(e) => setNewDisciplineColor(e.target.value)}
                  className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                />
                <input
                  type="color"
                  value={newDisciplineColor}
                  onChange={(e) => setNewDisciplineColor(e.target.value)}
                  className="sr-only"
                  id="edit-color-picker"
                />
                <label
                  htmlFor="edit-color-picker"
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Change Color
                </label>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={resetAndCloseModal}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditedDiscipline}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Edit Page Modal */}
    {showEditPageModal && editingPage && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => { setShowEditPageModal(false); setEditingPage(null); }} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Edit Page</h2>
            <button 
              onClick={() => { setShowEditPageModal(false); setEditingPage(null); }}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Page Name */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Page Name</label>
              <input
                type="text"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g., 3D Viewer, Reports, Analytics"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
            </div>

            {/* Select Icon */}
            <div className="mb-2">
              <label className="block text-[14px] font-medium text-[#374151] mb-3">Select Icon</label>
              <div className="grid grid-cols-4 gap-3">
                {pageIconOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setNewPageIcon(option.id)}
                      className={cn(
                        "h-16 rounded-[10px] border-2 flex items-center justify-center transition-all",
                        newPageIcon === option.id
                          ? "border-[#155DFC] bg-[#EEF2FF] text-[#155DFC]"
                          : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#9CA3AF]"
                      )}
                    >
                      <IconComponent className="h-6 w-6" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={() => { setShowEditPageModal(false); setEditingPage(null); }}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditedPage}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Edit Tag Modal */}
    {showEditTagModal && editingTag && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => { setShowEditTagModal(false); setEditingTag(null); }} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Edit Tag</h2>
            <button 
              onClick={() => { setShowEditTagModal(false); setEditingTag(null); }}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Tag Name */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Tag Name</label>
              <input
                type="text"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                placeholder="e.g., urgent, review"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Description</label>
              <textarea
                value={editTagDescription}
                onChange={(e) => setEditTagDescription(e.target.value)}
                placeholder="Brief description of this tag..."
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>

            {/* Color */}
            <div className="mb-2">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Color</label>
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-16 rounded-[10px] border border-[#E5E7EB]"
                  style={{ backgroundColor: editTagColor }}
                />
                <input
                  type="color"
                  value={editTagColor}
                  onChange={(e) => setEditTagColor(e.target.value)}
                  className="h-12 w-16 rounded-[10px] border border-[#E5E7EB] cursor-pointer"
                />
                <input
                  type="text"
                  value={editTagColor}
                  onChange={(e) => setEditTagColor(e.target.value)}
                  className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={() => {
                setShowEditTagModal(false);
                setEditingTag(null);
                setEditTagName('');
                setEditTagDescription('');
                setEditTagColor('#6366F1');
              }}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditedTag}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    )}
    
    
    {/* Invite Team Member Modal */}
    {showInviteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteRole(''); }} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Invite Team Member</h2>
            <button 
              onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteRole(''); }}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Email Address */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
            </div>

            {/* Role */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              >
                <option value="">Select a role</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>

            {/* Role Permissions */}
            <div className="rounded-[10px] bg-[#F9FAFB] p-4">
              <h4 className="text-[13px] font-medium text-[#6A7282] mb-3">Role Permissions:</h4>
              <div className="space-y-2">
                {[
                  { key: 'documents', label: 'Documents & Drawings' },
                  { key: 'versions', label: 'Version Control' },
                  { key: 'tasks', label: 'Tasks & Workflows' },
                  { key: 'packages', label: 'Packages' }
                ].map((permission) => (
                  <div key={permission.key} className="flex items-center justify-between py-2">
                    <span className="text-[14px] text-[#101828]">{permission.label}</span>
                    <select
                      value={invitePermissions[permission.key as keyof typeof invitePermissions]}
                      onChange={(e) => setInvitePermissions({...invitePermissions, [permission.key]: e.target.value})}
                      className="text-[14px] font-medium text-[#818CF8] bg-transparent border-none focus:outline-none cursor-pointer"
                    >
                      <option value="View">View</option>
                      <option value="Edit">Edit</option>
                      <option value="Manage">Manage</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteRole(''); }}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (inviteEmail && inviteRole) {
                  const newMember = {
                    id: Date.now().toString(),
                    name: inviteEmail.split('@')[0].split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' '),
                    email: inviteEmail,
                    role: inviteRole,
                    joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  };
                  setTeamMembers([...teamMembers, newMember]);
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteRole('');
                }
              }}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Send Invite
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Add Tag Modal */}
    {showAddTagModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => { setShowAddTagModal(false); setNewTagName(''); setNewTagDescription(''); setNewTagColor('#6366F1'); }} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">Add New Tag</h2>
            <button 
              onClick={() => { setShowAddTagModal(false); setNewTagName(''); setNewTagDescription(''); setNewTagColor('#6366F1'); }}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Tag Name */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">
                Tag Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g., urgent, review"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Description</label>
              <textarea
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                placeholder="Brief description of this tag..."
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>

            {/* Color */}
            <div className="mb-2">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-12 w-16 rounded-[10px] border border-[#E5E7EB] cursor-pointer"
                />
                <input
                  type="text"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={() => { setShowAddTagModal(false); setNewTagName(''); setNewTagDescription(''); setNewTagColor('#6366F1'); }}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!newTagName.trim()) return;

                const newTag: TaskTag = {
                  id: Date.now().toString(),
                  name: newTagName.trim().toLowerCase(),
                  description: newTagDescription.trim(),
                  color: newTagColor,
                };

                const previous = taskTags;
                const next = [...taskTags, newTag];
                setTaskTags(next);

                try {
                  const ok = await persistTaskTags(next);
                  if (!ok) {
                    setTaskTags(previous);
                    toast.error('Failed to add tag');
                    return;
                  }
                } catch {
                  setTaskTags(previous);
                  toast.error('Failed to add tag');
                  return;
                }

                setShowAddTagModal(false);
                setNewTagName('');
                setNewTagDescription('');
                setNewTagColor('#6366F1');
              }}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Add Tag
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Create Role Modal */}
    {showCreateRoleModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
        <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateRoleModal(false)} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[600px] max-w-[90vw] my-8 max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-[#E5E7EB] z-10">
            <h2 className="text-[20px] font-medium text-[#101828]">Create New Role</h2>
            <button 
              onClick={() => setShowCreateRoleModal(false)}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Role Name */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g., Senior Architect"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-[14px] font-medium text-[#374151] mb-2">Description</label>
              <textarea
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="Brief description of this role's responsibilities..."
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>

            {/* Color and Permission Level */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-[14px] font-medium text-[#374151] mb-2">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="h-12 w-14 rounded-[10px] border border-[#E5E7EB] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#374151] mb-2">Permission Level</label>
                <select
                  value={newRolePermissionLevel}
                  onChange={(e) => setNewRolePermissionLevel(e.target.value)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                >
                  <option value="full">Full Access</option>
                  <option value="high">High Access</option>
                  <option value="medium">Medium Access</option>
                  <option value="minimal">Minimal Access</option>
                </select>
              </div>
            </div>

            {/* Content Permissions */}
            <div className="rounded-[12px] bg-[#F9FAFB] p-4 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <FileDoc className="h-5 w-5 text-[#6A7282]" />
                <h4 className="text-[14px] font-medium text-[#101828]">Content Permissions</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'viewAll', label: 'View All', desc: 'View all project content', icon: Eye },
                  { key: 'editOwn', label: 'Edit Own', desc: 'Edit own content only', icon: FileDoc },
                  { key: 'editAll', label: 'Edit All', desc: 'Edit all project content', icon: FileDoc },
                  { key: 'createContent', label: 'Create Content', desc: 'Create new content', icon: Plus },
                  { key: 'deleteContent', label: 'Delete Content', desc: 'Delete project content', icon: Trash2 },
                  { key: 'approveChanges', label: 'Approve Changes', desc: 'Approve change requests', icon: FileDoc },
                  { key: 'submitChanges', label: 'Submit Changes', desc: 'Submit change requests', icon: Circle }
                ].map((perm) => {
                  const Icon = perm.icon;
                  return (
                    <button
                      key={perm.key}
                      onClick={() => setNewRoleContentPerms({...newRoleContentPerms, [perm.key]: !newRoleContentPerms[perm.key as keyof typeof newRoleContentPerms]})}
                      className={cn(
                        "p-3 rounded-[10px] border text-left transition-all",
                        newRoleContentPerms[perm.key as keyof typeof newRoleContentPerms]
                          ? "border-[#155DFC] bg-[#EEF2FF]"
                          : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-[#6A7282]" />
                        <span className="text-[13px] font-medium text-[#101828]">{perm.label}</span>
                      </div>
                      <p className="text-[12px] text-[#6A7282]">{perm.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Team Permissions */}
            <div className="rounded-[12px] bg-[#F9FAFB] p-4 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-[#6A7282]" />
                <h4 className="text-[14px] font-medium text-[#101828]">Team Permissions</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'viewTeam', label: 'View Team', desc: 'View team members', icon: Eye },
                  { key: 'manageTeam', label: 'Manage Team', desc: 'Add/remove team members', icon: UserPlus },
                  { key: 'assignTasks', label: 'Assign Tasks', desc: 'Assign tasks to members', icon: UserPlus },
                  { key: 'manageRoles', label: 'Manage Roles', desc: 'Edit member roles', icon: UserPlus }
                ].map((perm) => {
                  const Icon = perm.icon;
                  return (
                    <button
                      key={perm.key}
                      onClick={() => setNewRoleTeamPerms({...newRoleTeamPerms, [perm.key]: !newRoleTeamPerms[perm.key as keyof typeof newRoleTeamPerms]})}
                      className={cn(
                        "p-3 rounded-[10px] border text-left transition-all",
                        newRoleTeamPerms[perm.key as keyof typeof newRoleTeamPerms]
                          ? "border-[#155DFC] bg-[#EEF2FF]"
                          : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-[#6A7282]" />
                        <span className="text-[13px] font-medium text-[#101828]">{perm.label}</span>
                      </div>
                      <p className="text-[12px] text-[#6A7282]">{perm.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings Permissions */}
            <div className="rounded-[12px] bg-[#F9FAFB] p-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-[#6A7282]" />
                <h4 className="text-[14px] font-medium text-[#101828]">Settings Permissions</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'viewSettings', label: 'View Settings', desc: 'View project settings', icon: Eye },
                  { key: 'manageSettings', label: 'Manage Settings', desc: 'Edit project settings', icon: UserPlus },
                  { key: 'manageWorkflow', label: 'Manage Workflow', desc: 'Configure workflow', icon: UserPlus },
                  { key: 'manageIntegrations', label: 'Manage Integrations', desc: 'Configure integrations', icon: UserPlus }
                ].map((perm) => {
                  const Icon = perm.icon;
                  return (
                    <button
                      key={perm.key}
                      onClick={() => setNewRoleSettingsPerms({...newRoleSettingsPerms, [perm.key]: !newRoleSettingsPerms[perm.key as keyof typeof newRoleSettingsPerms]})}
                      className={cn(
                        "p-3 rounded-[10px] border text-left transition-all",
                        newRoleSettingsPerms[perm.key as keyof typeof newRoleSettingsPerms]
                          ? "border-[#155DFC] bg-[#EEF2FF]"
                          : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-[#6A7282]" />
                        <span className="text-[13px] font-medium text-[#101828]">{perm.label}</span>
                      </div>
                      <p className="text-[12px] text-[#6A7282]">{perm.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 bg-white flex items-center gap-3 p-6 border-t border-[#E5E7EB]">
            <button
              onClick={() => setShowCreateRoleModal(false)}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (newRoleName.trim()) {
                  const selectedPerms: string[] = [];
                  Object.entries(newRoleContentPerms).forEach(([key, val]) => {
                    if (val) selectedPerms.push(key.replace(/([A-Z])/g, ' $1').trim());
                  });
                  Object.entries(newRoleTeamPerms).forEach(([key, val]) => {
                    if (val) selectedPerms.push(key.replace(/([A-Z])/g, ' $1').trim());
                  });
                  Object.entries(newRoleSettingsPerms).forEach(([key, val]) => {
                    if (val) selectedPerms.push(key.replace(/([A-Z])/g, ' $1').trim());
                  });
                  
                  try {
                    const newRole = await createProjectRole(projectPublicId, {
                      name: newRoleName.trim(),
                      description: newRoleDescription.trim() || 'Custom role',
                      color: newRoleColor,
                      accessLevel: newRolePermissionLevel,
                      permissions: selectedPerms.length > 0 ? selectedPerms : ['View All'],
                    });
                    setRoles([...roles, newRole]);
                    setShowCreateRoleModal(false);
                    setNewRoleName('');
                    setNewRoleDescription('');
                    setNewRoleColor('#6366f1');
                    setNewRolePermissionLevel('medium');
                    setNewRoleContentPerms({viewAll: false, editOwn: false, editAll: false, createContent: false, deleteContent: false, approveChanges: false, submitChanges: false});
                    setNewRoleTeamPerms({viewTeam: false, manageTeam: false, assignTasks: false, manageRoles: false});
                    setNewRoleSettingsPerms({viewSettings: false, manageSettings: false, manageWorkflow: false, manageIntegrations: false});
                    toast.success('Role created');
                  } catch {
                    toast.error('Failed to create role');
                  }
                }
              }}
              className="flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors"
            >
              Create Role
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* API Key Modal */}
    {showApiKeyModal && generatedApiKey && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => { setShowApiKeyModal(false); setGeneratedApiKey(null); }} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[520px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-[#101828]">API Key Generated</h2>
            <button 
              onClick={() => { setShowApiKeyModal(false); setGeneratedApiKey(null); }}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <div className="flex items-center gap-3 p-4 rounded-[10px] bg-[#FEF3C7] border border-[#F59E0B] mb-5">
              <AlertTriangle className="h-5 w-5 text-[#F59E0B] flex-shrink-0" />
              <p className="text-[13px] text-[#92400E]">Make sure to copy your API key now. You won't be able to see it again!</p>
            </div>
            
            <label className="block text-[14px] font-medium text-[#374151] mb-2">Your API Key</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={generatedApiKey}
                readOnly
                className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#101828] font-mono"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedApiKey);
                }}
                className="h-12 px-4 rounded-[10px] border border-[#E5E7EB] bg-white text-[#374151] hover:bg-gray-50 transition-colors"
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={() => { setShowApiKeyModal(false); setGeneratedApiKey(null); }}
              className="flex-1 h-11 rounded-[10px] bg-[#155DFC] text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Delete Project Modal */}
    <AlertDialog open={showDeleteProjectModal} onOpenChange={(open) => {
      setShowDeleteProjectModal(open);
      if (!open) setDeleteProjectConfirmText('');
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this project? This action cannot be undone and may lead to permanent loss of all project information, including documents, settings, and related data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-4">
          <label className="text-sm text-muted-foreground">
            Type <span className="font-semibold text-foreground">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={deleteProjectConfirmText}
            onChange={(e) => setDeleteProjectConfirmText(e.target.value)}
            placeholder="DELETE"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteProject}
            disabled={deleteProjectConfirmText !== 'DELETE' || isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? 'Deleting...' : 'Delete Project'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Workflow Editor Modal (Create/Edit) */}
    {(showCreateWorkflowModal || (showEditWorkflowModal && editingWorkflow)) && (
      <WorkflowEditorModal
        workflow={showEditWorkflowModal ? editingWorkflow : null}
        onClose={() => {
          setShowCreateWorkflowModal(false);
          setShowEditWorkflowModal(false);
          setEditingWorkflow(null);
        }}
        onSuccess={(template) => {
          if (showEditWorkflowModal) {
            void fetchWorkflowTemplates();
            window.dispatchEvent(new CustomEvent('workflow-updated', { detail: template }));
            setShowEditWorkflowModal(false);
            setEditingWorkflow(null);
            toast.success('Workflow updated successfully');
          } else {
            setSelectedWorkflow(template.publicId);
            void fetchWorkflowTemplates();
            window.dispatchEvent(new CustomEvent('workflow-created', { detail: template }));
            setShowCreateWorkflowModal(false);
            toast.success('Workflow created successfully');
          }
          onActivityAdded?.(); // Trigger activities refresh
        }}
      />
    )}

    {/* Delete Workflow Modal */}
    {showDeleteWorkflowModal && deletingWorkflow && (
      <DeleteWorkflowModal
        workflow={deletingWorkflow}
        onClose={() => {
          setShowDeleteWorkflowModal(false);
          setDeletingWorkflow(null);
        }}
        onSuccess={() => {
          const deletedId = deletingWorkflow.publicId;
          void fetchWorkflowTemplates();
          window.dispatchEvent(new CustomEvent('workflow-deleted', { detail: { publicId: deletedId } }));
          if (selectedWorkflow === deletingWorkflow.publicId) {
            setSelectedWorkflow('');
          }
          setShowDeleteWorkflowModal(false);
          setDeletingWorkflow(null);
          toast.success('Workflow deleted successfully');
        }}
      />
    )}
    </>
  );
}

// ==================== WORKFLOW MODAL COMPONENTS ====================

interface WorkflowStageInput {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface WorkflowEditorModalProps {
  workflow?: WorkflowTemplate | null;
  onClose: () => void;
  onSuccess: (template: WorkflowTemplate) => void;
}

function WorkflowEditorModal({ workflow, onClose, onSuccess }: WorkflowEditorModalProps) {
  const isEditing = !!workflow;
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [category, setCategory] = useState(workflow?.category || 'Construction');
  const [tags, setTags] = useState<string[]>(workflow?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(workflow?.isPrivate || false);
  const [stageView, setStageView] = useState<'list' | 'visual'>('list');
  const [draggedStage, setDraggedStage] = useState<string | null>(null);
  const [editorStages, setEditorStages] = useState<StageData[]>(
    workflow?.stages.map((s, i) => ({
      id: s.id || `stage-${i + 1}`,
      name: s.name,
      description: s.description || '',
      color: s.color as any || 'gray',
      type: 'process' as const,
    })) || [
      { id: '1', name: 'Backlog', description: 'Tasks waiting to be started', color: 'gray' as const, type: 'start' as const },
      { id: '2', name: 'To Do', description: 'Ready to be worked on', color: 'blue' as const, type: 'process' as const },
      { id: '3', name: 'In Progress', description: 'Currently being worked on', color: 'yellow' as const, type: 'process' as const },
      { id: '4', name: 'Done', description: 'Completed', color: 'green' as const, type: 'end' as const },
    ]
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddStage = () => {
    const newStage: StageData = {
      id: Date.now().toString(),
      name: `Stage ${editorStages.length + 1}`,
      description: '',
      color: 'blue' as const,
      type: 'process' as const,
    };
    setEditorStages([...editorStages, newStage]);
  };

  const handleUpdateStage = (id: string, field: keyof StageData, value: any) => {
    setEditorStages(editorStages.map(stage => 
      stage.id === id ? { ...stage, [field]: value } : stage
    ));
  };

  const handleDeleteStage = (id: string) => {
    if (editorStages.length > 1) {
      setEditorStages(editorStages.filter(stage => stage.id !== id));
    }
  };

  const handleDragStart = (stageId: string) => {
    setDraggedStage(stageId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedStage && draggedStage !== targetId) {
      const draggedIndex = editorStages.findIndex(s => s.id === draggedStage);
      const targetIndex = editorStages.findIndex(s => s.id === targetId);
      const newStages = [...editorStages];
      const [removed] = newStages.splice(draggedIndex, 1);
      newStages.splice(targetIndex, 0, removed);
      setEditorStages(newStages);
    }
  };

  const handleDragEnd = () => {
    setDraggedStage(null);
  };

  const handleEditorChange = (data: { nodes: any[]; edges: any[] }) => {
    const newStages = data.nodes.map((node) => ({
      id: node.data.id,
      name: node.data.name,
      description: node.data.description,
      color: node.data.color,
      type: node.data.type || 'process',
    }));
    setEditorStages(newStages);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const stagesData = editorStages.map((s, i) => ({
        id: s.id || `stage-${i + 1}`,
        name: s.name,
        description: s.description,
        color: s.color,
      }));

      if (isEditing && workflow) {
        const updatedTemplate = await workflowTemplateService.updateTemplate(workflow.publicId, {
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          stages: stagesData,
          isPrivate,
        });
        onSuccess(updatedTemplate);
      } else {
        const newTemplate = await workflowTemplateService.createTemplate({
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          stages: stagesData,
          isPrivate,
        });
        onSuccess(newTemplate);
      }
    } catch (error) {
      toast.error(isEditing ? 'Failed to update workflow' : 'Failed to create workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = name.trim() && editorStages.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
          <h2 className="text-[20px] font-medium text-[#101828]">
            {isEditing ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Workflow Name & Description Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-[#364153]">
                Workflow Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Custom Workflow"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-[#364153]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Construction">Construction</option>
                <option value="Software Development">Software Development</option>
                <option value="Marketing">Marketing</option>
                <option value="Design">Design</option>
                <option value="Operations">Operations</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-[#364153]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this workflow..."
              rows={2}
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-[#364153]">Tags</label>
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 min-h-[48px] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[13px] font-medium text-blue-700">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-blue-900 p-0.5 rounded-full hover:bg-blue-200 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={tags.length === 0 ? "Type tag and press Enter..." : "Add more..."}
                className="flex-1 min-w-[120px] bg-transparent text-[14px] placeholder:text-[#99A1AF] focus:outline-none"
              />
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-[#364153]">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[40px] text-[14px] font-medium transition-colors",
                  !isPrivate
                    ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]"
                    : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                )}
              >
                <Globe className="h-4 w-4" />
                Public
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[40px] text-[14px] font-medium transition-colors",
                  isPrivate
                    ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]"
                    : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                )}
              >
                <Lock className="h-4 w-4" />
                Private
              </button>
            </div>
          </div>

          {/* Workflow Stages Section */}
          <div className="space-y-3 border-t border-[#E5E7EB] pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-medium text-[#101828]">Workflow Stages</h3>
                <p className="text-[13px] text-[#6A7282]">{editorStages.length} stages defined</p>
              </div>
              <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-[10px]">
                  <button
                    type="button"
                    onClick={() => setStageView('list')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                      stageView === 'list'
                        ? "bg-white shadow-sm text-[#101828]"
                        : "text-[#4A5565] hover:text-[#101828]"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setStageView('visual')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                      stageView === 'visual'
                        ? "bg-white shadow-sm text-[#101828]"
                        : "text-[#4A5565] hover:text-[#101828]"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    Visual
                  </button>
                </div>
                {stageView === 'list' && (
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="inline-flex items-center gap-1.5 text-[14px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Stage
                  </button>
                )}
              </div>
            </div>

            {/* List View */}
            {stageView === 'list' ? (
              <div className="space-y-3">
                {editorStages.map((stage, index) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(stage.id)}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-[10px] border border-[#E5E7EB] bg-white transition-all",
                      draggedStage === stage.id && "opacity-50"
                    )}
                  >
                    {/* Drag Handle */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="cursor-grab text-[#9CA3AF] hover:text-[#6B7280]"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                        </svg>
                      </button>
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[12px] font-medium text-blue-600">
                        {index + 1}
                      </span>
                    </div>

                    {/* Stage Fields */}
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => handleUpdateStage(stage.id, 'name', e.target.value)}
                        placeholder="Stage name"
                        className="w-full bg-transparent text-[14px] font-medium text-[#101828] placeholder:text-[#99A1AF] focus:outline-none border-b border-transparent focus:border-blue-500 pb-1"
                      />
                      <input
                        type="text"
                        value={stage.description}
                        onChange={(e) => handleUpdateStage(stage.id, 'description', e.target.value)}
                        placeholder="Stage description (optional)"
                        className="w-full bg-transparent text-[13px] text-[#6A7282] placeholder:text-[#99A1AF] focus:outline-none"
                      />
                    </div>

                    {/* Delete Button */}
                    {editorStages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-1 text-[#9CA3AF] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Info Box */}
                <div className="flex items-start gap-3 p-4 rounded-[10px] bg-blue-50 border border-blue-100">
                  <Zap className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] text-blue-700">Drag stages to reorder them.</p>
                    <p className="text-[13px] text-blue-600">Tasks will move through these stages in sequence.</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Visual View - React Flow Editor */
              <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] h-[400px] relative overflow-hidden">
                <WorkflowEditor
                  initialStages={editorStages}
                  onChange={handleEditorChange}
                  onSave={(json) => console.log('Workflow JSON:', json)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-[#E5E7EB] bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSaving}
            className={cn(
              "flex-1 h-11 rounded-[10px] text-[14px] font-medium transition-colors flex items-center justify-center gap-2",
              isValid && !isSaving
                ? "bg-[#155DFC] text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEditing ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              isEditing ? 'Save Changes' : 'Create Workflow'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteWorkflowModalProps {
  workflow: WorkflowTemplate;
  onClose: () => void;
  onSuccess: () => void;
}

function DeleteWorkflowModal({ workflow, onClose, onSuccess }: DeleteWorkflowModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;

    setIsDeleting(true);
    try {
      await workflowTemplateService.deleteTemplate(workflow.publicId);
      onSuccess();
    } catch (error) {
      toast.error('Failed to delete workflow');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
          <h2 className="text-[20px] font-medium text-red-600">Delete Workflow</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <div className="flex items-center gap-3 p-4 rounded-[10px] bg-red-50 border border-red-200 mb-5">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-[13px] text-red-700">This action cannot be undone. This will permanently delete the workflow template.</p>
          </div>

          <p className="text-[14px] text-[#6A7282] mb-3">
            You are about to delete: <span className="font-medium text-[#101828]">{workflow.name}</span>
          </p>

          <label className="block text-[14px] font-medium text-[#374151] mb-2">
            Type <span className="font-mono text-red-600">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center gap-3 p-6 pt-2">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || isDeleting}
            className={cn(
              "flex-1 h-11 rounded-[10px] text-[14px] font-medium transition-colors flex items-center justify-center gap-2",
              confirmText === 'DELETE' && !isDeleting
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Workflow'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
