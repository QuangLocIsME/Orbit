'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { BBox, Clash } from '../types/clashes';
import { useObjectInteraction } from '../hooks/useObjectInteraction';
import {
  computeClashDetailMeshOriginWorld,
  computeWorldOriginFromScene,
  transformMeshPositionsToViewerSpace,
  type SceneObject,
} from '../lib/clashScene';
import type { ViewerAdapter } from '../lib/viewerAdapter';
import { useClashViewerStore } from '../state/clashStore';
import { XeoKitViewerAdapter } from '../lib/xeoKitViewerAdapter';
import { useMeasureDistance, type Measurement } from '@/hooks/useMeasureDistance';
import { toast } from 'sonner';
import { AlertTriangle, Focus, Layers2 } from 'lucide-react';

/** Ensure CSS layout has given the canvas a non-zero size before creating WebGL (avoids 300×150 fallback). */
async function waitForCanvasLayout(canvas: HTMLCanvasElement, timeoutMs = 12000): Promise<void> {
  if (canvas.clientWidth > 0 && canvas.clientHeight > 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => {
      ro.disconnect();
      reject(new Error('Viewer canvas has no size — layout not ready'));
    }, timeoutMs);
    const ro = new ResizeObserver(() => {
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        window.clearTimeout(t);
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(canvas);
    requestAnimationFrame(() => {
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        window.clearTimeout(t);
        ro.disconnect();
        resolve();
      }
    });
  });
}

/** Union of axis-aligned boxes [xmin,ymin,zmin,xmax,ymax,zmax] in world metres. */
function unionWorldAABBs(pieces: number[][]): number[] | null {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of pieces) {
    if (!Array.isArray(p) || p.length < 6) continue;
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    minZ = Math.min(minZ, p[2]);
    maxX = Math.max(maxX, p[3]);
    maxY = Math.max(maxY, p[4]);
    maxZ = Math.max(maxZ, p[5]);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return [minX, minY, minZ, maxX, maxY, maxZ];
}

/**
 * Merge world AABBs for the clash pair — union every source that exists:
 * live xeokit entity bounds (one or both), federated `objectABBox` / `objectBBBox`, so Focus works when only one id resolves in XKT.
 */
function mergeClashWorldAabb(clash: Clash, adapter: XeoKitViewerAdapter): number[] | null {
  const pieces: number[][] = [];
  const ba = adapter.getObjectBoundingBox(clash.objectA);
  const bb = adapter.getObjectBoundingBox(clash.objectB);
  if (ba) pieces.push([ba.min[0], ba.min[1], ba.min[2], ba.max[0], ba.max[1], ba.max[2]]);
  if (bb) pieces.push([bb.min[0], bb.min[1], bb.min[2], bb.max[0], bb.max[1], bb.max[2]]);
  if (clash.objectABBox) {
    const a = clash.objectABBox;
    pieces.push([a.min[0], a.min[1], a.min[2], a.max[0], a.max[1], a.max[2]]);
  }
  if (clash.objectBBBox) {
    const b = clash.objectBBBox;
    pieces.push([b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2]]);
  }
  return unionWorldAABBs(pieces);
}

/** When the union of both element AABBs is smaller than this diagonal (m), frame that union directly. */
const MAX_FULL_PAIR_UNION_DIAG_M = 14;
/** Padding around a tight “clash neighborhood” when the pair union is huge (e.g. wall + fitting). */
const CLASH_NEIGHBORHOOD_PAD_M = 2.75;
/** Fallback cube half-size when only `clash.position` is reliable (metres). */
const POSITION_FALLBACK_HALF_M = 4;

function bboxToBox6(bb: { min: [number, number, number]; max: [number, number, number] }): number[] {
  return [bb.min[0], bb.min[1], bb.min[2], bb.max[0], bb.max[1], bb.max[2]];
}

/** World AABB for one clash element: prefer live XKT bounds, else backend `objectA/B` box. */
function box6ForClashElement(
  adapter: XeoKitViewerAdapter,
  objectId: string,
  fallback?: BBox
): number[] | null {
  const live = adapter.getObjectBoundingBox(objectId);
  if (live) {
    return [live.min[0], live.min[1], live.min[2], live.max[0], live.max[1], live.max[2]];
  }
  if (fallback) return bboxToBox6(fallback);
  return null;
}

function boxDiagonal(box: number[]): number {
  const [x0, y0, z0, x1, y1, z1] = box;
  return Math.hypot(x1 - x0, y1 - y0, z1 - z0);
}

