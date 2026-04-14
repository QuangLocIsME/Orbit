import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { T as TableSkeleton } from './TableSkeleton_Btc5tDDV.mjs';
import { Handle, Position, useNodesState, useEdgesState, addEdge, MarkerType, ReactFlow, Background, BackgroundVariant, Panel, Controls, MiniMap } from '@xyflow/react';
import 'clsx';

function TemplateSearch({ allTags, onSearch }) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredTags, setFilteredTags] = useState(allTags);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  useEffect(() => {
    const available = allTags.filter(
      (tag) => !selectedTags.includes(tag) && tag.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredTags(available);
  }, [query, selectedTags, allTags]);
  useEffect(() => {
    onSearch(query, selectedTags);
  }, [query, selectedTags, onSearch]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleAddTag = (tag) => {
    setSelectedTags((prev) => [...prev, tag]);
    setQuery("");
    inputRef.current?.focus();
  };
  const handleRemoveTag = (tag) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };
  const handleClearAll = () => {
    setSelectedTags([]);
    setQuery("");
  };
  const handleKeyDown = (e) => {
    if (e.key === "Backspace" && query === "" && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1]);
    }
    if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
    if (e.key === "Enter" && filteredTags.length > 0) {
      e.preventDefault();
      handleAddTag(filteredTags[0]);
    }
  };
  return /* @__PURE__ */ jsxs("div", { ref: containerRef, className: "relative w-full", children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: cn(
          "flex min-h-[44px] items-center gap-2 rounded-xl border bg-background px-4 py-2 transition-all duration-150",
          isDropdownOpen ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200 hover:border-gray-300"
        ),
        onClick: () => {
          inputRef.current?.focus();
          setIsDropdownOpen(true);
        },
        children: [
          /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 shrink-0 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-1 flex-wrap items-center gap-1.5", children: [
            selectedTags.map((tag) => /* @__PURE__ */ jsxs(
              "span",
              {
                className: "inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white",
                children: [
                  tag,
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: (e) => {
                        e.stopPropagation();
                        handleRemoveTag(tag);
                      },
                      className: "ml-0.5 rounded-full p-0.5 hover:bg-blue-700",
                      children: /* @__PURE__ */ jsx("svg", { className: "h-3 w-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                    }
                  )
                ]
              },
              tag
            )),
            /* @__PURE__ */ jsx(
              "input",
              {
                ref: inputRef,
                type: "text",
                value: query,
                onChange: (e) => setQuery(e.target.value),
                onFocus: () => setIsDropdownOpen(true),
                onKeyDown: handleKeyDown,
                placeholder: selectedTags.length === 0 ? "Search templates or filter by tags..." : "Search...",
                className: "min-w-[120px] flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: (e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              },
              className: cn(
                "shrink-0 rounded-lg p-1.5 transition-colors",
                isDropdownOpen ? "bg-blue-100 text-blue-600" : "text-muted-foreground hover:bg-gray-100"
              ),
              children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" }) })
            }
          )
        ]
      }
    ),
    isDropdownOpen && /* @__PURE__ */ jsxs("div", { className: "absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-200 bg-white p-4 shadow-lg", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
        /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: "Select tags to filter:" }),
        selectedTags.length > 0 && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: handleClearAll,
            className: "text-sm font-medium text-blue-600 hover:text-blue-700",
            children: "clear all"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
        filteredTags.map((tag) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => handleAddTag(tag),
            className: "inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95",
            children: tag
          },
          tag
        )),
        filteredTags.length === 0 && /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "No matching tags found" })
      ] })
    ] })
  ] });
}

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

