// WorkflowEditor - Main component using React Flow
import { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StageNode } from './StageNode';
import { StageSidebar } from './StageSidebar';
import { cn } from '@/lib/utils';

export interface StageData {
  id: string;
  name: string;
  description: string;
  color: 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red';
  type: 'start' | 'process' | 'decision' | 'end';
}

export interface WorkflowData {
  nodes: Node<StageData>[];
  edges: Edge[];
}

interface WorkflowEditorProps {
  initialStages?: StageData[];
  onChange?: (data: WorkflowData) => void;
  onSave?: (json: string) => void;
}

const nodeTypes: NodeTypes = {
  stage: StageNode,
};

const STAGE_COLORS = {
  gray: { bg: '#F3F4F6', border: '#9CA3AF', text: '#364153' },
  blue: { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8' },
  yellow: { bg: '#FEF9C3', border: '#EAB308', text: '#A16207' },
  orange: { bg: '#FFEDD5', border: '#F97316', text: '#C2410C' },
  green: { bg: '#DCFCE7', border: '#22C55E', text: '#166534' },
  red: { bg: '#FEE2E2', border: '#EF4444', text: '#DC2626' },
};

const defaultStages: StageData[] = [
  { id: '1', name: 'Backlog', description: 'Tasks waiting to be started', color: 'gray', type: 'start' },
  { id: '2', name: 'To Do', description: 'Ready to be worked on', color: 'blue', type: 'process' },
  { id: '3', name: 'In Progress', description: 'Currently being worked on', color: 'yellow', type: 'process' },
  { id: '4', name: 'Review', description: 'Under review', color: 'orange', type: 'process' },
  { id: '5', name: 'Done', description: 'Completed', color: 'green', type: 'end' },
];

function createInitialNodes(stages: StageData[]): Node<StageData>[] {
  return stages.map((stage, index) => ({
    id: stage.id,
    type: 'stage',
    position: { 
      x: index === 0 ? 100 : 100 + ((index - 1) % 4) * 200,
      y: index === 0 ? 50 : 200 + Math.floor((index - 1) / 4) * 150
    },
    data: stage,
  }));
}

function createInitialEdges(stages: StageData[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    edges.push({
      id: `e${stages[i].id}-${stages[i + 1].id}`,
      source: stages[i].id,
      target: stages[i + 1].id,
      animated: true,
      style: { stroke: '#9CA3AF', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#9CA3AF',
      },
    });
  }
  return edges;
}

export function WorkflowEditor({ initialStages, onChange, onSave }: WorkflowEditorProps) {
  const stages = initialStages && initialStages.length > 0 ? initialStages : defaultStages;
  const [nodes, setNodes, onNodesChange] = useNodesState(createInitialNodes(stages));
  const [edges, setEdges, onEdgesChange] = useEdgesState(createInitialEdges(stages));
  const [selectedNode, setSelectedNode] = useState<Node<StageData> | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Notify parent of changes
  useEffect(() => {
    onChange?.({ nodes, edges });
  }, [nodes, edges, onChange]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: '#9CA3AF', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#9CA3AF',
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<StageData>) => {
    setSelectedNode(node);
    setShowSidebar(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setShowSidebar(false);
  }, []);

  const handleAddStage = useCallback(() => {
    const newId = `stage-${Date.now()}`;
    const newStage: StageData = {
      id: newId,
      name: `Stage ${nodes.length + 1}`,
      description: 'New stage description',
      color: 'blue',
      type: 'process',
    };
    
    const newNode: Node<StageData> = {
      id: newId,
      type: 'stage',
      position: {
        x: 100 + (nodes.length % 4) * 200,
        y: 50 + Math.floor(nodes.length / 4) * 150,
      },
      data: newStage,
    };

    setNodes((nds) => [...nds, newNode]);

    // Auto-connect to last node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      setEdges((eds) => [
        ...eds,
        {
          id: `e${lastNode.id}-${newId}`,
          source: lastNode.id,
          target: newId,
          animated: true,
          style: { stroke: '#9CA3AF', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9CA3AF',
          },
        },
      ]);
    }
  }, [nodes, setNodes, setEdges]);

  const handleUpdateStage = useCallback(
    (nodeId: string, updates: Partial<StageData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, ...updates } } : null
        );
      }
    },
    [setNodes, selectedNode]
  );

  const handleDeleteStage = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
        setShowSidebar(false);
      }
    },
    [setNodes, setEdges, selectedNode]
  );

  const handleSaveWorkflow = useCallback(() => {
    const workflowData: WorkflowData = { nodes, edges };
    const json = JSON.stringify(workflowData, null, 2);
    onSave?.(json);
    
    // Download JSON file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, onSave]);

  return (
    <div className="flex h-full w-full relative">
      {/* Flow Editor */}
      <div 
        ref={reactFlowWrapper}
        className="flex-1 h-full"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-muted/30"
        >
          {/* Dotted grid background like the image */}
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={24} 
            size={1.5} 
            color="currentColor"
            className="opacity-20 text-muted-foreground"
          />
          
          <Panel position="top-left" className="flex items-center gap-3">
            <button
              onClick={handleAddStage}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Stage
            </button>
            <span className="text-sm text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border">
              {nodes.length} stages • {edges.length} transitions
            </span>
          </Panel>

          <Controls 
            className="bg-card rounded-lg border border-border shadow-sm [&>button]:border-border [&>button]:bg-card [&>button]:text-foreground [&>button:hover]:bg-muted"
            showInteractive={false}
          />
          
          <MiniMap 
            className="bg-card rounded-lg border border-border shadow-sm"
            nodeColor={(node) => STAGE_COLORS[(node.data as StageData)?.color || 'gray'].border}
            maskColor="rgba(0, 0, 0, 0.08)"
          />
        </ReactFlow>
      </div>

      {/* Sidebar */}
      <StageSidebar
        selectedNode={selectedNode}
        isOpen={showSidebar}
        onClose={() => {
          setShowSidebar(false);
          setSelectedNode(null);
        }}
        onUpdate={handleUpdateStage}
        onDelete={handleDeleteStage}
      />
    </div>
  );
}
