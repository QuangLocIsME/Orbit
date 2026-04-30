'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getTodayLocalDateString, utcDateStringToLocalDateString } from '@/lib/utils';
import { MemberPicker, AffectedModelsPicker, AttachPicker } from './TaskFormShared';
import type { TaskAttachment } from './TaskFormShared';

interface Discipline {
  id: string;
  name: string;
}

interface WorkflowStage {
  id: string;
  name: string;
}

interface ModelFile {
  id: string;
  name: string;
  folderPath?: string;
}

interface TeamMember {
  userId: string;
  user?: { fullName: string; avatar?: string | null };
  role: string;
  avatarUrl?: string | null;
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
    assigneeIds?: string[];
    reviewerIds?: string[];
    dueDate: string;
    tags: string[];
    linkedItems?: string;
    affectedModels?: string[];
    existingAttachments?: TaskAttachment[];
  } | null;
  tagOptions?: string[];
  linkedItemSuggestions?: { label: string; value: string }[];
  workflowStages?: WorkflowStage[];
  defaultStageId?: string;
  modelFiles?: ModelFile[];
  loadingFiles?: boolean;
  teamMembers?: TeamMember[];
  disciplines?: Discipline[];
}

interface TaskFormData {
  title: string;
  status: string;
  priority: string;
  description: string;
  assigneeIds: string[];
  reviewerIds: string[];
  dueDate: string;
  tags: string[];
  linkedItems: string;
  affectedModels: string[];
  attachments: File[];
  removedExistingAttachmentIndices: number[];
}

const defaultStages: WorkflowStage[] = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'To Do' },
  { id: 'in-progress', name: 'In Progress' },
  { id: 'review', name: 'Review' },
  { id: 'done', name: 'Done' },
];

const priorityOptions = [
  { id: 'low',    label: 'Low',    activeClass: 'bg-[#F0FDF4] border-[#22C55E] text-[#15803D]', dotClass: 'bg-[#22C55E]' },
  { id: 'medium', label: 'Medium', activeClass: 'bg-[#FFFBEB] border-[#F59E0B] text-[#B45309]', dotClass: 'bg-[#F59E0B]' },
  { id: 'high',   label: 'High',  activeClass: 'bg-[#FFF1F2] border-[#F43F5E] text-[#C70036]', dotClass: 'bg-[#F43F5E]' },
  { id: 'urgent', label: 'Urgent', activeClass: 'bg-[#FEF3C7] border-[#D97706] text-[#92400E]', dotClass: 'bg-[#D97706]' },
];

