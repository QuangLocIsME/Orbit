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

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
};

export const workspaceKeys = {
  root: (projectSlug: string) => ['navisworks', projectSlug] as const,
  workspace: (projectSlug: string) => ['navisworks', projectSlug, 'workspace'] as const,
  results: (projectSlug: string, testId: string | null) => ['navisworks', projectSlug, 'results', testId] as const,
};

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
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
    },
  });

  const updateClashStatus = useMutation({
    mutationFn: async (payload: { clashId: string; status?: 'new' | 'reviewed' | 'resolved'; note?: string; assignee?: string }) =>
      fetchJson<ClashRunPayload>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clashes/${encodeURIComponent(payload.clashId)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
    },
  });

  const applyObjectActions = useMutation({
    mutationFn: async (payload: { action: 'move' | 'hide' | 'show'; objectIds?: string[]; objects?: { id: string; position: [number, number, number] }[] }) =>
      fetchJson<{ affectedObjectIds: string[] }>(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clashes/actions`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
    },
  });

  return {
    workspaceQuery,
    importModels,
    saveSelectionSet,
    deleteSelectionSet,
    saveClashTest,
    deleteClashTest,
    runClashTest,
    updateClashStatus,
    applyObjectActions,
  };
}
