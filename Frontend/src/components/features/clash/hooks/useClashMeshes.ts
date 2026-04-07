'use client';

import { useQuery } from '@tanstack/react-query';
import { apiUrl } from '@/config/api';
import { fetchJson } from './useNavisworksWorkspace';

export const clashMeshKeys = {
  byMinioKeys: (projectSlug: string, meshKeys: string[]) =>
    ['navisworks-mesh-by-keys', projectSlug, meshKeys.slice().sort().join(',')] as const,
  byObjectIds: (projectSlug: string, objectIds: string[]) =>
    ['navisworks-meshes', projectSlug, objectIds.slice().sort().join(',')] as const,
  byClashId: (projectSlug: string, clashId: string) =>
    ['navisworks-clash-meshes', projectSlug, clashId] as const,
  diagnosticsByObjectIds: (projectSlug: string, objectIds: string[]) =>
    ['navisworks-mesh-diagnostics', projectSlug, objectIds.slice().sort().join(',')] as const,
};

/**
 * Fetch triangle mesh positions by raw MinIO keys (1 key per model file).
 * Much more efficient than fetching by objectId when there are many objects —
 * a 800-object overview spanning 3 models needs only 3 keys in the URL.
 */
export function useClashMeshesByKeys(projectSlug: string, meshKeys: string[]) {
  const stableKeys = meshKeys.slice().sort();

  return useQuery({
    queryKey: clashMeshKeys.byMinioKeys(projectSlug, stableKeys),
    queryFn: () =>
      fetchJson<{ success: boolean; meshes: Record<string, number[]> }>(
        apiUrl(
          `/projects/${encodeURIComponent(projectSlug)}/navisworks/mesh?meshKeys=${stableKeys.map(encodeURIComponent).join(',')}`
        )
      ).then((data) => data.meshes ?? {}),
    enabled: stableKeys.length > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * Fetch triangle mesh positions by object IDs.
 * Suitable for small sets (e.g. clash detail with 2 objects).
 * Avoid using with large sets (>20 IDs) — use useClashMeshesByKeys instead.
 */
export function useClashMeshes(projectSlug: string, objectIds: string[]) {
  const stableIds = objectIds.slice().sort();

  return useQuery({
    queryKey: clashMeshKeys.byObjectIds(projectSlug, stableIds),
    queryFn: () =>
      fetchJson<{ success: boolean; meshes: Record<string, number[]> }>(
        apiUrl(
          `/projects/${encodeURIComponent(projectSlug)}/navisworks/mesh?objectIds=${stableIds.map(encodeURIComponent).join(',')}`
        )
      ).then((data) => data.meshes ?? {}),
    enabled: stableIds.length > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * Fetch clash-detail meshes directly by clashId from backend clash runs.
 * More stable than objectId/key mixing on frontend because lookup is anchored to persisted clash result.
 */
export function useClashDetailMeshes(projectSlug: string, clashId: string | null) {
  const stableClashId = String(clashId || '').trim();
  return useQuery({
    queryKey: clashMeshKeys.byClashId(projectSlug, stableClashId),
    queryFn: () =>
      fetchJson<{
        success: boolean;
        clashId: string;
        objectIds: string[];
        meshes: Record<string, number[]>;
        diagnostics: ClashMeshDiagnostics;
      }>(
        apiUrl(
          `/projects/${encodeURIComponent(projectSlug)}/navisworks/clashes/${encodeURIComponent(stableClashId)}/meshes`
        )
      ),
    enabled: stableClashId.length > 0,
    staleTime: 0,
  });
}

export type ClashMeshDiagnostics = Record<string, {
  hasMeshRef: boolean;
  meshKey: string | null;
  meshKeyExistsInMinio: boolean;
  positionsLengthBeforeSanitize: number;
  positionsLengthAfterSanitize: number;
  fallbackReason: string;
  objectHidden: boolean;
}>;

/** Debug-only per-object diagnostics for clash-detail mesh fallback investigation. */
export function useClashMeshDiagnostics(projectSlug: string, objectIds: string[]) {
  const stableIds = objectIds.slice().sort();
  return useQuery({
    queryKey: clashMeshKeys.diagnosticsByObjectIds(projectSlug, stableIds),
    queryFn: () =>
      fetchJson<{ success: boolean; diagnostics: ClashMeshDiagnostics }>(
        apiUrl(
          `/projects/${encodeURIComponent(projectSlug)}/navisworks/mesh?debug=1&objectIds=${stableIds.map(encodeURIComponent).join(',')}`
        )
      ).then((data) => data.diagnostics ?? {}),
    enabled: stableIds.length > 0,
    staleTime: 0,
  });
}