function centerOfBox6(b: number[]): [number, number, number] {
  return [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
}

function isFinitePosition(p: unknown): p is [number, number, number] {
  if (!Array.isArray(p) || p.length < 3) return false;
  return [Number(p[0]), Number(p[1]), Number(p[2])].every((n) => Number.isFinite(n));
}

/** Minimal axis-aligned box containing all points, expanded by `pad` on every side. */
function aabbAroundPoints(points: Array<[number, number, number]>, pad: number): number[] | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of points) {
    minX = Math.min(minX, x - pad);
    minY = Math.min(minY, y - pad);
    minZ = Math.min(minZ, z - pad);
    maxX = Math.max(maxX, x + pad);
    maxY = Math.max(maxY, y + pad);
    maxZ = Math.max(maxZ, z + pad);
  }
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, minZ, maxX, maxY, maxZ];
}

/**
 * Camera framing for clash detail — **both conflicting objects** in view.
 * - Prefer the **union AABB** of object A and object B when that union is not huge.
 * - If the union is huge (typical: one bbox is an entire host wall), shrink to the neighborhood of
 *   **both element centers** plus **clash.position**, so the shot stays on the clash, not the whole wall.
 * - Avoid framing only on `clash.position` with a tiny cube — that missed XKT/object alignment.
 */
function buildClashFocusWorldAabb(clash: Clash, adapter: XeoKitViewerAdapter): number[] | null {
  const boxA = box6ForClashElement(adapter, clash.objectA, clash.objectABBox);
  const boxB = box6ForClashElement(adapter, clash.objectB, clash.objectBBBox);
  const mergedPair = unionWorldAABBs(
    [boxA, boxB].filter((b): b is number[] => Array.isArray(b) && b.length >= 6)
  );

  const mergedFallback = mergeClashWorldAabb(clash, adapter);

  if (!mergedPair) {
    if (mergedFallback) return mergedFallback;
    if (isFinitePosition(clash.position)) {
      const [px, py, pz] = clash.position.map(Number) as [number, number, number];
      const h = POSITION_FALLBACK_HALF_M;
      return [px - h, py - h, pz - h, px + h, py + h, pz + h];
    }
    return null;
  }

  const diag = boxDiagonal(mergedPair);
  if (diag <= MAX_FULL_PAIR_UNION_DIAG_M) {
    return mergedPair;
  }

  /** Large union: frame centers of A & B and the reported clash point (ignores oversized wall slabs). */
  const pts: Array<[number, number, number]> = [];
  if (boxA) pts.push(centerOfBox6(boxA));
  if (boxB) pts.push(centerOfBox6(boxB));
  if (isFinitePosition(clash.position)) {
    pts.push(clash.position.map(Number) as [number, number, number]);
  }
  const tight = aabbAroundPoints(pts, CLASH_NEIGHBORHOOD_PAD_M);
  if (tight) return tight;

  return mergedFallback ?? mergedPair;
}

/** Per-element visibility for clash pair when suppressing XKT/bbox (no mesh / proxy) — must restore `visible` when suppression clears. */
function applyClashSuppressedEntityVisibility(
  adapter: XeoKitViewerAdapter,
  clash: Clash,
  suppressed: string[]
): void {
  for (const id of [clash.objectA, clash.objectB] as const) {
    if (!id) continue;
    adapter.setEntitiesVisibility([id], !suppressed.includes(id));
  }
}

