// StageSidebar - Popup modal for editing selected stage
import { cn } from '@/lib/utils';
import type { Node } from '@xyflow/react';
import type { StageData } from './WorkflowEditor';
import { useEffect, useRef } from 'react';

interface StageSidebarProps {
  selectedNode: Node<StageData> | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<StageData>) => void;
  onDelete: (nodeId: string) => void;
}

const COLORS: { value: StageData['color']; label: string; hex: string }[] = [
  { value: 'gray', label: 'Gray', hex: '#9CA3AF' },
  { value: 'blue', label: 'Blue', hex: '#3B82F6' },
  { value: 'yellow', label: 'Yellow', hex: '#EAB308' },
  { value: 'orange', label: 'Orange', hex: '#F97316' },
  { value: 'green', label: 'Green', hex: '#22C55E' },
  { value: 'red', label: 'Red', hex: '#EF4444' },
];

const TYPES: { value: StageData['type']; label: string; description: string }[] = [
  { value: 'start', label: 'Start', description: 'Beginning of workflow' },
  { value: 'process', label: 'Process', description: 'Standard workflow step' },
  { value: 'decision', label: 'Decision', description: 'Branching point' },
  { value: 'end', label: 'End', description: 'Completion state' },
];

export function StageSidebar({
  selectedNode,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: StageSidebarProps) {
  const data = selectedNode?.data;
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !selectedNode || !data) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" />
      
      {/* Popup Modal */}
      <div 
        ref={popupRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Edit Stage</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          {/* Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Stage Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => onUpdate(selectedNode.id, { name: e.target.value })}
              placeholder="Enter stage name"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={data.description}
              onChange={(e) => onUpdate(selectedNode.id, { description: e.target.value })}
              placeholder="Describe this stage..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onUpdate(selectedNode.id, { color: color.value })}
                  className={cn(
                    "w-9 h-9 rounded-lg border-2 transition-all hover:scale-110",
                    data.color === color.value
                      ? "border-gray-900 ring-2 ring-offset-2 ring-gray-900"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Stage Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => onUpdate(selectedNode.id, { type: type.value })}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    data.type === type.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span className="text-sm font-medium text-gray-900">{type.label}</span>
                  <span className="text-xs text-gray-500">{type.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={() => onDelete(selectedNode.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
