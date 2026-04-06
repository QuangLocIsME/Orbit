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
  /** Real mesh triangle positions per object id (flat array, every 9 floats = 1 triangle, world-space meters). */
  objectMeshPositions?: Record<string, number[]>;
  /**
   * When the clash scene has no `worldPosition` (e.g. missing objectABBox on API), use this IFC-world
   * midpoint (meters) so mesh can still be transformed — same idea as bbox-center midpoint of A & B.
   */
  clashMeshOriginWorld?: [number, number, number] | null;
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
  objectMeshPositions = {},
  clashMeshOriginWorld = null,
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
      } else if (
        clashMeshOriginWorld &&
        Number.isFinite(clashMeshOriginWorld[0]) &&
        Number.isFinite(clashMeshOriginWorld[1]) &&
        Number.isFinite(clashMeshOriginWorld[2])
      ) {
        originWorld = clashMeshOriginWorld;
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
  }, [clash, clashMeshOriginWorld, clashStore, objectMeshPositions, overviewScene]);
  const overviewHasCanvas = modelOverview && (overviewScene?.length ?? 0) > 0;

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
          antialias: false,
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
        isColliding: object.isColliding,
        isSelected: object.isSelected,
        isInTestScope: testScopeObjectIds.includes(object.id),
        isDeEmphasized: deEmphasizeUnrelated && testScopeObjectIds.length > 0 && !testScopeObjectIds.includes(object.id),
        meshPositions: viewerSpaceMeshPositions[object.id] ?? null,
      })),
      clashZone
    );
  }, [clash, clashStore, deEmphasizeUnrelated, viewerSpaceMeshPositions, testScopeObjectIds, visibleObjects, xeokitAdapter]);

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
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 text-center text-slate-400">
          <p className="max-w-sm text-sm">
            No elements to show (hidden by model/category filters or missing bounding boxes).
          </p>
        </div>
      );
    }
    if (overviewHasCanvas) {
      const boxCount = visibleObjects.length;
      const meshCount = visibleObjects.filter((o) => viewerSpaceMeshPositions[o.id]).length;
      const layerHint = meshCount
        ? `${meshCount}/${boxCount} mesh · ${boxCount - meshCount} bbox`
        : `${boxCount} elements`;
      return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 text-white md:p-3">
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b border-slate-700/60 pb-2">
            <p className="text-[11px] font-medium text-slate-200">3D overview</p>
            <p className="max-w-[min(100%,28rem)] truncate text-[10px] text-slate-500" title="LMB orbit · RMB/MMB pan · wheel zoom · click to select.">
              xeokit · {layerHint}
            </p>
          </div>
          <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-lg border border-[#4A5565] bg-[#111827]">
            <canvas ref={xeokitCanvasRef} className={cn('absolute inset-0 h-full w-full', xeokitInteractive ? 'pointer-events-auto' : 'pointer-events-none')} />
            {!xeokitInteractive && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a] text-xs text-slate-300">
                Initializing xeokit 3D viewer...
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 text-center text-slate-400">
        <div>
          <div className="mx-auto mb-2 flex h-32 w-48 items-center justify-center rounded-lg border-2 border-dashed border-[#4A5565]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <p className="text-sm">Select a clash to preview 3D highlighting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 text-white md:p-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-slate-100">{clash.title}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            LMB orbit · RMB/MMB pan · wheel zoom · click objects
          </p>
        </div>
        <div
          className={cn(
            'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium',
            hasCollision ? 'border-red-400/60 bg-red-500/10 text-red-100' : 'border-slate-600 text-slate-300'
          )}
        >
          {hasCollision ? 'Collision' : clash.resolved ? 'Resolved' : 'Active'}
        </div>
      </div>

      <div
        onDoubleClick={() => onFocusClash?.(clash)}
        className="relative min-h-[220px] flex-1 overflow-hidden rounded-lg border border-[#4A5565] bg-[#111827]"
      >
        <canvas ref={xeokitCanvasRef} className={cn('absolute inset-0 h-full w-full', xeokitInteractive ? 'pointer-events-auto' : 'pointer-events-none')} />
        {showScopeBadge && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
            <span className="rounded border border-cyan-300/50 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
              Highlighted: Set A/B
            </span>
            <span className={cn(
              'rounded border px-2 py-0.5 text-[10px] font-medium',
              hideUnrelatedActive
                ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                : 'border-slate-500/50 bg-slate-600/30 text-slate-200'
            )}>
              Hidden unrelated: {hideUnrelatedActive ? 'ON' : 'OFF'}
            </span>
          </div>
        )}
        {!xeokitInteractive && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a] text-xs text-slate-300">
            Initializing xeokit 3D viewer...
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-700/60 pt-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] leading-tight text-slate-500">
          <span className="max-w-[min(100%,14rem)] truncate font-mono text-slate-400" title={clash.objectA}>
            A <span className="text-slate-300">{clash.objectA}</span>
          </span>
          <span className="max-w-[min(100%,14rem)] truncate font-mono text-slate-400" title={clash.objectB}>
            B <span className="text-slate-300">{clash.objectB}</span>
          </span>
          <span className="max-w-[min(100%,12rem)] truncate" title={clash.location}>
            Loc <span className="text-slate-400">{clash.location}</span>
          </span>
          <span>{xeokitInteractive ? 'xeokit orbit/pan/zoom enabled' : 'xeokit is loading...'}</span>
        </div>
      </div>
    </div>
  );
}

