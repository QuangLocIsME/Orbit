'use client';

import {
  useEffect,
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
import type { ViewerAdapter } from '../lib/viewerAdapter';

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
}

const clampScale = (value: number) => Math.min(2.2, Math.max(0.75, value));

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

  useEffect(() => {
    onCollisionChange?.(hasCollision, collisionMessage);
  }, [collisionMessage, hasCollision, onCollisionChange]);

  const visibleObjects = objects.filter((object) => !hiddenObjectIds.includes(object.id));

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
          <p className="max-w-sm text-sm text-[#6A7282]">
            No elements to show (hidden by model/category filters or missing bounding boxes).
          </p>
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
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:32px_32px] opacity-70" />
              {visibleObjects.map((object) => {
                const left = `calc(50% + ${object.position.x}px - ${object.size.width / 2}px)`;
                const top = `calc(50% + ${object.position.z}px - ${object.size.depth / 2}px)`;
                return (
                  <button
                    key={object.id}
                    type="button"
                    onClick={() => onSelectObject(object.id)}
                    className={cn(
                      'absolute rounded-lg border border-slate-300/90 bg-slate-100/80 text-left shadow-md transition-all duration-150',
                      object.isSelected ? 'ring-2 ring-sky-400/80' : '',
                      'cursor-default'
                    )}
                    style={{
                      left,
                      top,
                      width: `${object.size.width}px`,
                      height: `${object.size.depth}px`,
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
        onContextMenu={(event) => event.preventDefault()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={() => onFocusClash?.(clash)}
        className="relative min-h-[220px] flex-1 overflow-hidden rounded-lg border border-[#D1D5DC] bg-white"
      >
        <div
          className="absolute inset-0 transition-transform duration-75"
          style={{
            transform: `translate(${interaction.offset.x}px, ${interaction.offset.y}px) scale(${interaction.scale})`,
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:32px_32px] opacity-70" />

          {allowObjectMove && draggingObjectId && dragPreviewPosition && (
            (() => {
              const previewObj = objects.find((obj) => obj.id === draggingObjectId);
              if (!previewObj) return null;

              const left = `calc(50% + ${dragPreviewPosition.x}px - ${previewObj.size.width / 2}px)`;
              const top = `calc(50% + ${dragPreviewPosition.z}px - ${previewObj.size.depth / 2}px)`;

              return (
                <div
                  className={cn(
                    'pointer-events-none absolute rounded-xl border-2 border-dashed transition-all duration-75',
                    collisionMessage ? 'border-red-300/90 bg-red-400/12' : 'border-cyan-300/90 bg-cyan-300/10'
                  )}
                  style={{
                    left,
                    top,
                    width: `${previewObj.size.width}px`,
                    height: `${previewObj.size.depth}px`,
                  }}
                />
              );
            })()
          )}

          {visibleObjects.map((object) => {
            const left = `calc(50% + ${object.position.x}px - ${object.size.width / 2}px)`;
            const top = `calc(50% + ${object.position.z}px - ${object.size.depth / 2}px)`;
            const isPrimary = object.id === clash.objectA;

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
                  'absolute rounded-lg border text-left shadow-lg transition-all duration-150',
                  object.isSelected ? 'ring-2 ring-sky-200/70' : '',
                  object.isColliding ? 'border-red-400 bg-red-500/20 shadow-red-900/50' : isPrimary ? 'border-rose-400/60 bg-rose-500/10 shadow-rose-900/30' : 'border-emerald-400/50 bg-emerald-500/10 shadow-emerald-900/30',
                  allowObjectMove ? (draggingObjectId === object.id ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                )}
                style={{
                  left,
                  top,
                  width: `${object.size.width}px`,
                  height: `${object.size.depth}px`,
                }}
              >
                <span
                  className={cn(
                    'absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-medium',
                    object.isColliding ? 'bg-slate-950/90 text-red-200' : isPrimary ? 'bg-slate-950/80 text-rose-200' : 'bg-slate-950/80 text-emerald-200'
                  )}
                >
                  {object.label}
                </span>
              </button>
            );
          })}

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

          <div className="absolute left-[47%] top-[52%] rounded bg-white/95 px-2 py-1 text-[10px] font-medium text-[#155DFC] shadow">
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
