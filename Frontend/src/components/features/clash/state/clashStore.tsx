'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Clash } from '../types/clashes';
import { buildSceneObjectsFromClash, clampWorld, type SceneObject, type ScenePosition } from '../lib/clashScene';
import { apiUrl } from '@/config/api';
import { apiFetch } from '@/lib/api-client';

type Vec3 = [number, number, number];

type ResolvedPositionsRecord = { id: string; position: Vec3 };

type ResolvedClashRecord = {
  resolved: true;
  resolvedAt: string;
  resolvedPositions: ResolvedPositionsRecord[];
};

type ClashViewerStorageShape = {
  persistedScenesByClashId: Record<string, SceneObject[]>;
  resolvedByClashId: Record<string, ResolvedClashRecord>;
};

type ClashViewerState = ClashViewerStorageShape & {
  scenesByClashId: Record<string, SceneObject[]>;
  hydrated: boolean;
};

type ClashViewerAction =
  | { type: 'HYDRATE'; payload: ClashViewerStorageShape }
  | { type: 'ENSURE_SCENE'; payload: { clashId: string; scene: SceneObject[]; force?: boolean } }
  | { type: 'UPDATE_OBJECT_POSITION'; payload: { clashId: string; objectId: string; position: ScenePosition } }
  | { type: 'SAVE_SCENE'; payload: { clashId: string } }
  | { type: 'SAVE_ALL_DIRTY_SCENES' }
  | { type: 'DISCARD_ALL_DIRTY_SCENES' }
  | { type: 'DISCARD_SCENE'; payload: { clashId: string } }
  | { type: 'MARK_CLASH_RESOLVED'; payload: { clashId: string; resolved: ResolvedClashRecord } };

const scenesEqual = (sceneA: SceneObject[] | undefined, sceneB: SceneObject[] | undefined) => {
  if (!sceneA || !sceneB) return false;
  if (sceneA.length !== sceneB.length) return false;

  for (let index = 0; index < sceneA.length; index += 1) {
    const a = sceneA[index];
    const b = sceneB[index];
    if (!b || a.id !== b.id) return false;
    if (a.position.x !== b.position.x || a.position.y !== b.position.y || a.position.z !== b.position.z) {
      return false;
    }
  }

  return true;
};

