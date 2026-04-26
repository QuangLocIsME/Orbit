'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Activity as ActivityIcon,
  Plus, Edit, Trash2, ArrowRight, Search, X,
  MessageSquare, FolderPlus, FolderInput, FolderX,
  Upload, FileEdit, FileX, Settings, FileCheck, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface ScopedActivityScope {
  type: 'project' | 'package';
  projectId: string;
  packageId?: string | null;
}

interface ActivityItem {
  id: string;
  type: string;
  icon: string;
  color: string;
  action: string;
  user: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface ScopedActivityPanelProps {
  scope: ScopedActivityScope;
  variant?: 'full' | 'compact';
  title?: string;
}

const ACTIVITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'task_deleted', label: 'Task Deleted' },
  { value: 'task_moved', label: 'Task Moved' },
  { value: 'task_commented', label: 'Task Commented' },
  { value: 'folder_created', label: 'Folder Created' },
  { value: 'folder_renamed', label: 'Folder Renamed' },
  { value: 'folder_deleted', label: 'Folder Deleted' },
  { value: 'file_uploaded', label: 'File Uploaded' },
  { value: 'file_renamed', label: 'File Renamed' },
  { value: 'file_deleted', label: 'File Deleted' },
];

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 20, label: '20 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
];

const TYPE_COLORS: Record<string, string> = {
  task_created:     'bg-emerald-50',
  task_updated:     'bg-blue-50',
  task_deleted:     'bg-red-50',
  task_moved:       'bg-purple-50',
  task_commented:   'bg-amber-50',
  folder_created:   'bg-orange-50',
  folder_renamed:   'bg-yellow-50',
  folder_deleted:   'bg-red-50',
  file_uploaded:    'bg-blue-50',
  file_renamed:     'bg-yellow-50',
  file_deleted:     'bg-red-50',
  change_request:   'bg-purple-50',
  document:         'bg-blue-50',
  task:             'bg-emerald-50',
  task_comment:     'bg-amber-50',
  project_update:   'bg-green-50',
};

const TYPE_ICON_COLORS: Record<string, string> = {
  task_created:     'text-emerald-600',
  task_updated:     'text-blue-600',
  task_deleted:     'text-red-600',
  task_moved:       'text-purple-600',
  task_commented:   'text-amber-600',
  folder_created:   'text-orange-600',
  folder_renamed:   'text-yellow-700',
  folder_deleted:   'text-red-600',
  file_uploaded:    'text-blue-600',
  file_renamed:     'text-yellow-700',
  file_deleted:     'text-red-600',
  change_request:   'text-purple-600',
  document:         'text-blue-600',
  task:             'text-emerald-600',
  task_comment:     'text-amber-600',
  project_update:   'text-green-600',
};

const getIconForType = (type: string): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    task_created:     <Plus className="h-4 w-4" />,
    task_updated:     <Edit className="h-4 w-4" />,
    task_deleted:     <Trash2 className="h-4 w-4" />,
    task_moved:       <ArrowRight className="h-4 w-4" />,
    task_commented:   <MessageSquare className="h-4 w-4" />,
    folder_created:   <FolderPlus className="h-4 w-4" />,
    folder_renamed:   <FolderInput className="h-4 w-4" />,
    folder_deleted:   <FolderX className="h-4 w-4" />,
    file_uploaded:   <Upload className="h-4 w-4" />,
    file_renamed:    <FileEdit className="h-4 w-4" />,
    file_deleted:    <FileX className="h-4 w-4" />,
    change_request:  <Edit className="h-4 w-4" />,
    document:        <Upload className="h-4 w-4" />,
    task:            <Plus className="h-4 w-4" />,
    task_comment:    <MessageSquare className="h-4 w-4" />,
    project_update:  <Settings className="h-4 w-4" />,
  };
  return iconMap[type] || <ActivityIcon className="h-4 w-4" />;
};

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (Number.isNaN(date.getTime()) || diffMs < 0) return 'Just Now';

  if (diffMs < 20000) return 'Just Now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 1) return `${diffMins} min ago`;
  if (diffDays < 1) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const ActivityRow = ({ activity, compact }: { activity: ActivityItem; compact?: boolean }) => {
  const iconBg = TYPE_COLORS[activity.type] || 'bg-gray-50';
  const iconColor = TYPE_ICON_COLORS[activity.type] || 'text-gray-500';

  return (
    <div className={cn(
      'flex items-start gap-3',
      compact ? 'py-3' : 'px-5 py-4',
    )}>
      <div className={cn('flex items-center justify-center rounded-lg shrink-0', activity.color || iconBg)}>
        <span className={iconColor}>
          {getIconForType(activity.type)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium text-[#101828]',
          !compact && 'leading-relaxed'
        )}>
          {activity.action}
        </p>
        <p className="text-xs text-[#6A7282] mt-1">{activity.user} &middot; {formatRelativeTime(activity.createdAt)}</p>
      </div>
    </div>
  );
};

function DropdownFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label || 'All';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border text-[13px] font-medium transition-colors',
          value
            ? 'border-[#155DFC] bg-[#EFF6FF] text-[#1447E6]'
            : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-[#D0D5DD]'
        )}
      >
        {label}: {selectedLabel}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-[8px] border border-[#E5E7EB] shadow-lg z-50 py-1 min-w-[160px]">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50',
                opt.value === value ? 'text-[#1447E6] font-medium' : 'text-[#374151]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownSizeFilter({
  value,
  options,
  onChange,
}: {
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label || '10 / page';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] border border-[#E5E7EB] bg-white text-[12px] text-[#374151] hover:border-[#D0D5DD] transition-colors"
      >
        {selectedLabel}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-[8px] border border-[#E5E7EB] shadow-lg z-50 py-1 min-w-[100px]">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50',
                opt.value === value ? 'text-[#1447E6] font-medium' : 'text-[#374151]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E7EB]">
      <span className="text-[12px] text-[#6A7282]">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) {
            page = i + 1;
          } else if (currentPage <= 3) {
            page = i + 1;
          } else if (currentPage >= totalPages - 2) {
            page = totalPages - 4 + i;
          } else {
            page = currentPage - 2 + i;
          }
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                'inline-flex items-center justify-center h-8 w-8 rounded-[6px] text-[12px] font-medium transition-colors',
                currentPage === page
                  ? 'bg-[#155DFC] text-white'
                  : 'border border-[#E5E7EB] text-[#374151] hover:bg-gray-50'
              )}
            >
              {page}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ScopedActivityPanel({
  scope,
  variant = 'full',
  title = 'Activity Feed',
}: ScopedActivityPanelProps) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const endpoint = scope.type === 'package' && scope.packageId
          ? `/api/projects/${scope.projectId}/packages/${scope.packageId}/activities`
          : `/api/projects/${scope.projectId}/activities`;
        const res = await apiFetch(endpoint);
        const payload = await res.json().catch(() => null);

        if (!cancelled) {
          setActivities(Array.isArray(payload?.data) ? payload.data : []);
          setCurrentPage(1);
        }
      } catch {
        if (!cancelled) {
          setActivities([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [scope.packageId, scope.projectId, scope.type]);

  // Derive unique users from activities
  const uniqueUsers = useMemo(() => {
    const names = activities.map(a => a.user).filter(Boolean);
    return [...new Set(names)];
  }, [activities]);

  // Derive unique types from activities
  const availableTypes = useMemo(() => {
    const typesInActivities = new Set(activities.map(a => a.type));
    return ACTIVITY_TYPES.filter(t => t.value === '' || typesInActivities.has(t.value));
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activities
      .filter(activity => {
        if (filterType && activity.type !== filterType) return false;
        if (filterUser && activity.user !== filterUser) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!activity.action.toLowerCase().includes(q) && !activity.user.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activities, filterType, filterUser, search]);

  // Pagination
  const totalItems = filteredActivities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedActivities = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize, totalPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterUser, search]);

  // Reset type filter if selected type is no longer available
  useEffect(() => {
    if (filterType && !availableTypes.some(t => t.value === filterType)) {
      setFilterType('');
    }
  }, [availableTypes, filterType]);

  const visibleActivities = useMemo(
    () => variant === 'compact' ? filteredActivities.slice(0, 5) : paginatedActivities,
    [filteredActivities, paginatedActivities, variant]
  );

  const hasFilters = search || filterType || filterUser;

  if (variant === 'compact') {
    return (
      <div className="flex h-[300px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <ActivityIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : visibleActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <ActivityIcon className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No recent activity</p>
              <p className="text-xs text-gray-400 mt-1">Activity will appear here</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-gray-100">
              {visibleActivities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search + filters + margin */}
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginTop: '0px', marginBottom: '24px' }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]" />
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] pl-9 pr-8 text-sm text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-[#99A1AF] hover:text-[#374151]" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <DropdownFilter
          label="Type"
          value={filterType}
          options={availableTypes}
          onChange={setFilterType}
        />

        {/* User filter */}
        <DropdownFilter
          label="User"
          value={filterUser}
          options={[{ value: '', label: 'All Users' }, ...uniqueUsers.map(u => ({ value: u, label: u }))]}
          onChange={setFilterUser}
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterUser(''); }}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-[8px] border border-[#E5E7EB] text-[13px] text-[#6A7282] hover:text-[#374151] hover:border-[#D0D5DD] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : visibleActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <ActivityIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No activity found</h3>
          <p className="text-sm text-gray-500">{hasFilters ? 'Try adjusting your filters' : 'Activity will appear here as things happen'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {visibleActivities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Page size selector - shown when not on first page controls */}
      {!loading && totalItems > 0 && (
        <div className="flex items-center justify-end">
          <span className="text-[12px] text-[#6A7282] mr-2">Show</span>
          <DropdownSizeFilter
            value={pageSize}
            options={PAGE_SIZE_OPTIONS}
            onChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </div>
      )}
    </div>
  );
}
