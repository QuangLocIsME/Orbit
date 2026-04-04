"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import templatesData from "@/data/templates.json";

interface WorkflowTemplate {
  id: string;
  name: string;
  stages: number;
}

const workflowTemplates: WorkflowTemplate[] = (
  templatesData.templates || []
).map((template: { id: string; name: string; stages: string[] }) => ({
  id: String(template.id),
  name: template.name,
  stages: Array.isArray(template.stages) ? template.stages.length : 0,
}));

interface WorkflowTemplatesDropdownProps {
  selectedWorkflow?: string;
  onSelect?: (workflowId: string) => void;
  onConfigureClick?: () => void;
}

export default function WorkflowTemplatesDropdown({
  selectedWorkflow,
  onSelect,
  onConfigureClick,
}: WorkflowTemplatesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = selectedWorkflow || workflowTemplates[0]?.id || "";

  const selectedTemplate =
    workflowTemplates.find((w) => w.id === selected) || workflowTemplates[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (workflowId: string) => {
    onSelect?.(workflowId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[14px] text-[#101828] hover:bg-gray-100 transition-colors"
      >
        <span className="h-2 w-2 rounded-full bg-[#155DFC]"></span>
        <span>{selectedTemplate.name}</span>
        <span className="text-[12px] text-[#6A7282]">
          ({selectedTemplate.stages} stages)
        </span>
        <svg
          className={cn(
            "h-4 w-4 text-[#99A1AF] transition-transform",
            isOpen && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[280px] bg-white rounded-[12px] shadow-[0px_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[#E5E7EB] z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E5E7EB]">
            <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">
              Workflow Templates
            </span>
          </div>

          {/* Options */}
          <div className="py-1">
            {workflowTemplates.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => handleSelect(workflow.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
                  selected === workflow.id
                    ? "bg-[#EFF6FF] text-[#155DFC]"
                    : "text-[#101828] hover:bg-gray-50",
                )}
              >
                <span
                  className={cn(
                    "text-[14px]",
                    selected === workflow.id ? "font-medium" : "font-normal",
                  )}
                >
                  {workflow.name}
                </span>
                <span
                  className={cn(
                    "text-[12px]",
                    selected === workflow.id
                      ? "text-[#155DFC]"
                      : "text-[#6A7282]",
                  )}
                >
                  {workflow.stages} stages
                </span>
              </button>
            ))}
          </div>

          {/* Configure Link */}
          <div className="border-t border-[#E5E7EB]">
            <button
              onClick={() => {
                onConfigureClick?.();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 text-[#155DFC] hover:bg-gray-50 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-[14px]">Configure Workflow</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
