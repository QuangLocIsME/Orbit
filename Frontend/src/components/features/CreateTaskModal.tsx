'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface WorkflowStage {
  id: string;
  name: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (task: TaskFormData) => void;
  onUpdate?: (taskId: string, task: TaskFormData) => void;
  editTask?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    description: string;
    assigneeId: string;
    dueDate: string;
    tags: string[];
    linkedItems?: string;
  } | null;
  assigneeOptions?: { id: string; name: string }[];
  tagOptions?: string[];
  linkedItemSuggestions?: { label: string; value: string }[];
  workflowStages?: WorkflowStage[];
  defaultStageId?: string;
}

interface TaskFormData {
  title: string;
  status: string;
  priority: string;
  description: string;
  assignee: string;
  dueDate: string;
  tags: string[];
  linkedItems: string;
}

const defaultStages: WorkflowStage[] = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'To Do' },
  { id: 'in-progress', name: 'In Progress' },
  { id: 'review', name: 'Review' },
  { id: 'done', name: 'Done' },
];

const priorityOptions = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];

export default function CreateTaskModal({ isOpen, onClose, onSubmit, onUpdate, editTask, assigneeOptions, tagOptions, linkedItemSuggestions, workflowStages, defaultStageId }: CreateTaskModalProps) {
  const teamMembers = assigneeOptions && assigneeOptions.length > 0
    ? [{ id: '', name: 'Unassigned' }, ...assigneeOptions]
    : [{ id: '', name: 'Unassigned' }];

  const isEditMode = Boolean(editTask);

  const resolvedTagOptions = Array.isArray(tagOptions)
    ? tagOptions
    : [];
  const linkedSuggestions = useMemo(
    () => (linkedItemSuggestions || [])
      .map((item) => ({ label: String(item?.label || '').trim(), value: String(item?.value || '').trim() }))
      .filter((item) => item.label && item.value)
      .slice(0, 100),
    [linkedItemSuggestions]
  );
  const linkedSuggestionsListId = useId();

  const stages = workflowStages && workflowStages.length > 0 ? workflowStages : defaultStages;

  // Resolve initial status: use defaultStageId if it exists and is valid, otherwise first stage
  const resolvedInitialStageId = (() => {
    if (isEditMode && editTask.status) return editTask.status;
    if (defaultStageId && stages.some(s => s.id === defaultStageId)) return defaultStageId;
    return stages[0]?.id || 'backlog';
  })();

  // Sync full form when modal opens — fill from editTask in edit mode, reset in create mode
  useEffect(() => {
    if (!isOpen) return;
    if (editTask) {
      setFormData({
        title: editTask.title,
        status: editTask.status || resolvedInitialStageId,
        priority: editTask.priority || 'medium',
        description: editTask.description || '',
        assignee: editTask.assigneeId || '',
        dueDate: editTask.dueDate ? new Date(editTask.dueDate).toISOString().slice(0, 10) : '',
        tags: editTask.tags || [],
        linkedItems: editTask.linkedItems || '',
      });
    } else {
      setFormData({
        title: '',
        status: resolvedInitialStageId,
        priority: 'medium',
        description: '',
        assignee: '',
        dueDate: '',
        tags: [],
        linkedItems: '',
      });
    }
  }, [isOpen, editTask, resolvedInitialStageId]);

  const [formData, setFormData] = useState<TaskFormData>(() => {
    if (editTask) {
      return {
        title: editTask.title,
        status: editTask.status || resolvedInitialStageId,
        priority: editTask.priority || 'medium',
        description: editTask.description || '',
        assignee: editTask.assigneeId || '',
        dueDate: editTask.dueDate ? new Date(editTask.dueDate).toISOString().slice(0, 10) : '',
        tags: editTask.tags || [],
        linkedItems: editTask.linkedItems || '',
      };
    }
    return {
      title: '',
      status: resolvedInitialStageId,
      priority: 'medium',
      description: '',
      assignee: '',
      dueDate: '',
      tags: [],
      linkedItems: '',
    };
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      status: resolvedInitialStageId,
      priority: 'medium',
      description: '',
      assignee: '',
      dueDate: '',
      tags: [],
      linkedItems: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) return;
    if (isEditMode && editTask && onUpdate) {
      onUpdate(editTask.id, formData);
      onClose();
      return;
    }
    onSubmit?.(formData);
    resetForm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/25" />

      {/* Modal */}
      <div 
        className="relative z-10 w-full max-w-[768px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-[#EFF6FF] rounded-[10px]">
              <svg className="w-5 h-5 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
                {isEditMode ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                )}
              </svg>
            </div>
            <div>
              <h2 className="text-[18px] font-normal text-[#101828]">{isEditMode ? 'Edit Task' : 'Create New Task'}</h2>
              <p className="text-[12px] text-[#6A7282]">{isEditMode ? 'Update task information' : 'Add a task to your project'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#6A7282] hover:text-gray-600 rounded-[10px] hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Task Title */}
          <div className="space-y-2">
            <label className="text-[14px] text-[#101828]">
              Task Title<span className="text-[#FF2056]">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title..."
              className="w-full px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-[14px] text-[#101828]">
              Status<span className="text-[#FF2056]">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {stages.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, status: status.id }))}
                  className={cn(
                    "flex-1 min-w-[100px] px-3 py-2.5 rounded-[10px] text-[14px] text-center transition-all",
                    formData.status === status.id
                      ? "bg-[#EFF6FF] border-2 border-[#2B7FFF] text-[#1447E6]"
                      : "bg-white border border-[#E5E7EB] text-[#4A5565] hover:border-gray-300"
                  )}
                >
                  {status.name}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-[14px] text-[#101828]">
              Priority<span className="text-[#FF2056]">*</span>
            </label>
            <div className="flex gap-2">
              {priorityOptions.map((priority) => (
                <button
                  key={priority.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.id }))}
                  className={cn(
                    "flex-1 px-3 py-2.5 rounded-[10px] text-[14px] text-center transition-all",
                    formData.priority === priority.id
                      ? "bg-[#F0F9FF] border-2 border-[#00A6F4] text-[#0069A8]"
                      : "bg-white border border-[#E5E7EB] text-[#4A5565] hover:border-gray-300"
                  )}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[14px] text-[#101828]">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add a detailed description..."
              rows={4}
              className="w-full px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF] resize-none"
            />
          </div>

          {/* Assignee and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assignee */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#101828]">Assignee</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.33}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <select
                  value={formData.assignee}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
                  className="w-full pl-10 pr-10 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] appearance-none focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                >
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.33}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#101828]">Due Date</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.33}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-[14px] text-[#101828]">Tags</label>
            <div className="flex flex-wrap gap-2">
              {resolvedTagOptions.length === 0 ? (
                <span className="text-[12px] text-[#6A7282]">No task tags configured. Add tags in Settings → Tasks.</span>
              ) : (
                resolvedTagOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[12px] transition-all",
                      formData.tags.includes(tag)
                        ? "bg-[#1F2937] text-white"
                        : "bg-[#F3F4F6] text-[#4A5565] hover:bg-gray-200"
                    )}
                  >
                    {tag}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Linked Drawings & Models */}
          <div className="space-y-2">
            <label className="text-[14px] text-[#101828]">Linked Drawings & Models</label>
            {linkedSuggestions.length > 0 && (
              <select
                value={linkedSuggestions.some((item) => item.value === formData.linkedItems) ? formData.linkedItems : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, linkedItems: e.target.value }))}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] text-[#101828] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
              >
                <option value="">Select from documents, change requests, or clashes...</option>
                {linkedSuggestions.map((item) => (
                  <option key={`${item.value}-${item.label}`} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            )}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.33}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <input
                type="text"
                list={linkedSuggestions.length > 0 ? linkedSuggestionsListId : undefined}
                value={formData.linkedItems}
                onChange={(e) => setFormData(prev => ({ ...prev, linkedItems: e.target.value }))}
                placeholder={linkedSuggestions.length > 0 ? 'Or paste a custom link...' : 'Link to drawings, change requests, or clashes...'}
                className="w-full pl-10 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
              />
              {linkedSuggestions.length > 0 && (
                <datalist id={linkedSuggestionsListId}>
                  {linkedSuggestions.map((item) => (
                    <option key={`${item.value}-${item.label}`} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </datalist>
              )}
            </div>
            {linkedSuggestions.length > 0 && (
              <p className="text-[12px] text-[#6A7282]">Suggestions are loaded from documents, change requests, and clashes.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB]">
          <button
            onClick={onClose}
            className="text-[14px] text-[#101828] hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#7C9EF8] text-[14px] text-white hover:bg-[#6B8EE8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              {isEditMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              )}
            </svg>
            {isEditMode ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
