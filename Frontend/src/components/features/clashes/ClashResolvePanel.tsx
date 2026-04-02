'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Clash } from '@/data/clashes';
import { severityConfig } from '@/data/clashes';
import Viewer3D from '../../viewer/Viewer3D';

const TEAM_MEMBERS = [
  'Unassigned',
  'Thao Duyen',
  'Minh Anh',
  'Hoang Nam',
  'Thu Trang',
  'Tuan Kiet',
];

interface ClashResolvePanelProps {
  clash: Clash | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (payload: { note?: string; severity?: Clash['severity'] }) => void;
  onWaive?: (payload: { note?: string }) => void;
  onSavePositions: () => void;
  onSeverityChange: (severity: Clash['severity']) => void;
  onAssign?: (assignedTo: string, dueDate?: string) => void;
  resolveDisabled?: boolean;
  resolveError?: string | null;
  hasUnsavedPositions?: boolean;
}

export default function ClashResolvePanel({
  clash,
  isOpen,
  onClose,
  onResolve,
  onWaive,
  onSavePositions,
  onSeverityChange,
  onAssign,
  resolveDisabled = false,
  resolveError = null,
  hasUnsavedPositions = false,
}: ClashResolvePanelProps) {
  const [note, setNote] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [localCollision, setLocalCollision] = useState(false);
  const [localCollisionMessage, setLocalCollisionMessage] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState('Unassigned');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    setNote(clash?.note ?? '');
    setSelectedObjectId(clash?.objectA ?? null);
    setLocalCollision(false);
    setLocalCollisionMessage(null);
    setAssignedTo(clash?.assignedTo ?? 'Unassigned');
    setDueDate(clash?.dueDate ?? '');
  }, [clash]);

  if (!isOpen || !clash) return null;

  const isWaived = clash.waived || clash.status === 'waived';
  const isResolved = clash.resolved || clash.status === 'resolved';

  return (
    <div className="fixed inset-x-0 bottom-0 top-32 z-50 overflow-y-auto bg-slate-950/35 p-6 backdrop-blur-[1px]">
      <div className="mx-auto flex min-h-[calc(100dvh-128px-48px)] w-full max-w-[1320px] flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#6A7282]">Resolve clash</p>
            <h3 className="mt-1 text-lg font-medium text-[#101828]">{clash.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {isWaived && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Waived</span>
            )}
            {isResolved && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">Resolved</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm text-[#364153] transition-colors hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[280px_minmax(0,1fr)_340px]">

          {/* Left sidebar — Clash Info */}
          <aside className="border-b border-[#E5E7EB] p-5 xl:border-b-0 xl:border-r">
            <h4 className="text-sm font-medium text-[#101828]">Clash Info</h4>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#6A7282]">Type</p>
                <p className="mt-1 font-medium text-[#101828]">{clash.type}</p>
              </div>
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#6A7282]">Object A</p>
                <p className="mt-1 font-medium text-[#101828]">{clash.objectA}</p>
              </div>
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#6A7282]">Object B</p>
                <p className="mt-1 font-medium text-[#101828]">{clash.objectB}</p>
              </div>
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#6A7282]">Severity</p>
                <p className={cn('mt-1 font-medium', severityConfig[clash.severity].color)}>
                  {severityConfig[clash.severity].label}
                </p>
              </div>
              {typeof clash.distance === 'string' && clash.clashType === 'soft' && (
                <div className="rounded-xl bg-[#F9FAFB] p-3">
                  <p className="text-xs text-[#6A7282]">Gap Distance</p>
                  <p className="mt-1 font-medium text-[#101828]">{clash.distance}</p>
                </div>
              )}
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#6A7282]">Position</p>
                <p className="mt-1 font-medium text-[#101828]">{clash.location}</p>
              </div>
            </div>

            {/* Assignment */}
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium text-[#101828]">Assignment</h4>
              <div className="space-y-2">
                <label className="block text-xs text-[#6A7282]">Assigned to</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-xl border border-[#D1D5DC] px-3 py-2 text-sm text-[#101828] outline-none transition-colors focus:border-[#155DFC]"
                >
                  {TEAM_MEMBERS.map((member) => (
                    <option key={member} value={member}>{member}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-[#6A7282]">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[#D1D5DC] px-3 py-2 text-sm text-[#101828] outline-none transition-colors focus:border-[#155DFC]"
                />
              </div>
              {onAssign && (
                <button
                  type="button"
                  onClick={() => onAssign(assignedTo, dueDate || undefined)}
                  className="w-full rounded-xl border border-[#D1D5DC] bg-white px-4 py-2.5 text-sm font-medium text-[#364153] transition-colors hover:bg-gray-50"
                >
                  Save Assignment
                </button>
              )}
            </div>
          </aside>

          {/* Center — Viewer */}
          <section className="min-h-0 border-b border-[#E5E7EB] bg-[#111827] xl:border-b-0 xl:border-r">
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-white/10 px-5 py-3 text-sm text-slate-300">
                3D viewer — drag objects to resolve positions. XeoKit will replace this when ready.
              </div>
              <div className="min-h-0 flex-1 p-5">
                <div className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#111827]">
                  <Viewer3D
                    clash={clash}
                    selectedObjectId={selectedObjectId}
                    onSelectObject={setSelectedObjectId}
                    onFocusClash={() => setSelectedObjectId(clash.objectA)}
                    onCollisionChange={(isColliding, message) => {
                      setLocalCollision(isColliding);
                      setLocalCollisionMessage(message);
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Right sidebar — Actions */}
          <aside className="min-h-0 flex flex-col gap-4 overflow-y-auto p-5">
            <div>
              <h4 className="text-sm font-medium text-[#101828]">Actions</h4>
              <p className="mt-1 text-sm text-[#6A7282]">Resolve quickly without leaving the clash context.</p>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#6A7282]">Change severity</p>
              <div className="flex flex-wrap gap-2">
                {(['critical', 'high', 'medium', 'low'] as Clash['severity'][]).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => onSeverityChange(sev)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      clash.severity === sev
                        ? `${severityConfig[sev].bg} ${severityConfig[sev].color}`
                        : 'border border-[#D1D5DC] bg-white text-[#364153] hover:bg-gray-50'
                    )}
                  >
                    {severityConfig[sev].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <label className="flex flex-col gap-2 text-sm text-[#101828]">
              <span className="font-medium">Note / Comment</span>
              <textarea
                rows={5}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="rounded-xl border border-[#D1D5DC] px-3 py-2 text-sm outline-none transition-colors focus:border-[#155DFC]"
                placeholder="Add root cause, mitigation, or coordination note..."
              />
            </label>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#4A5565]">
              <p className="font-medium text-[#101828]">Viewer tips</p>
              <p className="mt-1">Double-click to refocus. Click object card to select. Drag to move.</p>
            </div>

            {/* Errors / warnings */}
            {(localCollisionMessage || resolveError) && (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
                {localCollisionMessage || resolveError}
              </div>
            )}
            {hasUnsavedPositions && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                You have unsaved position changes. Save before resolving.
              </div>
            )}

            {/* Save Positions */}
            <button
              type="button"
              onClick={onSavePositions}
              disabled={!hasUnsavedPositions}
              className={cn(
                'inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                hasUnsavedPositions
                  ? 'border-[#155DFC] bg-[#155DFC] text-white hover:bg-blue-700'
                  : 'cursor-not-allowed border-[#D1D5DC] bg-[#F3F4F6] text-[#9CA3AF]'
              )}
            >
              Save Positions
            </button>

            {/* Waive */}
            {!isResolved && !isWaived && onWaive && (
              <button
                type="button"
                onClick={() => onWaive({ note })}
                className="inline-flex items-center justify-center rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                title="Waive: acknowledge this clash but mark it as not requiring a fix"
              >
                Waive (no fix needed)
              </button>
            )}

            {/* Mark as Resolved */}
            <button
              type="button"
              onClick={() => {
                if (localCollision) return;
                onResolve({ note, severity: clash.severity });
              }}
              disabled={isResolved || isWaived || resolveDisabled || localCollision}
              className={cn(
                'inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                isResolved
                  ? 'cursor-not-allowed bg-[#D1FAE5] text-[#059669]'
                  : isWaived
                  ? 'cursor-not-allowed bg-amber-100 text-amber-700'
                  : resolveDisabled || localCollision
                  ? 'cursor-not-allowed bg-[#D1FAE5] text-[#047857]'
                  : 'bg-[#009966] text-white hover:bg-emerald-600'
              )}
            >
              {isResolved
                ? 'Already Resolved'
                : isWaived
                ? 'Waived'
                : resolveDisabled || localCollision
                ? 'Resolve Blocked'
                : 'Mark as Resolved'}
            </button>
          </aside>
        </div>

        {/* History */}
        {clash.history && clash.history.length > 0 && (
          <div className="border-t border-[#E5E7EB] px-6 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#6A7282]">History</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {clash.history.slice(-4).reverse().map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm">
                  <p className="font-medium text-[#101828]">{entry.message}</p>
                  <p className="mt-1 text-xs text-[#6A7282]">{new Date(entry.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