const reducer = (state: ClashViewerState, action: ClashViewerAction): ClashViewerState => {
  switch (action.type) {
    case 'HYDRATE':
      return {
        persistedScenesByClashId: action.payload.persistedScenesByClashId,
        scenesByClashId: action.payload.persistedScenesByClashId,
        resolvedByClashId: action.payload.resolvedByClashId,
        hydrated: true,
      };
    case 'ENSURE_SCENE': {
      const { clashId, scene, force } = action.payload;
      if (!force && state.scenesByClashId[clashId]) {
        return state;
      }
      return {
        ...state,
        scenesByClashId: {
          ...state.scenesByClashId,
          [clashId]: scene,
        },
        persistedScenesByClashId: {
          ...state.persistedScenesByClashId,
          [clashId]: state.persistedScenesByClashId[clashId] ?? scene,
        },
      };
    }
    case 'UPDATE_OBJECT_POSITION': {
      const { clashId, objectId, position } = action.payload;
      const currentScene = state.scenesByClashId[clashId];
      if (!currentScene) {
        return state;
      }

      return {
        ...state,
        scenesByClashId: {
          ...state.scenesByClashId,
          [clashId]: currentScene.map((obj) =>
            obj.id === objectId
              ? {
                  ...obj,
                  position: {
                    x: clampWorld(position.x),
                    y: position.y,
                    z: clampWorld(position.z),
                  },
                }
              : obj
          ),
        },
      };
    }
    case 'SAVE_SCENE': {
      const { clashId } = action.payload;
      const scene = state.scenesByClashId[clashId];
      if (!scene) return state;

      return {
        ...state,
        persistedScenesByClashId: {
          ...state.persistedScenesByClashId,
          [clashId]: scene,
        },
      };
    }
    case 'SAVE_ALL_DIRTY_SCENES': {
      const nextPersisted = { ...state.persistedScenesByClashId };
      for (const clashId of Object.keys(state.scenesByClashId)) {
        const draft = state.scenesByClashId[clashId];
        if (!scenesEqual(draft, state.persistedScenesByClashId[clashId])) {
          nextPersisted[clashId] = draft.map((o) => ({
            ...o,
            position: { ...o.position },
          }));
        }
      }
      return { ...state, persistedScenesByClashId: nextPersisted };
    }
    case 'DISCARD_ALL_DIRTY_SCENES': {
      const nextScenes = { ...state.scenesByClashId };
      for (const clashId of Object.keys(nextScenes)) {
        const persisted = state.persistedScenesByClashId[clashId];
        if (!persisted) continue;
        if (!scenesEqual(nextScenes[clashId], persisted)) {
          nextScenes[clashId] = persisted.map((o) => ({
            ...o,
            position: { ...o.position },
          }));
        }
      }
      return { ...state, scenesByClashId: nextScenes };
    }
    case 'DISCARD_SCENE': {
      const { clashId } = action.payload;
      const persisted = state.persistedScenesByClashId[clashId];
      if (!persisted) return state;
      return {
        ...state,
        scenesByClashId: {
          ...state.scenesByClashId,
          [clashId]: persisted.map((o) => ({
            ...o,
            position: { ...o.position },
          })),
        },
      };
    }
    case 'MARK_CLASH_RESOLVED': {
      const { clashId, resolved } = action.payload;
      return {
        ...state,
        resolvedByClashId: {
          ...state.resolvedByClashId,
          [clashId]: resolved,
        },
      };
    }
  }

  return state;
};

type ClashViewerContextValue = {
  hydrated: boolean;
  ensureSceneForClash: (clash: Clash) => void;
  updateObjectPosition: (clashId: string, objectId: string, position: ScenePosition) => void;
  saveClashScene: (clashId: string) => void;
  saveClashSceneToServer: (clashId: string, projectSlug: string) => Promise<void>;
  loadClashSceneFromServer: (clashId: string, projectSlug: string) => Promise<boolean>;
  saveAllDirtyScenes: () => void;
  discardAllDirtyScenes: () => void;
  discardClashScene: (clashId: string) => void;
  hasAnyUnsavedSceneChanges: () => boolean;
  isClashDirty: (clashId: string) => boolean;
  getScene: (clashId: string) => SceneObject[] | null;
  getSceneObjectPositionVec3: (clashId: string, objectId: string) => Vec3 | null;
  markClashResolved: (clashId: string) => void;
  loadResolvedForClash: (clashId: string) => ResolvedClashRecord | null;
};

const ClashViewerContext = createContext<ClashViewerContextValue | null>(null);

const buildStorageKey = (projectSlug: string) => `orbit:clashViewer:${projectSlug}`;

