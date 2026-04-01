import { Skeleton } from '../skeleton';

export function SettingsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl space-y-8">
      {/* Avatar section */}
      <div className="flex items-center gap-5">
        <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      <Skeleton className="h-px w-full" />

      {/* Form fields */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}

      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}
