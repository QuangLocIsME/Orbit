'use client';
// Settings Tab v1.0.72
import { useState, useRef, useEffect } from 'react';
import { navigate } from 'astro:transitions/client';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from '@/components/ui/sonner';
import { Settings, FileText, ListTodo, GitBranch, Shield, Users, Bell, Plug, Plus, Pencil, X, Trash2, GripVertical, Eye, EyeOff, LayoutGrid, FolderOpen, FileText as FileDoc, GitCompare, RefreshCcw, AlertTriangle, Puzzle, Save, Tag, Lock, Check, Mail, MessageSquare, Clock, Zap, Link2, Calendar, FileUp, Box, Globe, Scissors, Database, BookOpen, BarChart3, Folder, Code, Loader2, Upload, ChevronRight, CheckCircle2, UserPlus, Copy, Key, Circle } from 'lucide-react';

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
  { id: '4', name: 'Slack', description: 'Send notifications to Slack channels', icon: 'slack', connected: true, category: 'communication' },
  { id: '5', name: 'Microsoft Teams', description: 'Integrate with Microsoft Teams', icon: 'teams', connected: false, category: 'communication' },
  { id: '6', name: 'Jira', description: 'Sync tasks with Jira projects', icon: 'jira', connected: false, category: 'project' },
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
}

