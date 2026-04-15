import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_CjntUweB.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_BrNsx_xn.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { T as TableSkeleton } from './TableSkeleton_Btc5tDDV.mjs';
import { w as workflowTemplateService, W as WorkflowEditor } from './WorkflowEditor_eDVMt_zh.mjs';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

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

const WorkflowIcon = () => /* @__PURE__ */ jsxs("svg", { width: "48", height: "48", viewBox: "0 0 48 48", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [
  /* @__PURE__ */ jsx("path", { d: "M12 6V30", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }),
  /* @__PURE__ */ jsx("path", { d: "M36 18C39.3137 18 42 15.3137 42 12C42 8.68629 39.3137 6 36 6C32.6863 6 30 8.68629 30 12C30 15.3137 32.6863 18 36 18Z", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }),
  /* @__PURE__ */ jsx("path", { d: "M12 42C15.3137 42 18 39.3137 18 36C18 32.6863 15.3137 30 12 30C8.68629 30 6 32.6863 6 36C6 39.3137 8.68629 42 12 42Z", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }),
  /* @__PURE__ */ jsx("path", { d: "M36 18C36 22.7739 34.1036 27.3523 30.7279 30.7279C27.3523 34.1036 22.7739 36 18 36", stroke: "#D1D5DC", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" })
] });
function toCardTemplate(template) {
  return {
    id: template.publicId,
    name: template.name,
    description: template.description || "",
    author: template.authorName || template.authorId,
    isPrivate: template.isPrivate,
    tags: template.tags || [],
    stages: template.stages?.map((s) => s.name) || [],
    downloads: template.downloads || 0,
    rating: template.rating || 0,
    category: template.category
  };
}
function TemplateCard({ template, onEdit, onDelete }) {
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
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        onEdit && /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onEdit,
            className: "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-all duration-150 hover:bg-gray-50 hover:border-gray-400",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) }),
              "Edit"
            ]
          }
        ),
        onDelete && /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onDelete,
            className: "inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 hover:border-red-300",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }),
              "Delete"
            ]
          }
        )
      ] })
    ] })
  ] });
}
function WorkflowTemplates({ templates: propsTemplates, allTags: propsTags }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState("popular");
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [myTemplates, setMyTemplates] = useState([]);
  const [libraryTemplates, setLibraryTemplates] = useState([]);
  const [availableTags, setAvailableTags] = useState(propsTags || []);
  const [isLoading, setIsLoading] = useState(false);
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [myRes, libraryRes, tagsRes] = await Promise.all([
        workflowTemplateService.getMyTemplates(),
        workflowTemplateService.getTemplates({ limit: 50 }),
        workflowTemplateService.getTags().catch(() => [])
      ]);
      setMyTemplates(myRes.templates);
      setLibraryTemplates(libraryRes.templates);
      setAvailableTags(tagsRes);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchData();
    setIsHydrated(true);
  }, [fetchData]);
  const handleSearch = useCallback((query, tags) => {
    setSearchQuery(query);
    setSelectedTags(tags);
  }, []);
  const currentTemplates = activeTab === "my" ? myTemplates : libraryTemplates;
  const cardTemplates = currentTemplates.map(toCardTemplate);
  const filteredTemplates = useMemo(() => {
    return cardTemplates.filter((template) => {
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
  }, [cardTemplates, searchQuery, selectedTags]);
  const sortedTemplates = useMemo(() => {
    return [...filteredTemplates].sort((a, b) => {
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0;
    });
  }, [filteredTemplates, sortBy]);
  const handleCreateNew = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };
  const handleEdit = (template) => {
    const fullTemplate = currentTemplates.find((t) => t.publicId === template.id);
    if (fullTemplate) {
      setEditingTemplate(fullTemplate);
      setShowEditor(true);
    }
  };
  const handleDelete = (template) => {
    const fullTemplate = currentTemplates.find((t) => t.publicId === template.id);
    if (fullTemplate) {
      setDeletingTemplate(fullTemplate);
      setShowDeleteModal(true);
    }
  };
  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    try {
      await workflowTemplateService.deleteTemplate(deletingTemplate.publicId);
      setMyTemplates((prev) => prev.filter((t) => t.publicId !== deletingTemplate.publicId));
      setShowDeleteModal(false);
      setDeletingTemplate(null);
      toast.success("Template deleted successfully");
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };
  const handleEditorSave = async (template) => {
    if (editingTemplate) {
      setMyTemplates((prev) => prev.map((t) => t.publicId === template.publicId ? template : t));
    } else {
      setMyTemplates((prev) => [template, ...prev]);
    }
    setShowEditor(false);
    setEditingTemplate(null);
    toast.success(editingTemplate ? "Template updated successfully" : "Template created successfully");
  };
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  if (!isHydrated) return /* @__PURE__ */ jsx(TableSkeleton, { rows: 6, cols: 4 });
  if (showEditor) {
    return /* @__PURE__ */ jsx(
      WorkflowEditorModal,
      {
        workflow: editingTemplate,
        onClose: () => {
          setShowEditor(false);
          setEditingTemplate(null);
        },
        onSuccess: handleEditorSave
      }
    );
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsx(TemplateSearch, { allTags: availableTags, onSearch: handleSearch }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => setActiveTab("my"),
          className: cn(
            "px-4 py-2 text-sm font-medium transition-all border-b-2",
            activeTab === "my" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
          ),
          children: [
            "My Templates (",
            myTemplates.length,
            ")"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => setActiveTab("library"),
          className: cn(
            "px-4 py-2 text-sm font-medium transition-all border-b-2",
            activeTab === "library" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
          ),
          children: [
            "Template Library (",
            libraryTemplates.length,
            ")"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: (e) => {
            e.preventDefault();
            handleCreateNew();
          },
          className: "ml-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.98]",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
            "Create workflow"
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: isLoading ? "Loading..." : `Showing ${sortedTemplates.length} template${sortedTemplates.length !== 1 ? "s" : ""}` }),
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
    isLoading ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-20", children: /* @__PURE__ */ jsx(Loader2, { className: "h-8 w-8 animate-spin text-blue-600" }) }) : sortedTemplates.length > 0 ? /* @__PURE__ */ jsx("div", { className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: sortedTemplates.map((template) => /* @__PURE__ */ jsx(
      TemplateCard,
      {
        template,
        onEdit: activeTab === "my" ? () => handleEdit(template) : void 0,
        onDelete: activeTab === "my" ? () => handleDelete(template) : void 0
      },
      template.id
    )) }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-20", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-4", children: /* @__PURE__ */ jsx(WorkflowIcon, {}) }),
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-foreground", children: "No templates found" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: activeTab === "my" ? "Create your first workflow template to get started" : "Try adjusting your search or filters" }),
      activeTab === "my" && /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: (e) => {
            e.preventDefault();
            handleCreateNew();
          },
          className: "mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.98]",
          children: "Create New Template"
        }
      )
    ] }),
    showDeleteModal && deletingTemplate && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => setShowDeleteModal(false) }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw] p-6", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-red-600 mb-4", children: "Delete Template" }),
        /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-[#6A7282] mb-6", children: [
          'Are you sure you want to delete "',
          deletingTemplate.name,
          '"? This action cannot be undone.'
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setShowDeleteModal(false),
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleConfirmDelete,
              className: "flex-1 h-11 rounded-[10px] bg-red-600 text-[14px] font-medium text-white hover:bg-red-700",
              children: "Delete"
            }
          )
        ] })
      ] })
    ] })
  ] });
}
function WorkflowEditorModal({ workflow, onClose, onSuccess }) {
  const isEditing = !!workflow;
  const [name, setName] = useState(workflow?.name || "");
  const [description, setDescription] = useState(workflow?.description || "");
  const [category, setCategory] = useState(workflow?.category || "Construction");
  const [tags, setTags] = useState(workflow?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [isPrivate, setIsPrivate] = useState(workflow?.isPrivate || false);
  const [stageView, setStageView] = useState("list");
  const [draggedStage, setDraggedStage] = useState(null);
  const [editorStages, setEditorStages] = useState(
    workflow?.stages.map((s, i) => ({
      id: s.id || `stage-${i + 1}`,
      name: s.name,
      description: s.description || "",
      color: s.color || "gray",
      type: "process"
    })) || [
      { id: "1", name: "Backlog", description: "Tasks waiting to be started", color: "gray", type: "start" },
      { id: "2", name: "To Do", description: "Ready to be worked on", color: "blue", type: "process" },
      { id: "3", name: "In Progress", description: "Currently being worked on", color: "yellow", type: "process" },
      { id: "4", name: "Done", description: "Completed", color: "green", type: "end" }
    ]
  );
  const [isSaving, setIsSaving] = useState(false);
  const handleAddTag = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };
  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };
  const handleAddStage = () => {
    const newStage = {
      id: Date.now().toString(),
      name: `Stage ${editorStages.length + 1}`,
      description: "",
      color: "blue",
      type: "process"
    };
    setEditorStages([...editorStages, newStage]);
  };
  const handleUpdateStage = (id, field, value) => {
    setEditorStages(editorStages.map(
      (stage) => stage.id === id ? { ...stage, [field]: value } : stage
    ));
  };
  const handleDeleteStage = (id) => {
    if (editorStages.length > 1) {
      setEditorStages(editorStages.filter((stage) => stage.id !== id));
    }
  };
  const handleDragStart = (stageId) => {
    setDraggedStage(stageId);
  };
  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    if (draggedStage && draggedStage !== targetId) {
      const draggedIndex = editorStages.findIndex((s) => s.id === draggedStage);
      const targetIndex = editorStages.findIndex((s) => s.id === targetId);
      const newStages = [...editorStages];
      const [removed] = newStages.splice(draggedIndex, 1);
      newStages.splice(targetIndex, 0, removed);
      setEditorStages(newStages);
    }
  };
  const handleDragEnd = () => {
    setDraggedStage(null);
  };
  const handleEditorChange = (data) => {
    const newStages = data.nodes.map((node) => ({
      id: node.data.id,
      name: node.data.name,
      description: node.data.description,
      color: node.data.color,
      type: node.data.type || "process"
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
        color: s.color
      }));
      if (isEditing && workflow) {
        const updatedTemplate = await workflowTemplateService.updateTemplate(workflow.publicId, {
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          stages: stagesData,
          isPrivate
        });
        onSuccess(updatedTemplate);
      } else {
        const newTemplate = await workflowTemplateService.createTemplate({
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          stages: stagesData,
          isPrivate
        });
        onSuccess(newTemplate);
      }
    } catch (error) {
      toast.error(isEditing ? "Failed to update template" : "Failed to create template");
    } finally {
      setIsSaving(false);
    }
  };
  const isValid = name.trim() && editorStages.length > 0;
  if (stageView === "visual") {
    return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex flex-col bg-white", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-4 border-b border-[#E5E7EB]", children: [
        /* @__PURE__ */ jsxs("h2", { className: "text-[18px] font-medium text-[#101828]", children: [
          isEditing ? "Edit Workflow" : "Create Workflow",
          " - Visual Editor"
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setStageView("list"),
            className: "p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
            children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 min-h-0", children: /* @__PURE__ */ jsx(
        WorkflowEditor,
        {
          initialStages: editorStages,
          onChange: handleEditorChange,
          onSave: (json) => console.log("Workflow JSON:", json)
        }
      ) }),
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-3 p-4 border-t border-[#E5E7EB] bg-gray-50", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setStageView("list"),
          className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
          children: "Back to Settings"
        }
      ) })
    ] });
  }
  return /* @__PURE__ */ jsx("div", { className: "min-h-full bg-white", children: /* @__PURE__ */ jsxs("div", { className: "max-w-[720px] mx-auto py-6 px-6", children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors",
          children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 19l-7-7m0 0l7-7m-7 7h18" }) })
        }
      ),
      /* @__PURE__ */ jsx("h1", { className: "text-[18px] font-medium text-[#101828]", children: isEditing ? "Edit Workflow Template" : "Create Workflow Template" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
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
              value: name,
              onChange: (e) => setName(e.target.value),
              placeholder: "e.g., Construction Standard Workflow",
              className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#364153]", children: "Description" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: description,
              onChange: (e) => setDescription(e.target.value),
              placeholder: "Describe what this workflow template is for...",
              rows: 3,
              className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#364153]", children: "Category" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: category,
              onChange: (e) => setCategory(e.target.value),
              className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              children: [
                /* @__PURE__ */ jsx("option", { value: "Construction", children: "Construction" }),
                /* @__PURE__ */ jsx("option", { value: "Software Development", children: "Software Development" }),
                /* @__PURE__ */ jsx("option", { value: "Marketing", children: "Marketing" }),
                /* @__PURE__ */ jsx("option", { value: "Design", children: "Design" }),
                /* @__PURE__ */ jsx("option", { value: "Operations", children: "Operations" }),
                /* @__PURE__ */ jsx("option", { value: "HR", children: "HR" }),
                /* @__PURE__ */ jsx("option", { value: "Finance", children: "Finance" }),
                /* @__PURE__ */ jsx("option", { value: "Other", children: "Other" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#364153]", children: "Tags" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 min-h-[48px] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all", children: [
            tags.map((tag) => /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[13px] font-medium text-blue-700", children: [
              tag,
              /* @__PURE__ */ jsx("button", { onClick: () => handleRemoveTag(tag), className: "hover:text-blue-900 p-0.5 rounded-full hover:bg-blue-200 transition-colors", children: /* @__PURE__ */ jsx("svg", { className: "h-3 w-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })
            ] }, tag)),
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
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#364153]", children: "Visibility" }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setIsPrivate(false),
                className: cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                  !isPrivate ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]" : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
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
                onClick: () => setIsPrivate(true),
                className: cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-[10px] h-[45px] text-[14px] font-medium transition-colors",
                  isPrivate ? "bg-[#EFF6FF] border border-[#155DFC] text-[#155DFC]" : "border border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                ),
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }),
                  "Private"
                ]
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-4 border-t border-[#E5E7EB] pt-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { className: "text-[16px] font-medium text-[#101828]", children: "Workflow Stages" }),
            /* @__PURE__ */ jsxs("p", { className: "text-[13px] text-[#6A7282]", children: [
              editorStages.length,
              " stages defined"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-[10px]", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setStageView("list"),
                className: cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                  stageView === "list" ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565] hover:text-[#101828]"
                ),
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 10h16M4 14h16M4 18h16" }) }),
                  "List"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setStageView("visual"),
                className: cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                  stageView === "visual" ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565] hover:text-[#101828]"
                ),
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" }) }),
                  "Visual"
                ]
              }
            )
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          editorStages.map((stage, index) => /* @__PURE__ */ jsxs(
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
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 pt-1", children: [
                  /* @__PURE__ */ jsx("button", { type: "button", className: "cursor-grab text-[#9CA3AF] hover:text-[#6B7280]", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { d: "M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" }) }) }),
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
                editorStages.length > 1 && /* @__PURE__ */ jsx(
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
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: handleAddStage,
              className: "w-full flex items-center justify-center gap-2 p-3 rounded-[10px] border-2 border-dashed border-[#E5E7EB] text-[14px] font-medium text-[#6A7282] hover:border-blue-400 hover:text-blue-600 transition-colors",
              children: [
                /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
                "Add Stage"
              ]
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 p-4 rounded-[10px] bg-blue-50 border border-blue-100", children: [
            /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[14px] text-blue-700", children: "Drag stages to reorder them." }),
              /* @__PURE__ */ jsx("p", { className: "text-[13px] text-blue-600", children: "Tasks will move through these stages in sequence." })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-3 pb-8", children: [
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
            onClick: handleSubmit,
            disabled: !isValid || isSaving,
            className: cn(
              "inline-flex items-center gap-2 rounded-[10px] h-11 px-6 text-[14px] font-medium text-white transition-colors",
              isValid && !isSaving ? "bg-[#155DFC] hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
            ),
            children: isSaving ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }),
              "Saving..."
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" }) }),
              isEditing ? "Save Changes" : "Create Template"
            ] })
          }
        )
      ] })
    ] })
  ] }) });
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
