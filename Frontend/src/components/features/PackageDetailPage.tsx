'use client';

import { useState } from 'react';
import { navigate } from 'astro:transitions/client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  FileText,
  Users,
  Calendar,
  MoreHorizontal,
  Settings,
  MessageSquare,
  Upload,
  Clock,
  Pause
} from 'lucide-react';
import CreateTaskModal from './CreateTaskModal';

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  type: 'task' | 'document' | 'comment';
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'todo';
  assignee: { name: string; initials: string; color: string };
  dueDate: string;
}

interface Package {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  progress: number;
  tasksCompleted: number;
  totalTasks: number;
  dueDate: string;
  lastActivity: string;
  icon: string;
  color: string;
  team: TeamMember[];
  documentsCount: number;
  recentActivity: Activity[];
  recentTasks: Task[];
}

interface PackageDetailPageProps {
  pkg: Package;
  projectSlug?: string;
}

const statusConfig = {
  active: { 
    label: 'Active', 
    color: 'text-emerald-700', 
    bg: 'bg-emerald-100',
    icon: TrendingUp
  },
  completed: { 
    label: 'Completed', 
    color: 'text-blue-700', 
    bg: 'bg-blue-100',
    icon: CheckCircle2
  },
  'on-hold': { 
    label: 'On Hold', 
    color: 'text-orange-700', 
    bg: 'bg-orange-100',
    icon: Pause
  },
};

const taskStatusConfig = {
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  'in-progress': { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: TrendingUp },
  todo: { label: 'To Do', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: Clock },
};

const activityIcons = {
  task: CheckCircle2,
  document: Upload,
  comment: MessageSquare,
};

// Mock team members for assignment
const availableMembers = [
  { id: '1', name: 'Minh Anh', initials: 'MA', color: '#EC4899' },
  { id: '2', name: 'Hoàng Nam', initials: 'HN', color: '#06B6D4' },
  { id: '3', name: 'Jacob Harris', initials: 'JH', color: '#3B82F6' },
  { id: '4', name: 'Ethan Parker', initials: 'EP', color: '#8B5CF6' },
  { id: '5', name: 'Sarah Chen', initials: 'SC', color: '#F59E0B' },
];

