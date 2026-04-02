'use client';

import { useEffect, useRef, useState, type PointerEventHandler, type WheelEventHandler } from 'react';
import { cn } from '@/lib/utils';
import type { Clash, ViewerInteractionState } from '@/data/clashes';
import { useObjectInteraction } from '@/hooks/useObjectInteraction';
import type { ViewerAdapter } from '../../lib/viewerAdapter';

interface Viewer3DProps {
  clash: Clash | null;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string) => void;
  onFocusClash?: (clash: Clash) => void;
  onCollisionChange?: (isColliding: boolean, message: string | null) => void;
  /**
   * Optional ViewerAdapter. Khi được truyền vào, viewer sẽ delegate
   * highlightObjects / focusObject sang adapter.
   * Hiện chưa có XeoKit nên mock viewer tự xử lý; prop này chuẩn bị cho tương lai.
   */
  adapter?: ViewerAdapter;
}

const clampScale = (value: number) => Math.min(2.4, Math.max(0.7, value));

export default function Viewer3D({
  clash,
  selectedObjectId,
  onSelectObject,
  onFocusClash,
  onCollisionChange,
  adapter,
}: Viewer3DProps) {
  const [interaction, setInteraction] = useState<ViewerInteractionState>({
    offset: { x: 0, y: 0 },
    scale: 1,
    orbitAngle: -12,
    sectionEnabled: false,
    measureEnabled: true,
    selectedObjectId,
  });
  const [dragMode, setDragMode] = useState<'pan' | 'orbit' | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const {
    objects,
    draggingObjectId,
    hasCollision,
    collisionMessage,
    dragPreviewPosition,
    lastValidPosition,
    selectObject,
    beginDrag,
    updateDrag,
    endDrag,
  } = useObjectInteraction(clash, selectedObjectId);

  useEffect(() => {
    onCollisionChange?.(hasCollision, collisionMessage);
  }, [collisionMessage, hasCollision, onCollisionChange]);

  // Notify adapter when selection changes (forward-compatible with XeoKit)
  useEffect(() => {
    if (!adapter || !selectedObjectId) return;
    adapter.highlightObjects([selectedObjectId]);
  }, [adapter, selectedObjectId]);

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setInteraction((current) => ({
      ...current,
      scale: clampScale(current.scale + (event.deltaY < 0 ? 0.1 : -0.1)),
    }));
  };

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    const objectId = (event.target as HTMLElement).closest<HTMLElement>('[data-object-id]')?.dataset.objectId;
    if (objectId) {
      event.preventDefault();
      beginDrag(objectId, event.clientX, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);
      onSelectObject(objectId);
      return;
    }

    const nextMode =
      event.button === 0 ? 'orbit' : event.button === 1 || event.button === 2 ? 'pan' : null;

    if (!nextMode) {
      return;
    }

    event.preventDefault();
    dragOriginRef.current = { x: event.clientX, y: event.clientY };
    setDragMode(nextMode);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (draggingObjectId) {
      updateDrag(event.clientX, event.clientY);
      return;
    }

    if (!dragMode || !dragOriginRef.current) {
      return;
    }

    const deltaX = event.clientX - dragOriginRef.current.x;
    const deltaY = event.clientY - dragOriginRef.current.y;

    dragOriginRef.current = { x: event.clientX, y: event.clientY };

    setInteraction((current) => ({
      ...current,
      offset:
        dragMode === 'pan'
          ? {
              x: current.offset.x + deltaX,
              y: current.offset.y + deltaY,
            }
          : current.offset,
      orbitAngle: dragMode === 'orbit' ? current.orbitAngle + deltaX * 0.35 : current.orbitAngle,
      sectionEnabled: dragMode === 'orbit' ? current.sectionEnabled : current.sectionEnabled,
    }));
  };

  const stopDragging: PointerEventHandler<HTMLDivElement> = (event) => {
    if (draggingObjectId) {
      endDrag();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragOriginRef.current = null;
    setDragMode(null);
  };

  if (!clash) {
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 text-center text-slate-400">
        <div>
          <div className="mx-auto mb-2 flex h-32 w-48 items-center justify-center rounded-lg border-2 border-dashed border-[#4A5565]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <p className="text-sm">Select a clash to preview future xeokit highlighting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col gap-4 p-4 text-white md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">3D Clash Preview</p>
          <h4 className="mt-2 text-base font-medium">{clash.title}</h4>
          <p className="mt-2 text-sm text-slate-300">Left drag empty space to orbit, middle/right drag to pan, drag object cards to move on the X/Z plane.</p>
        </div>
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs',
            hasCollision ? 'border-red-400/60 bg-red-500/10 text-red-100' : 'border-slate-700 text-slate-200'
          )}
        >
          {hasCollision ? 'Collision detected' : clash.resolved ? 'Resolved clash' : 'Active clash'}
        </div>
      </div>

      <div
        onContextMenu={(event) => event.preventDefault()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={() => onFocusClash?.(clash)}
        className="relative mx-auto h-[360px] w-full max-w-3xl shrink-0 overflow-hidden rounded-xl border border-[#4A5565] bg-[#111827]"
      >
        <div
          className="absolute inset-0 transition-transform duration-75"
          style={{
            transform: `translate(${interaction.offset.x}px, ${interaction.offset.y}px) scale(${interaction.scale}) perspective(1200px) rotateX(12deg) rotateY(${interaction.orbitAngle}deg)`,
            transformOrigin: 'center center',
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_55%)]" />
          {draggingObjectId && dragPreviewPosition && (
            <div
              className={cn(
                'pointer-events-none absolute rounded-xl border-2 border-dashed transition-all duration-75',
                hasCollision
                  ? 'border-red-300/90 bg-red-400/12'
                  : 'border-cyan-300/90 bg-cyan-300/10'
              )}
              style={{
                left: `calc(50% + ${dragPreviewPosition.x}px - 56px)`,
                top: `calc(50% + ${dragPreviewPosition.z}px - 44px)`,
                width: '112px',
                height: '88px',
                transform: 'rotate(4deg)',
              }}
            />
          )}
          {draggingObjectId && lastValidPosition && (
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
          {objects.map((object) => {
            const left = `calc(50% + ${object.position.x}px - ${object.size.width / 2}px)`;
            const top = `calc(50% + ${object.position.z}px - ${object.size.depth / 2}px)`;
            const isPrimary = object.id === clash.objectA;

            return (
              <button
                key={object.id}
                type="button"
                data-object-id={object.id}
                onClick={() => {
                  selectObject(object.id);
                  onSelectObject(object.id);
                }}
                className={cn(
                  'absolute rounded-xl border shadow-lg transition-all duration-150',
                  object.isSelected
                    ? 'ring-2 ring-white/70'
                    : '',
                  object.isColliding
                    ? 'border-red-400 bg-red-500/20 shadow-red-900/50'
                    : isPrimary
                      ? 'border-sky-400/60 bg-sky-500/10 shadow-sky-900/30'
                      : 'border-emerald-400/50 bg-emerald-500/10 shadow-emerald-900/30',
                  draggingObjectId === object.id ? 'cursor-grabbing' : 'cursor-grab'
                )}
                style={{
                  left,
                  top,
                  width: `${object.size.width}px`,
                  height: `${object.size.depth}px`,
                  transform: isPrimary ? 'rotate(-12deg)' : 'rotate(10deg)',
                }}
              >
                <span
                  className={cn(
                    'absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-medium',
                    object.isColliding
                      ? 'bg-slate-950/90 text-red-200'
                      : isPrimary
                        ? 'bg-slate-950/80 text-sky-200'
                        : 'bg-slate-950/80 text-emerald-200'
                  )}
                >
                  {object.label}
                </span>
              </button>
            );
          })}
          <div
            className={cn(
              'absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 backdrop-blur-sm shadow-[0_0_30px_rgba(248,113,113,0.25)]',
              hasCollision ? 'border-red-400/90 bg-red-500/30' : 'border-cyan-300/60 bg-cyan-300/10'
            )}
          />
          <div className="absolute inset-y-[6%] left-1/2 w-[2px] -translate-x-1/2 bg-cyan-300/80 shadow-[0_0_20px_rgba(34,211,238,0.35)] opacity-100" />
          <div className="absolute inset-y-[6%] left-[52%] w-[18%] bg-cyan-300/10 backdrop-blur-[1px] opacity-100" />
          <div className={cn('absolute left-[32%] top-[52%] h-0.5 w-[36%] shadow-[0_0_10px_rgba(255,255,255,0.4)]', hasCollision ? 'bg-red-300' : 'bg-white/90')} />
          <div className="absolute left-1/2 top-[46%] -translate-x-1/2 rounded bg-slate-900/90 px-2 py-1 text-[10px] font-medium text-cyan-200 shadow-lg">
            {clash.distance ?? '0.00 m'}
          </div>
          <div className={cn('absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-medium text-white shadow-lg', hasCollision ? 'bg-[#DC2626]' : 'bg-[#155DFC]')}>
            {hasCollision ? 'Invalid position' : 'Highlight'}
          </div>
        </div>
      </div>

      {collisionMessage && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {collisionMessage}
        </div>
      )}
      {draggingObjectId && !collisionMessage && (
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          Ghost preview shows the current drop target. Snap indicator marks the last valid placement.
        </div>
      )}

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Entity IDs</p>
          <p className="mt-1 font-medium">{clash.objectA}</p>
          <p className="text-slate-400">{clash.objectB}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Camera Target</p>
          <p className="mt-1 font-medium">{clash.location}</p>
          <p className="text-slate-400">Orbit {interaction.orbitAngle.toFixed(0)}deg</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Viewport</p>
          <p className="mt-1 font-medium">x {interaction.scale.toFixed(2)}</p>
          <p className="text-slate-400">{interaction.offset.x}px, {interaction.offset.y}px</p>
          <p className="mt-1 text-xs text-slate-500">Resize only affects layout. Object world positions stay fixed.</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Interaction State</p>
          <p className="mt-1 font-medium">{draggingObjectId ? `Dragging ${draggingObjectId}` : 'Idle'}</p>
          <p className="text-slate-400">{hasCollision ? 'Collision is blocking resolve.' : 'Placement is valid.'}</p>
          {lastValidPosition && (
            <p className="mt-1 text-xs text-slate-500">
              Last valid: X {lastValidPosition.x.toFixed(0)}, Z {lastValidPosition.z.toFixed(0)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
