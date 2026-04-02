'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/config/api';
import Viewer2D from '../viewer/Viewer2D';
import Viewer3D from '../viewer/Viewer3D';
import ClashResolvePanel from './clashes/ClashResolvePanel';
import DetectionSettingsModal, {
  loadSettings,
  type DetectionSettings,
} from './clashes/DetectionSettingsModal';
import { useClashWorkflow } from './clashes/useClashWorkflow';
import UnsavedChangesDialog from '../../../components/ui/UnsavedChangesDialog';
import { useClashViewerStore } from '@/store/clashStore';
import {
  getRenderedClashStatus,
  iconColors,
  matchesResolutionFilter,
  severityConfig,
  statusConfig,
  toDetectionGroups,
  toListClash,
  type BackendClashResponse,
  type Clash,
  type ResolutionFilter,
} from '@/data/clashes';

interface ClashesTabProps {
  projectSlug: string;
}

type UnsavedClashPrompt =
  | { kind: 'focus'; clash: Clash }
  | { kind: 'resolve'; clash: Clash }
  | { kind: 'closeResolve' };

export default function ClashesTab({ projectSlug }: ClashesTabProps) {
  return <ClashesTabContent projectSlug={projectSlug} />;
}

function ClashesTabContent({ projectSlug }: ClashesTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningDetection, setIsRunningDetection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettings>(() => loadSettings());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [showStale, setShowStale] = useState(false);
  const [isDetectionView, setIsDetectionView] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'split'>('split');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [viewerHasCollision, setViewerHasCollision] = useState(false);
  const [viewerCollisionMessage, setViewerCollisionMessage] = useState<string | null>(null);
  const [unsavedPrompt, setUnsavedPrompt] = useState<UnsavedClashPrompt | null>(null);

  const {
    clashes,
    groups,
    selectedClash,
    resolvePanelClash,
    hydrate,
    focusClash,
    openResolvePanel,
    closeResolvePanel,
    updateClashNote,
    updateClashSeverity,
    markResolved,
    markWaived,
    assignClash,
  } = useClashWorkflow(projectSlug);

  const clashStore = useClashViewerStore();
  // Track which clash IDs đã load positions từ server — tránh infinite loop
  // (loadClashSceneFromServer thay đổi reference khi state thay đổi nên không được để trong deps)
  const serverLoadedRef = useRef<Set<string>>(new Set());

  const applyClashResponse = (data: BackendClashResponse) => {
    const listClashes = (data.clashes ?? []).map(toListClash);
    const groupedClashes = toDetectionGroups(data.groups);

    hydrate(listClashes, groupedClashes);
    setExpandedGroups(groupedClashes.length > 0 ? [groupedClashes[0].id] : []);
  };

  useEffect(() => {
    let isMounted = true;

    const loadClashes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/clashes?includeStale=true`));
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
  }, [projectSlug]);

  // Reset server-load cache khi project slug thay đổi
  useEffect(() => {
    serverLoadedRef.current = new Set();
  }, [projectSlug]);

  useEffect(() => {
    setSelectedObjectId(selectedClash?.objectA ?? null);
  }, [selectedClash]);

  useEffect(() => {
    if (!selectedClash) return;
    clashStore.ensureSceneForClash(selectedClash);
    // Chỉ load từ server 1 lần per clashId per session.
    // Không để clashStore trong deps — loadClashSceneFromServer thay đổi reference
    // mỗi khi state.scenesByClashId cập nhật → gây infinite loop → 429.
    if (!serverLoadedRef.current.has(selectedClash.id)) {
      serverLoadedRef.current.add(selectedClash.id);
      void clashStore.loadClashSceneFromServer(selectedClash.id, projectSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClash?.id, projectSlug]);

  useEffect(() => {
    if (!resolvePanelClash) return;
    clashStore.ensureSceneForClash(resolvePanelClash);
    if (!serverLoadedRef.current.has(resolvePanelClash.id)) {
      serverLoadedRef.current.add(resolvePanelClash.id);
      void clashStore.loadClashSceneFromServer(resolvePanelClash.id, projectSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvePanelClash?.id, projectSlug]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const clashId = resolvePanelClash?.id ?? selectedClash?.id;
      if (!clashId || !clashStore.isClashDirty(clashId)) return;

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [clashStore, resolvePanelClash?.id, selectedClash?.id]);

  const matchesSeverityFilter = (clash: Clash) => {
    if (severityFilter === 'all') return true;
    if (severityFilter === 'high') return clash.severity === 'critical' || clash.severity === 'high';
    if (severityFilter === 'medium') return clash.severity === 'medium';
    if (severityFilter === 'low') return clash.severity === 'low';
    return true;
  };

  const matchesSearch = (clash: Clash) =>
    clash.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    clash.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    clash.objectA.toLowerCase().includes(searchQuery.toLowerCase()) ||
    clash.objectB.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredClashes = useMemo(
    () =>
      clashes.filter(
        (clash) =>
          matchesSearch(clash) &&
          matchesSeverityFilter(clash) &&
          matchesResolutionFilter(clash, resolutionFilter) &&
          (assigneeFilter === 'all' || clash.assignedTo === assigneeFilter) &&
          (showStale ? clash.stale : !clash.stale)
      ),
    [clashes, resolutionFilter, searchQuery, severityFilter, assigneeFilter, showStale]
  );

  const staleCount = useMemo(() => clashes.filter((c) => c.stale).length, [clashes]);

  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              matchesSearch(item) &&
              matchesSeverityFilter(item) &&
              matchesResolutionFilter(item, resolutionFilter)
          ),
        }))
        .filter((group) => group.items.length > 0)
        .map((group) => ({ ...group, count: group.items.length })),
    [groups, resolutionFilter, searchQuery, severityFilter]
  );

  const totalClashes = clashes.length;
  const highSeverity = clashes.filter((clash) => clash.severity === 'critical' || clash.severity === 'high').length;
  const lowSeverity = clashes.filter((clash) => clash.severity === 'low').length;
  const inProgress = clashes.filter((clash) => !clash.resolved && getRenderedClashStatus(clash) === 'in-progress').length;
  const resolved = clashes.filter((clash) => clash.resolved).length;

  const detectionTotal = filteredGroups.reduce((accumulator, group) => accumulator + group.count, 0);
  const detectionNew = filteredGroups.reduce(
    (accumulator, group) => accumulator + group.items.filter((item) => !item.resolved).length,
    0
  );
  const detectionResolved = filteredGroups.reduce(
    (accumulator, group) => accumulator + group.items.filter((item) => item.resolved).length,
    0
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    );
  };

  const navigateToClashFocus = (clash: Clash) => {
    focusClash(clash.id);
    setSelectedObjectId(clash.objectA);
    setViewerHasCollision(false);
    setViewerCollisionMessage(null);
    setIsDetectionView(true);
    setViewMode('split');
  };

  const navigateToResolve = (clash: Clash) => {
    focusClash(clash.id);
    openResolvePanel(clash.id);
    setIsDetectionView(true);
    setViewMode('split');
  };

  const handleFocusClash = (clash: Clash) => {
    if (selectedClash?.id && selectedClash.id !== clash.id && clashStore.isClashDirty(selectedClash.id)) {
      setUnsavedPrompt({ kind: 'focus', clash });
      return;
    }

    navigateToClashFocus(clash);
  };

  const handleResolveRequest = (clash: Clash) => {
    if (selectedClash?.id && selectedClash.id !== clash.id && clashStore.isClashDirty(selectedClash.id)) {
      setUnsavedPrompt({ kind: 'resolve', clash });
      return;
    }

    navigateToResolve(clash);
  };

  const handleExportReport = () => {
    const reportPayload = {
      generatedAt: new Date().toISOString(),
      selectedClashId: selectedClash?.id ?? null,
      selectedObjectId,
      clashes: filteredClashes,
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clash-report.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBCF = async () => {
    try {
      const response = await fetch(
        apiUrl(`/projects/${encodeURIComponent(projectSlug)}/clashes/export/bcf?projectName=${encodeURIComponent(projectSlug)}`)
      );
      if (!response.ok) throw new Error(`BCF export failed (${response.status})`);
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectSlug}-clashes.bcf.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export BCF');
    }
  };

  const runDetection = async (overrideSettings?: DetectionSettings) => {
    try {
      setIsRunningDetection(true);
      setError(null);

      const settings = overrideSettings ?? detectionSettings;

      const response = await fetch(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/clash-detect`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearanceThreshold: settings.clearanceThreshold,
          rules: settings.rules.map(({ typeA, typeB, minClearance, severity }) => ({
            typeA, typeB, minClearance, severity,
          })),
          includeStale: true,
        }),
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

  const renderStatusBadge = (clash: Clash) => {
    const renderedStatus = getRenderedClashStatus(clash);
    return statusConfig[renderedStatus];
  };

  const unsavedDialog = (
    <UnsavedChangesDialog
      open={unsavedPrompt !== null}
      onOpenChange={(open: boolean) => {
        if (!open) setUnsavedPrompt(null);
      }}
      title="Unsaved position changes"
      description={
        unsavedPrompt?.kind === 'closeResolve'
          ? 'You have unsaved changes in the resolve panel. Save them, discard them, or keep editing.'
          : 'You have unsaved changes for the current clash. Save them, discard them, or stay on this clash.'
      }
      onSave={async () => {
        if (!unsavedPrompt) return;
        if (unsavedPrompt.kind === 'closeResolve') {
          if (resolvePanelClash) await clashStore.saveClashSceneToServer(resolvePanelClash.id, projectSlug);
          closeResolvePanel();
        } else {
          if (selectedClash) await clashStore.saveClashSceneToServer(selectedClash.id, projectSlug);
          if (unsavedPrompt.kind === 'focus') {
            navigateToClashFocus(unsavedPrompt.clash);
          } else {
            navigateToResolve(unsavedPrompt.clash);
          }
        }
        setUnsavedPrompt(null);
      }}
      onDiscard={() => {
        if (!unsavedPrompt) return;
        if (unsavedPrompt.kind === 'closeResolve') {
          if (resolvePanelClash) clashStore.discardClashScene(resolvePanelClash.id);
          closeResolvePanel();
        } else {
          if (selectedClash) clashStore.discardClashScene(selectedClash.id);
          if (unsavedPrompt.kind === 'focus') {
            navigateToClashFocus(unsavedPrompt.clash);
          } else {
            navigateToResolve(unsavedPrompt.clash);
          }
        }
        setUnsavedPrompt(null);
      }}
      saveLabel="Save positions"
      discardLabel="Discard"
      cancelLabel="Cancel"
    />
  );

  if (isDetectionView) {
    return (
      <>
        {unsavedDialog}
        <DetectionSettingsModal
          open={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          initialSettings={detectionSettings}
          onApply={(settings) => {
            setDetectionSettings(settings);
            void runDetection(settings);
          }}
        />
        <div className="relative bg-[#F9FAFB] px-6 py-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col rounded-[18px] border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#E5E7EB] bg-white px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => void runDetection()}
                disabled={isRunningDetection}
                className="inline-flex items-center gap-2 rounded bg-[#155DFC] px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {isRunningDetection ? 'Running...' : 'Run Detection'}
              </button>
              <button
                onClick={handleExportReport}
                className="inline-flex items-center gap-2 rounded border border-[#D1D5DC] bg-white px-3 py-2 text-sm text-[#364153] transition-colors hover:bg-gray-50"
              >
                Export Report
              </button>
                  <button
                onClick={() => setShowSettingsModal(true)}
                className="inline-flex items-center gap-1.5 rounded border border-[#D1D5DC] bg-white px-3 py-2 text-sm text-[#364153] transition-colors hover:bg-gray-50"
                title="Detection settings: clearance threshold và per-type rules"
              >
                <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
                {(detectionSettings.clearanceThreshold > 0 || detectionSettings.rules.length > 0) && (
                  <span className="rounded-full bg-[#155DFC] px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {detectionSettings.rules.length + (detectionSettings.clearanceThreshold > 0 ? 1 : 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => void handleExportBCF()}
                className="inline-flex items-center gap-2 rounded border border-[#D1D5DC] bg-white px-3 py-2 text-sm text-[#364153] transition-colors hover:bg-gray-50"
                title="Export BCF 2.1 — compatible with Navisworks, Revit, BIM Collab"
              >
                Export BCF
              </button>
              <div className="flex items-center rounded bg-[#F3F4F6] p-0.5">
                {(['2d', '3d', 'split'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'rounded px-3 py-1 text-xs transition-colors',
                      viewMode === mode ? 'bg-white text-[#101828] shadow-sm' : 'text-[#4A5565]'
                    )}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-[#4A5565]">
                Total: <span className="font-medium text-[#101828]">{detectionTotal}</span>
              </span>
              <span className="text-[#4A5565]">
                Unresolved: <span className="font-medium text-[#DC2626]">{detectionNew}</span>
              </span>
              <span className="text-[#4A5565]">
                Resolved: <span className="font-medium text-[#10B981]">{detectionResolved}</span>
              </span>
            </div>
          </div>

          <div className="flex items-stretch">
            <aside className="w-[300px] flex-shrink-0 border-r border-[#E5E7EB] bg-white">
              <div className="border-b border-[#E5E7EB] p-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search clashes..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2">
                {filteredGroups.map((group) => (
                  <div key={group.id} className="mb-1">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="flex w-full items-center justify-between rounded px-2 py-2 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className={cn('h-4 w-4 text-[#4A5565] transition-transform', expandedGroups.includes(group.id) && 'rotate-90')}
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

                    {expandedGroups.includes(group.id) && (
                      <div className="ml-4 border-l border-[#E5E7EB]">
                        {group.items.map((item) => {
                          const badge = renderStatusBadge(item);
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleFocusClash(item)}
                              className={cn(
                                'flex w-full flex-col border-l-2 -ml-px px-3 py-2 text-left',
                                selectedClash?.id === item.id ? 'border-l-[#155DFC] bg-[#F0F9FF]' : 'border-l-transparent hover:bg-gray-50'
                              )}
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <span className={cn('h-2 w-2 rounded-full', item.resolved ? 'bg-[#10B981]' : 'bg-[#DC2626]')} />
                                <span className="text-sm font-medium text-[#101828]">{item.title}</span>
                              </div>
                              <div className="ml-4 flex items-center gap-2">
                                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.bg, badge.color)}>
                                  {badge.label}
                                </span>
                                <span className="text-[10px] text-[#4A5565]">{item.type}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>

          <div className="flex min-h-0 flex-1">
              {(viewMode === '2d' || viewMode === 'split') && (
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-col bg-[#F9FAFB]',
                  viewMode === 'split' ? 'basis-1/2 border-r border-[#E5E7EB]' : 'flex-1'
                )}
              >
                <div className="flex h-12 items-center border-b border-[#E5E7EB] bg-white px-4 text-sm text-[#4A5565]">
                    2D interaction: wheel zoom, middle/right drag pan, click object select.
                  </div>
                <div className="min-h-0 flex-1 p-5 md:p-6">
                  <div className="relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl border border-[#D1D5DC] bg-white">
                      <Viewer2D
                        clash={selectedClash}
                        selectedObjectId={selectedObjectId}
                        onSelectObject={setSelectedObjectId}
                        onFocusClash={(clash) => handleFocusClash(clash)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {(viewMode === '3d' || viewMode === 'split') && (
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-col bg-[#1a1a2e]',
                  viewMode === 'split' ? 'basis-1/2' : 'flex-1'
                )}
              >
                <div className="flex h-12 items-center border-b border-white/10 bg-[#364153] px-4 text-sm text-slate-200">
                    3D interaction: left drag orbit, middle/right drag pan, wheel zoom, double-click focus.
                  </div>
                <div className="min-h-0 flex-1 bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] p-5 md:p-6">
                  <div className="relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl border border-[#4A5565] bg-[#111827]">
                      <Viewer3D
                        clash={selectedClash}
                        selectedObjectId={selectedObjectId}
                        onSelectObject={setSelectedObjectId}
                        onFocusClash={(clash) => handleFocusClash(clash)}
                        onCollisionChange={(isColliding, message) => {
                          setViewerHasCollision(isColliding);
                          setViewerCollisionMessage(message);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedClash && (
            <div className="border-t border-[#E5E7EB] bg-white px-6 py-4">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-medium text-[#101828]">{selectedClash.title}</h3>
                  <div className="mb-4 flex items-center gap-2">
                    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', renderStatusBadge(selectedClash).bg, renderStatusBadge(selectedClash).color)}>
                      {renderStatusBadge(selectedClash).label}
                    </span>
                    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', severityConfig[selectedClash.severity].bg, severityConfig[selectedClash.severity].color)}>
                      {severityConfig[selectedClash.severity].label}
                    </span>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-[#6A7282]">Object A</p>
                      <p className="text-sm font-medium text-[#101828]">{selectedClash.objectA}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6A7282]">Object B</p>
                      <p className="text-sm font-medium text-[#101828]">{selectedClash.objectB}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!selectedClash) return;
                      await clashStore.saveClashSceneToServer(selectedClash.id, projectSlug);
                    }}
                    disabled={!selectedClash || !clashStore.isClashDirty(selectedClash.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm transition-colors',
                      !selectedClash || !clashStore.isClashDirty(selectedClash.id)
                        ? 'cursor-not-allowed border border-[#D1D5DC] bg-[#F3F4F6] text-[#9CA3AF]'
                        : 'bg-[#155DFC] text-white hover:bg-blue-700'
                    )}
                  >
                    Save Positions
                  </button>
                  <button
                    onClick={() => handleResolveRequest(selectedClash)}
                    disabled={selectedClash.resolved || viewerHasCollision}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm transition-colors',
                      selectedClash.resolved || viewerHasCollision
                        ? 'cursor-not-allowed bg-[#D1FAE5] text-[#047857]'
                        : 'bg-[#009966] text-white hover:bg-emerald-600'
                    )}
                  >
                    {selectedClash.resolved ? 'Resolved' : viewerHasCollision ? 'Blocked by Collision' : 'Resolve'}
                  </button>
                </div>
              </div>
              {viewerCollisionMessage && (
                <div className="mt-4 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
                  {viewerCollisionMessage}
                </div>
              )}
            </div>
          )}

          <ClashResolvePanel
            clash={resolvePanelClash}
            isOpen={Boolean(resolvePanelClash)}
            onClose={() => {
              if (resolvePanelClash && clashStore.isClashDirty(resolvePanelClash.id)) {
                setUnsavedPrompt({ kind: 'closeResolve' });
                return;
              }
              closeResolvePanel();
            }}
            onSavePositions={async () => {
              if (!resolvePanelClash) return;
              await clashStore.saveClashSceneToServer(resolvePanelClash.id, projectSlug);
            }}
            hasUnsavedPositions={resolvePanelClash ? clashStore.isClashDirty(resolvePanelClash.id) : false}
            resolveDisabled={viewerHasCollision}
            resolveError={viewerCollisionMessage}
            onWaive={async (payload) => {
              if (!resolvePanelClash) return;
              try {
                await markWaived(resolvePanelClash.id, payload);
              } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'Failed to waive clash');
              }
            }}
            onAssign={async (assignedTo, dueDate) => {
              if (!resolvePanelClash) return;
              try {
                await assignClash(resolvePanelClash.id, assignedTo, dueDate);
              } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'Failed to assign clash');
              }
            }}
            onSeverityChange={async (severity) => {
              if (!resolvePanelClash) return;
              try {
                await updateClashSeverity(resolvePanelClash.id, severity);
              } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'Failed to update clash severity');
              }
            }}
            onResolve={async (payload) => {
              if (!resolvePanelClash) return;
              if (viewerHasCollision) {
                setError('Cannot resolve clash while objects are still intersecting');
                return;
              }
              if (clashStore.isClashDirty(resolvePanelClash.id)) {
                setError('You have unsaved position changes. Save positions before resolving.');
                return;
              }
              try {
                const clashId = resolvePanelClash.id;
                await markResolved(clashId, payload);
                clashStore.markClashResolved(clashId);
              } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'Failed to resolve clash');
              }
            }}
          />
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      {unsavedDialog}
      <DetectionSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialSettings={detectionSettings}
        onApply={(settings) => {
          setDetectionSettings(settings);
          void runDetection(settings);
        }}
      />
    <div className="space-y-6 px-6 py-6 lg:px-[80px] xl:px-[160px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[24px] font-normal text-[#101828]">Clash Detection</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleExportBCF()}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#D1D5DC] bg-white px-4 py-2 text-sm font-normal text-[#364153] transition-colors hover:bg-gray-50"
            title="Export BCF 2.1"
          >
            Export BCF
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#D1D5DC] bg-white px-4 py-2 text-sm font-normal text-[#364153] transition-colors hover:bg-gray-50"
            title="Detection settings"
          >
            <svg className="h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
            {(detectionSettings.clearanceThreshold > 0 || detectionSettings.rules.length > 0) && (
              <span className="rounded-full bg-[#155DFC] px-1.5 py-0.5 text-[10px] font-medium text-white">
                {detectionSettings.rules.length + (detectionSettings.clearanceThreshold > 0 ? 1 : 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => void runDetection()}
            disabled={isRunningDetection}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {isRunningDetection ? 'Running...' : 'Run Detection'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</div>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Total Clashes</span>
          <span className="text-2xl font-normal text-[#101828]">{totalClashes}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">High Severity</span>
          <span className="text-2xl font-normal text-[#EC003F]">{highSeverity}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Low Severity</span>
          <span className="text-2xl font-normal text-[#059669]">{lowSeverity}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">In Progress</span>
          <span className="text-2xl font-normal text-[#4F39F6]">{inProgress}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Resolved</span>
          <span className="text-2xl font-normal text-[#009966]">{resolved}</span>
        </div>
        <button
          onClick={() => setShowStale((v) => !v)}
          className={cn(
            'flex flex-col gap-1 rounded-[10px] border px-4 py-4 text-left transition-colors',
            staleCount > 0
              ? showStale
                ? 'border-[#CBD5E1] bg-[#F8FAFC]'
                : 'border-[#E5E7EB] bg-white hover:bg-[#F8FAFC]'
              : 'border-[#E5E7EB] bg-white'
          )}
          title="Click để xem các clash không còn được detect"
        >
          <span className="text-xs text-[#4A5565]">Stale</span>
          <span className={cn('text-2xl font-normal', staleCount > 0 ? 'text-[#64748B]' : 'text-[#CBD5E1]')}>
            {staleCount}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-[448px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search clashes..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2 pl-10 pr-4 text-sm text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'high', 'medium', 'low'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSeverityFilter(filter)}
              className={cn(
                'rounded-[10px] px-3 py-2 text-xs font-normal transition-colors',
                severityFilter === filter ? 'bg-[#F0F9FF] text-[#0069A8]' : 'border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
              )}
            >
              {filter === 'all' ? 'All Severities' : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'resolved', 'unresolved'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setResolutionFilter(filter)}
              className={cn(
                'rounded-[10px] px-3 py-2 text-xs font-normal transition-colors',
                resolutionFilter === filter ? 'bg-[#ECFDF3] text-[#047857]' : 'border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
              )}
            >
              {filter === 'all' ? 'All Statuses' : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Assignee filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6A7282]">Assigned:</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#364153] outline-none transition-colors focus:border-blue-500"
          >
            <option value="all">All</option>
            {Array.from(new Set(clashes.map((c) => c.assignedTo).filter(Boolean))).map((person) => (
              <option key={person} value={person}>{person}</option>
            ))}
          </select>
        </div>

        {/* Stale toggle */}
        <button
          onClick={() => setShowStale((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-normal transition-colors',
            showStale
              ? 'bg-[#F1F5F9] text-[#475569] ring-1 ring-[#CBD5E1]'
              : 'border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
          )}
          title="Stale clashes: previously detected but no longer present in the latest scan"
        >
          <span className={cn('h-2 w-2 rounded-full', showStale ? 'bg-[#94A3B8]' : 'bg-[#CBD5E1]')} />
          Stale
          {staleCount > 0 && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', showStale ? 'bg-[#CBD5E1] text-[#475569]' : 'bg-[#F1F5F9] text-[#64748B]')}>
              {staleCount}
            </span>
          )}
        </button>
      </div>

      <div className="rounded-[10px] border border-[#E5E7EB] bg-white">
        {isLoading && <div className="p-6 text-sm text-[#6A7282]">Loading clashes...</div>}
        {!isLoading && filteredClashes.length === 0 && <div className="p-6 text-sm text-[#6A7282]">No clashes found.</div>}
        {filteredClashes.map((clash, index) => {
          const renderedStatus = renderStatusBadge(clash);

          return (
              <button
              type="button"
              key={clash.id}
              onClick={() => !clash.stale && handleFocusClash(clash)}
              className={cn(
                'flex w-full gap-4 p-6 text-left transition-colors',
                clash.stale ? 'cursor-default opacity-60' : 'hover:bg-[#F9FAFB]',
                index !== filteredClashes.length - 1 && 'border-b border-[#E5E7EB]'
              )}
            >
              <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]',
                clash.stale ? 'bg-[#F1F5F9] text-[#94A3B8]' : clash.resolved ? 'bg-[#D1FAE5] text-[#059669]' : iconColors[getRenderedClashStatus(clash)]
              )}>
                {clash.stale ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-[#101828]">{clash.id}</span>
                  {clash.stale ? (
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B] ring-1 ring-[#CBD5E1]">
                      stale
                    </span>
                  ) : (
                    <span className={cn('rounded px-2 py-0.5 text-xs', renderedStatus.bg, renderedStatus.color)}>
                      {renderedStatus.label}
                    </span>
                  )}
                  {clash.waived && !clash.stale && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">waived</span>
                  )}
                  <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#364153]">{clash.type}</span>
                  <span className={cn('rounded px-2 py-0.5 text-xs', severityConfig[clash.severity].bg, severityConfig[clash.severity].color)}>
                    {severityConfig[clash.severity].label}
                  </span>
                </div>

                <h3 className="text-sm font-normal text-[#101828]">{clash.title}</h3>
                <p className="text-sm text-[#4A5565]">{clash.location}</p>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6A7282]">Models:</span>
                  {clash.models.map((model) => (
                    <span key={model} className="rounded bg-[#F3F4F6] px-2 py-1 text-xs text-[#364153]">
                      {model}
                    </span>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-[#6A7282]">Assigned to {clash.assignedTo}</span>
                  <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleResolveRequest(clash)}
                      disabled={clash.resolved}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs transition-colors',
                        clash.resolved
                          ? 'cursor-not-allowed bg-[#D1FAE5] text-[#047857]'
                          : 'bg-[#009966] text-white hover:bg-emerald-600'
                      )}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {clash.resolved ? 'Resolved' : 'Resolve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFocusClash(clash)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#F3F4F6] px-3 py-1.5 text-xs text-[#364153] transition-colors hover:bg-gray-200"
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
            </button>
          );
        })}
      </div>
    </div>
    </>
  );
}

