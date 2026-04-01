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
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" />
      
      {/* Popup Modal */}
      <div 
        ref={popupRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-h-[80vh] bg-card rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col border border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-card-foreground">Edit Stage</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
            <label className="block text-sm font-medium text-card-foreground">
              Stage Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => onUpdate(selectedNode.id, { name: e.target.value })}
              placeholder="Enter stage name"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-card-foreground">Description</label>
            <textarea
              value={data.description}
              onChange={(e) => onUpdate(selectedNode.id, { description: e.target.value })}
              placeholder="Describe this stage..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-card-foreground">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onUpdate(selectedNode.id, { color: color.value })}
                  className={cn(
                    "w-9 h-9 rounded-lg border-2 transition-all hover:scale-110",
                    data.color === color.value
                      ? "border-foreground ring-2 ring-offset-2 ring-foreground ring-offset-card"
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
            <label className="block text-sm font-medium text-card-foreground">Stage Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => onUpdate(selectedNode.id, { type: type.value })}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    data.type === type.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="text-sm font-medium text-card-foreground">{type.label}</span>
                  <span className="text-xs text-muted-foreground">{type.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-border bg-muted/50 flex items-center justify-between gap-3">
          <button
            onClick={() => onDelete(selectedNode.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
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
