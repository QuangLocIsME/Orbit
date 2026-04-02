'use client';

import { useRef, useState, type PointerEventHandler, type WheelEventHandler } from 'react';
import { cn } from '@/lib/utils';
import type { Clash, ViewerInteractionState } from '@/data/clashes';
import { useObjectInteraction } from '@/hooks/useObjectInteraction';
import type { ViewerAdapter } from '../../lib/viewerAdapter';

interface Viewer2DProps {
  clash: Clash | null;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string) => void;
  onFocusClash?: (clash: Clash) => void;
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
    collisionMessage,
    dragPreviewPosition,
    lastValidPosition,
    beginDrag,
    updateDrag,
    endDrag,
  } = useObjectInteraction(clash, selectedObjectId);

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
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
    <div className="relative flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6A7282]">2D Clash Focus</p>
          <h4 className="mt-2 text-base font-medium text-[#101828]">{clash.title}</h4>
          <p className="mt-1 text-xs text-[#6A7282]">Wheel to zoom, middle/right drag to pan, drag object cards to move on the X/Z plane.</p>
        </div>
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          {clash.resolved ? 'Resolved' : 'Unresolved'}
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
        className="relative mx-auto h-[360px] w-full max-w-3xl shrink-0 overflow-hidden rounded-xl border border-[#D1D5DC] bg-white"
      >
        <div
          className="absolute inset-0 transition-transform duration-75"
          style={{
            transform: `translate(${interaction.offset.x}px, ${interaction.offset.y}px) scale(${interaction.scale})`,
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:32px_32px] opacity-70" />

          {draggingObjectId && dragPreviewPosition && (
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

          {objects.map((object) => {
            const left = `calc(50% + ${object.position.x}px - ${object.size.width / 2}px)`;
            const top = `calc(50% + ${object.position.z}px - ${object.size.depth / 2}px)`;
            const isPrimary = object.id === clash.objectA;

            return (
              <button
                key={object.id}
                type="button"
                onClick={() => onSelectObject(object.id)}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onSelectObject(object.id);
                  beginDrag(object.id, event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  updateDrag(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  endDrag();
                }}
                onPointerCancel={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  endDrag();
                }}
                className={cn(
                  'absolute rounded-lg border text-left shadow-lg transition-all duration-150',
                  object.isSelected ? 'ring-2 ring-sky-200/70' : '',
                  object.isColliding ? 'border-red-400 bg-red-500/20 shadow-red-900/50' : isPrimary ? 'border-sky-400/60 bg-sky-500/10 shadow-sky-900/30' : 'border-emerald-400/50 bg-emerald-500/10 shadow-emerald-900/30',
                  draggingObjectId === object.id ? 'cursor-grabbing' : 'cursor-grab'
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
                    object.isColliding ? 'bg-slate-950/90 text-red-200' : isPrimary ? 'bg-slate-950/80 text-sky-200' : 'bg-slate-950/80 text-emerald-200'
                  )}
                >
                  {object.label}
                </span>
              </button>
            );
          })}

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

          <div className="absolute left-[47%] top-[52%] rounded bg-white/95 px-2 py-1 text-[10px] font-medium text-[#155DFC] shadow">
            {clash.distance ?? '0.00 m'}
          </div>
          <div className="absolute left-[48%] top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#155DFC] px-2 py-1 text-[10px] font-medium text-white shadow">
            Clash
          </div>
        </div>
      </div>

      <div className="grid gap-3 text-sm text-[#4A5565] md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-[#F9FAFB] p-3">
          <p className="text-xs text-[#6A7282]">Location</p>
          <p className="mt-1 font-medium text-[#101828]">{clash.location}</p>
        </div>
        <div className="rounded-lg bg-[#F9FAFB] p-3">
          <p className="text-xs text-[#6A7282]">Object A</p>
          <p className="mt-1 font-medium text-[#101828]">{clash.objectA}</p>
        </div>
        <div className="rounded-lg bg-[#F9FAFB] p-3">
          <p className="text-xs text-[#6A7282]">Object B</p>
          <p className="mt-1 font-medium text-[#101828]">{clash.objectB}</p>
        </div>
        <div className="rounded-lg bg-[#F9FAFB] p-3">
          <p className="text-xs text-[#6A7282]">Viewport</p>
          <p className="mt-1 font-medium text-[#101828]">x {interaction.scale.toFixed(2)}</p>
          <p className="mt-1 text-xs text-[#6A7282]">{interaction.offset.x}px, {interaction.offset.y}px</p>
        </div>
      </div>
    </div>
  );
}
