'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Clash } from '../types/clashes';
import { useObjectInteraction } from '../hooks/useObjectInteraction';
import {
  computeWorldOriginFromScene,
  resolveClashZoneForViewer,
  transformMeshPositionsToViewerSpace,
  type SceneObject,
} from '../lib/clashScene';
import type { ViewerAdapter } from '../lib/viewerAdapter';
import { useClashViewerStore } from '../state/clashStore';
import { XeoKitViewerAdapter } from '../lib/xeoKitViewerAdapter';

interface Viewer3DProps {
  clash: Clash | null;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string) => void;
  onFocusClash?: (clash: Clash) => void;
  onCollisionChange?: (isColliding: boolean, message: string | null) => void;
  hiddenObjectIds?: string[];
  overviewScene?: SceneObject[] | null;
  allowObjectMove?: boolean;
  adapter?: ViewerAdapter;
  testScopeObjectIds?: string[];
  deEmphasizeUnrelated?: boolean;
  showScopeBadge?: boolean;
  hideUnrelatedActive?: boolean;
  /** XKT federated models loaded in xeokit for hybrid render — both overview and clash detail. */
  projectSlug?: string | null;
  xktModels?: { id: string }[];
  /** Real mesh triangle positions per object id (flat array, every 9 floats = 1 triangle, world-space meters). */
  objectMeshPositions?: Record<string, number[]>;
}

