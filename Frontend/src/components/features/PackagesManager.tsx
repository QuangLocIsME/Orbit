'use client';

import { useState, useMemo, useEffect } from 'react';
import { navigate } from 'astro:transitions/client';
import { cn } from '@/lib/utils';
import { PackagesSkeleton } from '@/components/ui/skeletons';
import { 
  Search, 
  LayoutGrid, 
  List, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  Pause,
  Building2,
  Wrench,
  Zap,
  Shovel,
  Train,
  Paintbrush,
  Bus,
  Shield,
  Layers,
  Leaf
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string;
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
}

interface PackagesManagerProps {
  packages: Package[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building2,
  construction: Wrench,
  zap: Zap,
  shovel: Shovel,
  train: Train,
  paint: Paintbrush,
  bus: Bus,
  shield: Shield,
  layers: Layers,
  leaf: Leaf,
};

const statusConfig = {
  active: { 
    label: 'Active', 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-50', 
    border: 'border-emerald-200',
    icon: TrendingUp,
    progressColor: 'bg-emerald-500'
  },
  completed: { 
    label: 'Completed', 
    color: 'text-blue-600', 
    bg: 'bg-blue-50', 
    border: 'border-blue-200',
    icon: CheckCircle2,
    progressColor: 'bg-blue-500'
  },
  'on-hold': { 
    label: 'On Hold', 
    color: 'text-orange-600', 
    bg: 'bg-orange-50', 
    border: 'border-orange-200',
    icon: Pause,
    progressColor: 'bg-orange-500'
  },
};

// Package type options with icons and colors
const packageTypes = [
  { id: 'design', label: 'Design', icon: Paintbrush, color: 'bg-purple-100', iconColor: 'text-purple-600' },
  { id: 'development', label: 'Development', icon: Zap, color: 'bg-blue-100', iconColor: 'text-blue-600' },
  { id: 'marketing', label: 'Marketing', icon: TrendingUp, color: 'bg-pink-100', iconColor: 'text-pink-600' },
  { id: 'construction', label: 'Construction', icon: Wrench, color: 'bg-orange-100', iconColor: 'text-orange-600' },
  { id: 'research', label: 'Research', icon: Leaf, color: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { id: 'other', label: 'Other', icon: Layers, color: 'bg-gray-100', iconColor: 'text-gray-600' },
];

// Mock team members for assignment
const availableMembers = [
  { id: '1', name: 'Minh Anh', initials: 'MA', color: '#EC4899' },
  { id: '2', name: 'Hoàng Nam', initials: 'HN', color: '#06B6D4' },
  { id: '3', name: 'Jacob Harris', initials: 'JH', color: '#3B82F6' },
  { id: '4', name: 'Ethan Parker', initials: 'EP', color: '#8B5CF6' },
];

export default function PackagesManager({ packages }: PackagesManagerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPackage, setNewPackage] = useState({
    name: '',
    description: '',
    type: 'construction',
    status: 'active' as 'active' | 'on-hold',
    dueDate: '',
    teamMembers: [] as string[],
  });
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);