const isProxyCategory = (category?: string | null) =>
  (category ?? '').trim().toLowerCase() === 'buildingelementproxy';

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
    <div className="h-full min-h-0 w-64 shrink-0 overflow-y-auto rounded-xl border border-[#2a3245] bg-[#131a2b]">
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
  /** XKT federated models loaded in xeokit for hybrid render — both overview and clash detail. */
  projectSlug?: string | null;
  xktModels?: { id: string }[];
  /** When true, workspace already includes at least one XKT model — suppress bbox before `xktModels` is populated (e.g. after reload). */
  projectUsesXktGeometry?: boolean;
  /** While workspace is still loading, do not draw the bbox clash placeholder (avoids a red flash). */
  deferClashBboxOverlay?: boolean;
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
  projectSlug = null,
  xktModels,
  projectUsesXktGeometry = false,
  deferClashBboxOverlay = false,
  objectMeshPositions = {},
  showMeasureToolbar = true,
}: Viewer3DProps) {
  const clashRef = useRef(clash);
  clashRef.current = clash;

  const xeokitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const xeokitBootstrappedRef = useRef(false);
  const [xeokitAdapter, setXeokitAdapter] = useState<XeoKitViewerAdapter | null>(null);
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  /** XKT-only: dim/hide non-clash geometry; clash pair keeps native IFC colors. */
  const [xktIsolation, setXktIsolation] = useState<'off' | 'dim' | 'hide'>('dim');
  const isolationRef = useRef(xktIsolation);
  isolationRef.current = xktIsolation;
  /** True after XKT models for this workspace are in the viewer (reload when `xktModelIdsKey` changes). */
  const [clashDetailXktSynced, setClashDetailXktSynced] = useState(false);
  const missingPairToastForClashRef = useRef<string | null>(null);
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
  const clashProxyObjectIds = useMemo(() => {
    if (!clash) return [];
    const ids: string[] = [];
    if (isProxyCategory(clash.element1?.category)) ids.push(clash.objectA);
    if (isProxyCategory(clash.element2?.category)) ids.push(clash.objectB);
    return ids;
  }, [clash]);

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
      originWorld = computeClashDetailMeshOriginWorld(clash, objectMeshPositions, scene);
    } else if (overviewScene?.length) {
      originWorld = computeWorldOriginFromScene(overviewScene);
    }

    if (!originWorld) {
      /** Clash detail only: IFC mesh vertices in world space — matches XKT when scene origin is not ready yet. */
      if (!clash) return {};
      const worldAligned: Record<string, number[]> = {};
      for (const [id, positions] of Object.entries(objectMeshPositions)) {
        if (positions.length >= 9) worldAligned[id] = positions;
      }
      return worldAligned;
    }

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

  useEffect(() => {
    setXktIsolation('dim');
    missingPairToastForClashRef.current = null;
  }, [clash?.id]);

  /** Reset XKT loaded flag when federated model set changes (must reload binary). */
  useEffect(() => {
    setClashDetailXktSynced(false);
  }, [xktModelIdsKey]);

  const hasXktOverview = Boolean(xktModels && xktModels.length > 0);
  /** Derived synchronously so bbox overlay does not flash `null → {a,b}` when switching clashes. */
  const xktPairPresence = useMemo(() => {
    if (!clash || !xeokitAdapter || (xktModels?.length ?? 0) === 0 || !clashDetailXktSynced) return null;
    return {
      a: xeokitAdapter.hasXktEntity(clash.objectA),
      b: xeokitAdapter.hasXktEntity(clash.objectB),
    };
  }, [clash, xeokitAdapter, xktModels, clashDetailXktSynced]);
  /** Only skip bbox when both clash elements resolve in XKT — otherwise show federated bbox + XKT together. */
  const clashPairFullyInXkt = Boolean(xktPairPresence?.a && xktPairPresence?.b);
  /** Clash detail: hide SceneModel boxes only when both ids exist as XKT entities (otherwise bbox fallback stays visible). */
  const skipBboxOverlayBecauseXkt = Boolean(
    clash &&
      (((xktModels?.length ?? 0) > 0) ||
        projectUsesXktGeometry ||
        deferClashBboxOverlay ||
        clashDetailXktSynced) &&
      clashPairFullyInXkt
  );

  /**
   * Hide XKT entities only while SceneModel draws the extracted IFC mesh for the same id (avoid duplicate).
   * When `skipBboxOverlayBecauseXkt` we clear SceneModel — never suppress clash ids or XKT becomes empty (white canvas).
   */
  const clashNoRealMeshObjectIds = useMemo(() => {
    if (!clash || skipBboxOverlayBecauseXkt) return [];
    const ids: string[] = [];
    if (viewerSpaceMeshPositions[clash.objectA]?.length) ids.push(clash.objectA);
    if (viewerSpaceMeshPositions[clash.objectB]?.length) ids.push(clash.objectB);
    return ids;
  }, [clash, skipBboxOverlayBecauseXkt, viewerSpaceMeshPositions]);

  const suppressedClashObjectIds = useMemo(() => {
    if (clash && skipBboxOverlayBecauseXkt) return [];
    return Array.from(new Set([...clashProxyObjectIds, ...clashNoRealMeshObjectIds]));
  }, [clash, skipBboxOverlayBecauseXkt, clashProxyObjectIds, clashNoRealMeshObjectIds]);

  /** Latest suppression list for async XKT onLoaded — avoids stale closure without re-running sync (which would destroy XKT). */
  const suppressedClashRef = useRef(suppressedClashObjectIds);
  suppressedClashRef.current = suppressedClashObjectIds;

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

        try {
          await waitForCanvasLayout(canvas);
        } catch {
          return;
        }
        if (cancelled) return;

        const viewer = new ViewerCtor({
          canvasElement: canvas,
          transparent: false,
          backgroundColor: [0.05, 0.07, 0.125],
          antialias: true,
          dtxEnabled: false,
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
    /** In model overview, when XKT exists, render only native XKT geometry (no SceneModel proxy overlay). */
    if (modelOverview && (xktModels?.length ?? 0) > 0) {
      xeokitAdapter.loadSceneObjects([]);
      return;
    }
    if (skipBboxOverlayBecauseXkt) {
      xeokitAdapter.loadSceneObjects([]);
      return;
    }
    xeokitAdapter.loadSceneObjects(
      visibleObjects.map((object) => ({
        id: object.id,
        position: object.position,
        size: object.size,
        isPrimary: false,
        isClashObject: Boolean(clash && object.id === clash.objectA),
        isClashObjectB: Boolean(clash && object.id === clash.objectB),
        isColliding: object.isColliding,
        isSelected: object.isSelected,
        isInTestScope: testScopeObjectIds.includes(object.id),
        isDeEmphasized: deEmphasizeUnrelated && testScopeObjectIds.length > 0 && !testScopeObjectIds.includes(object.id),
        meshPositions: viewerSpaceMeshPositions[object.id] ?? null,
      }))
    );
  }, [
    clash,
    clashStore,
    deEmphasizeUnrelated,
    modelOverview,
    skipBboxOverlayBecauseXkt,
    clashDetailXktSynced,
    xktModels,
    viewerSpaceMeshPositions,
    testScopeObjectIds,
    visibleObjects,
    xeokitAdapter,
    overviewScene,
    xktModels,
  ]);

  /** Load XKT once per federated model set (clash detail). Overview uses the separate `modelOverview` effect below. */
  useEffect(() => {
    if (!xeokitAdapter || !projectSlug || !clash) return;
    const ids = (xktModels ?? []).map((m) => m.id);
    if (ids.length === 0) return;
    void xeokitAdapter.syncXktModels(
      projectSlug,
      ids,
      (loadedIds) => {
        if (loadedIds.length > 0) setClashDetailXktSynced(true);
        const c = clashRef.current;
        if (!c) return;
        const objectA = c.objectA;
        const objectB = c.objectB;
        /** Dim/Hide: recolor clash pair then isolation. All: neutral materials only (no green/yellow tint). */
        if (isolationRef.current === 'off') {
          xeokitAdapter.applyClashPairIsolation('off', objectA, objectB);
        } else {
          xeokitAdapter.recolorXktObjects(objectA, objectB, [objectA, objectB]);
          xeokitAdapter.applyClashPairIsolation(isolationRef.current, objectA, objectB);
        }
        applyClashSuppressedEntityVisibility(xeokitAdapter, c, suppressedClashRef.current);
        const hasA = xeokitAdapter.hasXktEntity(objectA);
        const hasB = xeokitAdapter.hasXktEntity(objectB);
        if ((!hasA || !hasB) && missingPairToastForClashRef.current !== c.id) {
          missingPairToastForClashRef.current = c.id;
          toast.warning(
            'Only part of this clash pair appears in the viewer. One IFC id may be missing from the XKT export, merged into another object, or use a different identifier than the clash result.'
          );
        }
        /**
         * Default camera fits the *entire* XKT — often jumps inside a wall (white slab). Frame the clash region instead.
         */
        const clashAabb = buildClashFocusWorldAabb(c, xeokitAdapter);
        if (clashAabb) {
          xeokitAdapter.flyCameraToWorldAabb(clashAabb);
        } else if (loadedIds.length > 0) {
          xeokitAdapter.fitCameraToLoadedXktUnion();
        }
      },
      { skipCameraFit: true }
    );
    /**
     * Do not depend on `suppressedClashObjectIds` here: when IFC mesh data arrives late, that array changes and
     * would re-run sync → destroyXktModels() → full XKT reload (~1s flash / white slab). Suppression is applied
     * in the effect below and via `suppressedClashRef` inside the async onLoaded callback.
     */
  }, [projectSlug, xeokitAdapter, xktModelIdsKey, clash?.id]);

  /** Re-apply isolation + highlight when the user changes dim/hide or suppression/mesh state — no XKT reload. */
  useEffect(() => {
    if (!xeokitAdapter || !clash) return;
    const ids = (xktModels ?? []).map((m) => m.id);
    if (ids.length === 0) return;
    if (!clashDetailXktSynced) return;
    if (xktIsolation === 'off') {
      xeokitAdapter.applyClashPairIsolation('off', clash.objectA, clash.objectB);
      applyClashSuppressedEntityVisibility(xeokitAdapter, clash, suppressedClashObjectIds);
      return;
    }
    xeokitAdapter.recolorXktObjects(clash.objectA, clash.objectB, [clash.objectA, clash.objectB]);
    xeokitAdapter.applyClashPairIsolation(xktIsolation, clash.objectA, clash.objectB);
    applyClashSuppressedEntityVisibility(xeokitAdapter, clash, suppressedClashObjectIds);
  }, [
    xktIsolation,
    xeokitAdapter,
    clash?.id,
    clash?.objectA,
    clash?.objectB,
    xktModelIdsKey,
    suppressedClashObjectIds,
    clashDetailXktSynced,
  ]);

  /** Section clipping removed from UI — always clear stale xeokit SectionPlanes. */
  useEffect(() => {
    if (!xeokitAdapter) return;
    xeokitAdapter.clearClashSectionBox();
  }, [xeokitAdapter, clash?.id]);

  useEffect(() => {
    if (!xeokitAdapter || !projectSlug || !modelOverview) return;
    const ids = (xktModels ?? []).map((m) => m.id);
    void xeokitAdapter.syncXktModels(projectSlug, ids, () => {
      xeokitAdapter.applyClashPairIsolation('off', null, null);
      xeokitAdapter.recolorXktObjects(null, null, [], visibleObjects.map((o) => o.id), visibleObjects);
    });
  }, [modelOverview, projectSlug, xeokitAdapter, xktModelIdsKey, visibleObjects]);

  useEffect(() => {
    if (!effectiveAdapter) return;
    const unsubscribe = effectiveAdapter.onObjectPicked((objectId) => {
      selectObject(objectId);
      onSelectObject(objectId);
      effectiveAdapter.focusObject(objectId);
    });
    return () => unsubscribe();
  }, [effectiveAdapter, onSelectObject, selectObject]);

  useEffect(() => {
    if (!effectiveAdapter) return;
    /** Overview should never keep per-object emphasis from previous clash selection. */
    if (!clash) {
      effectiveAdapter.highlightObjects([]);
      return;
    }
    /** "All" + XKT: xeokit highlight tints large subtrees (often solid blue) — show native materials like a desktop viewer. */
    const xktClash = Boolean(clash && (xktModels?.length ?? 0) > 0);
    if (xktClash && xktIsolation === 'off') {
      effectiveAdapter.highlightObjects([]);
      return;
    }
    effectiveAdapter.highlightObjects(selectedObjectId ? [selectedObjectId] : []);
  }, [effectiveAdapter, selectedObjectId, clash, xktModels, xktIsolation]);

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
              ? `${meshCount}/${boxCount} mesh preview · ${boxCount - meshCount} metadata-only`
              : `${boxCount} elements`;
      const renderHint =
        meshCount > 0
          ? `mesh preview (recolored)`
          : xktCount > 0
            ? `XKT (recolored)`
            : `metadata only (no mesh)`;
      const hideExtraRenderHint = renderHint === 'metadata only (no mesh)';
      return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 text-white md:p-4">
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-slate-200">3D Overview</p>
            <p className="text-[11px] text-slate-500" title="Left-click drag to orbit · Right-click to pan · Scroll to zoom · Click to select.">
              xeokit · {layerHint}
              {!hideExtraRenderHint && (
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

      {/* Canvas full width; footer strip below (IDs / location were beside canvas and wasted horizontal space). */}
      <div className="flex flex-1 min-h-0 flex-col gap-3">
        <div className="flex min-h-0 flex-1 gap-3">
          {/* Canvas area with floating toolbar + badges */}
        <div
          onDoubleClick={() => onFocusClash?.(clash)}
          className="relative min-h-[220px] min-w-0 flex-1 overflow-hidden rounded-xl border border-[#2a3245] bg-[#0d1117]"
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

              {(xktModels?.length ?? 0) > 0 && xeokitAdapter && clash && (
                <>
                  <div className="pointer-events-auto mx-0.5 hidden h-6 w-px shrink-0 bg-[#2a3245] sm:block" aria-hidden />
                  <button
                    type="button"
                    onClick={() => {
                      const aabb = buildClashFocusWorldAabb(clash, xeokitAdapter);
                      if (!aabb) {
                        toast.info('Bounding boxes are not ready yet — try again after the model loads.');
                        return;
                      }
                      xeokitAdapter.flyCameraToWorldAabb(aabb);
                    }}
                    disabled={!xeokitInteractive}
                    className={cn(
                      'pointer-events-auto flex items-center gap-1.5 rounded-lg border border-[#2a3245] bg-[#1a2332]/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 shadow-lg backdrop-blur-sm transition-all hover:bg-[#243044]/90',
                      !xeokitInteractive ? 'opacity-40 cursor-not-allowed' : ''
                    )}
                    title="Frame camera on the clash intersection (not full wall extents — stays farther back to reduce clipping noise)"
                  >
                    <Focus className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Focus region</span>
                  </button>
                  <div
                    className="pointer-events-auto flex flex-wrap items-center gap-0.5 rounded-lg border border-[#2a3245] bg-[#1a2332]/90 p-0.5 shadow-lg backdrop-blur-sm"
                    title="All: full XKT model. Dim/Hide: focus on the clash pair — matched XKT entities stay sharp; if ids are missing from XKT, unrelated geometry is dimmed/hidden and bbox markers show the pair."
                  >
                    {(['off', 'dim', 'hide'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={!xeokitInteractive}
                        onClick={() => setXktIsolation(mode)}
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors',
                          xktIsolation === mode
                            ? 'bg-slate-600 text-white'
                            : 'text-slate-400 hover:bg-[#243044] hover:text-slate-200',
                          !xeokitInteractive ? 'opacity-40 cursor-not-allowed' : ''
                        )}
                      >
                        {mode === 'off' ? 'All' : mode === 'dim' ? 'Dim' : 'Hide'}
                      </button>
                    ))}
                  </div>
                </>
              )}

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

          {/* XKT clash focus hint */}
          {(xktModels?.length ?? 0) > 0 && xktIsolation !== 'off' && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(100%,20rem)] rounded-lg border border-slate-600/60 bg-[#0d1117]/90 px-2.5 py-1.5 text-[10px] text-slate-400 backdrop-blur-sm">
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Layers2 className="h-3 w-3 shrink-0 text-cyan-400/80" />
                {xktIsolation === 'dim' ? 'Other elements dimmed — clash pair stays at full material color.' : 'Non-clash elements hidden in XKT.'}
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

        {showMeasureToolbar && showMeasurePanel && xeokitInteractive && (
          <MeasurePanel
            measurements={measurements}
            removeMeasurement={removeMeasurement}
            clearAllMeasurements={clearAllMeasurements}
            formatDistance={formatDistance}
          />
        )}
        </div>

        {/* Footer: clash pair ids + location — full width under canvas */}
        <div className="shrink-0 rounded-lg border border-[#2a3245] bg-[#131a2b] px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex max-w-full flex-wrap items-center gap-1.5 font-mono text-slate-400">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
              <span className="truncate text-slate-300" title={clash.objectA}>
                {clash.objectA}
              </span>
              {(xktModels?.length ?? 0) > 0 && xktPairPresence && !xktPairPresence.a && (
                <span className="shrink-0 rounded bg-amber-500/25 px-1.5 py-0.5 text-[9px] font-sans font-medium text-amber-200">
                  Not in XKT
                </span>
              )}
            </span>
            <span className="flex max-w-full flex-wrap items-center gap-1.5 font-mono text-slate-400">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" />
              <span className="truncate text-slate-300" title={clash.objectB}>
                {clash.objectB}
              </span>
              {(xktModels?.length ?? 0) > 0 && xktPairPresence && !xktPairPresence.b && (
                <span className="shrink-0 rounded bg-amber-500/25 px-1.5 py-0.5 text-[9px] font-sans font-medium text-amber-200">
                  Not in XKT
                </span>
              )}
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
          {(xktModels?.length ?? 0) > 0 && xktPairPresence && (!xktPairPresence.a || !xktPairPresence.b) && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-100/95">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
              <span>
                The clash is still valid in project data (two elements overlap). The viewer only draws geometry present in the XKT file — one IFC id may be absent from export, merged into a parent, or renamed.
                {' '}
                Switch isolation to <strong className="font-semibold text-amber-50">All</strong> to see the full model.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

