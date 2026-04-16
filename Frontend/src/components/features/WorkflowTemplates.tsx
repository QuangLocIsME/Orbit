// WorkflowTemplates v1.0.8 - Real data from API
import { useState, useCallback, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/skeletons';
import { TemplateSearch } from './TemplateSearch';
import { WorkflowEditor, type StageData } from './workflow-editor';
import { workflowTemplateService, type WorkflowTemplate } from '@/lib/workflow-template-service';
import { apiFetch } from '@/lib/api-client';
import { toast } from '@/components/ui/sonner';
import { Loader2, Plus } from 'lucide-react';

// Custom workflow icon SVG
const WorkflowIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 6V30" stroke="#D1D5DC" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36 18C39.3137 18 42 15.3137 42 12C42 8.68629 39.3137 6 36 6C32.6863 6 30 8.68629 30 12C30 15.3137 32.6863 18 36 18Z" stroke="#D1D5DC" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 42C15.3137 42 18 39.3137 18 36C18 32.6863 15.3137 30 12 30C8.68629 30 6 32.6863 6 36C6 39.3137 8.68629 42 12 42Z" stroke="#D1D5DC" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36 18C36 22.7739 34.1036 27.3523 30.7279 30.7279C27.3523 34.1036 22.7739 36 18 36" stroke="#D1D5DC" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface Template {
  id: string;
  name: string;
  description: string;
  author: string;
  isPrivate: boolean;
  tags: string[];
  stages: string[];
  downloads: number;
  rating: number;
  category?: string;
}

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  color: 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red';
}

interface WorkflowTemplatesProps {
  templates?: Template[];
  allTags?: string[];
}