const settingsMenuItems = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'workflow', label: 'Workflow', icon: GitBranch },
  { id: 'roles', label: 'Roles', icon: Users },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
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
  projectPublicId = ''
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
  
  // Edit Discipline Modal state
  const [showEditDisciplineModal, setShowEditDisciplineModal] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null);
  
  // Project thumbnail
  const [projectThumbnail, setProjectThumbnail] = useState('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&h=120&fit=crop');
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
  const [selectedWorkflow, setSelectedWorkflow] = useState('construction');
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

  useEffect(() => {
    if (!projectPublicId) return;
    setIsLoadingDisciplines(true);
    apiFetch(`/api/projects/${projectPublicId}/disciplines`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
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
      })
      .catch(() => {})
      .finally(() => setIsLoadingDisciplines(false));
  }, [projectPublicId]);

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
  
  // Handle General Settings Save
  const handleSaveGeneralSettings = async () => {
    setGeneralSaveState('saving');
    // Simulate save operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    setGeneralSaveState('success');
    setTimeout(() => setGeneralSaveState('idle'), 3000);
  };
  
  // Handle Change Image
  const handleChangeImage = () => {
    fileInputRef.current?.click();
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProjectThumbnail(reader.result as string);
      };
      reader.readAsDataURL(file);
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

  useEffect(() => {
    let cancelled = false;

    const loadTaskTags = async () => {
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

    loadTaskTags();
    return () => {
      cancelled = true;
    };
  }, [projectPublicId]);

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

  const handleDeleteRole = (id: string) => {
    setRoles(roles.filter(r => r.id !== id));
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
                <div className="h-20 w-32 rounded-[10px] border border-[#E5E7EB] bg-gray-100 overflow-hidden">
                  <img 
                    src={projectThumbnail} 
                    alt="Project thumbnail" 
                    className="h-full w-full object-cover"
                  />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button 
                  onClick={handleChangeImage}
                  className="inline-flex items-center gap-2 text-[14px] text-[#155DFC] hover:underline"
                >
                  <Upload className="h-4 w-4" />
                  Change image
                </button>
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

            {/* Project Code */}
            <div className="mb-6 pb-6 border-b border-[#E5E7EB]">
              <label className="block text-[14px] font-normal text-[#101828] mb-2">Project Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
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
                {/* Construction Standard - Selected */}
                <div 
                  onClick={() => setSelectedWorkflow('construction')}
                  className={cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === 'construction' 
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
                        <h3 className="text-[16px] font-medium text-[#101828]">Construction Standard</h3>
                        <p className="text-[14px] text-[#6A7282] mb-3">Traditional construction workflow with 5 stages</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {['Backlog', 'To Do', 'In Progress', 'Review', 'Done'].map((stage, idx) => (
                            <span key={stage} className="flex items-center">
                              <span className="px-3 py-1 rounded bg-[#F3F4F6] text-[13px] text-[#374151]">{stage}</span>
                              {idx < 4 && <ChevronRight className="h-4 w-4 text-[#9CA3AF] mx-1" />}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {selectedWorkflow === 'construction' && (
                      <CheckCircle2 className="h-5 w-5 text-[#155DFC]" />
                    )}
                  </div>
                </div>

                {/* Agile Scrum */}
                <div 
                  onClick={() => setSelectedWorkflow('agile')}
                  className={cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === 'agile' 
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
                        <h3 className="text-[16px] font-medium text-[#101828]">Agile Scrum</h3>
                        <p className="text-[14px] text-[#6A7282] mb-3">Scrum-based workflow with sprint planning</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {['Product Backlog', 'Sprint Backlog', 'In Progress', 'Testing', 'Review', 'Done'].map((stage, idx) => (
                            <span key={stage} className="flex items-center">
                              <span className="px-3 py-1 rounded bg-[#F3F4F6] text-[13px] text-[#374151]">{stage}</span>
                              {idx < 5 && <ChevronRight className="h-4 w-4 text-[#9CA3AF] mx-1" />}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {selectedWorkflow === 'agile' && (
                      <CheckCircle2 className="h-5 w-5 text-[#155DFC]" />
                    )}
                  </div>
                </div>

                {/* Design Review */}
                <div 
                  onClick={() => setSelectedWorkflow('design')}
                  className={cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === 'design' 
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
                        <h3 className="text-[16px] font-medium text-[#101828]">Design Review</h3>
                        <p className="text-[14px] text-[#6A7282] mb-3">Streamlined design approval process</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {['Draft', 'Review', 'Revision', 'Approved'].map((stage, idx) => (
                            <span key={stage} className="flex items-center">
                              <span className="px-3 py-1 rounded bg-[#F3F4F6] text-[13px] text-[#374151]">{stage}</span>
                              {idx < 3 && <ChevronRight className="h-4 w-4 text-[#9CA3AF] mx-1" />}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {selectedWorkflow === 'design' && (
                      <CheckCircle2 className="h-5 w-5 text-[#155DFC]" />
                    )}
                  </div>
                </div>

                {/* Custom Workflow */}
                <div 
                  onClick={() => setSelectedWorkflow('custom')}
                  className={cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === 'custom' 
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
                        <h3 className="text-[16px] font-medium text-[#101828]">Custom Workflow</h3>
                        <p className="text-[14px] text-[#6A7282]">Create your own workflow stages</p>
                      </div>
                    </div>
                    {selectedWorkflow === 'custom' && (
                      <CheckCircle2 className="h-5 w-5 text-[#155DFC]" />
                    )}
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
                onClick={async () => {
                  setWorkflowApplyState('applying');
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  setWorkflowApplyState('success');
                  setTimeout(() => setWorkflowApplyState('idle'), 3000);
                }}
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
              onClick={() => {
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
                  
                  const newRole: Role = {
                    id: Date.now().toString(),
                    name: newRoleName.trim(),
                    accessLevel: newRolePermissionLevel as 'full' | 'high' | 'medium' | 'minimal',
                    isSystem: false,
                    memberCount: 0,
                    description: newRoleDescription.trim() || 'Custom role',
                    permissions: selectedPerms.length > 0 ? selectedPerms : ['View All'],
                    color: newRoleColor
                  };
                  setRoles([...roles, newRole]);
                  setShowCreateRoleModal(false);
                  setNewRoleName('');
                  setNewRoleDescription('');
                  setNewRoleColor('#6366f1');
                  setNewRolePermissionLevel('medium');
                  setNewRoleContentPerms({viewAll: false, editOwn: false, editAll: false, createContent: false, deleteContent: false, approveChanges: false, submitChanges: false});
                  setNewRoleTeamPerms({viewTeam: false, manageTeam: false, assignTasks: false, manageRoles: false});
                  setNewRoleSettingsPerms({viewSettings: false, manageSettings: false, manageWorkflow: false, manageIntegrations: false});
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
    {showDeleteProjectModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => { setShowDeleteProjectModal(false); setDeleteProjectConfirmText(''); }} />
        <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
            <h2 className="text-[20px] font-medium text-red-600">Delete Project</h2>
            <button 
              onClick={() => { setShowDeleteProjectModal(false); setDeleteProjectConfirmText(''); }}
              className="p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <div className="flex items-center gap-3 p-4 rounded-[10px] bg-red-50 border border-red-200 mb-5">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-[13px] text-red-700">This action cannot be undone. This will permanently delete the project and all associated data.</p>
            </div>
            
            <label className="block text-[14px] font-medium text-[#374151] mb-2">
              Type <span className="font-mono text-red-600">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteProjectConfirmText}
              onChange={(e) => setDeleteProjectConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center gap-3 p-6 pt-2">
            <button
              onClick={() => { setShowDeleteProjectModal(false); setDeleteProjectConfirmText(''); }}
              className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (deleteProjectConfirmText === 'DELETE') {
                  // Navigate back to projects page
                  navigate('/projects');
                }
              }}
              disabled={deleteProjectConfirmText !== 'DELETE'}
              className={cn(
                "flex-1 h-11 rounded-[10px] text-[14px] font-medium transition-colors",
                deleteProjectConfirmText === 'DELETE'
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              Delete Project
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
