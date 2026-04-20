'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/config/api';
import { apiFetch } from '@/lib/api-client';
import NavisworksClashWorkspace from './NavisworksClashWorkspace';
import { clashesOverviewKey } from './hooks/useNavisworksWorkspace';

interface ClashesTabProps {
  projectPublicId: string;
  projectDisplayName?: string;
}

// ─── API types ────────────────────────────────────────────────────────────────

interface ClashResult {
  clashId: string;
  testId: string;
  testName: string;
  type: 'HARD' | 'SOFT' | 'DUPLICATE';
  status: 'new' | 'reviewed' | 'resolved';
  title: string;
  objectAModel: string;
  objectBModel: string;
  assignee: string;
  note: string;
}

interface ClashSummary {
  total: number;
  hard: number;
  soft: number;
  duplicate: number;
  resolved: number;
  reviewed: number;
  new: number;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const statusConfig = {
  new: { label: 'New', bg: 'bg-[#FFF1F2]', color: 'text-[#C70036]' },
  reviewed: { label: 'In Review', bg: 'bg-[#FEF3C7]', color: 'text-[#B45309]' },
  resolved: { label: 'Resolved', bg: 'bg-[#D1FAE5]', color: 'text-[#059669]' },
} as const;

const typeConfig = {
  HARD: { label: 'Hard Clash', severityLabel: 'HIGH', severityBg: 'bg-[#FEF2F2]', severityColor: 'text-[#DC2626]' },
  SOFT: { label: 'Soft Clash', severityLabel: 'MEDIUM', severityBg: 'bg-[#FFF7ED]', severityColor: 'text-[#C2410C]' },
  DUPLICATE: { label: 'Duplicate', severityLabel: 'LOW', severityBg: 'bg-[#F0FDF4]', severityColor: 'text-[#16A34A]' },
} as const;

const iconColors = {
  new: 'text-[#C70036] bg-[#FFF1F2]',
  reviewed: 'text-[#F59E0B] bg-[#FEF3C7]',
  resolved: 'text-[#10B981] bg-[#D1FAE5]',
} as const;

/** Page numbers with gaps as ellipsis — avoids rendering dozens of buttons (e.g. 1 2 … 9 10 11 … 17). */
function compactPaginationPages(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const delta = 1;
  const set = new Set<number>();
  set.add(1);
  set.add(totalPages);
  for (let p = currentPage - delta; p <= currentPage + delta; p++) {
    if (p >= 1 && p <= totalPages) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      out.push('ellipsis');
    }
    out.push(sorted[i]);
  }
  return out;
}

// ─── Overview UI ──────────────────────────────────────────────────────────────

