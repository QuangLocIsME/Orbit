'use client';

import { useEffect } from 'react';

export type UnsavedChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  showSave?: boolean;
  onSave?: () => void;
  onDiscard: () => void;
  saveLabel?: string;
  discardLabel?: string;
  cancelLabel?: string;
};

export default function UnsavedChangesDialog({
  open,
  onOpenChange,
  title = 'Unsaved position changes',
  description = 'You have unsaved object positions. Save them, discard them, or stay on this screen.',
  showSave = true,
  onSave,
  onDiscard,
  saveLabel = 'Save',
  discardLabel = 'Discard',
  cancelLabel = 'Stay',
}: UnsavedChangesDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close dialog backdrop"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 id="unsaved-changes-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{description}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onDiscard();
              onOpenChange(false);
            }}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
          >
            {discardLabel}
          </button>
          {showSave && onSave && (
            <button
              type="button"
              onClick={() => {
                onSave();
                onOpenChange(false);
              }}
              className="rounded-lg bg-[#155DFC] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
