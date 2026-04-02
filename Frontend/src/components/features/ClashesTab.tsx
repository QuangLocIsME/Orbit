'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/config/api';

interface Clash {
  id: string;
  status: 'open' | 'in-progress' | 'resolved' | 'new' | 'active';
  type: 'Hard Clash' | 'Soft Clash';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  location: string;
  models: string[];
  assignedTo: string;
  distance?: string;
  element1?: { name: string; category: string; file: string };
  element2?: { name: string; category: string; file: string };
}

interface ClashGroup {
  id: string;
  name: string;
  count: number;
  items: Clash[];
}

interface BackendClash {
  id: string;
  objectA: string;
  objectB: string;
  position: [number, number, number];
  severity: 'low' | 'medium' | 'high';
  intersectionVolume?: number;
  distance?: number;
  groupKey?: string;
}

interface BackendClashGroup {
  id: string;
  name: string;
  count: number;
  items: BackendClash[];
}

interface BackendClashResponse {
  clashes: BackendClash[];
  summary?: {
    total: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
  groups?: BackendClashGroup[];
}

type Viewer2DTool = 'Pan' | 'Zoom' | 'Measure';
type Viewer3DTool = 'Orbit' | 'Pan' | 'Zoom' | 'Section' | 'Measure';

const DEFAULT_ASSIGNEE = 'Unassigned';

const formatDistance = (distance?: number) =>
  typeof distance === 'number' ? `${distance.toFixed(2)} m` : undefined;

const formatPosition = (position: [number, number, number]) =>
  `X: ${position[0].toFixed(2)}, Y: ${position[1].toFixed(2)}, Z: ${position[2].toFixed(2)}`;

const prettifyIfcType = (type: string) => type.replace(/^Ifc/, '');

const toListClash = (clash: BackendClash): Clash => {
  const typeA = clash.groupKey?.split('__')[0] ?? 'ObjectA';
  const typeB = clash.groupKey?.split('__')[1] ?? 'ObjectB';
  const uiSeverity = clash.severity === 'high' ? 'high' : clash.severity;

  return {
    id: clash.id,
    status: clash.severity === 'high' ? 'open' : clash.severity === 'medium' ? 'in-progress' : 'resolved',
    type: clash.intersectionVolume && clash.intersectionVolume > 0 ? 'Hard Clash' : 'Soft Clash',
    severity: uiSeverity,
    title: `${prettifyIfcType(typeA)} intersects ${prettifyIfcType(typeB)}`,
    location: formatPosition(clash.position),
    models: [clash.objectA, clash.objectB],
    assignedTo: DEFAULT_ASSIGNEE,
    distance: formatDistance(clash.distance),
    element1: { name: clash.objectA, category: prettifyIfcType(typeA), file: 'Mock model' },
    element2: { name: clash.objectB, category: prettifyIfcType(typeB), file: 'Mock model' },
  };
};

const toDetectionClash = (clash: BackendClash): Clash => ({
  ...toListClash(clash),
  status: clash.severity === 'high' ? 'new' : clash.severity === 'medium' ? 'active' : 'resolved',
});

const toDetectionGroups = (groups: BackendClashGroup[] = []): ClashGroup[] =>
  groups.map((group) => ({
    id: group.id,
    name: group.name,
    count: group.count,
    items: group.items.map(toDetectionClash),
  }));

const getHighlightTone = (severity: Clash['severity']) => {
  if (severity === 'critical' || severity === 'high') {
    return {
      ring: 'ring-red-400/70',
      fill: 'bg-red-500/25',
      text: 'text-red-200',
      border: 'border-red-400/60',
    };
  }
  if (severity === 'medium') {
    return {
      ring: 'ring-amber-400/70',
      fill: 'bg-amber-500/25',
      text: 'text-amber-200',
      border: 'border-amber-400/60',
    };
  }
  return {
    ring: 'ring-emerald-400/70',
    fill: 'bg-emerald-500/20',
    text: 'text-emerald-200',
    border: 'border-emerald-400/60',
  };
};

const statusConfig = {
  open: { label: 'open', bg: 'bg-[#FFF1F2]', color: 'text-[#C70036]' },
  'in-progress': { label: 'in-progress', bg: 'bg-[#FEF3C7]', color: 'text-[#B45309]' },
  resolved: { label: 'resolved', bg: 'bg-[#D1FAE5]', color: 'text-[#059669]' },
  new: { label: 'New', bg: 'bg-[#10B981]', color: 'text-white' },
  active: { label: 'Active', bg: 'bg-[#F59E0B]', color: 'text-white' },
};

const severityConfig = {
  critical: { label: 'CRITICAL', bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
  high: { label: 'high', bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
  medium: { label: 'medium', bg: 'bg-[#FFF7ED]', color: 'text-[#C2410C]' },
  low: { label: 'low', bg: 'bg-[#F0FDF4]', color: 'text-[#16A34A]' },
};

const iconColors = {
  open: 'text-[#0084D1] bg-[#F0F9FF]',
  'in-progress': 'text-[#F59E0B] bg-[#FEF3C7]',
  resolved: 'text-[#10B981] bg-[#D1FAE5]',
  new: 'text-[#DC2626] bg-[#FEF2F2]',
  active: 'text-[#F59E0B] bg-[#FEF3C7]',
};

export default function ClashesTab() {
  const [clashesData, setClashesData] = useState<Clash[]>([]);
  const [clashGroups, setClashGroups] = useState<ClashGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningDetection, setIsRunningDetection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'high' | 'medium'>('all');
  const [isDetectionView, setIsDetectionView] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'split'>('split');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [selectedClash, setSelectedClash] = useState<Clash | null>(null);
  const [active2DTool, setActive2DTool] = useState<Viewer2DTool>('Pan');
  const [active3DTool, setActive3DTool] = useState<Viewer3DTool>('Orbit');
  const [resolvedClashIds, setResolvedClashIds] = useState<string[]>([]);

  const applyClashResponse = (data: BackendClashResponse) => {
    const listClashes = (data.clashes ?? []).map(toListClash);
    const groupedClashes = toDetectionGroups(data.groups);

    setClashesData(listClashes);
    setClashGroups(groupedClashes);
    setExpandedGroups(groupedClashes.length > 0 ? [groupedClashes[0].id] : []);
    setSelectedClash(groupedClashes[0]?.items[0] ?? null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadClashes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(apiUrl('/clashes'));
        if (!response.ok) {
          throw new Error(`Failed to load clashes (${response.status})`);
        }

        const data = (await response.json()) as BackendClashResponse;
        if (!isMounted) return;

        applyClashResponse(data);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load clashes');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadClashes();

    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate stats
  const totalClashes = clashesData.length;
  const highSeverity = clashesData.filter(c => c.severity === 'critical' || c.severity === 'high').length;
  const inProgress = clashesData.filter(c => c.status === 'in-progress').length;
  const resolved = clashesData.filter(c => c.status === 'resolved').length;

  // Detection view stats
  const detectionTotal = clashGroups.reduce((acc, g) => acc + g.count, 0);
  const detectionNew = clashGroups.reduce((acc, g) => acc + g.items.filter(i => i.status === 'new').length, 0);
  const detectionResolved = clashGroups.reduce((acc, g) => acc + g.items.filter(i => i.status === 'resolved').length, 0);

  // Filter clashes
  const filteredClashes = useMemo(() => clashesData.filter(clash => {
    const matchesSearch = clash.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          clash.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'high') return matchesSearch && (clash.severity === 'critical' || clash.severity === 'high');
    if (filterType === 'medium') return matchesSearch && clash.severity === 'medium';
    return matchesSearch;
  }), [clashesData, filterType, searchQuery]);

  const filteredGroups = useMemo(() => clashGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const matchesSearch =
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.location.toLowerCase().includes(searchQuery.toLowerCase());

        if (filterType === 'all') return matchesSearch;
        if (filterType === 'high') return matchesSearch && (item.severity === 'critical' || item.severity === 'high');
        if (filterType === 'medium') return matchesSearch && item.severity === 'medium';
        return matchesSearch;
      }),
    }))
    .filter((group) => group.items.length > 0)
    .map((group) => ({ ...group, count: group.items.length })), [clashGroups, filterType, searchQuery]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const focusClash = (clash: Clash) => {
    setSelectedClash(clash);
    setIsDetectionView(true);
    setViewMode('split');
  };