export function ClashViewerProvider({ projectSlug, children }: { projectSlug: string; children: React.ReactNode }) {
  const storageKey = useMemo(() => buildStorageKey(projectSlug), [projectSlug]);

  const [state, dispatch] = useReducer(reducer, {
    persistedScenesByClashId: {},
    scenesByClashId: {},
    resolvedByClashId: {},
    hydrated: false,
  });

  const saveTimerRef = useRef<number | null>(null);
  const saveSnapshotRef = useRef<ClashViewerStorageShape | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        dispatch({ type: 'HYDRATE', payload: { persistedScenesByClashId: {}, resolvedByClashId: {} } });
        return;
      }

      const parsed = JSON.parse(raw) as Partial<ClashViewerStorageShape> & {
        scenesByClashId?: Record<string, SceneObject[]>;
      };
      const persistedScenes = (parsed.persistedScenesByClashId ?? parsed.scenesByClashId ?? {}) as Record<string, SceneObject[]>;
      dispatch({
        type: 'HYDRATE',
        payload: {
          persistedScenesByClashId: persistedScenes,
          resolvedByClashId: (parsed.resolvedByClashId ?? {}) as Record<string, ResolvedClashRecord>,
        },
      });
    } catch {
      dispatch({ type: 'HYDRATE', payload: { persistedScenesByClashId: {}, resolvedByClashId: {} } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!state.hydrated) return;

    saveSnapshotRef.current = {
      persistedScenesByClashId: state.persistedScenesByClashId,
      resolvedByClashId: state.resolvedByClashId,
    };
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {
      if (!saveSnapshotRef.current) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(saveSnapshotRef.current));
      } catch {
        // Local persistence is best-effort; don't break drag UX if storage is full.
      }
    }, 300);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [state.hydrated, state.persistedScenesByClashId, state.resolvedByClashId, storageKey]);

  const ensureSceneForClash = useCallback(
    (clash: Clash) => {
      const clashId = clash.id;
      const existingScene = state.scenesByClashId[clashId];

      const baseScene: SceneObject[] = buildSceneObjectsFromClash(clash);
      const resolvedRecord = state.resolvedByClashId[clashId];

      if (resolvedRecord?.resolvedPositions?.length) {
        // If the user already marked this clash as resolved, always show saved final positions.
        const resolvedById = new Map(resolvedRecord.resolvedPositions.map((p) => [p.id, p.position] as const));
        const nextScene: SceneObject[] = baseScene.map((obj) => {
          const resolvedPos = resolvedById.get(obj.id);
          if (!resolvedPos) return obj;
          const [x, y, z] = resolvedPos;
          return { ...obj, position: { x, y, z } };
        });

        dispatch({ type: 'ENSURE_SCENE', payload: { clashId, scene: nextScene, force: true } });
        return;
      }

      if (existingScene) return;

      dispatch({ type: 'ENSURE_SCENE', payload: { clashId, scene: baseScene } });
    },
    [state.resolvedByClashId, state.scenesByClashId]
  );

  const updateObjectPosition = useCallback((clashId: string, objectId: string, position: ScenePosition) => {
    dispatch({ type: 'UPDATE_OBJECT_POSITION', payload: { clashId, objectId, position } });
  }, []);

  const saveClashScene = useCallback((clashId: string) => {
    dispatch({ type: 'SAVE_SCENE', payload: { clashId } });
  }, []);

  const saveClashSceneToServer = useCallback(async (clashId: string, projectSlug: string) => {
    const scene = state.scenesByClashId[clashId];
    if (!scene) return;

    const objects = scene.map((obj) => ({
      id: obj.id,
      position: [obj.position.x, obj.position.y, obj.position.z] as Vec3,
    }));

    try {
      await apiFetch(
        apiUrl(`/projects/${encodeURIComponent(projectSlug)}/clashes/${encodeURIComponent(clashId)}/positions`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objects }),
        }
      );
      dispatch({ type: 'SAVE_SCENE', payload: { clashId } });
    } catch {
      // Server sync best-effort; local save still proceeds above
    }
  }, [state.scenesByClashId]);

  const loadClashSceneFromServer = useCallback(async (clashId: string, projectSlug: string): Promise<boolean> => {
    try {
      const res = await apiFetch(
        apiUrl(`/projects/${encodeURIComponent(projectSlug)}/clashes/${encodeURIComponent(clashId)}/positions`)
      );
      if (!res.ok) return false;

      const data = (await res.json()) as { objects: { id: string; position: Vec3 }[] | null };
      if (!data.objects || data.objects.length === 0) return false;

      const posById = new Map(data.objects.map((o) => [o.id, o.position] as const));
      const existingScene = state.scenesByClashId[clashId];
      if (!existingScene) return false;

      const nextScene: SceneObject[] = existingScene.map((obj) => {
        const pos = posById.get(obj.id);
        if (!pos) return obj;
        const [x, y, z] = pos;
        return { ...obj, position: { x, y, z } };
      });

      dispatch({ type: 'ENSURE_SCENE', payload: { clashId, scene: nextScene, force: true } });
      dispatch({ type: 'SAVE_SCENE', payload: { clashId } });
      return true;
    } catch {
      return false;
    }
  }, [state.scenesByClashId]);

  const saveAllDirtyScenes = useCallback(() => {
    dispatch({ type: 'SAVE_ALL_DIRTY_SCENES' });
  }, []);

  const discardAllDirtyScenes = useCallback(() => {
    dispatch({ type: 'DISCARD_ALL_DIRTY_SCENES' });
  }, []);

  const discardClashScene = useCallback((clashId: string) => {
    dispatch({ type: 'DISCARD_SCENE', payload: { clashId } });
  }, []);

  const hasAnyUnsavedSceneChanges = useCallback(() => {
    for (const clashId of Object.keys(state.scenesByClashId)) {
      if (!scenesEqual(state.scenesByClashId[clashId], state.persistedScenesByClashId[clashId])) {
        return true;
      }
    }
    return false;
  }, [state.persistedScenesByClashId, state.scenesByClashId]);

  const isClashDirty = useCallback(
    (clashId: string) => !scenesEqual(state.scenesByClashId[clashId], state.persistedScenesByClashId[clashId]),
    [state.persistedScenesByClashId, state.scenesByClashId]
  );

  const getScene = useCallback((clashId: string) => state.scenesByClashId[clashId] ?? null, [state.scenesByClashId]);

  const getSceneObjectPositionVec3 = useCallback(
    (clashId: string, objectId: string) => {
      const scene = state.scenesByClashId[clashId];
      const obj = scene?.find((o) => o.id === objectId);
      if (!obj) return null;
      return [obj.position.x, obj.position.y, obj.position.z] as Vec3;
    },
    [state.scenesByClashId]
  );

  const loadResolvedForClash = useCallback(
    (clashId: string) => state.resolvedByClashId[clashId] ?? null,
    [state.resolvedByClashId]
  );

  const markClashResolved = useCallback(
    (clashId: string) => {
      const scene = state.scenesByClashId[clashId];
      if (!scene) return;

      const resolved: ResolvedClashRecord = {
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedPositions: scene.map((obj) => ({
          id: obj.id,
          position: [obj.position.x, obj.position.y, obj.position.z],
        })),
      };

      dispatch({ type: 'MARK_CLASH_RESOLVED', payload: { clashId, resolved } });
    },
    [state.scenesByClashId]
  );

  const value = useMemo<ClashViewerContextValue>(
    () => ({
      hydrated: state.hydrated,
      ensureSceneForClash,
      updateObjectPosition,
      saveClashScene,
      saveClashSceneToServer,
      loadClashSceneFromServer,
      saveAllDirtyScenes,
      discardAllDirtyScenes,
      discardClashScene,
      hasAnyUnsavedSceneChanges,
      isClashDirty,
      getScene,
      getSceneObjectPositionVec3,
      markClashResolved,
      loadResolvedForClash,
    }),
    [
      discardAllDirtyScenes,
      discardClashScene,
      ensureSceneForClash,
      getScene,
      getSceneObjectPositionVec3,
      hasAnyUnsavedSceneChanges,
      isClashDirty,
      loadClashSceneFromServer,
      loadResolvedForClash,
      markClashResolved,
      saveAllDirtyScenes,
      saveClashScene,
      saveClashSceneToServer,
      state.hydrated,
      updateObjectPosition,
    ]
  );

  return <ClashViewerContext.Provider value={value}>{children}</ClashViewerContext.Provider>;
}

export function useClashViewerStore() {
  const ctx = useContext(ClashViewerContext);
  if (!ctx) {
    throw new Error('useClashViewerStore must be used within ClashViewerProvider');
  }
  return ctx;
}