export default function Viewer3D({
  clash,
  selectedObjectId,
  onSelectObject,
  onFocusClash,
  onCollisionChange,
  hiddenObjectIds = [],
  overviewScene,
  allowObjectMove = true,
  adapter,
  testScopeObjectIds = [],
  deEmphasizeUnrelated = false,
  showScopeBadge = false,
  hideUnrelatedActive = false,
  projectSlug = null,
  xktModels,
  objectMeshPositions = {},
}: Viewer3DProps) {
  const xeokitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const xeokitBootstrappedRef = useRef(false);
  const [xeokitAdapter, setXeokitAdapter] = useState<XeoKitViewerAdapter | null>(null);
  const clashStore = useClashViewerStore();

  const { objects, hasCollision, collisionMessage, selectObject } = useObjectInteraction(
    clash,
    selectedObjectId,
    {
      overviewScene: !clash ? overviewScene ?? undefined : undefined,
      allowObjectDrag: allowObjectMove,
    }
  );

  const modelOverview = Boolean(!clash && overviewScene !== undefined);
  const effectiveAdapter = adapter ?? xeokitAdapter;
  const xeokitInteractive = Boolean(xeokitAdapter);
  const visibleObjects = objects.filter((object) => !hiddenObjectIds.includes(object.id));

  /**
   * Pre-transform raw IFC-world-space mesh positions into viewer-space so xeokit
   * renders them at the correct scale/location (same as bounding boxes).
   *
   * Origin strategy:
   *  - Clash detail: midpoint of objectA and objectB worldPositions
   *  - Overview:     bbox-center of all sceneObjects (same as buildOverviewSceneFromFederated)
   */
  const viewerSpaceMeshPositions = useMemo<Record<string, number[]>>(() => {
    if (!Object.keys(objectMeshPositions).length) return {};

    let originWorld: [number, number, number] | null = null;

    if (clash) {
      const scene = clashStore.getScene(clash.id);
      const sa = scene?.find((o) => o.id === clash.objectA);
      const sb = scene?.find((o) => o.id === clash.objectB);
      if (sa?.worldPosition && sb?.worldPosition) {
        originWorld = [
          (sa.worldPosition[0] + sb.worldPosition[0]) / 2,
          (sa.worldPosition[1] + sb.worldPosition[1]) / 2,
          (sa.worldPosition[2] + sb.worldPosition[2]) / 2,
        ];
      }
    } else if (overviewScene?.length) {
      originWorld = computeWorldOriginFromScene(overviewScene);
    }

    if (!originWorld) return {};

    const result: Record<string, number[]> = {};
    for (const [id, positions] of Object.entries(objectMeshPositions)) {
      if (positions.length >= 9) {
        result[id] = transformMeshPositionsToViewerSpace(positions, originWorld);
      }
    }
    return result;
  }, [clash, clashStore, objectMeshPositions, overviewScene]);
  const xktModelIdsKey = useMemo(
    () => (xktModels ?? []).map((m) => m.id).sort().join(','),
    [xktModels]
  );
  const hasXktOverview = Boolean(xktModels && xktModels.length > 0);
  const overviewHasCanvas =
    modelOverview && ((overviewScene?.length ?? 0) > 0 || hasXktOverview);

  useEffect(() => {
    onCollisionChange?.(hasCollision, collisionMessage);
  }, [collisionMessage, hasCollision, onCollisionChange]);

  useEffect(() => {
    if (xeokitBootstrappedRef.current || xeokitAdapter) return;
    const canvas = xeokitCanvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const initXeokit = async () => {
      try {
        const xeokit = await import('@xeokit/xeokit-sdk');
        if (cancelled) return;
        const ViewerCtor = (xeokit as { Viewer?: new (cfg: any) => any }).Viewer;
        const SceneModelCtor = (xeokit as { SceneModel?: new (scene: unknown, cfg: Record<string, unknown>) => any }).SceneModel;
        if (!ViewerCtor || !SceneModelCtor) return;

        const viewer = new ViewerCtor({
          canvasElement: canvas,
          transparent: true,
          antialias: true,
          dtxEnabled: true,
        });
        canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        viewer.camera.eye = [220, 180, 220];
        viewer.camera.look = [0, 0, 0];
        viewer.camera.up = [0, 1, 0];
        if (viewer.cameraControl) {
          viewer.cameraControl.navMode = 'orbit';
          viewer.cameraControl.panRightClick = true; // RMB pan, LMB orbit
          viewer.cameraControl.zoomOnMouseWheel = true;
          viewer.cameraControl.followPointer = true;
          viewer.cameraControl.rotationInertia = 0;
          viewer.cameraControl.panInertia = 0;
          viewer.cameraControl.dollyInertia = 0;
          viewer.cameraControl.dragRotationRate = 380;
          viewer.cameraControl.mouseWheelDollyRate = 110;
          viewer.cameraControl.doublePickFlyTo = true;
        }

        xeokitBootstrappedRef.current = true;
        setXeokitAdapter(new XeoKitViewerAdapter(viewer, SceneModelCtor));
      } catch {
        // Keep loading placeholder if xeokit failed.
      }
    };

    void initXeokit();
    return () => {
      cancelled = true;
    };
  }, [clash?.id, modelOverview, xeokitAdapter]);

  useEffect(
    () => () => {
      xeokitAdapter?.dispose();
      xeokitBootstrappedRef.current = false;
    },
    [xeokitAdapter]
  );

  useEffect(() => {
    if (!xeokitAdapter) return;
    const clashZone =
      clash
        ? resolveClashZoneForViewer(clash, visibleObjects, clashStore.getScene(clash.id))
        : null;
    xeokitAdapter.loadSceneObjects(
      visibleObjects.map((object) => ({
        id: object.id,
        position: object.position,
        size: object.size,
        isPrimary: Boolean(clash && object.id === clash.objectA),
        isClashObject: Boolean(clash && (object.id === clash.objectA || object.id === clash.objectB)),
        isClashObjectB: Boolean(clash && object.id === clash.objectB),
        isColliding: object.isColliding,
        isSelected: object.isSelected,
        isInTestScope: testScopeObjectIds.includes(object.id),
        isDeEmphasized: deEmphasizeUnrelated && testScopeObjectIds.length > 0 && !testScopeObjectIds.includes(object.id),
        meshPositions: viewerSpaceMeshPositions[object.id] ?? null,
      })),
      clashZone
    );
  }, [clash, clashStore, deEmphasizeUnrelated, viewerSpaceMeshPositions, testScopeObjectIds, visibleObjects, xeokitAdapter, overviewScene]);

  /** Load and recolor XKT models in clash detail mode (parallel to bbox overlay). */
  useEffect(() => {
    if (!xeokitAdapter || !projectSlug || !clash) return;
    const ids = (xktModels ?? []).map((m) => m.id);
    if (ids.length === 0) return;
    const objectA = clash.objectA;
    const objectB = clash.objectB;
    void xeokitAdapter.syncXktModels(projectSlug, ids, () => {
      xeokitAdapter.recolorXktObjects(objectA, objectB, [objectA, objectB]);
    });
  }, [clash?.id, projectSlug, xeokitAdapter, xktModelIdsKey]);

  useEffect(() => {
    if (!xeokitAdapter || !projectSlug || !modelOverview) return;
    const ids = (xktModels ?? []).map((m) => m.id);
    void xeokitAdapter.syncXktModels(projectSlug, ids, () => {
      xeokitAdapter.recolorXktObjects(null, null, [], visibleObjects.map((o) => o.id), visibleObjects);
    });
  }, [modelOverview, projectSlug, xeokitAdapter, xktModelIdsKey, visibleObjects]);

  useEffect(() => {
    if (!effectiveAdapter) return;
    const unsubscribe = effectiveAdapter.onObjectPicked((objectId) => {
      selectObject(objectId);
      onSelectObject(objectId);
    });
    return () => unsubscribe();
  }, [effectiveAdapter, onSelectObject, selectObject]);

  useEffect(() => {
    if (!effectiveAdapter) return;
    effectiveAdapter.highlightObjects(selectedObjectId ? [selectedObjectId] : []);
  }, [effectiveAdapter, selectedObjectId]);

  if (!clash) {
    if (modelOverview && !overviewHasCanvas) {
      return (
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-8 text-center text-slate-500">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 flex h-20 w-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50">
              <svg className="h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">No elements to display</p>
            <p className="mt-1 text-xs text-slate-600">Elements may be hidden by model or category filters.</p>
          </div>
        </div>
      );
    }
    if (overviewHasCanvas) {
      const xktCount = xktModels?.length ?? 0;
      const boxCount = visibleObjects.length;
      const meshCount = visibleObjects.filter((o) => viewerSpaceMeshPositions[o.id]).length;
      const layerHint =
        xktCount && boxCount
          ? `${xktCount} XKT · ${boxCount} elements`
          : xktCount
            ? `${xktCount} XKT model${xktCount > 1 ? 's' : ''}`
            : meshCount
              ? `${meshCount}/${boxCount} real mesh · ${boxCount - meshCount} bbox`
              : `${boxCount} elements`;
      const renderHint =
        meshCount > 0
          ? `real mesh (recolored)`
          : xktCount > 0
            ? `XKT (recolored)`
            : `bbox overlay`;
      return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 text-white md:p-4">
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-slate-200">3D Overview</p>
            <p className="text-[11px] text-slate-500" title="Left-click drag to orbit · Right-click to pan · Scroll to zoom · Click to select.">
              xeokit · {layerHint}
              {renderHint !== 'bbox overlay' && (
                <span className="ml-1.5 text-cyan-400/60">· {renderHint}</span>
              )}
            </p>
          </div>
          <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-xl border border-[#2a3245] bg-[#0d1117]">
            <canvas ref={xeokitCanvasRef} className={cn('absolute inset-0 h-full w-full', xeokitInteractive ? 'pointer-events-auto' : 'pointer-events-none')} />
            {!xeokitInteractive && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e16] text-xs text-slate-400 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" />
                  Initializing 3D viewer...
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-8 text-center text-slate-500">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-20 w-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50">
            <svg className="h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">Select a clash to preview 3D highlighting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 text-white md:p-4">
      {/* Header: title + status badge */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-100">{clash.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Drag to orbit · Right-click to pan · Scroll to zoom
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium',
              hasCollision
                ? 'border-red-400/70 bg-red-500/15 text-red-300'
                : clash.resolved
                  ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-500/70 bg-slate-600/20 text-slate-300'
            )}
          >
            {hasCollision ? '⚡ Collision' : clash.resolved ? '✓ Resolved' : '● Active'}
          </div>
        </div>
      </div>

      {/* Canvas area with floating badges */}
      <div
        onDoubleClick={() => onFocusClash?.(clash)}
        className="relative min-h-[220px] flex-1 overflow-hidden rounded-xl border border-[#2a3245] bg-[#0d1117]"
      >
        <canvas ref={xeokitCanvasRef} className={cn('absolute inset-0 h-full w-full', xeokitInteractive ? 'pointer-events-auto' : 'pointer-events-none')} />
        {showScopeBadge && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-medium text-cyan-200 backdrop-blur-sm">
              ◎ Highlighted Set A/B
            </span>
            <span className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm',
              hideUnrelatedActive
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-slate-500/40 bg-slate-600/25 text-slate-300'
            )}>
              {hideUnrelatedActive ? '◐ Hiding unrelated' : '○ Show all'}
            </span>
          </div>
        )}
        {!xeokitInteractive && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e16] text-xs text-slate-400 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" />
              Initializing 3D viewer...
            </div>
          </div>
        )}
      </div>

      {/* Footer: object info row */}
      <div className="shrink-0 rounded-lg border border-[#2a3245] bg-[#131a2b] px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-mono text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400/80" />
            <span className="text-slate-300" title={clash.objectA}>{clash.objectA}</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400/80" />
            <span className="text-slate-300" title={clash.objectB}>{clash.objectB}</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <svg className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-slate-300" title={clash.location}>{clash.location}</span>
          </span>
          <span className={cn('ml-auto text-[10px]', xeokitInteractive ? 'text-emerald-400/70' : 'text-slate-500')}>
            {xeokitInteractive ? '✓ 3D navigation ready' : '⟳ loading...'}
          </span>
        </div>
      </div>
    </div>
  );
}