  const handleExportReport = () => {
    const reportPayload = {
      generatedAt: new Date().toISOString(),
      selectedClashId: selectedClash?.id ?? null,
      active2DTool,
      active3DTool,
      clashes: filteredClashes,
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clash-report.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResolveClash = (clashId: string) => {
    setResolvedClashIds((prev) => (prev.includes(clashId) ? prev : [...prev, clashId]));
    setSelectedClash((prev) => (
      prev?.id === clashId
        ? {
            ...prev,
            status: 'resolved',
          }
        : prev
    ));
  };

  const isClashResolved = (clashId: string) => resolvedClashIds.includes(clashId);

  const getRenderedStatus = (clash: Clash): Clash['status'] =>
    isClashResolved(clash.id) ? 'resolved' : clash.status;

  const get2DToolHint = () => {
    switch (active2DTool) {
      case 'Pan':
        return 'Drag the 2D viewport to inspect nearby context.';
      case 'Zoom':
        return 'Zoom in to review the overlap zone more closely.';
      case 'Measure':
        return `Measure clash clearance at ${selectedClash?.distance ?? '0.00 m'}.`;
    }
  };

  const get3DToolHint = () => {
    switch (active3DTool) {
      case 'Orbit':
        return 'Orbit around the current clash focus.';
      case 'Pan':
        return 'Pan the camera while preserving clash focus.';
      case 'Zoom':
        return 'Zoom to the active clash and its entity pair.';
      case 'Section':
        return 'Section mode simulates cutting geometry around the clash.';
      case 'Measure':
        return `Measure overlap details at ${selectedClash?.distance ?? '0.00 m'}.`;
    }
  };

  const runDetection = async () => {
    try {
      setIsRunningDetection(true);
      setError(null);

      const response = await fetch(apiUrl('/clash-detect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Detection failed (${response.status})`);
      }

      const data = (await response.json()) as BackendClashResponse;
      applyClashResponse(data);
      setIsDetectionView(true);
      setViewMode('split');
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to run clash detection');
    } finally {
      setIsRunningDetection(false);
    }
  };

  // Detection Results View
  if (isDetectionView) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] -mx-[300px]">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-white border-b-2 border-[#E5E7EB] px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Run Test Button */}
            <button 
              onClick={runDetection}
              disabled={isRunningDetection}
              className="inline-flex items-center gap-2 rounded bg-[#155DFC] px-3 py-2 text-sm text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {isRunningDetection ? 'Running...' : 'Run Detection'}
            </button>

            {/* Export Report Button */}
            <button
              onClick={handleExportReport}
              className="inline-flex items-center gap-2 rounded border border-[#D1D5DC] bg-white px-3 py-2 text-sm text-[#364153] hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Report
            </button>

            {/* Separator */}
            <div className="h-6 w-px bg-[#D1D5DC]" />

            {/* View Mode Toggle */}
            <div className="flex items-center rounded bg-[#F3F4F6] p-0.5">
              <button
                onClick={() => setViewMode('2d')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  viewMode === '2d' ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565]"
                )}
              >
                2D
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  viewMode === '3d' ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565]"
                )}
              >
                3D
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  viewMode === 'split' ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565]"
                )}
              >
                Split
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[#4A5565]">Total: <span className="text-[#101828] font-medium">{detectionTotal}</span></span>
            <span className="text-[#4A5565]">New: <span className="text-[#DC2626] font-medium">{detectionNew}</span></span>
            <span className="text-[#4A5565]">Resolved: <span className="text-[#10B981] font-medium">{detectionResolved}</span></span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden bg-[#F9FAFB]">
          {/* Left Sidebar - Clash List */}
          <div className="w-[280px] flex-shrink-0 border-r border-[#E5E7EB] bg-white overflow-y-auto">
            {/* Search */}
            <div className="p-3 border-b border-[#E5E7EB]">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search clashes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Clash Groups */}
            <div className="p-2">
              {filteredGroups.map((group) => (
                <div key={group.id} className="mb-1">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center justify-between w-full px-2 py-2 text-left hover:bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <svg 
                        className={cn("h-4 w-4 text-[#4A5565] transition-transform", expandedGroups.includes(group.id) && "rotate-90")} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-medium text-[#101828]">{group.name}</span>
                    </div>
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#F3F4F6] text-xs text-[#4A5565]">
                      {group.count}
                    </span>
                  </button>

                  {/* Group Items */}
                  {expandedGroups.includes(group.id) && (
                    <div className="ml-4 border-l border-[#E5E7EB]">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedClash(item)}
                          className={cn(
                            "flex flex-col w-full px-3 py-2 text-left border-l-2 -ml-px",
                            selectedClash?.id === item.id 
                              ? "border-l-[#155DFC] bg-[#F0F9FF]" 
                              : "border-l-transparent hover:bg-gray-50"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "h-2 w-2 rounded-full",
                              item.status === 'new' ? "bg-[#DC2626]" : 
                              item.status === 'active' ? "bg-[#F59E0B]" : 
                              "bg-[#10B981]"
                            )} />
                            <span className="text-sm font-medium text-[#101828]">{item.title}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium",
                              statusConfig[getRenderedStatus(item)]?.bg,
                              statusConfig[getRenderedStatus(item)]?.color
                            )}>
                              {statusConfig[getRenderedStatus(item)]?.label}
                            </span>
                            <span className="text-[10px] text-[#4A5565]">{item.type}</span>
                            {item.distance && (
                              <span className="text-[10px] text-[#6A7282]">{item.distance}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center/Right - Viewer Area */}
          <div className="flex-1 flex">
            {/* 2D View */}
            {(viewMode === '2d' || viewMode === 'split') && (
              <div className={cn("flex min-h-0 flex-col bg-[#F9FAFB]", viewMode === 'split' ? "flex-1 border-r border-[#E5E7EB]" : "flex-1")}>
                {/* 2D Toolbar */}
                <div className="flex items-center gap-1 bg-[#364153] px-2 py-1">
                  {(['Pan', 'Zoom', 'Measure'] as Viewer2DTool[]).map((tool) => (
                    <button
                      key={tool}
                      onClick={() => setActive2DTool(tool)}
                      className={cn(
                        "px-3 py-1 text-xs rounded transition-colors",
                        active2DTool === tool ? "bg-white text-[#101828]" : "text-white hover:bg-[#4A5565]"
                      )}
                    >
                      {tool}
                    </button>
                  ))}
                </div>
                {/* 2D Content */}
                <div className="min-h-0 flex-1 p-6">
                  <div className="relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl border border-[#D1D5DC] bg-white">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:32px_32px] opacity-70" />
                    {selectedClash ? (
                      <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[#6A7282]">2D Clash Focus</p>
                            <h4 className="mt-2 text-base font-medium text-[#101828]">{selectedClash.title}</h4>
                          </div>
                          <span className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium",
                            getHighlightTone(selectedClash.severity).border,
                            getHighlightTone(selectedClash.severity).text
                          )}>
                            {selectedClash.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="relative mx-auto h-32 w-full max-w-md shrink-0 md:h-40">
                          <div className="absolute left-[12%] top-[18%] h-24 w-28 rounded-lg border border-sky-400/70 bg-sky-500/10" />
                          <div className={cn(
                            "absolute left-[36%] top-[30%] h-24 w-32 rounded-lg border-2 shadow-[0_0_0_8px_rgba(255,255,255,0.35)]",
                            getHighlightTone(selectedClash.severity).border,
                            getHighlightTone(selectedClash.severity).fill,
                            getHighlightTone(selectedClash.severity).ring
                          )} />
                          <div className="absolute left-[48%] top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#155DFC] px-2 py-1 text-[10px] font-medium text-white shadow">
                            Clash
                          </div>
                        </div>
                        <div className="grid gap-3 text-sm text-[#4A5565] md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-lg bg-[#F9FAFB] p-3">
                            <p className="text-xs text-[#6A7282]">Location</p>
                            <p className="mt-1 font-medium text-[#101828]">{selectedClash.location}</p>
                          </div>
                          <div className="rounded-lg bg-[#F9FAFB] p-3">
                            <p className="text-xs text-[#6A7282]">Entity A</p>
                            <p className="mt-1 font-medium text-[#101828]">{selectedClash.element1?.name ?? 'Unknown'}</p>
                          </div>
                          <div className="rounded-lg bg-[#F9FAFB] p-3">
                            <p className="text-xs text-[#6A7282]">2D Tool</p>
                            <p className="mt-1 font-medium text-[#101828]">{active2DTool}</p>
                            <p className="mt-1 text-xs text-[#6A7282]">{get2DToolHint()}</p>
                          </div>
                          <div className="rounded-lg bg-[#F9FAFB] p-3">
                            <p className="text-xs text-[#6A7282]">Entity B</p>
                            <p className="mt-1 font-medium text-[#101828]">{selectedClash.element2?.name ?? 'Unknown'}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 text-center">
                        <div>
                          <div className="mx-auto mb-2 flex h-24 w-32 items-center justify-center rounded-lg border-2 border-dashed border-[#D1D5DC]">
                            <svg className="h-8 w-8 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                          </div>
                          <p className="text-sm text-[#6A7282]">Select a clash to focus the 2D view</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3D View */}
            {(viewMode === '3d' || viewMode === 'split') && (
              <div className="flex min-h-0 flex-1 flex-col bg-[#1a1a2e]">
                {/* 3D Toolbar */}
                <div className="flex items-center gap-1 bg-[#364153] px-2 py-1">
                  {(['Orbit', 'Pan', 'Zoom', 'Section', 'Measure'] as Viewer3DTool[]).map((tool) => (
                    <button
                      key={tool}
                      onClick={() => setActive3DTool(tool)}
                      className={cn(
                        "px-3 py-1 text-xs rounded transition-colors",
                        active3DTool === tool ? "bg-white text-[#101828]" : "text-white hover:bg-[#4A5565]"
                      )}
                    >
                      {tool}
                    </button>
                  ))}
                </div>
                {/* 3D Content */}
                <div className="min-h-0 flex-1 bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] p-6">
                  <div className="relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl border border-[#4A5565] bg-[#111827]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_55%)]" />
                    {selectedClash ? (
                      <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 text-white md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">3D Clash Preview</p>
                            <h4 className="mt-2 text-base font-medium">{selectedClash.title}</h4>
                            <p className="mt-2 text-sm text-slate-300">Ready to map `element1` and `element2` IDs into xeokit entity highlighting.</p>
                          </div>
                          <div className={cn(
                            "rounded-lg border px-3 py-2 text-xs",
                            getHighlightTone(selectedClash.severity).border,
                            getHighlightTone(selectedClash.severity).text
                          )}>
                            Active focus
                          </div>
                        </div>
                        <div className="relative mx-auto h-36 w-full max-w-lg shrink-0 md:h-48">
                          <div className="absolute left-[18%] top-[18%] h-28 w-28 rotate-[-12deg] rounded-xl border border-sky-400/60 bg-sky-500/10 shadow-lg shadow-sky-900/30" />
                          <div className="absolute right-[20%] bottom-[16%] h-24 w-36 rotate-[10deg] rounded-xl border border-emerald-400/50 bg-emerald-500/10 shadow-lg shadow-emerald-900/30" />
                          <div className={cn(
                            "absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 backdrop-blur-sm shadow-[0_0_30px_rgba(248,113,113,0.25)]",
                            getHighlightTone(selectedClash.severity).border,
                            getHighlightTone(selectedClash.severity).fill
                          )} />
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#155DFC] px-3 py-1 text-xs font-medium text-white shadow-lg">
                            Highlight
                          </div>
                        </div>
                        <div className="grid gap-3 text-sm md:grid-cols-2">
                          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                            <p className="text-xs text-slate-400">Entity IDs</p>
                            <p className="mt-1 font-medium">{selectedClash.element1?.name}</p>
                            <p className="text-slate-400">{selectedClash.element2?.name}</p>
                          </div>
                          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                            <p className="text-xs text-slate-400">Camera Target</p>
                            <p className="mt-1 font-medium">{selectedClash.location}</p>
                            <p className="text-slate-400">{selectedClash.distance ?? 'Distance unavailable'}</p>
                          </div>
                          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 md:col-span-2">
                            <p className="text-xs text-slate-400">3D Tool</p>
                            <p className="mt-1 font-medium">{active3DTool}</p>
                            <p className="text-slate-400">{get3DToolHint()}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 text-center text-slate-400">
                        <div>
                          <div className="mx-auto mb-2 flex h-32 w-48 items-center justify-center rounded-lg border-2 border-dashed border-[#4A5565]">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                            </svg>
                          </div>
                          <p className="text-sm">Select a clash to preview future xeokit highlighting</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel - Selected Clash Details */}
        {selectedClash && (
          <div className="bg-white border-t border-[#E5E7EB] px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-[#101828] mb-2">{selectedClash.title}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    statusConfig[getRenderedStatus(selectedClash)]?.bg,
                    statusConfig[getRenderedStatus(selectedClash)]?.color
                  )}>
                    {statusConfig[getRenderedStatus(selectedClash)]?.label}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#F3F4F6] text-xs text-[#364153]">
                    {selectedClash.type}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    severityConfig[selectedClash.severity]?.bg,
                    severityConfig[selectedClash.severity]?.color
                  )}>
                    {severityConfig[selectedClash.severity]?.label}
                  </span>
                </div>

                {/* Element Info */}
                <div className="grid grid-cols-2 gap-8">
                  {selectedClash.element1 && (
                    <div>
                      <p className="text-xs text-[#6A7282] mb-1">Element 1</p>
                      <p className="text-sm font-medium text-[#101828]">{selectedClash.element1.name}</p>
                      <p className="text-xs text-[#4A5565]">{selectedClash.element1.category}</p>
                      <p className="text-xs text-[#6A7282]">{selectedClash.element1.file}</p>
                    </div>
                  )}
                  {selectedClash.element2 && (
                    <div>
                      <p className="text-xs text-[#6A7282] mb-1">Element 2</p>
                      <p className="text-sm font-medium text-[#101828]">{selectedClash.element2.name}</p>
                      <p className="text-xs text-[#4A5565]">{selectedClash.element2.category}</p>
                      <p className="text-xs text-[#6A7282]">{selectedClash.element2.file}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned To */}
              <div className="text-right">
                <p className="text-xs text-[#6A7282] mb-1">Assigned to</p>
                <p className="text-sm font-medium text-[#101828]">{selectedClash.assignedTo}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default List View
  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[24px] font-normal text-[#101828]">Clash Detection</h2>
        </div>
        <button 
          onClick={runDetection}
          disabled={isRunningDetection}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm font-normal text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {isRunningDetection ? 'Running...' : 'Run Detection'}
        </button>
      </div>

      {error && (
        <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Total Clashes</span>
          <span className="text-2xl font-normal text-[#101828]">{totalClashes}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">High Severity</span>
          <span className="text-2xl font-normal text-[#EC003F]">{highSeverity}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">In Progress</span>
          <span className="text-2xl font-normal text-[#4F39F6]">{inProgress}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Resolved</span>
          <span className="text-2xl font-normal text-[#009966]">{resolved}</span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative w-[448px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search clashes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2 pl-10 pr-4 text-sm text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "rounded-[10px] px-3 py-2 text-xs font-normal transition-colors",
              filterType === 'all'
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('high')}
            className={cn(
              "rounded-[10px] px-3 py-2 text-xs font-normal transition-colors",
              filterType === 'high'
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
            )}
          >
            High
          </button>
          <button
            onClick={() => setFilterType('medium')}
            className={cn(
              "rounded-[10px] px-3 py-2 text-xs font-normal transition-colors",
              filterType === 'medium'
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
            )}
          >
            Medium
          </button>
        </div>
      </div>

      {/* Clashes List */}
      <div className="rounded-[10px] border border-[#E5E7EB] bg-white">
        {isLoading && (
          <div className="p-6 text-sm text-[#6A7282]">Loading clashes...</div>
        )}
        {!isLoading && filteredClashes.length === 0 && (
          <div className="p-6 text-sm text-[#6A7282]">No clashes found.</div>
        )}
        {filteredClashes.map((clash, index) => (
          <div
            key={clash.id}
            className={cn(
              "flex gap-4 p-6",
              index !== filteredClashes.length - 1 && "border-b border-[#E5E7EB]"
            )}
          >
            {/* Warning Icon */}
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]", iconColors[clash.status])}>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col gap-2">
              {/* Tags Row */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#101828]">{clash.id}</span>
                <span className={cn("rounded px-2 py-0.5 text-xs", statusConfig[clash.status].bg, statusConfig[clash.status].color)}>
                  {statusConfig[clash.status].label}
                </span>
                <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#364153]">
                  {clash.type}
                </span>
                <span className={cn("rounded px-2 py-0.5 text-xs", severityConfig[clash.severity].bg, severityConfig[clash.severity].color)}>
                  {severityConfig[clash.severity].label}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-normal text-[#101828]">{clash.title}</h3>

              {/* Location */}
              <p className="text-sm text-[#4A5565]">{clash.location}</p>

              {/* Models */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6A7282]">Models:</span>
                {clash.models.map((model, idx) => (
                  <span key={idx} className="rounded bg-[#F3F4F6] px-2 py-1 text-xs text-[#364153]">
                    {model}
                  </span>
                ))}
              </div>

              {/* Footer Row */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#6A7282]">Assigned to {clash.assignedTo}</span>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolveClash(clash.id)}
                    disabled={isClashResolved(clash.id)}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#009966] px-3 py-1.5 text-xs text-white hover:bg-emerald-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isClashResolved(clash.id) ? 'Resolved' : 'Resolve'}
                  </button>
                  <button
                    onClick={() => focusClash(clash)}
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
          </div>
        ))}
      </div>
    </div>
  );
}