function ClashOverview({
  projectPublicId,
  onRunDetection,
  onView3D,
}: {
  projectPublicId: string;
  onRunDetection: () => void;
  onView3D: (clash: ClashResult) => void;
}) {
  const PAGE_SIZE = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'hard' | 'soft'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<{ clashes: ClashResult[]; summary: ClashSummary }>({
    queryKey: clashesOverviewKey(projectPublicId),
    queryFn: async () => {
      const res = await apiFetch(apiUrl(`/projects/${encodeURIComponent(projectPublicId)}/navisworks/clashes`));
      if (!res.ok) throw new Error(`Failed to load clashes (${res.status})`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const clashes = data?.clashes ?? [];
  const summary = data?.summary;

  const filtered = clashes.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.assignee.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterType === 'hard') return matchesSearch && c.type === 'HARD';
    if (filterType === 'soft') return matchesSearch && (c.type === 'SOFT' || c.type === 'DUPLICATE');
    return matchesSearch;
  });

  const sorted = useMemo(() => {
    const unresolved = filtered.filter(c => c.status !== 'resolved');
    const resolved = filtered.filter(c => c.status === 'resolved');
    return [...unresolved, ...resolved];
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] font-normal text-[#101828]">Clash Detection</h2>
        <button
          onClick={onRunDetection}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm font-normal text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Run Detection
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Total Clashes</span>
          <span className="text-2xl font-normal text-[#101828]">
            {isLoading ? '—' : summary?.total ?? 0}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Hard Clashes</span>
          <span className="text-2xl font-normal text-[#EC003F]">
            {isLoading ? '—' : summary?.hard ?? 0}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Soft Clashes</span>
          <span className="text-2xl font-normal text-[#F59E0B]">
            {isLoading ? '—' : summary?.soft ?? 0}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">In Review</span>
          <span className="text-2xl font-normal text-[#4F39F6]">
            {isLoading ? '—' : summary?.reviewed ?? 0}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Resolved</span>
          <span className="text-2xl font-normal text-[#009966]">
            {isLoading ? '—' : summary?.resolved ?? 0}
          </span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative w-[448px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search clashes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2 pl-10 pr-4 text-sm text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'hard', 'soft'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilterType(f); setCurrentPage(1); }}
              className={cn(
                'rounded-[10px] px-3 py-2 text-xs font-normal transition-colors capitalize',
                filterType === f
                  ? 'bg-[#F0F9FF] text-[#0069A8]'
                  : 'border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
              )}
            >
              {f === 'all' ? 'All' : f === 'hard' ? 'Hard' : 'Soft'}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#364153] hover:bg-gray-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="rounded-[10px] border border-[#E5E7EB] bg-white">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-[#6A7282]">
            Loading clashes…
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-16 text-sm text-[#DC2626]">
            Failed to load clashes. Make sure models are imported and a test has been run.
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <svg className="h-10 w-10 text-[#D1D5DC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-medium text-[#101828]">No clashes found</p>
            <p className="text-xs text-[#6A7282]">
              {clashes.length === 0
                ? 'Import models and run a clash test to see results here.'
                : 'No clashes match the current filter.'}
            </p>
            {clashes.length === 0 && (
              <button
                onClick={onRunDetection}
                className="mt-1 inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
              >
                Run Detection
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && paginated.map((clash, index) => {
          const st = statusConfig[clash.status] ?? statusConfig.new;
          const tc = typeConfig[clash.type] ?? typeConfig.HARD;
          const ic = iconColors[clash.status] ?? iconColors.new;
          const isLast = index === paginated.length - 1;

          return (
            <div
              key={clash.clashId}
              className={cn('flex gap-4 p-6', !isLast && 'border-b border-[#E5E7EB]')}
            >
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]', ic)}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-[#6A7282]">{clash.clashId.slice(0, 8)}</span>
                  <span className={cn('rounded px-2 py-0.5 text-xs', st.bg, st.color)}>{st.label}</span>
                  <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#364153]">{tc.label}</span>
                  <span className={cn('rounded px-2 py-0.5 text-xs', tc.severityBg, tc.severityColor)}>{tc.severityLabel}</span>
                  <span className="rounded bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1D4ED8]">{clash.testName}</span>
                </div>

                <h3 className="text-sm font-normal text-[#101828]">{clash.title}</h3>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6A7282]">Models:</span>
                  <span className="rounded bg-[#F3F4F6] px-2 py-1 text-xs text-[#364153]">{clash.objectAModel}</span>
                  {clash.objectBModel !== clash.objectAModel && (
                    <span className="rounded bg-[#F3F4F6] px-2 py-1 text-xs text-[#364153]">{clash.objectBModel}</span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#6A7282]">
                    Assigned to{' '}
                    <span className="font-medium text-[#364153]">
                      {clash.assignee === 'Unassigned' ? 'no one' : clash.assignee}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onView3D(clash)}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#F3F4F6] px-3 py-1.5 text-xs text-[#364153] hover:bg-gray-200 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    View 3D
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Pagination */}
        {!isLoading && !isError && sorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4">
            <span className="text-xs text-[#6A7282]">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length} clashes
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-xs transition-colors',
                  safePage <= 1
                    ? 'cursor-not-allowed text-[#D1D5DC]'
                    : 'border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
                )}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Prev
              </button>

              {compactPaginationPages(safePage, totalPages).map((item, idx) =>
                item === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex min-w-[1.25rem] items-center justify-center px-0.5 text-xs font-medium text-[#99A1AF] select-none"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={cn(
                      'h-8 min-w-8 shrink-0 rounded-[10px] px-2 text-xs transition-colors',
                      item === safePage
                        ? 'bg-[#155DFC] text-white'
                        : 'border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
                    )}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-xs transition-colors',
                  safePage >= totalPages
                    ? 'cursor-not-allowed text-[#D1D5DC]'
                    : 'border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
                )}
              >
                Next
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ClashesTab ──────────────────────────────────────────────────────────

export default function ClashesTab({ projectPublicId, projectDisplayName }: ClashesTabProps) {
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [workspaceFocus, setWorkspaceFocus] = useState<{ testId: string; clashId: string } | null>(null);

  if (!projectPublicId.trim()) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12 text-center">
        <p className="text-base font-semibold text-[#101828]">No server project linked</p>
        <p className="mt-2 text-sm leading-relaxed text-[#6A7282]">
          Go to{' '}
          <a href="/projects" className="font-medium text-[#155DFC] underline-offset-2 hover:underline">Projects</a>
          {' '}and open a project you are a member of.
        </p>
        {projectDisplayName && <p className="mt-4 text-xs text-[#99A1AF]">Viewing (demo/UI): {projectDisplayName}</p>}
      </div>
    );
  }

  if (showWorkspace) {
    return (
      <NavisworksClashWorkspace
        projectSlug={projectPublicId}
        initialTestId={workspaceFocus?.testId ?? null}
        initialClashId={workspaceFocus?.clashId ?? null}
        onBack={() => {
          setShowWorkspace(false);
          setWorkspaceFocus(null);
        }}
      />
    );
  }

  return (
    <ClashOverview
      projectPublicId={projectPublicId}
      onRunDetection={() => {
        setWorkspaceFocus(null);
        setShowWorkspace(true);
      }}
      onView3D={(clash) => {
        setWorkspaceFocus({ testId: clash.testId, clashId: clash.clashId });
        setShowWorkspace(true);
      }}
    />
  );
}
