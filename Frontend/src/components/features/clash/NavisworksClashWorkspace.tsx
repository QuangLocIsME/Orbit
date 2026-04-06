'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileText,
  FlaskConical,
  FolderTree,
  ListChecks,
  Search,
  ShieldCheck,
  ShieldAlert,
  Eye,
  PanelLeft,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/config/api';
import { apiFetch } from '@/lib/api-client';
import Viewer2D from '../clash/viewer/Viewer2D';
import Viewer3D from '../clash/viewer/Viewer3D';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildOverviewSceneFromFederated } from './lib/clashScene';
import { toast } from 'sonner';
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
import {
  resultToViewerClash,
  useNavisworksClashResults,
  useNavisworksWorkspace,
  workspaceKeys,
  type ClashResult,
  type SelectionSet,
  type ClashTest,
} from './hooks/useNavisworksWorkspace';

interface IfcDocument {
  publicId: string;
  originalName: string;
  folderPath: string;
  size: number;
  createdAt: string;
}
import { memberLabel, useProjectMembers } from './hooks/useProjectMembers';

type SidebarTab = 'select' | 'tests' | 'results' | 'report';
type ClashViewMode = 'landing' | 'detect';

/** Soft clash gap / clearance — meters (common BIM values). */
const CLASH_SOFT_THRESHOLD_PRESETS_M = ['0', '0.01', '0.025', '0.05', '0.1', '0.25'] as const;
/** Near-duplicate AABB match — meters. */
const CLASH_DUPLICATE_TOLERANCE_PRESETS_M = ['0.0001', '0.001', '0.005', '0.01'] as const;

const INSPECTOR_NOTE_MAX_LEN = 8000;

/** Max bbox elements in 2D/3D overview (xeokit performance). */
const CLASH_OVERVIEW_BBOX_CAP = 800;

type ClashTestFormErrors = Partial<
  Record<'name' | 'setAId' | 'setBId' | 'softThreshold' | 'duplicateTolerance', string>
>;

type SelectionSetFormErrors = Partial<Record<'name' | 'scope', string>>;

type ActionBanner = { variant: 'success' | 'error' | 'warning'; message: string };

type LandingPaginationItem = number | 'left-ellipsis' | 'right-ellipsis';

const buildLandingPaginationItems = (
  currentPage: number,
  totalPages: number,
): LandingPaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: LandingPaginationItem[] = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) items.push('left-ellipsis');
  for (let page = left; page <= right; page += 1) {
    items.push(page);
  }
  if (right < totalPages - 1) items.push('right-ellipsis');
  items.push(totalPages);

  return items;
};

const landingPaginationNavLinkClass = (disabled: boolean) =>
  cn(
    'size-8 border p-0 sm:min-w-8',
    disabled
      ? 'pointer-events-none cursor-not-allowed border-[#E5E7EB] text-[#B6BDC8] opacity-100'
      : 'border-[#D1D5DC] text-[#6A7282] hover:bg-[#F9FAFB]',
  );

const parseManualIdList = (raw: string) =>
  raw
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const resolveSelectionSetObjectIds = (
  selectionSet: SelectionSet | null | undefined,
  objects: Array<{
    id: string;
    type: string;
    category: string;
    sourceModelId: string;
  }>
) => {
  if (!selectionSet) return [];
  const filteredIds = objects
    .filter((object) => {
      const { modelIds, types, categories } = selectionSet.filters;
      if (modelIds.length > 0 && !modelIds.includes(object.sourceModelId)) return false;
      if (types.length > 0 && !types.includes(object.type)) return false;
      if (categories.length > 0 && !categories.includes(object.category)) return false;
      return true;
    })
    .map((object) => object.id);
  const included = new Set([...filteredIds, ...selectionSet.manualIncludeIds]);
  selectionSet.manualExcludeIds.forEach((id) => included.delete(id));
  return Array.from(included);
};

function SelectionSetChipPicker({
  options,
  selected,
  onToggle,
  emptyMessage,
  'aria-invalid': ariaInvalid,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyMessage?: string;
  'aria-invalid'?: boolean;
}) {
  if (options.length === 0) {
    return <p className="mt-1 text-xs text-[#6A7282]">{emptyMessage ?? 'No options available.'}</p>;
  }
  return (
    <div
      className={cn(
        'mt-1 max-h-[7.5rem] overflow-y-auto rounded-lg border p-2',
        ariaInvalid ? 'border-red-400 bg-red-50/40' : 'border-[#D1D5DC] bg-[#FAFAFA]'
      )}
      role="group"
    >
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <Button
              key={opt.value}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggle(opt.value)}
              className={cn(
                'h-auto max-w-full truncate rounded-full px-2.5 py-1 text-left text-[11px] font-normal',
                on ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]' : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
              )}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ManualIdSuggestions({
  label,
  ids,
  onPick,
}: {
  label: string;
  ids: string[];
  onPick: (id: string) => void;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6A7282]">{label}</p>
      <div className="mt-1 flex max-h-[4.5rem] flex-wrap gap-1 overflow-y-auto">
        {ids.map((id) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPick(id)}
            className="h-auto max-w-[min(100%,12rem)] truncate px-1.5 py-0.5 font-mono text-[10px] font-normal"
            title={id}
          >
            {id}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SidebarActionBanner({ banner, className }: { banner: ActionBanner | null; className?: string }) {
  if (!banner) return null;
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  } as const;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('mb-2 rounded-lg border px-3 py-2 text-sm leading-snug', styles[banner.variant], className)}
    >
      {banner.message}
    </div>
  );
}

interface NavisworksClashWorkspaceProps {
  projectSlug: string;
}

const triggerDownload = async (url: string, filename?: string) => {
  const response = await apiFetch(url);
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || 'download';
  link.click();
  URL.revokeObjectURL(objectUrl);
};

