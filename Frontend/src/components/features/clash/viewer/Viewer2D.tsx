'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type PointerEventHandler,
  type WheelEventHandler,
} from 'react';
import { cn } from '@/lib/utils';
import type { Clash, ViewerInteractionState } from '../types/clashes';
import { useObjectInteraction } from '../hooks/useObjectInteraction';
import type { SceneObject } from '../lib/clashScene';
import { WORLD_SCALE, clampWorld, resolveClashZoneForViewer } from '../lib/clashScene';
import type { ViewerAdapter } from '../lib/viewerAdapter';
import { useClashViewerStore } from '../state/clashStore';

interface Viewer2DProps {
  clash: Clash | null;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string) => void;
  onFocusClash?: (clash: Clash) => void;
  /** Keeps ClashesTab Resolve button in sync when only the 2D panel is used (or after 2D drags). */
  onCollisionChange?: (isColliding: boolean, message: string | null) => void;
  hiddenObjectIds?: string[];
  /** When there is no clash: overview scene from federated model (bbox). `undefined` disables overview. */
  overviewScene?: SceneObject[] | null;
  /** When false, objects cannot be dragged; use zoom / pan only (clash review mode). Default true. */
  allowObjectMove?: boolean;
  /**
   * Optional ViewerAdapter — chuẩn bị cho tích hợp XeoKit.
   * Hiện mock viewer tự xử lý; adapter sẽ được dùng khi XeoKit sẵn sàng.
   */
  adapter?: ViewerAdapter;
  /** Optional world-space clash mesh positions by object id (x,y,z flat array). */
  objectMeshPositions?: Record<string, number[]>;
  testScopeObjectIds?: string[];
  deEmphasizeUnrelated?: boolean;
  showScopeBadge?: boolean;
  hideUnrelatedActive?: boolean;
  /** True when federated overview has XKT in 3D but no bbox elements (2D plan stays empty). */
  hasXktOnlyOverview?: boolean;
}

const clampScale = (value: number) => Math.min(2.2, Math.max(0.75, value));
const MIN_RENDER_BOX_SIZE = 42;
const getRenderSize = (size: { width: number; depth: number }) => ({
  width: Math.max(size.width, MIN_RENDER_BOX_SIZE),
  depth: Math.max(size.depth, MIN_RENDER_BOX_SIZE),
});
const shouldShowLabel = (isPrimary: boolean, isSelected: boolean, isColliding: boolean) =>
  isPrimary || isSelected || isColliding;

