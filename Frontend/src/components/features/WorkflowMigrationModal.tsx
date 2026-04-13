'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from '@/components/ui/sonner';
import { apiFetch } from '@/lib/api-client';

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  assigneeId: string;
}

interface WorkflowStage {
  id: string;
  name: string;
}

interface WorkflowMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  oldStages: WorkflowStage[];
  newStages: WorkflowStage[];
  projectId: string;
  onComplete: (taskStatusMap: Map<string, string>) => void;
}

interface DraggableTaskCardProps {
  task: Task;
  assigneeName?: string;
}

function DraggableTaskCard({ task, assigneeName }: DraggableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-[#FEE2E2] text-[#DC2626]',
    high: 'bg-[#FEE2E2] text-[#DC2626]',
    medium: 'bg-[#F0F9FF] text-[#0069A8]',
    low: 'bg-[#F3F4F6] text-[#364153]',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-white rounded-[10px] border border-[#E5E7EB] p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow',
        isDragging && 'shadow-lg border-[#155DFC]'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[11px]', priorityColors[task.priority] || priorityColors.low)}>
          {task.priority}
        </span>
        {assigneeName && (
          <span className="text-[11px] text-[#6A7282]">{assigneeName}</span>
        )}
      </div>
      <p className="text-[14px] text-[#101828] line-clamp-2">{task.title}</p>
    </div>
  );
}

interface DroppableStageColumnProps {
  stage: WorkflowStage;
  tasks: Task[];
  teamMembers: { id: string; name: string }[];
}

function DroppableStageColumn({ stage, tasks, teamMembers }: DroppableStageColumnProps) {
  const taskIds = tasks.map(t => t.id);

  return (
    <div className="flex flex-col w-[280px] min-h-[400px] bg-[#F9FAFB] rounded-lg p-3">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#E5E7EB]">
        <div className="h-3 w-3 rounded-full bg-[#155DFC]" />
        <span className="text-[14px] font-medium text-[#101828]">{stage.name}</span>
        <span className="text-[12px] text-[#6A7282] bg-white px-1.5 py-0.5 rounded">
          {tasks.length}
        </span>
      </div>

      {/* Droppable Area */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 flex flex-col gap-2 min-h-[100px]">
          {tasks.map((task) => {
            const assignee = teamMembers.find(m => m.id === task.assigneeId);
            return (
              <DraggableTaskCard
                key={task.id}
                task={task}
                assigneeName={assignee?.name}
              />
            );
          })}
          {tasks.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-[12px] text-[#9CA3AF] border-2 border-dashed border-[#E5E7EB] rounded-lg p-4">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function WorkflowMigrationModal({
  isOpen,
  onClose,
  tasks,
  oldStages,
  newStages,
  projectId,
  onComplete,
}: WorkflowMigrationModalProps) {
  const [stageTasks, setStageTasks] = useState<Map<string, Task[]>>(new Map());
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Initialize tasks by mapping old statuses to new stages
  useEffect(() => {
    if (!isOpen || tasks.length === 0) return;

    // Build a simple mapping from old stage to new stage (by index)
    const stageMapping = new Map<string, string>();
    const minLength = Math.min(oldStages.length, newStages.length);
    
    for (let i = 0; i < minLength; i++) {
      stageMapping.set(oldStages[i].id, newStages[i].id);
    }

    // Group tasks by their current status and map to new stages
    const grouped = new Map<string, Task[]>();
    const unassigned: Task[] = [];

    tasks.forEach(task => {
      const newStageId = stageMapping.get(task.status);
      if (newStageId) {
        const existing = grouped.get(newStageId) || [];
        grouped.set(newStageId, [...existing, task]);
      } else {
        // Task status doesn't map to any new stage
        unassigned.push(task);
      }
    });

    setStageTasks(grouped);
    setUnassignedTasks(unassigned);

    // Load team members
    const loadMembers = async () => {
      try {
        const res = await apiFetch('/api/projects/member-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        if (res.ok) {
          const data = await res.json();
          const members = (data.data || []).map((m: any) => ({
            id: m.userId || m.publicId,
            name: m.user?.fullName || 'Unknown',
          }));
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('Failed to load members:', error);
      }
    };
    loadMembers();
  }, [isOpen, tasks, oldStages, newStages, projectId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    // Find which stage the task currently belongs to
    let currentStageId: string | null = null;
    let taskIndex = -1;
    
    for (const [stageId, stageTaskList] of stageTasks.entries()) {
      const idx = stageTaskList.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        currentStageId = stageId;
        taskIndex = idx;
        break;
      }
    }

    // Check if dropped on unassigned
    const unassignedIdx = unassignedTasks.findIndex(t => t.id === taskId);
    if (unassignedIdx !== -1) {
      currentStageId = null;
      taskIndex = unassignedIdx;
    }

    // Check if dropped on another task
    for (const [stageId, stageTaskList] of stageTasks.entries()) {
      const idx = stageTaskList.findIndex(t => t.id === overId);
      if (idx !== -1) {
        // Move to this stage
        if (currentStageId === stageId) return; // Same stage

        setStageTasks(prev => {
          const newMap = new Map(prev);
          
          // Remove from current stage
          if (currentStageId) {
            const currentTasks = [...(newMap.get(currentStageId) || [])];
            currentTasks.splice(taskIndex, 1);
            newMap.set(currentStageId, currentTasks);
          }

          // Add to new stage
          const targetTasks = [...(newMap.get(stageId) || [])];
          const task = currentStageId 
            ? stageTasks.get(currentStageId)?.find(t => t.id === taskId)
            : unassignedTasks.find(t => t.id === taskId);
          if (task) {
            targetTasks.splice(idx, 0, { ...task, status: stageId });
            newMap.set(stageId, targetTasks);
          }

          return newMap;
        });
        return;
      }
    }

    // Check if dropped on unassigned area
    if (overId === 'unassigned') {
      setStageTasks(prev => {
        const newMap = new Map(prev);
        if (currentStageId) {
          const currentTasks = [...(newMap.get(currentStageId) || [])];
          currentTasks.splice(taskIndex, 1);
          newMap.set(currentStageId, currentTasks);
        }
        return newMap;
      });
      setUnassignedTasks(prev => {
        const task = currentStageId 
          ? stageTasks.get(currentStageId)?.find(t => t.id === taskId)
          : unassignedTasks.find(t => t.id === taskId);
        if (task) {
          return [...prev, { ...task, status: '' }];
        }
        return prev;
      });
      return;
    }

    // Check if dropped on a stage column directly
    const isStageColumn = newStages.some(s => s.id === overId);
    if (isStageColumn && currentStageId !== overId) {
      setStageTasks(prev => {
        const newMap = new Map(prev);
        
        // Remove from current stage
        if (currentStageId) {
          const currentTasks = [...(newMap.get(currentStageId) || [])];
          currentTasks.splice(taskIndex, 1);
          newMap.set(currentStageId, currentTasks);
        }

        // Add to new stage
        const task = currentStageId 
          ? stageTasks.get(currentStageId)?.find(t => t.id === taskId)
          : unassignedTasks.find(t => t.id === taskId);
        if (task) {
          const targetTasks = [...(newMap.get(overId) || [])];
          targetTasks.push({ ...task, status: overId });
          newMap.set(overId, targetTasks);
        }

        return newMap;
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build status map
      const taskStatusMap = new Map<string, string>();
      
      for (const [stageId, stageTaskList] of stageTasks.entries()) {
        stageTaskList.forEach(task => {
          taskStatusMap.set(task.id, stageId);
        });
      }
      
      unassignedTasks.forEach(task => {
        taskStatusMap.set(task.id, newStages[0].id); // Default to first stage
      });

      // Update each task
      for (const [taskId, newStatus] of taskStatusMap.entries()) {
        await apiFetch('/api/tasks/change-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            projectId,
            taskId,
            status: newStatus,
          }),
        });
      }

      toast.success('Tasks migrated successfully');
      onComplete(taskStatusMap);
      onClose();
    } catch (error) {
      console.error('Migration failed:', error);
      toast.error('Failed to migrate some tasks');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // Move all tasks to the first stage of the new workflow
    const taskStatusMap = new Map<string, string>();
    tasks.forEach(task => {
      taskStatusMap.set(task.id, newStages[0].id);
    });
    onComplete(taskStatusMap);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleSkip} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-[1200px] mx-4 bg-white rounded-[12px] shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-[18px] font-medium text-[#101828]">Migrate Tasks to New Workflow</h2>
            <p className="text-[13px] text-[#6A7282] mt-1">
              Drag and drop tasks to assign them to the new workflow stages
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 text-[#6A7282] hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {/* Unassigned Tasks */}
              {unassignedTasks.length > 0 && (
                <div className="flex flex-col w-[280px] min-h-[400px] bg-[#FFF7ED] rounded-lg p-3 border-2 border-dashed border-[#F97316]">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#FED7AA]">
                    <svg className="h-4 w-4 text-[#F97316]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-[14px] font-medium text-[#C2410C]">Unassigned</span>
                    <span className="text-[12px] text-[#6A7282] bg-white px-1.5 py-0.5 rounded">
                      {unassignedTasks.length}
                    </span>
                  </div>
                  <SortableContext items={unassignedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex-1 flex flex-col gap-2 min-h-[100px]">
                      {unassignedTasks.map((task) => {
                        const assignee = teamMembers.find(m => m.id === task.assigneeId);
                        return (
                          <DraggableTaskCard
                            key={task.id}
                            task={task}
                            assigneeName={assignee?.name}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              )}

              {/* New Workflow Stages */}
              {newStages.map((stage) => (
                <DroppableStageColumn
                  key={stage.id}
                  stage={stage}
                  tasks={stageTasks.get(stage.id) || []}
                  teamMembers={teamMembers}
                />
              ))}
            </div>
          </DndContext>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
          <button
            onClick={handleSkip}
            className="text-[14px] text-[#6A7282] hover:text-[#101828] transition-colors"
          >
            Skip - Move all to first stage
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-[#101828] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-[10px] bg-[#155DFC] text-[14px] text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSaving && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
