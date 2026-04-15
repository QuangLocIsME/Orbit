import { a as apiFetch } from './api-client_BrBa9f1N.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { Handle, Position, useNodesState, useEdgesState, addEdge, MarkerType, ReactFlow, Background, BackgroundVariant, Panel, Controls, MiniMap } from '@xyflow/react';
import { c as cn } from './utils_B05Dmz_H.mjs';
import 'clsx';

class WorkflowTemplateService {
  baseUrl = "/api/workflow-templates";
  // Get all public templates (library)
  async getTemplates(params) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.search) searchParams.set("search", params.search);
    if (params?.tags?.length) searchParams.set("tags", params.tags.join(","));
    if (params?.category) searchParams.set("category", params.category);
    if (params?.sort) searchParams.set("sort", params.sort);
    const query = searchParams.toString();
    const res = await apiFetch(`${this.baseUrl}${query ? `?${query}` : ""}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to fetch templates");
    return json.data;
  }
  // Get user's own templates
  async getMyTemplates(params) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    const query = searchParams.toString();
    const res = await apiFetch(`${this.baseUrl}/my${query ? `?${query}` : ""}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to fetch my templates");
    return json.data;
  }
  // Get single template
  async getTemplate(publicId) {
    const res = await apiFetch(`${this.baseUrl}/${publicId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to fetch template");
    return json.data;
  }
  // Create new template
  async createTemplate(data) {
    const res = await apiFetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to create template");
    return json.data;
  }
  // Update template
  async updateTemplate(publicId, data) {
    const res = await apiFetch(`${this.baseUrl}/${publicId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to update template");
    return json.data;
  }
  // Delete template
  async deleteTemplate(publicId) {
    const res = await apiFetch(`${this.baseUrl}/${publicId}`, {
      method: "DELETE"
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to delete template");
  }
  // Use template (increment downloads, optional rating)
  async useTemplate(publicId, rating) {
    const res = await apiFetch(`${this.baseUrl}/${publicId}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rating ? { rating } : {})
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to use template");
    return json.data;
  }
  // Get all available tags
  async getTags() {
    const res = await apiFetch(`${this.baseUrl}/tags`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to fetch tags");
    return json.data;
  }
  // Get all categories
  async getCategories() {
    const res = await apiFetch(`${this.baseUrl}/categories`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to fetch categories");
    return json.data;
  }
}
const workflowTemplateService = new WorkflowTemplateService();

const STAGE_COLORS$1 = {
  gray: { bg: "#F3F4F6", border: "#9CA3AF", text: "#364153" },
  blue: { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8" },
  yellow: { bg: "#FEF9C3", border: "#EAB308", text: "#A16207" },
  orange: { bg: "#FFEDD5", border: "#F97316", text: "#C2410C" },
  green: { bg: "#DCFCE7", border: "#22C55E", text: "#166534" },
  red: { bg: "#FEE2E2", border: "#EF4444", text: "#DC2626" }
};
const TYPE_ICONS = {
  start: (color) => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }) }),
  process: (color) => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }) }),
  decision: (color) => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { d: "M12 2l10 10-10 10L2 12z" }) }),
  end: (color) => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) })
};
const StageNode = memo(({ data, selected }) => {
  const colors = STAGE_COLORS$1[data.color || "gray"];
  const Icon = TYPE_ICONS[data.type || "process"];
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "relative transition-all duration-200",
      style: {
        filter: selected ? "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))" : "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))"
      },
      children: [
        /* @__PURE__ */ jsx(
          Handle,
          {
            type: "target",
            position: Position.Top,
            className: "!w-3 !h-3 !bg-muted-foreground !border-2 !border-card transition-all hover:!bg-primary"
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: "rounded-xl border-2 p-4 min-w-[180px] max-w-[220px] bg-white transition-all",
            style: {
              backgroundColor: colors.bg,
              borderColor: selected ? "#155DFC" : colors.border
            },
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
                Icon(colors.text),
                /* @__PURE__ */ jsx("span", { className: "font-medium text-sm truncate", style: { color: colors.text }, children: data.name || "Untitled Stage" })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground line-clamp-2", children: data.description || "No description" }),
              /* @__PURE__ */ jsx("div", { className: "mt-2 flex items-center gap-1.5", children: /* @__PURE__ */ jsx(
                "span",
                {
                  className: "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  style: {
                    backgroundColor: `${colors.border}20`,
                    color: colors.text
                  },
                  children: data.type || "process"
                }
              ) })
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          Handle,
          {
            type: "source",
            position: Position.Bottom,
            className: "!w-3 !h-3 !bg-muted-foreground !border-2 !border-card transition-all hover:!bg-primary"
          }
        ),
        selected && /* @__PURE__ */ jsx("div", { className: "absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-card" })
      ]
    }
  );
});
StageNode.displayName = "StageNode";

const COLORS = [
  { value: "gray", label: "Gray", hex: "#9CA3AF" },
  { value: "blue", label: "Blue", hex: "#3B82F6" },
  { value: "yellow", label: "Yellow", hex: "#EAB308" },
  { value: "orange", label: "Orange", hex: "#F97316" },
  { value: "green", label: "Green", hex: "#22C55E" },
  { value: "red", label: "Red", hex: "#EF4444" }
];
const TYPES = [
  { value: "start", label: "Start", description: "Beginning of workflow" },
  { value: "process", label: "Process", description: "Standard workflow step" },
  { value: "decision", label: "Decision", description: "Branching point" },
  { value: "end", label: "End", description: "Completion state" }
];
function StageSidebar({
  selectedNode,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}) {
  const data = selectedNode?.data;
  const popupRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);
  if (!isOpen || !selectedNode || !data) return null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/30 dark:bg-black/50 z-40" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref: popupRef,
        className: "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-h-[80vh] bg-card rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col border border-border",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-border", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "Edit Stage" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: onClose,
                className: "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
                children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 p-5 space-y-5 overflow-y-auto", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxs("label", { className: "block text-sm font-medium text-card-foreground", children: [
                "Stage Name ",
                /* @__PURE__ */ jsx("span", { className: "text-destructive", children: "*" })
              ] }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: data.name,
                  onChange: (e) => onUpdate(selectedNode.id, { name: e.target.value }),
                  placeholder: "Enter stage name",
                  className: "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-card-foreground", children: "Description" }),
              /* @__PURE__ */ jsx(
                "textarea",
                {
                  value: data.description,
                  onChange: (e) => onUpdate(selectedNode.id, { description: e.target.value }),
                  placeholder: "Describe this stage...",
                  rows: 3,
                  className: "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-card-foreground", children: "Color" }),
              /* @__PURE__ */ jsx("div", { className: "grid grid-cols-6 gap-2", children: COLORS.map((color) => /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onUpdate(selectedNode.id, { color: color.value }),
                  className: cn(
                    "w-9 h-9 rounded-lg border-2 transition-all hover:scale-110",
                    data.color === color.value ? "border-foreground ring-2 ring-offset-2 ring-foreground ring-offset-card" : "border-transparent"
                  ),
                  style: { backgroundColor: color.hex },
                  title: color.label
                },
                color.value
              )) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-card-foreground", children: "Stage Type" }),
              /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2", children: TYPES.map((type) => /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => onUpdate(selectedNode.id, { type: type.value }),
                  className: cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    data.type === type.value ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground hover:bg-muted"
                  ),
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-card-foreground", children: type.label }),
                    /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: type.description })
                  ]
                },
                type.value
              )) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "p-5 border-t border-border bg-muted/50 flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => onDelete(selectedNode.id),
                className: "flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }),
                  "Delete"
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: onClose,
                className: "flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors",
                children: "Done"
              }
            )
          ] })
        ]
      }
    )
  ] });
}

const nodeTypes = {
  stage: StageNode
};
const STAGE_COLORS = {
  gray: { bg: "#F3F4F6", border: "#9CA3AF", text: "#364153" },
  blue: { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8" },
  yellow: { bg: "#FEF9C3", border: "#EAB308", text: "#A16207" },
  orange: { bg: "#FFEDD5", border: "#F97316", text: "#C2410C" },
  green: { bg: "#DCFCE7", border: "#22C55E", text: "#166534" },
  red: { bg: "#FEE2E2", border: "#EF4444", text: "#DC2626" }
};
const defaultStages = [
  { id: "1", name: "Backlog", description: "Tasks waiting to be started", color: "gray", type: "start" },
  { id: "2", name: "To Do", description: "Ready to be worked on", color: "blue", type: "process" },
  { id: "3", name: "In Progress", description: "Currently being worked on", color: "yellow", type: "process" },
  { id: "4", name: "Review", description: "Under review", color: "orange", type: "process" },
  { id: "5", name: "Done", description: "Completed", color: "green", type: "end" }
];
function createInitialNodes(stages) {
  return stages.map((stage, index) => ({
    id: stage.id,
    type: "stage",
    position: {
      x: index === 0 ? 100 : 100 + (index - 1) % 4 * 200,
      y: index === 0 ? 50 : 200 + Math.floor((index - 1) / 4) * 150
    },
    data: stage
  }));
}
function createInitialEdges(stages) {
  const edges = [];
  for (let i = 0; i < stages.length - 1; i++) {
    edges.push({
      id: `e${stages[i].id}-${stages[i + 1].id}`,
      source: stages[i].id,
      target: stages[i + 1].id,
      animated: true,
      style: { stroke: "#9CA3AF", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#9CA3AF"
      }
    });
  }
  return edges;
}
function WorkflowEditor({ initialStages, onChange, onSave }) {
  const stages = initialStages && initialStages.length > 0 ? initialStages : defaultStages;
  const [nodes, setNodes, onNodesChange] = useNodesState(createInitialNodes(stages));
  const [edges, setEdges, onEdgesChange] = useEdgesState(createInitialEdges(stages));
  const [selectedNode, setSelectedNode] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const reactFlowWrapper = useRef(null);
  useEffect(() => {
    onChange?.({ nodes, edges });
  }, [nodes, edges, onChange]);
  const onConnect = useCallback(
    (params) => {
      setEdges(
        (eds) => addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#9CA3AF", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#9CA3AF"
            }
          },
          eds
        )
      );
    },
    [setEdges]
  );
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setShowSidebar(true);
  }, []);
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setShowSidebar(false);
  }, []);
  const handleAddStage = useCallback(() => {
    const newId = `stage-${Date.now()}`;
    const newStage = {
      id: newId,
      name: `Stage ${nodes.length + 1}`,
      description: "New stage description",
      color: "blue",
      type: "process"
    };
    const newNode = {
      id: newId,
      type: "stage",
      position: {
        x: 100 + nodes.length % 4 * 200,
        y: 50 + Math.floor(nodes.length / 4) * 150
      },
      data: newStage
    };
    setNodes((nds) => [...nds, newNode]);
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      setEdges((eds) => [
        ...eds,
        {
          id: `e${lastNode.id}-${newId}`,
          source: lastNode.id,
          target: newId,
          animated: true,
          style: { stroke: "#9CA3AF", strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#9CA3AF"
          }
        }
      ]);
    }
  }, [nodes, setNodes, setEdges]);
  const handleUpdateStage = useCallback(
    (nodeId, updates) => {
      setNodes(
        (nds) => nds.map(
          (node) => node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
        )
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(
          (prev) => prev ? { ...prev, data: { ...prev.data, ...updates } } : null
        );
      }
    },
    [setNodes, selectedNode]
  );
  const handleDeleteStage = useCallback(
    (nodeId) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges(
        (eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
        setShowSidebar(false);
      }
    },
    [setNodes, setEdges, selectedNode]
  );
  useCallback(() => {
    const workflowData = { nodes, edges };
    const json = JSON.stringify(workflowData, null, 2);
    onSave?.(json);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, onSave]);
  return /* @__PURE__ */ jsxs("div", { className: "flex h-full w-full relative", children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        ref: reactFlowWrapper,
        className: "flex-1 h-full",
        children: /* @__PURE__ */ jsxs(
          ReactFlow,
          {
            nodes,
            edges,
            onNodesChange,
            onEdgesChange,
            onConnect,
            onNodeClick,
            onPaneClick,
            nodeTypes,
            fitView: true,
            proOptions: { hideAttribution: true },
            className: "bg-muted/30",
            children: [
              /* @__PURE__ */ jsx(
                Background,
                {
                  variant: BackgroundVariant.Dots,
                  gap: 24,
                  size: 1.5,
                  color: "currentColor",
                  className: "opacity-20 text-muted-foreground"
                }
              ),
              /* @__PURE__ */ jsxs(Panel, { position: "top-left", className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: handleAddStage,
                    className: "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors",
                    children: [
                      /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
                      "Add Stage"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border", children: [
                  nodes.length,
                  " stages • ",
                  edges.length,
                  " transitions"
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                Controls,
                {
                  className: "bg-card rounded-lg border border-border shadow-sm [&>button]:border-border [&>button]:bg-card [&>button]:text-foreground [&>button:hover]:bg-muted",
                  showInteractive: false
                }
              ),
              /* @__PURE__ */ jsx(
                MiniMap,
                {
                  className: "bg-card rounded-lg border border-border shadow-sm",
                  nodeColor: (node) => STAGE_COLORS[node.data?.color || "gray"].border,
                  maskColor: "rgba(0, 0, 0, 0.08)"
                }
              )
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      StageSidebar,
      {
        selectedNode,
        isOpen: showSidebar,
        onClose: () => {
          setShowSidebar(false);
          setSelectedNode(null);
        },
        onUpdate: handleUpdateStage,
        onDelete: handleDeleteStage
      }
    )
  ] });
}

export { WorkflowEditor as W, workflowTemplateService as w };
