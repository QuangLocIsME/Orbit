'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useMeasureDistance, type Measurement } from '@/hooks/useMeasureDistance';

/** Compact measurement results panel — shared across overview and clash detail sections. */
function MeasurePanel({
  measurements,
  removeMeasurement,
  clearAllMeasurements,
  formatDistance,
}: {
  measurements: Measurement[];
  removeMeasurement: (id: string) => void;
  clearAllMeasurements: () => void;
  formatDistance: (meters: number) => string;
}) {
  return (
    <div className="w-64 shrink-0 overflow-y-auto rounded-xl border border-[#2a3245] bg-[#131a2b]">
      <div className="sticky top-0 z-10 border-b border-[#2a3245] bg-[#0d1117] px-3 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-200">Measurement Results</h3>
            <p className="text-[10px] text-slate-500">
              {measurements.length > 0
                ? `${measurements.length} measurement${measurements.length > 1 ? 's' : ''}`
                : 'No measurements yet'}
            </p>
          </div>
          {measurements.length > 0 && (
            <button
              onClick={clearAllMeasurements}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {measurements.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
          <svg className="mb-2 h-8 w-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <p className="text-[11px] text-slate-500">Click two points on the model to measure.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {measurements.map((m, i) => (
            <div key={m.id} className="group px-3 py-2.5 hover:bg-white/5 transition-colors">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded">
                  #{i + 1}
                </span>
                <button
                  onClick={() => removeMeasurement(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20 text-red-400"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-1.5 flex items-baseline gap-1.5">
                <span className="text-base font-bold text-white">{formatDistance(m.distance)}</span>
                <span className="text-[10px] text-slate-500">total</span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                <div className="flex flex-col items-center rounded bg-slate-800/50 p-1">
                  <span className="text-[9px] text-slate-600">X</span>
                  <span className="text-[10px] font-medium text-red-400">{formatDistance(m.xDistance)}</span>
                </div>
                <div className="flex flex-col items-center rounded bg-slate-800/50 p-1">
                  <span className="text-[9px] text-slate-600">Y</span>
                  <span className="text-[10px] font-medium text-green-400">{formatDistance(m.yDistance)}</span>
                </div>
                <div className="flex flex-col items-center rounded bg-slate-800/50 p-1">
                  <span className="text-[9px] text-slate-600">Z</span>
                  <span className="text-[10px] font-medium text-blue-400">{formatDistance(m.zDistance)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {measurements.length > 1 && (
        <div className="border-t border-[#2a3245] bg-[#0d1117] px-3 py-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Longest</span>
            <span className="font-medium text-slate-300">{formatDistance(Math.max(...measurements.map((m) => m.distance)))}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Shortest</span>
            <span className="font-medium text-slate-300">{formatDistance(Math.min(...measurements.map((m) => m.distance)))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
  /** Show measure distance toolbar + panel. Default true. */
  showMeasureToolbar?: boolean;
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
  showMeasureToolbar = true,
}: Viewer3DProps) {
  const xeokitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const xeokitBootstrappedRef = useRef(false);
  const [xeokitAdapter, setXeokitAdapter] = useState<XeoKitViewerAdapter | null>(null);
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  /** Raw xeokit Viewer instance — set after async init so useMeasureDistance can attach the plugin. */
  const rawViewerRef = useRef<unknown>(null);
  /** Cached doublePickFlyTo value so we can restore it when measurement mode ends. */
  const prevDoublePickFlyToRef = useRef<boolean>(true);
  const clashStore = useClashViewerStore();

  const {
    isActive: measureActive,
    measurements,
    activateMeasurement,
    deactivateMeasurement,
    clearAllMeasurements,
    removeMeasurement,
    formatDistance,
    onViewerReady,
  } = useMeasureDistance({ viewerRef: rawViewerRef });

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
        rawViewerRef.current = viewer;
        onViewerReady();
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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && measureActive) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const camCtrl = (rawViewerRef.current as any)?.cameraControl;
      if (camCtrl) camCtrl.doublePickFlyTo = prevDoublePickFlyToRef.current;
      deactivateMeasurement();
    }
  }, [measureActive, deactivateMeasurement]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const cancelMeasure = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const camCtrl = (rawViewerRef.current as any)?.cameraControl;
    if (camCtrl) camCtrl.doublePickFlyTo = prevDoublePickFlyToRef.current;
    deactivateMeasurement();
  };

  const toggleMeasure = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const camCtrl = (rawViewerRef.current as any)?.cameraControl;
    if (measureActive) {
      if (camCtrl) camCtrl.doublePickFlyTo = prevDoublePickFlyToRef.current;
      deactivateMeasurement();
    } else {
      if (camCtrl) {
        prevDoublePickFlyToRef.current = camCtrl.doublePickFlyTo ?? true;
        camCtrl.doublePickFlyTo = false;
      }
      activateMeasurement();
    }
  };

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

          <div className="flex flex-1 min-h-0 gap-3">
            {/* Canvas area with floating toolbar */}
            <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-xl border border-[#2a3245] bg-[#0d1117]">
              <canvas ref={xeokitCanvasRef} className={cn('absolute inset-0 h-full w-full', xeokitInteractive ? 'pointer-events-auto' : 'pointer-events-none')} />

              {/* Floating toolbar inside canvas */}
              {showMeasureToolbar && (
                <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1">
                  {/* Measure toggle */}
                  <button
                    onClick={toggleMeasure}
                    disabled={!xeokitInteractive}
                    className={cn(
                      'pointer-events-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shadow-lg',
                      measureActive
                        ? 'bg-indigo-500 text-white shadow-indigo-500/30'
                        : 'bg-[#1a2332]/90 border border-[#2a3245] text-slate-300 hover:bg-[#243044]/90 backdrop-blur-sm',
                      !xeokitInteractive ? 'opacity-40 cursor-not-allowed' : ''
                    )}
                    title="Measure Distance"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>{measureActive ? 'Measuring...' : 'Measure'}</span>
                    {measurements.length > 0 && (
                      <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-400 text-white text-[10px]">
                        {measurements.length}
                      </span>
                    )}
                  </button>

                  {/* Cancel (only when measuring) */}
                  {measureActive && (
                    <button
                      onClick={cancelMeasure}
                      className="pointer-events-auto flex items-center gap-1 rounded-lg bg-[#1a2332]/90 border border-[#2a3245] px-2 py-1.5 text-xs text-slate-300 hover:bg-[#243044]/90 backdrop-blur-sm transition-all shadow-lg"
                      title="Cancel measurement"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {/* Results toggle */}
                  <button
                    onClick={() => setShowMeasurePanel(v => !v)}
                    disabled={!xeokitInteractive}
                    className={cn(
                      'pointer-events-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shadow-lg',
                      showMeasurePanel
                        ? 'bg-indigo-500/20 border border-indigo-400/50 text-indigo-300'
                        : 'bg-[#1a2332]/90 border border-[#2a3245] text-slate-300 hover:bg-[#243044]/90 backdrop-blur-sm',
                      !xeokitInteractive ? 'opacity-40 cursor-not-allowed' : ''
                    )}
                    title="Toggle Results Panel"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Results</span>
                  </button>

                  {/* Clear All */}
                  {measurements.length > 0 && (
                    <button
                      onClick={clearAllMeasurements}
                      className="pointer-events-auto flex items-center gap-1 rounded-lg bg-[#1a2332]/90 border border-[#2a3245] px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/15 backdrop-blur-sm transition-all shadow-lg"
                      title="Clear All Measurements"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}

                  {/* Measure hint */}
                  {measureActive && (
                    <div className="ml-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 px-2 py-1 text-[10px] text-indigo-300 shadow-lg backdrop-blur-sm">
                      Click first point, then second
                    </div>
                  )}
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

            {showMeasureToolbar && showMeasurePanel && xeokitInteractive && (
              <MeasurePanel
                measurements={measurements}
                removeMeasurement={removeMeasurement}
                clearAllMeasurements={clearAllMeasurements}
                formatDistance={formatDistance}
              />
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

      {/* Canvas + Footer + Measure Panel */}
      <div className="flex flex-1 min-h-0 gap-3">
        {/* Canvas area with floating toolbar + badges */}
        <div
          onDoubleClick={() => onFocusClash?.(clash)}
          className="relative min-h-[220px] flex-1 overflow-hidden rounded-xl border border-[#2a3245] bg-[#0d1117]"
        >
          <canvas ref={xeokitCanvasRef} className={cn('absolute inset-0 h-full w-full', xeokitInteractive ? 'pointer-events-auto' : 'pointer-events-none')} />

          {/* Floating toolbar inside canvas */}
          {showMeasureToolbar && (
            <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1">
              {/* Measure toggle */}
              <button
                onClick={toggleMeasure}
                disabled={!xeokitInteractive}
                className={cn(
                  'pointer-events-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shadow-lg',
                  measureActive
                    ? 'bg-indigo-500 text-white shadow-indigo-500/30'
                    : 'bg-[#1a2332]/90 border border-[#2a3245] text-slate-300 hover:bg-[#243044]/90 backdrop-blur-sm',
                  !xeokitInteractive ? 'opacity-40 cursor-not-allowed' : ''
                )}
                title="Measure Distance"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>{measureActive ? 'Measuring...' : 'Measure'}</span>
                {measurements.length > 0 && (
                  <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-400 text-white text-[10px]">
                    {measurements.length}
                  </span>
                )}
              </button>

              {measureActive && (
                <button
                  onClick={cancelMeasure}
                  className="pointer-events-auto flex items-center gap-1 rounded-lg bg-[#1a2332]/90 border border-[#2a3245] px-2 py-1.5 text-xs text-slate-300 hover:bg-[#243044]/90 backdrop-blur-sm transition-all shadow-lg"
                  title="Cancel"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              <button
                onClick={() => setShowMeasurePanel(v => !v)}
                disabled={!xeokitInteractive}
                className={cn(
                  'pointer-events-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shadow-lg',
                  showMeasurePanel
                    ? 'bg-indigo-500/20 border border-indigo-400/50 text-indigo-300'
                    : 'bg-[#1a2332]/90 border border-[#2a3245] text-slate-300 hover:bg-[#243044]/90 backdrop-blur-sm',
                  !xeokitInteractive ? 'opacity-40 cursor-not-allowed' : ''
                )}
                title="Toggle Results"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Results</span>
              </button>

              {measurements.length > 0 && (
                <button
                  onClick={clearAllMeasurements}
                  className="pointer-events-auto flex items-center gap-1 rounded-lg bg-[#1a2332]/90 border border-[#2a3245] px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/15 backdrop-blur-sm transition-all shadow-lg"
                  title="Clear All"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              {measureActive && (
                <div className="ml-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 px-2 py-1 text-[10px] text-indigo-300 shadow-lg backdrop-blur-sm">
                  Click first point, then second
                </div>
              )}
            </div>
          )}

          {/* Scope badges */}
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

        <div className="flex flex-col flex-1 min-h-0 gap-3">
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

        {showMeasureToolbar && showMeasurePanel && xeokitInteractive && (
          <MeasurePanel
            measurements={measurements}
            removeMeasurement={removeMeasurement}
            clearAllMeasurements={clearAllMeasurements}
            formatDistance={formatDistance}
          />
        )}
      </div>
    </div>
  );
}

