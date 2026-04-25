'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
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
  icon: 'check' | 'alert' | 'upload' | 'edit' | 'settings';
  color: string;
  action: string;
  user: string;
  createdAt: string;
}

interface ScopedActivityPanelProps {
  scope: ScopedActivityScope;
  variant?: 'full' | 'compact';
  title?: string;
}

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (Number.isNaN(date.getTime()) || diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 30) return 'Just now';
  if (diffHours < 1) return `${diffMins} min ago`;
  if (diffDays < 1) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export default function ScopedActivityPanel({
  scope,
  variant = 'full',
  title = 'Activity Feed',
}: ScopedActivityPanelProps) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

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

  const visibleActivities = useMemo(
    () => variant === 'compact' ? activities.slice(0, 5) : activities,
    [activities, variant]
  );

  if (variant === 'compact') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <ActivityIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
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
          <div className="space-y-4">
            {visibleActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', activity.color)}>
                  <ActivityIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.user} • {formatRelativeTime(activity.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-[#101828]">{title}</h2>
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
          <h3 className="text-lg font-medium text-gray-900 mb-1">No activity yet</h3>
          <p className="text-sm text-gray-500">Activity will appear here as things happen</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {visibleActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 px-5 py-4">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', activity.color)}>
                <ActivityIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#101828]">{activity.action}</p>
                <p className="text-xs text-[#6A7282] mt-1">{activity.user} • {formatRelativeTime(activity.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
