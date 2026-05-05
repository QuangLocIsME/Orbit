'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiUrl } from '@/config/api';
import { apiFetch } from '@/lib/api-client';
import type { Clash } from '../types/clashes';

export interface ViewerIntegration {
  provider: 'none' | 'xeokit';
  sceneId?: string | null;
  baseUrl?: string | null;
}

/** Optional simplified mesh for narrow-phase clash (9 floats per triangle, world space). */
export interface ClashMeshPayload {
  positions: number[];
}

export interface FederatedObject {
  id: string;
  type: string;
  category: string;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  transform: number[];
  sourceModel: string;
  sourceModelId: string;
  sourceFile: string;
  hidden?: boolean;
  clashMesh?: ClashMeshPayload | null;
}

export interface FederatedModelSummary {
  id: string;
  name: string;
  sourceFormat: string;
  discipline: string;
  unit: string;
  transform: number[];
  importedAt: string;
  categories: string[];
  objectCount: number;
  /** Present when model was imported as `.xkt` — binary is served from the Navisworks XKT endpoint. */
  xktFile?: string | null;
}

export interface SelectionSet {
  id: string;
  name: string;
  description: string;
  filters: {
    modelIds: string[];
    types: string[];
    categories: string[];
  };
  manualIncludeIds: string[];
  manualExcludeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClashTest {
  id: string;
  name: string;
  description: string;
  setAId: string | null;
  setBId: string | null;
  softThreshold: number;
  duplicateTolerance: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunId: string | null;
  latestRun?: ClashRunSummary | null;
}

export interface ClashRunSummary {
  id: string;
  testId: string;
  startedAt: string;
  completedAt: string;
  scope: 'full' | 'incremental';
  affectedObjectIds: string[];
  summary: {
    total: number;
    hard: number;
    soft: number;
    duplicate: number;
    resolved: number;
    reviewed: number;
    new: number;
  };
}

export interface ClashResult {
  clashId: string;
  objectA: string;
  objectB: string;
  type: 'HARD' | 'SOFT' | 'DUPLICATE';
  status: 'new' | 'reviewed' | 'resolved';
  position: [number, number, number];
  distance: number;
  sourceTestId: string;
  runId: string;
  objectABBox: { min: [number, number, number]; max: [number, number, number] } | null;
  objectBBBox: { min: [number, number, number]; max: [number, number, number] } | null;
  objectAType: string;
  objectBType: string;
  objectAModel: string;
  objectBModel: string;
  title: string;
  testName: string;
  assignee: string;
  note: string;
  hiddenObjectIds: string[];
}

export interface WorkspacePayload {
  viewerIntegration?: ViewerIntegration;
  federatedModel: {
    coordinateSystem: string;
    unit: string;
    models: FederatedModelSummary[];
    objects: FederatedObject[];
    categories: string[];
  };
  selectionSets: SelectionSet[];
  clashTests: ClashTest[];
}

export interface ClashRunPayload {
  test: ClashTest;
  run: ClashRunSummary | null;
  results: ClashResult[];
}

/** Fast PATCH response — no full federated remap (see Backend updateClashStatus). */
export interface ClashStatusPatchApiResponse {
  success: boolean;
  clashPatch: {
    clashId: string;
    sourceTestId: string;
    note: string;
    assignee: string;
    status: 'new' | 'reviewed' | 'resolved';
    updatedAt?: string;
  };
  runSummary: ClashRunSummary['summary'];
}

/** PATCH body + optional client-only `sourceTestId` for optimistic cache updates (not sent to API). */
export type ClashStatusPatchVariables = {
  clashId: string;
  status?: 'new' | 'reviewed' | 'resolved';
  note?: string;
  assignee?: string;
  sourceTestId?: string;
};

function summaryKeyForStatus(status: 'new' | 'reviewed' | 'resolved'): keyof ClashRunSummary['summary'] | null {
  if (status === 'new') return 'new';
  if (status === 'reviewed') return 'reviewed';
  if (status === 'resolved') return 'resolved';
  return null;
}

function applyOptimisticClashPatch(
  old: ClashRunPayload | undefined,
  variables: ClashStatusPatchVariables
): ClashRunPayload | undefined {
  if (!old?.results?.length) return old;
  const idx = old.results.findIndex((r) => r.clashId === variables.clashId);
  if (idx === -1) return old;
  const prevRow = old.results[idx];
  const nextRow: ClashResult = {
    ...prevRow,
    ...(variables.status !== undefined ? { status: variables.status } : {}),
    ...(variables.note !== undefined ? { note: variables.note } : {}),
    ...(variables.assignee !== undefined ? { assignee: variables.assignee } : {}),
  };
  const nextResults = [...old.results];
  nextResults[idx] = nextRow;

  let nextSummary = old.run?.summary;
  if (
    variables.status !== undefined &&
    variables.status !== prevRow.status &&
    old.run?.summary
  ) {
    nextSummary = { ...old.run.summary };
    const decKey = summaryKeyForStatus(prevRow.status);
    const incKey = summaryKeyForStatus(variables.status);
    if (decKey && nextSummary[decKey] !== undefined) {
      nextSummary[decKey] = Math.max(0, nextSummary[decKey] - 1);
    }
    if (incKey && nextSummary[incKey] !== undefined) {
      nextSummary[incKey] = nextSummary[incKey] + 1;
    }
  }

  return {
    ...old,
    results: nextResults,
    run: old.run && nextSummary ? { ...old.run, summary: nextSummary } : old.run,
  };
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    const msg =
      typeof body?.message === 'string' && body.message.trim()
        ? body.message
        : `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return response.json() as Promise<T>;
};

export const workspaceKeys = {
  root: (projectSlug: string) => ['navisworks', projectSlug] as const,
  workspace: (projectSlug: string) => ['navisworks', projectSlug, 'workspace'] as const,
  results: (projectSlug: string, testId: string | null) => ['navisworks', projectSlug, 'results', testId] as const,
  /** IFC list for Clash "Import from Documents" modal — invalidate after document uploads */
  ifcDocuments: (projectSlug: string) => ['navisworks-ifc-documents', projectSlug] as const,
};

/** Landing Clash Detection list + summary cards (`GET .../navisworks/clashes`). */
export const clashesOverviewKey = (projectSlug: string) => ['clashes-overview', projectSlug] as const;

export function useNavisworksClashResults(projectSlug: string, testId: string | null) {
  return useQuery({
    queryKey: workspaceKeys.results(projectSlug, testId),
    queryFn: () =>
      fetchJson<ClashRunPayload>(
        apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(testId || '')}/results`)
      ),
    enabled: Boolean(testId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export const resultToViewerClash = (result: ClashResult): Clash => ({
  id: result.clashId,
  status: result.status === 'reviewed' ? 'in-progress' : result.status,
  type: result.type === 'SOFT' ? 'Soft Clash' : 'Hard Clash',
  severity: result.type === 'HARD' ? 'high' : result.type === 'DUPLICATE' ? 'medium' : 'low',
  clashType: result.type === 'SOFT' ? 'soft' : 'hard',
  resolved: result.status === 'resolved',
  objectA: result.objectA,
  objectB: result.objectB,
  position: result.position,
  title: result.title,
  location: `X: ${result.position[0].toFixed(2)}, Y: ${result.position[1].toFixed(2)}, Z: ${result.position[2].toFixed(2)}`,
  models: [result.objectAModel, result.objectBModel],
  assignedTo: result.assignee || 'Unassigned',
  distance: `${result.distance.toFixed(2)} m`,
  note: result.note,
  objectABBox: result.objectABBox || undefined,
  objectBBBox: result.objectBBBox || undefined,
  element1: { name: result.objectA, category: result.objectAType.replace(/^Ifc/, ''), file: result.objectAModel },
  element2: { name: result.objectB, category: result.objectBType.replace(/^Ifc/, ''), file: result.objectBModel },
});

export function useNavisworksWorkspace(projectSlug: string) {
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: workspaceKeys.workspace(projectSlug),
    queryFn: () => fetchJson<WorkspacePayload>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/workspace`)),
  });

  const importModels = useMutation({
    mutationFn: async (payload: { files: File[] }) => {
      const formData = new FormData();
      payload.files.forEach((file) => formData.append('models', file));
      formData.append('importsMeta', JSON.stringify(payload.files.map((file) => ({
        sourceModel: file.name.replace(/\.[^.]+$/, ''),
        originalName: file.name,
      }))));
      return fetchJson<{ success: true }>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/models/import`), {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    },
  });

  const saveSelectionSet = useMutation({
    mutationFn: async (payload: Partial<SelectionSet>) =>
      fetchJson<{ selectionSet: SelectionSet }>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/selection-sets`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    },
  });

  const deleteSelectionSet = useMutation({
    mutationFn: async (selectionSetId: string) =>
      fetchJson<{ success: true }>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/selection-sets/${encodeURIComponent(selectionSetId)}`), {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    },
  });

  const saveClashTest = useMutation({
    mutationFn: async (payload: Partial<ClashTest>) =>
      fetchJson<{ clashTest: ClashTest }>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    },
  });

  const deleteClashTest = useMutation({
    mutationFn: async (testId: string) =>
      fetchJson<{ success: true }>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(testId)}`), {
        method: 'DELETE',
      }),
    onMutate: async (testId: string) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.results(projectSlug, testId) });
      queryClient.removeQueries({ queryKey: workspaceKeys.results(projectSlug, testId) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: clashesOverviewKey(projectSlug) });
    },
  });

  const runClashTest = useMutation({
    mutationFn: async (payload: { testId: string; affectedObjectIds?: string[] }) =>
      fetchJson<ClashRunPayload>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(payload.testId)}/run`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affectedObjectIds: payload.affectedObjectIds ?? [] }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: clashesOverviewKey(projectSlug) });
    },
  });

  const clashStatusPatchFn = async (payload: ClashStatusPatchVariables) => {
    const { sourceTestId: _omit, ...body } = payload;
    return fetchJson<ClashStatusPatchApiResponse>(
      apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clashes/${encodeURIComponent(payload.clashId)}`),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
  };

  const optimisticClashStatusOnMutate = async (variables: ClashStatusPatchVariables) => {
    const testId = variables.sourceTestId;
    if (!testId) return {};
    await queryClient.cancelQueries({ queryKey: workspaceKeys.results(projectSlug, testId) });
    const previousResults = queryClient.getQueryData<ClashRunPayload>(
      workspaceKeys.results(projectSlug, testId)
    );
    queryClient.setQueryData(workspaceKeys.results(projectSlug, testId), (old: ClashRunPayload | undefined) =>
      applyOptimisticClashPatch(old, variables)
    );
    return { previousResults, testId };
  };

  const optimisticClashStatusOnError = (
    _err: unknown,
    variables: ClashStatusPatchVariables,
    context: { previousResults?: ClashRunPayload; testId?: string } | undefined
  ) => {
    const tid = variables.sourceTestId ?? context?.testId;
    if (tid !== undefined && context?.previousResults !== undefined) {
      queryClient.setQueryData(workspaceKeys.results(projectSlug, tid), context.previousResults);
    }
  };

  const mergeClashPatchIntoResultsCache = (data: ClashStatusPatchApiResponse) => {
    const patch = data.clashPatch;
    if (!patch?.sourceTestId || !patch.clashId) return;
    queryClient.setQueryData(
      workspaceKeys.results(projectSlug, patch.sourceTestId),
      (old: ClashRunPayload | undefined): ClashRunPayload | undefined => {
        if (!old?.results?.length) return old;
        const nextResults = old.results.map((r) =>
          r.clashId === patch.clashId
            ? {
                ...r,
                note: patch.note,
                assignee: patch.assignee,
                status: patch.status,
              }
            : r
        );
        return {
          ...old,
          results: nextResults,
          run:
            old.run && data.runSummary
              ? { ...old.run, summary: data.runSummary }
              : old.run,
        };
      }
    );
  };

  const clashStatusMutationShared = {
    mutationFn: clashStatusPatchFn,
    onMutate: optimisticClashStatusOnMutate,
    onError: optimisticClashStatusOnError,
    onSuccess: async (data: ClashStatusPatchApiResponse) => {
      mergeClashPatchIntoResultsCache(data);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: clashesOverviewKey(projectSlug) });
    },
  };

  const updateClashStatus = useMutation(clashStatusMutationShared);

  /**
   * Same endpoint as updateClashStatus but a separate mutation instance so background
   * "promote new → reviewed" does not set updateClashStatus.isPending (fixes Save button stuck).
   */
  const quietUpdateClashStatus = useMutation(clashStatusMutationShared);

  const applyObjectActions = useMutation({
    mutationFn: async (payload: {
      action: 'move' | 'hide' | 'show';
      objectIds?: string[];
      objects?: { id: string; position: [number, number, number] }[];
    }) =>
      fetchJson<{ affectedObjectIds: string[] }>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clashes/actions`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onMutate: async (payload) => {
      if (payload.action !== 'hide' && payload.action !== 'show') return {};
      const objectIds = payload.objectIds ?? [];
      if (objectIds.length === 0) return {};
      await queryClient.cancelQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
      const previousWorkspace = queryClient.getQueryData<WorkspacePayload>(
        workspaceKeys.workspace(projectSlug)
      );
      const hidden = payload.action === 'hide';
      queryClient.setQueryData(workspaceKeys.workspace(projectSlug), (old: WorkspacePayload | undefined) => {
        if (!old?.federatedModel?.objects) return old;
        return {
          ...old,
          federatedModel: {
            ...old.federatedModel,
            objects: old.federatedModel.objects.map((o) =>
              objectIds.includes(o.id) ? { ...o, hidden } : o
            ),
          },
        };
      });
      return { previousWorkspace };
    },
    onError: (_err, _payload, context: { previousWorkspace?: WorkspacePayload } | undefined) => {
      if (context?.previousWorkspace !== undefined) {
        queryClient.setQueryData(workspaceKeys.workspace(projectSlug), context.previousWorkspace);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: clashesOverviewKey(projectSlug) });
    },
  });

  const importFromDocuments = useMutation({
    mutationFn: async (payload: { documentIds: string[] }) =>
      fetchJson<{ success: true; skippedFiles: string[] }>(
        apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/models/import-from-documents`),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    },
  });

  const clearModels = useMutation({
    mutationFn: async () =>
      fetchJson<{ success: true }>(
        apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/models`),
        { method: 'DELETE' }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: clashesOverviewKey(projectSlug) });
      await queryClient.removeQueries({ queryKey: ['navisworks', projectSlug, 'results'] });
    },
  });

  return {
    workspaceQuery,
    importModels,
    importFromDocuments,
    clearModels,
    saveSelectionSet,
    deleteSelectionSet,
    saveClashTest,
    deleteClashTest,
    runClashTest,
    updateClashStatus,
    quietUpdateClashStatus,
    applyObjectActions,
  };
}