type Footprint2D = {
  points: Array<{ x: number; z: number }>;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const cross = (o: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) =>
  (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

const convexHull = (points: Array<{ x: number; z: number }>) => {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));
  const lower: Array<{ x: number; z: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<{ x: number; z: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
};

const clashOriginXZ = (clash: Clash): [number, number] => {
  const a = clash.objectABBox;
  const b = clash.objectBBBox;
  if (a && b) {
    const ax = (a.min[0] + a.max[0]) / 2;
    const az = (a.min[2] + a.max[2]) / 2;
    const bx = (b.min[0] + b.max[0]) / 2;
    const bz = (b.min[2] + b.max[2]) / 2;
    return [(ax + bx) / 2, (az + bz) / 2];
  }
  return [clash.position[0] || 0, clash.position[2] || 0];
};

const buildFootprint = (positions: number[], origin: [number, number]): Footprint2D | null => {
  if (!Array.isArray(positions) || positions.length < 9) return null;
  const [originX, originZ] = origin;
  const rawPoints: Array<{ x: number; z: number }> = [];
  const step = positions.length > 15_000 ? 12 : 3;
  for (let i = 0; i + 2 < positions.length; i += step) {
    const x = Number(positions[i]);
    const z = Number(positions[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    rawPoints.push({
      x: clampWorld((x - originX) * WORLD_SCALE),
      z: clampWorld((z - originZ) * WORLD_SCALE),
    });
  }
  if (rawPoints.length < 3) return null;
  const points = convexHull(rawPoints);
  if (points.length < 3) return null;
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return {
    points,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
};

export default function Viewer2D({
  clash,
  selectedObjectId,
  onSelectObject,
  onFocusClash,
  onCollisionChange,
  hiddenObjectIds = [],
  overviewScene,
  allowObjectMove = true,
  adapter: _adapter,
  objectMeshPositions = {},
  testScopeObjectIds = [],
  deEmphasizeUnrelated = false,
  showScopeBadge = false,
  hideUnrelatedActive = false,
  hasXktOnlyOverview = false,
}: Viewer2DProps) {
  const [interaction, setInteraction] = useState<ViewerInteractionState>({
    offset: { x: 0, y: 0 },
    scale: 1,
    orbitAngle: 0,
    sectionEnabled: false,
    measureEnabled: false,
    selectedObjectId,
  });
  const [dragging, setDragging] = useState(false);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const {
    objects,
    draggingObjectId,
    hasCollision,
    collisionMessage,
    dragPreviewPosition,
    lastValidPosition,
    beginDrag,
    updateDrag,
    endDrag,
  } = useObjectInteraction(clash, selectedObjectId, {
    overviewScene: !clash ? overviewScene ?? undefined : undefined,
    allowObjectDrag: allowObjectMove,
  });

  const modelOverview = Boolean(!clash && overviewScene !== undefined);
  const clashStore = useClashViewerStore();

  useEffect(() => {
    onCollisionChange?.(hasCollision, collisionMessage);
  }, [collisionMessage, hasCollision, onCollisionChange]);

  const visibleObjects = objects.filter((object) => !hiddenObjectIds.includes(object.id));

  const clashOverlapPlan = useMemo(() => {
    if (!clash) return null;
    const zone = resolveClashZoneForViewer(clash, visibleObjects, clashStore.getScene(clash.id));
    if (!zone) return null;
    return {
      cx: zone.position.x,
      cz: zone.position.z,
      w: Math.max(zone.size.width, 14),
      d: Math.max(zone.size.depth, 14),
    };
  }, [clash, clashStore, visibleObjects]);

  const footprintsByObjectId = useMemo(() => {
    if (!clash) return {};
    const origin = clashOriginXZ(clash);
    const map: Record<string, Footprint2D> = {};
    visibleObjects.forEach((object) => {
      const mesh = objectMeshPositions[object.id];
      const footprint = buildFootprint(mesh || [], origin);
      if (footprint) map[object.id] = footprint;
    });
    return map;
  }, [clash, objectMeshPositions, visibleObjects]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || visibleObjects.length === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    visibleObjects.forEach((object) => {
      const halfW = object.size.width / 2;
      const halfD = object.size.depth / 2;
      minX = Math.min(minX, object.position.x - halfW);
      maxX = Math.max(maxX, object.position.x + halfW);
      minZ = Math.min(minZ, object.position.z - halfD);
      maxZ = Math.max(maxZ, object.position.z + halfD);
    });

    const sceneW = Math.max(40, maxX - minX);
    const sceneH = Math.max(40, maxZ - minZ);
    const bounds = viewport.getBoundingClientRect();
    const coverage = clash ? 0.82 : 0.72;
    const nextScale = clampScale(Math.min((bounds.width * coverage) / sceneW, (bounds.height * coverage) / sceneH));

    setInteraction((current) => ({
      ...current,
      scale: Number.isFinite(nextScale) ? nextScale : current.scale,
      offset: { x: 0, y: 0 },
    }));
  }, [clash?.id, modelOverview, visibleObjects]);

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    setInteraction((current) => ({
      ...current,
      scale: clampScale(current.scale + (event.deltaY < 0 ? 0.1 : -0.1)),
    }));
  };

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 1 && event.button !== 2) {
      return;
    }

    event.preventDefault();
    dragOriginRef.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragging || !dragOriginRef.current) {
      return;
    }

    const deltaX = event.clientX - dragOriginRef.current.x;
    const deltaY = event.clientY - dragOriginRef.current.y;

    dragOriginRef.current = { x: event.clientX, y: event.clientY };

    setInteraction((current) => ({
      ...current,
      offset: {
        x: current.offset.x + deltaX,
        y: current.offset.y + deltaY,
      },
    }));
  };

  const stopDragging: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragOriginRef.current = null;
    setDragging(false);
  };

  if (!clash) {
    if (modelOverview && overviewScene!.length === 0) {
      return (
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 text-center">
          {hasXktOnlyOverview ? (
            <div className="max-w-sm space-y-2 text-sm text-[#6A7282]">
              <p>2D overview needs bounding boxes from JSON or IFC metadata.</p>
              <p className="text-xs text-[#9CA3AF]">
                An XKT model is available — open the <span className="font-medium text-[#374151]">3D</span> view to see it.
              </p>
            </div>
          ) : (
            <p className="max-w-sm text-sm text-[#6A7282]">
              No elements to show (hidden by model/category filters or missing bounding boxes).
            </p>
          )}
        </div>
      );
    }
    if (modelOverview && overviewScene!.length > 0) {
      return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 md:p-3">
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b border-[#E5E7EB] pb-2">
            <p className="text-[11px] font-medium text-[#101828]">2D overview</p>
            <p className="max-w-[min(100%,28rem)] truncate text-[10px] text-[#6A7282]" title="Wheel zoom · MMB/RMB pan · click to select.">
              Zoom · pan · click · {visibleObjects.length} elements
            </p>
          </div>
          <div
            ref={viewportRef}
            onContextMenu={(event) => event.preventDefault()}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            className="relative min-h-[200px] flex-1 overflow-hidden rounded-lg border border-[#D1D5DC] bg-white"
          >
            <div
              className="absolute inset-0 transition-transform duration-75"
              style={{
                transform: `translate(${interaction.offset.x}px, ${interaction.offset.y}px) scale(${interaction.scale})`,
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_56%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:28px_28px] opacity-55" />
              {visibleObjects.map((object) => {
                const renderSize = getRenderSize(object.size);
                const left = `calc(50% + ${object.position.x}px - ${renderSize.width / 2}px)`;
                const top = `calc(50% + ${object.position.z}px - ${renderSize.depth / 2}px)`;
                return (
                  <button
                    key={object.id}
                    type="button"
                    onClick={() => onSelectObject(object.id)}
                    className={cn(
                      'absolute rounded-sm border border-slate-300/90 bg-white/95 text-left shadow-md transition-all duration-150',
                      object.isSelected ? 'ring-2 ring-sky-400/80' : '',
                      'cursor-default'
                    )}
                    style={{
                      left,
                      top,
                      width: `${renderSize.width}px`,
                      height: `${renderSize.depth}px`,
                    }}
                  >
                    <span className="absolute left-2 top-2 max-w-[calc(100%-12px)] truncate rounded bg-slate-900/85 px-2 py-1 text-[10px] font-medium text-slate-100">
                      {object.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 text-center">
        <div>
          <div className="mx-auto mb-2 flex h-24 w-32 items-center justify-center rounded-lg border-2 border-dashed border-[#D1D5DC]">
            <svg className="h-8 w-8 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <p className="text-sm text-[#6A7282]">Select a clash to focus the 2D view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 md:p-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-[#101828]">{clash.title}</p>
          <p className="mt-0.5 text-[10px] text-[#6A7282]">
            {allowObjectMove ? 'Wheel zoom · MMB/RMB pan · drag objects' : 'Wheel zoom · MMB/RMB pan · click objects'}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
          {clash.resolved ? 'Resolved' : 'Open'}
        </span>
      </div>

      <div
        ref={viewportRef}
        onContextMenu={(event) => event.preventDefault()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={() => onFocusClash?.(clash)}
        className="relative min-h-[220px] flex-1 overflow-hidden rounded-lg border border-[#D1D5DC] bg-white"
      >
        {showScopeBadge && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
            <span className="rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-800">
              Highlighted: Set A/B
            </span>
            <span className={cn(
              'rounded border px-2 py-0.5 text-[10px] font-medium',
              hideUnrelatedActive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-300 bg-slate-100 text-slate-600'
            )}>
              Hidden unrelated: {hideUnrelatedActive ? 'ON' : 'OFF'}
            </span>
          </div>
        )}
        <div
          className="absolute inset-0 transition-transform duration-75"
          style={{
            transform: `translate(${interaction.offset.x}px, ${interaction.offset.y}px) scale(${interaction.scale})`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_56%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:28px_28px] opacity-55" />

          {allowObjectMove && draggingObjectId && dragPreviewPosition && (
            (() => {
              const previewObj = objects.find((obj) => obj.id === draggingObjectId);
              if (!previewObj) return null;
              const renderSize = getRenderSize(previewObj.size);

              const left = `calc(50% + ${dragPreviewPosition.x}px - ${renderSize.width / 2}px)`;
              const top = `calc(50% + ${dragPreviewPosition.z}px - ${renderSize.depth / 2}px)`;

              return (
                <div
                  className={cn(
                    'pointer-events-none absolute rounded-xl border-2 border-dashed transition-all duration-75',
                    collisionMessage ? 'border-red-300/90 bg-red-400/12' : 'border-cyan-300/90 bg-cyan-300/10'
                  )}
                  style={{
                    left,
                    top,
                    width: `${renderSize.width}px`,
                    height: `${renderSize.depth}px`,
                  }}
                />
              );
            })()
          )}

          {visibleObjects.map((object) => {
            const renderSize = getRenderSize(object.size);
            const left = `calc(50% + ${object.position.x}px - ${renderSize.width / 2}px)`;
            const top = `calc(50% + ${object.position.z}px - ${renderSize.depth / 2}px)`;
            const isPrimary = object.id === clash.objectA;
            const isInTestScope = testScopeObjectIds.includes(object.id);
            const isDeEmphasized = deEmphasizeUnrelated && testScopeObjectIds.length > 0 && !isInTestScope;
            const footprint = footprintsByObjectId[object.id];

            if (footprint) {
              const rawW = Math.max(1, footprint.maxX - footprint.minX);
              const rawH = Math.max(1, footprint.maxZ - footprint.minZ);
              const width = Math.max(rawW, MIN_RENDER_BOX_SIZE);
              const height = Math.max(rawH, MIN_RENDER_BOX_SIZE);
              const sx = width / rawW;
              const sy = height / rawH;
              const centerX = (footprint.minX + footprint.maxX) / 2;
              const centerZ = (footprint.minZ + footprint.maxZ) / 2;
              const polyPoints = footprint.points
                .map((p: { x: number; z: number }) => `${((p.x - footprint.minX) * sx).toFixed(2)},${((p.z - footprint.minZ) * sy).toFixed(2)}`)
                .join(' ');

              return (
                <button
                  key={object.id}
                  type="button"
                  onClick={() => onSelectObject(object.id)}
                  {...(allowObjectMove
                    ? {
                        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          onSelectObject(object.id);
                          beginDrag(object.id, event.clientX, event.clientY);
                        },
                        onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
                          updateDrag(event.clientX, event.clientY);
                        },
                        onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                          endDrag();
                        },
                        onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                          endDrag();
                        },
                      }
                    : {})}
                  className={cn(
                    'group absolute text-left transition-all duration-150',
                    object.isSelected ? 'ring-2 ring-sky-200/70' : '',
                    isDeEmphasized && 'opacity-45',
                    allowObjectMove ? (draggingObjectId === object.id ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                  )}
                  style={{
                    left: `calc(50% + ${centerX}px - ${width / 2}px)`,
                    top: `calc(50% + ${centerZ}px - ${height / 2}px)`,
                    width: `${width}px`,
                    height: `${height}px`,
                  }}
                >
                  <svg className="h-full w-full drop-shadow-[0_2px_5px_rgba(0,0,0,0.2)]" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <polygon
                      points={polyPoints}
                      fill={isDeEmphasized ? 'rgba(148,163,184,0.20)' : object.isColliding ? 'rgba(239,68,68,0.25)' : isPrimary ? 'rgba(16,185,129,0.20)' : 'rgba(250,204,21,0.25)'}
                      stroke={isDeEmphasized ? 'rgba(148,163,184,0.92)' : object.isColliding ? 'rgba(248,113,113,0.95)' : isPrimary ? 'rgba(52,211,153,0.92)' : 'rgba(250,204,21,0.95)'}
                      strokeWidth={1.6}
                    />
                  </svg>
                  <span
                    className={cn(
                      'absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-medium transition-opacity',
                      shouldShowLabel(isPrimary, object.isSelected, object.isColliding) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                      object.isColliding ? 'bg-slate-950/90 text-red-200' : isPrimary ? 'bg-emerald-950/90 text-emerald-200' : 'bg-amber-950/90 text-amber-200'
                    )}
                  >
                    {object.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={object.id}
                type="button"
                onClick={() => onSelectObject(object.id)}
                {...(allowObjectMove
                  ? {
                      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onSelectObject(object.id);
                        beginDrag(object.id, event.clientX, event.clientY);
                      },
                      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
                        updateDrag(event.clientX, event.clientY);
                      },
                      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                        endDrag();
                      },
                      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                        endDrag();
                      },
                    }
                  : {})}
                className={cn(
                  'group absolute rounded-sm border text-left shadow-lg transition-all duration-150',
                  object.isSelected ? 'ring-2 ring-sky-200/70' : '',
                    isDeEmphasized
                    ? 'border-slate-300 bg-slate-400/16 shadow-slate-900/10 opacity-70'
                    : object.isColliding
                      ? 'border-red-400 bg-red-500/20 shadow-red-900/50'
                      : isPrimary
                        ? 'border-emerald-400/60 bg-emerald-500/10 shadow-emerald-900/30'
                        : 'border-amber-400/50 bg-amber-500/10 shadow-amber-900/30',
                  allowObjectMove ? (draggingObjectId === object.id ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                )}
                style={{
                  left,
                  top,
                  width: `${renderSize.width}px`,
                  height: `${renderSize.depth}px`,
                }}
              >
                <span
                  className={cn(
                    'absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-medium transition-opacity',
                    shouldShowLabel(isPrimary, object.isSelected, object.isColliding) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                    object.isColliding ? 'bg-slate-950/90 text-red-200' : isPrimary ? 'bg-emerald-950/90 text-emerald-200' : 'bg-amber-950/90 text-amber-200'
                  )}
                >
                  {object.label}
                </span>
              </button>
            );
          })}

          {clashOverlapPlan && (
            <div
              className="pointer-events-none absolute z-[8] rounded-sm border-2 border-red-500/95 bg-red-500/35 shadow-[0_0_22px_rgba(239,68,68,0.45)]"
              style={{
                left: `calc(50% + ${clashOverlapPlan.cx}px - ${clashOverlapPlan.w / 2}px)`,
                top: `calc(50% + ${clashOverlapPlan.cz}px - ${clashOverlapPlan.d / 2}px)`,
                width: `${clashOverlapPlan.w}px`,
                height: `${clashOverlapPlan.d}px`,
              }}
            />
          )}

          {allowObjectMove && draggingObjectId && lastValidPosition && (
            <div
              className="pointer-events-none absolute rounded-full border border-emerald-300/80 bg-emerald-400/15 px-2 py-1 text-[10px] font-medium text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.35)]"
              style={{
                left: `calc(50% + ${lastValidPosition.x}px - 44px)`,
                top: `calc(50% + ${lastValidPosition.z}px - 14px)`,
              }}
            >
              Snap back
            </div>
          )}

          <div className="absolute left-[47%] top-[52%] rounded border border-blue-200 bg-white/95 px-2 py-1 text-[10px] font-medium text-[#155DFC] shadow">
            {clash.distance ?? '0.00 m'}
          </div>
          <div className="absolute left-[48%] top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#155DFC] px-2 py-1 text-[10px] font-medium text-white shadow">
            Clash
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#E5E7EB] pt-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] leading-tight text-[#6A7282]">
          <span className="max-w-[min(100%,14rem)] truncate font-mono text-[#364153]" title={clash.objectA}>
            A {clash.objectA}
          </span>
          <span className="max-w-[min(100%,14rem)] truncate font-mono text-[#364153]" title={clash.objectB}>
            B {clash.objectB}
          </span>
          <span className="max-w-[min(100%,12rem)] truncate" title={clash.location}>
            {clash.location}
          </span>
          <span>
            ×{interaction.scale.toFixed(2)} · {interaction.offset.x.toFixed(0)},{interaction.offset.y.toFixed(0)}px
          </span>
        </div>
      </div>
    </div>
  );
}