  const stats = useMemo(() => {
    const total = packages.length;
    const active = packages.filter(p => p.status === 'active').length;
    const completed = packages.filter(p => p.status === 'completed').length;
    const onHold = packages.filter(p => p.status === 'on-hold').length;
    return { total, active, completed, onHold };
  }, [packages]);

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           pkg.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || pkg.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [packages, searchQuery, statusFilter]);

  const handlePackageClick = (slug: string) => {
    navigate(`/packages/${slug}`);
  };

  const handleCreatePackage = () => {
    // In a real app, this would send data to the backend
    console.log('Creating package:', newPackage);
    setIsCreateModalOpen(false);
    setNewPackage({
      name: '',
      description: '',
      type: 'construction',
      status: 'active',
      dueDate: '',
      teamMembers: [],
    });
  };

  const toggleTeamMember = (memberId: string) => {
    setNewPackage(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(memberId)
        ? prev.teamMembers.filter(id => id !== memberId)
        : [...prev.teamMembers, memberId]
    }));
  };

  useEffect(() => { setIsHydrated(true); }, []);

  if (!isHydrated) return <PackagesSkeleton />;

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-normal text-[#101828]">Packages</h1>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Package
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter(null)}
          className={cn(
            "rounded-xl border bg-white p-4 text-left transition-all hover:shadow-md",
            !statusFilter && "ring-2 ring-blue-500 ring-offset-2"
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-gray-900">{stats.total}</span>
            <span className="text-sm text-gray-500">Total</span>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'active' ? null : 'active')}
          className={cn(
            "rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-left transition-all hover:shadow-md",
            statusFilter === 'active' && "ring-2 ring-emerald-500 ring-offset-2"
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-emerald-600">{stats.active}</span>
            <span className="text-sm text-emerald-600">Active</span>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'completed' ? null : 'completed')}
          className={cn(
            "rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-left transition-all hover:shadow-md",
            statusFilter === 'completed' && "ring-2 ring-blue-500 ring-offset-2"
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-blue-600">{stats.completed}</span>
            <span className="text-sm text-blue-600">Completed</span>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'on-hold' ? null : 'on-hold')}
          className={cn(
            "rounded-xl border border-orange-100 bg-orange-50/50 p-4 text-left transition-all hover:shadow-md",
            statusFilter === 'on-hold' && "ring-2 ring-orange-500 ring-offset-2"
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-orange-600">{stats.onHold}</span>
            <span className="text-sm text-orange-600">On Hold</span>
          </div>
        </button>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "rounded-md p-2 transition-colors",
              viewMode === 'grid' ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "rounded-md p-2 transition-colors",
              viewMode === 'list' ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Packages Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPackages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onClick={() => handlePackageClick(pkg.slug)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPackages.map((pkg) => (
            <PackageListItem key={pkg.id} pkg={pkg} onClick={() => handlePackageClick(pkg.slug)} />
          ))}
        </div>
      )}

      {filteredPackages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-gray-100 p-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No packages found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Create New Package Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsCreateModalOpen(false)}>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Create New Package</h2>
                <p className="mt-1 text-sm text-gray-500">Add a new package to organize project components</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-t border-gray-100" />

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Package Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Package Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPackage.name}
                  onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                  placeholder="e.g., Architectural Design, MEP Systems..."
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newPackage.description}
                  onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                  placeholder="Describe the package scope, deliverables, and objectives..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Package Type */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Package Type<span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {packageTypes.map((type) => {
                    const TypeIcon = type.icon;
                    const isSelected = newPackage.type === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewPackage({ ...newPackage, type: type.id })}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
                          isSelected 
                            ? "border-blue-500 bg-blue-50/50" 
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        )}
                      >
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", type.color)}>
                          <TypeIcon className={cn("h-5 w-5", type.iconColor)} />
                        </div>
                        <span className={cn("text-sm font-medium", isSelected ? "text-blue-600" : "text-gray-700")}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Initial Status and Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Initial Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newPackage.status}
                    onChange={(e) => setNewPackage({ ...newPackage, status: e.target.value as 'active' | 'on-hold' })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={newPackage.dueDate}
                      onChange={(e) => setNewPackage({ ...newPackage, dueDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Assign Team Members */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Assign Team Members<span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
                    className="w-full flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    {newPackage.teamMembers.length > 0 ? (
                      <span className="text-gray-900">
                        {newPackage.teamMembers.length} member{newPackage.teamMembers.length > 1 ? 's' : ''} selected
                      </span>
                    ) : (
                      <span className="text-gray-400">Select team members...</span>
                    )}
                    <svg className={cn("ml-auto h-4 w-4 text-gray-400 transition-transform", isTeamDropdownOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isTeamDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {availableMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleTeamMember(member.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: member.color }}
                          >
                            {member.initials}
                          </div>
                          <span className="flex-1 text-sm text-gray-900">{member.name}</span>
                          {newPackage.teamMembers.includes(member.id) && (
                            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Members Display */}
                {newPackage.teamMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {newPackage.teamMembers.map((memberId) => {
                      const member = availableMembers.find(m => m.id === memberId);
                      if (!member) return null;
                      return (
                        <div
                          key={member.id}
                          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5"
                        >
                          <div
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: member.color }}
                          >
                            {member.initials}
                          </div>
                          <span className="text-sm text-gray-700">{member.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleTeamMember(member.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 pt-4 bg-gray-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePackage}
                disabled={!newPackage.name || !newPackage.description || !newPackage.dueDate || newPackage.teamMembers.length === 0}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg, onClick }: { pkg: Package; onClick: () => void }) {
  const status = statusConfig[pkg.status];
  const IconComponent = iconMap[pkg.icon] || Building2;
  const StatusIcon = status.icon;

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-300 hover:shadow-lg"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div 
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${pkg.color}20` }}
        >
          <IconComponent className="h-6 w-6" style={{ color: pkg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {pkg.name}
          </h3>
          <div className={cn("inline-flex items-center gap-1 mt-1 text-xs font-medium", status.color)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-gray-600 line-clamp-2">{pkg.description}</p>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-900">{pkg.progress}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn("h-full rounded-full transition-all", status.progressColor)}
            style={{ width: `${pkg.progress}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{pkg.tasksCompleted}/{pkg.totalTasks} tasks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>{new Date(pkg.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <div className="flex -space-x-2">
          {pkg.team.slice(0, 3).map((member) => (
            <div
              key={member.id}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white"
              style={{ backgroundColor: member.color }}
              title={member.name}
            >
              {member.initials}
            </div>
          ))}
          {pkg.team.length > 3 && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium text-gray-600">
              +{pkg.team.length - 3}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">{pkg.lastActivity}</span>
      </div>
    </button>
  );
}

function PackageListItem({ pkg, onClick }: { pkg: Package; onClick: () => void }) {
  const status = statusConfig[pkg.status];
  const IconComponent = iconMap[pkg.icon] || Building2;
  const StatusIcon = status.icon;

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-md"
    >
      {/* Icon */}
      <div 
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${pkg.color}20` }}
      >
        <IconComponent className="h-6 w-6" style={{ color: pkg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {pkg.name}
          </h3>
          <div className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", status.bg, status.color)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500 truncate">{pkg.description}</p>
      </div>

      {/* Progress */}
      <div className="w-32 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-900">{pkg.progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn("h-full rounded-full", status.progressColor)}
            style={{ width: `${pkg.progress}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="w-24 shrink-0 text-center">
        <div className="text-sm font-medium text-gray-900">{pkg.tasksCompleted}/{pkg.totalTasks}</div>
        <div className="text-xs text-gray-500">tasks</div>
      </div>

      {/* Due Date */}
      <div className="w-28 shrink-0 text-center">
        <div className="text-sm text-gray-900">
          {new Date(pkg.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="text-xs text-gray-500">Due date</div>
      </div>

      {/* Team */}
      <div className="flex -space-x-2">
        {pkg.team.slice(0, 2).map((member) => (
          <div
            key={member.id}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white"
            style={{ backgroundColor: member.color }}
            title={member.name}
          >
            {member.initials}
          </div>
        ))}
        {pkg.team.length > 2 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium text-gray-600">
            +{pkg.team.length - 2}
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="w-24 shrink-0 text-right text-xs text-gray-400">
        {pkg.lastActivity}
      </div>
    </button>
  );
}