export default function PackageDetailPage({ pkg, projectSlug = 'metro-station-phase-2' }: PackageDetailPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const status = statusConfig[pkg.status];
  const StatusIcon = status.icon;
  
  // Modal states
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  
  // Form states
  const [newTask, setNewTask] = useState({ title: '', description: '', assigneeId: '', dueDate: '', status: 'todo' as const });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'documents', label: 'Documents' },
    { id: 'team', label: 'Team' },
    { id: 'activity', label: 'Activity' },
  ];

  // Calculate stats
  const inProgressTasks = pkg.totalTasks - pkg.tasksCompleted;
  const stats = [
    { value: pkg.tasksCompleted, label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { value: inProgressTasks, label: 'In Progress', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { value: pkg.documentsCount, label: 'Documents', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
    { value: pkg.team.length, label: 'Team Members', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="px-[300px] py-0">
      {/* Header section with border bottom */}
      <div className="border-b border-gray-200 pb-0">
        {/* Back Link Row */}
        <div className="flex items-center justify-between py-4">
          <a
            href={`/projects/${projectSlug}`}
            onClick={(e) => {
              e.preventDefault();
              // Set tab to packages before navigation via sessionStorage
              sessionStorage.setItem('projectActiveTab', 'packages');
              navigate(`/projects/${projectSlug}`);
            }}
            className="inline-flex items-center gap-2 text-[14px] text-[#6A7282] transition-colors hover:text-[#101828]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Packages
          </a>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-[#99A1AF] transition-colors hover:bg-gray-50 hover:text-[#4A5565]">
              <Settings className="h-5 w-5" />
            </button>
            <button className="rounded-lg p-2 text-[#99A1AF] transition-colors hover:bg-gray-50 hover:text-[#4A5565]">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Package Header */}
        <div className="flex items-start justify-between py-4">
          <div className="flex-1">
            <h1 className="text-[24px] font-normal text-[#101828]">{pkg.name}</h1>
            <p className="text-[14px] text-[#4A5565]">{pkg.description}</p>
            
            {/* Meta */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", status.bg, status.color)}>
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                Due {new Date(pkg.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <CheckCircle2 className="h-4 w-4" />
                {pkg.tasksCompleted}/{pkg.totalTasks} tasks
              </div>
            </div>
          </div>

          {/* Progress Ring and Team */}
          <div className="flex items-center gap-6">
            {/* Progress Ring */}
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90 transform" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - pkg.progress / 100)}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-semibold text-gray-900">{pkg.progress}%</span>
              </div>
            </div>

            {/* Team Avatars */}
            <div className="flex -space-x-2">
              {pkg.team.slice(0, 4).map((member) => (
                <div
                  key={member.id}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: member.color }}
                  title={member.name}
                >
                  {member.initials}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <nav className="flex gap-6 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "border-b-2 pb-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-6">
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="mb-4 text-base font-medium text-gray-900">Recent Activity</h3>
            <div className="space-y-4">
              {pkg.recentActivity.length > 0 ? (
                pkg.recentActivity.map((activity) => {
                  const ActivityIcon = activityIcons[activity.type];
                  return (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        activity.type === 'task' ? "bg-emerald-100 text-emerald-600" :
                        activity.type === 'document' ? "bg-purple-100 text-purple-600" :
                        "bg-blue-100 text-blue-600"
                      )}>
                        <ActivityIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.user}</span>
                          {' '}{activity.action}{' '}
                          <a href="#" className="font-medium text-blue-600 hover:underline">{activity.target}</a>
                        </p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No recent activity</p>
              )}
            </div>
          </div>

          {/* Recent Tasks */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-900">Recent Tasks</h3>
              <a href="#" className="text-sm font-medium text-blue-600 hover:underline">View all</a>
            </div>
            <div className="space-y-3">
              {pkg.recentTasks.length > 0 ? (
                pkg.recentTasks.map((task) => {
                  const taskStatus = taskStatusConfig[task.status];
                  const TaskStatusIcon = taskStatus.icon;
                  return (
                    <div key={task.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          <p className="mt-1 text-sm text-gray-500">{task.description}</p>
                        </div>
                        <div className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                          taskStatus.bg, taskStatus.color, taskStatus.border
                        )}>
                          <TaskStatusIcon className="h-3 w-3" />
                          {taskStatus.label}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: task.assignee.color }}
                          >
                            {task.assignee.initials}
                          </div>
                          <span className="text-sm text-gray-600">{task.assignee.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No tasks yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Search and Add */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tasks..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button 
              onClick={() => setIsAddTaskModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            {pkg.recentTasks.length > 0 ? (
              pkg.recentTasks.map((task) => {
                const taskStatus = taskStatusConfig[task.status];
                const TaskStatusIcon = taskStatus.icon;
                return (
                  <div key={task.id} className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input type="checkbox" checked={task.status === 'completed'} readOnly className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" />
                        <div className="flex-1">
                          <h4 className={cn("font-medium", task.status === 'completed' ? "text-gray-400 line-through" : "text-gray-900")}>{task.title}</h4>
                          <p className="mt-1 text-sm text-gray-500">{task.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                          taskStatus.bg, taskStatus.color, taskStatus.border
                        )}>
                          <TaskStatusIcon className="h-3 w-3" />
                          {taskStatus.label}
                        </div>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: task.assignee.color }}
                        >
                          {task.assignee.initials}
                        </div>
                        <span className="text-sm text-gray-600">{task.assignee.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <CheckCircle2 className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="mt-4 text-sm font-medium text-gray-900">No tasks yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding a new task.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Search and Upload */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search documents..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button 
              onClick={() => setIsUploadDocModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload
            </button>
          </div>

          {/* Documents List */}
          <div className="space-y-3">
            {[
              { id: '1', name: 'Structural Calculations v2.3.pdf', size: '2.4 MB', author: 'Minh Anh', time: '2 hours ago' },
              { id: '2', name: 'Foundation Plan - Rev C.dwg', size: '5.1 MB', author: 'Hoàng Nam', time: '5 hours ago' },
              { id: '3', name: '3D Model - Latest.rvt', size: '128.5 MB', author: 'Jacob Harris', time: '1 day ago' },
            ].map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{doc.name}</h4>
                    <p className="text-sm text-gray-500">
                      {doc.size} <span className="mx-1">•</span> by {doc.author} <span className="mx-1">•</span> {doc.time}
                    </p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Team Members ({pkg.team.length})</h3>
            <button 
              onClick={() => setIsAddMemberModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Member
            </button>
          </div>

          {/* Team Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {pkg.team.map((member) => (
              <div key={member.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: member.color }}
                >
                  {member.initials}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{member.name}</div>
                  <div className="text-sm text-gray-500">Member</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Activity Feed</h3>
            <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
              <option>All activity</option>
              <option>Tasks</option>
              <option>Documents</option>
              <option>Comments</option>
            </select>
          </div>

          {/* Activity List */}
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {pkg.recentActivity.length > 0 ? (
              pkg.recentActivity.map((activity) => {
                const ActivityIcon = activityIcons[activity.type];
                return (
                  <div key={activity.id} className="flex items-start gap-4 p-4">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      activity.type === 'task' ? "bg-emerald-100 text-emerald-600" :
                      activity.type === 'document' ? "bg-purple-100 text-purple-600" :
                      "bg-blue-100 text-blue-600"
                    )}>
                      <ActivityIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{activity.user}</span>
                        {' '}{activity.action}{' '}
                        <a href="#" className="font-medium text-blue-600 hover:underline">{activity.target}</a>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Clock className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="mt-4 text-sm font-medium text-gray-900">No activity yet</h3>
                <p className="mt-1 text-sm text-gray-500">Activity will appear here when team members make changes.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      <CreateTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        onSubmit={(task) => console.log('New task created:', task)}
      />

      {/* Upload Document Modal */}
      {isUploadDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsUploadDocModalOpen(false)}>
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-lg font-semibold text-gray-900">Upload Document</h2>
              <button onClick={() => setIsUploadDocModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="border-t border-gray-100" />
            <div className="p-6">
              <div 
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 mb-4">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
                <p className="mt-1 text-xs text-gray-500">PDF, DWG, RVT, or other document files up to 500MB</p>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              {selectedFile && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="flex-1 text-sm text-gray-900 truncate">{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 pt-4 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setIsUploadDocModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Cancel</button>
              <button 
                onClick={() => { console.log('Uploading:', selectedFile); setIsUploadDocModalOpen(false); setSelectedFile(null); }}
                disabled={!selectedFile}
                className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsAddMemberModalOpen(false)}>
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Team Members</h2>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="border-t border-gray-100" />
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">Select members to add to this package:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableMembers.map((member) => {
                  const isInTeam = pkg.team.some(t => t.name === member.name);
                  const isSelected = selectedMembers.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      disabled={isInTeam}
                      onClick={() => setSelectedMembers(prev => 
                        prev.includes(member.id) ? prev.filter(id => id !== member.id) : [...prev, member.id]
                      )}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isInTeam ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' :
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.initials}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{isInTeam ? 'Already in team' : 'Click to select'}</p>
                      </div>
                      {(isSelected || isInTeam) && (
                        <svg className={`h-5 w-5 ${isInTeam ? 'text-gray-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 pt-4 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setIsAddMemberModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Cancel</button>
              <button 
                onClick={() => { console.log('Adding members:', selectedMembers); setIsAddMemberModalOpen(false); setSelectedMembers([]); }}
                disabled={selectedMembers.length === 0}
                className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add {selectedMembers.length > 0 ? `(${selectedMembers.length})` : ''} Members
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