export default function NavisworksClashWorkspace({ projectSlug }: NavisworksClashWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarPanelId = useId();
  const objectIdDatalistId = useId();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedClashId, setSelectedClashId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [planeView, setPlaneView] = useState<'2d' | '3d'>('3d');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('select');
  const [viewMode, setViewMode] = useState<ClashViewMode>('landing');
  const [landingSearch, setLandingSearch] = useState('');
  const [landingSeverityFilter, setLandingSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [landingPage, setLandingPage] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'reviewed' | 'resolved'>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [hideUnrelatedToActiveTest, setHideUnrelatedToActiveTest] = useState(false);
  const [search, setSearch] = useState('');
  const [hiddenModelIds, setHiddenModelIds] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [selectionSetDraft, setSelectionSetDraft] = useState({
    name: '',
    description: '',
    modelIds: [] as string[],
    categories: [] as string[],
    types: [] as string[],
    manualIncludeIds: '',
    manualExcludeIds: '',
  });
  const [selectionSetFormErrors, setSelectionSetFormErrors] = useState<SelectionSetFormErrors>({});
  const [clashTestDraft, setClashTestDraft] = useState({
    name: '',
    description: '',
    setAId: '',
    setBId: '',
    softThreshold: '0.05',
    duplicateTolerance: '0.001',
  });
  const [noteDraft, setNoteDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('Unassigned');
  const [error, setError] = useState<string | null>(null);
  const [runTestDialogOpen, setRunTestDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [pendingDeleteTestId, setPendingDeleteTestId] = useState<string | null>(null);
  const [pendingDeleteSetId, setPendingDeleteSetId] = useState<string | null>(null);
  const [clashTestFormErrors, setClashTestFormErrors] = useState<ClashTestFormErrors>({});
  const [clashTestActionBanner, setClashTestActionBanner] = useState<ActionBanner | null>(null);
  const [selectionSetActionBanner, setSelectionSetActionBanner] = useState<ActionBanner | null>(null);
  const [exportActionBanner, setExportActionBanner] = useState<ActionBanner | null>(null);
  const [inspectorActionBanner, setInspectorActionBanner] = useState<ActionBanner | null>(null);
  const clashTestBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionSetBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectorBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTimedBanner = (
    setBanner: (value: ActionBanner | null) => void,
    timerRef: { current: ReturnType<typeof setTimeout> | null },
    banner: ActionBanner,
    ms = 8000
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBanner(banner);
    timerRef.current = setTimeout(() => {
      setBanner(null);
      timerRef.current = null;
    }, ms);
  };

  const clearInspectorActionBanner = useCallback(() => {
    if (inspectorBannerTimer.current) {
      clearTimeout(inspectorBannerTimer.current);
      inspectorBannerTimer.current = null;
    }
    setInspectorActionBanner(null);
  }, []);

  useEffect(
    () => () => {
      [clashTestBannerTimer, selectionSetBannerTimer, exportBannerTimer, inspectorBannerTimer].forEach((ref) => {
        if (ref.current) clearTimeout(ref.current);
      });
    },
    []
  );

  /** When false, main viewer shows federated overview only. When true, show clash geometry for the selected test (first last-run result if any). Set true when picking a test, after Run, or when choosing a row in Results. */
  const [showClashInMainViewer, setShowClashInMainViewer] = useState(false);

  const { data: projectMembers = [], isFetching: projectMembersLoading } = useProjectMembers(projectSlug);

  const {
    workspaceQuery,
    importModels,
    importFromDocuments,
    saveSelectionSet,
    deleteSelectionSet,
    saveClashTest,
    deleteClashTest,
    runClashTest,
    updateClashStatus,
    applyObjectActions,
  } = useNavisworksWorkspace(projectSlug);

  const ifcDocumentsQuery = useQuery<IfcDocument[]>({
    queryKey: workspaceKeys.ifcDocuments(projectSlug),
    queryFn: async () => {
      const res = await apiFetch(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/documents`));
      const data = await res.json() as { documents: IfcDocument[] };
      return data.documents ?? [];
    },
    enabled: importModalOpen,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const workspace = workspaceQuery.data;
  const models = workspace?.federatedModel.models ?? [];
  const allObjects = workspace?.federatedModel.objects ?? [];
  const allCategories = workspace?.federatedModel.categories ?? [];
  const persistedHiddenObjects = useMemo(
    () => allObjects.filter((object) => object.hidden),
    [allObjects]
  );
  const allTypes = useMemo(
    () => Array.from(new Set(allObjects.map((object) => object.type))).sort(),
    [allObjects]
  );
  const objectsInSelectionModelScope = useMemo(() => {
    if (selectionSetDraft.modelIds.length === 0) return allObjects;
    const modelScope = new Set(selectionSetDraft.modelIds);
    return allObjects.filter((object) => modelScope.has(object.sourceModelId));
  }, [allObjects, selectionSetDraft.modelIds]);
  const scopedCategories = useMemo(() => {
    const next = new Set(objectsInSelectionModelScope.map((object) => object.category));
    selectionSetDraft.categories.forEach((category) => next.add(category));
    return Array.from(next).sort();
  }, [objectsInSelectionModelScope, selectionSetDraft.categories]);
  const scopedTypes = useMemo(() => {
    const activeCategories = new Set(selectionSetDraft.categories);
    const sourceObjects =
      activeCategories.size > 0
        ? objectsInSelectionModelScope.filter((object) => activeCategories.has(object.category))
        : objectsInSelectionModelScope;
    const next = new Set(sourceObjects.map((object) => object.type));
    selectionSetDraft.types.forEach((type) => next.add(type));
    return Array.from(next).sort();
  }, [objectsInSelectionModelScope, selectionSetDraft.categories, selectionSetDraft.types]);
  const suggestedManualObjectIds = useMemo(() => allObjects.slice(0, 24).map((object) => object.id), [allObjects]);
  const objectIdDatalistOptions = useMemo(() => allObjects.slice(0, 200).map((object) => object.id), [allObjects]);
  const objectMeshPositions = useMemo(
    () =>
      allObjects.reduce<Record<string, number[]>>((acc, object) => {
        if (object.clashMesh?.positions?.length) {
          acc[object.id] = object.clashMesh.positions;
        }
        return acc;
      }, {}),
    [allObjects]
  );

  useEffect(() => {
    if (!selectedTestId && workspace?.clashTests?.length) {
      setSelectedTestId(workspace.clashTests[0].id);
    }
  }, [selectedTestId, workspace?.clashTests]);

  const resultsQuery = useNavisworksClashResults(projectSlug, selectedTestId);
  const runPayload = resultsQuery.data;
  const selectedTest = workspace?.clashTests.find((test) => test.id === selectedTestId) ?? null;
  const results = runPayload?.results ?? [];
  const selectionSetById = useMemo(
    () => new Map((workspace?.selectionSets ?? []).map((set) => [set.id, set])),
    [workspace?.selectionSets]
  );

  const activeTestScopeObjectIds = useMemo(() => {
    if (!selectedTest?.setAId || !selectedTest?.setBId) return [];
    const setA = selectionSetById.get(selectedTest.setAId);
    const setB = selectionSetById.get(selectedTest.setBId);
    return Array.from(new Set([
      ...resolveSelectionSetObjectIds(setA, allObjects),
      ...resolveSelectionSetObjectIds(setB, allObjects),
    ]));
  }, [allObjects, selectedTest?.setAId, selectedTest?.setBId, selectionSetById]);
  const shouldHighlightActiveScope = Boolean(runPayload?.run && activeTestScopeObjectIds.length > 0);

  useEffect(() => {
    if (!showClashInMainViewer) return;
    if (!selectedClashId && results.length > 0) {
      setSelectedClashId(results[0].clashId);
      return;
    }
    if (selectedClashId && !results.some((result) => result.clashId === selectedClashId)) {
      setSelectedClashId(results[0]?.clashId ?? null);
    }
  }, [results, selectedClashId, showClashInMainViewer]);

  const filteredResults = useMemo(() => results.filter((result) => {
    if (statusFilter !== 'all' && result.status !== statusFilter) return false;
    if (search.trim()) {
      const haystack = `${result.title} ${result.objectA} ${result.objectB} ${result.objectAModel} ${result.objectBModel}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    if (hiddenModelIds.includes(result.objectAModel) && hiddenModelIds.includes(result.objectBModel)) return false;
    return true;
  }), [hiddenModelIds, results, search, statusFilter]);

  const landingStats = useMemo(() => {
    if (runPayload?.run?.summary) {
      return {
        total: runPayload.run.summary.total,
        high: runPayload.run.summary.hard,
        inProgress: runPayload.run.summary.reviewed,
        resolved: runPayload.run.summary.resolved,
      };
    }
    const total = results.length;
    const high = results.filter((result) => result.type === 'HARD').length;
    const low = results.filter((result) => result.type === 'SOFT').length;
    const inProgress = results.filter((result) => result.status === 'reviewed').length;
    const resolved = results.filter((result) => result.status === 'resolved').length;
    return { total, high, low, inProgress, resolved };
  }, [results, runPayload?.run?.summary]);

  const landingStatsWithLow = useMemo(() => ({
    total: landingStats.total,
    high: landingStats.high,
    medium: results.filter((result) => result.type === 'DUPLICATE').length,
    low: results.filter((result) => result.type === 'SOFT').length,
    inProgress: landingStats.inProgress,
    resolved: landingStats.resolved,
  }), [landingStats, results]);

  const landingResults = useMemo(() => {
    const query = landingSearch.trim().toLowerCase();
    return results.filter((result) => {
      const severity = result.type === 'HARD' ? 'high' : result.type === 'DUPLICATE' ? 'medium' : 'low';
      if (landingSeverityFilter !== 'all' && severity !== landingSeverityFilter) return false;
      if (!query) return true;
      const haystack = `${result.title} ${result.objectA} ${result.objectB} ${result.objectAModel} ${result.objectBModel}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [landingSearch, landingSeverityFilter, results]);

  const landingPageSize = 10;
  const landingTotalPages = Math.max(1, Math.ceil(landingResults.length / landingPageSize));
  const paginatedLandingResults = useMemo(() => {
    const safePage = Math.min(landingPage, landingTotalPages);
    const start = (safePage - 1) * landingPageSize;
    return landingResults.slice(start, start + landingPageSize);
  }, [landingPage, landingResults, landingTotalPages]);

  useEffect(() => {
    setLandingPage(1);
  }, [landingSearch, landingSeverityFilter, selectedTestId]);

  useEffect(() => {
    if (landingPage > landingTotalPages) {
      setLandingPage(landingTotalPages);
    }
  }, [landingPage, landingTotalPages]);

  const selectedResult = filteredResults.find((result) => result.clashId === selectedClashId)
    ?? results.find((result) => result.clashId === selectedClashId)
    ?? null;
  const showScopeDrivenOverview = shouldHighlightActiveScope && showClashInMainViewer;
  const viewerClash =
    showClashInMainViewer && selectedResult ? resultToViewerClash(selectedResult) : null;

  const federatedOverviewScene = useMemo(
    () =>
      buildOverviewSceneFromFederated(allObjects, {
        hiddenModelIds,
        hiddenCategories,
        maxObjects: Math.min(CLASH_OVERVIEW_BBOX_CAP, allObjects.length),
      }),
    [allObjects, hiddenCategories, hiddenModelIds]
  );

  const overviewSceneForViewer =
    !viewerClash && models.length > 0 ? federatedOverviewScene : undefined;

  /**
   * Triangle soup for xeokit: clash detail = A/B only; overview = only objects in the capped
   * federated scene (same ids as bbox overview) so real mesh returns without uploading every element.
   */
  const objectMeshPositionsForViewer = useMemo(() => {
    if (viewerClash) {
      const next: Record<string, number[]> = {};
      const a = viewerClash.objectA;
      const b = viewerClash.objectB;
      const pa = objectMeshPositions[a];
      const pb = objectMeshPositions[b];
      if (pa?.length) next[a] = pa;
      if (pb?.length) next[b] = pb;
      return next;
    }
    const next: Record<string, number[]> = {};
    for (const sceneObj of federatedOverviewScene) {
      const p = objectMeshPositions[sceneObj.id];
      if (p?.length) next[sceneObj.id] = p;
    }
    return next;
  }, [federatedOverviewScene, objectMeshPositions, viewerClash]);

  /** Midpoint of A/B IFC bbox centers — used when clash API lacks objectABBox (mock scene has no worldPosition). */
  const clashMeshOriginWorld = useMemo((): [number, number, number] | null => {
    if (!viewerClash) return null;
    const a = allObjects.find((o) => o.id === viewerClash.objectA);
    const b = allObjects.find((o) => o.id === viewerClash.objectB);
    if (!a?.boundingBox || !b?.boundingBox) return null;
    const ca: [number, number, number] = [
      (a.boundingBox.min[0] + a.boundingBox.max[0]) / 2,
      (a.boundingBox.min[1] + a.boundingBox.max[1]) / 2,
      (a.boundingBox.min[2] + a.boundingBox.max[2]) / 2,
    ];
    const cb: [number, number, number] = [
      (b.boundingBox.min[0] + b.boundingBox.max[0]) / 2,
      (b.boundingBox.min[1] + b.boundingBox.max[1]) / 2,
      (b.boundingBox.min[2] + b.boundingBox.max[2]) / 2,
    ];
    return [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2];
  }, [allObjects, viewerClash]);

  const zeroClashesAfterRun = Boolean(runPayload?.run && runPayload.run.summary.total === 0);

  const normalizeAssigneeForDisplay = useCallback(
    (rawAssignee?: string | null) => {
      const value = (rawAssignee || '').trim();
      if (!value || value === 'Unassigned') return 'Unassigned';
      const matchedMember = projectMembers.find((member) => member.userId === value);
      return matchedMember ? memberLabel(matchedMember) : value;
    },
    [projectMembers]
  );

  useEffect(() => {
    if (!selectedResult) return;
    clearInspectorActionBanner();
    setSelectedObjectId(selectedResult.objectA);
    setNoteDraft(selectedResult.note || '');
    setAssigneeDraft(normalizeAssigneeForDisplay(selectedResult.assignee));
  }, [clearInspectorActionBanner, normalizeAssigneeForDisplay, selectedResult?.assignee, selectedResult?.clashId]);

  useEffect(() => {
    if (!selectedResult) clearInspectorActionBanner();
  }, [clearInspectorActionBanner, selectedResult]);

  const hiddenObjectIds = useMemo(() => {
    if (!selectedResult) return [];
    const next: string[] = [];
    const aObj = allObjects.find((o) => o.id === selectedResult.objectA);
    const bObj = allObjects.find((o) => o.id === selectedResult.objectB);
    const aByFilter =
      hiddenModelIds.includes(selectedResult.objectAModel) ||
      hiddenCategories.includes(selectedResult.objectAType.replace(/^Ifc/, ''));
    const bByFilter =
      hiddenModelIds.includes(selectedResult.objectBModel) ||
      hiddenCategories.includes(selectedResult.objectBType.replace(/^Ifc/, ''));
    if (aByFilter || aObj?.hidden) next.push(selectedResult.objectA);
    if (bByFilter || bObj?.hidden) next.push(selectedResult.objectB);
    return next;
  }, [allObjects, hiddenCategories, hiddenModelIds, selectedResult]);

  const viewerHiddenObjectIds = useMemo(() => {
    const merged = new Set(hiddenObjectIds);
    const scope = new Set(activeTestScopeObjectIds);
    // In overview mode only: force-show scope objects and optionally hide unrelated.
    // In clash detail mode (viewerClash set) the user may explicitly hide A/B, so we respect that.
    if (shouldHighlightActiveScope && !viewerClash) {
      scope.forEach((id) => merged.delete(id));
    }
    if (hideUnrelatedToActiveTest && shouldHighlightActiveScope && !viewerClash) {
      allObjects.forEach((object) => {
        if (!scope.has(object.id)) merged.add(object.id);
      });
    }
    return Array.from(merged);
  }, [
    activeTestScopeObjectIds,
    allObjects,
    hiddenObjectIds,
    hideUnrelatedToActiveTest,
    shouldHighlightActiveScope,
    viewerClash,
  ]);

  const memberAssigneeLabels = useMemo(
    () => projectMembers.map((member) => memberLabel(member)),
    [projectMembers]
  );
  const assigneeKnownOption =
    assigneeDraft === 'Unassigned' || memberAssigneeLabels.includes(assigneeDraft);

  const toggleArrayValue = (values: string[], nextValue: string) =>
    values.includes(nextValue) ? values.filter((value) => value !== nextValue) : [...values, nextValue];

  const resetSelectionSetFeedback = () => {
    setSelectionSetFormErrors({});
    if (selectionSetBannerTimer.current) {
      clearTimeout(selectionSetBannerTimer.current);
      selectionSetBannerTimer.current = null;
    }
    setSelectionSetActionBanner(null);
  };

  const patchSelectionSetDraft = (patch: Partial<typeof selectionSetDraft>) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => ({ ...current, ...patch }));
  };

  const appendManualIncludeId = (id: string) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => {
      const parts = parseManualIdList(current.manualIncludeIds);
      if (parts.includes(id)) return current;
      return { ...current, manualIncludeIds: [...parts, id].join(', ') };
    });
  };

  const appendManualExcludeId = (id: string) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => {
      const parts = parseManualIdList(current.manualExcludeIds);
      if (parts.includes(id)) return current;
      return { ...current, manualExcludeIds: [...parts, id].join(', ') };
    });
  };

  const toggleSelectionSetDraftArray = (key: 'modelIds' | 'categories' | 'types', value: string) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => {
      if (key === 'modelIds') {
        return {
          ...current,
          modelIds: toggleArrayValue(current.modelIds, value),
          // Changing model scope invalidates dependent scopes.
          categories: [],
          types: [],
        };
      }
      if (key === 'categories') {
        return {
          ...current,
          categories: toggleArrayValue(current.categories, value),
          // Type scope depends on chosen categories.
          types: [],
        };
      }
      return {
        ...current,
        types: toggleArrayValue(current.types, value),
      };
    });
  };

  const validateSelectionSetDraft = (): boolean => {
    const errors: SelectionSetFormErrors = {};
    const name = selectionSetDraft.name.trim();
    if (!name) {
      errors.name = 'Selection set name is required.';
    }
    const manualInc = parseManualIdList(selectionSetDraft.manualIncludeIds);
    const hasScope =
      selectionSetDraft.modelIds.length > 0 ||
      selectionSetDraft.categories.length > 0 ||
      selectionSetDraft.types.length > 0 ||
      manualInc.length > 0;
    if (!hasScope) {
      errors.scope =
        'Choose at least one model, category, or type, or enter at least one object ID under Manual include.';
    }
    setSelectionSetFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = errors.name ?? errors.scope ?? 'Fix the form and try again.';
      toast.error(first);
      showTimedBanner(setSelectionSetActionBanner, selectionSetBannerTimer, { variant: 'error', message: first });
      return false;
    }
    return true;
  };

  const saveSelectionSetDraft = async () => {
    if (!validateSelectionSetDraft()) return;
    try {
      setError(null);
      const { selectionSet } = await saveSelectionSet.mutateAsync({
        name: selectionSetDraft.name,
        description: selectionSetDraft.description,
        filters: {
          modelIds: selectionSetDraft.modelIds,
          categories: selectionSetDraft.categories,
          types: selectionSetDraft.types,
        },
        manualIncludeIds: parseManualIdList(selectionSetDraft.manualIncludeIds),
        manualExcludeIds: parseManualIdList(selectionSetDraft.manualExcludeIds),
      });
      setSelectionSetFormErrors({});
      setSelectionSetDraft({
        name: '',
        description: '',
        modelIds: [],
        categories: [],
        types: [],
        manualIncludeIds: '',
        manualExcludeIds: '',
      });
      toast.success('Selection set saved', {
        description: `"${selectionSet.name}" is ready to use in clash tests.`,
      });
      showTimedBanner(setSelectionSetActionBanner, selectionSetBannerTimer, {
        variant: 'success',
        message: `Selection set "${selectionSet.name}" saved. You can use it as Set A / Set B in a clash test.`,
      });
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : 'Failed to save selection set';
      setError(msg);
      toast.error(msg);
      showTimedBanner(setSelectionSetActionBanner, selectionSetBannerTimer, { variant: 'error', message: msg });
    }
  };

  const patchClashTestDraft = (patch: Partial<typeof clashTestDraft>) => {
    setClashTestFormErrors({});
    if (clashTestBannerTimer.current) {
      clearTimeout(clashTestBannerTimer.current);
      clashTestBannerTimer.current = null;
    }
    setClashTestActionBanner(null);
    setClashTestDraft((current) => ({ ...current, ...patch }));
  };

  const validateClashTestDraft = (): boolean => {
    const errors: ClashTestFormErrors = {};
    const name = clashTestDraft.name.trim();
    if (!name) {
      errors.name = 'Test name is required.';
    }
    if (!clashTestDraft.setAId) {
      errors.setAId = 'Select Set A.';
    }
    if (!clashTestDraft.setBId) {
      errors.setBId = 'Select Set B.';
    }
    if (clashTestDraft.setAId && clashTestDraft.setBId && clashTestDraft.setAId === clashTestDraft.setBId) {
      errors.setBId = 'Set B must differ from Set A.';
    }
    const softRaw = clashTestDraft.softThreshold.trim();
    const soft = Number(softRaw);
    if (softRaw === '' || !Number.isFinite(soft) || soft < 0) {
      errors.softThreshold = 'Enter a valid number ≥ 0 (meters).';
    }
    const dupRaw = clashTestDraft.duplicateTolerance.trim();
    const dup = Number(dupRaw);
    if (dupRaw === '' || !Number.isFinite(dup) || dup < 0) {
      errors.duplicateTolerance = 'Enter a valid number ≥ 0 (meters).';
    }
    setClashTestFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0];
      toast.error(first);
      showTimedBanner(setClashTestActionBanner, clashTestBannerTimer, { variant: 'error', message: first });
      return false;
    }
    return true;
  };

  const saveClashTestDraft = async () => {
    if (!validateClashTestDraft()) return;
    try {
      setError(null);
      const softThreshold = Number(clashTestDraft.softThreshold.trim());
      const duplicateTolerance = Number(clashTestDraft.duplicateTolerance.trim());
      const response = await saveClashTest.mutateAsync({
        name: clashTestDraft.name.trim(),
        description: clashTestDraft.description.trim(),
        setAId: clashTestDraft.setAId,
        setBId: clashTestDraft.setBId,
        softThreshold,
        duplicateTolerance,
      });
      setSelectedTestId(response.clashTest.id);
      setSelectedClashId(null);
      setShowClashInMainViewer(true);
      setClashTestFormErrors({});
      setClashTestDraft({
        name: '',
        description: '',
        setAId: '',
        setBId: '',
        softThreshold: '0.05',
        duplicateTolerance: '0.001',
      });
      toast.success('Clash test saved', {
        description: `"${response.clashTest.name}" — select it above and click Run Test when ready.`,
      });
      showTimedBanner(setClashTestActionBanner, clashTestBannerTimer, {
        variant: 'success',
        message: `Saved "${response.clashTest.name}". Select the test above, then Run Test when ready.`,
      });
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : 'Failed to save clash test';
      setError(msg);
      toast.error(msg);
      showTimedBanner(setClashTestActionBanner, clashTestBannerTimer, { variant: 'error', message: msg });
    }
  };

  const importModelFiles = async (files: File[], openSidebarAfter = true) => {
    if (files.length === 0) return;
    try {
      setError(null);
      await importModels.mutateAsync({ files });
      if (openSidebarAfter) {
        setSidebarOpen(true);
        setSidebarTab('select');
      }
      toast.success(`Imported ${files.length} file${files.length === 1 ? '' : 's'}.`);
    } catch (importError) {
      const msg = importError instanceof Error ? importError.message : 'Failed to import models';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleImportFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    try {
      await importModelFiles(files, true);
    } finally {
      event.target.value = '';
    }
  };

  const acceptImport = '.ifc,.json,application/json,application/octet-stream';

  const handleStageDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  };

  const handleStageDragLeave = (event: DragEvent) => {
    event.preventDefault();
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragActive(false);
    }
  };

  const handleStageDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files).filter(
      (file) =>
        file.name.endsWith('.ifc') ||
        file.name.endsWith('.json') ||
        file.type === 'application/json' ||
        file.type === 'application/octet-stream'
    );
    await importModelFiles(files, true);
  };

  const executeRunTest = async () => {
    if (!selectedTestId) return;
    setRunTestDialogOpen(false);
    try {
      setError(null);
      const payload = (await runClashTest.mutateAsync({ testId: selectedTestId })) as {
        results?: ClashResult[];
        run?: { summary?: { total: number } } | null;
      };
      const list = payload.results ?? [];
      setShowClashInMainViewer(true);
      setSidebarOpen(true);
      setSidebarTab('results');
      setSelectedClashId(list[0]?.clashId ?? null);
      const total = payload.run?.summary?.total ?? list.length;
      toast.success(`Clash test finished: ${total} result${total === 1 ? '' : 's'}.`);
    } catch (runError) {
      const msg = runError instanceof Error ? runError.message : 'Failed to run clash test';
      setError(msg);
      toast.error(msg);
    }
  };

  /** Marks resolved (only manual workflow action left). */
  const markSelectedClashResolved = async () => {
    if (!selectedResult) return;
    try {
      setError(null);
      await updateClashStatus.mutateAsync({
        clashId: selectedResult.clashId,
        status: 'resolved',
        note: noteDraft,
        assignee: assigneeDraft,
      });
      await resultsQuery.refetch();
      toast.success('Clash marked as resolved.');
    } catch (statusError) {
      const msg = statusError instanceof Error ? statusError.message : 'Failed to update clash status';
      setError(msg);
      toast.error(msg);
    }
  };

  /** After a short delay, opening a New clash in the inspector promotes it to Reviewed (no toast). Cache refresh via mutation onSuccess. */
  useEffect(() => {
    if (!showClashInMainViewer || !selectedResult || selectedResult.status !== 'new') return;
    const { clashId } = selectedResult;
    const timer = window.setTimeout(() => {
      void updateClashStatus.mutateAsync({ clashId, status: 'reviewed' }).catch(() => {
        /* ignore — e.g. permission */
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [selectedResult?.clashId, selectedResult?.status, showClashInMainViewer, updateClashStatus]);

  /** Persist note & assignee; also sets Reviewed when not resolved (keeps workflow in sync). */
  const saveClashInspectorDetails = async () => {
    if (!selectedResult) {
      const msg = 'Select a clash in the list before saving.';
      toast.error(msg);
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, { variant: 'error', message: msg });
      return;
    }
    const noteTrim = noteDraft.trim();
    const assigneeTrim = assigneeDraft.trim() || 'Unassigned';
    if (noteTrim.length > INSPECTOR_NOTE_MAX_LEN) {
      const msg = `Note must be at most ${INSPECTOR_NOTE_MAX_LEN} characters.`;
      toast.error(msg);
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, { variant: 'error', message: msg });
      return;
    }
    try {
      setError(null);
      await updateClashStatus.mutateAsync({
        clashId: selectedResult.clashId,
        note: noteTrim,
        assignee: assigneeTrim,
        ...(selectedResult.status !== 'resolved' ? { status: 'reviewed' as const } : {}),
      });
      await resultsQuery.refetch();
      setNoteDraft(noteTrim);
      setAssigneeDraft(assigneeTrim);
      toast.success('Note and assignee saved.');
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, {
        variant: 'success',
        message:
          selectedResult.status === 'resolved'
            ? 'Note and assignee saved (clash stays Resolved).'
            : 'Note and assignee saved. Status set to Reviewed.',
      });
    } catch (saveDetailsError) {
      const msg = saveDetailsError instanceof Error ? saveDetailsError.message : 'Failed to save note or assignee';
      setError(msg);
      toast.error(msg);
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, { variant: 'error', message: msg });
    }
  };

  const hideObject = async (objectId: string) => {
    try {
      setError(null);
      await applyObjectActions.mutateAsync({ action: 'hide', objectIds: [objectId] });
      await resultsQuery.refetch();
      toast.success('Object hidden for clash tests.');
    } catch (hideError) {
      const msg = hideError instanceof Error ? hideError.message : 'Failed to hide object';
      setError(msg);
      toast.error(msg);
    }
  };

  const showObjects = async (objectIds: string[]) => {
    if (objectIds.length === 0) return;
    try {
      setError(null);
      await applyObjectActions.mutateAsync({ action: 'show', objectIds });
      await resultsQuery.refetch();
      toast.success(`${objectIds.length} object${objectIds.length === 1 ? '' : 's'} shown again.`);
    } catch (showError) {
      const msg = showError instanceof Error ? showError.message : 'Failed to show objects';
      setError(msg);
      toast.error(msg);
    }
  };

  const resetHiddenObjects = async () => {
    const ids = persistedHiddenObjects.map((object) => object.id);
    if (ids.length === 0) return;
    await showObjects(ids);
  };

  const exportCurrent = async (format: 'json' | 'csv' | 'bcf' | 'model') => {
    if (format !== 'model' && !selectedTestId) {
      const warnMsg = 'Choose a clash test in the Tests tab before exporting JSON, CSV, or BCF.';
      toast.warning('Select a clash test first', { description: warnMsg });
      showTimedBanner(setExportActionBanner, exportBannerTimer, { variant: 'warning', message: warnMsg });
      return;
    }
    try {
      setError(null);
      if (format === 'model') {
        const filename = `${projectSlug}-federated-model.json`;
        await triggerDownload(
          apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/export/model`),
          filename
        );
        toast.success('Federated model exported', {
          description: `${filename} was downloaded.`,
        });
        showTimedBanner(setExportActionBanner, exportBannerTimer, {
          variant: 'success',
          message: `Federated model exported: ${filename} (download should start in your browser).`,
        });
        return;
      }

      const ext = format === 'bcf' ? 'bcf.json' : format;
      const filename = `${projectSlug}-${selectedTestId}.${ext}`;
      const base = format === 'bcf'
        ? apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(selectedTestId || '')}/export/bcf`)
        : apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(selectedTestId || '')}/export?format=${format}`);
      await triggerDownload(base, filename);
      toast.success(`Export complete (${format.toUpperCase()})`, {
        description: `${filename} was downloaded.`,
      });
      showTimedBanner(setExportActionBanner, exportBannerTimer, {
        variant: 'success',
        message: `${format.toUpperCase()} export ready: ${filename} (check your downloads folder).`,
      });
    } catch (exportError) {
      const msg = exportError instanceof Error ? exportError.message : 'Failed to export';
      setError(msg);
      toast.error(msg);
      showTimedBanner(setExportActionBanner, exportBannerTimer, { variant: 'error', message: msg });
    }
  };

  const confirmDeleteClashTest = async () => {
    if (!pendingDeleteTestId) return;
    const id = pendingDeleteTestId;
    setPendingDeleteTestId(null);
    try {
      setError(null);
      await deleteClashTest.mutateAsync(id);
      if (selectedTestId === id) {
        setSelectedTestId(null);
        setSelectedClashId(null);
        setShowClashInMainViewer(false);
      }
      toast.success('Clash test deleted.');
    } catch (deleteError) {
      const msg = deleteError instanceof Error ? deleteError.message : 'Failed to delete clash test';
      setError(msg);
      toast.error(msg);
    }
  };

  const confirmDeleteSelectionSet = async () => {
    if (!pendingDeleteSetId) return;
    const id = pendingDeleteSetId;
    setPendingDeleteSetId(null);
    try {
      setError(null);
      await deleteSelectionSet.mutateAsync(id);
      toast.success('Selection set deleted.');
    } catch (deleteError) {
      const msg = deleteError instanceof Error ? deleteError.message : 'Failed to delete selection set';
      setError(msg);
      toast.error(msg);
    }
  };

  const openDetectWithTab = (tab: SidebarTab = 'tests') => {
    setViewMode('detect');
    setSidebarOpen(true);
    setSidebarTab(tab);
  };

  const openRunDetectFromLanding = (testId?: string) => {
    const fallbackTestId = testId || selectedTestId || workspace?.clashTests[0]?.id || null;
    if (!fallbackTestId) {
      setError('Create at least one clash test before running detection.');
      openDetectWithTab('tests');
      return;
    }
    setSelectedTestId(fallbackTestId);
    setSelectedClashId(null);
    setShowClashInMainViewer(true);
    openDetectWithTab('tests');
    setRunTestDialogOpen(true);
  };

  const pickTab = (tab: SidebarTab) => {
    setViewMode('detect');
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setSidebarTab(tab);
    }
  };

  const tabBtn = (tab: SidebarTab) =>
    cn(
      'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
      sidebarTab === tab ? 'bg-[#155DFC] text-white' : 'text-[#4A5565] hover:bg-[#F3F4F6]'
    );

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={cn(
          'space-y-3 px-4 py-4 md:px-6',
          '[&_button]:transition-[transform,filter] [&_button]:duration-100',
          '[&_button]:active:scale-[0.98] [&_button]:active:brightness-[0.93]',
          '[&_button:disabled]:pointer-events-none [&_button:disabled]:active:scale-100 [&_button:disabled]:active:brightness-100',
          'motion-reduce:[&_button]:active:scale-100'
        )}
      >
        {viewMode === 'detect' && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium text-[#101828] md:text-[22px]">Clash workspace</h2>
              <p className="mt-0.5 text-xs text-[#6A7282] md:text-sm">Large viewer · Clash Detective in the sidebar.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setSelectedDocIds(new Set()); setImportModalOpen(true); }}
              className="rounded-[10px] border-[#D1D5DC] px-3"
            >
              <Upload className="size-4" aria-hidden />
              Import
            </Button>
          </div>
        )}

        {error && (
          <Alert
            variant="destructive"
            className="rounded-[10px] border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] [&_[data-slot=alert-description]]:text-[#B91C1C]"
          >
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {persistedHiddenObjects.length > 0 && (
          <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {persistedHiddenObjects.length} object{persistedHiddenObjects.length === 1 ? '' : 's'} hidden from clash tests
                </p>
                <p className="text-xs text-amber-800">
                  Persisted hide affects detection results. Open Select in the sidebar to show objects or reset.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void resetHiddenObjects()}
                className="border-amber-400 text-amber-900 hover:bg-amber-100"
              >
                Reset hidden
              </Button>
            </div>
          </div>
        )}

        {viewMode === 'landing' ? (
          <div className="mx-auto w-full max-w-[1088px] py-4">
            {workspaceQuery.isLoading && (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-5 text-sm text-[#6A7282]">
                Loading clash workspace...
              </div>
            )}

            {!workspaceQuery.isLoading && (
              <div className="space-y-6">
                <div className="flex min-h-14 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-3xl leading-8 text-[#101828]">Clash Detection</h3>
                    <p className="mt-1 text-sm leading-5 text-[#4A5565]">BCF-compliant clash detection and management</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedDocIds(new Set());
                        setImportModalOpen(true);
                      }}
                      className="border-[#D1D5DC] px-3.5"
                    >
                      Import from Documents
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowClashInMainViewer(false);
                        openDetectWithTab('tests');
                      }}
                      className="border-[#D1D5DC] px-3.5"
                    >
                      Create test
                    </Button>
                    <Button
                      type="button"
                      onClick={() => openRunDetectFromLanding()}
                      disabled={runClashTest.isPending || models.length === 0 || (workspace?.clashTests.length ?? 0) === 0}
                      className={cn(
                        'rounded-[10px] gap-2 px-4',
                        runClashTest.isPending || models.length === 0 || (workspace?.clashTests.length ?? 0) === 0
                          ? 'bg-blue-300 hover:bg-blue-300'
                          : 'bg-[#155DFC] hover:bg-blue-700'
                      )}
                    >
                      <ShieldAlert className="size-4" />
                      {runClashTest.isPending ? 'Running...' : 'Run Detection'}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                  <Card className="gap-0 rounded-[10px] border-[#E5E7EB] py-4 shadow-sm">
                    <CardContent className="px-4 py-0">
                      <p className="text-xs text-[#4A5565]">Total Clashes</p>
                      <p className="mt-1 text-[24px] leading-8 text-[#101828]">{landingStatsWithLow.total}</p>
                    </CardContent>
                  </Card>
                  <Card className="gap-0 rounded-[10px] border-[#E5E7EB] py-4 shadow-sm">
                    <CardContent className="px-4 py-0">
                      <p className="text-xs text-[#4A5565]">High Severity</p>
                      <p className="mt-1 text-[24px] leading-8 text-[#EC003F]">{landingStatsWithLow.high}</p>
                    </CardContent>
                  </Card>
                  <Card className="gap-0 rounded-[10px] border-[#E5E7EB] py-4 shadow-sm">
                    <CardContent className="px-4 py-0">
                      <p className="text-xs text-[#4A5565]">Medium Severity</p>
                      <p className="mt-1 text-[24px] leading-8 text-[#BB4D00]">{landingStatsWithLow.medium}</p>
                    </CardContent>
                  </Card>
                  <Card className="gap-0 rounded-[10px] border-[#E5E7EB] py-4 shadow-sm">
                    <CardContent className="px-4 py-0">
                      <p className="text-xs text-[#4A5565]">Low Severity</p>
                      <p className="mt-1 text-[24px] leading-8 text-[#0069A8]">{landingStatsWithLow.low}</p>
                    </CardContent>
                  </Card>
                  <Card className="gap-0 rounded-[10px] border-[#E5E7EB] py-4 shadow-sm">
                    <CardContent className="px-4 py-0">
                      <p className="text-xs text-[#4A5565]">In Progress</p>
                      <p className="mt-1 text-[24px] leading-8 text-[#4F39F6]">{landingStatsWithLow.inProgress}</p>
                    </CardContent>
                  </Card>
                  <Card className="gap-0 rounded-[10px] border-[#E5E7EB] py-4 shadow-sm">
                    <CardContent className="px-4 py-0">
                      <p className="text-xs text-[#4A5565]">Resolved</p>
                      <p className="mt-1 text-[24px] leading-8 text-[#009966]">{landingStatsWithLow.resolved}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full max-w-[448px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[#9AA4B2]" />
                    <Input
                      type="text"
                      value={landingSearch}
                      onChange={(event) => setLandingSearch(event.target.value)}
                      placeholder="Search clashes..."
                      className="h-[37px] rounded-[10px] border-[#E5E7EB] bg-white pl-9 pr-4 text-sm text-[#101828] placeholder:text-[#6A7282] focus-visible:border-[#155DFC]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {([
                      { id: 'all', label: 'All' },
                      { id: 'high', label: 'High' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'low', label: 'Low' },
                    ] as const).map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLandingSeverityFilter(item.id)}
                        className={cn(
                          'h-[33px] rounded-[10px] px-3 text-xs font-normal',
                          landingSeverityFilter === item.id
                            ? 'border-transparent bg-[#F0F9FF] text-[#0069A8] hover:bg-[#E0F2FE]'
                            : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
                        )}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white">
                  {landingResults.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-[#6A7282]">
                      {results.length === 0
                        ? 'No clash results yet. Run Detection to generate conflicts.'
                        : 'No clashes match the current search/filter.'}
                    </div>
                  ) : (
                    <div>
                      {paginatedLandingResults.map((result, index) => {
                        const severity = result.type === 'HARD' ? 'high' : result.type === 'DUPLICATE' ? 'medium' : 'low';
                        const statusColor =
                          result.status === 'resolved'
                            ? 'bg-[#ECFDF5] text-[#007A55]'
                            : result.status === 'reviewed'
                              ? 'bg-[#EEF2FF] text-[#432DD7]'
                              : 'bg-[#FFF1F2] text-[#C70036]';
                        const severityColor =
                          severity === 'high'
                            ? 'bg-[#FFF1F2] text-[#C70036]'
                            : severity === 'medium'
                              ? 'bg-[#FFFBEB] text-[#BB4D00]'
                              : 'bg-[#F0F9FF] text-[#0069A8]';
                        const iconColor =
                          severity === 'high'
                            ? 'bg-[#FFF1F2] text-[#FF0051]'
                            : severity === 'medium'
                              ? 'bg-[#FFFBEB] text-[#FF8700]'
                              : 'bg-[#F0F9FF] text-[#0085DB]';
                        return (
                          <div
                            key={result.clashId}
                            className={cn(
                              'flex gap-4 px-6 py-6',
                              index !== landingResults.length - 1 && 'border-b border-[#E5E7EB]'
                            )}
                          >
                            <div className={cn('mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-[10px]', iconColor)}>
                              <AlertTriangle className="size-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm text-[#101828]">{(landingPage - 1) * landingPageSize + index + 1}</span>
                                <Badge variant="secondary" className={cn('border-0 font-normal', statusColor)}>
                                  {result.status === 'reviewed' ? 'in-progress' : result.status}
                                </Badge>
                                <Badge variant="secondary" className="border-0 bg-[#F3F4F6] font-normal text-[#364153]">
                                  {result.type === 'SOFT' ? 'Soft Clash' : 'Hard Clash'}
                                </Badge>
                                <Badge variant="secondary" className={cn('border-0 font-normal', severityColor)}>
                                  {severity} severity
                                </Badge>
                              </div>
                              <p className="text-sm leading-5 text-[#101828]">{result.title}</p>
                              <p className="mt-1 text-sm leading-5 text-[#4A5565]">
                                X: {result.position[0].toFixed(2)}, Y: {result.position[1].toFixed(2)}, Z: {result.position[2].toFixed(2)}
                              </p>
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-[#6A7282]">Models:</span>
                                <Badge variant="secondary" className="border-0 bg-[#F3F4F6] px-1.5 py-1 font-normal text-xs text-[#364153]">
                                  {result.objectAModel}
                                </Badge>
                                <Badge variant="secondary" className="border-0 bg-[#F3F4F6] px-1.5 py-1 font-normal text-xs text-[#364153]">
                                  {result.objectBModel}
                                </Badge>
                              </div>
                              <p className="mt-3 text-xs text-[#6A7282]">Assigned to {result.assignee || 'Unassigned'}</p>
                            </div>
                            <div className="flex shrink-0 items-end gap-2 pb-1">
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 gap-1 rounded-[10px] bg-[#009966] px-3 text-xs text-white hover:bg-[#007A55] [&_svg]:size-3.5"
                              >
                                <ShieldCheck className="size-3.5" />
                                Resolve
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedClashId(result.clashId);
                                  setShowClashInMainViewer(true);
                                  openDetectWithTab('results');
                                }}
                                className="h-7 gap-1 rounded-[10px] bg-[#F3F4F6] px-3 text-xs text-[#364153] hover:bg-[#E5E7EB] [&_svg]:size-3.5"
                              >
                                <Eye className="size-3.5" />
                                View 3D
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {landingResults.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#6A7282]">
                      Showing {(landingPage - 1) * landingPageSize + 1}-
                      {Math.min(landingPage * landingPageSize, landingResults.length)} of {landingResults.length}
                    </p>
                    <Pagination className="mx-0 w-auto justify-start">
                      <PaginationContent className="gap-1.5">
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            size="icon-sm"
                            aria-label="Previous page"
                            aria-disabled={landingPage === 1}
                            tabIndex={landingPage === 1 ? -1 : undefined}
                            className={landingPaginationNavLinkClass(landingPage === 1)}
                            onClick={(e) => {
                              e.preventDefault();
                              if (landingPage > 1) setLandingPage(Math.max(1, landingPage - 1));
                            }}
                          >
                            <ChevronLeftIcon className="size-4" />
                          </PaginationLink>
                        </PaginationItem>

                        {buildLandingPaginationItems(landingPage, landingTotalPages).map((item) => {
                          if (typeof item !== 'number') {
                            return (
                              <PaginationItem key={item}>
                                <PaginationEllipsis className="size-8 min-w-8 text-[#9AA4B2]" />
                              </PaginationItem>
                            );
                          }

                          const active = item === landingPage;
                          return (
                            <PaginationItem key={item}>
                              <PaginationLink
                                href="#"
                                size="icon-sm"
                                isActive={active}
                                aria-label={`Page ${item}`}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'min-w-8 text-sm',
                                  active
                                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#EFF6FF]'
                                    : 'border border-[#E5E7EB] bg-white text-[#6A7282] shadow-xs hover:bg-[#F9FAFB]',
                                )}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setLandingPage(item);
                                }}
                              >
                                {item}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}

                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            size="icon-sm"
                            aria-label="Next page"
                            aria-disabled={landingPage === landingTotalPages}
                            tabIndex={landingPage === landingTotalPages ? -1 : undefined}
                            className={landingPaginationNavLinkClass(landingPage === landingTotalPages)}
                            onClick={(e) => {
                              e.preventDefault();
                              if (landingPage < landingTotalPages) {
                                setLandingPage(Math.min(landingTotalPages, landingPage + 1));
                              }
                            }}
                          >
                            <ChevronRightIcon className="size-4" />
                          </PaginationLink>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}

                {models.length === 0 && (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&_[data-slot=alert-description]]:text-amber-900">
                    <AlertDescription>
                      No models imported yet. Import IFC first, then create a test and run detection.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        ) : (
        <div className="relative flex h-[min(88vh,calc(100dvh-6rem))] max-h-[calc(100dvh-4.5rem)] min-h-[420px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close sidebar"
              className="fixed inset-0 z-40 bg-black/35 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <nav
            className="relative z-10 flex min-h-0 w-12 shrink-0 flex-col items-center gap-1 self-stretch overflow-y-auto border-r border-[#E5E7EB] bg-[#ECEEF2] py-2"
            aria-label="Activity bar"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-10 rounded-md text-[#364153] hover:bg-white/80',
                    sidebarOpen && 'bg-white shadow-sm'
                  )}
                  aria-expanded={sidebarOpen}
                  aria-controls={sidebarPanelId}
                  onClick={() => {
                    if (sidebarOpen) setSidebarOpen(false);
                    else {
                      setViewMode('detect');
                      setSidebarOpen(true);
                      setSidebarTab('select');
                    }
                  }}
                >
                  <PanelLeft className="size-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Toggle sidebar</TooltipContent>
            </Tooltip>
            <Separator className="my-1 w-6 bg-[#D1D5DC]" decorative />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-10 rounded-md',
                    sidebarOpen && sidebarTab === 'select' ? 'bg-[#155DFC] text-white hover:bg-[#155DFC] hover:text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'select'}
                  onClick={() => pickTab('select')}
                >
                  <FolderTree className="size-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Select · models &amp; sets</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-10 rounded-md',
                    sidebarOpen && sidebarTab === 'tests' ? 'bg-[#155DFC] text-white hover:bg-[#155DFC] hover:text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'tests'}
                  onClick={() => pickTab('tests')}
                >
                  <FlaskConical className="size-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Tests</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-10 rounded-md',
                    sidebarOpen && sidebarTab === 'results' ? 'bg-[#155DFC] text-white hover:bg-[#155DFC] hover:text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'results'}
                  onClick={() => pickTab('results')}
                >
                  <ListChecks className="size-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Results</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-10 rounded-md',
                    sidebarOpen && sidebarTab === 'report' ? 'bg-[#155DFC] text-white hover:bg-[#155DFC] hover:text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'report'}
                  onClick={() => pickTab('report')}
                >
                  <FileText className="size-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Report &amp; export</TooltipContent>
            </Tooltip>
          </nav>

          <aside
            id={sidebarPanelId}
            className={cn(
              'relative z-10 max-md:z-[45] flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[#E5E7EB] bg-white transition-[width,opacity,transform] duration-200',
              'max-md:fixed max-md:bottom-0 max-md:left-12 max-md:top-0 max-md:w-[min(calc(100vw-3rem),360px)] max-md:shadow-xl',
              sidebarOpen ? 'max-md:translate-x-0 max-md:opacity-100' : 'max-md:pointer-events-none max-md:-translate-x-full max-md:opacity-0',
              'md:translate-x-0 md:opacity-100',
              sidebarOpen ? 'md:w-[min(360px,34vw)]' : 'md:w-0 md:border-r-0'
            )}
            aria-hidden={!sidebarOpen}
          >
            <div className={cn('flex h-full max-h-full min-h-0 min-w-[min(100%,360px)] flex-1 flex-col overflow-hidden', !sidebarOpen && 'md:invisible md:overflow-hidden')}>
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#E5E7EB] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6A7282]">Clash Detective</p>
                  <p className="truncate text-sm font-medium text-[#101828]">{selectedTest?.name || 'No test selected'}</p>
                  <p className="text-[11px] text-[#6A7282]">
                    {runPayload?.run
                      ? `Last run · ${runPayload.run.summary.total} clashes`
                      : 'Run a test to load results.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-md text-[#6A7282] hover:bg-[#F3F4F6] md:hidden"
                  aria-label="Close panel"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-[#E5E7EB] px-2 py-2">
                {(['select', 'tests', 'results', 'report'] as const satisfies readonly SidebarTab[]).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={tabBtn(tab)}
                    onClick={() => setSidebarTab(tab)}
                  >
                    {tab === 'tests' ? 'Tests' : tab === 'select' ? 'Select' : tab === 'results' ? 'Results' : 'Report'}
                  </Button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
                {sidebarTab === 'tests' && (
                  <div className="space-y-4">
                    <Button
                      type="button"
                      onClick={() => setRunTestDialogOpen(true)}
                      disabled={!selectedTestId || runClashTest.isPending}
                      className={cn(
                        'w-full rounded-lg px-4 py-2.5',
                        !selectedTestId || runClashTest.isPending ? 'bg-blue-300 hover:bg-blue-300' : 'bg-[#155DFC] hover:bg-blue-700'
                      )}
                    >
                      {runClashTest.isPending ? 'Running…' : 'Run Test'}
                    </Button>
                    <div className="space-y-2">
                      {workspace?.clashTests.map((test: ClashTest) => (
                        <div
                          key={test.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedTestId(test.id);
                            setSelectedClashId(null);
                            setShowClashInMainViewer(true);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedTestId(test.id);
                              setSelectedClashId(null);
                              setShowClashInMainViewer(true);
                            }
                          }}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left',
                            selectedTestId === test.id ? 'border-[#155DFC] bg-[#EFF6FF]' : 'border-[#E5E7EB] bg-white'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#101828]">{test.name}</p>
                              <p className="text-xs text-[#6A7282]">Threshold {test.softThreshold} m · Duplicate {test.duplicateTolerance}</p>
                            </div>
                            <Button
                              type="button"
                              variant="link"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingDeleteTestId(test.id);
                              }}
                              className="h-auto shrink-0 p-0 text-xs text-[#DC2626] no-underline hover:text-[#B91C1C]"
                            >
                              Delete
                            </Button>
                          </div>
                          {test.latestRun && (
                            <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-[#6A7282]">
                              <span>Total {test.latestRun.summary.total}</span>
                              <span>Hard {test.latestRun.summary.hard}</span>
                              <span>Resolved {test.latestRun.summary.resolved}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-dashed border-[#D1D5DC] p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#6A7282]">New Clash Test</p>
                      <label className="mt-2 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-clash-test-name`}>
                        Test name <span className="text-red-600">*</span>
                      </label>
                      <Input
                        id={`${sidebarPanelId}-clash-test-name`}
                        required
                        aria-invalid={Boolean(clashTestFormErrors.name)}
                        aria-describedby={clashTestFormErrors.name ? `${sidebarPanelId}-err-name` : undefined}
                        className={cn(
                          'mt-1 rounded-lg text-sm',
                          clashTestFormErrors.name ? 'border-red-400' : 'border-[#D1D5DC]'
                        )}
                        placeholder="e.g. MEP vs Structure L01"
                        value={clashTestDraft.name}
                        onChange={(event) => patchClashTestDraft({ name: event.target.value })}
                      />
                      {clashTestFormErrors.name && (
                        <p id={`${sidebarPanelId}-err-name`} className="mt-1 text-xs text-red-600">{clashTestFormErrors.name}</p>
                      )}
                      <label className="mt-2 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-clash-test-desc`}>
                        Description <span className="text-[#9CA3AF]">(optional)</span>
                      </label>
                      <Textarea
                        id={`${sidebarPanelId}-clash-test-desc`}
                        className="mt-1 rounded-lg border-[#D1D5DC] text-sm"
                        rows={2}
                        placeholder="Notes for your team"
                        value={clashTestDraft.description}
                        onChange={(event) => patchClashTestDraft({ description: event.target.value })}
                      />
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-set-a`}>
                            Selection Set A <span className="text-red-600">*</span>
                          </label>
                          <select
                            id={`${sidebarPanelId}-set-a`}
                            required
                            aria-invalid={Boolean(clashTestFormErrors.setAId)}
                            className={cn(
                              'mt-1 w-full rounded-lg border px-3 py-2 text-sm',
                              clashTestFormErrors.setAId ? 'border-red-400' : 'border-[#D1D5DC]'
                            )}
                            value={clashTestDraft.setAId}
                            onChange={(event) => patchClashTestDraft({ setAId: event.target.value })}
                          >
                            <option value="">Select Set A</option>
                            {workspace?.selectionSets.map((selectionSet) => (
                              <option key={selectionSet.id} value={selectionSet.id}>{selectionSet.name}</option>
                            ))}
                          </select>
                          {clashTestFormErrors.setAId && <p className="mt-1 text-xs text-red-600">{clashTestFormErrors.setAId}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-set-b`}>
                            Selection Set B <span className="text-red-600">*</span>
                          </label>
                          <select
                            id={`${sidebarPanelId}-set-b`}
                            required
                            aria-invalid={Boolean(clashTestFormErrors.setBId)}
                            className={cn(
                              'mt-1 w-full rounded-lg border px-3 py-2 text-sm',
                              clashTestFormErrors.setBId ? 'border-red-400' : 'border-[#D1D5DC]'
                            )}
                            value={clashTestDraft.setBId}
                            onChange={(event) => patchClashTestDraft({ setBId: event.target.value })}
                          >
                            <option value="">Select Set B</option>
                            {workspace?.selectionSets.map((selectionSet) => (
                              <option key={selectionSet.id} value={selectionSet.id}>{selectionSet.name}</option>
                            ))}
                          </select>
                          {clashTestFormErrors.setBId && <p className="mt-1 text-xs text-red-600">{clashTestFormErrors.setBId}</p>}
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-soft-th`}>
                          Soft threshold <span className="text-red-600">*</span>
                          <span className="font-normal text-[#6A7282]"> (m)</span>
                        </label>
                        <p className="mt-0.5 text-[11px] text-[#6A7282]">Gap for soft clash; 0 = hard intersection only.</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {CLASH_SOFT_THRESHOLD_PRESETS_M.map((value) => (
                            <Button
                              key={value}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => patchClashTestDraft({ softThreshold: value })}
                              className={cn(
                                'h-auto rounded-md px-2 py-1 text-xs font-normal',
                                clashTestDraft.softThreshold === value
                                  ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]'
                                  : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F9FAFB]'
                              )}
                            >
                              {value} m
                            </Button>
                          ))}
                        </div>
                        <Input
                          id={`${sidebarPanelId}-soft-th`}
                          type="text"
                          inputMode="decimal"
                          aria-invalid={Boolean(clashTestFormErrors.softThreshold)}
                          className={cn(
                            'mt-2 rounded-lg text-sm',
                            clashTestFormErrors.softThreshold ? 'border-red-400' : 'border-[#D1D5DC]'
                          )}
                          placeholder="Custom value (meters)"
                          value={clashTestDraft.softThreshold}
                          onChange={(event) => patchClashTestDraft({ softThreshold: event.target.value })}
                        />
                        {clashTestFormErrors.softThreshold && (
                          <p className="mt-1 text-xs text-red-600">{clashTestFormErrors.softThreshold}</p>
                        )}
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-dup-tol`}>
                          Duplicate tolerance <span className="text-red-600">*</span>
                          <span className="font-normal text-[#6A7282]"> (m)</span>
                        </label>
                        <p className="mt-0.5 text-[11px] text-[#6A7282]">BBox match within this distance counts as duplicate.</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {CLASH_DUPLICATE_TOLERANCE_PRESETS_M.map((value) => (
                            <Button
                              key={value}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => patchClashTestDraft({ duplicateTolerance: value })}
                              className={cn(
                                'h-auto rounded-md px-2 py-1 text-xs font-normal',
                                clashTestDraft.duplicateTolerance === value
                                  ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]'
                                  : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F9FAFB]'
                              )}
                            >
                              {value} m
                            </Button>
                          ))}
                        </div>
                        <Input
                          id={`${sidebarPanelId}-dup-tol`}
                          type="text"
                          inputMode="decimal"
                          aria-invalid={Boolean(clashTestFormErrors.duplicateTolerance)}
                          className={cn(
                            'mt-2 rounded-lg text-sm',
                            clashTestFormErrors.duplicateTolerance ? 'border-red-400' : 'border-[#D1D5DC]'
                          )}
                          placeholder="Custom value (meters)"
                          value={clashTestDraft.duplicateTolerance}
                          onChange={(event) => patchClashTestDraft({ duplicateTolerance: event.target.value })}
                        />
                        {clashTestFormErrors.duplicateTolerance && (
                          <p className="mt-1 text-xs text-red-600">{clashTestFormErrors.duplicateTolerance}</p>
                        )}
                      </div>
                      <SidebarActionBanner banner={clashTestActionBanner} />
                      <Button
                        type="button"
                        disabled={saveClashTest.isPending}
                        onClick={() => void saveClashTestDraft()}
                        className={cn(
                          'mt-3 w-full rounded-lg',
                          saveClashTest.isPending ? 'bg-blue-300 hover:bg-blue-300' : 'bg-[#155DFC] hover:bg-blue-700'
                        )}
                      >
                        {saveClashTest.isPending ? 'Saving…' : 'Save Clash Test'}
                      </Button>
                    </div>
                  </div>
                )}

                {sidebarTab === 'select' && (
                  <div className="space-y-5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setImportModalOpen(true)}
                      className="w-full gap-2 border-[#D1D5DC] py-2.5"
                    >
                      <Upload className="size-4" aria-hidden />
                      Import models
                    </Button>
                    <section className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[#101828]">Model Tree</h3>
                          <p className="mt-0.5 text-xs text-[#6A7282]">Viewport visibility only.</p>
                        </div>
                        {persistedHiddenObjects.length > 0 && (
                          <Badge variant="secondary" className="shrink-0 border-0 bg-amber-100 text-[10px] font-medium text-amber-900">
                            {persistedHiddenObjects.length} hidden
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 space-y-3">
                        {models.length === 0 && <p className="text-sm text-[#6A7282]">No models yet — import or drop files on the viewer.</p>}
                        {models.map((model) => (
                          <div key={model.id} className="rounded-lg border border-[#E5E7EB] p-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#101828]">{model.name}</p>
                                <p className="text-xs text-[#6A7282]">
                                  {model.discipline} · {model.objectCount} objects
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setHiddenModelIds((current) => toggleArrayValue(current, model.name))}
                                className={cn(
                                  'h-auto shrink-0 rounded-full px-2 py-1 text-xs font-normal whitespace-nowrap',
                                  hiddenModelIds.includes(model.name) ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#ECFDF3] text-[#047857]'
                                )}
                              >
                                {hiddenModelIds.includes(model.name) ? 'Hidden' : 'Visible'}
                              </Button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {model.categories.map((category) => (
                                <Button
                                  key={`${model.id}-${category}`}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setHiddenCategories((current) => toggleArrayValue(current, category))}
                                  className={cn(
                                    'h-auto rounded-full px-2 py-0.5 text-[11px] font-normal',
                                    hiddenCategories.includes(category)
                                      ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]'
                                      : 'border-[#E5E7EB] bg-white text-[#364153]'
                                  )}
                                >
                                  {category}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {persistedHiddenObjects.length > 0 && (
                          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6A7282]">Persisted hidden</p>
                              <Button type="button" variant="link" onClick={() => void resetHiddenObjects()} className="h-auto p-0 text-xs font-medium text-[#155DFC] no-underline">Show all</Button>
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {persistedHiddenObjects.map((object) => (
                                <div key={object.id} className="flex items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-[#101828]">{object.id}</p>
                                    <p className="truncate text-[11px] text-[#6A7282]">{object.type} · {object.sourceModel}</p>
                                  </div>
                                  <Button type="button" variant="outline" size="sm" onClick={() => void showObjects([object.id])} className="h-auto shrink-0 px-2 py-1 text-[11px] font-normal">Show</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                      <h3 className="text-sm font-semibold text-[#101828]">Selection Sets</h3>
                      <div className="mt-3 space-y-3">
                        {workspace?.selectionSets.map((selectionSet: SelectionSet) => (
                          <div key={selectionSet.id} className="rounded-lg border border-[#E5E7EB] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#101828]">{selectionSet.name}</p>
                                <p className="text-xs text-[#6A7282]">
                                  {selectionSet.filters.modelIds.length} models · {selectionSet.filters.categories.length} categories · {selectionSet.manualIncludeIds.length} manual
                                </p>
                              </div>
                              <Button type="button" variant="link" onClick={() => setPendingDeleteSetId(selectionSet.id)} className="h-auto shrink-0 p-0 text-xs text-[#DC2626] no-underline hover:text-[#B91C1C]">Delete</Button>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-lg border border-dashed border-[#D1D5DC] p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#6A7282]">New Selection Set</p>
                          <datalist id={objectIdDatalistId}>
                            {objectIdDatalistOptions.map((id) => (
                              <option key={id} value={id} />
                            ))}
                          </datalist>
                          <label className="mt-2 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-ss-name`}>
                            Name <span className="text-red-600">*</span>
                          </label>
                          <Input
                            id={`${sidebarPanelId}-ss-name`}
                            className={cn(
                              'mt-1 rounded-lg text-sm',
                              selectionSetFormErrors.name ? 'border-red-400' : 'border-[#D1D5DC]'
                            )}
                            placeholder="e.g. MEP ducts — Level 2"
                            aria-invalid={Boolean(selectionSetFormErrors.name)}
                            value={selectionSetDraft.name}
                            onChange={(event) => patchSelectionSetDraft({ name: event.target.value })}
                          />
                          {selectionSetFormErrors.name && (
                            <p className="mt-1 text-xs text-red-600">{selectionSetFormErrors.name}</p>
                          )}
                          <label className="mt-2 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-ss-desc`}>
                            Description
                          </label>
                          <Textarea
                            id={`${sidebarPanelId}-ss-desc`}
                            className="mt-1 rounded-lg border-[#D1D5DC] text-sm"
                            rows={2}
                            placeholder="Optional notes for your team"
                            value={selectionSetDraft.description}
                            onChange={(event) => patchSelectionSetDraft({ description: event.target.value })}
                          />
                          <div className="mt-3 space-y-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2.5">
                            <p className="text-[11px] leading-snug text-[#6A7282]">
                              <span className="font-medium text-[#364153]">Scope</span> — pick models, categories, and/or types (tap to toggle). Or type object IDs under Manual include. At least one scope rule is required.
                            </p>
                            <div>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-medium text-[#364153]">Models</span>
                                {selectionSetDraft.modelIds.length > 0 && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-[11px] font-medium text-[#155DFC] no-underline"
                                    onClick={() => patchSelectionSetDraft({ modelIds: [], categories: [], types: [] })}
                                  >
                                    Clear ({selectionSetDraft.modelIds.length})
                                  </Button>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-[#6A7282]">Include every object from these federated models.</p>
                              <SelectionSetChipPicker
                                options={models.map((model) => ({ value: model.id, label: model.name }))}
                                selected={selectionSetDraft.modelIds}
                                onToggle={(value) => toggleSelectionSetDraftArray('modelIds', value)}
                                emptyMessage="Import models above, then pick one or more here."
                                aria-invalid={Boolean(selectionSetFormErrors.scope)}
                              />
                            </div>
                            <div>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-medium text-[#364153]">Categories</span>
                                {selectionSetDraft.categories.length > 0 && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-[11px] font-medium text-[#155DFC] no-underline"
                                    onClick={() => patchSelectionSetDraft({ categories: [], types: [] })}
                                  >
                                    Clear ({selectionSetDraft.categories.length})
                                  </Button>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-[#6A7282]">Narrows to IFC / discipline categories (within your model scope).</p>
                              {selectionSetDraft.modelIds.length === 0 ? (
                                <p className="mt-1 text-xs text-[#6A7282]">Select at least one model first to load categories.</p>
                              ) : (
                                <SelectionSetChipPicker
                                  options={scopedCategories.map((category) => ({ value: category, label: category }))}
                                  selected={selectionSetDraft.categories}
                                  onToggle={(value) => toggleSelectionSetDraftArray('categories', value)}
                                  emptyMessage="No categories available in the selected model scope."
                                  aria-invalid={Boolean(selectionSetFormErrors.scope)}
                                />
                              )}
                            </div>
                            <div>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-medium text-[#364153]">Types</span>
                                {selectionSetDraft.types.length > 0 && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-[11px] font-medium text-[#155DFC] no-underline"
                                    onClick={() => patchSelectionSetDraft({ types: [] })}
                                  >
                                    Clear ({selectionSetDraft.types.length})
                                  </Button>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-[#6A7282]">Filter by element type (e.g. Wall, Duct).</p>
                              {selectionSetDraft.categories.length === 0 ? (
                                <p className="mt-1 text-xs text-[#6A7282]">Select at least one category first to load types.</p>
                              ) : (
                                <SelectionSetChipPicker
                                  options={scopedTypes.map((type) => ({ value: type, label: type }))}
                                  selected={selectionSetDraft.types}
                                  onToggle={(value) => toggleSelectionSetDraftArray('types', value)}
                                  emptyMessage="No types available for the selected model/category scope."
                                  aria-invalid={Boolean(selectionSetFormErrors.scope)}
                                />
                              )}
                            </div>
                            {selectionSetFormErrors.scope && (
                              <p className="text-xs text-red-600">{selectionSetFormErrors.scope}</p>
                            )}
                          </div>
                          <label className="mt-3 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-ss-include`}>
                            Manual include IDs
                          </label>
                          <p className="mt-0.5 text-[11px] text-[#6A7282]">
                            Comma, semicolon, or new line. Use suggestions below or type to match loaded objects (first 200 in autocomplete).
                          </p>
                          <Input
                            id={`${sidebarPanelId}-ss-include`}
                            className="mt-1 rounded-lg border-[#D1D5DC] font-mono text-xs"
                            placeholder="e.g. obj-101, obj-202"
                            list={objectIdDatalistId}
                            value={selectionSetDraft.manualIncludeIds}
                            onChange={(event) => patchSelectionSetDraft({ manualIncludeIds: event.target.value })}
                          />
                          <ManualIdSuggestions
                            label="Suggestions — add to include"
                            ids={suggestedManualObjectIds}
                            onPick={appendManualIncludeId}
                          />
                          <label className="mt-2 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-ss-exclude`}>
                            Manual exclude IDs
                          </label>
                          <p className="mt-0.5 text-[11px] text-[#6A7282]">
                            Removes specific objects after filters apply. Same separators as include.
                          </p>
                          <Input
                            id={`${sidebarPanelId}-ss-exclude`}
                            className="mt-1 rounded-lg border-[#D1D5DC] font-mono text-xs"
                            placeholder="IDs to force out of this set"
                            list={objectIdDatalistId}
                            value={selectionSetDraft.manualExcludeIds}
                            onChange={(event) => patchSelectionSetDraft({ manualExcludeIds: event.target.value })}
                          />
                          <ManualIdSuggestions
                            label="Suggestions — add to exclude"
                            ids={suggestedManualObjectIds}
                            onPick={appendManualExcludeId}
                          />
                          <SidebarActionBanner banner={selectionSetActionBanner} />
                          <Button
                            type="button"
                            disabled={saveSelectionSet.isPending}
                            onClick={() => void saveSelectionSetDraft()}
                            className={cn(
                              'mt-3 w-full rounded-lg',
                              saveSelectionSet.isPending ? 'bg-blue-300 hover:bg-blue-300' : 'bg-[#155DFC] hover:bg-blue-700'
                            )}
                          >
                            {saveSelectionSet.isPending ? 'Saving…' : 'Save Selection Set'}
                          </Button>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {sidebarTab === 'results' && (
                  <div className="space-y-4">
                    {runPayload?.run && (
                      <p className="text-[11px] text-[#6A7282]">Scope: {runPayload.run.scope}</p>
                    )}
                    <Input className="rounded-lg border-[#D1D5DC] text-sm" placeholder="Search clash results…" value={search} onChange={(event) => setSearch(event.target.value)} />
                    {shouldHighlightActiveScope && !viewerClash && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setHideUnrelatedToActiveTest((current) => !current)}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-sm font-medium',
                          hideUnrelatedToActiveTest
                            ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC] hover:bg-[#EFF6FF]'
                            : 'border-[#D1D5DC] bg-white text-[#364153] hover:bg-gray-50'
                        )}
                      >
                        {hideUnrelatedToActiveTest ? 'Show all objects' : 'Focus on test sets (A/B)'}
                      </Button>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(['all', 'new', 'reviewed', 'resolved'] as const).map((filter) => (
                        <Button key={filter} type="button" variant={statusFilter === filter ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(filter)} className={cn('h-auto rounded-full px-2.5 py-1 text-xs font-normal', statusFilter === filter ? 'bg-[#155DFC] hover:bg-[#155DFC]' : 'border-[#D1D5DC]')}>
                          {filter}
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {filteredResults.map((result: ClashResult) => (
                        <Button
                          key={result.clashId}
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setSelectedClashId(result.clashId);
                            setShowClashInMainViewer(true);
                          }}
                          className={cn(
                            'h-auto w-full justify-start rounded-lg border p-2.5 text-left font-normal hover:bg-inherit',
                            selectedClashId === result.clashId ? 'border-[#155DFC] bg-[#EFF6FF]' : 'border-[#E5E7EB] bg-white'
                          )}
                        >
                          <div className="flex w-full flex-col gap-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-[#101828]">{result.title}</span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'shrink-0 border-0 px-2 py-0.5 text-[10px] font-medium',
                                  result.status === 'resolved'
                                    ? 'bg-[#D1FAE5] text-[#047857]'
                                    : result.status === 'reviewed'
                                      ? 'bg-[#FEF3C7] text-[#B45309]'
                                      : 'bg-[#DBEAFE] text-[#1D4ED8]'
                                )}
                              >
                                {result.status}
                              </Badge>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-[#6A7282]">
                              <span>{result.type}</span>
                              <span>{result.objectAModel}</span>
                              <span>{result.objectBModel}</span>
                            </div>
                          </div>
                        </Button>
                      ))}
                      {!resultsQuery.isLoading && filteredResults.length === 0 && (
                        <div className="rounded-lg border border-dashed border-[#D1D5DC] bg-[#F9FAFB] p-3 text-sm text-[#6A7282]">
                          <p>No clash results for the current test.</p>
                          {persistedHiddenObjects.length > 0 && (
                            <p className="mt-1 text-xs text-amber-800">Persisted hidden objects may reduce results.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#E5E7EB] pt-4">
                      <h3 className="text-sm font-semibold text-[#101828]">Inspector</h3>
                      {!selectedResult && <p className="mt-2 text-sm text-[#6A7282]">Select a clash to inspect.</p>}
                      {selectedResult && (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-lg bg-[#F9FAFB] p-2.5">
                            <p className="text-sm font-medium text-[#101828]">{selectedResult.title}</p>
                            <p className="mt-0.5 text-xs text-[#6A7282]">{selectedResult.type} · Distance {selectedResult.distance.toFixed(2)} m</p>
                            <p className="mt-1.5 text-[11px] leading-snug text-[#6A7282]">
                              {(() => {
                                if (selectedResult.status === 'resolved') return 'Resolved.';
                                if (selectedResult.status === 'reviewed') {
                                  return 'Reviewed — opened in the inspector or details were saved.';
                                }
                                if (
                                  selectedResult.status === 'new' &&
                                  runPayload?.run &&
                                  selectedResult.runId === runPayload.run.id
                                ) {
                                  return 'New — from the latest test run. Becomes Reviewed shortly after you open it here.';
                                }
                                if (selectedResult.status === 'new') return 'New — pending review.';
                                return '';
                              })()}
                            </p>
                          </div>
                          {(() => {
                            const aHidden = Boolean(allObjects.find((o) => o.id === selectedResult.objectA)?.hidden);
                            const bHidden = Boolean(allObjects.find((o) => o.id === selectedResult.objectB)?.hidden);
                            return (
                              <div className="grid gap-2">
                                <div className={cn('rounded-lg border p-2.5', aHidden ? 'border-amber-200 bg-amber-50/50' : 'border-[#E5E7EB]')}>
                                  <p className="text-xs text-[#6A7282]">Object A</p>
                                  <p className="text-sm font-medium text-[#101828]">{selectedResult.objectA}</p>
                                  <p className="text-xs text-[#6A7282]">{selectedResult.objectAType} · {selectedResult.objectAModel}</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void (aHidden ? showObjects([selectedResult.objectA]) : hideObject(selectedResult.objectA))}
                                    className={cn(
                                      'mt-2 h-auto rounded-md px-2 py-1 text-xs font-normal',
                                      aHidden
                                        ? 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        : 'border-[#D1D5DC] bg-white text-[#364153] hover:bg-gray-50'
                                    )}
                                  >
                                    {aHidden ? 'Show A' : 'Hide A'}
                                  </Button>
                                </div>
                                <div className={cn('rounded-lg border p-2.5', bHidden ? 'border-amber-200 bg-amber-50/50' : 'border-[#E5E7EB]')}>
                                  <p className="text-xs text-[#6A7282]">Object B</p>
                                  <p className="text-sm font-medium text-[#101828]">{selectedResult.objectB}</p>
                                  <p className="text-xs text-[#6A7282]">{selectedResult.objectBType} · {selectedResult.objectBModel}</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void (bHidden ? showObjects([selectedResult.objectB]) : hideObject(selectedResult.objectB))}
                                    className={cn(
                                      'mt-2 h-auto rounded-md px-2 py-1 text-xs font-normal',
                                      bHidden
                                        ? 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        : 'border-[#D1D5DC] bg-white text-[#364153] hover:bg-gray-50'
                                    )}
                                  >
                                    {bHidden ? 'Show B' : 'Hide B'}
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                          <Textarea
                            rows={3}
                            className="rounded-lg border-[#D1D5DC] text-sm focus-visible:border-[#155DFC]"
                            placeholder="Coordination note"
                            value={noteDraft}
                            maxLength={INSPECTOR_NOTE_MAX_LEN}
                            onChange={(event) => {
                              clearInspectorActionBanner();
                              setNoteDraft(event.target.value);
                            }}
                          />
                          <div>
                            <label className="mb-1 block text-xs font-medium text-[#6A7282]" htmlFor="clash-assignee-select">
                              Assignee
                            </label>
                            <select
                              id="clash-assignee-select"
                              className="w-full rounded-lg border border-[#D1D5DC] bg-white px-3 py-2 text-sm outline-none focus:border-[#155DFC]"
                              value={assigneeDraft}
                              onChange={(event) => {
                                clearInspectorActionBanner();
                                setAssigneeDraft(event.target.value);
                              }}
                            >
                              <option value="Unassigned">Unassigned</option>
                              {!assigneeKnownOption && assigneeDraft !== 'Unassigned' && (
                                <option value={assigneeDraft}>{assigneeDraft} (stored value)</option>
                              )}
                              {projectMembers.map((member) => {
                                const label = memberLabel(member);
                                return (
                                  <option key={member.userId} value={label}>
                                    {label}
                                    {member.role ? ` · ${member.role}` : ''}
                                  </option>
                                );
                              })}
                            </select>
                            {projectMembersLoading && (
                              <p className="mt-1 text-[11px] text-[#6A7282]">Loading project members…</p>
                            )}
                            {!projectMembersLoading && projectMembers.length === 0 && (
                              <p className="mt-1 text-[11px] text-[#6A7282]">No members returned for this project; you can still use Unassigned or a stored assignee.</p>
                            )}
                          </div>
                          <SidebarActionBanner banner={inspectorActionBanner} />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void saveClashInspectorDetails()}
                            disabled={updateClashStatus.isPending}
                            className={cn(
                              'w-full rounded-lg border-[#155DFC] px-3 py-2.5 text-sm font-medium text-[#155DFC] hover:bg-[#EFF6FF]',
                              updateClashStatus.isPending && 'cursor-wait opacity-70'
                            )}
                          >
                            {updateClashStatus.isPending ? 'Saving…' : 'Save note and assignee'}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setResolveDialogOpen(true)}
                            disabled={selectedResult.status === 'resolved'}
                            className={cn(
                              'w-full rounded-lg bg-[#009966] hover:bg-emerald-700',
                              selectedResult.status === 'resolved' && 'bg-emerald-300 hover:bg-emerald-300'
                            )}
                          >
                            {selectedResult.status === 'resolved' ? 'Resolved' : 'Mark as resolved'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {sidebarTab === 'report' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#6A7282]">Export clash data or the federated model (JSON/CSV/BCF).</p>
                    <SidebarActionBanner banner={exportActionBanner} />
                    <Button type="button" variant="outline" onClick={() => void exportCurrent('json')} className="w-full border-[#D1D5DC] py-2">Export JSON</Button>
                    <Button type="button" variant="outline" onClick={() => void exportCurrent('csv')} className="w-full border-[#D1D5DC] py-2">Export CSV</Button>
                    <Button type="button" variant="outline" onClick={() => void exportCurrent('bcf')} className="w-full border-[#D1D5DC] py-2">Export BCF</Button>
                    <Button type="button" variant="outline" onClick={() => void exportCurrent('model')} className="w-full border-[#D1D5DC] py-2">Export federated model</Button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main
            className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white"
            onDragOver={handleStageDragOver}
            onDragLeave={handleStageDragLeave}
            onDrop={handleStageDrop}
          >
            {models.length > 0 && (
              <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2 md:left-4 md:right-4">
                <div className="pointer-events-auto max-w-[min(100%,20rem)] rounded-lg border border-[#E5E7EB] bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
                  <p className="truncate text-xs font-medium text-[#101828]">{selectedTest?.name || 'No test'}</p>
                  <p className="text-[11px] text-[#6A7282]">
                    {runPayload?.run
                      ? `${new Date(runPayload.run.completedAt).toLocaleString()} · ${runPayload.run.summary.total} clashes`
                      : 'Run a test from the sidebar.'}
                  </p>
                </div>
                <div className="pointer-events-auto flex items-center gap-2">
                  {viewerClash && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedClashId(null);
                        setShowClashInMainViewer(false);
                      }}
                      className="gap-1 border-[#E5E7EB] bg-white/95 px-3 py-1.5 text-xs font-medium text-[#364153] shadow-sm backdrop-blur-sm hover:bg-gray-50"
                    >
                      ← View all objects
                    </Button>
                  )}
                  <div className="flex rounded-lg border border-[#E5E7EB] bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlaneView('2d')}
                      className={cn('h-8 rounded-md px-3 text-xs font-medium', planeView === '2d' ? 'bg-[#155DFC] text-white hover:bg-[#155DFC] hover:text-white' : 'text-[#4A5565] hover:bg-[#F3F4F6]')}
                    >
                      2D
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlaneView('3d')}
                      className={cn('h-8 rounded-md px-3 text-xs font-medium', planeView === '3d' ? 'bg-[#155DFC] text-white hover:bg-[#155DFC] hover:text-white' : 'text-[#4A5565] hover:bg-[#F3F4F6]')}
                    >
                      3D
                    </Button>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* <button
                        type="button"
                        className="rounded-lg border border-[#E5E7EB] bg-white/95 p-2 shadow-sm backdrop-blur-sm text-[#364153] hover:bg-gray-50"
                        aria-expanded={sidebarOpen}
                        aria-controls={sidebarPanelId}
                        onClick={() => {
                          setSidebarOpen(true);
                          setSidebarTab('select');
                        }}
                      >
                        <PanelLeft className="size-5" aria-hidden />
                      </button> */}
                    </TooltipTrigger>
                    <TooltipContent side="left">Open sidebar</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {models.length === 0 && (
              <div className={cn(
                'absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#F9FAFB] p-6 text-center transition-colors',
                dragActive && 'bg-[#EFF6FF]'
              )}>
                <p className="text-sm font-medium text-[#101828]">No models imported yet</p>
                <p className="max-w-sm text-xs text-[#6A7282]">Import IFC files from this project's Documents to start detecting clashes.</p>
                <Button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="rounded-lg bg-[#155DFC] hover:bg-blue-700"
                >
                  Import from Documents
                </Button>
              </div>
            )}

            {dragActive && models.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-[#155DFC]/10">
                <p className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#155DFC] shadow-md">Drop to import</p>
              </div>
            )}

            {zeroClashesAfterRun && models.length > 0 && (
              <div
                className="pointer-events-none absolute left-3 right-3 top-[4.25rem] z-[11] md:left-4 md:right-4 md:top-[4.5rem]"
                role="status"
              >
                <div className="mx-auto max-w-2xl rounded-lg border border-amber-200/90 bg-amber-50/95 px-3 py-2 text-center shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-medium text-amber-950">
                    Test completed — no clashes detected (0 clashes).
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-900/90">
                    The viewer shows a model overview; no pairs are marked as intersecting.
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-900/90">
                    Note: overview uses simplified preview solids, so visual overlap may appear without qualifying as a clash by test rules.
                  </p>
                </div>
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col pt-14 md:pt-16">
              {planeView === '2d' ? (
                <div className="flex min-h-0 flex-1 flex-col bg-[#F9FAFB] p-1.5 md:p-2">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#D1D5DC] bg-white">
                    <Viewer2D
                      clash={viewerClash}
                      selectedObjectId={selectedObjectId}
                      onSelectObject={setSelectedObjectId}
                      hiddenObjectIds={viewerHiddenObjectIds}
                      overviewScene={overviewSceneForViewer}
                      allowObjectMove={false}
                      objectMeshPositions={objectMeshPositionsForViewer}
                      testScopeObjectIds={activeTestScopeObjectIds}
                      deEmphasizeUnrelated={shouldHighlightActiveScope}
                      showScopeBadge={shouldHighlightActiveScope}
                      hideUnrelatedActive={hideUnrelatedToActiveTest}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col bg-[#111827] p-1.5 md:p-2">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-700 bg-[#111827]">
                    <Viewer3D
                      clash={viewerClash}
                      selectedObjectId={selectedObjectId}
                      onSelectObject={setSelectedObjectId}
                      hiddenObjectIds={viewerHiddenObjectIds}
                      overviewScene={overviewSceneForViewer}
                      allowObjectMove={false}
                      testScopeObjectIds={activeTestScopeObjectIds}
                      deEmphasizeUnrelated={shouldHighlightActiveScope}
                      showScopeBadge={shouldHighlightActiveScope}
                      hideUnrelatedActive={hideUnrelatedToActiveTest}
                      objectMeshPositions={objectMeshPositionsForViewer}
                      clashMeshOriginWorld={clashMeshOriginWorld}
                    />
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      <AlertDialog open={runTestDialogOpen} onOpenChange={setRunTestDialogOpen}>
        <AlertDialogContent className="border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Run clash test?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6A7282]">
              This will execute the selected test against the current federated model. Large models may take a few moments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D1D5DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#155DFC] text-white hover:bg-blue-700"
              onClick={() => void executeRunTest()}
            >
              Run test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <AlertDialogContent className="border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark clash as resolved?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6A7282]">
              The current note and assignee will be saved with this status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D1D5DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#009966] text-white hover:bg-emerald-700"
              onClick={() => {
                setResolveDialogOpen(false);
                void markSelectedClashResolved();
              }}
            >
              Mark resolved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingDeleteTestId !== null} onOpenChange={(open: boolean) => !open && setPendingDeleteTestId(null)}>
        <AlertDialogContent className="border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete clash test?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6A7282]">
              This removes the test and its stored run history for this project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D1D5DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#DC2626] text-white hover:bg-red-700" onClick={() => void confirmDeleteClashTest()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingDeleteSetId !== null} onOpenChange={(open: boolean) => !open && setPendingDeleteSetId(null)}>
        <AlertDialogContent className="border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selection set?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6A7282]">
              Clash tests that reference this set may need to be updated. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D1D5DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#DC2626] text-white hover:bg-red-700" onClick={() => void confirmDeleteSelectionSet()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-xl border-[#E5E7EB] p-0 sm:max-w-lg [&_[data-slot=dialog-close]]:hidden">
          <DialogHeader className="flex flex-row items-start justify-between space-y-0 border-b border-[#E5E7EB] px-5 py-4 text-left">
            <div className="min-w-0 space-y-1 pr-2">
              <DialogTitle className="text-base font-semibold text-[#101828]">Import IFC from Documents</DialogTitle>
              <DialogDescription className="text-xs text-[#6A7282]">
                Select IFC files uploaded to this project
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-[#6A7282]"
              onClick={() => setImportModalOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {ifcDocumentsQuery.isLoading && (
              <p className="py-8 text-center text-sm text-[#6A7282]">Loading IFC files…</p>
            )}
            {ifcDocumentsQuery.isError && (
              <p className="py-8 text-center text-sm text-red-500">Failed to load documents.</p>
            )}
            {ifcDocumentsQuery.data && ifcDocumentsQuery.data.length === 0 && (
              <p className="py-8 text-center text-sm text-[#6A7282]">
                No IFC files found in this project's documents.
                <br />
                <span className="text-xs">Upload IFC files via the Documents tab first.</span>
              </p>
            )}
            {ifcDocumentsQuery.data && ifcDocumentsQuery.data.length > 0 && (
              <div className="space-y-1.5">
                {ifcDocumentsQuery.data.map((doc) => {
                  const checked = selectedDocIds.has(doc.publicId);
                  const sizeKb = Math.round(doc.size / 1024);
                  return (
                    <label
                      key={doc.publicId}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        checked ? 'border-[#155DFC] bg-[#EFF6FF]' : 'border-[#E5E7EB] hover:bg-gray-50'
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value: boolean | 'indeterminate') => {
                          setSelectedDocIds((prev) => {
                            const next = new Set(prev);
                            if (value === true) next.add(doc.publicId);
                            else next.delete(doc.publicId);
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#101828]">{doc.originalName}</p>
                        <p className="mt-0.5 text-xs text-[#6A7282]">
                          {doc.folderPath || 'Root'} · {sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t border-[#E5E7EB] px-5 py-3 sm:flex-row sm:justify-between">
            <p className="text-xs text-[#6A7282]">
              {selectedDocIds.size > 0 ? `${selectedDocIds.size} file${selectedDocIds.size > 1 ? 's' : ''} selected` : 'No files selected'}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" onClick={() => setImportModalOpen(false)} className="border-[#D1D5DC]">
                Cancel
              </Button>
              <Button
                type="button"
                disabled={selectedDocIds.size === 0 || importFromDocuments.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    const result = await importFromDocuments.mutateAsync({ documentIds: Array.from(selectedDocIds) });
                    setImportModalOpen(false);
                    setSidebarOpen(true);
                    setSidebarTab('select');
                    const skipped: string[] = result?.skippedFiles ?? [];
                    const imported = selectedDocIds.size - skipped.length;
                    if (skipped.length > 0) {
                      toast.warning(`Imported ${imported} file${imported !== 1 ? 's' : ''}. Skipped ${skipped.length} (too large or corrupt): ${skipped.join(', ')}`);
                    } else {
                      toast.success(`Imported ${imported} file${imported !== 1 ? 's' : ''}.`);
                    }
                  } catch (importErr) {
                    const msg = importErr instanceof Error ? importErr.message : 'Failed to import';
                    setError(msg);
                    toast.error(msg);
                  }
                }}
                className="bg-[#155DFC] hover:bg-blue-700 disabled:opacity-50"
              >
                {importFromDocuments.isPending ? 'Importing…' : 'Import Selected'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>

  );
}
