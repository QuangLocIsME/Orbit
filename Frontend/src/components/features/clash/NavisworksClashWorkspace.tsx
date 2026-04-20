'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  FlaskConical,
  FolderTree,
  ListChecks,
  PanelLeft,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/config/api';
import { apiFetch } from '@/lib/api-client';
import Viewer2D from '../clash/viewer/Viewer2D';
import Viewer3D from '../clash/viewer/Viewer3D';
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

/** Soft clash gap / clearance — meters (common BIM values). */
const CLASH_SOFT_THRESHOLD_PRESETS_M = ['0', '0.01', '0.025', '0.05', '0.1', '0.25'] as const;
/** Near-duplicate AABB match — meters. */
const CLASH_DUPLICATE_TOLERANCE_PRESETS_M = ['0.0001', '0.001', '0.005', '0.01'] as const;

const INSPECTOR_NOTE_MAX_LEN = 8000;

type ClashTestFormErrors = Partial<
  Record<'name' | 'setAId' | 'setBId' | 'softThreshold' | 'duplicateTolerance', string>
>;

type SelectionSetFormErrors = Partial<Record<'name' | 'scope', string>>;

type ActionBanner = { variant: 'success' | 'error' | 'warning'; message: string };

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
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={cn(
                'max-w-full truncate rounded-full border px-2.5 py-1 text-left text-[11px] font-medium transition-colors',
                on ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]' : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50'
              )}
            >
              {opt.label}
            </button>
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
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="max-w-[min(100%,12rem)] truncate rounded border border-[#E5E7EB] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#364153] hover:border-[#155DFC] hover:bg-[#EFF6FF]"
            title={id}
          >
            {id}
          </button>
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
  onBack?: () => void;
  /** From landing "View 3D" — selects this clash test and row in Results */
  initialTestId?: string | null;
  initialClashId?: string | null;
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