const WorkflowIcon = () => /* @__PURE__ */ jsxs("svg", { width: "48", height: "48", viewBox: "0 0 48 48", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [
  /* @__PURE__ */ jsx("path", { d: "M12 6V30", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }),
  /* @__PURE__ */ jsx("path", { d: "M36 18C39.3137 18 42 15.3137 42 12C42 8.68629 39.3137 6 36 6C32.6863 6 30 8.68629 30 12C30 15.3137 32.6863 18 36 18Z", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }),
  /* @__PURE__ */ jsx("path", { d: "M12 42C15.3137 42 18 39.3137 18 36C18 32.6863 15.3137 30 12 30C8.68629 30 6 32.6863 6 36C6 39.3137 8.68629 42 12 42Z", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }),
  /* @__PURE__ */ jsx("path", { d: "M36 18C36 22.7739 34.1036 27.3523 30.7279 30.7279C27.3523 34.1036 22.7739 36 18 36", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" })
] });
const CATEGORIES = [
  "Construction",
  "Software Development",
  "Marketing",
  "Design",
  "Operations",
  "HR",
  "Finance",
  "Other"
];
function TemplateCard({ template }) {
  const visibleStages = template.stages.slice(0, 4);
  const remainingStages = template.stages.length - 4;
  return /* @__PURE__ */ jsxs("div", { className: "group rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:border-gray-300 hover:shadow-lg", children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-start justify-between gap-3", children: /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-foreground truncate", children: template.name }),
        /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-3 w-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }),
          template.isPrivate ? "Private" : "Public"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-medium text-white", children: template.author.charAt(0).toUpperCase() }),
        /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: template.author })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "mt-3 flex flex-wrap gap-1.5", children: template.tags.map((tag) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700", children: tag }, tag)) }),
    /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-muted-foreground line-clamp-2", children: template.description }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 text-sm text-muted-foreground", children: [
        /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }),
        /* @__PURE__ */ jsxs("span", { children: [
          template.stages.length,
          " stages"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap gap-1.5", children: [
        visibleStages.map((stage) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600", children: stage }, stage)),
        remainingStages > 0 && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500", children: [
          "+",
          remainingStages
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between border-t border-gray-100 pt-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 text-sm text-muted-foreground", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }),
          /* @__PURE__ */ jsx("span", { children: template.downloads })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 text-sm text-muted-foreground", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-amber-400", fill: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" }) }),
          /* @__PURE__ */ jsx("span", { children: template.rating })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 transition-all duration-150 hover:bg-blue-50 active:scale-95", children: [
        /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
          /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" }),
          /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 12a9 9 0 11-18 0 9 9 0 0118 0z" })
        ] }),
        "Use Template"
      ] })
    ] })
  ] });
}
function CreateWorkflowForm({ onClose, onSave }) {
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Construction");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [stageView, setStageView] = useState("list");
  const [stages, setStages] = useState([
    { id: "1", name: "Backlog", description: "", color: "gray" },
    { id: "2", name: "In Progress", description: "", color: "yellow" },
    { id: "3", name: "Done", description: "", color: "green" }
  ]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedStage, setDraggedStage] = useState(null);
  const handleAddTag = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };
  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };
  const handleAddStage = () => {
    const newStage = {
      id: Date.now().toString(),
      name: "",
      description: "",
      color: "gray"
    };
    setStages([...stages, newStage]);
  };
  const handleUpdateStage = (id, field, value) => {
    setStages(stages.map(
      (stage) => stage.id === id ? { ...stage, [field]: value } : stage
    ));
  };
  const handleDeleteStage = (id) => {
    if (stages.length > 1) {
      setStages(stages.filter((stage) => stage.id !== id));
    }
  };
  const handleDragStart = (stageId) => {
    setDraggedStage(stageId);
  };
  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    if (draggedStage && draggedStage !== targetId) {
      const draggedIndex = stages.findIndex((s) => s.id === draggedStage);
      const targetIndex = stages.findIndex((s) => s.id === targetId);
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
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    onSave({
      name: templateName,
      description,
      tags,
      stages,
      isPrivate: visibility === "private",
      category
    });
    setIsSaving(false);
  };
  const isFormValid = templateName.trim() && description.trim() && stages.length > 0;
  return /* @__PURE__ */ jsx("div", { className: "flex flex-col min-h-full bg-white", children: /* @__PURE__ */ jsx("div", { className: "flex-1", children: /* @__PURE__ */ jsxs("div", { className: "max-w-[720px] mx-auto py-6 px-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-6", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors",
          children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 19l-7-7m0 0l7-7m-7 7h18" }) })
        }
      ),
      /* @__PURE__ */ jsx("h1", { className: "text-[18px] font-medium text-[#101828]", children: "Create Workflow Template" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-medium text-[#101828]", children: "Basic Information" }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "text-[14px] text-[#364153]", children: [
          "Template Name ",
          /* @__PURE__ */ jsx("span", { className: "text-[#FB2C36]", children: "*" })
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: templateName,
            onChange: (e) => setTemplateName(e.target.value),
            placeholder: "e.g., Construction Standard Workflow",
            className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "text-[14px] text-[#364153]", children: [
          "Description ",
          /* @__PURE__ */ jsx("span", { className: "text-[#FB2C36]", children: "*" })
        ] }),
        /* @__PURE__ */ jsx(
          "textarea",
          {
            value: description,
            onChange: (e) => setDescription(e.target.value),
            placeholder: "Describe what this workflow template is for and when to use it...",
            rows: 4,
            className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "text-[14px] text-[#364153]", children: [
          "Category ",
          /* @__PURE__ */ jsx("span", { className: "text-[#FB2C36]", children: "*" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setIsCategoryOpen(!isCategoryOpen),
              className: "w-full flex items-center justify-between rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] hover:border-gray-300 transition-colors",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                    /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
                    /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
                  ] }),
                  category || "Select category"
                ] }),
                /* @__PURE__ */ jsx("svg", { className: cn("h-4 w-4 text-[#99A1AF] transition-transform", isCategoryOpen && "rotate-180"), fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })
              ]
            }
          ),
          isCategoryOpen && /* @__PURE__ */ jsxs("div", { className: "absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-10 max-h-[280px] overflow-y-auto", children: [
            /* @__PURE__ */ jsxs("div", { className: "p-3 border-b border-gray-100", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: customCategory,
                  onChange: (e) => setCustomCategory(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter" && customCategory.trim()) {
                      setCategory(customCategory.trim());
                      setCustomCategory("");
                      setIsCategoryOpen(false);
                    }
                  },
                  placeholder: "Type custom category...",
                  className: "w-full px-3 py-2 text-[14px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                }
              ),
              customCategory.trim() && /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setCategory(customCategory.trim());
                    setCustomCategory("");
                    setIsCategoryOpen(false);
                  },
                  className: "mt-2 w-full px-3 py-2 text-[13px] font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors",
                  children: [
                    '+ Create "',
                    customCategory.trim(),
                    '"'
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "py-1", children: CATEGORIES.map((cat) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  setCategory(cat);
                  setIsCategoryOpen(false);
                },
                className: cn(
                  "w-full px-4 py-2.5 text-left text-[14px] hover:bg-gray-50 transition-colors",
                  category === cat ? "bg-blue-50 text-blue-600" : "text-[#101828]"
                ),
                children: cat
              },
              cat
            )) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#364153]", children: "Tags" }),
          /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#9CA3AF]", children: "Press Enter to add multiple tags" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 min-h-[48px] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all", children: [
          tags.map((tag) => /* @__PURE__ */ jsxs(
            "span",
            {
              className: "inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[13px] font-medium text-blue-700",
              children: [
                tag,
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => handleRemoveTag(tag),
                    className: "hover:text-blue-900 p-0.5 rounded-full hover:bg-blue-200 transition-colors",
                    children: /* @__PURE__ */ jsx("svg", { className: "h-3 w-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                  }
                )
              ]
            },
            tag
          )),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: tagInput,
              onChange: (e) => setTagInput(e.target.value),
              onKeyDown: handleAddTag,
              placeholder: tags.length === 0 ? "Type tag and press Enter..." : "Add more...",
              className: "flex-1 min-w-[120px] bg-transparent text-[14px] placeholder:text-[#99A1AF] focus:outline-none"
            }
          )
        ] }),
        tags.length > 0 && /* @__PURE__ */ jsxs("p", { className: "text-[12px] text-[#6A7282]", children: [
          tags.length,
          " tag",
          tags.length !== 1 ? "s" : "",
          " added"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#364153]", children: "Visibility" }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setVisibility("public"),
              className: cn(
                "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                visibility === "public" ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]" : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
              ),
              children: [
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
                "Public"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setVisibility("private"),
              className: cn(
                "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                visibility === "private" ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]" : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
              ),
              children: [
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }),
                "Private"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: visibility === "public" ? "Anyone in your workspace can use this template" : "Only you can see and use this template" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-medium text-[#101828]", children: "Workflow Stages" }),
          /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Define the stages tasks will move through" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-[10px]", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setStageView("visual"),
                className: cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium transition-colors",
                  stageView === "visual" ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565] hover:text-[#101828]"
                ),
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" }) }),
                  "Visual"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setStageView("list"),
                className: cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium transition-colors",
                  stageView === "list" ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565] hover:text-[#101828]"
                ),
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 10h16M4 14h16M4 18h16" }) }),
                  "List"
                ]
              }
            )
          ] }),
          stageView === "list" && /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: handleAddStage,
              className: "inline-flex items-center gap-1.5 text-[14px] font-medium text-[#155DFC] hover:text-blue-700 transition-colors",
              children: [
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
                "Add Stage"
              ]
            }
          )
        ] })
      ] }),
      stageView === "list" ? /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        stages.map((stage, index) => /* @__PURE__ */ jsxs(
          "div",
          {
            draggable: true,
            onDragStart: () => handleDragStart(stage.id),
            onDragOver: (e) => handleDragOver(e, stage.id),
            onDragEnd: handleDragEnd,
            className: cn(
              "flex items-start gap-3 p-4 rounded-[10px] border border-[#E5E7EB] bg-white transition-all",
              draggedStage === stage.id && "opacity-50"
            ),
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 pt-2", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    className: "cursor-grab text-[#9CA3AF] hover:text-[#6B7280]",
                    children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { d: "M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" }) })
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[12px] font-medium text-blue-600", children: index + 1 })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-2", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    value: stage.name,
                    onChange: (e) => handleUpdateStage(stage.id, "name", e.target.value),
                    placeholder: "Stage name",
                    className: "w-full bg-transparent text-[14px] font-medium text-[#101828] placeholder:text-[#99A1AF] focus:outline-none border-b border-transparent focus:border-blue-500 pb-1"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    value: stage.description,
                    onChange: (e) => handleUpdateStage(stage.id, "description", e.target.value),
                    placeholder: "Stage description (optional)",
                    className: "w-full bg-transparent text-[13px] text-[#6A7282] placeholder:text-[#99A1AF] focus:outline-none"
                  }
                )
              ] }),
              stages.length > 1 && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleDeleteStage(stage.id),
                  className: "p-1 text-[#9CA3AF] hover:text-red-500 transition-colors",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) })
                }
              )
            ]
          },
          stage.id
        )),
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 p-4 rounded-[10px] bg-blue-50 border border-blue-100", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[14px] text-blue-700", children: "You can drag stages to reorder them later." }),
            /* @__PURE__ */ jsx("p", { className: "text-[14px] text-blue-600", children: "Tasks in your projects will move through these stages in sequence." })
          ] })
        ] })
      ] }) : (
        /* Visual View - React Flow Editor */
        /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] min-h-[500px] h-[500px] relative overflow-hidden", children: /* @__PURE__ */ jsx(
          WorkflowEditor,
          {
            initialStages: stages.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              color: s.color,
              type: "process"
            })),
            onChange: (data) => {
              const newStages = data.nodes.map((node) => ({
                id: node.data.id,
                name: node.data.name,
                description: node.data.description,
                color: node.data.color
              }));
              setStages(newStages);
            },
            onSave: (json) => {
              console.log("Workflow JSON:", json);
            }
          }
        ) })
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-medium text-[#101828] mb-4", children: "Preview" }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white p-5", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-semibold text-[#101828]", children: templateName || "Untitled Template" }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mt-1 text-[13px] text-[#6A7282]", children: [
          /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
            /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
            /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
          ] }),
          category,
          " • ",
          stages.length,
          " stages",
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 ml-1", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: visibility === "public" ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-3 text-[14px] text-[#6A7282]", children: description || "No description provided" }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 flex flex-wrap gap-1.5", children: stages.map((stage) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[12px] text-gray-600", children: stage.name || "Untitled" }, stage.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 flex justify-end gap-3 pb-8", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "inline-flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white h-11 px-6 text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
          children: "Cancel"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleSave,
          disabled: !isFormValid || isSaving,
          className: cn(
            "inline-flex items-center gap-2 rounded-[10px] h-11 px-6 text-[14px] font-medium text-white transition-colors",
            isFormValid && !isSaving ? "bg-[#155DFC] hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
          ),
          children: isSaving ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 animate-spin", fill: "none", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
              /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
            ] }),
            "Saving..."
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" }) }),
            "Save Template"
          ] })
        }
      )
    ] })
  ] }) }) });
}
function WorkflowTemplates({ templates: propsTemplates, allTags: propsTags }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState("popular");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [myTemplates, setMyTemplates] = useState([]);
  const [templates, setTemplates] = useState(propsTemplates || []);
  const [allTags, setAllTags] = useState(propsTags || []);
  useEffect(() => {
    const fetchData = async () => {
      if (propsTemplates) {
        setTemplates(propsTemplates);
      }
      if (propsTags) {
        setAllTags(propsTags);
      }
    };
    fetchData();
    setIsHydrated(true);
  }, [propsTemplates, propsTags]);
  const handleSearch = useCallback((query, tags) => {
    setSearchQuery(query);
    setSelectedTags(tags);
  }, []);
  const filteredTemplates = useMemo(() => {
    const baseTemplates = activeTab === "my" ? [...myTemplates, ...templates.filter((t) => t.author === "You")] : templates.filter((t) => !t.isPrivate && t.author !== "You");
    return baseTemplates.filter((template) => {
      if (selectedTags.length > 0) {
        const hasAllTags = selectedTags.every((tag) => template.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(query);
        const matchesDescription = template.description.toLowerCase().includes(query);
        const matchesTags = template.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesName && !matchesDescription && !matchesTags) return false;
      }
      return true;
    });
  }, [templates, myTemplates, searchQuery, selectedTags, activeTab]);
  const sortedTemplates = useMemo(() => {
    return [...filteredTemplates].sort((a, b) => {
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0;
    });
  }, [filteredTemplates, sortBy]);
  const handleSaveTemplate = (templateData) => {
    const newTemplate = {
      id: Date.now().toString(),
      name: templateData.name || "Untitled",
      description: templateData.description || "",
      author: "You",
      isPrivate: templateData.isPrivate || false,
      tags: templateData.tags || [],
      stages: templateData.stages.map((s) => s.name),
      downloads: 0,
      rating: 0,
      category: templateData.category
    };
    setMyTemplates((prev) => [newTemplate, ...prev]);
    setShowCreateForm(false);
  };
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  if (!isHydrated) return /* @__PURE__ */ jsx(TableSkeleton, { rows: 6, cols: 4 });
  if (showCreateForm) {
    return /* @__PURE__ */ jsx(CreateWorkflowForm, { onClose: () => setShowCreateForm(false), onSave: handleSaveTemplate });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsx(TemplateSearch, { allTags, onSearch: handleSearch }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setActiveTab("my"),
          className: cn(
            "px-4 py-2 text-sm font-medium transition-all border-b-2",
            activeTab === "my" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
          ),
          children: "My Templates"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setActiveTab("library"),
          className: cn(
            "px-4 py-2 text-sm font-medium transition-all border-b-2",
            activeTab === "library" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
          ),
          children: "Template Library"
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setShowCreateForm(true),
          className: "ml-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.98]",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
            "Create workflow"
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground", children: [
        "Showing ",
        sortedTemplates.length,
        " template",
        sortedTemplates.length !== 1 ? "s" : ""
      ] }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" }) }),
            "Most Popular"
          ]
        }
      )
    ] }),
    sortedTemplates.length > 0 ? /* @__PURE__ */ jsx("div", { className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: sortedTemplates.map((template) => /* @__PURE__ */ jsx(TemplateCard, { template }, template.id)) }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-20", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-4", children: /* @__PURE__ */ jsx(WorkflowIcon, {}) }),
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-foreground", children: "No templates found" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: activeTab === "my" ? "Create your first workflow template to get started" : "Try adjusting your search or filters" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setShowCreateForm(true),
          className: "mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.98]",
          children: "Create New Template"
        }
      )
    ] })
  ] });
}

const prerender = false;
const $$Templates = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Workflow Templates - ORBIT", "pageTitle": "Workflow" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "WorkflowTemplates", WorkflowTemplates, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/WorkflowTemplates", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/templates.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/templates.astro";
const $$url = "/templates";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Templates,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
