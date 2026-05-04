'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { workflowTemplateService, type WorkflowTemplate } from '@/lib/workflow-template-service';
import { apiFetch } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from '@/components/ui/sonner';

interface WorkflowStageInfo {
  id: string;
  name: string;
}

interface WorkflowTemplatesDropdownProps {
  selectedWorkflow?: string;
  projectId?: string;
  canApply?: boolean;
  onSelect?: (workflowId: string, stages: WorkflowStageInfo[]) => void;
  onConfigureClick?: () => void;
}

export default function WorkflowTemplatesDropdown({ 
  selectedWorkflow = '',
  projectId,
  canApply = true,
  onSelect,
  onConfigureClick 
}: WorkflowTemplatesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(selectedWorkflow);
  const [customTemplates, setCustomTemplates] = useState<WorkflowTemplate[]>([]);
  const [myTemplates, setMyTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync selected with prop and set default to first "My Templates" item
  useEffect(() => {
    if (selectedWorkflow) {
      setSelected(selectedWorkflow);
    } else if (myTemplates.length > 0 && !selected) {
      setSelected(myTemplates[0].publicId);
      onSelect?.(myTemplates[0].publicId, myTemplates[0].stages.map((s: any) => ({ id: s.id, name: s.name })));
    }
  }, [selectedWorkflow, myTemplates, selected, onSelect]);

  // Fetch selectable templates (my + downloaded + library)
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      try {
        const [myRes, downloadedRes, libraryRes] = await Promise.all([
          workflowTemplateService.getMyTemplates({ limit: 50 }),
          workflowTemplateService.getDownloadedTemplates({ limit: 50 }),
          workflowTemplateService.getTemplates({ limit: 100, sort: 'recent' }),
        ]);

        setMyTemplates(myRes.templates);

        const byId = new Map<string, WorkflowTemplate>();
        [...myRes.templates, ...downloadedRes.templates, ...libraryRes.templates].forEach((template) => {
          if (!template?.publicId) return;
          if (!byId.has(template.publicId)) {
            byId.set(template.publicId, template);
          }
        });
        setCustomTemplates(Array.from(byId.values()));
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplates();

    // Listen for workflow changes
    const handleWorkflowChanged = () => fetchTemplates();
    window.addEventListener('workflow-created', handleWorkflowChanged);
    window.addEventListener('workflow-updated', handleWorkflowChanged);
    window.addEventListener('workflow-deleted', handleWorkflowChanged);
    const socket = getSocket();
    socket.on('workflow-template:changed', handleWorkflowChanged);

    return () => {
      window.removeEventListener('workflow-created', handleWorkflowChanged);
      window.removeEventListener('workflow-updated', handleWorkflowChanged);
      window.removeEventListener('workflow-deleted', handleWorkflowChanged);
      socket.off('workflow-template:changed', handleWorkflowChanged);
    };
  }, []);

  // Build all templates from API response
  const allTemplates = customTemplates.map(t => ({
    publicId: t.publicId,
    name: t.name,
    stages: t.stages.map(s => ({ id: s.id, name: s.name })),
  }));
  const selectedTemplate = allTemplates.find(w => w.publicId === selected) || null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (workflowId: string) => {
    const template = allTemplates.find(w => w.publicId === workflowId);
    const isChangingWorkflow = selected !== workflowId;
    const shouldApplyToProject = Boolean(projectId) && canApply && isChangingWorkflow;
    
    // Apply workflow template to project when user has permission
    if (shouldApplyToProject) {
      setIsApplying(true);
      try {
        const res = await apiFetch('/api/projects/workflow/apply-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            projectId,
            workflowTemplateId: workflowId,
          }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => null);
          toast.error(error.message || 'Failed to apply workflow template');
          setIsApplying(false);
          return;
        }

        const payload = await res.json();
        toast.success(payload.message || 'Workflow template applied');
        
        // Notify SettingsTab to refresh
        window.dispatchEvent(new CustomEvent('workflow-applied', { detail: { projectId, workflowId } }));
      } catch (error) {
        console.error('Failed to apply workflow template:', error);
        toast.error('Failed to apply workflow template');
        setIsApplying(false);
        return;
      }
      setIsApplying(false);
    }

    setSelected(workflowId);

    // Only call onSelect immediately when NOT applying to project.
    // When applying to project, the 'workflow-applied' event already triggers
    // ScopedTasksPanel.loadProjectWorkflowData() which sets the stages from the server.
    if (!shouldApplyToProject) {
      onSelect?.(workflowId, template?.stages || []);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={allTemplates.length === 0 || isApplying}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-[14px] text-[#101828] hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="inline-flex items-center gap-2 leading-none">
        {isApplying ? (
          <>
            <svg className="h-4 w-4 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[#6A7282]">Applying...</span>
          </>
        ) : selectedTemplate ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#155DFC]"></span>
            <span className="leading-none">{selectedTemplate.name}</span>
            <span className="text-[12px] leading-none text-[#6A7282]">({selectedTemplate.stages.length} stages)</span>
          </>
        ) : (
          <span className="leading-none text-[#6A7282]">Select Workflow</span>
        )}
        </span>
        <svg 
          className={cn("ml-1 h-4 w-4 shrink-0 text-[#99A1AF] transition-transform", isOpen && "rotate-180")} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[300px] bg-white rounded-[12px] shadow-[0px_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[#E5E7EB] z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E5E7EB]">
            <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">
              My Workflow Templates
            </span>
          </div>

          {/* Custom Templates */}
          {allTemplates.length > 0 ? (
            <div className="py-1">
              {allTemplates.map((workflow) => (
                <button
                  key={workflow.publicId}
                  onClick={() => handleSelect(workflow.publicId)}
                  disabled={isApplying}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
                    selected === workflow.publicId
                      ? "bg-[#EFF6FF] text-[#155DFC]"
                      : "text-[#101828] hover:bg-gray-50",
                    isApplying && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "text-[14px]",
                    selected === workflow.publicId ? "font-medium" : "font-normal"
                  )}>
                    {workflow.name}
                  </span>
                  <span className={cn(
                    "text-[12px]",
                    selected === workflow.publicId ? "text-[#155DFC]" : "text-[#6A7282]"
                  )}>
                    {workflow.stages.length} stages
                  </span>
                </button>
              ))}
            </div>
          ) : !isLoading && (
            <div className="px-4 py-6 text-center text-[13px] text-[#6A7282]">
              No workflow templates yet.
            </div>
          )}

          {isLoading && (
            <div className="px-4 py-3 text-[13px] text-[#6A7282]">
              Loading...
            </div>
          )}

          {/* Configure Link */}
          <div className="border-t border-[#E5E7EB]">
            <button
              onClick={() => {
                onConfigureClick?.();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 text-[#155DFC] hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[14px]">Configure Workflow</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