export default function NavisworksClashWorkspace({
  projectSlug,
  onBack,
  initialTestId = null,
  initialClashId = null,
}: NavisworksClashWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarPanelId = useId();
  const objectIdDatalistId = useId();
  const openFromLanding = Boolean(initialTestId ?? initialClashId);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(() => initialTestId ?? null);
  const [selectedClashId, setSelectedClashId] = useState<string | null>(() => initialClashId ?? null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [planeView, setPlaneView] = useState<'2d' | '3d'>('3d');
  const [sidebarOpen, setSidebarOpen] = useState(() => openFromLanding);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => (openFromLanding ? 'results' : 'select'));
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
  const [showClashInMainViewer, setShowClashInMainViewer] = useState(() => openFromLanding);

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
    quietUpdateClashStatus,
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
      setShowClashInMainViewer(true);
    }
  }, [selectedTestId, workspace?.clashTests]);

  useEffect(() => {
    if (!workspace?.clashTests?.length || !selectedTestId) return;
    const exists = workspace.clashTests.some((t) => t.id === selectedTestId);
    if (!exists) {
      setSelectedTestId(workspace.clashTests[0].id);
      setSelectedClashId(null);
    }
  }, [workspace?.clashTests, selectedTestId]);

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
    /** Empty `results` usually means results query still loading — do not treat as "clash missing" or we wipe deep-link `initialClashId` and fall back to the first row when data arrives. */
    if (
      selectedClashId &&
      results.length > 0 &&
      !results.some((result) => result.clashId === selectedClashId)
    ) {
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

  const selectedResult = filteredResults.find((result) => result.clashId === selectedClashId)
    ?? results.find((result) => result.clashId === selectedClashId)
    ?? null;
  const showScopeDrivenOverview = shouldHighlightActiveScope && showClashInMainViewer;
  const viewerClash =
    showClashInMainViewer && selectedResult ? resultToViewerClash(selectedResult) : null;

  /** Models served as XKT use xeokit mesh; skip per-element box/mesh overlay in 3D to avoid double geometry. */
  const modelIdsWithXkt = useMemo(
    () =>
      new Set(models.filter((m) => m.sourceFormat === 'xkt' && m.xktFile).map((m) => m.id)),
    [models]
  );

  const objectsForOverviewScene3d = useMemo(
    () => allObjects.filter((o) => !modelIdsWithXkt.has(o.sourceModelId)),
    [allObjects, modelIdsWithXkt]
  );

  const federatedOverviewScene3d = useMemo(
    () =>
      buildOverviewSceneFromFederated(objectsForOverviewScene3d, {
        hiddenModelIds,
        hiddenCategories,
        maxObjects: objectsForOverviewScene3d.length,
      }),
    [objectsForOverviewScene3d, hiddenCategories, hiddenModelIds]
  );

  /** 2D plan view uses bbox from federated metadata (still stored for IFC→XKT imports); not filtered by XKT. */
  const federatedOverviewScene2d = useMemo(
    () =>
      buildOverviewSceneFromFederated(allObjects, {
        hiddenModelIds,
        hiddenCategories,
        maxObjects: allObjects.length,
      }),
    [allObjects, hiddenCategories, hiddenModelIds]
  );

  const overviewSceneForViewer =
    !viewerClash && models.length > 0 ? federatedOverviewScene3d : undefined;

  const overviewSceneForViewer2d =
    !viewerClash && models.length > 0 ? federatedOverviewScene2d : undefined;

  const xktModelsForViewer = useMemo(
    () =>
      models
        .filter((m) => m.sourceFormat === 'xkt' && m.xktFile)
        .map((m) => ({ id: m.id })),
    [models]
  );

  const hasXktOnlyOverview = Boolean(
    !viewerClash &&
      models.length > 0 &&
      federatedOverviewScene2d.length === 0 &&
      xktModelsForViewer.length > 0
  );

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
  }, [
    clearInspectorActionBanner,
    normalizeAssigneeForDisplay,
    selectedResult?.assignee,
    selectedResult?.clashId,
    selectedResult?.note,
    selectedResult?.status,
  ]);

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

  const acceptImport = '.ifc,.json,.xkt,application/json,application/octet-stream';

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
        file.name.toLowerCase().endsWith('.xkt') ||
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
  const markSelectedClashResolved = () => {
    if (!selectedResult) return;
    setError(null);
    updateClashStatus.mutate(
      {
        clashId: selectedResult.clashId,
        sourceTestId: selectedResult.sourceTestId,
        status: 'resolved',
        note: noteDraft,
        assignee: assigneeDraft,
      },
      {
        onSuccess: () => toast.success('Clash marked as resolved.'),
        onError: (statusError) => {
          const msg =
            statusError instanceof Error ? statusError.message : 'Failed to update clash status';
          setError(msg);
          toast.error(msg);
        },
      }
    );
  };

  /** After a short delay, opening a New clash in the inspector promotes it to Reviewed (no toast). Uses quietUpdateClashStatus so the Save button is not stuck on "Saving…" from shared isPending. */
  useEffect(() => {
    if (!showClashInMainViewer || !selectedResult || selectedResult.status !== 'new') return;
    const { clashId } = selectedResult;
    const sourceTestId = selectedResult.sourceTestId;
    const timer = window.setTimeout(() => {
      void quietUpdateClashStatus
        .mutateAsync({ clashId, status: 'reviewed', sourceTestId })
        .catch(() => {
          /* ignore — e.g. permission */
        });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [
    selectedResult?.clashId,
    selectedResult?.sourceTestId,
    selectedResult?.status,
    showClashInMainViewer,
    quietUpdateClashStatus,
  ]);

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
        sourceTestId: selectedResult.sourceTestId,
        note: noteTrim,
        assignee: assigneeTrim,
        ...(selectedResult.status !== 'resolved' ? { status: 'reviewed' as const } : {}),
      });
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

  const hideObject = (objectId: string) => {
    setError(null);
    applyObjectActions.mutate(
      { action: 'hide', objectIds: [objectId] },
      {
        onSuccess: () => toast.success('Object hidden for clash tests.'),
        onError: (hideError) => {
          const msg = hideError instanceof Error ? hideError.message : 'Failed to hide object';
          setError(msg);
          toast.error(msg);
        },
      }
    );
  };

  const showObjects = (objectIds: string[]) => {
    if (objectIds.length === 0) return;
    setError(null);
    applyObjectActions.mutate(
      { action: 'show', objectIds },
      {
        onSuccess: () =>
          toast.success(`${objectIds.length} object${objectIds.length === 1 ? '' : 's'} shown again.`),
        onError: (showError) => {
          const msg = showError instanceof Error ? showError.message : 'Failed to show objects';
          setError(msg);
          toast.error(msg);
        },
      }
    );
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
    const hadSelection = selectedTestId === id;
    const prevClashId = selectedClashId;
    const prevShowViewer = showClashInMainViewer;
    try {
      setError(null);
      /** Unsubscribe from results query before DELETE + workspace invalidation, or GET /results for this id races and returns "Clash test not found". */
      flushSync(() => {
        if (hadSelection) {
          setSelectedTestId(null);
          setSelectedClashId(null);
          setShowClashInMainViewer(false);
        }
      });
      await deleteClashTest.mutateAsync(id);
      toast.success('Clash test deleted.');
    } catch (deleteError) {
      if (hadSelection) {
        flushSync(() => {
          setSelectedTestId(id);
          setSelectedClashId(prevClashId);
          setShowClashInMainViewer(prevShowViewer);
        });
      }
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

  const pickTab = (tab: SidebarTab) => {
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setSidebarTab(tab);
    }
  };

  const tabBtn = (tab: SidebarTab) =>
    cn(
      'shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
      sidebarTab === tab
        ? 'border-[#155DFC] text-[#155DFC]'
        : 'border-transparent text-[#6A7282] hover:text-[#364153] hover:border-[#D1D5DC]'
    );

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={cn(
          'flex h-[calc(100dvh-7.5rem)] min-h-[520px] flex-col',
          '[&_button]:transition-[transform,filter] [&_button]:duration-100',
          '[&_button]:active:scale-[0.98] [&_button]:active:brightness-[0.93]',
          '[&_button:disabled]:pointer-events-none [&_button:disabled]:active:scale-100 [&_button:disabled]:active:brightness-100',
          'motion-reduce:[&_button]:active:scale-100'
        )}
      >
        {/* ── Top header bar ── */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#E5E7EB] bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-[#4A5565] hover:bg-[#F3F4F6] transition-colors"
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
            )}
            <h2 className="text-base font-semibold text-[#101828]">Clash Detection</h2>
            {error && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#B91C1C]">
                <svg className="size-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                Error
              </span>
            )}
            {persistedHiddenObjects.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                {persistedHiddenObjects.length} hidden
                <button type="button" onClick={() => void resetHiddenObjects()} className="ml-0.5 underline underline-offset-1">Reset</button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setSelectedDocIds(new Set()); setImportModalOpen(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#155DFC] px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Upload className="size-4" aria-hidden />
            Import
          </button>
        </div>

        {error && (
          <div className="shrink-0 border-b border-[#FECACA] bg-[#FEF2F2] px-5 py-2.5 text-sm text-[#B91C1C]">
            {error}
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#F9FAFB]">
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close sidebar"
              className="fixed inset-0 z-40 bg-black/35 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <nav
            className="relative z-10 flex min-h-0 w-12 shrink-0 flex-col items-center gap-1 self-stretch overflow-y-auto border-r border-[#E5E7EB] bg-white py-2"
            aria-label="Activity bar"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex size-10 items-center justify-center rounded-md text-[#364153] hover:bg-white/80',
                    sidebarOpen && 'bg-white shadow-sm'
                  )}
                  aria-expanded={sidebarOpen}
                  aria-controls={sidebarPanelId}
                  onClick={() => {
                    if (sidebarOpen) setSidebarOpen(false);
                    else {
                      setSidebarOpen(true);
                      setSidebarTab('select');
                    }
                  }}
                >
                  <PanelLeft className="size-5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Toggle sidebar</TooltipContent>
            </Tooltip>
            <div className="my-1 h-px w-6 bg-[#D1D5DC]" role="presentation" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex size-10 items-center justify-center rounded-md',
                    sidebarOpen && sidebarTab === 'select' ? 'bg-[#155DFC] text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'select'}
                  onClick={() => pickTab('select')}
                >
                  <FolderTree className="size-5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Select · models &amp; sets</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex size-10 items-center justify-center rounded-md',
                    sidebarOpen && sidebarTab === 'tests' ? 'bg-[#155DFC] text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'tests'}
                  onClick={() => pickTab('tests')}
                >
                  <FlaskConical className="size-5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Tests</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex size-10 items-center justify-center rounded-md',
                    sidebarOpen && sidebarTab === 'results' ? 'bg-[#155DFC] text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'results'}
                  onClick={() => pickTab('results')}
                >
                  <ListChecks className="size-5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Results</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex size-10 items-center justify-center rounded-md',
                    sidebarOpen && sidebarTab === 'report' ? 'bg-[#155DFC] text-white' : 'text-[#364153] hover:bg-white/80'
                  )}
                  aria-pressed={sidebarOpen && sidebarTab === 'report'}
                  onClick={() => pickTab('report')}
                >
                  <FileText className="size-5" aria-hidden />
                </button>
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
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[#101828]">{selectedTest?.name || 'Clash Detective'}</p>
                  {runPayload?.run && (
                    <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-medium text-[#155DFC]">
                      {runPayload.run.summary.total} results
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1.5 text-[#6A7282] hover:bg-[#F3F4F6] md:hidden"
                  aria-label="Close panel"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
                {sidebarTab === 'tests' && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setRunTestDialogOpen(true)}
                      disabled={!selectedTestId || runClashTest.isPending}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors',
                        !selectedTestId || runClashTest.isPending ? 'cursor-not-allowed bg-[#93C5FD]' : 'bg-[#155DFC] hover:bg-blue-700'
                      )}
                    >
                      {runClashTest.isPending ? (
                        <>
                          <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          Running…
                        </>
                      ) : (
                        <>
                          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                          Run Selected Test
                        </>
                      )}
                    </button>
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
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingDeleteTestId(test.id);
                              }}
                              className="shrink-0 text-xs text-[#DC2626]"
                            >
                              Delete
                            </button>
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
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3">
                      <p className="mb-1 text-xs font-semibold text-[#364153]">New Clash Test</p>
                      <label className="mt-2 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-clash-test-name`}>
                        Test name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id={`${sidebarPanelId}-clash-test-name`}
                        required
                        aria-invalid={Boolean(clashTestFormErrors.name)}
                        aria-describedby={clashTestFormErrors.name ? `${sidebarPanelId}-err-name` : undefined}
                        className={cn(
                          'mt-1 w-full rounded-lg border px-3 py-2 text-sm',
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
                      <textarea
                        id={`${sidebarPanelId}-clash-test-desc`}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm"
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
                            <button
                              key={value}
                              type="button"
                              onClick={() => patchClashTestDraft({ softThreshold: value })}
                              className={cn(
                                'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                clashTestDraft.softThreshold === value
                                  ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]'
                                  : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F9FAFB]'
                              )}
                            >
                              {value} m
                            </button>
                          ))}
                        </div>
                        <input
                          id={`${sidebarPanelId}-soft-th`}
                          type="text"
                          inputMode="decimal"
                          aria-invalid={Boolean(clashTestFormErrors.softThreshold)}
                          className={cn(
                            'mt-2 w-full rounded-lg border px-3 py-2 text-sm',
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
                            <button
                              key={value}
                              type="button"
                              onClick={() => patchClashTestDraft({ duplicateTolerance: value })}
                              className={cn(
                                'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                clashTestDraft.duplicateTolerance === value
                                  ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]'
                                  : 'border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F9FAFB]'
                              )}
                            >
                              {value} m
                            </button>
                          ))}
                        </div>
                        <input
                          id={`${sidebarPanelId}-dup-tol`}
                          type="text"
                          inputMode="decimal"
                          aria-invalid={Boolean(clashTestFormErrors.duplicateTolerance)}
                          className={cn(
                            'mt-2 w-full rounded-lg border px-3 py-2 text-sm',
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
                      <button
                        type="button"
                        disabled={saveClashTest.isPending}
                        onClick={() => void saveClashTestDraft()}
                        className={cn(
                          'mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-white',
                          saveClashTest.isPending ? 'cursor-not-allowed bg-blue-300' : 'bg-[#155DFC] hover:bg-blue-700'
                        )}
                      >
                        {saveClashTest.isPending ? 'Saving…' : 'Save Clash Test'}
                      </button>
                    </div>
                  </div>
                )}

                {sidebarTab === 'select' && (
                  <div className="space-y-5">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#D1D5DC] bg-white py-2.5 text-sm text-[#364153] hover:bg-gray-50"
                    >
                      <Upload className="size-4" aria-hidden />
                      Import models
                    </button>
                    <section className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[#101828]">Model Tree</h3>
                          <p className="mt-0.5 text-xs text-[#6A7282]">Viewport visibility only.</p>
                        </div>
                        {persistedHiddenObjects.length > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                            {persistedHiddenObjects.length} hidden
                          </span>
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
                                  {model.sourceFormat === 'xkt' ? ' · XKT (3D viewer)' : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setHiddenModelIds((current) => toggleArrayValue(current, model.name))}
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-1 text-xs whitespace-nowrap',
                                  hiddenModelIds.includes(model.name) ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#ECFDF3] text-[#047857]'
                                )}
                              >
                                {hiddenModelIds.includes(model.name) ? 'Hidden' : 'Visible'}
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {model.categories.map((category) => (
                                <button
                                  key={`${model.id}-${category}`}
                                  type="button"
                                  onClick={() => setHiddenCategories((current) => toggleArrayValue(current, category))}
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-[11px]',
                                    hiddenCategories.includes(category)
                                      ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]'
                                      : 'border-[#E5E7EB] bg-white text-[#364153]'
                                  )}
                                >
                                  {category}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {persistedHiddenObjects.length > 0 && (
                          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6A7282]">Persisted hidden</p>
                              <button type="button" onClick={() => void resetHiddenObjects()} className="text-xs font-medium text-[#155DFC]">Show all</button>
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {persistedHiddenObjects.map((object) => (
                                <div key={object.id} className="flex items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-[#101828]">{object.id}</p>
                                    <p className="truncate text-[11px] text-[#6A7282]">{object.type} · {object.sourceModel}</p>
                                  </div>
                                  <button type="button" onClick={() => void showObjects([object.id])} className="shrink-0 rounded border border-[#D1D5DC] px-2 py-1 text-[11px] text-[#364153]">Show</button>
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
                              <button type="button" onClick={() => setPendingDeleteSetId(selectionSet.id)} className="shrink-0 text-xs text-[#DC2626]">Delete</button>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3">
                          <p className="mb-1 text-xs font-semibold text-[#364153]">New Selection Set</p>
                          <datalist id={objectIdDatalistId}>
                            {objectIdDatalistOptions.map((id) => (
                              <option key={id} value={id} />
                            ))}
                          </datalist>
                          <label className="mt-2 block text-xs font-medium text-[#364153]" htmlFor={`${sidebarPanelId}-ss-name`}>
                            Name <span className="text-red-600">*</span>
                          </label>
                          <input
                            id={`${sidebarPanelId}-ss-name`}
                            className={cn(
                              'mt-1 w-full rounded-lg border px-3 py-2 text-sm',
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
                          <textarea
                            id={`${sidebarPanelId}-ss-desc`}
                            className="mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm"
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
                                  <button
                                    type="button"
                                    className="text-[11px] font-medium text-[#155DFC]"
                                    onClick={() => patchSelectionSetDraft({ modelIds: [], categories: [], types: [] })}
                                  >
                                    Clear ({selectionSetDraft.modelIds.length})
                                  </button>
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
                                  <button
                                    type="button"
                                    className="text-[11px] font-medium text-[#155DFC]"
                                    onClick={() => patchSelectionSetDraft({ categories: [], types: [] })}
                                  >
                                    Clear ({selectionSetDraft.categories.length})
                                  </button>
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
                                  <button
                                    type="button"
                                    className="text-[11px] font-medium text-[#155DFC]"
                                    onClick={() => patchSelectionSetDraft({ types: [] })}
                                  >
                                    Clear ({selectionSetDraft.types.length})
                                  </button>
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
                          <input
                            id={`${sidebarPanelId}-ss-include`}
                            className="mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 font-mono text-xs"
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
                          <input
                            id={`${sidebarPanelId}-ss-exclude`}
                            className="mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 font-mono text-xs"
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
                          <button
                            type="button"
                            disabled={saveSelectionSet.isPending}
                            onClick={() => void saveSelectionSetDraft()}
                            className={cn(
                              'mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-white',
                              saveSelectionSet.isPending ? 'cursor-not-allowed bg-blue-300' : 'bg-[#155DFC] hover:bg-blue-700'
                            )}
                          >
                            {saveSelectionSet.isPending ? 'Saving…' : 'Save Selection Set'}
                          </button>
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
                    <input className="w-full rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm" placeholder="Search clash results…" value={search} onChange={(event) => setSearch(event.target.value)} />
                    {shouldHighlightActiveScope && !viewerClash && (
                      <button
                        type="button"
                        onClick={() => setHideUnrelatedToActiveTest((current) => !current)}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                          hideUnrelatedToActiveTest
                            ? 'border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]'
                            : 'border-[#D1D5DC] bg-white text-[#364153] hover:bg-gray-50'
                        )}
                      >
                        {hideUnrelatedToActiveTest ? 'Show all objects' : 'Focus on test sets (A/B)'}
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'new', 'reviewed', 'resolved'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setStatusFilter(filter)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                            statusFilter === filter
                              ? 'border-[#155DFC] bg-[#155DFC] text-white shadow-sm shadow-blue-500/25'
                              : 'border-[#D1D5DC] bg-white text-[#6A7282] hover:border-[#9CA3AF] hover:text-[#374151]'
                          )}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {filteredResults.map((result: ClashResult) => (
                        <button
                          key={result.clashId}
                          type="button"
                          onClick={() => {
                            setSelectedClashId(result.clashId);
                            setShowClashInMainViewer(true);
                          }}
                          className={cn(
                            'group relative w-full rounded-xl border p-3.5 text-left transition-all duration-150',
                            selectedClashId === result.clashId
                              ? 'border-[#155DFC] bg-[#EFF6FF] shadow-md shadow-blue-500/10'
                              : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF] hover:shadow-md hover:shadow-gray-200/60'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#101828]">{result.title}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] text-[#6A7282]">
                                  <svg className="size-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  {result.type}
                                </span>
                                <span className="text-[#E5E7EB]">·</span>
                                <span className="text-[11px] text-[#6A7282]">{result.objectAModel}</span>
                                <span className="text-[#E5E7EB]">·</span>
                                <span className="text-[11px] text-[#6A7282]">{result.objectBModel}</span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <span className={cn(
                                'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                                result.status === 'resolved'
                                  ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60'
                                  : result.status === 'reviewed'
                                    ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60'
                                    : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/60'
                              )}>
                                {result.status}
                              </span>
                            </div>
                          </div>
                          <div className={cn(
                            'absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full transition-all duration-150',
                            selectedClashId === result.clashId ? 'bg-[#155DFC]' : 'bg-transparent group-hover:bg-[#D1D5DC]'
                          )} />
                        </button>
                      ))}
                      {!resultsQuery.isLoading && filteredResults.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DC] bg-[#F9FAFB] p-6 text-center">
                          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#F3F4F6]">
                            <svg className="size-6 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-[#374151]">No clash results</p>
                          <p className="mt-1 text-xs text-[#6A7282]">Try adjusting your filters or run a new test.</p>
                          {persistedHiddenObjects.length > 0 && (
                            <p className="mt-2 text-xs text-amber-600">Hidden objects may be affecting results.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#E5E7EB] pt-5">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-[#F3F4F6]">
                          <svg className="size-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-semibold text-[#101828]">Inspector</h3>
                      </div>
                      {!selectedResult && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DC] bg-[#F9FAFB] p-5 text-center">
                          <p className="text-sm text-[#6A7282]">Select a clash to inspect</p>
                        </div>
                      )}
                      {selectedResult && (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-[#E5E7EB] bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#101828]">{selectedResult.title}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#6A7282]">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-blue-600">
                                    <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {selectedResult.type}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-0.5">
                                    <svg className="size-3 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    {selectedResult.distance.toFixed(2)} m
                                  </span>
                                </div>
                              </div>
                              <span className={cn(
                                'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                                selectedResult.status === 'resolved'
                                  ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60'
                                  : selectedResult.status === 'reviewed'
                                    ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60'
                                    : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/60'
                              )}>
                                {selectedResult.status}
                              </span>
                            </div>
                            <p className="mt-3 text-[11px] leading-relaxed text-[#6A7282]">
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
                              <div className="grid gap-3">
                                <div className={cn(
                                  'group relative rounded-xl border p-4 transition-all duration-150',
                                  aHidden ? 'border-amber-200 bg-amber-50/50' : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                                )}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex size-5 items-center justify-center rounded-md bg-blue-500 text-[10px] font-bold text-white">A</span>
                                        <p className="text-xs font-medium uppercase tracking-wide text-[#6A7282]">Object A</p>
                                      </div>
                                      <p className="mt-1.5 text-sm font-medium text-[#101828]">{selectedResult.objectA}</p>
                                      <p className="mt-0.5 text-xs text-[#6A7282]">{selectedResult.objectAType} · {selectedResult.objectAModel}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void (aHidden ? showObjects([selectedResult.objectA]) : hideObject(selectedResult.objectA))}
                                      className={cn(
                                        'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                                        aHidden
                                          ? 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200'
                                          : 'border-[#D1D5DC] bg-white text-[#6A7282] hover:border-[#9CA3AF] hover:text-[#374151]'
                                      )}
                                    >
                                      {aHidden ? '👁 Show' : '🙈 Hide'}
                                    </button>
                                  </div>
                                </div>
                                <div className={cn(
                                  'group relative rounded-xl border p-4 transition-all duration-150',
                                  bHidden ? 'border-amber-200 bg-amber-50/50' : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                                )}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex size-5 items-center justify-center rounded-md bg-rose-500 text-[10px] font-bold text-white">B</span>
                                        <p className="text-xs font-medium uppercase tracking-wide text-[#6A7282]">Object B</p>
                                      </div>
                                      <p className="mt-1.5 text-sm font-medium text-[#101828]">{selectedResult.objectB}</p>
                                      <p className="mt-0.5 text-xs text-[#6A7282]">{selectedResult.objectBType} · {selectedResult.objectBModel}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void (bHidden ? showObjects([selectedResult.objectB]) : hideObject(selectedResult.objectB))}
                                      className={cn(
                                        'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                                        bHidden
                                          ? 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200'
                                          : 'border-[#D1D5DC] bg-white text-[#6A7282] hover:border-[#9CA3AF] hover:text-[#374151]'
                                      )}
                                    >
                                      {bHidden ? '👁 Show' : '🙈 Hide'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                            <label className="mb-2 flex items-center gap-2 text-xs font-medium text-[#6A7282]">
                              <svg className="size-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Coordination note
                            </label>
                            <textarea
                              rows={3}
                              className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none transition-colors focus:border-[#155DFC] focus:ring-2 focus:ring-blue-500/10"
                              placeholder="Add coordination notes..."
                              value={noteDraft}
                              maxLength={INSPECTOR_NOTE_MAX_LEN}
                              onChange={(event) => {
                                clearInspectorActionBanner();
                                setNoteDraft(event.target.value);
                              }}
                            />
                            <p className="mt-1 text-right text-[10px] text-[#9CA3AF]">{noteDraft.length}/{INSPECTOR_NOTE_MAX_LEN}</p>
                          </div>
                          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                            <label className="mb-2 flex items-center gap-2 text-xs font-medium text-[#6A7282]">
                              <svg className="size-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Assignee
                            </label>
                            <select
                              className="w-full cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#155DFC] focus:ring-2 focus:ring-blue-500/10"
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
                              <p className="mt-2 text-[11px] text-[#6A7282]">Loading project members…</p>
                            )}
                            {!projectMembersLoading && projectMembers.length === 0 && (
                              <p className="mt-2 text-[11px] text-[#6A7282]">No members returned for this project; you can still use Unassigned or a stored assignee.</p>
                            )}
                          </div>
                          <SidebarActionBanner banner={inspectorActionBanner} />
                          <button
                            type="button"
                            onClick={() => void saveClashInspectorDetails()}
                            disabled={updateClashStatus.isPending}
                            className={cn(
                              'flex w-full items-center justify-center gap-2 rounded-xl border border-[#155DFC] px-4 py-3 text-sm font-semibold text-[#155DFC] transition-all duration-150 hover:bg-[#EFF6FF] active:scale-[0.98]',
                              updateClashStatus.isPending && 'cursor-wait opacity-70'
                            )}
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            {updateClashStatus.isPending ? 'Saving…' : 'Save note and assignee'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setResolveDialogOpen(true)}
                            disabled={selectedResult.status === 'resolved'}
                            className={cn(
                              'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#009966] to-[#059669] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition-all duration-150 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98]',
                              selectedResult.status === 'resolved' && 'cursor-not-allowed bg-emerald-300 hover:bg-emerald-300 hover:shadow-none'
                            )}
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {selectedResult.status === 'resolved' ? '✓ Resolved' : 'Mark as resolved'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {sidebarTab === 'report' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#6A7282]">Export clash data or the federated model snapshot.</p>
                    <SidebarActionBanner banner={exportActionBanner} />
                    <div className="space-y-2">
                      {[
                        { format: 'json' as const, label: 'JSON Report', desc: 'Clash results as structured JSON', icon: '{ }' },
                        { format: 'csv' as const, label: 'CSV Spreadsheet', desc: 'Open in Excel or Google Sheets', icon: '⊟' },
                        { format: 'bcf' as const, label: 'BCF File', desc: 'BIM Collaboration Format', icon: '⊕' },
                        { format: 'model' as const, label: 'Federated Model', desc: 'Full model snapshot (JSON)', icon: '⬡' },
                      ].map(({ format, label, desc, icon }) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => void exportCurrent(format)}
                          className="flex w-full items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 text-left hover:border-[#155DFC] hover:bg-[#F8FAFF] transition-colors group"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#F3F4F6] text-sm font-medium text-[#4A5565] group-hover:bg-[#EFF6FF] group-hover:text-[#155DFC]">{icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#101828]">{label}</p>
                            <p className="text-xs text-[#6A7282]">{desc}</p>
                          </div>
                          <svg className="ml-auto size-4 shrink-0 text-[#D1D5DC] group-hover:text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </button>
                      ))}
                    </div>
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
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClashId(null);
                        setShowClashInMainViewer(false);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white/95 px-3 py-1.5 text-xs font-medium text-[#364153] shadow-sm backdrop-blur-sm hover:bg-gray-50"
                    >
                      ← View all objects
                    </button>
                  )}
                  <div className="flex rounded-lg border border-[#E5E7EB] bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setPlaneView('2d')}
                      className={cn('rounded-md px-3 py-1.5 text-xs font-medium', planeView === '2d' ? 'bg-[#155DFC] text-white' : 'text-[#4A5565] hover:bg-[#F3F4F6]')}
                    >
                      2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaneView('3d')}
                      className={cn('rounded-md px-3 py-1.5 text-xs font-medium', planeView === '3d' ? 'bg-[#155DFC] text-white' : 'text-[#4A5565] hover:bg-[#F3F4F6]')}
                    >
                      3D
                    </button>
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
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="rounded-lg bg-[#155DFC] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Import from Documents
                </button>
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
                      overviewScene={overviewSceneForViewer2d}
                      allowObjectMove={false}
                      objectMeshPositions={objectMeshPositions}
                      testScopeObjectIds={activeTestScopeObjectIds}
                      deEmphasizeUnrelated={shouldHighlightActiveScope}
                      showScopeBadge={shouldHighlightActiveScope}
                      hideUnrelatedActive={hideUnrelatedToActiveTest}
                      hasXktOnlyOverview={hasXktOnlyOverview}
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
                      projectSlug={projectSlug}
                      xktModels={xktModelsForViewer}
                      objectMeshPositions={objectMeshPositions}
                    />
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

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

      {/* Import from project documents modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-[#E5E7EB] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[#101828]">Import IFC from Documents</h2>
                <p className="mt-0.5 text-xs text-[#6A7282]">Select IFC files uploaded to this project</p>
              </div>
              <button type="button" onClick={() => setImportModalOpen(false)} className="rounded-md p-1 text-[#6A7282] hover:bg-gray-100">
                <X className="size-4" />
              </button>
            </div>

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
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-[#155DFC]"
                          checked={checked}
                          onChange={() => {
                            setSelectedDocIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(doc.publicId)) next.delete(doc.publicId);
                              else next.add(doc.publicId);
                              return next;
                            });
                          }}
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

            <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3">
              <p className="text-xs text-[#6A7282]">
                {selectedDocIds.size > 0 ? `${selectedDocIds.size} file${selectedDocIds.size > 1 ? 's' : ''} selected` : 'No files selected'}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setImportModalOpen(false)} className="rounded-lg border border-[#D1D5DC] px-4 py-2 text-sm text-[#364153] hover:bg-gray-50">
                  Cancel
                </button>
                <button
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
                  className="rounded-lg bg-[#155DFC] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {importFromDocuments.isPending ? 'Importing…' : 'Import Selected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>

  );
}