export default function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  editTask,
  tagOptions,
  linkedItemSuggestions,
  workflowStages,
  defaultStageId,
  modelFiles = [],
  loadingFiles = false,
  teamMembers = [],
}: CreateTaskModalProps) {
  const isEditMode = Boolean(editTask);

  const resolvedTagOptions = Array.isArray(tagOptions) ? tagOptions : [];
  const [customTagOptions, setCustomTagOptions] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [existingAttachments, setExistingAttachments] = useState<TaskAttachment[]>([]);
  const [removedExistingIndices, setRemovedExistingIndices] = useState<Set<number>>(new Set());
  const linkedSuggestions = useMemo(
    () => (linkedItemSuggestions || [])
      .map((item) => ({ label: String(item?.label || '').trim(), value: String(item?.value || '').trim() }))
      .filter((item) => item.label && item.value)
      .slice(0, 100),
    [linkedItemSuggestions]
  );
  const changeRequestSuggestions = useMemo(
    () => linkedSuggestions.filter((item) => item.label.toLowerCase().startsWith('[change request]')),
    [linkedSuggestions]
  );

  const stages = workflowStages && workflowStages.length > 0 ? workflowStages : defaultStages;

  const resolvedInitialStageId = (() => {
    if (isEditMode && editTask?.status) return editTask.status;
    if (defaultStageId && stages.some(s => s.id === defaultStageId)) return defaultStageId;
    return stages[0]?.id || 'backlog';
  })();

  const [formData, setFormData] = useState<TaskFormData>(() => {
    const base = {
      title: '',
      status: resolvedInitialStageId,
      priority: 'medium',
      description: '',
      assigneeIds: [] as string[],
      reviewerIds: [] as string[],
      dueDate: '',
      tags: [] as string[],
      linkedItems: '',
      affectedModels: [] as string[],
      attachments: [] as File[],
      removedExistingAttachmentIndices: [] as number[],
    };
    if (editTask) {
      return {
        ...base,
        title: editTask.title,
        status: editTask.status || resolvedInitialStageId,
        priority: editTask.priority || 'medium',
        description: editTask.description || '',
        assigneeIds: editTask.assigneeIds || (editTask.assigneeId ? [editTask.assigneeId] : []),
        reviewerIds: editTask.reviewerIds || [],
        dueDate: editTask.dueDate ? utcDateStringToLocalDateString(editTask.dueDate) : '',
        tags: editTask.tags || [],
        linkedItems: editTask.linkedItems || '',
        affectedModels: editTask.affectedModels || [],
      };
    }
    return base;
  });
  const allTagOptions = useMemo(() => {
    const merged = [...resolvedTagOptions, ...customTagOptions, ...formData.tags];
    return Array.from(
      new Set(
        merged
          .map((tag) => String(tag || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }, [customTagOptions, formData.tags, resolvedTagOptions]);

  useEffect(() => {
    if (!isOpen) return;
    setCustomTagOptions([]);
    setNewTagInput('');
    setRemovedExistingIndices(new Set());
    if (editTask) {
      setExistingAttachments(editTask.existingAttachments || []);
      setFormData({
        title: editTask.title,
        status: editTask.status || resolvedInitialStageId,
        priority: editTask.priority || 'medium',
        description: editTask.description || '',
        assigneeIds: editTask.assigneeIds || (editTask.assigneeId ? [editTask.assigneeId] : []),
        reviewerIds: editTask.reviewerIds || [],
        dueDate: editTask.dueDate ? utcDateStringToLocalDateString(editTask.dueDate) : '',
        tags: editTask.tags || [],
        linkedItems: editTask.linkedItems || '',
        affectedModels: editTask.affectedModels || [],
        attachments: [],
        removedExistingAttachmentIndices: [],
      });
    } else {
      setExistingAttachments([]);
      setFormData({
        title: '',
        status: resolvedInitialStageId,
        priority: 'medium',
        description: '',
        assigneeIds: [],
        reviewerIds: [],
        dueDate: '',
        tags: [],
        linkedItems: '',
        affectedModels: [],
        attachments: [],
        removedExistingAttachmentIndices: [],
      });
    }
  }, [isOpen, editTask, resolvedInitialStageId]);

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

  const handleAddNewTag = () => {
    const normalized = newTagInput.trim().toLowerCase();
    if (!normalized) return;
    if (!allTagOptions.includes(normalized)) {
      setCustomTagOptions((prev) => [...prev, normalized]);
    }
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(normalized) ? prev.tags : [...prev.tags, normalized],
    }));
    setNewTagInput('');
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) return;
    if (isEditMode && editTask && onUpdate) {
      onUpdate(editTask.id, formData);
      onClose();
      return;
    }
    onSubmit?.(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleBackdropClick}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-[680px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EFF6FF]">
              <svg className="h-5 w-5 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
                {isEditMode ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                )}
              </svg>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[#101828]">{isEditMode ? 'Edit Task' : 'Create New Task'}</h2>
              <p className="text-[12px] text-[#6A7282]">{isEditMode ? 'Update task information' : 'Add a task to your project'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Task Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">
              Task Title<span className="text-[#FF2056]">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter task title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">
              Status<span className="text-[#FF2056]">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {stages.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, status: status.id }))}
                  className={cn(
                    'h-9 rounded-[10px] text-[13px] text-center transition-all',
                    formData.status === status.id
                      ? 'bg-[#EFF6FF] border-2 border-[#155DFC] text-[#1447E6]'
                      : 'bg-white border border-[#E5E7EB] text-[#4A5565] hover:border-gray-300'
                  )}
                >
                  {status.name}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">
              Priority<span className="text-[#FF2056]">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorityOptions.map((priority) => (
                <button
                  key={priority.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.id }))}
                  className={cn(
                    'h-10 rounded-[10px] text-[14px] capitalize transition-colors border flex items-center justify-center gap-2',
                    formData.priority === priority.id
                      ? priority.activeClass
                      : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', formData.priority === priority.id ? priority.dotClass : 'bg-[#D1D5DC]')} />
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add a detailed description..."
              rows={3}
              className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
            />
          </div>

          {/* Due Date + Linked Items — 2 col */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Due Date</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.33}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  min={getTodayLocalDateString()}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-9 pr-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [color-scheme:light]"
                />
              </div>
            </div>

            {/* Linked Items */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Link Change Request</label>
              <select
                value={changeRequestSuggestions.some(item => item.value === formData.linkedItems) ? formData.linkedItems : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, linkedItems: e.target.value }))}
                className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [color-scheme:light]"
              >
                <option value="">{changeRequestSuggestions.length > 0 ? 'Select a change request...' : 'No change requests available'}</option>
                {changeRequestSuggestions.map((item) => (
                  <option key={`${item.value}-${item.label}`} value={item.value}>
                    {item.label.replace(/^\[Change Request\]\s*/i, '')}
                  </option>
                ))}
              </select>
              {changeRequestSuggestions.length === 0 && (
                <p className="text-[12px] text-[#6A7282]">Create a change request first to link it here.</p>
              )}
            </div>
          </div>

          {/* Assignees + Reviewers — 2 col */}
          <div className="grid grid-cols-2 gap-4">
            <MemberPicker
              label="Assignees"
              members={teamMembers}
              selected={formData.assigneeIds}
              onChange={(ids) => setFormData(prev => ({ ...prev, assigneeIds: ids }))}
            />
            <MemberPicker
              label="Reviewers"
              members={teamMembers}
              selected={formData.reviewerIds}
              onChange={(ids) => setFormData(prev => ({ ...prev, reviewerIds: ids }))}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Tags</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewTag();
                  }
                }}
                placeholder="Enter new tag and press Enter"
                className="h-[38px] flex-1 rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              />
              <button
                type="button"
                onClick={handleAddNewTag}
                disabled={!newTagInput.trim()}
                className="inline-flex h-[38px] items-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[13px] text-[#364153] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {allTagOptions.length === 0 ? (
              <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#6A7282]">
                No tags yet. Create your first tag above.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTagOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={cn(
                      'h-10 rounded-[10px] border px-3 text-[14px] capitalize transition-colors active:scale-[0.98] flex items-center justify-center',
                      formData.tags.includes(tag)
                        ? 'bg-[#EFF6FF] border-2 border-[#155DFC] text-[#1447E6]'
                        : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Affected Models */}
          <AffectedModelsPicker
            modelFiles={modelFiles}
            loadingFiles={loadingFiles}
            selected={formData.affectedModels}
            onChange={(ids) => setFormData(prev => ({ ...prev, affectedModels: ids }))}
          />

          {/* Attachments */}
          <AttachPicker
            files={formData.attachments}
            onChange={(files) => setFormData(prev => ({ ...prev, attachments: files }))}
            existingAttachments={existingAttachments.filter((_, i) => !removedExistingIndices.has(i))}
            onRemoveExisting={(index) => {
              const actualIndex = existingAttachments
                .map((_, i) => i)
                .filter(i => !removedExistingIndices.has(i))[index];
              setRemovedExistingIndices(prev => new Set([...prev, actualIndex]));
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <p className="text-[12px] text-[#6A7282]">
            {(() => {
              const newCount = formData.attachments.length;
              const existingCount = existingAttachments.filter((_, i) => !removedExistingIndices.has(i)).length;
              const total = newCount + existingCount;
              if (total === 0) return '';
              return `${total} file${total !== 1 ? 's' : ''} attached`;
            })()}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.title.trim()}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-5 py-2 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEditMode ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