const STAGE_COLORS = {
  gray: { bg: '#F3F4F6', border: '#D1D5DC', text: '#364153' },
  blue: { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  yellow: { bg: '#FEFCE8', border: '#FDC700', text: '#A65F00' },
  orange: { bg: '#FFF7ED', border: '#FB923C', text: '#C2410C' },
  green: { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
  red: { bg: '#FEF2F2', border: '#EF4444', text: '#DC2626' },
};

const CATEGORIES = [
  'Construction',
  'Software Development',
  'Marketing',
  'Design',
  'Operations',
  'HR',
  'Finance',
  'Other',
];

// Helper to convert API template to card format
function toCardTemplate(template: WorkflowTemplate): Template {
  return {
    id: template.publicId,
    name: template.name,
    description: template.description || '',
    author: template.authorName || template.authorId,
    isPrivate: template.isPrivate,
    tags: template.tags || [],
    stages: template.stages?.map(s => s.name) || [],
    downloads: template.downloads || 0,
    rating: template.rating || 0,
    category: template.category,
  };
}

function TemplateCard({ template, onEdit, onDelete }: { template: Template; onEdit?: () => void; onDelete?: () => void }) {
  const visibleStages = template.stages.slice(0, 4);
  const remainingStages = template.stages.length - 4;

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:border-gray-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground truncate">{template.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {template.isPrivate ? 'Private' : 'Public'}
            </span>
          </div>
          
          {/* Author */}
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-medium text-white">
              {template.author.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-muted-foreground">{template.author}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {tag}
          </span>
        ))}
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{template.description}</p>

      {/* Stages */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{template.stages.length} stages</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {visibleStages.map((stage) => (
            <span key={stage} className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600">
              {stage}
            </span>
          ))}
          {remainingStages > 0 && (
            <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
              +{remainingStages}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <div className="flex items-center gap-4">
          {/* Downloads */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{template.downloads}</span>
          </div>
          {/* Rating */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span>{template.rating}</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-all duration-150 hover:bg-gray-50 hover:border-gray-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 hover:border-red-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Create Workflow Form Component
function CreateWorkflowForm({ onClose, onSave }: { onClose: () => void; onSave: (template: Partial<Template> & { stages: WorkflowStage[] }) => void }) {
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Construction');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [stageView, setStageView] = useState<'visual' | 'list'>('list');
  const [stages, setStages] = useState<WorkflowStage[]>([
    { id: '1', name: 'Backlog', description: '', color: 'gray' },
    { id: '2', name: 'In Progress', description: '', color: 'yellow' },
    { id: '3', name: 'Done', description: '', color: 'green' },
  ]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedStage, setDraggedStage] = useState<string | null>(null);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleAddStage = () => {
    const newStage: WorkflowStage = {
      id: Date.now().toString(),
      name: '',
      description: '',
      color: 'gray',
    };
    setStages([...stages, newStage]);
  };

  const handleUpdateStage = (id: string, field: keyof WorkflowStage, value: string) => {
    setStages(stages.map(stage => 
      stage.id === id ? { ...stage, [field]: value } : stage
    ));
  };

  const handleDeleteStage = (id: string) => {
    if (stages.length > 1) {
      setStages(stages.filter(stage => stage.id !== id));
    }
  };

  const handleDragStart = (stageId: string) => {
    setDraggedStage(stageId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedStage && draggedStage !== targetId) {
      const draggedIndex = stages.findIndex(s => s.id === draggedStage);
      const targetIndex = stages.findIndex(s => s.id === targetId);
      const newStages = [...stages];
      const [removed] = newStages.splice(draggedIndex, 1);
      newStages.splice(targetIndex, 0, removed);
      setStages(newStages);
    }
  };

  const handleDragEnd = () => {
    setDraggedStage(null);
  };

  const handleSave = async () => {
    if (!templateName.trim() || !description.trim()) {
      return;
    }
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    onSave({
      name: templateName,
      description,
      tags,
      stages,
      isPrivate: visibility === 'private',
      category,
    });
    setIsSaving(false);
  };

  const isFormValid = templateName.trim() && description.trim() && stages.length > 0;

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Content */}
      <div className="flex-1">
        <div className="max-w-[720px] mx-auto py-6 px-6">
          {/* Back button and title */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-[18px] font-medium text-[#101828]">Create Workflow Template</h1>
          </div>
          {/* Basic Information Section */}
          <div className="space-y-6">
            <h2 className="text-[18px] font-medium text-[#101828]">Basic Information</h2>

            {/* Template Name */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">
                Template Name <span className="text-[#FB2C36]">*</span>
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Construction Standard Workflow"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">
                Description <span className="text-[#FB2C36]">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this workflow template is for and when to use it..."
                rows={4}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Category with custom input */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">
                Category <span className="text-[#FB2C36]">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className="w-full flex items-center justify-between rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {category || 'Select category'}
                  </div>
                  <svg className={cn("h-4 w-4 text-[#99A1AF] transition-transform", isCategoryOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isCategoryOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-10 max-h-[280px] overflow-y-auto">
                    {/* Custom category input */}
                    <div className="p-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customCategory.trim()) {
                            setCategory(customCategory.trim());
                            setCustomCategory('');
                            setIsCategoryOpen(false);
                          }
                        }}
                        placeholder="Type custom category..."
                        className="w-full px-3 py-2 text-[14px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {customCategory.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setCategory(customCategory.trim());
                            setCustomCategory('');
                            setIsCategoryOpen(false);
                          }}
                          className="mt-2 w-full px-3 py-2 text-[13px] font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          + Create "{customCategory.trim()}"
                        </button>
                      )}
                    </div>
                    {/* Predefined categories */}
                    <div className="py-1">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategory(cat);
                            setIsCategoryOpen(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-left text-[14px] hover:bg-gray-50 transition-colors",
                            category === cat ? "bg-blue-50 text-blue-600" : "text-[#101828]"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags - supports multiple custom tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[14px] text-[#364153]">Tags</label>
                <span className="text-[12px] text-[#9CA3AF]">Press Enter to add multiple tags</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 min-h-[48px] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[13px] font-medium text-blue-700"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-900 p-0.5 rounded-full hover:bg-blue-200 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={tags.length === 0 ? "Type tag and press Enter..." : "Add more..."}
                  className="flex-1 min-w-[120px] bg-transparent text-[14px] placeholder:text-[#99A1AF] focus:outline-none"
                />
              </div>
              {tags.length > 0 && (
                <p className="text-[12px] text-[#6A7282]">{tags.length} tag{tags.length !== 1 ? 's' : ''} added</p>
              )}
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">Visibility</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                    visibility === 'public'
                      ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]"
                      : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                  )}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                    visibility === 'private'
                      ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]"
                      : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                  )}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Private
                </button>
              </div>
              <p className="text-[12px] text-[#6A7282]">
                {visibility === 'public' 
                  ? 'Anyone in your workspace can use this template'
                  : 'Only you can see and use this template'}
              </p>
            </div>
          </div>

          {/* Workflow Stages Section */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-medium text-[#101828]">Workflow Stages</h2>
                <p className="text-[14px] text-[#6A7282]">Define the stages tasks will move through</p>
              </div>
              <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-[10px]">
                  <button
                    type="button"
                    onClick={() => setStageView('visual')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium transition-colors",
                      stageView === 'visual'
                        ? "bg-white shadow-sm text-[#101828]"
                        : "text-[#4A5565] hover:text-[#101828]"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setStageView('list')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium transition-colors",
                      stageView === 'list'
                        ? "bg-white shadow-sm text-[#101828]"
                        : "text-[#4A5565] hover:text-[#101828]"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    List
                  </button>
                </div>
                {stageView === 'list' && (
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#155DFC] hover:text-blue-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Stage
                  </button>
                )}
              </div>
            </div>

            {/* Stages Content */}
            {stageView === 'list' ? (
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(stage.id)}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-[10px] border border-[#E5E7EB] bg-white transition-all",
                      draggedStage === stage.id && "opacity-50"
                    )}
                  >
                    {/* Drag Handle */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        className="cursor-grab text-[#9CA3AF] hover:text-[#6B7280]"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                        </svg>
                      </button>
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[12px] font-medium text-blue-600">
                        {index + 1}
                      </span>
                    </div>

                    {/* Stage Fields */}
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => handleUpdateStage(stage.id, 'name', e.target.value)}
                        placeholder="Stage name"
                        className="w-full bg-transparent text-[14px] font-medium text-[#101828] placeholder:text-[#99A1AF] focus:outline-none border-b border-transparent focus:border-blue-500 pb-1"
                      />
                      <input
                        type="text"
                        value={stage.description}
                        onChange={(e) => handleUpdateStage(stage.id, 'description', e.target.value)}
                        placeholder="Stage description (optional)"
                        className="w-full bg-transparent text-[13px] text-[#6A7282] placeholder:text-[#99A1AF] focus:outline-none"
                      />
                    </div>

                    {/* Delete Button */}
                    {stages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-1 text-[#9CA3AF] hover:text-red-500 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                {/* Info Box */}
                <div className="flex items-start gap-3 p-4 rounded-[10px] bg-blue-50 border border-blue-100">
                  <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-[14px] text-blue-700">You can drag stages to reorder them later.</p>
                    <p className="text-[14px] text-blue-600">Tasks in your projects will move through these stages in sequence.</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Visual View - React Flow Editor */
              <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] min-h-[500px] h-[500px] relative overflow-hidden">
                <WorkflowEditor
                  initialStages={stages.map((s): StageData => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    color: s.color,
                    type: 'process',
                  }))}
                  onChange={(data) => {
                    // Sync stages from React Flow back to form state
                    const newStages = data.nodes.map((node) => ({
                      id: node.data.id,
                      name: node.data.name,
                      description: node.data.description,
                      color: node.data.color,
                    }));
                    // Update stages state
                    setStages(newStages);
                  }}
                  onSave={(json) => {
                    console.log('Workflow JSON:', json);
                  }}
                />
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="mt-8">
            <h2 className="text-[18px] font-medium text-[#101828] mb-4">Preview</h2>
            <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-5">
              <h3 className="text-[16px] font-semibold text-[#101828]">
                {templateName || 'Untitled Template'}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-[13px] text-[#6A7282]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {category} • {stages.length} stages
                <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={visibility === 'public' ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"} />
                </svg>
              </div>
              <p className="mt-3 text-[14px] text-[#6A7282]">
                {description || 'No description provided'}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stages.map((stage) => (
                  <span key={stage.id} className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[12px] text-gray-600">
                    {stage.name || 'Untitled'}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Save Button at Bottom */}
          <div className="mt-8 flex justify-end gap-3 pb-8">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white h-11 px-6 text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className={cn(
                "inline-flex items-center gap-2 rounded-[10px] h-11 px-6 text-[14px] font-medium text-white transition-colors",
                isFormValid && !isSaving
                  ? "bg-[#155DFC] hover:bg-blue-700"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkflowTemplates({ templates: propsTemplates, allTags: propsTags }: WorkflowTemplatesProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'library'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'rating'>('popular');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<WorkflowTemplate | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // API data state
  const [myTemplates, setMyTemplates] = useState<WorkflowTemplate[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<WorkflowTemplate[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>(propsTags || []);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [myRes, libraryRes, tagsRes] = await Promise.all([
        workflowTemplateService.getMyTemplates(),
        workflowTemplateService.getTemplates({ limit: 50 }),
        workflowTemplateService.getTags().catch(() => []),
      ]);
      
      setMyTemplates(myRes.templates);
      setLibraryTemplates(libraryRes.templates);
      setAvailableTags(tagsRes);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    setIsHydrated(true);

    // Listen for workflow changes from other tabs/pages
    const handleWorkflowChange = () => {
      fetchData();
    };

    window.addEventListener('workflow-updated', handleWorkflowChange);
    window.addEventListener('workflow-created', handleWorkflowChange);
    window.addEventListener('workflow-deleted', handleWorkflowChange);

    return () => {
      window.removeEventListener('workflow-updated', handleWorkflowChange);
      window.removeEventListener('workflow-created', handleWorkflowChange);
      window.removeEventListener('workflow-deleted', handleWorkflowChange);
    };
  }, [fetchData]);

  const handleSearch = useCallback((query: string, tags: string[]) => {
    setSearchQuery(query);
    setSelectedTags(tags);
  }, []);

  // Get current templates based on tab
  const currentTemplates = activeTab === 'my' ? myTemplates : libraryTemplates;

  // Convert to card format
  const cardTemplates = currentTemplates.map(toCardTemplate);

  // Filter templates based on search query and selected tags
  const filteredTemplates = useMemo(() => {
    return cardTemplates.filter(template => {
      // Filter by tags
      if (selectedTags.length > 0) {
        const hasAllTags = selectedTags.every(tag => template.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(query);
        const matchesDescription = template.description.toLowerCase().includes(query);
        const matchesTags = template.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesName && !matchesDescription && !matchesTags) return false;
      }
      
      return true;
    });
  }, [cardTemplates, searchQuery, selectedTags]);

  // Sort templates
  const sortedTemplates = useMemo(() => {
    return [...filteredTemplates].sort((a, b) => {
      if (sortBy === 'popular') return b.downloads - a.downloads;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });
  }, [filteredTemplates, sortBy]);

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEdit = (template: Template) => {
    const fullTemplate = currentTemplates.find(t => t.publicId === template.id);
    if (fullTemplate) {
      setEditingTemplate(fullTemplate);
      setShowEditor(true);
    }
  };

  const handleDelete = (template: Template) => {
    const fullTemplate = currentTemplates.find(t => t.publicId === template.id);
    if (fullTemplate) {
      setDeletingTemplate(fullTemplate);
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    try {
      await workflowTemplateService.deleteTemplate(deletingTemplate.publicId);
      const deletedId = deletingTemplate.publicId;
      setMyTemplates(prev => prev.filter(t => t.publicId !== deletingTemplate.publicId));
      window.dispatchEvent(new CustomEvent('workflow-deleted', { detail: { publicId: deletedId } }));
      setShowDeleteModal(false);
      setDeletingTemplate(null);
      toast.success('Template deleted successfully');
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleEditorSave = async (template: WorkflowTemplate) => {
    if (editingTemplate) {
      setMyTemplates(prev => prev.map(t => t.publicId === template.publicId ? template : t));
      window.dispatchEvent(new CustomEvent('workflow-updated', { detail: template }));
    } else {
      setMyTemplates(prev => [template, ...prev]);
      window.dispatchEvent(new CustomEvent('workflow-created', { detail: template }));
    }
    setShowEditor(false);
    setEditingTemplate(null);
    toast.success(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
  };

  useEffect(() => { setIsHydrated(true); }, []);

  if (!isHydrated) return <TableSkeleton rows={6} cols={4} />;

  if (showEditor) {
    return (
      <WorkflowEditorModal
        workflow={editingTemplate}
        onClose={() => {
          setShowEditor(false);
          setEditingTemplate(null);
        }}
        onSuccess={handleEditorSave}
      />
    );
  }

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Search Bar */}
      <TemplateSearch allTags={availableTags} onSearch={handleSearch} />

      {/* Tabs and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-all border-b-2',
              activeTab === 'my'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            My Templates ({myTemplates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-all border-b-2',
              activeTab === 'library'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Template Library ({libraryTemplates.length})
          </button>
          
          {/* Create Workflow Button */}
          <button 
            onClick={handleCreateNew}
            className="ml-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create workflow
          </button>
        </div>
      </div>

      {/* Results Count and Sort */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading...' : `Showing ${sortedTemplates.length} template${sortedTemplates.length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Most Popular
        </button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : sortedTemplates.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTemplates.map(template => (
            <TemplateCard 
              key={template.id} 
              template={template}
              onEdit={activeTab === 'my' ? () => handleEdit(template) : undefined}
              onDelete={activeTab === 'my' ? () => handleDelete(template) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4">
            <WorkflowIcon />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No templates found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === 'my' 
              ? 'Create your first workflow template to get started'
              : 'Try adjusting your search or filters'}
          </p>
          {activeTab === 'my' && (
            <button 
              onClick={handleCreateNew}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.98]"
            >
              Create New Template
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw] p-6">
            <h2 className="text-[20px] font-medium text-red-600 mb-4">Delete Template</h2>
            <p className="text-[14px] text-[#6A7282] mb-6">
              Are you sure you want to delete "{deletingTemplate.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 h-11 rounded-[10px] bg-red-600 text-[14px] font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== WORKFLOW EDITOR MODAL ====================

interface WorkflowEditorModalProps {
  workflow?: WorkflowTemplate | null;
  onClose: () => void;
  onSuccess: (template: WorkflowTemplate) => void;
}

function WorkflowEditorModal({ workflow, onClose, onSuccess }: WorkflowEditorModalProps) {
  const isEditing = !!workflow;
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [category, setCategory] = useState(workflow?.category || 'Construction');
  const [tags, setTags] = useState<string[]>(workflow?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(workflow?.isPrivate || false);
  const [stageView, setStageView] = useState<'list' | 'visual'>('list');
  const [draggedStage, setDraggedStage] = useState<string | null>(null);
  const [editorStages, setEditorStages] = useState<StageData[]>(
    workflow?.stages.map((s, i) => ({
      id: s.id || `stage-${i + 1}`,
      name: s.name,
      description: s.description || '',
      color: (s.color || 'gray') as any,
      type: 'process' as const,
    })) || [
      { id: '1', name: 'Backlog', description: 'Tasks waiting to be started', color: 'gray' as const, type: 'start' as const },
      { id: '2', name: 'To Do', description: 'Ready to be worked on', color: 'blue' as const, type: 'process' as const },
      { id: '3', name: 'In Progress', description: 'Currently being worked on', color: 'yellow' as const, type: 'process' as const },
      { id: '4', name: 'Done', description: 'Completed', color: 'green' as const, type: 'end' as const },
    ]
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddStage = () => {
    const newStage: StageData = {
      id: Date.now().toString(),
      name: `Stage ${editorStages.length + 1}`,
      description: '',
      color: 'blue' as const,
      type: 'process' as const,
    };
    setEditorStages([...editorStages, newStage]);
  };

  const handleUpdateStage = (id: string, field: keyof StageData, value: any) => {
    setEditorStages(editorStages.map(stage => 
      stage.id === id ? { ...stage, [field]: value } : stage
    ));
  };

  const handleDeleteStage = (id: string) => {
    if (editorStages.length > 1) {
      setEditorStages(editorStages.filter(stage => stage.id !== id));
    }
  };

  const handleDragStart = (stageId: string) => {
    setDraggedStage(stageId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedStage && draggedStage !== targetId) {
      const draggedIndex = editorStages.findIndex(s => s.id === draggedStage);
      const targetIndex = editorStages.findIndex(s => s.id === targetId);
      const newStages = [...editorStages];
      const [removed] = newStages.splice(draggedIndex, 1);
      newStages.splice(targetIndex, 0, removed);
      setEditorStages(newStages);
    }
  };

  const handleDragEnd = () => {
    setDraggedStage(null);
  };

  const handleEditorChange = (data: { nodes: any[]; edges: any[] }) => {
    const newStages = data.nodes.map((node) => ({
      id: node.data.id,
      name: node.data.name,
      description: node.data.description,
      color: node.data.color,
      type: node.data.type || 'process',
    }));
    setEditorStages(newStages);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const stagesData = editorStages.map((s, i) => ({
        id: s.id || `stage-${i + 1}`,
        name: s.name,
        description: s.description,
        color: s.color,
      }));

      if (isEditing && workflow) {
        const updatedTemplate = await workflowTemplateService.updateTemplate(workflow.publicId, {
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          stages: stagesData,
          isPrivate,
        });
        onSuccess(updatedTemplate);
      } else {
        const newTemplate = await workflowTemplateService.createTemplate({
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          stages: stagesData,
          isPrivate,
        });
        onSuccess(newTemplate);
      }
    } catch (error) {
      toast.error(isEditing ? 'Failed to update template' : 'Failed to create template');
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = name.trim() && editorStages.length > 0;

  // Full page editor mode
  if (stageView === 'visual') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <h2 className="text-[18px] font-medium text-[#101828]">
            {isEditing ? 'Edit Workflow' : 'Create Workflow'} - Visual Editor
          </h2>
          <button 
            onClick={() => setStageView('list')}
            className="p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Workflow Editor */}
        <div className="flex-1 min-h-0">
          <WorkflowEditor
            initialStages={editorStages}
            onChange={handleEditorChange}
            onSave={(json) => console.log('Workflow JSON:', json)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 border-t border-[#E5E7EB] bg-gray-50">
          <button
            onClick={() => setStageView('list')}
            className="flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[720px] mx-auto py-6 px-6">
        {/* Back button and title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-[18px] font-medium text-[#101828]">
              {isEditing ? 'Edit Workflow Template' : 'Create Workflow Template'}
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-6">
            <h2 className="text-[18px] font-medium text-[#101828]">Basic Information</h2>

            {/* Template Name */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">
                Template Name <span className="text-[#FB2C36]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Construction Standard Workflow"
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this workflow template is for..."
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Construction">Construction</option>
                <option value="Software Development">Software Development</option>
                <option value="Marketing">Marketing</option>
                <option value="Design">Design</option>
                <option value="Operations">Operations</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">Tags</label>
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 min-h-[48px] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[13px] font-medium text-blue-700">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-blue-900 p-0.5 rounded-full hover:bg-blue-200 transition-colors">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={tags.length === 0 ? "Type tag and press Enter..." : "Add more..."}
                  className="flex-1 min-w-[120px] bg-transparent text-[14px] placeholder:text-[#99A1AF] focus:outline-none"
                />
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-[14px] text-[#364153]">Visibility</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                    !isPrivate
                      ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]"
                      : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                  )}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                    isPrivate
                      ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]"
                      : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                  )}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Private
                </button>
              </div>
            </div>
          </div>

          {/* Workflow Stages */}
          <div className="space-y-4 border-t border-[#E5E7EB] pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-medium text-[#101828]">Workflow Stages</h2>
                <p className="text-[13px] text-[#6A7282]">{editorStages.length} stages defined</p>
              </div>
              <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-[10px]">
                  <button
                    type="button"
                    onClick={() => setStageView('list')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                      stageView === 'list'
                        ? "bg-white shadow-sm text-[#101828]"
                        : "text-[#4A5565] hover:text-[#101828]"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setStageView('visual')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                      stageView === 'visual'
                        ? "bg-white shadow-sm text-[#101828]"
                        : "text-[#4A5565] hover:text-[#101828]"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    Visual
                  </button>
                </div>
              </div>
            </div>

            {/* List View */}
            <div className="space-y-3">
              {editorStages.map((stage, index) => (
                <div
                  key={stage.id}
                  draggable
                  onDragStart={() => handleDragStart(stage.id)}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-[10px] border border-[#E5E7EB] bg-white transition-all",
                    draggedStage === stage.id && "opacity-50"
                  )}
                >
                  {/* Drag Handle */}
                  <div className="flex items-center gap-2 pt-1">
                    <button type="button" className="cursor-grab text-[#9CA3AF] hover:text-[#6B7280]">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                      </svg>
                    </button>
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[12px] font-medium text-blue-600">
                      {index + 1}
                    </span>
                  </div>

                  {/* Stage Fields */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => handleUpdateStage(stage.id, 'name', e.target.value)}
                      placeholder="Stage name"
                      className="w-full bg-transparent text-[14px] font-medium text-[#101828] placeholder:text-[#99A1AF] focus:outline-none border-b border-transparent focus:border-blue-500 pb-1"
                    />
                    <input
                      type="text"
                      value={stage.description}
                      onChange={(e) => handleUpdateStage(stage.id, 'description', e.target.value)}
                      placeholder="Stage description (optional)"
                      className="w-full bg-transparent text-[13px] text-[#6A7282] placeholder:text-[#99A1AF] focus:outline-none"
                    />
                  </div>

                  {/* Delete Button */}
                  {editorStages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteStage(stage.id)}
                      className="p-1 text-[#9CA3AF] hover:text-red-500 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {/* Add Stage Button */}
              <button
                type="button"
                onClick={handleAddStage}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-[10px] border-2 border-dashed border-[#E5E7EB] text-[14px] font-medium text-[#6A7282] hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Stage
              </button>

              {/* Info Box */}
              <div className="flex items-start gap-3 p-4 rounded-[10px] bg-blue-50 border border-blue-100">
                <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[14px] text-blue-700">Drag stages to reorder them.</p>
                  <p className="text-[13px] text-blue-600">Tasks will move through these stages in sequence.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pb-8">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white h-11 px-6 text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || isSaving}
              className={cn(
                "inline-flex items-center gap-2 rounded-[10px] h-11 px-6 text-[14px] font-medium text-white transition-colors",
                isValid && !isSaving
                  ? "bg-[#155DFC] hover:bg-blue-700"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {isEditing ? 'Save Changes' : 'Create Template'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowTemplates;
