import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { T as TaskDetailPage, $ as $$ProjectLayout } from './TaskDetailPage_CXno7v2w.mjs';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import * as React from 'react';
import { useState, useRef, useEffect, useMemo, createContext, useReducer, useCallback, useContext, useId } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { a as apiFetch } from './api-client_BrBa9f1N.mjs';
import { toast } from 'sonner';
import { useQueryClient, useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { P as PackagesManager } from './PackagesManager_CL6wvoik.mjs';
import { FolderPlus, Upload, ChevronRight, Folder, Trash2, Image, FileText, Eye, Download, PanelLeft, FolderTree, FlaskConical, ListChecks, X, LayoutGrid, FolderOpen, GitCompare, RefreshCcw, AlertTriangle, Puzzle, Users, Box, Code, Database, BookOpen, BarChart3, Settings, Zap, ListTodo, GitBranch, Shield, Bell, Plug, Plus, Loader2, Pencil, Check, Save, GripVertical, EyeOff, Tag, CheckCircle2, Lock, Mail, MessageSquare, Clock, Globe, Link2, Key, Circle, UserPlus, Copy } from 'lucide-react';
import { u as useAppStore } from './appStore_D9wuFrkU.mjs';
import { P as ProjectTopBar } from './ProjectTopBar_Cn37Yx3M.mjs';
import { a as apiUrl } from './api_BUHr_Cvh.mjs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { A as AlertDialog, a as AlertDialogContent, b as AlertDialogHeader, c as AlertDialogTitle, d as AlertDialogDescription, e as AlertDialogFooter, f as AlertDialogCancel, g as AlertDialogAction } from './useInviteNotifications_Dil9UiGe.mjs';
import { n as navigate } from './router_vN4ZPF0m.mjs';
import * as DialogPrimitive from '@radix-ui/react-dialog';

function findNodeById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}
function buildBreadcrumbs(root, currentId) {
  if (!root) return [];
  const path = [];
  const dfs = (node) => {
    path.push(node);
    if (node.id === currentId) return true;
    for (const child of node.children || []) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  };
  dfs(root);
  return path;
}
function deriveLocation(currentFolder, packageNode) {
  const targetId = currentFolder?.id || packageNode?.id || "root";
  if (targetId === "root") {
    return { packageId: "", folderType: "files", folderPath: "" };
  }
  const marker = "/pkg/";
  const pkgIndex = targetId.indexOf(marker);
  if (pkgIndex !== -1) {
    const pathAfterPkg = targetId.slice(pkgIndex + marker.length);
    const segments = pathAfterPkg.split("/").filter(Boolean);
    const packageId = segments[0] || "";
    const folderPath2 = segments.slice(1).join("/");
    return { packageId, folderType: "files", folderPath: folderPath2 };
  }
  const rootPrefix = "root/";
  const folderPath = targetId.startsWith(rootPrefix) ? targetId.slice(rootPrefix.length) : "";
  return { packageId: "", folderType: "files", folderPath };
}
function ProjectDocumentsManager({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [rootTree, setRootTree] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState("");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [hoveredId, setHoveredId] = useState("");
  const [renamingNodeId, setRenamingNodeId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const fileInputRef = useRef(null);
  const registerProjectCallback = useAppStore((s) => s.registerProjectCallback);
  useEffect(() => {
    const cleanup = registerProjectCallback(projectId, "documents:refresh", () => {
      loadDocumentsRef.current();
    });
    return cleanup;
  }, [registerProjectCallback, projectId]);
  const loadDocuments = async () => {
    const res = await fetch("/api/projects/packages/documents/list", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ projectId })
    });
    if (!res.ok) throw new Error("Failed to load documents");
    const payload = await res.json();
    setRootTree(payload?.data?.tree || null);
  };
  const loadDocumentsRef = useRef(loadDocuments);
  loadDocumentsRef.current = loadDocuments;
  const refresh = async () => {
    setLoading(true);
    try {
      await loadDocuments();
    } catch (err) {
      toast.error(err?.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, [projectId]);
  const packageNode = useMemo(() => {
    if (!rootTree) return null;
    return rootTree;
  }, [rootTree]);
  useEffect(() => {
    if (packageNode) {
      setCurrentFolderId(packageNode.id);
    }
  }, [packageNode?.id]);
  const currentFolder = useMemo(() => {
    if (!packageNode) return null;
    return findNodeById(packageNode, currentFolderId) || packageNode;
  }, [packageNode, currentFolderId]);
  const breadcrumbs = useMemo(() => {
    if (!packageNode || !currentFolder) return [];
    return buildBreadcrumbs(packageNode, currentFolder.id);
  }, [packageNode, currentFolder]);
  const createFolder = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }
    const location = deriveLocation(currentFolder, packageNode);
    const packageId = location.packageId;
    const res = await fetch("/api/projects/packages/documents/folders/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        projectId,
        packageId,
        folderType: location.folderType,
        folderName: folderName.trim(),
        parentPath: location.folderPath
      })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || "Failed to create folder");
    }
    setFolderName("");
    setIsCreateFolderOpen(false);
    await loadDocuments();
  };
  const uploadFile = async (file) => {
    setIsUploading(true);
    try {
      const location = deriveLocation(currentFolder, packageNode);
      const packageId = location.packageId;
      const folderType = location.folderType;
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("packageId", packageId);
      formData.append("folderType", folderType);
      formData.append("folderPath", location.folderPath);
      formData.append("file", file);
      const res = await fetch("/api/projects/packages/upload", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "Upload failed");
      }
      toast.success(payload?.mode === "queue" ? "Large file queued for background processing" : "File uploaded successfully");
      await loadDocuments();
    } finally {
      setIsUploading(false);
      setPendingUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const handleDelete = async (node) => {
    const endpoint = node.type === "folder" ? "/api/projects/packages/documents/folder/delete" : "/api/projects/packages/documents/file/delete";
    const body = node.type === "folder" ? { projectId, folderId: node.id } : { projectId, fileId: node.id };
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || "Delete failed");
    }
    toast.success(node.type === "folder" ? "Folder deleted successfully" : "File deleted successfully");
    await loadDocuments();
  };
  const startRename = (node) => {
    setRenamingNodeId(node.id);
    setRenameValue(node.name);
  };
  const submitRename = async (node) => {
    if (!renameValue.trim()) {
      setRenamingNodeId("");
      return;
    }
    const endpoint = node.type === "folder" ? "/api/projects/packages/documents/folder/rename" : "/api/projects/packages/documents/file/rename";
    const body = node.type === "folder" ? { projectId, folderId: node.id, newName: renameValue.trim() } : { projectId, fileId: node.id, newName: renameValue.trim() };
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || "Rename failed");
    }
    setRenamingNodeId("");
    setRenameValue("");
    await loadDocuments();
  };
  const openIfcViewer = (node) => {
    const targetVersionId = node.versionId || node.id;
    window.location.href = `/project/${projectId}/${node.id}/${targetVersionId}`;
  };
  const retryIfcConversion = async (node) => {
    const res = await apiFetch("/api/projects/packages/documents/retry-conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        projectId,
        fileId: node.id,
        versionId: node.versionId || node.id
      })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || "Failed to retry IFC conversion");
    }
    toast.success("Queued IFC conversion");
    await loadDocuments();
  };
  const getIfcTooltip = (node) => {
    if (!node.isIfc) return "View";
    if (node.conversionStatus === "READY") return "Open 3D viewer";
    if (node.conversionStatus === "FAILED") return node.conversionError || "Conversion failed. Click to retry";
    if (node.conversionStatus === "PROCESSING" || node.conversionStatus === "PENDING") return "Đang xử lý mô hình...";
    return "IFC viewer is not ready";
  };
  useEffect(() => {
    if (pendingUploadFile) {
      uploadFile(pendingUploadFile).catch((err) => toast.error(err?.message || "Upload failed"));
    }
  }, [pendingUploadFile]);
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px] text-sm text-gray-500", children: "Loading documents..." });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Documents & Drawings" }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setIsCreateFolderOpen(true),
            className: "inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50",
            children: [
              /* @__PURE__ */ jsx(FolderPlus, { className: "h-4 w-4" }),
              "Create Folder"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => fileInputRef.current?.click(),
            disabled: isUploading,
            className: "inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60",
            children: [
              /* @__PURE__ */ jsx(Upload, { className: "h-4 w-4" }),
              isUploading ? "Uploading..." : "Upload File"
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            ref: fileInputRef,
            type: "file",
            className: "hidden",
            onChange: (e) => setPendingUploadFile(e.target.files?.[0] || null)
          }
        )
      ] })
    ] }),
    breadcrumbs.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2 text-sm text-gray-500", children: breadcrumbs.map((node, idx) => /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2", children: [
      idx > 0 && /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4 text-gray-400" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setCurrentFolderId(node.id),
          className: idx === breadcrumbs.length - 1 ? "font-medium text-gray-800" : "hover:text-gray-800",
          children: node.name
        }
      )
    ] }, node.id)) }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h3", { className: "mb-3 text-[22px] font-medium text-[#101828]", children: currentFolder?.name || "All Files" }),
      /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-2xl border border-gray-200 bg-white", children: !currentFolder ? /* @__PURE__ */ jsx("p", { className: "p-4 text-sm text-gray-500", children: "No documents in this package yet." }) : (currentFolder.children || []).length === 0 ? /* @__PURE__ */ jsx("p", { className: "p-4 text-sm text-gray-500", children: "This folder is empty." }) : /* @__PURE__ */ jsx("ul", { children: (currentFolder.children || []).map((child, idx) => {
        const isLast = idx === (currentFolder.children || []).length - 1;
        if (child.type === "folder") {
          return /* @__PURE__ */ jsx(
            "li",
            {
              className: !isLast ? "border-b border-gray-200" : "",
              onMouseEnter: () => setHoveredId(child.id),
              onMouseLeave: () => setHoveredId(""),
              children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-4 py-4 hover:bg-gray-50", children: [
                /* @__PURE__ */ jsx("button", { onClick: () => setCurrentFolderId(child.id), className: "flex items-center gap-4 text-left", children: /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100", children: /* @__PURE__ */ jsx(Folder, { className: "h-5 w-5 text-gray-500" }) }) }),
                renamingNodeId === child.id ? /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: renameValue,
                    onChange: (e) => setRenameValue(e.target.value),
                    onBlur: () => submitRename(child).catch((e) => toast.error(e.message)),
                    onKeyDown: (e) => {
                      if (e.key === "Enter") submitRename(child).catch((err) => toast.error(err.message));
                      if (e.key === "Escape") setRenamingNodeId("");
                    },
                    className: "flex-1 rounded border border-gray-200 px-2 py-1 text-sm",
                    autoFocus: true
                  }
                ) : /* @__PURE__ */ jsx(
                  "button",
                  {
                    onDoubleClick: () => startRename(child),
                    onClick: () => setCurrentFolderId(child.id),
                    className: "flex-1 text-left text-sm font-medium text-[#101828]",
                    children: child.name
                  }
                ),
                hoveredId === child.id && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1", children: /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => handleDelete(child).catch((e) => toast.error(e.message)),
                    className: "rounded p-1 text-red-500 hover:bg-red-50",
                    children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" })
                  }
                ) })
              ] })
            },
            child.id
          );
        }
        const isImage = (child.mimeType || "").startsWith("image/") || child.category === "Image";
        return /* @__PURE__ */ jsx(
          "li",
          {
            className: !isLast ? "border-b border-gray-200" : "",
            onMouseEnter: () => setHoveredId(child.id),
            onMouseLeave: () => setHoveredId(""),
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-4 py-4 hover:bg-gray-50", children: [
              /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100", children: isImage ? /* @__PURE__ */ jsx(Image, { className: "h-5 w-5 text-gray-500" }) : /* @__PURE__ */ jsx(FileText, { className: "h-5 w-5 text-gray-500" }) }),
              renamingNodeId === child.id ? /* @__PURE__ */ jsx(
                "input",
                {
                  value: renameValue,
                  onChange: (e) => setRenameValue(e.target.value),
                  onBlur: () => submitRename(child).catch((e) => toast.error(e.message)),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") submitRename(child).catch((err) => toast.error(err.message));
                    if (e.key === "Escape") setRenamingNodeId("");
                  },
                  className: "flex-1 rounded border border-gray-200 px-2 py-1 text-sm",
                  autoFocus: true
                }
              ) : /* @__PURE__ */ jsx("button", { onDoubleClick: () => startRename(child), className: "flex-1 text-left text-sm font-medium text-[#101828]", children: child.name }),
              hoveredId === child.id && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                isImage && /* @__PURE__ */ jsx("button", { onClick: () => setPreviewImageUrl(child.s3Url || ""), className: "rounded p-1 text-gray-600 hover:bg-gray-100", title: "Preview image", children: /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" }) }),
                child.isIfc && /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => {
                      if (child.conversionStatus === "READY") {
                        openIfcViewer(child);
                        return;
                      }
                      if (child.conversionStatus === "FAILED") {
                        retryIfcConversion(child).catch((e) => toast.error(e?.message || "Failed to retry conversion"));
                        return;
                      }
                    },
                    disabled: child.conversionStatus === "PENDING" || child.conversionStatus === "PROCESSING",
                    title: getIfcTooltip(child),
                    className: "rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed",
                    children: /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsx("a", { href: child.s3Url || "#", download: true, className: "rounded p-1 text-gray-600 hover:bg-gray-100", title: "Download original file", children: /* @__PURE__ */ jsx(Download, { className: "h-4 w-4" }) }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => handleDelete(child).catch((e) => toast.error(e.message)),
                    className: "rounded p-1 text-red-500 hover:bg-red-50",
                    children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" })
                  }
                )
              ] })
            ] })
          },
          child.id
        );
      }) }) })
    ] }),
    isCreateFolderOpen && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40", onClick: () => setIsCreateFolderOpen(false), children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md rounded-xl bg-white p-5", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Create Folder" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Folder will be created at the current location." }),
      /* @__PURE__ */ jsx(
        "input",
        {
          value: folderName,
          onChange: (e) => setFolderName(e.target.value),
          placeholder: "Folder name",
          className: "mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setIsCreateFolderOpen(false), className: "rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100", children: "Cancel" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => createFolder().catch((e) => toast.error(e.message)),
            className: "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700",
            children: "Create"
          }
        )
      ] })
    ] }) }),
    previewImageUrl && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70", onClick: () => setPreviewImageUrl(""), children: /* @__PURE__ */ jsx("div", { className: "max-h-[90vh] max-w-[90vw]", onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsx("img", { src: previewImageUrl, alt: "Preview", className: "max-h-[90vh] max-w-[90vw] rounded-lg object-contain" }) }) })
  ] });
}

const statusOptions = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" }
];
const priorityOptions = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" }
];
function CreateTaskModal({ isOpen, onClose, onSubmit, assigneeOptions, tagOptions }) {
  const teamMembers = assigneeOptions && assigneeOptions.length > 0 ? [{ id: "", name: "Unassigned" }, ...assigneeOptions] : [{ id: "", name: "Unassigned" }];
  const resolvedTagOptions = Array.isArray(tagOptions) ? tagOptions : [];
  const [formData, setFormData] = useState({
    title: "",
    status: "todo",
    priority: "medium",
    description: "",
    assignee: "",
    dueDate: "",
    tags: [],
    linkedItems: ""
  });
  if (!isOpen) return null;
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  const handleTagToggle = (tag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag]
    }));
  };
  const handleSubmit = () => {
    if (!formData.title.trim()) return;
    onSubmit?.(formData);
    setFormData({
      title: "",
      status: "todo",
      priority: "medium",
      description: "",
      assignee: "",
      dueDate: "",
      tags: [],
      linkedItems: ""
    });
    onClose();
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-center justify-center",
      onClick: handleBackdropClick,
      children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/25" }),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: "relative z-10 w-full max-w-[768px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[90vh] overflow-y-auto",
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                  /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center w-10 h-10 bg-[#EFF6FF] rounded-[10px]", children: /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 text-[#155DFC]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.67, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }) }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-normal text-[#101828]", children: "Create New Task" }),
                    /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: "Add a task to your project" })
                  ] })
                ] }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: onClose,
                    className: "p-2 text-[#6A7282] hover:text-gray-600 rounded-[10px] hover:bg-gray-50 transition-colors",
                    children: /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.67, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "p-6 space-y-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxs("label", { className: "text-[14px] text-[#101828]", children: [
                    "Task Title",
                    /* @__PURE__ */ jsx("span", { className: "text-[#FF2056]", children: "*" })
                  ] }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "text",
                      value: formData.title,
                      onChange: (e) => setFormData((prev) => ({ ...prev, title: e.target.value })),
                      placeholder: "Enter task title...",
                      className: "w-full px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxs("label", { className: "text-[14px] text-[#101828]", children: [
                    "Status",
                    /* @__PURE__ */ jsx("span", { className: "text-[#FF2056]", children: "*" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: statusOptions.map((status) => /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setFormData((prev) => ({ ...prev, status: status.id })),
                      className: cn(
                        "flex-1 px-3 py-2.5 rounded-[10px] text-[14px] text-center transition-all",
                        formData.status === status.id ? "bg-[#EFF6FF] border-2 border-[#2B7FFF] text-[#1447E6]" : "bg-white border border-[#E5E7EB] text-[#4A5565] hover:border-gray-300"
                      ),
                      children: status.label
                    },
                    status.id
                  )) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxs("label", { className: "text-[14px] text-[#101828]", children: [
                    "Priority",
                    /* @__PURE__ */ jsx("span", { className: "text-[#FF2056]", children: "*" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: priorityOptions.map((priority) => /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setFormData((prev) => ({ ...prev, priority: priority.id })),
                      className: cn(
                        "flex-1 px-3 py-2.5 rounded-[10px] text-[14px] text-center transition-all",
                        formData.priority === priority.id ? "bg-[#F0F9FF] border-2 border-[#00A6F4] text-[#0069A8]" : "bg-white border border-[#E5E7EB] text-[#4A5565] hover:border-gray-300"
                      ),
                      children: priority.label
                    },
                    priority.id
                  )) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#101828]", children: "Description" }),
                  /* @__PURE__ */ jsx(
                    "textarea",
                    {
                      value: formData.description,
                      onChange: (e) => setFormData((prev) => ({ ...prev, description: e.target.value })),
                      placeholder: "Add a detailed description...",
                      rows: 4,
                      className: "w-full px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF] resize-none"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
                  /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                    /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#101828]", children: "Assignee" }),
                    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                      /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.33, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
                      /* @__PURE__ */ jsx(
                        "select",
                        {
                          value: formData.assignee,
                          onChange: (e) => setFormData((prev) => ({ ...prev, assignee: e.target.value })),
                          className: "w-full pl-10 pr-10 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] appearance-none focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]",
                          children: teamMembers.map((member) => /* @__PURE__ */ jsx("option", { value: member.id, children: member.name }, member.id))
                        }
                      ),
                      /* @__PURE__ */ jsx("svg", { className: "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF] pointer-events-none", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.33, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 9l-7 7-7-7" }) })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                    /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#101828]", children: "Due Date" }),
                    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                      /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.33, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }),
                      /* @__PURE__ */ jsx(
                        "input",
                        {
                          type: "date",
                          value: formData.dueDate,
                          onChange: (e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value })),
                          className: "w-full pl-10 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                        }
                      )
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#101828]", children: "Tags" }),
                  /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: resolvedTagOptions.length === 0 ? /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#6A7282]", children: "No task tags configured. Add tags in Settings → Tasks." }) : resolvedTagOptions.map((tag) => /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleTagToggle(tag),
                      className: cn(
                        "px-3 py-1.5 rounded-full text-[12px] transition-all",
                        formData.tags.includes(tag) ? "bg-[#1F2937] text-white" : "bg-[#F3F4F6] text-[#4A5565] hover:bg-gray-200"
                      ),
                      children: tag
                    },
                    tag
                  )) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-[14px] text-[#101828]", children: "Linked Drawings & Models" }),
                  /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                    /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.33, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" }) }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "text",
                        value: formData.linkedItems,
                        onChange: (e) => setFormData((prev) => ({ ...prev, linkedItems: e.target.value })),
                        placeholder: "Link to drawings, change requests, or clashes...",
                        className: "w-full pl-10 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                      }
                    )
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB]", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: onClose,
                    className: "text-[14px] text-[#101828] hover:text-gray-600 transition-colors",
                    children: "Cancel"
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: handleSubmit,
                    disabled: !formData.title.trim(),
                    className: "inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#7C9EF8] text-[14px] text-white hover:bg-[#6B8EE8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                    children: [
                      /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }),
                      "Create Task"
                    ]
                  }
                )
              ] })
            ]
          }
        )
      ]
    }
  );
}

const workflowTemplates = [
  { id: "construction-standard", name: "Construction Standard", stages: 5 },
  { id: "agile-scrum", name: "Agile Scrum", stages: 6 },
  { id: "design-review", name: "Design Review", stages: 4 },
  { id: "custom-workflow", name: "Custom Workflow", stages: 7 }
];
function WorkflowTemplatesDropdown({
  selectedWorkflow = "construction-standard",
  onSelect,
  onConfigureClick
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(selectedWorkflow);
  const dropdownRef = useRef(null);
  const selectedTemplate = workflowTemplates.find((w) => w.id === selected) || workflowTemplates[0];
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSelect = (workflowId) => {
    setSelected(workflowId);
    onSelect?.(workflowId);
    setIsOpen(false);
  };
  return /* @__PURE__ */ jsxs("div", { className: "relative", ref: dropdownRef, children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setIsOpen(!isOpen),
        className: "inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[14px] text-[#101828] hover:bg-gray-100 transition-colors",
        children: [
          /* @__PURE__ */ jsx("span", { className: "h-2 w-2 rounded-full bg-[#155DFC]" }),
          /* @__PURE__ */ jsx("span", { children: selectedTemplate.name }),
          /* @__PURE__ */ jsxs("span", { className: "text-[12px] text-[#6A7282]", children: [
            "(",
            selectedTemplate.stages,
            " stages)"
          ] }),
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: cn("h-4 w-4 text-[#99A1AF] transition-transform", isOpen && "rotate-180"),
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsxs("div", { className: "absolute top-full left-0 mt-2 w-[280px] bg-white rounded-[12px] shadow-[0px_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[#E5E7EB] z-50 overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "px-4 py-3 border-b border-[#E5E7EB]", children: /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium text-[#6A7282] uppercase tracking-wider", children: "Workflow Templates" }) }),
      /* @__PURE__ */ jsx("div", { className: "py-1", children: workflowTemplates.map((workflow) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => handleSelect(workflow.id),
          className: cn(
            "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
            selected === workflow.id ? "bg-[#EFF6FF] text-[#155DFC]" : "text-[#101828] hover:bg-gray-50"
          ),
          children: [
            /* @__PURE__ */ jsx("span", { className: cn(
              "text-[14px]",
              selected === workflow.id ? "font-medium" : "font-normal"
            ), children: workflow.name }),
            /* @__PURE__ */ jsxs("span", { className: cn(
              "text-[12px]",
              selected === workflow.id ? "text-[#155DFC]" : "text-[#6A7282]"
            ), children: [
              workflow.stages,
              " stages"
            ] })
          ]
        },
        workflow.id
      )) }),
      /* @__PURE__ */ jsx("div", { className: "border-t border-[#E5E7EB]", children: /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => {
            onConfigureClick?.();
            setIsOpen(false);
          },
          className: "w-full flex items-center gap-2 px-4 py-3 text-[#155DFC] hover:bg-gray-50 transition-colors",
          children: [
            /* @__PURE__ */ jsxs("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: [
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" }),
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-[14px]", children: "Configure Workflow" })
          ]
        }
      ) })
    ] })
  ] });
}

const WORLD_LIMIT = 220;
const WORLD_SCALE = 30;
const PIXELS_TO_WORLD = WORLD_SCALE;
const DEFAULT_SCENE_Y = 0;
const clampWorld = (value) => Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, value));
const bboxCenter = (bbox) => [
  (bbox.min[0] + bbox.max[0]) / 2,
  (bbox.min[1] + bbox.max[1]) / 2,
  (bbox.min[2] + bbox.max[2]) / 2
];
const bboxSize = (bbox) => ({
  width: Math.max((bbox.max[0] - bbox.min[0]) * WORLD_SCALE, 20),
  depth: Math.max((bbox.max[2] - bbox.min[2]) * WORLD_SCALE, 20),
  height: Math.max((bbox.max[1] - bbox.min[1]) * WORLD_SCALE, 20)
});
const worldToViewer = (worldPos, originWorld) => ({
  x: clampWorld((worldPos[0] - originWorld[0]) * WORLD_SCALE),
  y: worldPos[1] * WORLD_SCALE,
  z: clampWorld((worldPos[2] - originWorld[2]) * WORLD_SCALE)
});
function transformMeshPositionsToViewerSpace(positions, originWorld) {
  const [ox, , oz] = originWorld;
  const out = new Array(positions.length);
  for (let i = 0; i + 2 < positions.length; i += 3) {
    out[i] = clampWorld((positions[i] - ox) * WORLD_SCALE);
    out[i + 1] = positions[i + 1] * WORLD_SCALE;
    out[i + 2] = clampWorld((positions[i + 2] - oz) * WORLD_SCALE);
  }
  return out;
}
function computeWorldOriginFromScene(scene) {
  const pts = scene.filter((o) => o.worldPosition);
  if (pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const o of pts) {
    const [wx, wy, wz] = o.worldPosition;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
    if (wz < minZ) minZ = wz;
    if (wz > maxZ) maxZ = wz;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}
const buildSceneObjectsFromClash = (clash) => {
  const bboxA = clash.objectABBox;
  const bboxB = clash.objectBBBox;
  if (bboxA && bboxB) {
    const centerA = bboxCenter(bboxA);
    const centerB = bboxCenter(bboxB);
    const originWorld = [
      (centerA[0] + centerB[0]) / 2,
      (centerA[1] + centerB[1]) / 2,
      (centerA[2] + centerB[2]) / 2
    ];
    return [
      {
        id: clash.objectA,
        label: clash.element1?.category ?? clash.objectA,
        position: worldToViewer(centerA, originWorld),
        size: bboxSize(bboxA),
        worldPosition: centerA
      },
      {
        id: clash.objectB,
        label: clash.element2?.category ?? clash.objectB,
        position: worldToViewer(centerB, originWorld),
        size: bboxSize(bboxB),
        worldPosition: centerB
      }
    ];
  }
  return [
    {
      id: clash.objectA,
      label: clash.element1?.category ?? clash.objectA,
      position: { x: -58, y: DEFAULT_SCENE_Y, z: -12 },
      size: { width: 96, depth: 84, height: 96 }
    },
    {
      id: clash.objectB,
      label: clash.element2?.category ?? clash.objectB,
      position: { x: 34, y: DEFAULT_SCENE_Y, z: 18 },
      size: { width: 108, depth: 80, height: 84 }
    }
  ];
};
const intersects3D = (a, b) => {
  const halfXA = a.size.width / 2;
  const halfYA = a.size.height / 2;
  const halfZA = a.size.depth / 2;
  const halfXB = b.size.width / 2;
  const halfYB = b.size.height / 2;
  const halfZB = b.size.depth / 2;
  return Math.abs(a.position.x - b.position.x) < halfXA + halfXB && Math.abs(a.position.y - b.position.y) < halfYA + halfYB && Math.abs(a.position.z - b.position.z) < halfZA + halfZB;
};
function computeViewerAabbIntersection(a, b) {
  const hax = a.size.width / 2;
  const hay = a.size.height / 2;
  const haz = a.size.depth / 2;
  const hbx = b.size.width / 2;
  const hby = b.size.height / 2;
  const hbz = b.size.depth / 2;
  const minX = Math.max(a.position.x - hax, b.position.x - hbx);
  const maxX = Math.min(a.position.x + hax, b.position.x + hbx);
  const minY = Math.max(a.position.y - hay, b.position.y - hby);
  const maxY = Math.min(a.position.y + hay, b.position.y + hby);
  const minZ = Math.max(a.position.z - haz, b.position.z - hbz);
  const maxZ = Math.min(a.position.z + haz, b.position.z + hbz);
  if (minX >= maxX || minY >= maxY || minZ >= maxZ) return null;
  const w = maxX - minX;
  const h = maxY - minY;
  const d = maxZ - minZ;
  const MIN_VIS = 8;
  return {
    position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    size: {
      width: Math.max(w, MIN_VIS),
      height: Math.max(h, MIN_VIS),
      depth: Math.max(d, MIN_VIS)
    }
  };
}
const viewerOriginFromScenePair = (scene, objectA, objectB) => {
  const sa = scene.find((o) => o.id === objectA);
  const sb = scene.find((o) => o.id === objectB);
  if (!sa?.worldPosition || !sb?.worldPosition) return null;
  return [
    (sa.worldPosition[0] + sb.worldPosition[0]) / 2,
    (sa.worldPosition[1] + sb.worldPosition[1]) / 2,
    (sa.worldPosition[2] + sb.worldPosition[2]) / 2
  ];
};
function resolveClashZoneForViewer(clash, viewerObjects, scene) {
  const objA = viewerObjects.find((o) => o.id === clash.objectA);
  const objB = viewerObjects.find((o) => o.id === clash.objectB);
  if (!objA || !objB) return null;
  const inter = computeViewerAabbIntersection(objA, objB);
  if (inter) return inter;
  const originWorld = viewerOriginFromScenePair(scene ?? [], clash.objectA, clash.objectB);
  const MARKER = 22;
  if (originWorld) {
    const pt = worldToViewer(clash.position, originWorld);
    return {
      position: pt,
      size: { width: MARKER, height: MARKER, depth: MARKER }
    };
  }
  return {
    position: {
      x: (objA.position.x + objB.position.x) / 2,
      y: (objA.position.y + objB.position.y) / 2,
      z: (objA.position.z + objB.position.z) / 2
    },
    size: { width: MARKER, height: MARKER, depth: MARKER }
  };
}
const applyCollisionFlags = (objects) => objects.map((obj, _, all) => ({
  ...obj,
  isColliding: all.some((other) => other.id !== obj.id && intersects3D(obj, other))
}));
const buildViewerObjects = (scene, selectedObjectId, options) => {
  const mapped = scene.map((obj) => ({
    id: obj.id,
    label: obj.label,
    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    size: obj.size,
    isSelected: selectedObjectId === obj.id,
    isColliding: false
  }));
  if (options?.skipCollision) {
    return mapped;
  }
  return applyCollisionFlags(mapped);
};
const typeShortLabel = (type, category) => {
  const c = (category || "").trim();
  if (c) return c;
  return type.replace(/^Ifc/, "") || "Object";
};
function buildOverviewSceneFromFederated(objects, opts) {
  const max = opts.maxObjects ?? objects.length;
  const visible = objects.filter((o) => {
    if (o.hidden) return false;
    if (opts.hiddenModelIds.includes(o.sourceModel)) return false;
    const catKey = (o.category || o.type.replace(/^Ifc/, "")).trim();
    if (opts.hiddenCategories.length && opts.hiddenCategories.includes(catKey)) return false;
    return true;
  });
  const sorted = [...visible].sort((a, b) => {
    const m = a.sourceModel.localeCompare(b.sourceModel);
    if (m !== 0) return m;
    const c = (a.category || "").localeCompare(b.category || "");
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });
  const capped = max >= sorted.length ? sorted : sorted.slice(0, max);
  if (capped.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const o of capped) {
    const b = o.boundingBox;
    minX = Math.min(minX, b.min[0]);
    minY = Math.min(minY, b.min[1]);
    minZ = Math.min(minZ, b.min[2]);
    maxX = Math.max(maxX, b.max[0]);
    maxY = Math.max(maxY, b.max[1]);
    maxZ = Math.max(maxZ, b.max[2]);
  }
  const originWorld = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2
  ];
  return capped.map((o) => {
    const bbox = o.boundingBox;
    const center = bboxCenter(bbox);
    return {
      id: o.id,
      label: typeShortLabel(o.type, o.category),
      position: worldToViewer(center, originWorld),
      size: bboxSize(bbox),
      worldPosition: center
    };
  });
}

const scenesEqual = (sceneA, sceneB) => {
  if (!sceneA || !sceneB) return false;
  if (sceneA.length !== sceneB.length) return false;
  for (let index = 0; index < sceneA.length; index += 1) {
    const a = sceneA[index];
    const b = sceneB[index];
    if (!b || a.id !== b.id) return false;
    if (a.position.x !== b.position.x || a.position.y !== b.position.y || a.position.z !== b.position.z) {
      return false;
    }
  }
  return true;
};
const reducer = (state, action) => {
  switch (action.type) {
    case "HYDRATE":
      return {
        persistedScenesByClashId: action.payload.persistedScenesByClashId,
        scenesByClashId: action.payload.persistedScenesByClashId,
        resolvedByClashId: action.payload.resolvedByClashId,
        hydrated: true
      };
    case "ENSURE_SCENE": {
      const { clashId, scene, force } = action.payload;
      if (!force && state.scenesByClashId[clashId]) {
        return state;
      }
      return {
        ...state,
        scenesByClashId: {
          ...state.scenesByClashId,
          [clashId]: scene
        },
        persistedScenesByClashId: {
          ...state.persistedScenesByClashId,
          [clashId]: state.persistedScenesByClashId[clashId] ?? scene
        }
      };
    }
    case "UPDATE_OBJECT_POSITION": {
      const { clashId, objectId, position } = action.payload;
      const currentScene = state.scenesByClashId[clashId];
      if (!currentScene) {
        return state;
      }
      return {
        ...state,
        scenesByClashId: {
          ...state.scenesByClashId,
          [clashId]: currentScene.map(
            (obj) => obj.id === objectId ? {
              ...obj,
              position: {
                x: clampWorld(position.x),
                y: position.y,
                z: clampWorld(position.z)
              }
            } : obj
          )
        }
      };
    }
    case "SAVE_SCENE": {
      const { clashId } = action.payload;
      const scene = state.scenesByClashId[clashId];
      if (!scene) return state;
      return {
        ...state,
        persistedScenesByClashId: {
          ...state.persistedScenesByClashId,
          [clashId]: scene
        }
      };
    }
    case "SAVE_ALL_DIRTY_SCENES": {
      const nextPersisted = { ...state.persistedScenesByClashId };
      for (const clashId of Object.keys(state.scenesByClashId)) {
        const draft = state.scenesByClashId[clashId];
        if (!scenesEqual(draft, state.persistedScenesByClashId[clashId])) {
          nextPersisted[clashId] = draft.map((o) => ({
            ...o,
            position: { ...o.position }
          }));
        }
      }
      return { ...state, persistedScenesByClashId: nextPersisted };
    }
    case "DISCARD_ALL_DIRTY_SCENES": {
      const nextScenes = { ...state.scenesByClashId };
      for (const clashId of Object.keys(nextScenes)) {
        const persisted = state.persistedScenesByClashId[clashId];
        if (!persisted) continue;
        if (!scenesEqual(nextScenes[clashId], persisted)) {
          nextScenes[clashId] = persisted.map((o) => ({
            ...o,
            position: { ...o.position }
          }));
        }
      }
      return { ...state, scenesByClashId: nextScenes };
    }
    case "DISCARD_SCENE": {
      const { clashId } = action.payload;
      const persisted = state.persistedScenesByClashId[clashId];
      if (!persisted) return state;
      return {
        ...state,
        scenesByClashId: {
          ...state.scenesByClashId,
          [clashId]: persisted.map((o) => ({
            ...o,
            position: { ...o.position }
          }))
        }
      };
    }
    case "MARK_CLASH_RESOLVED": {
      const { clashId, resolved } = action.payload;
      return {
        ...state,
        resolvedByClashId: {
          ...state.resolvedByClashId,
          [clashId]: resolved
        }
      };
    }
  }
  return state;
};
const ClashViewerContext = createContext(null);
const buildStorageKey = (projectSlug) => `orbit:clashViewer:${projectSlug}`;
function ClashViewerProvider({ projectSlug, children }) {
  const storageKey = useMemo(() => buildStorageKey(projectSlug), [projectSlug]);
  const [state, dispatch] = useReducer(reducer, {
    persistedScenesByClashId: {},
    scenesByClashId: {},
    resolvedByClashId: {},
    hydrated: false
  });
  const saveTimerRef = useRef(null);
  const saveSnapshotRef = useRef(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        dispatch({ type: "HYDRATE", payload: { persistedScenesByClashId: {}, resolvedByClashId: {} } });
        return;
      }
      const parsed = JSON.parse(raw);
      const persistedScenes = parsed.persistedScenesByClashId ?? parsed.scenesByClashId ?? {};
      dispatch({
        type: "HYDRATE",
        payload: {
          persistedScenesByClashId: persistedScenes,
          resolvedByClashId: parsed.resolvedByClashId ?? {}
        }
      });
    } catch {
      dispatch({ type: "HYDRATE", payload: { persistedScenesByClashId: {}, resolvedByClashId: {} } });
    }
  }, [storageKey]);
  useEffect(() => {
    if (!state.hydrated) return;
    saveSnapshotRef.current = {
      persistedScenesByClashId: state.persistedScenesByClashId,
      resolvedByClashId: state.resolvedByClashId
    };
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      if (!saveSnapshotRef.current) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(saveSnapshotRef.current));
      } catch {
      }
    }, 300);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [state.hydrated, state.persistedScenesByClashId, state.resolvedByClashId, storageKey]);
  const ensureSceneForClash = useCallback(
    (clash) => {
      const clashId = clash.id;
      const existingScene = state.scenesByClashId[clashId];
      const baseScene = buildSceneObjectsFromClash(clash);
      const resolvedRecord = state.resolvedByClashId[clashId];
      if (resolvedRecord?.resolvedPositions?.length) {
        const resolvedById = new Map(resolvedRecord.resolvedPositions.map((p) => [p.id, p.position]));
        const nextScene = baseScene.map((obj) => {
          const resolvedPos = resolvedById.get(obj.id);
          if (!resolvedPos) return obj;
          const [x, y, z] = resolvedPos;
          return { ...obj, position: { x, y, z } };
        });
        dispatch({ type: "ENSURE_SCENE", payload: { clashId, scene: nextScene, force: true } });
        return;
      }
      if (existingScene) return;
      dispatch({ type: "ENSURE_SCENE", payload: { clashId, scene: baseScene } });
    },
    [state.resolvedByClashId, state.scenesByClashId]
  );
  const updateObjectPosition = useCallback((clashId, objectId, position) => {
    dispatch({ type: "UPDATE_OBJECT_POSITION", payload: { clashId, objectId, position } });
  }, []);
  const saveClashScene = useCallback((clashId) => {
    dispatch({ type: "SAVE_SCENE", payload: { clashId } });
  }, []);
  const saveClashSceneToServer = useCallback(async (clashId, projectSlug2) => {
    const scene = state.scenesByClashId[clashId];
    if (!scene) return;
    const objects = scene.map((obj) => ({
      id: obj.id,
      position: [obj.position.x, obj.position.y, obj.position.z]
    }));
    try {
      await apiFetch(
        apiUrl(`/projects/${encodeURIComponent(projectSlug2)}/clashes/${encodeURIComponent(clashId)}/positions`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objects })
        }
      );
      dispatch({ type: "SAVE_SCENE", payload: { clashId } });
    } catch {
    }
  }, [state.scenesByClashId]);
  const loadClashSceneFromServer = useCallback(async (clashId, projectSlug2) => {
    try {
      const res = await apiFetch(
        apiUrl(`/projects/${encodeURIComponent(projectSlug2)}/clashes/${encodeURIComponent(clashId)}/positions`)
      );
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.objects || data.objects.length === 0) return false;
      const posById = new Map(data.objects.map((o) => [o.id, o.position]));
      const existingScene = state.scenesByClashId[clashId];
      if (!existingScene) return false;
      const nextScene = existingScene.map((obj) => {
        const pos = posById.get(obj.id);
        if (!pos) return obj;
        const [x, y, z] = pos;
        return { ...obj, position: { x, y, z } };
      });
      dispatch({ type: "ENSURE_SCENE", payload: { clashId, scene: nextScene, force: true } });
      dispatch({ type: "SAVE_SCENE", payload: { clashId } });
      return true;
    } catch {
      return false;
    }
  }, [state.scenesByClashId]);
  const saveAllDirtyScenes = useCallback(() => {
    dispatch({ type: "SAVE_ALL_DIRTY_SCENES" });
  }, []);
  const discardAllDirtyScenes = useCallback(() => {
    dispatch({ type: "DISCARD_ALL_DIRTY_SCENES" });
  }, []);
  const discardClashScene = useCallback((clashId) => {
    dispatch({ type: "DISCARD_SCENE", payload: { clashId } });
  }, []);
  const hasAnyUnsavedSceneChanges = useCallback(() => {
    for (const clashId of Object.keys(state.scenesByClashId)) {
      if (!scenesEqual(state.scenesByClashId[clashId], state.persistedScenesByClashId[clashId])) {
        return true;
      }
    }
    return false;
  }, [state.persistedScenesByClashId, state.scenesByClashId]);
  const isClashDirty = useCallback(
    (clashId) => !scenesEqual(state.scenesByClashId[clashId], state.persistedScenesByClashId[clashId]),
    [state.persistedScenesByClashId, state.scenesByClashId]
  );
  const getScene = useCallback((clashId) => state.scenesByClashId[clashId] ?? null, [state.scenesByClashId]);
  const getSceneObjectPositionVec3 = useCallback(
    (clashId, objectId) => {
      const scene = state.scenesByClashId[clashId];
      const obj = scene?.find((o) => o.id === objectId);
      if (!obj) return null;
      return [obj.position.x, obj.position.y, obj.position.z];
    },
    [state.scenesByClashId]
  );
  const loadResolvedForClash = useCallback(
    (clashId) => state.resolvedByClashId[clashId] ?? null,
    [state.resolvedByClashId]
  );
  const markClashResolved = useCallback(
    (clashId) => {
      const scene = state.scenesByClashId[clashId];
      if (!scene) return;
      const resolved = {
        resolved: true,
        resolvedAt: (/* @__PURE__ */ new Date()).toISOString(),
        resolvedPositions: scene.map((obj) => ({
          id: obj.id,
          position: [obj.position.x, obj.position.y, obj.position.z]
        }))
      };
      dispatch({ type: "MARK_CLASH_RESOLVED", payload: { clashId, resolved } });
    },
    [state.scenesByClashId]
  );
  const value = useMemo(
    () => ({
      hydrated: state.hydrated,
      ensureSceneForClash,
      updateObjectPosition,
      saveClashScene,
      saveClashSceneToServer,
      loadClashSceneFromServer,
      saveAllDirtyScenes,
      discardAllDirtyScenes,
      discardClashScene,
      hasAnyUnsavedSceneChanges,
      isClashDirty,
      getScene,
      getSceneObjectPositionVec3,
      markClashResolved,
      loadResolvedForClash
    }),
    [
      discardAllDirtyScenes,
      discardClashScene,
      ensureSceneForClash,
      getScene,
      getSceneObjectPositionVec3,
      hasAnyUnsavedSceneChanges,
      isClashDirty,
      loadClashSceneFromServer,
      loadResolvedForClash,
      markClashResolved,
      saveAllDirtyScenes,
      saveClashScene,
      saveClashSceneToServer,
      state.hydrated,
      updateObjectPosition
    ]
  );
  return /* @__PURE__ */ jsx(ClashViewerContext.Provider, { value, children });
}
function useClashViewerStore() {
  const ctx = useContext(ClashViewerContext);
  if (!ctx) {
    throw new Error("useClashViewerStore must be used within ClashViewerProvider");
  }
  return ctx;
}

function useObjectInteraction(clash, selectedObjectId, options) {
  const overviewScene = options?.overviewScene ?? null;
  const allowObjectDrag = options?.allowObjectDrag !== false;
  const clashStore = useClashViewerStore();
  const [draggingObjectId, setDraggingObjectId] = useState(null);
  const [collisionMessage, setCollisionMessage] = useState(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState(null);
  const lastValidPositionsRef = useRef({});
  const dragStartRef = useRef(null);
  useEffect(() => {
    if (!clash) return;
    clashStore.ensureSceneForClash(clash);
  }, [clash, clashStore]);
  useEffect(() => {
    setDraggingObjectId(null);
    dragStartRef.current = null;
    setCollisionMessage(null);
    setDragPreviewPosition(null);
    lastValidPositionsRef.current = {};
  }, [clash?.id]);
  const objects = useMemo(() => {
    if (clash) {
      const scene = clashStore.getScene(clash.id);
      if (!scene) return [];
      return buildViewerObjects(scene, selectedObjectId);
    }
    if (overviewScene?.length) {
      return buildViewerObjects(overviewScene, selectedObjectId, { skipCollision: true });
    }
    return [];
  }, [clash, clashStore, overviewScene, selectedObjectId]);
  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );
  const hasCollision = useMemo(() => objects.some((object) => object.isColliding), [objects]);
  const selectObject = useCallback((objectId) => {
  }, []);
  const beginDrag = useCallback((objectId, pointerX, pointerY) => {
    if (!allowObjectDrag || !clash) return;
    const scene = clashStore.getScene(clash.id);
    const obj = scene?.find((entry) => entry.id === objectId);
    if (!obj) return;
    dragStartRef.current = { pointerX, pointerY, objectPosition: obj.position };
    setDraggingObjectId(objectId);
    setCollisionMessage(null);
    setDragPreviewPosition({ x: obj.position.x, z: obj.position.z });
    lastValidPositionsRef.current[objectId] = obj.position;
  }, [allowObjectDrag, clash, clashStore, selectObject]);
  const updateDrag = useCallback((pointerX, pointerY) => {
    if (!allowObjectDrag || !clash || !draggingObjectId || !dragStartRef.current) {
      return;
    }
    const deltaX = (pointerX - dragStartRef.current.pointerX) * PIXELS_TO_WORLD;
    const deltaZ = (pointerY - dragStartRef.current.pointerY) * PIXELS_TO_WORLD;
    const nextPosition = {
      x: clampWorld(dragStartRef.current.objectPosition.x + deltaX),
      y: dragStartRef.current.objectPosition.y,
      z: clampWorld(dragStartRef.current.objectPosition.z + deltaZ)
    };
    setDragPreviewPosition({ x: nextPosition.x, z: nextPosition.z });
    const movedObjects = objects.map(
      (object) => object.id === draggingObjectId ? { ...object, position: { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z } } : object
    );
    const collidedObjects = applyCollisionFlags(movedObjects);
    const draggedObject = collidedObjects.find((object) => object.id === draggingObjectId);
    if (draggedObject && !draggedObject.isColliding) {
      lastValidPositionsRef.current[draggingObjectId] = nextPosition;
      setCollisionMessage(null);
    } else if (draggedObject?.isColliding) {
      setCollisionMessage("Cannot resolve clash while objects are still intersecting");
    }
    clashStore.updateObjectPosition(clash.id, draggingObjectId, nextPosition);
  }, [allowObjectDrag, clash, clashStore, draggingObjectId, objects]);
  const endDrag = useCallback(() => {
    if (!allowObjectDrag || !clash || !draggingObjectId) {
      return;
    }
    const scene = clashStore.getScene(clash.id);
    if (scene) {
      const viewerObjects = buildViewerObjects(scene, selectedObjectId);
      const draggedObject = viewerObjects.find((object) => object.id === draggingObjectId);
      if (draggedObject?.isColliding) {
        const lastValid = lastValidPositionsRef.current[draggingObjectId];
        if (lastValid) {
          clashStore.updateObjectPosition(clash.id, draggingObjectId, lastValid);
        }
      }
    }
    dragStartRef.current = null;
    setDraggingObjectId(null);
    setCollisionMessage(null);
    setDragPreviewPosition(null);
  }, [allowObjectDrag, clash, clashStore, draggingObjectId, selectedObjectId]);
  return {
    objects,
    selectedObject,
    draggingObjectId,
    hasCollision,
    collisionMessage,
    dragPreviewPosition,
    lastValidPosition: draggingObjectId ? (() => {
      const v = lastValidPositionsRef.current[draggingObjectId];
      return v ? { x: v.x, z: v.z } : null;
    })() : null,
    selectObject,
    beginDrag,
    updateDrag,
    endDrag
  };
}

const clampScale = (value) => Math.min(2.2, Math.max(0.75, value));
const MIN_RENDER_BOX_SIZE = 42;
const getRenderSize = (size) => ({
  width: Math.max(size.width, MIN_RENDER_BOX_SIZE),
  depth: Math.max(size.depth, MIN_RENDER_BOX_SIZE)
});
const shouldShowLabel = (isPrimary, isSelected, isColliding) => isPrimary || isSelected || isColliding;
const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
const convexHull = (points) => {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.z - b.z : a.x - b.x);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
};
const clashOriginXZ = (clash) => {
  const a = clash.objectABBox;
  const b = clash.objectBBBox;
  if (a && b) {
    const ax = (a.min[0] + a.max[0]) / 2;
    const az = (a.min[2] + a.max[2]) / 2;
    const bx = (b.min[0] + b.max[0]) / 2;
    const bz = (b.min[2] + b.max[2]) / 2;
    return [(ax + bx) / 2, (az + bz) / 2];
  }
  return [clash.position[0] || 0, clash.position[2] || 0];
};
const buildFootprint = (positions, origin) => {
  if (!Array.isArray(positions) || positions.length < 9) return null;
  const [originX, originZ] = origin;
  const rawPoints = [];
  const step = positions.length > 15e3 ? 12 : 3;
  for (let i = 0; i + 2 < positions.length; i += step) {
    const x = Number(positions[i]);
    const z = Number(positions[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    rawPoints.push({
      x: clampWorld((x - originX) * WORLD_SCALE),
      z: clampWorld((z - originZ) * WORLD_SCALE)
    });
  }
  if (rawPoints.length < 3) return null;
  const points = convexHull(rawPoints);
  if (points.length < 3) return null;
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return {
    points,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs)
  };
};
function Viewer2D({
  clash,
  selectedObjectId,
  onSelectObject,
  onFocusClash,
  onCollisionChange,
  hiddenObjectIds = [],
  overviewScene,
  allowObjectMove = true,
  adapter: _adapter,
  objectMeshPositions = {},
  testScopeObjectIds = [],
  deEmphasizeUnrelated = false,
  showScopeBadge = false,
  hideUnrelatedActive = false,
  hasXktOnlyOverview = false
}) {
  const [interaction, setInteraction] = useState({
    offset: { x: 0, y: 0 },
    scale: 1,
    orbitAngle: 0,
    sectionEnabled: false,
    measureEnabled: false,
    selectedObjectId
  });
  const [dragging, setDragging] = useState(false);
  const dragOriginRef = useRef(null);
  const viewportRef = useRef(null);
  const {
    objects,
    draggingObjectId,
    hasCollision,
    collisionMessage,
    dragPreviewPosition,
    lastValidPosition,
    beginDrag,
    updateDrag,
    endDrag
  } = useObjectInteraction(clash, selectedObjectId, {
    overviewScene: !clash ? overviewScene ?? void 0 : void 0,
    allowObjectDrag: allowObjectMove
  });
  const modelOverview = Boolean(!clash && overviewScene !== void 0);
  const clashStore = useClashViewerStore();
  useEffect(() => {
    onCollisionChange?.(hasCollision, collisionMessage);
  }, [collisionMessage, hasCollision, onCollisionChange]);
  const visibleObjects = objects.filter((object) => !hiddenObjectIds.includes(object.id));
  const clashOverlapPlan = useMemo(() => {
    if (!clash) return null;
    const zone = resolveClashZoneForViewer(clash, visibleObjects, clashStore.getScene(clash.id));
    if (!zone) return null;
    return {
      cx: zone.position.x,
      cz: zone.position.z,
      w: Math.max(zone.size.width, 14),
      d: Math.max(zone.size.depth, 14)
    };
  }, [clash, clashStore, visibleObjects]);
  const footprintsByObjectId = useMemo(() => {
    if (!clash) return {};
    const origin = clashOriginXZ(clash);
    const map = {};
    visibleObjects.forEach((object) => {
      const mesh = objectMeshPositions[object.id];
      const footprint = buildFootprint(mesh || [], origin);
      if (footprint) map[object.id] = footprint;
    });
    return map;
  }, [clash, objectMeshPositions, visibleObjects]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || visibleObjects.length === 0) return;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    visibleObjects.forEach((object) => {
      const halfW = object.size.width / 2;
      const halfD = object.size.depth / 2;
      minX = Math.min(minX, object.position.x - halfW);
      maxX = Math.max(maxX, object.position.x + halfW);
      minZ = Math.min(minZ, object.position.z - halfD);
      maxZ = Math.max(maxZ, object.position.z + halfD);
    });
    const sceneW = Math.max(40, maxX - minX);
    const sceneH = Math.max(40, maxZ - minZ);
    const bounds = viewport.getBoundingClientRect();
    const coverage = clash ? 0.82 : 0.72;
    const nextScale = clampScale(Math.min(bounds.width * coverage / sceneW, bounds.height * coverage / sceneH));
    setInteraction((current) => ({
      ...current,
      scale: Number.isFinite(nextScale) ? nextScale : current.scale,
      offset: { x: 0, y: 0 }
    }));
  }, [clash?.id, modelOverview, visibleObjects]);
  const handleWheel = (event) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    setInteraction((current) => ({
      ...current,
      scale: clampScale(current.scale + (event.deltaY < 0 ? 0.1 : -0.1))
    }));
  };
  const handlePointerDown = (event) => {
    if (event.button !== 1 && event.button !== 2) {
      return;
    }
    event.preventDefault();
    dragOriginRef.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event) => {
    if (!dragging || !dragOriginRef.current) {
      return;
    }
    const deltaX = event.clientX - dragOriginRef.current.x;
    const deltaY = event.clientY - dragOriginRef.current.y;
    dragOriginRef.current = { x: event.clientX, y: event.clientY };
    setInteraction((current) => ({
      ...current,
      offset: {
        x: current.offset.x + deltaX,
        y: current.offset.y + deltaY
      }
    }));
  };
  const stopDragging = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOriginRef.current = null;
    setDragging(false);
  };
  if (!clash) {
    if (modelOverview && overviewScene.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "relative flex min-h-0 flex-1 items-center justify-center p-6 text-center", children: hasXktOnlyOverview ? /* @__PURE__ */ jsxs("div", { className: "max-w-sm space-y-2 text-sm text-[#6A7282]", children: [
        /* @__PURE__ */ jsx("p", { children: "2D overview needs bounding boxes from JSON or IFC metadata." }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-[#9CA3AF]", children: [
          "An XKT model is available — open the ",
          /* @__PURE__ */ jsx("span", { className: "font-medium text-[#374151]", children: "3D" }),
          " view to see it."
        ] })
      ] }) : /* @__PURE__ */ jsx("p", { className: "max-w-sm text-sm text-[#6A7282]", children: "No elements to show (hidden by model/category filters or missing bounding boxes)." }) });
    }
    if (modelOverview && overviewScene.length > 0) {
      return /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 md:p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b border-[#E5E7EB] pb-2", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-medium text-[#101828]", children: "2D overview" }),
          /* @__PURE__ */ jsxs("p", { className: "max-w-[min(100%,28rem)] truncate text-[10px] text-[#6A7282]", title: "Wheel zoom · MMB/RMB pan · click to select.", children: [
            "Zoom · pan · click · ",
            visibleObjects.length,
            " elements"
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: viewportRef,
            onContextMenu: (event) => event.preventDefault(),
            onWheel: handleWheel,
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: stopDragging,
            onPointerCancel: stopDragging,
            className: "relative min-h-[200px] flex-1 overflow-hidden rounded-lg border border-[#D1D5DC] bg-white",
            children: /* @__PURE__ */ jsxs(
              "div",
              {
                className: "absolute inset-0 transition-transform duration-75",
                style: {
                  transform: `translate(${interaction.offset.x}px, ${interaction.offset.y}px) scale(${interaction.scale})`
                },
                children: [
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_56%)]" }),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:28px_28px] opacity-55" }),
                  visibleObjects.map((object) => {
                    const renderSize = getRenderSize(object.size);
                    const left = `calc(50% + ${object.position.x}px - ${renderSize.width / 2}px)`;
                    const top = `calc(50% + ${object.position.z}px - ${renderSize.depth / 2}px)`;
                    return /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => onSelectObject(object.id),
                        className: cn(
                          "absolute rounded-sm border border-slate-300/90 bg-white/95 text-left shadow-md transition-all duration-150",
                          object.isSelected ? "ring-2 ring-sky-400/80" : "",
                          "cursor-default"
                        ),
                        style: {
                          left,
                          top,
                          width: `${renderSize.width}px`,
                          height: `${renderSize.depth}px`
                        },
                        children: /* @__PURE__ */ jsx("span", { className: "absolute left-2 top-2 max-w-[calc(100%-12px)] truncate rounded bg-slate-900/85 px-2 py-1 text-[10px] font-medium text-slate-100", children: object.label })
                      },
                      object.id
                    );
                  })
                ]
              }
            )
          }
        )
      ] });
    }
    return /* @__PURE__ */ jsx("div", { className: "relative flex min-h-0 flex-1 items-center justify-center p-6 text-center", children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto mb-2 flex h-24 w-32 items-center justify-center rounded-lg border-2 border-dashed border-[#D1D5DC]", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" }) }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-[#6A7282]", children: "Select a clash to focus the 2D view" })
    ] }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 md:p-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "truncate text-[12px] font-medium text-[#101828]", children: clash.title }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[10px] text-[#6A7282]", children: allowObjectMove ? "Wheel zoom · MMB/RMB pan · drag objects" : "Wheel zoom · MMB/RMB pan · click objects" })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "shrink-0 rounded-md border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-800", children: clash.resolved ? "Resolved" : "Open" })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref: viewportRef,
        onContextMenu: (event) => event.preventDefault(),
        onWheel: handleWheel,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: stopDragging,
        onPointerCancel: stopDragging,
        onDoubleClick: () => onFocusClash?.(clash),
        className: "relative min-h-[220px] flex-1 overflow-hidden rounded-lg border border-[#D1D5DC] bg-white",
        children: [
          showScopeBadge && /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute right-2 top-2 z-10 flex flex-col items-end gap-1", children: [
            /* @__PURE__ */ jsx("span", { className: "rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-800", children: "Highlighted: Set A/B" }),
            /* @__PURE__ */ jsxs("span", { className: cn(
              "rounded border px-2 py-0.5 text-[10px] font-medium",
              hideUnrelatedActive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"
            ), children: [
              "Hidden unrelated: ",
              hideUnrelatedActive ? "ON" : "OFF"
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: "absolute inset-0 transition-transform duration-75",
              style: {
                transform: `translate(${interaction.offset.x}px, ${interaction.offset.y}px) scale(${interaction.scale})`
              },
              children: [
                /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_56%)]" }),
                /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:28px_28px] opacity-55" }),
                allowObjectMove && draggingObjectId && dragPreviewPosition && (() => {
                  const previewObj = objects.find((obj) => obj.id === draggingObjectId);
                  if (!previewObj) return null;
                  const renderSize = getRenderSize(previewObj.size);
                  const left = `calc(50% + ${dragPreviewPosition.x}px - ${renderSize.width / 2}px)`;
                  const top = `calc(50% + ${dragPreviewPosition.z}px - ${renderSize.depth / 2}px)`;
                  return /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: cn(
                        "pointer-events-none absolute rounded-xl border-2 border-dashed transition-all duration-75",
                        collisionMessage ? "border-red-300/90 bg-red-400/12" : "border-cyan-300/90 bg-cyan-300/10"
                      ),
                      style: {
                        left,
                        top,
                        width: `${renderSize.width}px`,
                        height: `${renderSize.depth}px`
                      }
                    }
                  );
                })(),
                visibleObjects.map((object) => {
                  const renderSize = getRenderSize(object.size);
                  const left = `calc(50% + ${object.position.x}px - ${renderSize.width / 2}px)`;
                  const top = `calc(50% + ${object.position.z}px - ${renderSize.depth / 2}px)`;
                  const isPrimary = object.id === clash.objectA;
                  const isInTestScope = testScopeObjectIds.includes(object.id);
                  const isDeEmphasized = deEmphasizeUnrelated && testScopeObjectIds.length > 0 && !isInTestScope;
                  const footprint = footprintsByObjectId[object.id];
                  if (footprint) {
                    const rawW = Math.max(1, footprint.maxX - footprint.minX);
                    const rawH = Math.max(1, footprint.maxZ - footprint.minZ);
                    const width = Math.max(rawW, MIN_RENDER_BOX_SIZE);
                    const height = Math.max(rawH, MIN_RENDER_BOX_SIZE);
                    const sx = width / rawW;
                    const sy = height / rawH;
                    const centerX = (footprint.minX + footprint.maxX) / 2;
                    const centerZ = (footprint.minZ + footprint.maxZ) / 2;
                    const polyPoints = footprint.points.map((p) => `${((p.x - footprint.minX) * sx).toFixed(2)},${((p.z - footprint.minZ) * sy).toFixed(2)}`).join(" ");
                    return /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        onClick: () => onSelectObject(object.id),
                        ...allowObjectMove ? {
                          onPointerDown: (event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            event.stopPropagation();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            onSelectObject(object.id);
                            beginDrag(object.id, event.clientX, event.clientY);
                          },
                          onPointerMove: (event) => {
                            updateDrag(event.clientX, event.clientY);
                          },
                          onPointerUp: (event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId);
                            }
                            endDrag();
                          },
                          onPointerCancel: (event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId);
                            }
                            endDrag();
                          }
                        } : {},
                        className: cn(
                          "group absolute text-left transition-all duration-150",
                          object.isSelected ? "ring-2 ring-sky-200/70" : "",
                          isDeEmphasized && "opacity-45",
                          allowObjectMove ? draggingObjectId === object.id ? "cursor-grabbing" : "cursor-grab" : "cursor-default"
                        ),
                        style: {
                          left: `calc(50% + ${centerX}px - ${width / 2}px)`,
                          top: `calc(50% + ${centerZ}px - ${height / 2}px)`,
                          width: `${width}px`,
                          height: `${height}px`
                        },
                        children: [
                          /* @__PURE__ */ jsx("svg", { className: "h-full w-full drop-shadow-[0_2px_5px_rgba(0,0,0,0.2)]", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", children: /* @__PURE__ */ jsx(
                            "polygon",
                            {
                              points: polyPoints,
                              fill: isDeEmphasized ? "rgba(148,163,184,0.20)" : object.isColliding ? "rgba(239,68,68,0.25)" : isPrimary ? "rgba(244,63,94,0.18)" : "rgba(16,185,129,0.20)",
                              stroke: isDeEmphasized ? "rgba(148,163,184,0.92)" : object.isColliding ? "rgba(248,113,113,0.95)" : isPrimary ? "rgba(251,113,133,0.92)" : "rgba(52,211,153,0.92)",
                              strokeWidth: 1.6
                            }
                          ) }),
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: cn(
                                "absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-medium transition-opacity",
                                shouldShowLabel(isPrimary, object.isSelected, object.isColliding) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                object.isColliding ? "bg-slate-950/90 text-red-200" : isPrimary ? "bg-slate-950/80 text-rose-200" : "bg-slate-950/80 text-emerald-200"
                              ),
                              children: object.label
                            }
                          )
                        ]
                      },
                      object.id
                    );
                  }
                  return /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => onSelectObject(object.id),
                      ...allowObjectMove ? {
                        onPointerDown: (event) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          onSelectObject(object.id);
                          beginDrag(object.id, event.clientX, event.clientY);
                        },
                        onPointerMove: (event) => {
                          updateDrag(event.clientX, event.clientY);
                        },
                        onPointerUp: (event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                          endDrag();
                        },
                        onPointerCancel: (event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                          endDrag();
                        }
                      } : {},
                      className: cn(
                        "group absolute rounded-sm border text-left shadow-lg transition-all duration-150",
                        object.isSelected ? "ring-2 ring-sky-200/70" : "",
                        isDeEmphasized ? "border-slate-300 bg-slate-400/16 shadow-slate-900/10 opacity-70" : object.isColliding ? "border-red-400 bg-red-500/20 shadow-red-900/50" : isPrimary ? "border-rose-400/60 bg-rose-500/10 shadow-rose-900/30" : "border-emerald-400/50 bg-emerald-500/10 shadow-emerald-900/30",
                        allowObjectMove ? draggingObjectId === object.id ? "cursor-grabbing" : "cursor-grab" : "cursor-default"
                      ),
                      style: {
                        left,
                        top,
                        width: `${renderSize.width}px`,
                        height: `${renderSize.depth}px`
                      },
                      children: /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: cn(
                            "absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-medium transition-opacity",
                            shouldShowLabel(isPrimary, object.isSelected, object.isColliding) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                            object.isColliding ? "bg-slate-950/90 text-red-200" : isPrimary ? "bg-slate-950/80 text-rose-200" : "bg-slate-950/80 text-emerald-200"
                          ),
                          children: object.label
                        }
                      )
                    },
                    object.id
                  );
                }),
                clashOverlapPlan && /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "pointer-events-none absolute z-[8] rounded-sm border-2 border-red-500/95 bg-red-500/35 shadow-[0_0_22px_rgba(239,68,68,0.45)]",
                    style: {
                      left: `calc(50% + ${clashOverlapPlan.cx}px - ${clashOverlapPlan.w / 2}px)`,
                      top: `calc(50% + ${clashOverlapPlan.cz}px - ${clashOverlapPlan.d / 2}px)`,
                      width: `${clashOverlapPlan.w}px`,
                      height: `${clashOverlapPlan.d}px`
                    }
                  }
                ),
                allowObjectMove && draggingObjectId && lastValidPosition && /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "pointer-events-none absolute rounded-full border border-emerald-300/80 bg-emerald-400/15 px-2 py-1 text-[10px] font-medium text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.35)]",
                    style: {
                      left: `calc(50% + ${lastValidPosition.x}px - 44px)`,
                      top: `calc(50% + ${lastValidPosition.z}px - 14px)`
                    },
                    children: "Snap back"
                  }
                ),
                /* @__PURE__ */ jsx("div", { className: "absolute left-[47%] top-[52%] rounded border border-blue-200 bg-white/95 px-2 py-1 text-[10px] font-medium text-[#155DFC] shadow", children: clash.distance ?? "0.00 m" }),
                /* @__PURE__ */ jsx("div", { className: "absolute left-[48%] top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#155DFC] px-2 py-1 text-[10px] font-medium text-white shadow", children: "Clash" })
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "shrink-0 border-t border-[#E5E7EB] pt-2", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-x-4 gap-y-1 text-[10px] leading-tight text-[#6A7282]", children: [
      /* @__PURE__ */ jsxs("span", { className: "max-w-[min(100%,14rem)] truncate font-mono text-[#364153]", title: clash.objectA, children: [
        "A ",
        clash.objectA
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "max-w-[min(100%,14rem)] truncate font-mono text-[#364153]", title: clash.objectB, children: [
        "B ",
        clash.objectB
      ] }),
      /* @__PURE__ */ jsx("span", { className: "max-w-[min(100%,12rem)] truncate", title: clash.location, children: clash.location }),
      /* @__PURE__ */ jsxs("span", { children: [
        "×",
        interaction.scale.toFixed(2),
        " · ",
        interaction.offset.x.toFixed(0),
        ",",
        interaction.offset.y.toFixed(0),
        "px"
      ] })
    ] }) })
  ] });
}

const CLASH_ZONE_ENTITY_ID = "__orbit-clash-zone__";
const BOX_GEOMETRY_ID = "orbit-unit-box";
const BOX_POSITIONS = [
  1,
  1,
  1,
  -1,
  1,
  1,
  -1,
  -1,
  1,
  1,
  -1,
  1,
  1,
  1,
  1,
  1,
  -1,
  1,
  1,
  -1,
  -1,
  1,
  1,
  -1,
  1,
  1,
  1,
  1,
  1,
  -1,
  -1,
  1,
  -1,
  -1,
  1,
  1,
  -1,
  1,
  1,
  -1,
  1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1,
  -1,
  -1,
  -1,
  1,
  -1,
  -1,
  1,
  -1,
  1,
  -1,
  -1,
  1,
  1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1,
  -1,
  1,
  1,
  -1
];
const BOX_NORMALS = [
  0,
  0,
  1,
  0,
  0,
  1,
  0,
  0,
  1,
  0,
  0,
  1,
  1,
  0,
  0,
  1,
  0,
  0,
  1,
  0,
  0,
  1,
  0,
  0,
  0,
  1,
  0,
  0,
  1,
  0,
  0,
  1,
  0,
  0,
  1,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  -1
];
const BOX_INDICES = [
  0,
  1,
  2,
  0,
  2,
  3,
  4,
  5,
  6,
  4,
  6,
  7,
  8,
  9,
  10,
  8,
  10,
  11,
  12,
  13,
  14,
  12,
  14,
  15,
  16,
  17,
  18,
  16,
  18,
  19,
  20,
  21,
  22,
  20,
  22,
  23
];
const centerFromAABB = (aabb) => {
  if (!Array.isArray(aabb) || aabb.length < 6) return null;
  return [
    (Number(aabb[0]) + Number(aabb[3])) / 2,
    (Number(aabb[1]) + Number(aabb[4])) / 2,
    (Number(aabb[2]) + Number(aabb[5])) / 2
  ];
};
const bboxFromAABB = (aabb) => {
  if (!Array.isArray(aabb) || aabb.length < 6) return null;
  return {
    min: [Number(aabb[0]), Number(aabb[1]), Number(aabb[2])],
    max: [Number(aabb[3]), Number(aabb[4]), Number(aabb[5])]
  };
};
const colorForObject = (object) => {
  if (object.isClashObject) return [0.96, 0.2, 0.18];
  if (object.isDeEmphasized) return [0.5, 0.58, 0.68];
  if (object.isColliding) return [0.92, 0.22, 0.2];
  if (object.isPrimary) return [0.32, 0.73, 0.98];
  if (object.isInTestScope) return [0.24, 0.8, 0.62];
  return object.isSelected ? [0.3, 0.9, 0.72] : [0.24, 0.8, 0.62];
};
class XeoKitViewerAdapter {
  constructor(viewer, sceneModelCtor) {
    this.viewer = viewer;
    if (!viewer) {
      throw new Error("XeoKitViewerAdapter requires a valid XeoKit Viewer instance");
    }
    this.sceneModelCtor = sceneModelCtor;
  }
  viewer;
  sceneModel = null;
  basePositions = /* @__PURE__ */ new Map();
  loadedObjectIds = [];
  sceneModelCtor;
  xktLoader = null;
  meshIdToObjectId = /* @__PURE__ */ new Map();
  loadedXktModelIds = [];
  xktSyncGeneration = 0;
  loadSceneObjects(objects, clashZone) {
    const scene = this.viewer.scene;
    if (!scene || !this.sceneModelCtor) return;
    this.disposeSceneModel();
    this.basePositions.clear();
    this.meshIdToObjectId.clear();
    this.loadedObjectIds = [];
    if (objects.length === 0) {
      return;
    }
    const model = new this.sceneModelCtor(scene, {
      id: `orbit-clash-${Date.now()}`,
      isModel: true,
      pickable: true
    });
    model.createGeometry({
      id: BOX_GEOMETRY_ID,
      primitive: "triangles",
      positions: BOX_POSITIONS,
      normals: BOX_NORMALS,
      indices: BOX_INDICES
    });
    objects.forEach((object, index) => {
      const meshId = `orbit-mesh-${index}`;
      const color = colorForObject(object);
      const opacity = object.isDeEmphasized ? 0.62 : object.isClashObject ? 0.92 : object.isColliding ? 0.78 : 0.86;
      if (object.meshPositions && object.meshPositions.length >= 9) {
        const pos = object.meshPositions;
        const vertCount = Math.floor(pos.length / 3);
        const indices = new Array(vertCount);
        for (let i = 0; i < vertCount; i++) indices[i] = i;
        const geoId = `orbit-geo-real-${index}`;
        model.createGeometry({
          id: geoId,
          primitive: "triangles",
          positions: Array.from(pos),
          autoNormals: true,
          indices
        });
        model.createMesh({
          id: meshId,
          geometryId: geoId,
          position: [0, 0, 0],
          scale: [1, 1, 1],
          color,
          opacity
        });
      } else {
        const sx = Math.max(1, object.size.width / 2);
        const sy = Math.max(1, object.size.height / 2);
        const sz = Math.max(1, object.size.depth / 2);
        model.createMesh({
          id: meshId,
          geometryId: BOX_GEOMETRY_ID,
          position: [object.position.x, object.position.y, object.position.z],
          scale: [sx, sy, sz],
          color,
          opacity
        });
      }
      model.createEntity({
        id: object.id,
        meshIds: [meshId],
        isObject: true,
        pickable: true,
        highlighted: Boolean(object.isSelected)
      });
      this.meshIdToObjectId.set(meshId, object.id);
      this.basePositions.set(object.id, [object.position.x, object.position.y, object.position.z]);
      this.loadedObjectIds.push(object.id);
    });
    if (clashZone) {
      const meshId = "orbit-mesh-clash-zone";
      const sx = Math.max(1, clashZone.size.width / 2);
      const sy = Math.max(1, clashZone.size.height / 2);
      const sz = Math.max(1, clashZone.size.depth / 2);
      model.createMesh({
        id: meshId,
        geometryId: BOX_GEOMETRY_ID,
        position: [clashZone.position.x, clashZone.position.y, clashZone.position.z],
        scale: [sx, sy, sz],
        color: [0.98, 0.12, 0.1],
        opacity: 1
      });
      model.createEntity({
        id: CLASH_ZONE_ENTITY_ID,
        meshIds: [meshId],
        isObject: false,
        pickable: false,
        highlighted: false
      });
      const topY = clashZone.position.y + sy + 8;
      const beaconHalf = Math.max(4, Math.min(10, Math.max(sx, sz) * 0.45));
      const beaconMeshId = "orbit-mesh-clash-zone-beacon";
      model.createMesh({
        id: beaconMeshId,
        geometryId: BOX_GEOMETRY_ID,
        position: [clashZone.position.x, topY, clashZone.position.z],
        scale: [beaconHalf, beaconHalf, beaconHalf],
        color: [1, 0.06, 0.06],
        opacity: 1
      });
      model.createEntity({
        id: `${CLASH_ZONE_ENTITY_ID}-beacon`,
        meshIds: [beaconMeshId],
        isObject: false,
        pickable: false,
        highlighted: false
      });
    }
    model.finalize();
    this.sceneModel = model;
    this.flyToModel();
  }
  /**
   * Load or refresh XKT models (authenticated fetch). Box overlay from loadSceneObjects is unchanged.
   */
  async syncXktModels(projectSlug, modelIds) {
    const gen = ++this.xktSyncGeneration;
    this.destroyXktModels();
    if (modelIds.length === 0) return;
    const xeokit = await import('@xeokit/xeokit-sdk');
    const XKTLoaderPlugin = xeokit.XKTLoaderPlugin;
    if (!XKTLoaderPlugin || !this.viewer) return;
    if (!this.xktLoader) {
      this.xktLoader = new XKTLoaderPlugin(this.viewer);
    }
    let flew = false;
    for (const id of modelIds) {
      if (gen !== this.xktSyncGeneration) return;
      const url = apiUrl(
        `/projects/${encodeURIComponent(projectSlug)}/navisworks/models/${encodeURIComponent(id)}/xkt`
      );
      const res = await apiFetch(url);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (gen !== this.xktSyncGeneration) return;
      const sceneModel = this.xktLoader.load({
        id,
        xkt: buf,
        dtxEnabled: true,
        edges: false
      });
      this.loadedXktModelIds.push(id);
      sceneModel.once?.("loaded", () => {
        if (gen !== this.xktSyncGeneration) return;
        if (flew) return;
        const aabb = sceneModel.aabb;
        if (Array.isArray(aabb) && aabb.length >= 6) {
          flew = true;
          this.viewer.cameraFlight?.flyTo?.({ aabb });
        }
      });
    }
  }
  highlightObjects(ids) {
    const sceneObjects = this.viewer.scene?.objects;
    if (!sceneObjects) return;
    const active = new Set(ids);
    Object.keys(sceneObjects).forEach((objectId) => {
      if (objectId === CLASH_ZONE_ENTITY_ID) return;
      const object = sceneObjects[objectId];
      if (!object) return;
      object.highlighted = active.has(objectId);
      object.selected = false;
    });
  }
  focusObject(id) {
    const object = this.viewer.scene?.objects?.[id];
    const aabb = object?.aabb;
    if (!Array.isArray(aabb) || aabb.length < 6) return;
    this.viewer.cameraFlight?.flyTo?.({ aabb });
  }
  getObjectWorldPosition(id) {
    const object = this.viewer.scene?.objects?.[id];
    if (!object) return null;
    if (Array.isArray(object.position) && object.position.length >= 3) {
      return [Number(object.position[0]), Number(object.position[1]), Number(object.position[2])];
    }
    return centerFromAABB(object.aabb);
  }
  setObjectWorldPosition(id, position) {
    const object = this.viewer.scene?.objects?.[id];
    if (!object) return;
    object.position = [position[0], position[1], position[2]];
  }
  getObjectBoundingBox(id) {
    const object = this.viewer.scene?.objects?.[id];
    if (!object) return null;
    return bboxFromAABB(object.aabb);
  }
  onObjectPicked(callback) {
    const input = this.viewer.scene?.input;
    const pick = this.viewer.scene?.pick;
    if (!input?.on || !input?.off || !pick) return () => {
    };
    const handle = input.on("mouseclicked", (coords) => {
      const hit = pick({ canvasPos: coords });
      const objectId = hit?.entity?.id;
      if (!objectId || objectId.startsWith(CLASH_ZONE_ENTITY_ID)) return;
      callback(objectId);
    });
    return () => input.off?.(handle);
  }
  resetAllPositions() {
    this.basePositions.forEach((position, id) => {
      this.setObjectWorldPosition(id, position);
    });
  }
  getLoadedObjectIds() {
    return [...this.loadedObjectIds];
  }
  dispose() {
    this.xktSyncGeneration += 1;
    this.destroyXktModels();
    this.xktLoader?.destroy?.();
    this.xktLoader = null;
    this.disposeSceneModel();
    this.viewer.destroy?.();
  }
  flyToModel() {
    requestAnimationFrame(() => {
      const aabb = this.sceneModel?.aabb;
      if (!Array.isArray(aabb) || aabb.length < 6) return;
      this.viewer.cameraFlight?.flyTo?.({ aabb });
    });
  }
  disposeSceneModel() {
    if (!this.sceneModel) return;
    try {
      this.sceneModel.destroy();
    } catch {
    }
    this.sceneModel = null;
  }
  destroyXktModels() {
    const scene = this.viewer.scene;
    if (!scene?.models) {
      this.loadedXktModelIds = [];
      return;
    }
    for (const id of this.loadedXktModelIds) {
      try {
        scene.models[id]?.destroy?.();
      } catch {
      }
    }
    this.loadedXktModelIds = [];
  }
}

function Viewer3D({
  clash,
  selectedObjectId,
  onSelectObject,
  onFocusClash,
  onCollisionChange,
  hiddenObjectIds = [],
  overviewScene,
  allowObjectMove = true,
  adapter,
  testScopeObjectIds = [],
  deEmphasizeUnrelated = false,
  showScopeBadge = false,
  hideUnrelatedActive = false,
  projectSlug = null,
  xktModels,
  objectMeshPositions = {}
}) {
  const xeokitCanvasRef = useRef(null);
  const xeokitBootstrappedRef = useRef(false);
  const [xeokitAdapter, setXeokitAdapter] = useState(null);
  const clashStore = useClashViewerStore();
  const { objects, hasCollision, collisionMessage, selectObject } = useObjectInteraction(
    clash,
    selectedObjectId,
    {
      overviewScene: !clash ? overviewScene ?? void 0 : void 0,
      allowObjectDrag: allowObjectMove
    }
  );
  const modelOverview = Boolean(!clash && overviewScene !== void 0);
  const effectiveAdapter = adapter ?? xeokitAdapter;
  const xeokitInteractive = Boolean(xeokitAdapter);
  const visibleObjects = objects.filter((object) => !hiddenObjectIds.includes(object.id));
  const viewerSpaceMeshPositions = useMemo(() => {
    if (!Object.keys(objectMeshPositions).length) return {};
    let originWorld = null;
    if (clash) {
      const scene = clashStore.getScene(clash.id);
      const sa = scene?.find((o) => o.id === clash.objectA);
      const sb = scene?.find((o) => o.id === clash.objectB);
      if (sa?.worldPosition && sb?.worldPosition) {
        originWorld = [
          (sa.worldPosition[0] + sb.worldPosition[0]) / 2,
          (sa.worldPosition[1] + sb.worldPosition[1]) / 2,
          (sa.worldPosition[2] + sb.worldPosition[2]) / 2
        ];
      }
    } else if (overviewScene?.length) {
      originWorld = computeWorldOriginFromScene(overviewScene);
    }
    if (!originWorld) return {};
    const result = {};
    for (const [id, positions] of Object.entries(objectMeshPositions)) {
      if (positions.length >= 9) {
        result[id] = transformMeshPositionsToViewerSpace(positions, originWorld);
      }
    }
    return result;
  }, [clash, clashStore, objectMeshPositions, overviewScene]);
  const xktModelIdsKey = useMemo(
    () => (xktModels ?? []).map((m) => m.id).sort().join(","),
    [xktModels]
  );
  const hasXktOverview = Boolean(xktModels && xktModels.length > 0);
  const overviewHasCanvas = modelOverview && ((overviewScene?.length ?? 0) > 0 || hasXktOverview);
  useEffect(() => {
    onCollisionChange?.(hasCollision, collisionMessage);
  }, [collisionMessage, hasCollision, onCollisionChange]);
  useEffect(() => {
    if (xeokitBootstrappedRef.current || xeokitAdapter) return;
    const canvas = xeokitCanvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const initXeokit = async () => {
      try {
        const xeokit = await import('@xeokit/xeokit-sdk');
        if (cancelled) return;
        const ViewerCtor = xeokit.Viewer;
        const SceneModelCtor = xeokit.SceneModel;
        if (!ViewerCtor || !SceneModelCtor) return;
        const viewer = new ViewerCtor({
          canvasElement: canvas,
          transparent: true,
          antialias: true,
          dtxEnabled: true
        });
        canvas.addEventListener("contextmenu", (event) => event.preventDefault());
        viewer.camera.eye = [220, 180, 220];
        viewer.camera.look = [0, 0, 0];
        viewer.camera.up = [0, 1, 0];
        if (viewer.cameraControl) {
          viewer.cameraControl.navMode = "orbit";
          viewer.cameraControl.panRightClick = true;
          viewer.cameraControl.zoomOnMouseWheel = true;
          viewer.cameraControl.followPointer = true;
          viewer.cameraControl.rotationInertia = 0;
          viewer.cameraControl.panInertia = 0;
          viewer.cameraControl.dollyInertia = 0;
          viewer.cameraControl.dragRotationRate = 380;
          viewer.cameraControl.mouseWheelDollyRate = 110;
          viewer.cameraControl.doublePickFlyTo = true;
        }
        xeokitBootstrappedRef.current = true;
        setXeokitAdapter(new XeoKitViewerAdapter(viewer, SceneModelCtor));
      } catch {
      }
    };
    void initXeokit();
    return () => {
      cancelled = true;
    };
  }, [clash?.id, modelOverview, xeokitAdapter]);
  useEffect(
    () => () => {
      xeokitAdapter?.dispose();
      xeokitBootstrappedRef.current = false;
    },
    [xeokitAdapter]
  );
  useEffect(() => {
    if (!xeokitAdapter) return;
    const clashZone = clash ? resolveClashZoneForViewer(clash, visibleObjects, clashStore.getScene(clash.id)) : null;
    xeokitAdapter.loadSceneObjects(
      visibleObjects.map((object) => ({
        id: object.id,
        position: object.position,
        size: object.size,
        isPrimary: Boolean(clash && object.id === clash.objectA),
        isClashObject: Boolean(clash && (object.id === clash.objectA || object.id === clash.objectB)),
        isColliding: object.isColliding,
        isSelected: object.isSelected,
        isInTestScope: testScopeObjectIds.includes(object.id),
        isDeEmphasized: deEmphasizeUnrelated && testScopeObjectIds.length > 0 && !testScopeObjectIds.includes(object.id),
        meshPositions: viewerSpaceMeshPositions[object.id] ?? null
      })),
      clashZone
    );
  }, [clash, clashStore, deEmphasizeUnrelated, viewerSpaceMeshPositions, testScopeObjectIds, visibleObjects, xeokitAdapter, overviewScene]);
  useEffect(() => {
    if (!xeokitAdapter || !projectSlug) return;
    if (clash || !modelOverview) {
      void xeokitAdapter.syncXktModels(projectSlug, []);
      return;
    }
    const ids = (xktModels ?? []).map((m) => m.id);
    void xeokitAdapter.syncXktModels(projectSlug, ids);
  }, [clash, modelOverview, projectSlug, xeokitAdapter, xktModelIdsKey]);
  useEffect(() => {
    if (!effectiveAdapter) return;
    const unsubscribe = effectiveAdapter.onObjectPicked((objectId) => {
      selectObject(objectId);
      onSelectObject(objectId);
    });
    return () => unsubscribe();
  }, [effectiveAdapter, onSelectObject, selectObject]);
  useEffect(() => {
    if (!effectiveAdapter) return;
    effectiveAdapter.highlightObjects(selectedObjectId ? [selectedObjectId] : []);
  }, [effectiveAdapter, selectedObjectId]);
  if (!clash) {
    if (modelOverview && !overviewHasCanvas) {
      return /* @__PURE__ */ jsx("div", { className: "relative flex min-h-0 flex-1 items-center justify-center p-8 text-center text-slate-500", children: /* @__PURE__ */ jsxs("div", { className: "max-w-sm", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto mb-4 flex h-20 w-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50", children: /* @__PURE__ */ jsx("svg", { className: "h-10 w-10 text-slate-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" }) }) }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-400", children: "No elements to display" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-slate-600", children: "Elements may be hidden by model or category filters." })
      ] }) });
    }
    if (overviewHasCanvas) {
      const xktCount = xktModels?.length ?? 0;
      const boxCount = visibleObjects.length;
      const meshCount = visibleObjects.filter((o) => viewerSpaceMeshPositions[o.id]).length;
      const layerHint = xktCount && boxCount ? `${xktCount} XKT · ${boxCount} elements` : xktCount ? `${xktCount} XKT model${xktCount > 1 ? "s" : ""}` : meshCount ? `${meshCount}/${boxCount} real mesh · ${boxCount - meshCount} bbox` : `${boxCount} elements`;
      return /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 text-white md:p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 flex-wrap items-baseline justify-between gap-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold tracking-tight text-slate-200", children: "3D Overview" }),
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-slate-500", title: "Left-click drag to orbit · Right-click to pan · Scroll to zoom · Click to select.", children: [
            "xeokit · ",
            layerHint
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative min-h-[200px] flex-1 overflow-hidden rounded-xl border border-[#2a3245] bg-[#0d1117]", children: [
          /* @__PURE__ */ jsx("canvas", { ref: xeokitCanvasRef, className: cn("absolute inset-0 h-full w-full", xeokitInteractive ? "pointer-events-auto" : "pointer-events-none") }),
          !xeokitInteractive && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-[#0a0e16] text-xs text-slate-400 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("div", { className: "h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" }),
            "Initializing 3D viewer..."
          ] }) })
        ] })
      ] });
    }
    return /* @__PURE__ */ jsx("div", { className: "relative flex min-h-0 flex-1 items-center justify-center p-8 text-center text-slate-500", children: /* @__PURE__ */ jsxs("div", { className: "max-w-sm", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto mb-4 flex h-20 w-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50", children: /* @__PURE__ */ jsx("svg", { className: "h-10 w-10 text-slate-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" }) }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-400", children: "Select a clash to preview 3D highlighting" })
    ] }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 text-white md:p-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-semibold tracking-tight text-slate-100", children: clash.title }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-slate-400", children: "Drag to orbit · Right-click to pan · Scroll to zoom" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsx(
        "div",
        {
          className: cn(
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium",
            hasCollision ? "border-red-400/70 bg-red-500/15 text-red-300" : clash.resolved ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-300" : "border-slate-500/70 bg-slate-600/20 text-slate-300"
          ),
          children: hasCollision ? "⚡ Collision" : clash.resolved ? "✓ Resolved" : "● Active"
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        onDoubleClick: () => onFocusClash?.(clash),
        className: "relative min-h-[220px] flex-1 overflow-hidden rounded-xl border border-[#2a3245] bg-[#0d1117]",
        children: [
          /* @__PURE__ */ jsx("canvas", { ref: xeokitCanvasRef, className: cn("absolute inset-0 h-full w-full", xeokitInteractive ? "pointer-events-auto" : "pointer-events-none") }),
          showScopeBadge && /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5", children: [
            /* @__PURE__ */ jsx("span", { className: "rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-medium text-cyan-200 backdrop-blur-sm", children: "◎ Highlighted Set A/B" }),
            /* @__PURE__ */ jsx("span", { className: cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm",
              hideUnrelatedActive ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-slate-500/40 bg-slate-600/25 text-slate-300"
            ), children: hideUnrelatedActive ? "◐ Hiding unrelated" : "○ Show all" })
          ] }),
          !xeokitInteractive && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-[#0a0e16] text-xs text-slate-400 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("div", { className: "h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" }),
            "Initializing 3D viewer..."
          ] }) })
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "shrink-0 rounded-lg border border-[#2a3245] bg-[#131a2b] px-3 py-2", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500", children: [
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 font-mono text-slate-400", children: [
        /* @__PURE__ */ jsx("span", { className: "inline-block h-1.5 w-1.5 rounded-full bg-blue-400/80" }),
        /* @__PURE__ */ jsx("span", { className: "text-slate-300", title: clash.objectA, children: clash.objectA })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 font-mono text-slate-400", children: [
        /* @__PURE__ */ jsx("span", { className: "inline-block h-1.5 w-1.5 rounded-full bg-rose-400/80" }),
        /* @__PURE__ */ jsx("span", { className: "text-slate-300", title: clash.objectB, children: clash.objectB })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-slate-400", children: [
        /* @__PURE__ */ jsxs("svg", { className: "h-3 w-3 text-slate-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
          /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" }),
          /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z" })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "text-slate-300", title: clash.location, children: clash.location })
      ] }),
      /* @__PURE__ */ jsx("span", { className: cn("ml-auto text-[10px]", xeokitInteractive ? "text-emerald-400/70" : "text-slate-500"), children: xeokitInteractive ? "✓ 3D navigation ready" : "⟳ loading..." })
    ] }) })
  ] });
}

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}) {
  return /* @__PURE__ */ jsx(TooltipPrimitive.Portal, { children: /* @__PURE__ */ jsx(
    TooltipPrimitive.Content,
    {
      sideOffset,
      className: cn(
        "z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95",
        className
      ),
      ...props
    }
  ) });
}

const fetchJson = async (url, init) => {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
};
const workspaceKeys = {
  root: (projectSlug) => ["navisworks", projectSlug],
  workspace: (projectSlug) => ["navisworks", projectSlug, "workspace"],
  results: (projectSlug, testId) => ["navisworks", projectSlug, "results", testId],
  /** IFC list for Clash "Import from Documents" modal — invalidate after document uploads */
  ifcDocuments: (projectSlug) => ["navisworks-ifc-documents", projectSlug]
};
function useNavisworksClashResults(projectSlug, testId) {
  return useQuery({
    queryKey: workspaceKeys.results(projectSlug, testId),
    queryFn: () => fetchJson(
      apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(testId || "")}/results`)
    ),
    enabled: Boolean(testId),
    staleTime: 0,
    refetchOnMount: "always"
  });
}
const resultToViewerClash = (result) => ({
  id: result.clashId,
  status: result.status === "reviewed" ? "in-progress" : result.status,
  type: result.type === "SOFT" ? "Soft Clash" : "Hard Clash",
  severity: result.type === "HARD" ? "high" : result.type === "DUPLICATE" ? "medium" : "low",
  clashType: result.type === "SOFT" ? "soft" : "hard",
  resolved: result.status === "resolved",
  objectA: result.objectA,
  objectB: result.objectB,
  position: result.position,
  title: result.title,
  location: `X: ${result.position[0].toFixed(2)}, Y: ${result.position[1].toFixed(2)}, Z: ${result.position[2].toFixed(2)}`,
  models: [result.objectAModel, result.objectBModel],
  assignedTo: result.assignee || "Unassigned",
  distance: `${result.distance.toFixed(2)} m`,
  note: result.note,
  objectABBox: result.objectABBox || void 0,
  objectBBBox: result.objectBBBox || void 0,
  element1: { name: result.objectA, category: result.objectAType.replace(/^Ifc/, ""), file: result.objectAModel },
  element2: { name: result.objectB, category: result.objectBType.replace(/^Ifc/, ""), file: result.objectBModel }
});
function useNavisworksWorkspace(projectSlug) {
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: workspaceKeys.workspace(projectSlug),
    queryFn: () => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/workspace`))
  });
  const importModels = useMutation({
    mutationFn: async (payload) => {
      const formData = new FormData();
      payload.files.forEach((file) => formData.append("models", file));
      formData.append("importsMeta", JSON.stringify(payload.files.map((file) => ({
        sourceModel: file.name.replace(/\.[^.]+$/, ""),
        originalName: file.name
      }))));
      return fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/models/import`), {
        method: "POST",
        body: formData
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    }
  });
  const saveSelectionSet = useMutation({
    mutationFn: async (payload) => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/selection-sets`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    }
  });
  const deleteSelectionSet = useMutation({
    mutationFn: async (selectionSetId) => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/selection-sets/${encodeURIComponent(selectionSetId)}`), {
      method: "DELETE"
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    }
  });
  const saveClashTest = useMutation({
    mutationFn: async (payload) => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    }
  });
  const deleteClashTest = useMutation({
    mutationFn: async (testId) => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(testId)}`), {
      method: "DELETE"
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    }
  });
  const runClashTest = useMutation({
    mutationFn: async (payload) => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(payload.testId)}/run`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affectedObjectIds: payload.affectedObjectIds ?? [] })
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
    }
  });
  const updateClashStatus = useMutation({
    mutationFn: async (payload) => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clashes/${encodeURIComponent(payload.clashId)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
    }
  });
  const applyObjectActions = useMutation({
    mutationFn: async (payload) => fetchJson(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clashes/actions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.root(projectSlug) });
    }
  });
  const importFromDocuments = useMutation({
    mutationFn: async (payload) => fetchJson(
      apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/models/import-from-documents`),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(projectSlug) });
    }
  });
  return {
    workspaceQuery,
    importModels,
    importFromDocuments,
    saveSelectionSet,
    deleteSelectionSet,
    saveClashTest,
    deleteClashTest,
    runClashTest,
    updateClashStatus,
    applyObjectActions
  };
}

async function fetchProjectMembers(projectId) {
  const response = await apiFetch("/api/projects/member-list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ projectId })
  });
  if (!response.ok) return [];
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row) => ({
    ...row,
    // Some API responses nest profile fields under `user`.
    fullName: row.fullName ?? row.user?.fullName ?? row.user?.name ?? null,
    email: row.email ?? row.user?.email ?? null,
    avatar: row.avatar ?? row.user?.avatar ?? null
  }));
}
function memberLabel(member) {
  const name = member.fullName?.trim();
  if (name) return name;
  const email = member.email?.trim();
  if (email) return email;
  return "Unknown member";
}
function useProjectMembers(projectId) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: Boolean(projectId),
    staleTime: 3e4,
    gcTime: 5 * 6e4
  });
}

const CLASH_SOFT_THRESHOLD_PRESETS_M = ["0", "0.01", "0.025", "0.05", "0.1", "0.25"];
const CLASH_DUPLICATE_TOLERANCE_PRESETS_M = ["0.0001", "0.001", "0.005", "0.01"];
const INSPECTOR_NOTE_MAX_LEN = 8e3;
const parseManualIdList = (raw) => raw.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
const resolveSelectionSetObjectIds = (selectionSet, objects) => {
  if (!selectionSet) return [];
  const filteredIds = objects.filter((object) => {
    const { modelIds, types, categories } = selectionSet.filters;
    if (modelIds.length > 0 && !modelIds.includes(object.sourceModelId)) return false;
    if (types.length > 0 && !types.includes(object.type)) return false;
    if (categories.length > 0 && !categories.includes(object.category)) return false;
    return true;
  }).map((object) => object.id);
  const included = /* @__PURE__ */ new Set([...filteredIds, ...selectionSet.manualIncludeIds]);
  selectionSet.manualExcludeIds.forEach((id) => included.delete(id));
  return Array.from(included);
};
function SelectionSetChipPicker({
  options,
  selected,
  onToggle,
  emptyMessage,
  "aria-invalid": ariaInvalid
}) {
  if (options.length === 0) {
    return /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[#6A7282]", children: emptyMessage ?? "No options available." });
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "mt-1 max-h-[7.5rem] overflow-y-auto rounded-lg border p-2",
        ariaInvalid ? "border-red-400 bg-red-50/40" : "border-[#D1D5DC] bg-[#FAFAFA]"
      ),
      role: "group",
      children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", children: options.map((opt) => {
        const on = selected.includes(opt.value);
        return /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onToggle(opt.value),
            className: cn(
              "max-w-full truncate rounded-full border px-2.5 py-1 text-left text-[11px] font-medium transition-colors",
              on ? "border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]" : "border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
            ),
            children: opt.label
          },
          opt.value
        );
      }) })
    }
  );
}
function ManualIdSuggestions({
  label,
  ids,
  onPick
}) {
  if (ids.length === 0) return null;
  return /* @__PURE__ */ jsxs("div", { className: "mt-1.5", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[10px] font-medium uppercase tracking-wide text-[#6A7282]", children: label }),
    /* @__PURE__ */ jsx("div", { className: "mt-1 flex max-h-[4.5rem] flex-wrap gap-1 overflow-y-auto", children: ids.map((id) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => onPick(id),
        className: "max-w-[min(100%,12rem)] truncate rounded border border-[#E5E7EB] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#364153] hover:border-[#155DFC] hover:bg-[#EFF6FF]",
        title: id,
        children: id
      },
      id
    )) })
  ] });
}
function SidebarActionBanner({ banner, className }) {
  if (!banner) return null;
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900"
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "status",
      "aria-live": "polite",
      className: cn("mb-2 rounded-lg border px-3 py-2 text-sm leading-snug", styles[banner.variant], className),
      children: banner.message
    }
  );
}
const triggerDownload = async (url, filename) => {
  const response = await apiFetch(url);
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "download";
  link.click();
  URL.revokeObjectURL(objectUrl);
};
function NavisworksClashWorkspace({ projectSlug, onBack }) {
  useRef(null);
  const sidebarPanelId = useId();
  const objectIdDatalistId = useId();
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [selectedClashId, setSelectedClashId] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [planeView, setPlaneView] = useState("3d");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("select");
  const [dragActive, setDragActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState(/* @__PURE__ */ new Set());
  const [hideUnrelatedToActiveTest, setHideUnrelatedToActiveTest] = useState(false);
  const [search, setSearch] = useState("");
  const [hiddenModelIds, setHiddenModelIds] = useState([]);
  const [hiddenCategories, setHiddenCategories] = useState([]);
  const [selectionSetDraft, setSelectionSetDraft] = useState({
    name: "",
    description: "",
    modelIds: [],
    categories: [],
    types: [],
    manualIncludeIds: "",
    manualExcludeIds: ""
  });
  const [selectionSetFormErrors, setSelectionSetFormErrors] = useState({});
  const [clashTestDraft, setClashTestDraft] = useState({
    name: "",
    description: "",
    setAId: "",
    setBId: "",
    softThreshold: "0.05",
    duplicateTolerance: "0.001"
  });
  const [noteDraft, setNoteDraft] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("Unassigned");
  const [error, setError] = useState(null);
  const [runTestDialogOpen, setRunTestDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [pendingDeleteTestId, setPendingDeleteTestId] = useState(null);
  const [pendingDeleteSetId, setPendingDeleteSetId] = useState(null);
  const [clashTestFormErrors, setClashTestFormErrors] = useState({});
  const [clashTestActionBanner, setClashTestActionBanner] = useState(null);
  const [selectionSetActionBanner, setSelectionSetActionBanner] = useState(null);
  const [exportActionBanner, setExportActionBanner] = useState(null);
  const [inspectorActionBanner, setInspectorActionBanner] = useState(null);
  const clashTestBannerTimer = useRef(null);
  const selectionSetBannerTimer = useRef(null);
  const exportBannerTimer = useRef(null);
  const inspectorBannerTimer = useRef(null);
  const showTimedBanner = (setBanner, timerRef, banner, ms = 8e3) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBanner(banner);
    timerRef.current = setTimeout(() => {
      setBanner(null);
      timerRef.current = null;
    }, ms);
  };
  const clearInspectorActionBanner = useCallback(() => {
    if (inspectorBannerTimer.current) {
      clearTimeout(inspectorBannerTimer.current);
      inspectorBannerTimer.current = null;
    }
    setInspectorActionBanner(null);
  }, []);
  useEffect(
    () => () => {
      [clashTestBannerTimer, selectionSetBannerTimer, exportBannerTimer, inspectorBannerTimer].forEach((ref) => {
        if (ref.current) clearTimeout(ref.current);
      });
    },
    []
  );
  const [showClashInMainViewer, setShowClashInMainViewer] = useState(false);
  const { data: projectMembers = [], isFetching: projectMembersLoading } = useProjectMembers(projectSlug);
  const {
    workspaceQuery,
    importModels,
    importFromDocuments,
    saveSelectionSet,
    deleteSelectionSet,
    saveClashTest,
    deleteClashTest,
    runClashTest,
    updateClashStatus,
    applyObjectActions
  } = useNavisworksWorkspace(projectSlug);
  const ifcDocumentsQuery = useQuery({
    queryKey: workspaceKeys.ifcDocuments(projectSlug),
    queryFn: async () => {
      const res = await apiFetch(apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/documents`));
      const data = await res.json();
      return data.documents ?? [];
    },
    enabled: importModalOpen,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });
  const workspace = workspaceQuery.data;
  const models = workspace?.federatedModel.models ?? [];
  const allObjects = workspace?.federatedModel.objects ?? [];
  workspace?.federatedModel.categories ?? [];
  const persistedHiddenObjects = useMemo(
    () => allObjects.filter((object) => object.hidden),
    [allObjects]
  );
  useMemo(
    () => Array.from(new Set(allObjects.map((object) => object.type))).sort(),
    [allObjects]
  );
  const objectsInSelectionModelScope = useMemo(() => {
    if (selectionSetDraft.modelIds.length === 0) return allObjects;
    const modelScope = new Set(selectionSetDraft.modelIds);
    return allObjects.filter((object) => modelScope.has(object.sourceModelId));
  }, [allObjects, selectionSetDraft.modelIds]);
  const scopedCategories = useMemo(() => {
    const next = new Set(objectsInSelectionModelScope.map((object) => object.category));
    selectionSetDraft.categories.forEach((category) => next.add(category));
    return Array.from(next).sort();
  }, [objectsInSelectionModelScope, selectionSetDraft.categories]);
  const scopedTypes = useMemo(() => {
    const activeCategories = new Set(selectionSetDraft.categories);
    const sourceObjects = activeCategories.size > 0 ? objectsInSelectionModelScope.filter((object) => activeCategories.has(object.category)) : objectsInSelectionModelScope;
    const next = new Set(sourceObjects.map((object) => object.type));
    selectionSetDraft.types.forEach((type) => next.add(type));
    return Array.from(next).sort();
  }, [objectsInSelectionModelScope, selectionSetDraft.categories, selectionSetDraft.types]);
  const suggestedManualObjectIds = useMemo(() => allObjects.slice(0, 24).map((object) => object.id), [allObjects]);
  const objectIdDatalistOptions = useMemo(() => allObjects.slice(0, 200).map((object) => object.id), [allObjects]);
  const objectMeshPositions = useMemo(
    () => allObjects.reduce((acc, object) => {
      if (object.clashMesh?.positions?.length) {
        acc[object.id] = object.clashMesh.positions;
      }
      return acc;
    }, {}),
    [allObjects]
  );
  useEffect(() => {
    if (!selectedTestId && workspace?.clashTests?.length) {
      setSelectedTestId(workspace.clashTests[0].id);
      setShowClashInMainViewer(true);
    }
  }, [selectedTestId, workspace?.clashTests]);
  const resultsQuery = useNavisworksClashResults(projectSlug, selectedTestId);
  const runPayload = resultsQuery.data;
  const selectedTest = workspace?.clashTests.find((test) => test.id === selectedTestId) ?? null;
  const results = runPayload?.results ?? [];
  const selectionSetById = useMemo(
    () => new Map((workspace?.selectionSets ?? []).map((set) => [set.id, set])),
    [workspace?.selectionSets]
  );
  const activeTestScopeObjectIds = useMemo(() => {
    if (!selectedTest?.setAId || !selectedTest?.setBId) return [];
    const setA = selectionSetById.get(selectedTest.setAId);
    const setB = selectionSetById.get(selectedTest.setBId);
    return Array.from(/* @__PURE__ */ new Set([
      ...resolveSelectionSetObjectIds(setA, allObjects),
      ...resolveSelectionSetObjectIds(setB, allObjects)
    ]));
  }, [allObjects, selectedTest?.setAId, selectedTest?.setBId, selectionSetById]);
  const shouldHighlightActiveScope = Boolean(runPayload?.run && activeTestScopeObjectIds.length > 0);
  useEffect(() => {
    if (!showClashInMainViewer) return;
    if (!selectedClashId && results.length > 0) {
      setSelectedClashId(results[0].clashId);
      return;
    }
    if (selectedClashId && !results.some((result) => result.clashId === selectedClashId)) {
      setSelectedClashId(results[0]?.clashId ?? null);
    }
  }, [results, selectedClashId, showClashInMainViewer]);
  const filteredResults = useMemo(() => results.filter((result) => {
    if (statusFilter !== "all" && result.status !== statusFilter) return false;
    if (search.trim()) {
      const haystack = `${result.title} ${result.objectA} ${result.objectB} ${result.objectAModel} ${result.objectBModel}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    if (hiddenModelIds.includes(result.objectAModel) && hiddenModelIds.includes(result.objectBModel)) return false;
    return true;
  }), [hiddenModelIds, results, search, statusFilter]);
  const selectedResult = filteredResults.find((result) => result.clashId === selectedClashId) ?? results.find((result) => result.clashId === selectedClashId) ?? null;
  const viewerClash = showClashInMainViewer && selectedResult ? resultToViewerClash(selectedResult) : null;
  const federatedOverviewScene = useMemo(
    () => buildOverviewSceneFromFederated(allObjects, {
      hiddenModelIds,
      hiddenCategories,
      // No cap — show all visible objects. Mesh is pre-subsampled (80 tris/object) so
      // even large federated models stay within xeokit's performance budget.
      maxObjects: allObjects.length
    }),
    [allObjects, hiddenCategories, hiddenModelIds]
  );
  const overviewSceneForViewer = !viewerClash && models.length > 0 ? federatedOverviewScene : void 0;
  const xktModelsForViewer = useMemo(
    () => models.filter((m) => m.sourceFormat === "xkt" && m.xktFile).map((m) => ({ id: m.id })),
    [models]
  );
  const hasXktOnlyOverview = Boolean(
    !viewerClash && models.length > 0 && federatedOverviewScene.length === 0 && xktModelsForViewer.length > 0
  );
  const zeroClashesAfterRun = Boolean(runPayload?.run && runPayload.run.summary.total === 0);
  const normalizeAssigneeForDisplay = useCallback(
    (rawAssignee) => {
      const value = (rawAssignee || "").trim();
      if (!value || value === "Unassigned") return "Unassigned";
      const matchedMember = projectMembers.find((member) => member.userId === value);
      return matchedMember ? memberLabel(matchedMember) : value;
    },
    [projectMembers]
  );
  useEffect(() => {
    if (!selectedResult) return;
    clearInspectorActionBanner();
    setSelectedObjectId(selectedResult.objectA);
    setNoteDraft(selectedResult.note || "");
    setAssigneeDraft(normalizeAssigneeForDisplay(selectedResult.assignee));
  }, [clearInspectorActionBanner, normalizeAssigneeForDisplay, selectedResult?.assignee, selectedResult?.clashId]);
  useEffect(() => {
    if (!selectedResult) clearInspectorActionBanner();
  }, [clearInspectorActionBanner, selectedResult]);
  const hiddenObjectIds = useMemo(() => {
    if (!selectedResult) return [];
    const next = [];
    const aObj = allObjects.find((o) => o.id === selectedResult.objectA);
    const bObj = allObjects.find((o) => o.id === selectedResult.objectB);
    const aByFilter = hiddenModelIds.includes(selectedResult.objectAModel) || hiddenCategories.includes(selectedResult.objectAType.replace(/^Ifc/, ""));
    const bByFilter = hiddenModelIds.includes(selectedResult.objectBModel) || hiddenCategories.includes(selectedResult.objectBType.replace(/^Ifc/, ""));
    if (aByFilter || aObj?.hidden) next.push(selectedResult.objectA);
    if (bByFilter || bObj?.hidden) next.push(selectedResult.objectB);
    return next;
  }, [allObjects, hiddenCategories, hiddenModelIds, selectedResult]);
  const viewerHiddenObjectIds = useMemo(() => {
    const merged = new Set(hiddenObjectIds);
    const scope = new Set(activeTestScopeObjectIds);
    if (shouldHighlightActiveScope && !viewerClash) {
      scope.forEach((id) => merged.delete(id));
    }
    if (hideUnrelatedToActiveTest && shouldHighlightActiveScope && !viewerClash) {
      allObjects.forEach((object) => {
        if (!scope.has(object.id)) merged.add(object.id);
      });
    }
    return Array.from(merged);
  }, [
    activeTestScopeObjectIds,
    allObjects,
    hiddenObjectIds,
    hideUnrelatedToActiveTest,
    shouldHighlightActiveScope,
    viewerClash
  ]);
  const memberAssigneeLabels = useMemo(
    () => projectMembers.map((member) => memberLabel(member)),
    [projectMembers]
  );
  const assigneeKnownOption = assigneeDraft === "Unassigned" || memberAssigneeLabels.includes(assigneeDraft);
  const toggleArrayValue = (values, nextValue) => values.includes(nextValue) ? values.filter((value) => value !== nextValue) : [...values, nextValue];
  const resetSelectionSetFeedback = () => {
    setSelectionSetFormErrors({});
    if (selectionSetBannerTimer.current) {
      clearTimeout(selectionSetBannerTimer.current);
      selectionSetBannerTimer.current = null;
    }
    setSelectionSetActionBanner(null);
  };
  const patchSelectionSetDraft = (patch) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => ({ ...current, ...patch }));
  };
  const appendManualIncludeId = (id) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => {
      const parts = parseManualIdList(current.manualIncludeIds);
      if (parts.includes(id)) return current;
      return { ...current, manualIncludeIds: [...parts, id].join(", ") };
    });
  };
  const appendManualExcludeId = (id) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => {
      const parts = parseManualIdList(current.manualExcludeIds);
      if (parts.includes(id)) return current;
      return { ...current, manualExcludeIds: [...parts, id].join(", ") };
    });
  };
  const toggleSelectionSetDraftArray = (key, value) => {
    resetSelectionSetFeedback();
    setSelectionSetDraft((current) => {
      if (key === "modelIds") {
        return {
          ...current,
          modelIds: toggleArrayValue(current.modelIds, value),
          // Changing model scope invalidates dependent scopes.
          categories: [],
          types: []
        };
      }
      if (key === "categories") {
        return {
          ...current,
          categories: toggleArrayValue(current.categories, value),
          // Type scope depends on chosen categories.
          types: []
        };
      }
      return {
        ...current,
        types: toggleArrayValue(current.types, value)
      };
    });
  };
  const validateSelectionSetDraft = () => {
    const errors = {};
    const name = selectionSetDraft.name.trim();
    if (!name) {
      errors.name = "Selection set name is required.";
    }
    const manualInc = parseManualIdList(selectionSetDraft.manualIncludeIds);
    const hasScope = selectionSetDraft.modelIds.length > 0 || selectionSetDraft.categories.length > 0 || selectionSetDraft.types.length > 0 || manualInc.length > 0;
    if (!hasScope) {
      errors.scope = "Choose at least one model, category, or type, or enter at least one object ID under Manual include.";
    }
    setSelectionSetFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = errors.name ?? errors.scope ?? "Fix the form and try again.";
      toast.error(first);
      showTimedBanner(setSelectionSetActionBanner, selectionSetBannerTimer, { variant: "error", message: first });
      return false;
    }
    return true;
  };
  const saveSelectionSetDraft = async () => {
    if (!validateSelectionSetDraft()) return;
    try {
      setError(null);
      const { selectionSet } = await saveSelectionSet.mutateAsync({
        name: selectionSetDraft.name,
        description: selectionSetDraft.description,
        filters: {
          modelIds: selectionSetDraft.modelIds,
          categories: selectionSetDraft.categories,
          types: selectionSetDraft.types
        },
        manualIncludeIds: parseManualIdList(selectionSetDraft.manualIncludeIds),
        manualExcludeIds: parseManualIdList(selectionSetDraft.manualExcludeIds)
      });
      setSelectionSetFormErrors({});
      setSelectionSetDraft({
        name: "",
        description: "",
        modelIds: [],
        categories: [],
        types: [],
        manualIncludeIds: "",
        manualExcludeIds: ""
      });
      toast.success("Selection set saved", {
        description: `"${selectionSet.name}" is ready to use in clash tests.`
      });
      showTimedBanner(setSelectionSetActionBanner, selectionSetBannerTimer, {
        variant: "success",
        message: `Selection set "${selectionSet.name}" saved. You can use it as Set A / Set B in a clash test.`
      });
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : "Failed to save selection set";
      setError(msg);
      toast.error(msg);
      showTimedBanner(setSelectionSetActionBanner, selectionSetBannerTimer, { variant: "error", message: msg });
    }
  };
  const patchClashTestDraft = (patch) => {
    setClashTestFormErrors({});
    if (clashTestBannerTimer.current) {
      clearTimeout(clashTestBannerTimer.current);
      clashTestBannerTimer.current = null;
    }
    setClashTestActionBanner(null);
    setClashTestDraft((current) => ({ ...current, ...patch }));
  };
  const validateClashTestDraft = () => {
    const errors = {};
    const name = clashTestDraft.name.trim();
    if (!name) {
      errors.name = "Test name is required.";
    }
    if (!clashTestDraft.setAId) {
      errors.setAId = "Select Set A.";
    }
    if (!clashTestDraft.setBId) {
      errors.setBId = "Select Set B.";
    }
    if (clashTestDraft.setAId && clashTestDraft.setBId && clashTestDraft.setAId === clashTestDraft.setBId) {
      errors.setBId = "Set B must differ from Set A.";
    }
    const softRaw = clashTestDraft.softThreshold.trim();
    const soft = Number(softRaw);
    if (softRaw === "" || !Number.isFinite(soft) || soft < 0) {
      errors.softThreshold = "Enter a valid number ≥ 0 (meters).";
    }
    const dupRaw = clashTestDraft.duplicateTolerance.trim();
    const dup = Number(dupRaw);
    if (dupRaw === "" || !Number.isFinite(dup) || dup < 0) {
      errors.duplicateTolerance = "Enter a valid number ≥ 0 (meters).";
    }
    setClashTestFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0];
      toast.error(first);
      showTimedBanner(setClashTestActionBanner, clashTestBannerTimer, { variant: "error", message: first });
      return false;
    }
    return true;
  };
  const saveClashTestDraft = async () => {
    if (!validateClashTestDraft()) return;
    try {
      setError(null);
      const softThreshold = Number(clashTestDraft.softThreshold.trim());
      const duplicateTolerance = Number(clashTestDraft.duplicateTolerance.trim());
      const response = await saveClashTest.mutateAsync({
        name: clashTestDraft.name.trim(),
        description: clashTestDraft.description.trim(),
        setAId: clashTestDraft.setAId,
        setBId: clashTestDraft.setBId,
        softThreshold,
        duplicateTolerance
      });
      setSelectedTestId(response.clashTest.id);
      setSelectedClashId(null);
      setShowClashInMainViewer(true);
      setClashTestFormErrors({});
      setClashTestDraft({
        name: "",
        description: "",
        setAId: "",
        setBId: "",
        softThreshold: "0.05",
        duplicateTolerance: "0.001"
      });
      toast.success("Clash test saved", {
        description: `"${response.clashTest.name}" — select it above and click Run Test when ready.`
      });
      showTimedBanner(setClashTestActionBanner, clashTestBannerTimer, {
        variant: "success",
        message: `Saved "${response.clashTest.name}". Select the test above, then Run Test when ready.`
      });
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : "Failed to save clash test";
      setError(msg);
      toast.error(msg);
      showTimedBanner(setClashTestActionBanner, clashTestBannerTimer, { variant: "error", message: msg });
    }
  };
  const importModelFiles = async (files, openSidebarAfter = true) => {
    if (files.length === 0) return;
    try {
      setError(null);
      await importModels.mutateAsync({ files });
      if (openSidebarAfter) {
        setSidebarOpen(true);
        setSidebarTab("select");
      }
      toast.success(`Imported ${files.length} file${files.length === 1 ? "" : "s"}.`);
    } catch (importError) {
      const msg = importError instanceof Error ? importError.message : "Failed to import models";
      setError(msg);
      toast.error(msg);
    }
  };
  const handleStageDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const handleStageDragLeave = (event) => {
    event.preventDefault();
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
      setDragActive(false);
    }
  };
  const handleStageDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files).filter(
      (file) => file.name.endsWith(".ifc") || file.name.endsWith(".json") || file.name.toLowerCase().endsWith(".xkt") || file.type === "application/json" || file.type === "application/octet-stream"
    );
    await importModelFiles(files, true);
  };
  const executeRunTest = async () => {
    if (!selectedTestId) return;
    setRunTestDialogOpen(false);
    try {
      setError(null);
      const payload = await runClashTest.mutateAsync({ testId: selectedTestId });
      const list = payload.results ?? [];
      setShowClashInMainViewer(true);
      setSidebarOpen(true);
      setSidebarTab("results");
      setSelectedClashId(list[0]?.clashId ?? null);
      const total = payload.run?.summary?.total ?? list.length;
      toast.success(`Clash test finished: ${total} result${total === 1 ? "" : "s"}.`);
    } catch (runError) {
      const msg = runError instanceof Error ? runError.message : "Failed to run clash test";
      setError(msg);
      toast.error(msg);
    }
  };
  const markSelectedClashResolved = async () => {
    if (!selectedResult) return;
    try {
      setError(null);
      await updateClashStatus.mutateAsync({
        clashId: selectedResult.clashId,
        status: "resolved",
        note: noteDraft,
        assignee: assigneeDraft
      });
      await resultsQuery.refetch();
      toast.success("Clash marked as resolved.");
    } catch (statusError) {
      const msg = statusError instanceof Error ? statusError.message : "Failed to update clash status";
      setError(msg);
      toast.error(msg);
    }
  };
  useEffect(() => {
    if (!showClashInMainViewer || !selectedResult || selectedResult.status !== "new") return;
    const { clashId } = selectedResult;
    const timer = window.setTimeout(() => {
      void updateClashStatus.mutateAsync({ clashId, status: "reviewed" }).catch(() => {
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [selectedResult?.clashId, selectedResult?.status, showClashInMainViewer, updateClashStatus]);
  const saveClashInspectorDetails = async () => {
    if (!selectedResult) {
      const msg = "Select a clash in the list before saving.";
      toast.error(msg);
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, { variant: "error", message: msg });
      return;
    }
    const noteTrim = noteDraft.trim();
    const assigneeTrim = assigneeDraft.trim() || "Unassigned";
    if (noteTrim.length > INSPECTOR_NOTE_MAX_LEN) {
      const msg = `Note must be at most ${INSPECTOR_NOTE_MAX_LEN} characters.`;
      toast.error(msg);
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, { variant: "error", message: msg });
      return;
    }
    try {
      setError(null);
      await updateClashStatus.mutateAsync({
        clashId: selectedResult.clashId,
        note: noteTrim,
        assignee: assigneeTrim,
        ...selectedResult.status !== "resolved" ? { status: "reviewed" } : {}
      });
      await resultsQuery.refetch();
      setNoteDraft(noteTrim);
      setAssigneeDraft(assigneeTrim);
      toast.success("Note and assignee saved.");
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, {
        variant: "success",
        message: selectedResult.status === "resolved" ? "Note and assignee saved (clash stays Resolved)." : "Note and assignee saved. Status set to Reviewed."
      });
    } catch (saveDetailsError) {
      const msg = saveDetailsError instanceof Error ? saveDetailsError.message : "Failed to save note or assignee";
      setError(msg);
      toast.error(msg);
      showTimedBanner(setInspectorActionBanner, inspectorBannerTimer, { variant: "error", message: msg });
    }
  };
  const hideObject = async (objectId) => {
    try {
      setError(null);
      await applyObjectActions.mutateAsync({ action: "hide", objectIds: [objectId] });
      await resultsQuery.refetch();
      toast.success("Object hidden for clash tests.");
    } catch (hideError) {
      const msg = hideError instanceof Error ? hideError.message : "Failed to hide object";
      setError(msg);
      toast.error(msg);
    }
  };
  const showObjects = async (objectIds) => {
    if (objectIds.length === 0) return;
    try {
      setError(null);
      await applyObjectActions.mutateAsync({ action: "show", objectIds });
      await resultsQuery.refetch();
      toast.success(`${objectIds.length} object${objectIds.length === 1 ? "" : "s"} shown again.`);
    } catch (showError) {
      const msg = showError instanceof Error ? showError.message : "Failed to show objects";
      setError(msg);
      toast.error(msg);
    }
  };
  const resetHiddenObjects = async () => {
    const ids = persistedHiddenObjects.map((object) => object.id);
    if (ids.length === 0) return;
    await showObjects(ids);
  };
  const exportCurrent = async (format) => {
    if (format !== "model" && !selectedTestId) {
      const warnMsg = "Choose a clash test in the Tests tab before exporting JSON, CSV, or BCF.";
      toast.warning("Select a clash test first", { description: warnMsg });
      showTimedBanner(setExportActionBanner, exportBannerTimer, { variant: "warning", message: warnMsg });
      return;
    }
    try {
      setError(null);
      if (format === "model") {
        const filename2 = `${projectSlug}-federated-model.json`;
        await triggerDownload(
          apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/export/model`),
          filename2
        );
        toast.success("Federated model exported", {
          description: `${filename2} was downloaded.`
        });
        showTimedBanner(setExportActionBanner, exportBannerTimer, {
          variant: "success",
          message: `Federated model exported: ${filename2} (download should start in your browser).`
        });
        return;
      }
      const ext = format === "bcf" ? "bcf.json" : format;
      const filename = `${projectSlug}-${selectedTestId}.${ext}`;
      const base = format === "bcf" ? apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(selectedTestId || "")}/export/bcf`) : apiUrl(`/projects/${encodeURIComponent(projectSlug)}/navisworks/clash-tests/${encodeURIComponent(selectedTestId || "")}/export?format=${format}`);
      await triggerDownload(base, filename);
      toast.success(`Export complete (${format.toUpperCase()})`, {
        description: `${filename} was downloaded.`
      });
      showTimedBanner(setExportActionBanner, exportBannerTimer, {
        variant: "success",
        message: `${format.toUpperCase()} export ready: ${filename} (check your downloads folder).`
      });
    } catch (exportError) {
      const msg = exportError instanceof Error ? exportError.message : "Failed to export";
      setError(msg);
      toast.error(msg);
      showTimedBanner(setExportActionBanner, exportBannerTimer, { variant: "error", message: msg });
    }
  };
  const confirmDeleteClashTest = async () => {
    if (!pendingDeleteTestId) return;
    const id = pendingDeleteTestId;
    setPendingDeleteTestId(null);
    try {
      setError(null);
      await deleteClashTest.mutateAsync(id);
      if (selectedTestId === id) {
        setSelectedTestId(null);
        setSelectedClashId(null);
        setShowClashInMainViewer(false);
      }
      toast.success("Clash test deleted.");
    } catch (deleteError) {
      const msg = deleteError instanceof Error ? deleteError.message : "Failed to delete clash test";
      setError(msg);
      toast.error(msg);
    }
  };
  const confirmDeleteSelectionSet = async () => {
    if (!pendingDeleteSetId) return;
    const id = pendingDeleteSetId;
    setPendingDeleteSetId(null);
    try {
      setError(null);
      await deleteSelectionSet.mutateAsync(id);
      toast.success("Selection set deleted.");
    } catch (deleteError) {
      const msg = deleteError instanceof Error ? deleteError.message : "Failed to delete selection set";
      setError(msg);
      toast.error(msg);
    }
  };
  const pickTab = (tab) => {
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setSidebarTab(tab);
    }
  };
  return /* @__PURE__ */ jsxs(TooltipProvider, { delayDuration: 400, children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: cn(
          "flex h-[calc(100dvh-7.5rem)] min-h-[520px] flex-col",
          "[&_button]:transition-[transform,filter] [&_button]:duration-100",
          "[&_button]:active:scale-[0.98] [&_button]:active:brightness-[0.93]",
          "[&_button:disabled]:pointer-events-none [&_button:disabled]:active:scale-100 [&_button:disabled]:active:brightness-100",
          "motion-reduce:[&_button]:active:scale-100"
        ),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center justify-between gap-4 border-b border-[#E5E7EB] bg-white px-5 py-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              onBack && /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: onBack,
                  className: "inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-[#4A5565] hover:bg-[#F3F4F6] transition-colors",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "size-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" }) }),
                    "Back"
                  ]
                }
              ),
              /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-[#101828]", children: "Clash Detection" }),
              error && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#B91C1C]", children: [
                /* @__PURE__ */ jsx("svg", { className: "size-3", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z", clipRule: "evenodd" }) }),
                "Error"
              ] }),
              persistedHiddenObjects.length > 0 && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800", children: [
                persistedHiddenObjects.length,
                " hidden",
                /* @__PURE__ */ jsx("button", { type: "button", onClick: () => void resetHiddenObjects(), className: "ml-0.5 underline underline-offset-1", children: "Reset" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => {
                  setSelectedDocIds(/* @__PURE__ */ new Set());
                  setImportModalOpen(true);
                },
                className: "inline-flex items-center gap-2 rounded-lg bg-[#155DFC] px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors",
                children: [
                  /* @__PURE__ */ jsx(Upload, { className: "size-4", "aria-hidden": true }),
                  "Import"
                ]
              }
            )
          ] }),
          error && /* @__PURE__ */ jsx("div", { className: "shrink-0 border-b border-[#FECACA] bg-[#FEF2F2] px-5 py-2.5 text-sm text-[#B91C1C]", children: error }),
          /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-0 flex-1 overflow-hidden bg-[#F9FAFB]", children: [
            sidebarOpen && /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                "aria-label": "Close sidebar",
                className: "fixed inset-0 z-40 bg-black/35 md:hidden",
                onClick: () => setSidebarOpen(false)
              }
            ),
            /* @__PURE__ */ jsxs(
              "nav",
              {
                className: "relative z-10 flex min-h-0 w-12 shrink-0 flex-col items-center gap-1 self-stretch overflow-y-auto border-r border-[#E5E7EB] bg-white py-2",
                "aria-label": "Activity bar",
                children: [
                  /* @__PURE__ */ jsxs(Tooltip, { children: [
                    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: cn(
                          "flex size-10 items-center justify-center rounded-md text-[#364153] hover:bg-white/80",
                          sidebarOpen && "bg-white shadow-sm"
                        ),
                        "aria-expanded": sidebarOpen,
                        "aria-controls": sidebarPanelId,
                        onClick: () => {
                          if (sidebarOpen) setSidebarOpen(false);
                          else {
                            setSidebarOpen(true);
                            setSidebarTab("select");
                          }
                        },
                        children: /* @__PURE__ */ jsx(PanelLeft, { className: "size-5", "aria-hidden": true })
                      }
                    ) }),
                    /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: "Toggle sidebar" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "my-1 h-px w-6 bg-[#D1D5DC]", role: "presentation" }),
                  /* @__PURE__ */ jsxs(Tooltip, { children: [
                    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: cn(
                          "flex size-10 items-center justify-center rounded-md",
                          sidebarOpen && sidebarTab === "select" ? "bg-[#155DFC] text-white" : "text-[#364153] hover:bg-white/80"
                        ),
                        "aria-pressed": sidebarOpen && sidebarTab === "select",
                        onClick: () => pickTab("select"),
                        children: /* @__PURE__ */ jsx(FolderTree, { className: "size-5", "aria-hidden": true })
                      }
                    ) }),
                    /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: "Select · models & sets" })
                  ] }),
                  /* @__PURE__ */ jsxs(Tooltip, { children: [
                    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: cn(
                          "flex size-10 items-center justify-center rounded-md",
                          sidebarOpen && sidebarTab === "tests" ? "bg-[#155DFC] text-white" : "text-[#364153] hover:bg-white/80"
                        ),
                        "aria-pressed": sidebarOpen && sidebarTab === "tests",
                        onClick: () => pickTab("tests"),
                        children: /* @__PURE__ */ jsx(FlaskConical, { className: "size-5", "aria-hidden": true })
                      }
                    ) }),
                    /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: "Tests" })
                  ] }),
                  /* @__PURE__ */ jsxs(Tooltip, { children: [
                    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: cn(
                          "flex size-10 items-center justify-center rounded-md",
                          sidebarOpen && sidebarTab === "results" ? "bg-[#155DFC] text-white" : "text-[#364153] hover:bg-white/80"
                        ),
                        "aria-pressed": sidebarOpen && sidebarTab === "results",
                        onClick: () => pickTab("results"),
                        children: /* @__PURE__ */ jsx(ListChecks, { className: "size-5", "aria-hidden": true })
                      }
                    ) }),
                    /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: "Results" })
                  ] }),
                  /* @__PURE__ */ jsxs(Tooltip, { children: [
                    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: cn(
                          "flex size-10 items-center justify-center rounded-md",
                          sidebarOpen && sidebarTab === "report" ? "bg-[#155DFC] text-white" : "text-[#364153] hover:bg-white/80"
                        ),
                        "aria-pressed": sidebarOpen && sidebarTab === "report",
                        onClick: () => pickTab("report"),
                        children: /* @__PURE__ */ jsx(FileText, { className: "size-5", "aria-hidden": true })
                      }
                    ) }),
                    /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: "Report & export" })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "aside",
              {
                id: sidebarPanelId,
                className: cn(
                  "relative z-10 max-md:z-[45] flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[#E5E7EB] bg-white transition-[width,opacity,transform] duration-200",
                  "max-md:fixed max-md:bottom-0 max-md:left-12 max-md:top-0 max-md:w-[min(calc(100vw-3rem),360px)] max-md:shadow-xl",
                  sidebarOpen ? "max-md:translate-x-0 max-md:opacity-100" : "max-md:pointer-events-none max-md:-translate-x-full max-md:opacity-0",
                  "md:translate-x-0 md:opacity-100",
                  sidebarOpen ? "md:w-[min(360px,34vw)]" : "md:w-0 md:border-r-0"
                ),
                "aria-hidden": !sidebarOpen,
                children: /* @__PURE__ */ jsxs("div", { className: cn("flex h-full max-h-full min-h-0 min-w-[min(100%,360px)] flex-1 flex-col overflow-hidden", !sidebarOpen && "md:invisible md:overflow-hidden"), children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-2", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [
                      /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-semibold text-[#101828]", children: selectedTest?.name || "Clash Detective" }),
                      runPayload?.run && /* @__PURE__ */ jsxs("span", { className: "shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-medium text-[#155DFC]", children: [
                        runPayload.run.summary.total,
                        " results"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: "shrink-0 rounded-md p-1.5 text-[#6A7282] hover:bg-[#F3F4F6] md:hidden",
                        "aria-label": "Close panel",
                        onClick: () => setSidebarOpen(false),
                        children: /* @__PURE__ */ jsx(X, { className: "size-5" })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]", children: [
                    sidebarTab === "tests" && /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => setRunTestDialogOpen(true),
                          disabled: !selectedTestId || runClashTest.isPending,
                          className: cn(
                            "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors",
                            !selectedTestId || runClashTest.isPending ? "cursor-not-allowed bg-[#93C5FD]" : "bg-[#155DFC] hover:bg-blue-700"
                          ),
                          children: runClashTest.isPending ? /* @__PURE__ */ jsxs(Fragment, { children: [
                            /* @__PURE__ */ jsxs("svg", { className: "size-4 animate-spin", fill: "none", viewBox: "0 0 24 24", children: [
                              /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
                              /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })
                            ] }),
                            "Running…"
                          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                            /* @__PURE__ */ jsx("svg", { className: "size-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" }) }),
                            "Run Selected Test"
                          ] })
                        }
                      ),
                      /* @__PURE__ */ jsx("div", { className: "space-y-2", children: workspace?.clashTests.map((test) => /* @__PURE__ */ jsxs(
                        "div",
                        {
                          role: "button",
                          tabIndex: 0,
                          onClick: () => {
                            setSelectedTestId(test.id);
                            setSelectedClashId(null);
                            setShowClashInMainViewer(true);
                          },
                          onKeyDown: (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedTestId(test.id);
                              setSelectedClashId(null);
                              setShowClashInMainViewer(true);
                            }
                          },
                          className: cn(
                            "w-full rounded-lg border p-3 text-left",
                            selectedTestId === test.id ? "border-[#155DFC] bg-[#EFF6FF]" : "border-[#E5E7EB] bg-white"
                          ),
                          children: [
                            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: test.name }),
                                /* @__PURE__ */ jsxs("p", { className: "text-xs text-[#6A7282]", children: [
                                  "Threshold ",
                                  test.softThreshold,
                                  " m · Duplicate ",
                                  test.duplicateTolerance
                                ] })
                              ] }),
                              /* @__PURE__ */ jsx(
                                "button",
                                {
                                  type: "button",
                                  onClick: (event) => {
                                    event.stopPropagation();
                                    setPendingDeleteTestId(test.id);
                                  },
                                  className: "shrink-0 text-xs text-[#DC2626]",
                                  children: "Delete"
                                }
                              )
                            ] }),
                            test.latestRun && /* @__PURE__ */ jsxs("div", { className: "mt-2 grid grid-cols-3 gap-1 text-[11px] text-[#6A7282]", children: [
                              /* @__PURE__ */ jsxs("span", { children: [
                                "Total ",
                                test.latestRun.summary.total
                              ] }),
                              /* @__PURE__ */ jsxs("span", { children: [
                                "Hard ",
                                test.latestRun.summary.hard
                              ] }),
                              /* @__PURE__ */ jsxs("span", { children: [
                                "Resolved ",
                                test.latestRun.summary.resolved
                              ] })
                            ] })
                          ]
                        },
                        test.id
                      )) }),
                      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3", children: [
                        /* @__PURE__ */ jsx("p", { className: "mb-1 text-xs font-semibold text-[#364153]", children: "New Clash Test" }),
                        /* @__PURE__ */ jsxs("label", { className: "mt-2 block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-clash-test-name`, children: [
                          "Test name ",
                          /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "*" })
                        ] }),
                        /* @__PURE__ */ jsx(
                          "input",
                          {
                            id: `${sidebarPanelId}-clash-test-name`,
                            required: true,
                            "aria-invalid": Boolean(clashTestFormErrors.name),
                            "aria-describedby": clashTestFormErrors.name ? `${sidebarPanelId}-err-name` : void 0,
                            className: cn(
                              "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
                              clashTestFormErrors.name ? "border-red-400" : "border-[#D1D5DC]"
                            ),
                            placeholder: "e.g. MEP vs Structure L01",
                            value: clashTestDraft.name,
                            onChange: (event) => patchClashTestDraft({ name: event.target.value })
                          }
                        ),
                        clashTestFormErrors.name && /* @__PURE__ */ jsx("p", { id: `${sidebarPanelId}-err-name`, className: "mt-1 text-xs text-red-600", children: clashTestFormErrors.name }),
                        /* @__PURE__ */ jsxs("label", { className: "mt-2 block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-clash-test-desc`, children: [
                          "Description ",
                          /* @__PURE__ */ jsx("span", { className: "text-[#9CA3AF]", children: "(optional)" })
                        ] }),
                        /* @__PURE__ */ jsx(
                          "textarea",
                          {
                            id: `${sidebarPanelId}-clash-test-desc`,
                            className: "mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm",
                            rows: 2,
                            placeholder: "Notes for your team",
                            value: clashTestDraft.description,
                            onChange: (event) => patchClashTestDraft({ description: event.target.value })
                          }
                        ),
                        /* @__PURE__ */ jsxs("div", { className: "mt-2 grid grid-cols-1 gap-2", children: [
                          /* @__PURE__ */ jsxs("div", { children: [
                            /* @__PURE__ */ jsxs("label", { className: "block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-set-a`, children: [
                              "Selection Set A ",
                              /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "*" })
                            ] }),
                            /* @__PURE__ */ jsxs(
                              "select",
                              {
                                id: `${sidebarPanelId}-set-a`,
                                required: true,
                                "aria-invalid": Boolean(clashTestFormErrors.setAId),
                                className: cn(
                                  "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
                                  clashTestFormErrors.setAId ? "border-red-400" : "border-[#D1D5DC]"
                                ),
                                value: clashTestDraft.setAId,
                                onChange: (event) => patchClashTestDraft({ setAId: event.target.value }),
                                children: [
                                  /* @__PURE__ */ jsx("option", { value: "", children: "Select Set A" }),
                                  workspace?.selectionSets.map((selectionSet) => /* @__PURE__ */ jsx("option", { value: selectionSet.id, children: selectionSet.name }, selectionSet.id))
                                ]
                              }
                            ),
                            clashTestFormErrors.setAId && /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-red-600", children: clashTestFormErrors.setAId })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { children: [
                            /* @__PURE__ */ jsxs("label", { className: "block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-set-b`, children: [
                              "Selection Set B ",
                              /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "*" })
                            ] }),
                            /* @__PURE__ */ jsxs(
                              "select",
                              {
                                id: `${sidebarPanelId}-set-b`,
                                required: true,
                                "aria-invalid": Boolean(clashTestFormErrors.setBId),
                                className: cn(
                                  "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
                                  clashTestFormErrors.setBId ? "border-red-400" : "border-[#D1D5DC]"
                                ),
                                value: clashTestDraft.setBId,
                                onChange: (event) => patchClashTestDraft({ setBId: event.target.value }),
                                children: [
                                  /* @__PURE__ */ jsx("option", { value: "", children: "Select Set B" }),
                                  workspace?.selectionSets.map((selectionSet) => /* @__PURE__ */ jsx("option", { value: selectionSet.id, children: selectionSet.name }, selectionSet.id))
                                ]
                              }
                            ),
                            clashTestFormErrors.setBId && /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-red-600", children: clashTestFormErrors.setBId })
                          ] })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
                          /* @__PURE__ */ jsxs("label", { className: "block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-soft-th`, children: [
                            "Soft threshold ",
                            /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "*" }),
                            /* @__PURE__ */ jsx("span", { className: "font-normal text-[#6A7282]", children: " (m)" })
                          ] }),
                          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-[#6A7282]", children: "Gap for soft clash; 0 = hard intersection only." }),
                          /* @__PURE__ */ jsx("div", { className: "mt-1.5 flex flex-wrap gap-1", children: CLASH_SOFT_THRESHOLD_PRESETS_M.map((value) => /* @__PURE__ */ jsxs(
                            "button",
                            {
                              type: "button",
                              onClick: () => patchClashTestDraft({ softThreshold: value }),
                              className: cn(
                                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                                clashTestDraft.softThreshold === value ? "border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]" : "border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F9FAFB]"
                              ),
                              children: [
                                value,
                                " m"
                              ]
                            },
                            value
                          )) }),
                          /* @__PURE__ */ jsx(
                            "input",
                            {
                              id: `${sidebarPanelId}-soft-th`,
                              type: "text",
                              inputMode: "decimal",
                              "aria-invalid": Boolean(clashTestFormErrors.softThreshold),
                              className: cn(
                                "mt-2 w-full rounded-lg border px-3 py-2 text-sm",
                                clashTestFormErrors.softThreshold ? "border-red-400" : "border-[#D1D5DC]"
                              ),
                              placeholder: "Custom value (meters)",
                              value: clashTestDraft.softThreshold,
                              onChange: (event) => patchClashTestDraft({ softThreshold: event.target.value })
                            }
                          ),
                          clashTestFormErrors.softThreshold && /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-red-600", children: clashTestFormErrors.softThreshold })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
                          /* @__PURE__ */ jsxs("label", { className: "block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-dup-tol`, children: [
                            "Duplicate tolerance ",
                            /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "*" }),
                            /* @__PURE__ */ jsx("span", { className: "font-normal text-[#6A7282]", children: " (m)" })
                          ] }),
                          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-[#6A7282]", children: "BBox match within this distance counts as duplicate." }),
                          /* @__PURE__ */ jsx("div", { className: "mt-1.5 flex flex-wrap gap-1", children: CLASH_DUPLICATE_TOLERANCE_PRESETS_M.map((value) => /* @__PURE__ */ jsxs(
                            "button",
                            {
                              type: "button",
                              onClick: () => patchClashTestDraft({ duplicateTolerance: value }),
                              className: cn(
                                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                                clashTestDraft.duplicateTolerance === value ? "border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]" : "border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#F9FAFB]"
                              ),
                              children: [
                                value,
                                " m"
                              ]
                            },
                            value
                          )) }),
                          /* @__PURE__ */ jsx(
                            "input",
                            {
                              id: `${sidebarPanelId}-dup-tol`,
                              type: "text",
                              inputMode: "decimal",
                              "aria-invalid": Boolean(clashTestFormErrors.duplicateTolerance),
                              className: cn(
                                "mt-2 w-full rounded-lg border px-3 py-2 text-sm",
                                clashTestFormErrors.duplicateTolerance ? "border-red-400" : "border-[#D1D5DC]"
                              ),
                              placeholder: "Custom value (meters)",
                              value: clashTestDraft.duplicateTolerance,
                              onChange: (event) => patchClashTestDraft({ duplicateTolerance: event.target.value })
                            }
                          ),
                          clashTestFormErrors.duplicateTolerance && /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-red-600", children: clashTestFormErrors.duplicateTolerance })
                        ] }),
                        /* @__PURE__ */ jsx(SidebarActionBanner, { banner: clashTestActionBanner }),
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            disabled: saveClashTest.isPending,
                            onClick: () => void saveClashTestDraft(),
                            className: cn(
                              "mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-white",
                              saveClashTest.isPending ? "cursor-not-allowed bg-blue-300" : "bg-[#155DFC] hover:bg-blue-700"
                            ),
                            children: saveClashTest.isPending ? "Saving…" : "Save Clash Test"
                          }
                        )
                      ] })
                    ] }),
                    sidebarTab === "select" && /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          type: "button",
                          onClick: () => setImportModalOpen(true),
                          className: "flex w-full items-center justify-center gap-2 rounded-lg border border-[#D1D5DC] bg-white py-2.5 text-sm text-[#364153] hover:bg-gray-50",
                          children: [
                            /* @__PURE__ */ jsx(Upload, { className: "size-4", "aria-hidden": true }),
                            "Import models"
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxs("section", { className: "rounded-lg border border-[#E5E7EB] bg-white p-3", children: [
                        /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                            /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-[#101828]", children: "Model Tree" }),
                            /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-xs text-[#6A7282]", children: "Viewport visibility only." })
                          ] }),
                          persistedHiddenObjects.length > 0 && /* @__PURE__ */ jsxs("span", { className: "shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900", children: [
                            persistedHiddenObjects.length,
                            " hidden"
                          ] })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "mt-3 space-y-3", children: [
                          models.length === 0 && /* @__PURE__ */ jsx("p", { className: "text-sm text-[#6A7282]", children: "No models yet — import or drop files on the viewer." }),
                          models.map((model) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-[#E5E7EB] p-2.5", children: [
                            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
                              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: model.name }),
                                /* @__PURE__ */ jsxs("p", { className: "text-xs text-[#6A7282]", children: [
                                  model.discipline,
                                  " · ",
                                  model.objectCount,
                                  " objects",
                                  model.sourceFormat === "xkt" ? " · XKT (3D viewer)" : ""
                                ] })
                              ] }),
                              /* @__PURE__ */ jsx(
                                "button",
                                {
                                  type: "button",
                                  onClick: () => setHiddenModelIds((current) => toggleArrayValue(current, model.name)),
                                  className: cn(
                                    "shrink-0 rounded-full px-2 py-1 text-xs whitespace-nowrap",
                                    hiddenModelIds.includes(model.name) ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#ECFDF3] text-[#047857]"
                                  ),
                                  children: hiddenModelIds.includes(model.name) ? "Hidden" : "Visible"
                                }
                              )
                            ] }),
                            /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: model.categories.map((category) => /* @__PURE__ */ jsx(
                              "button",
                              {
                                type: "button",
                                onClick: () => setHiddenCategories((current) => toggleArrayValue(current, category)),
                                className: cn(
                                  "rounded-full border px-2 py-0.5 text-[11px]",
                                  hiddenCategories.includes(category) ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]" : "border-[#E5E7EB] bg-white text-[#364153]"
                                ),
                                children: category
                              },
                              `${model.id}-${category}`
                            )) })
                          ] }, model.id)),
                          persistedHiddenObjects.length > 0 && /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2.5", children: [
                            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                              /* @__PURE__ */ jsx("p", { className: "text-xs font-medium uppercase tracking-[0.14em] text-[#6A7282]", children: "Persisted hidden" }),
                              /* @__PURE__ */ jsx("button", { type: "button", onClick: () => void resetHiddenObjects(), className: "text-xs font-medium text-[#155DFC]", children: "Show all" })
                            ] }),
                            /* @__PURE__ */ jsx("div", { className: "mt-2 space-y-1.5", children: persistedHiddenObjects.map((object) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5", children: [
                              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                                /* @__PURE__ */ jsx("p", { className: "truncate text-xs font-medium text-[#101828]", children: object.id }),
                                /* @__PURE__ */ jsxs("p", { className: "truncate text-[11px] text-[#6A7282]", children: [
                                  object.type,
                                  " · ",
                                  object.sourceModel
                                ] })
                              ] }),
                              /* @__PURE__ */ jsx("button", { type: "button", onClick: () => void showObjects([object.id]), className: "shrink-0 rounded border border-[#D1D5DC] px-2 py-1 text-[11px] text-[#364153]", children: "Show" })
                            ] }, object.id)) })
                          ] })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("section", { className: "rounded-lg border border-[#E5E7EB] bg-white p-3", children: [
                        /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-[#101828]", children: "Selection Sets" }),
                        /* @__PURE__ */ jsxs("div", { className: "mt-3 space-y-3", children: [
                          workspace?.selectionSets.map((selectionSet) => /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-[#E5E7EB] p-2.5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: selectionSet.name }),
                              /* @__PURE__ */ jsxs("p", { className: "text-xs text-[#6A7282]", children: [
                                selectionSet.filters.modelIds.length,
                                " models · ",
                                selectionSet.filters.categories.length,
                                " categories · ",
                                selectionSet.manualIncludeIds.length,
                                " manual"
                              ] })
                            ] }),
                            /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setPendingDeleteSetId(selectionSet.id), className: "shrink-0 text-xs text-[#DC2626]", children: "Delete" })
                          ] }) }, selectionSet.id)),
                          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3", children: [
                            /* @__PURE__ */ jsx("p", { className: "mb-1 text-xs font-semibold text-[#364153]", children: "New Selection Set" }),
                            /* @__PURE__ */ jsx("datalist", { id: objectIdDatalistId, children: objectIdDatalistOptions.map((id) => /* @__PURE__ */ jsx("option", { value: id }, id)) }),
                            /* @__PURE__ */ jsxs("label", { className: "mt-2 block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-ss-name`, children: [
                              "Name ",
                              /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "*" })
                            ] }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                id: `${sidebarPanelId}-ss-name`,
                                className: cn(
                                  "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
                                  selectionSetFormErrors.name ? "border-red-400" : "border-[#D1D5DC]"
                                ),
                                placeholder: "e.g. MEP ducts — Level 2",
                                "aria-invalid": Boolean(selectionSetFormErrors.name),
                                value: selectionSetDraft.name,
                                onChange: (event) => patchSelectionSetDraft({ name: event.target.value })
                              }
                            ),
                            selectionSetFormErrors.name && /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-red-600", children: selectionSetFormErrors.name }),
                            /* @__PURE__ */ jsx("label", { className: "mt-2 block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-ss-desc`, children: "Description" }),
                            /* @__PURE__ */ jsx(
                              "textarea",
                              {
                                id: `${sidebarPanelId}-ss-desc`,
                                className: "mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm",
                                rows: 2,
                                placeholder: "Optional notes for your team",
                                value: selectionSetDraft.description,
                                onChange: (event) => patchSelectionSetDraft({ description: event.target.value })
                              }
                            ),
                            /* @__PURE__ */ jsxs("div", { className: "mt-3 space-y-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2.5", children: [
                              /* @__PURE__ */ jsxs("p", { className: "text-[11px] leading-snug text-[#6A7282]", children: [
                                /* @__PURE__ */ jsx("span", { className: "font-medium text-[#364153]", children: "Scope" }),
                                " — pick models, categories, and/or types (tap to toggle). Or type object IDs under Manual include. At least one scope rule is required."
                              ] }),
                              /* @__PURE__ */ jsxs("div", { children: [
                                /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [
                                  /* @__PURE__ */ jsx("span", { className: "text-xs font-medium text-[#364153]", children: "Models" }),
                                  selectionSetDraft.modelIds.length > 0 && /* @__PURE__ */ jsxs(
                                    "button",
                                    {
                                      type: "button",
                                      className: "text-[11px] font-medium text-[#155DFC]",
                                      onClick: () => patchSelectionSetDraft({ modelIds: [], categories: [], types: [] }),
                                      children: [
                                        "Clear (",
                                        selectionSetDraft.modelIds.length,
                                        ")"
                                      ]
                                    }
                                  )
                                ] }),
                                /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-[#6A7282]", children: "Include every object from these federated models." }),
                                /* @__PURE__ */ jsx(
                                  SelectionSetChipPicker,
                                  {
                                    options: models.map((model) => ({ value: model.id, label: model.name })),
                                    selected: selectionSetDraft.modelIds,
                                    onToggle: (value) => toggleSelectionSetDraftArray("modelIds", value),
                                    emptyMessage: "Import models above, then pick one or more here.",
                                    "aria-invalid": Boolean(selectionSetFormErrors.scope)
                                  }
                                )
                              ] }),
                              /* @__PURE__ */ jsxs("div", { children: [
                                /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [
                                  /* @__PURE__ */ jsx("span", { className: "text-xs font-medium text-[#364153]", children: "Categories" }),
                                  selectionSetDraft.categories.length > 0 && /* @__PURE__ */ jsxs(
                                    "button",
                                    {
                                      type: "button",
                                      className: "text-[11px] font-medium text-[#155DFC]",
                                      onClick: () => patchSelectionSetDraft({ categories: [], types: [] }),
                                      children: [
                                        "Clear (",
                                        selectionSetDraft.categories.length,
                                        ")"
                                      ]
                                    }
                                  )
                                ] }),
                                /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-[#6A7282]", children: "Narrows to IFC / discipline categories (within your model scope)." }),
                                selectionSetDraft.modelIds.length === 0 ? /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[#6A7282]", children: "Select at least one model first to load categories." }) : /* @__PURE__ */ jsx(
                                  SelectionSetChipPicker,
                                  {
                                    options: scopedCategories.map((category) => ({ value: category, label: category })),
                                    selected: selectionSetDraft.categories,
                                    onToggle: (value) => toggleSelectionSetDraftArray("categories", value),
                                    emptyMessage: "No categories available in the selected model scope.",
                                    "aria-invalid": Boolean(selectionSetFormErrors.scope)
                                  }
                                )
                              ] }),
                              /* @__PURE__ */ jsxs("div", { children: [
                                /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [
                                  /* @__PURE__ */ jsx("span", { className: "text-xs font-medium text-[#364153]", children: "Types" }),
                                  selectionSetDraft.types.length > 0 && /* @__PURE__ */ jsxs(
                                    "button",
                                    {
                                      type: "button",
                                      className: "text-[11px] font-medium text-[#155DFC]",
                                      onClick: () => patchSelectionSetDraft({ types: [] }),
                                      children: [
                                        "Clear (",
                                        selectionSetDraft.types.length,
                                        ")"
                                      ]
                                    }
                                  )
                                ] }),
                                /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-[#6A7282]", children: "Filter by element type (e.g. Wall, Duct)." }),
                                selectionSetDraft.categories.length === 0 ? /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[#6A7282]", children: "Select at least one category first to load types." }) : /* @__PURE__ */ jsx(
                                  SelectionSetChipPicker,
                                  {
                                    options: scopedTypes.map((type) => ({ value: type, label: type })),
                                    selected: selectionSetDraft.types,
                                    onToggle: (value) => toggleSelectionSetDraftArray("types", value),
                                    emptyMessage: "No types available for the selected model/category scope.",
                                    "aria-invalid": Boolean(selectionSetFormErrors.scope)
                                  }
                                )
                              ] }),
                              selectionSetFormErrors.scope && /* @__PURE__ */ jsx("p", { className: "text-xs text-red-600", children: selectionSetFormErrors.scope })
                            ] }),
                            /* @__PURE__ */ jsx("label", { className: "mt-3 block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-ss-include`, children: "Manual include IDs" }),
                            /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-[#6A7282]", children: "Comma, semicolon, or new line. Use suggestions below or type to match loaded objects (first 200 in autocomplete)." }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                id: `${sidebarPanelId}-ss-include`,
                                className: "mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 font-mono text-xs",
                                placeholder: "e.g. obj-101, obj-202",
                                list: objectIdDatalistId,
                                value: selectionSetDraft.manualIncludeIds,
                                onChange: (event) => patchSelectionSetDraft({ manualIncludeIds: event.target.value })
                              }
                            ),
                            /* @__PURE__ */ jsx(
                              ManualIdSuggestions,
                              {
                                label: "Suggestions — add to include",
                                ids: suggestedManualObjectIds,
                                onPick: appendManualIncludeId
                              }
                            ),
                            /* @__PURE__ */ jsx("label", { className: "mt-2 block text-xs font-medium text-[#364153]", htmlFor: `${sidebarPanelId}-ss-exclude`, children: "Manual exclude IDs" }),
                            /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-[#6A7282]", children: "Removes specific objects after filters apply. Same separators as include." }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                id: `${sidebarPanelId}-ss-exclude`,
                                className: "mt-1 w-full rounded-lg border border-[#D1D5DC] px-3 py-2 font-mono text-xs",
                                placeholder: "IDs to force out of this set",
                                list: objectIdDatalistId,
                                value: selectionSetDraft.manualExcludeIds,
                                onChange: (event) => patchSelectionSetDraft({ manualExcludeIds: event.target.value })
                              }
                            ),
                            /* @__PURE__ */ jsx(
                              ManualIdSuggestions,
                              {
                                label: "Suggestions — add to exclude",
                                ids: suggestedManualObjectIds,
                                onPick: appendManualExcludeId
                              }
                            ),
                            /* @__PURE__ */ jsx(SidebarActionBanner, { banner: selectionSetActionBanner }),
                            /* @__PURE__ */ jsx(
                              "button",
                              {
                                type: "button",
                                disabled: saveSelectionSet.isPending,
                                onClick: () => void saveSelectionSetDraft(),
                                className: cn(
                                  "mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-white",
                                  saveSelectionSet.isPending ? "cursor-not-allowed bg-blue-300" : "bg-[#155DFC] hover:bg-blue-700"
                                ),
                                children: saveSelectionSet.isPending ? "Saving…" : "Save Selection Set"
                              }
                            )
                          ] })
                        ] })
                      ] })
                    ] }),
                    sidebarTab === "results" && /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
                      runPayload?.run && /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-[#6A7282]", children: [
                        "Scope: ",
                        runPayload.run.scope
                      ] }),
                      /* @__PURE__ */ jsx("input", { className: "w-full rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm", placeholder: "Search clash results…", value: search, onChange: (event) => setSearch(event.target.value) }),
                      shouldHighlightActiveScope && !viewerClash && /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => setHideUnrelatedToActiveTest((current) => !current),
                          className: cn(
                            "w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            hideUnrelatedToActiveTest ? "border-[#155DFC] bg-[#EFF6FF] text-[#155DFC]" : "border-[#D1D5DC] bg-white text-[#364153] hover:bg-gray-50"
                          ),
                          children: hideUnrelatedToActiveTest ? "Show all objects" : "Focus on test sets (A/B)"
                        }
                      ),
                      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: ["all", "new", "reviewed", "resolved"].map((filter) => /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => setStatusFilter(filter),
                          className: cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                            statusFilter === filter ? "border-[#155DFC] bg-[#155DFC] text-white shadow-sm shadow-blue-500/25" : "border-[#D1D5DC] bg-white text-[#6A7282] hover:border-[#9CA3AF] hover:text-[#374151]"
                          ),
                          children: filter.charAt(0).toUpperCase() + filter.slice(1)
                        },
                        filter
                      )) }),
                      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                        filteredResults.map((result) => /* @__PURE__ */ jsxs(
                          "button",
                          {
                            type: "button",
                            onClick: () => {
                              setSelectedClashId(result.clashId);
                              setShowClashInMainViewer(true);
                            },
                            className: cn(
                              "group relative w-full rounded-xl border p-3.5 text-left transition-all duration-150",
                              selectedClashId === result.clashId ? "border-[#155DFC] bg-[#EFF6FF] shadow-md shadow-blue-500/10" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF] hover:shadow-md hover:shadow-gray-200/60"
                            ),
                            children: [
                              /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                                  /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: result.title }),
                                  /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [
                                    /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] text-[#6A7282]", children: [
                                      /* @__PURE__ */ jsx("svg", { className: "size-3.5 text-[#9CA3AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }),
                                      result.type
                                    ] }),
                                    /* @__PURE__ */ jsx("span", { className: "text-[#E5E7EB]", children: "·" }),
                                    /* @__PURE__ */ jsx("span", { className: "text-[11px] text-[#6A7282]", children: result.objectAModel }),
                                    /* @__PURE__ */ jsx("span", { className: "text-[#E5E7EB]", children: "·" }),
                                    /* @__PURE__ */ jsx("span", { className: "text-[11px] text-[#6A7282]", children: result.objectBModel })
                                  ] })
                                ] }),
                                /* @__PURE__ */ jsx("div", { className: "shrink-0", children: /* @__PURE__ */ jsx("span", { className: cn(
                                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                  result.status === "resolved" ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60" : result.status === "reviewed" ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200/60" : "bg-blue-50 text-blue-600 ring-1 ring-blue-200/60"
                                ), children: result.status }) })
                              ] }),
                              /* @__PURE__ */ jsx("div", { className: cn(
                                "absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full transition-all duration-150",
                                selectedClashId === result.clashId ? "bg-[#155DFC]" : "bg-transparent group-hover:bg-[#D1D5DC]"
                              ) })
                            ]
                          },
                          result.clashId
                        )),
                        !resultsQuery.isLoading && filteredResults.length === 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DC] bg-[#F9FAFB] p-6 text-center", children: [
                          /* @__PURE__ */ jsx("div", { className: "mb-3 flex size-12 items-center justify-center rounded-full bg-[#F3F4F6]", children: /* @__PURE__ */ jsx("svg", { className: "size-6 text-[#9CA3AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
                          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#374151]", children: "No clash results" }),
                          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[#6A7282]", children: "Try adjusting your filters or run a new test." }),
                          persistedHiddenObjects.length > 0 && /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-amber-600", children: "Hidden objects may be affecting results." })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "border-t border-[#E5E7EB] pt-5", children: [
                        /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center gap-2", children: [
                          /* @__PURE__ */ jsx("div", { className: "flex size-8 items-center justify-center rounded-lg bg-[#F3F4F6]", children: /* @__PURE__ */ jsx("svg", { className: "size-4 text-[#6A7282]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }) }),
                          /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-[#101828]", children: "Inspector" })
                        ] }),
                        !selectedResult && /* @__PURE__ */ jsx("div", { className: "flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DC] bg-[#F9FAFB] p-5 text-center", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-[#6A7282]", children: "Select a clash to inspect" }) }),
                        selectedResult && /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
                          /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-[#E5E7EB] bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] p-4", children: [
                            /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                              /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: selectedResult.title }),
                                /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#6A7282]", children: [
                                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-blue-600", children: [
                                    /* @__PURE__ */ jsx("svg", { className: "size-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }),
                                    selectedResult.type
                                  ] }),
                                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-0.5", children: [
                                    /* @__PURE__ */ jsx("svg", { className: "size-3 text-[#9CA3AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" }) }),
                                    selectedResult.distance.toFixed(2),
                                    " m"
                                  ] })
                                ] })
                              ] }),
                              /* @__PURE__ */ jsx("span", { className: cn(
                                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                selectedResult.status === "resolved" ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60" : selectedResult.status === "reviewed" ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200/60" : "bg-blue-50 text-blue-600 ring-1 ring-blue-200/60"
                              ), children: selectedResult.status })
                            ] }),
                            /* @__PURE__ */ jsx("p", { className: "mt-3 text-[11px] leading-relaxed text-[#6A7282]", children: (() => {
                              if (selectedResult.status === "resolved") return "Resolved.";
                              if (selectedResult.status === "reviewed") {
                                return "Reviewed — opened in the inspector or details were saved.";
                              }
                              if (selectedResult.status === "new" && runPayload?.run && selectedResult.runId === runPayload.run.id) {
                                return "New — from the latest test run. Becomes Reviewed shortly after you open it here.";
                              }
                              if (selectedResult.status === "new") return "New — pending review.";
                              return "";
                            })() })
                          ] }),
                          (() => {
                            const aHidden = Boolean(allObjects.find((o) => o.id === selectedResult.objectA)?.hidden);
                            const bHidden = Boolean(allObjects.find((o) => o.id === selectedResult.objectB)?.hidden);
                            return /* @__PURE__ */ jsxs("div", { className: "grid gap-3", children: [
                              /* @__PURE__ */ jsx("div", { className: cn(
                                "group relative rounded-xl border p-4 transition-all duration-150",
                                aHidden ? "border-amber-200 bg-amber-50/50" : "border-[#E5E7EB] hover:border-[#9CA3AF]"
                              ), children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                                    /* @__PURE__ */ jsx("span", { className: "inline-flex size-5 items-center justify-center rounded-md bg-blue-500 text-[10px] font-bold text-white", children: "A" }),
                                    /* @__PURE__ */ jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-[#6A7282]", children: "Object A" })
                                  ] }),
                                  /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-sm font-medium text-[#101828]", children: selectedResult.objectA }),
                                  /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-xs text-[#6A7282]", children: [
                                    selectedResult.objectAType,
                                    " · ",
                                    selectedResult.objectAModel
                                  ] })
                                ] }),
                                /* @__PURE__ */ jsx(
                                  "button",
                                  {
                                    type: "button",
                                    onClick: () => void (aHidden ? showObjects([selectedResult.objectA]) : hideObject(selectedResult.objectA)),
                                    className: cn(
                                      "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                      aHidden ? "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200" : "border-[#D1D5DC] bg-white text-[#6A7282] hover:border-[#9CA3AF] hover:text-[#374151]"
                                    ),
                                    children: aHidden ? "👁 Show" : "🙈 Hide"
                                  }
                                )
                              ] }) }),
                              /* @__PURE__ */ jsx("div", { className: cn(
                                "group relative rounded-xl border p-4 transition-all duration-150",
                                bHidden ? "border-amber-200 bg-amber-50/50" : "border-[#E5E7EB] hover:border-[#9CA3AF]"
                              ), children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                                    /* @__PURE__ */ jsx("span", { className: "inline-flex size-5 items-center justify-center rounded-md bg-rose-500 text-[10px] font-bold text-white", children: "B" }),
                                    /* @__PURE__ */ jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-[#6A7282]", children: "Object B" })
                                  ] }),
                                  /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-sm font-medium text-[#101828]", children: selectedResult.objectB }),
                                  /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-xs text-[#6A7282]", children: [
                                    selectedResult.objectBType,
                                    " · ",
                                    selectedResult.objectBModel
                                  ] })
                                ] }),
                                /* @__PURE__ */ jsx(
                                  "button",
                                  {
                                    type: "button",
                                    onClick: () => void (bHidden ? showObjects([selectedResult.objectB]) : hideObject(selectedResult.objectB)),
                                    className: cn(
                                      "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                      bHidden ? "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200" : "border-[#D1D5DC] bg-white text-[#6A7282] hover:border-[#9CA3AF] hover:text-[#374151]"
                                    ),
                                    children: bHidden ? "👁 Show" : "🙈 Hide"
                                  }
                                )
                              ] }) })
                            ] });
                          })(),
                          /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-[#E5E7EB] bg-white p-4", children: [
                            /* @__PURE__ */ jsxs("label", { className: "mb-2 flex items-center gap-2 text-xs font-medium text-[#6A7282]", children: [
                              /* @__PURE__ */ jsx("svg", { className: "size-4 text-[#9CA3AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" }) }),
                              "Coordination note"
                            ] }),
                            /* @__PURE__ */ jsx(
                              "textarea",
                              {
                                rows: 3,
                                className: "w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none transition-colors focus:border-[#155DFC] focus:ring-2 focus:ring-blue-500/10",
                                placeholder: "Add coordination notes...",
                                value: noteDraft,
                                maxLength: INSPECTOR_NOTE_MAX_LEN,
                                onChange: (event) => {
                                  clearInspectorActionBanner();
                                  setNoteDraft(event.target.value);
                                }
                              }
                            ),
                            /* @__PURE__ */ jsxs("p", { className: "mt-1 text-right text-[10px] text-[#9CA3AF]", children: [
                              noteDraft.length,
                              "/",
                              INSPECTOR_NOTE_MAX_LEN
                            ] })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-[#E5E7EB] bg-white p-4", children: [
                            /* @__PURE__ */ jsxs("label", { className: "mb-2 flex items-center gap-2 text-xs font-medium text-[#6A7282]", children: [
                              /* @__PURE__ */ jsx("svg", { className: "size-4 text-[#9CA3AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
                              "Assignee"
                            ] }),
                            /* @__PURE__ */ jsxs(
                              "select",
                              {
                                className: "w-full cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#155DFC] focus:ring-2 focus:ring-blue-500/10",
                                value: assigneeDraft,
                                onChange: (event) => {
                                  clearInspectorActionBanner();
                                  setAssigneeDraft(event.target.value);
                                },
                                children: [
                                  /* @__PURE__ */ jsx("option", { value: "Unassigned", children: "Unassigned" }),
                                  !assigneeKnownOption && assigneeDraft !== "Unassigned" && /* @__PURE__ */ jsxs("option", { value: assigneeDraft, children: [
                                    assigneeDraft,
                                    " (stored value)"
                                  ] }),
                                  projectMembers.map((member) => {
                                    const label = memberLabel(member);
                                    return /* @__PURE__ */ jsxs("option", { value: label, children: [
                                      label,
                                      member.role ? ` · ${member.role}` : ""
                                    ] }, member.userId);
                                  })
                                ]
                              }
                            ),
                            projectMembersLoading && /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] text-[#6A7282]", children: "Loading project members…" }),
                            !projectMembersLoading && projectMembers.length === 0 && /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] text-[#6A7282]", children: "No members returned for this project; you can still use Unassigned or a stored assignee." })
                          ] }),
                          /* @__PURE__ */ jsx(SidebarActionBanner, { banner: inspectorActionBanner }),
                          /* @__PURE__ */ jsxs(
                            "button",
                            {
                              type: "button",
                              onClick: () => void saveClashInspectorDetails(),
                              disabled: updateClashStatus.isPending,
                              className: cn(
                                "flex w-full items-center justify-center gap-2 rounded-xl border border-[#155DFC] px-4 py-3 text-sm font-semibold text-[#155DFC] transition-all duration-150 hover:bg-[#EFF6FF] active:scale-[0.98]",
                                updateClashStatus.isPending && "cursor-wait opacity-70"
                              ),
                              children: [
                                /* @__PURE__ */ jsx("svg", { className: "size-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" }) }),
                                updateClashStatus.isPending ? "Saving…" : "Save note and assignee"
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsxs(
                            "button",
                            {
                              type: "button",
                              onClick: () => setResolveDialogOpen(true),
                              disabled: selectedResult.status === "resolved",
                              className: cn(
                                "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#009966] to-[#059669] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition-all duration-150 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98]",
                                selectedResult.status === "resolved" && "cursor-not-allowed bg-emerald-300 hover:bg-emerald-300 hover:shadow-none"
                              ),
                              children: [
                                /* @__PURE__ */ jsx("svg", { className: "size-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
                                selectedResult.status === "resolved" ? "✓ Resolved" : "Mark as resolved"
                              ]
                            }
                          )
                        ] })
                      ] })
                    ] }),
                    sidebarTab === "report" && /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
                      /* @__PURE__ */ jsx("p", { className: "text-xs text-[#6A7282]", children: "Export clash data or the federated model snapshot." }),
                      /* @__PURE__ */ jsx(SidebarActionBanner, { banner: exportActionBanner }),
                      /* @__PURE__ */ jsx("div", { className: "space-y-2", children: [
                        { format: "json", label: "JSON Report", desc: "Clash results as structured JSON", icon: "{ }" },
                        { format: "csv", label: "CSV Spreadsheet", desc: "Open in Excel or Google Sheets", icon: "⊟" },
                        { format: "bcf", label: "BCF File", desc: "BIM Collaboration Format", icon: "⊕" },
                        { format: "model", label: "Federated Model", desc: "Full model snapshot (JSON)", icon: "⬡" }
                      ].map(({ format, label, desc, icon }) => /* @__PURE__ */ jsxs(
                        "button",
                        {
                          type: "button",
                          onClick: () => void exportCurrent(format),
                          className: "flex w-full items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 text-left hover:border-[#155DFC] hover:bg-[#F8FAFF] transition-colors group",
                          children: [
                            /* @__PURE__ */ jsx("span", { className: "flex size-8 shrink-0 items-center justify-center rounded-md bg-[#F3F4F6] text-sm font-medium text-[#4A5565] group-hover:bg-[#EFF6FF] group-hover:text-[#155DFC]", children: icon }),
                            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: label }),
                              /* @__PURE__ */ jsx("p", { className: "text-xs text-[#6A7282]", children: desc })
                            ] }),
                            /* @__PURE__ */ jsx("svg", { className: "ml-auto size-4 shrink-0 text-[#D1D5DC] group-hover:text-[#155DFC]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" }) })
                          ]
                        },
                        format
                      )) })
                    ] })
                  ] })
                ] })
              }
            ),
            /* @__PURE__ */ jsxs(
              "main",
              {
                className: "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white",
                onDragOver: handleStageDragOver,
                onDragLeave: handleStageDragLeave,
                onDrop: handleStageDrop,
                children: [
                  models.length > 0 && /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2 md:left-4 md:right-4", children: [
                    /* @__PURE__ */ jsxs("div", { className: "pointer-events-auto max-w-[min(100%,20rem)] rounded-lg border border-[#E5E7EB] bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm", children: [
                      /* @__PURE__ */ jsx("p", { className: "truncate text-xs font-medium text-[#101828]", children: selectedTest?.name || "No test" }),
                      /* @__PURE__ */ jsx("p", { className: "text-[11px] text-[#6A7282]", children: runPayload?.run ? `${new Date(runPayload.run.completedAt).toLocaleString()} · ${runPayload.run.summary.total} clashes` : "Run a test from the sidebar." })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "pointer-events-auto flex items-center gap-2", children: [
                      viewerClash && /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            setSelectedClashId(null);
                            setShowClashInMainViewer(false);
                          },
                          className: "flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white/95 px-3 py-1.5 text-xs font-medium text-[#364153] shadow-sm backdrop-blur-sm hover:bg-gray-50",
                          children: "← View all objects"
                        }
                      ),
                      /* @__PURE__ */ jsxs("div", { className: "flex rounded-lg border border-[#E5E7EB] bg-white/95 p-0.5 shadow-sm backdrop-blur-sm", children: [
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => setPlaneView("2d"),
                            className: cn("rounded-md px-3 py-1.5 text-xs font-medium", planeView === "2d" ? "bg-[#155DFC] text-white" : "text-[#4A5565] hover:bg-[#F3F4F6]"),
                            children: "2D"
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => setPlaneView("3d"),
                            className: cn("rounded-md px-3 py-1.5 text-xs font-medium", planeView === "3d" ? "bg-[#155DFC] text-white" : "text-[#4A5565] hover:bg-[#F3F4F6]"),
                            children: "3D"
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxs(Tooltip, { children: [
                        /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true }),
                        /* @__PURE__ */ jsx(TooltipContent, { side: "left", children: "Open sidebar" })
                      ] })
                    ] })
                  ] }),
                  models.length === 0 && /* @__PURE__ */ jsxs("div", { className: cn(
                    "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#F9FAFB] p-6 text-center transition-colors",
                    dragActive && "bg-[#EFF6FF]"
                  ), children: [
                    /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: "No models imported yet" }),
                    /* @__PURE__ */ jsx("p", { className: "max-w-sm text-xs text-[#6A7282]", children: "Import IFC files from this project's Documents to start detecting clashes." }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => setImportModalOpen(true),
                        className: "rounded-lg bg-[#155DFC] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700",
                        children: "Import from Documents"
                      }
                    )
                  ] }),
                  dragActive && models.length > 0 && /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-[#155DFC]/10", children: /* @__PURE__ */ jsx("p", { className: "rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#155DFC] shadow-md", children: "Drop to import" }) }),
                  zeroClashesAfterRun && models.length > 0 && /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "pointer-events-none absolute left-3 right-3 top-[4.25rem] z-[11] md:left-4 md:right-4 md:top-[4.5rem]",
                      role: "status",
                      children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-2xl rounded-lg border border-amber-200/90 bg-amber-50/95 px-3 py-2 text-center shadow-sm backdrop-blur-sm", children: [
                        /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-amber-950", children: "Test completed — no clashes detected (0 clashes)." }),
                        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-amber-900/90", children: "The viewer shows a model overview; no pairs are marked as intersecting." }),
                        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-amber-900/90", children: "Note: overview uses simplified preview solids, so visual overlap may appear without qualifying as a clash by test rules." })
                      ] })
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "flex min-h-0 flex-1 flex-col pt-14 md:pt-16", children: planeView === "2d" ? /* @__PURE__ */ jsx("div", { className: "flex min-h-0 flex-1 flex-col bg-[#F9FAFB] p-1.5 md:p-2", children: /* @__PURE__ */ jsx("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#D1D5DC] bg-white", children: /* @__PURE__ */ jsx(
                    Viewer2D,
                    {
                      clash: viewerClash,
                      selectedObjectId,
                      onSelectObject: setSelectedObjectId,
                      hiddenObjectIds: viewerHiddenObjectIds,
                      overviewScene: overviewSceneForViewer,
                      allowObjectMove: false,
                      objectMeshPositions,
                      testScopeObjectIds: activeTestScopeObjectIds,
                      deEmphasizeUnrelated: shouldHighlightActiveScope,
                      showScopeBadge: shouldHighlightActiveScope,
                      hideUnrelatedActive: hideUnrelatedToActiveTest,
                      hasXktOnlyOverview
                    }
                  ) }) }) : /* @__PURE__ */ jsx("div", { className: "flex min-h-0 flex-1 flex-col bg-[#111827] p-1.5 md:p-2", children: /* @__PURE__ */ jsx("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-700 bg-[#111827]", children: /* @__PURE__ */ jsx(
                    Viewer3D,
                    {
                      clash: viewerClash,
                      selectedObjectId,
                      onSelectObject: setSelectedObjectId,
                      hiddenObjectIds: viewerHiddenObjectIds,
                      overviewScene: overviewSceneForViewer,
                      allowObjectMove: false,
                      testScopeObjectIds: activeTestScopeObjectIds,
                      deEmphasizeUnrelated: shouldHighlightActiveScope,
                      showScopeBadge: shouldHighlightActiveScope,
                      hideUnrelatedActive: hideUnrelatedToActiveTest,
                      projectSlug,
                      xktModels: xktModelsForViewer,
                      objectMeshPositions
                    }
                  ) }) }) })
                ]
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(AlertDialog, { open: runTestDialogOpen, onOpenChange: setRunTestDialogOpen, children: /* @__PURE__ */ jsxs(AlertDialogContent, { className: "border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md", children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsx(AlertDialogTitle, { children: "Run clash test?" }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { className: "text-[#6A7282]", children: "This will execute the selected test against the current federated model. Large models may take a few moments." })
      ] }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogCancel, { className: "border-[#D1D5DC]", children: "Cancel" }),
        /* @__PURE__ */ jsx(
          AlertDialogAction,
          {
            className: "bg-[#155DFC] text-white hover:bg-blue-700",
            onClick: () => void executeRunTest(),
            children: "Run test"
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(AlertDialog, { open: resolveDialogOpen, onOpenChange: setResolveDialogOpen, children: /* @__PURE__ */ jsxs(AlertDialogContent, { className: "border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md", children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsx(AlertDialogTitle, { children: "Mark clash as resolved?" }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { className: "text-[#6A7282]", children: "The current note and assignee will be saved with this status." })
      ] }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogCancel, { className: "border-[#D1D5DC]", children: "Cancel" }),
        /* @__PURE__ */ jsx(
          AlertDialogAction,
          {
            className: "bg-[#009966] text-white hover:bg-emerald-700",
            onClick: () => {
              setResolveDialogOpen(false);
              void markSelectedClashResolved();
            },
            children: "Mark resolved"
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(AlertDialog, { open: pendingDeleteTestId !== null, onOpenChange: (open) => !open && setPendingDeleteTestId(null), children: /* @__PURE__ */ jsxs(AlertDialogContent, { className: "border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md", children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsx(AlertDialogTitle, { children: "Delete clash test?" }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { className: "text-[#6A7282]", children: "This removes the test and its stored run history for this project. This cannot be undone." })
      ] }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogCancel, { className: "border-[#D1D5DC]", children: "Cancel" }),
        /* @__PURE__ */ jsx(AlertDialogAction, { className: "bg-[#DC2626] text-white hover:bg-red-700", onClick: () => void confirmDeleteClashTest(), children: "Delete" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(AlertDialog, { open: pendingDeleteSetId !== null, onOpenChange: (open) => !open && setPendingDeleteSetId(null), children: /* @__PURE__ */ jsxs(AlertDialogContent, { className: "border-[#E5E7EB] bg-white text-[#101828] sm:max-w-md", children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsx(AlertDialogTitle, { children: "Delete selection set?" }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { className: "text-[#6A7282]", children: "Clash tests that reference this set may need to be updated. This cannot be undone." })
      ] }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogCancel, { className: "border-[#D1D5DC]", children: "Cancel" }),
        /* @__PURE__ */ jsx(AlertDialogAction, { className: "bg-[#DC2626] text-white hover:bg-red-700", onClick: () => void confirmDeleteSelectionSet(), children: "Delete" })
      ] })
    ] }) }),
    importModalOpen && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-[#E5E7EB] bg-white shadow-xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-[#101828]", children: "Import IFC from Documents" }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-xs text-[#6A7282]", children: "Select IFC files uploaded to this project" })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setImportModalOpen(false), className: "rounded-md p-1 text-[#6A7282] hover:bg-gray-100", children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto px-5 py-3", children: [
        ifcDocumentsQuery.isLoading && /* @__PURE__ */ jsx("p", { className: "py-8 text-center text-sm text-[#6A7282]", children: "Loading IFC files…" }),
        ifcDocumentsQuery.isError && /* @__PURE__ */ jsx("p", { className: "py-8 text-center text-sm text-red-500", children: "Failed to load documents." }),
        ifcDocumentsQuery.data && ifcDocumentsQuery.data.length === 0 && /* @__PURE__ */ jsxs("p", { className: "py-8 text-center text-sm text-[#6A7282]", children: [
          "No IFC files found in this project's documents.",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("span", { className: "text-xs", children: "Upload IFC files via the Documents tab first." })
        ] }),
        ifcDocumentsQuery.data && ifcDocumentsQuery.data.length > 0 && /* @__PURE__ */ jsx("div", { className: "space-y-1.5", children: ifcDocumentsQuery.data.map((doc) => {
          const checked = selectedDocIds.has(doc.publicId);
          const sizeKb = Math.round(doc.size / 1024);
          return /* @__PURE__ */ jsxs(
            "label",
            {
              className: cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                checked ? "border-[#155DFC] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:bg-gray-50"
              ),
              children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    className: "mt-0.5 h-4 w-4 accent-[#155DFC]",
                    checked,
                    onChange: () => {
                      setSelectedDocIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(doc.publicId)) next.delete(doc.publicId);
                        else next.add(doc.publicId);
                        return next;
                      });
                    }
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-medium text-[#101828]", children: doc.originalName }),
                  /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-xs text-[#6A7282]", children: [
                    doc.folderPath || "Root",
                    " · ",
                    sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`
                  ] })
                ] })
              ]
            },
            doc.publicId
          );
        }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs text-[#6A7282]", children: selectedDocIds.size > 0 ? `${selectedDocIds.size} file${selectedDocIds.size > 1 ? "s" : ""} selected` : "No files selected" }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setImportModalOpen(false), className: "rounded-lg border border-[#D1D5DC] px-4 py-2 text-sm text-[#364153] hover:bg-gray-50", children: "Cancel" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              disabled: selectedDocIds.size === 0 || importFromDocuments.isPending,
              onClick: async () => {
                try {
                  setError(null);
                  const result = await importFromDocuments.mutateAsync({ documentIds: Array.from(selectedDocIds) });
                  setImportModalOpen(false);
                  setSidebarOpen(true);
                  setSidebarTab("select");
                  const skipped = result?.skippedFiles ?? [];
                  const imported = selectedDocIds.size - skipped.length;
                  if (skipped.length > 0) {
                    toast.warning(`Imported ${imported} file${imported !== 1 ? "s" : ""}. Skipped ${skipped.length} (too large or corrupt): ${skipped.join(", ")}`);
                  } else {
                    toast.success(`Imported ${imported} file${imported !== 1 ? "s" : ""}.`);
                  }
                } catch (importErr) {
                  const msg = importErr instanceof Error ? importErr.message : "Failed to import";
                  setError(msg);
                  toast.error(msg);
                }
              },
              className: "rounded-lg bg-[#155DFC] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50",
              children: importFromDocuments.isPending ? "Importing…" : "Import Selected"
            }
          )
        ] })
      ] })
    ] }) })
  ] });
}

const statusConfig = {
  new: { label: "New", bg: "bg-[#FFF1F2]", color: "text-[#C70036]" },
  reviewed: { label: "In Review", bg: "bg-[#FEF3C7]", color: "text-[#B45309]" },
  resolved: { label: "Resolved", bg: "bg-[#D1FAE5]", color: "text-[#059669]" }
};
const typeConfig = {
  HARD: { label: "Hard Clash", severityLabel: "HIGH", severityBg: "bg-[#FEF2F2]", severityColor: "text-[#DC2626]" },
  SOFT: { label: "Soft Clash", severityLabel: "MEDIUM", severityBg: "bg-[#FFF7ED]", severityColor: "text-[#C2410C]" },
  DUPLICATE: { label: "Duplicate", severityLabel: "LOW", severityBg: "bg-[#F0FDF4]", severityColor: "text-[#16A34A]" }
};
const iconColors = {
  new: "text-[#C70036] bg-[#FFF1F2]",
  reviewed: "text-[#F59E0B] bg-[#FEF3C7]",
  resolved: "text-[#10B981] bg-[#D1FAE5]"
};
function ClashOverview({
  projectPublicId,
  onRunDetection
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["clashes-overview", projectPublicId],
    queryFn: async () => {
      const res = await apiFetch(apiUrl(`/projects/${encodeURIComponent(projectPublicId)}/navisworks/clashes`));
      if (!res.ok) throw new Error(`Failed to load clashes (${res.status})`);
      return res.json();
    },
    staleTime: 3e4
  });
  const clashes = data?.clashes ?? [];
  const summary = data?.summary;
  const filtered = clashes.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.testName.toLowerCase().includes(searchQuery.toLowerCase()) || c.assignee.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterType === "hard") return matchesSearch && c.type === "HARD";
    if (filterType === "soft") return matchesSearch && (c.type === "SOFT" || c.type === "DUPLICATE");
    return matchesSearch;
  });
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Clash Detection" }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onRunDetection,
          className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm font-normal text-white hover:bg-blue-700 transition-colors",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" }) }),
            "Run Detection"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-4 gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs text-[#4A5565]", children: "Total Clashes" }),
        /* @__PURE__ */ jsx("span", { className: "text-2xl font-normal text-[#101828]", children: isLoading ? "—" : summary?.total ?? 0 })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs text-[#4A5565]", children: "Hard Clashes" }),
        /* @__PURE__ */ jsx("span", { className: "text-2xl font-normal text-[#EC003F]", children: isLoading ? "—" : summary?.hard ?? 0 })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs text-[#4A5565]", children: "In Review" }),
        /* @__PURE__ */ jsx("span", { className: "text-2xl font-normal text-[#4F39F6]", children: isLoading ? "—" : summary?.reviewed ?? 0 })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs text-[#4A5565]", children: "Resolved" }),
        /* @__PURE__ */ jsx("span", { className: "text-2xl font-normal text-[#009966]", children: isLoading ? "—" : summary?.resolved ?? 0 })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative w-[448px]", children: [
        /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Search clashes...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2 pl-10 pr-4 text-sm text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: ["all", "hard", "soft"].map((f) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setFilterType(f),
          className: cn(
            "rounded-[10px] px-3 py-2 text-xs font-normal transition-colors capitalize",
            filterType === f ? "bg-[#F0F9FF] text-[#0069A8]" : "border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
          ),
          children: f === "all" ? "All" : f === "hard" ? "Hard" : "Soft"
        },
        f
      )) }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => refetch(),
          className: "ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#364153] hover:bg-gray-50 transition-colors",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" }) }),
            "Refresh"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white", children: [
      isLoading && /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-16 text-sm text-[#6A7282]", children: "Loading clashes…" }),
      isError && /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-16 text-sm text-[#DC2626]", children: "Failed to load clashes. Make sure models are imported and a test has been run." }),
      !isLoading && !isError && filtered.length === 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-3 py-16 text-center", children: [
        /* @__PURE__ */ jsx("svg", { className: "h-10 w-10 text-[#D1D5DC]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" }) }),
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: "No clashes found" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-[#6A7282]", children: clashes.length === 0 ? "Import models and run a clash test to see results here." : "No clashes match the current filter." }),
        clashes.length === 0 && /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onRunDetection,
            className: "mt-1 inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors",
            children: "Run Detection"
          }
        )
      ] }),
      !isLoading && !isError && filtered.map((clash, index) => {
        const st = statusConfig[clash.status] ?? statusConfig.new;
        const tc = typeConfig[clash.type] ?? typeConfig.HARD;
        const ic = iconColors[clash.status] ?? iconColors.new;
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn("flex gap-4 p-6", index !== filtered.length - 1 && "border-b border-[#E5E7EB]"),
            children: [
              /* @__PURE__ */ jsx("div", { className: cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]", ic), children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" }) }) }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-1 flex-col gap-2", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-mono text-xs text-[#6A7282]", children: clash.clashId.slice(0, 8) }),
                  /* @__PURE__ */ jsx("span", { className: cn("rounded px-2 py-0.5 text-xs", st.bg, st.color), children: st.label }),
                  /* @__PURE__ */ jsx("span", { className: "rounded bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#364153]", children: tc.label }),
                  /* @__PURE__ */ jsx("span", { className: cn("rounded px-2 py-0.5 text-xs", tc.severityBg, tc.severityColor), children: tc.severityLabel }),
                  /* @__PURE__ */ jsx("span", { className: "rounded bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1D4ED8]", children: clash.testName })
                ] }),
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-normal text-[#101828]", children: clash.title }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Models:" }),
                  /* @__PURE__ */ jsx("span", { className: "rounded bg-[#F3F4F6] px-2 py-1 text-xs text-[#364153]", children: clash.objectAModel }),
                  clash.objectBModel !== clash.objectAModel && /* @__PURE__ */ jsx("span", { className: "rounded bg-[#F3F4F6] px-2 py-1 text-xs text-[#364153]", children: clash.objectBModel })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-2", children: [
                  /* @__PURE__ */ jsxs("span", { className: "text-xs text-[#6A7282]", children: [
                    "Assigned to",
                    " ",
                    /* @__PURE__ */ jsx("span", { className: "font-medium text-[#364153]", children: clash.assignee === "Unassigned" ? "no one" : clash.assignee })
                  ] }),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: onRunDetection,
                      className: "inline-flex items-center gap-1.5 rounded-[10px] bg-[#F3F4F6] px-3 py-1.5 text-xs text-[#364153] hover:bg-gray-200 transition-colors",
                      children: [
                        /* @__PURE__ */ jsxs("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: [
                          /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" }),
                          /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
                        ] }),
                        "View 3D"
                      ]
                    }
                  )
                ] })
              ] })
            ]
          },
          clash.clashId
        );
      })
    ] })
  ] });
}
function ClashesTab({ projectPublicId, projectDisplayName }) {
  const [showWorkspace, setShowWorkspace] = useState(false);
  if (!projectPublicId.trim()) {
    return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-lg px-6 py-12 text-center", children: [
      /* @__PURE__ */ jsx("p", { className: "text-base font-semibold text-[#101828]", children: "No server project linked" }),
      /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm leading-relaxed text-[#6A7282]", children: [
        "Go to",
        " ",
        /* @__PURE__ */ jsx("a", { href: "/projects", className: "font-medium text-[#155DFC] underline-offset-2 hover:underline", children: "Projects" }),
        " ",
        "and open a project you are a member of."
      ] }),
      projectDisplayName && /* @__PURE__ */ jsxs("p", { className: "mt-4 text-xs text-[#99A1AF]", children: [
        "Viewing (demo/UI): ",
        projectDisplayName
      ] })
    ] });
  }
  if (showWorkspace) {
    return /* @__PURE__ */ jsx(
      NavisworksClashWorkspace,
      {
        projectSlug: projectPublicId,
        onBack: () => setShowWorkspace(false)
      }
    );
  }
  return /* @__PURE__ */ jsx(
    ClashOverview,
    {
      projectPublicId,
      onRunDetection: () => setShowWorkspace(true)
    }
  );
}

const permissions = [
  {
    id: "admin",
    label: "Admin",
    description: "Can manage project, members, and approve changes",
    badgeBg: "bg-[#FEF2F2]",
    badgeBorder: "border-[#FFC9C9]",
    badgeText: "text-[#C10007]"
  },
  {
    id: "member",
    label: "Member",
    description: "Can create and edit content, submit changes for review",
    badgeBg: "bg-[#F0FDF4]",
    badgeBorder: "border-[#B9F8CF]",
    badgeText: "text-[#008236]"
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "View-only access to project content",
    badgeBg: "bg-[#F9FAFB]",
    badgeBorder: "border-[#E5E7EB]",
    badgeText: "text-[#364153]"
  }
];
function AddMemberModal({
  projectId,
  projectName,
  isOpen,
  onClose,
  onSuccess,
  teams = []
}) {
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [selectedPermission, setSelectedPermission] = useState("member");
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (!isOpen) return null;
  const toggleTeam = (teamId) => {
    setSelectedTeams(
      (prev) => prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };
  const handleClose = () => {
    setEmail("");
    setJobTitle("");
    setSelectedPermission("member");
    setSelectedTeams([]);
    onClose();
  };
  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName: projectName?.trim() || void 0,
          email: email.trim(),
          role: selectedPermission,
          jobTitle: jobTitle.trim() || void 0
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to send invitation");
        return;
      }
      toast.success(`Invitation sent to ${email.trim()}`);
      onSuccess(selectedTeams.length > 0 ? selectedTeams : void 0, email.trim());
      handleClose();
    } catch {
      toast.error("Failed to send invitation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: handleClose, children: /* @__PURE__ */ jsxs(
    "div",
    {
      className: "relative flex w-full max-w-[480px] max-h-[90vh] flex-col bg-white rounded-[14px] shadow-2xl",
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-6 py-4 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#2B7FFF]", children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" }) }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-normal text-[#101828]", children: "Invite Member" }),
            /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Send an invitation to join this project" })
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: handleClose, className: "rounded-[10px] p-2 hover:bg-gray-100 transition-colors", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto px-6 py-6 space-y-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] text-[#364153]", children: "Email Address" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "email",
                value: email,
                onChange: (e) => setEmail(e.target.value),
                onKeyDown: (e) => e.key === "Enter" && handleSubmit(),
                placeholder: "e.g. john.doe@example.com",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[16px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxs("label", { className: "block text-[14px] text-[#364153]", children: [
              "Job Title ",
              /* @__PURE__ */ jsx("span", { className: "text-[#99A1AF]", children: "(optional)" })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: jobTitle,
                onChange: (e) => setJobTitle(e.target.value),
                placeholder: "e.g. Project Manager, Lead Architect",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[14px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] text-[#364153]", children: "Project Permission" }),
            /* @__PURE__ */ jsx("div", { className: "space-y-2", children: permissions.map((permission) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setSelectedPermission(permission.id),
                className: cn(
                  "flex w-full items-start gap-3 rounded-[10px] border-2 p-4 text-left transition-colors",
                  selectedPermission === permission.id ? "border-[#2B7FFF] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:border-[#D1D5DC]"
                ),
                children: [
                  /* @__PURE__ */ jsx("div", { className: "pt-0.5", children: /* @__PURE__ */ jsx("div", { className: cn(
                    "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                    selectedPermission === permission.id ? "border-[#2B7FFF]" : "border-[#D1D5DC]"
                  ), children: selectedPermission === permission.id && /* @__PURE__ */ jsx("div", { className: "h-2 w-2 rounded-full bg-[#2B7FFF]" }) }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
                      /* @__PURE__ */ jsx("span", { className: cn(
                        "px-2.5 py-0.5 rounded-full border text-[12px]",
                        permission.badgeBg,
                        permission.badgeBorder,
                        permission.badgeText
                      ), children: permission.label }),
                      selectedPermission === permission.id && /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#155DFC]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#4A5565]", children: permission.description })
                  ] })
                ]
              },
              permission.id
            )) })
          ] }),
          teams.length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
            /* @__PURE__ */ jsxs("label", { className: "block text-[14px] text-[#364153]", children: [
              "Assign to Teams ",
              /* @__PURE__ */ jsx("span", { className: "text-[#99A1AF]", children: "(optional)" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "space-y-2", children: teams.map((team) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => toggleTeam(team.id),
                className: cn(
                  "flex w-full items-center gap-3 rounded-[10px] border-2 p-3.5 text-left transition-colors",
                  selectedTeams.includes(team.id) ? "border-[#2B7FFF] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:border-[#D1D5DC]"
                ),
                children: [
                  /* @__PURE__ */ jsx("div", { className: cn(
                    "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                    selectedTeams.includes(team.id) ? "border-[#2B7FFF] bg-[#2B7FFF]" : "border-[#D1D5DC]"
                  ), children: selectedTeams.includes(team.id) && /* @__PURE__ */ jsx("svg", { className: "h-3 w-3 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 3, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }) }),
                  /* @__PURE__ */ jsx("div", { className: cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", team.color), children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" }) }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[14px] font-medium text-[#101828] truncate", children: team.name }),
                    /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282] truncate", children: team.description })
                  ] })
                ]
              },
              team.id
            )) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleClose,
              className: "px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleSubmit,
              disabled: !email.trim() || isSubmitting,
              className: "px-4 py-2 rounded-[10px] bg-[#2B7FFF] text-[14px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              children: isSubmitting ? "Sending…" : "Invite Member"
            }
          )
        ] })
      ]
    }
  ) });
}

const roleBadgeStyles = {
  owner: { bg: "bg-[#FEF9C3]", text: "text-[#A16207]" },
  admin: { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]" },
  member: { bg: "bg-[#DBEAFE]", text: "text-[#2563EB]" },
  viewer: { bg: "bg-[#F3F4F6]", text: "text-[#4B5563]" }
};
const inviteStatusStyles = {
  pending: { bg: "bg-[#FEF9C3]", text: "text-[#A16207]", label: "Pending" },
  accepted: { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", label: "Accepted" },
  revoked: { bg: "bg-[#FEE2E2]", text: "text-[#DC2626]", label: "Revoked" },
  expired: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", label: "Expired" }
};
function getInitials$1(name) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
function getAvatarColor(email) {
  const colors = [
    "bg-[#EC4899]",
    "bg-[#14B8A6]",
    "bg-[#3B82F6]",
    "bg-[#8B5CF6]",
    "bg-[#6B7280]",
    "bg-[#10B981]",
    "bg-[#F59E0B]",
    "bg-[#F97316]"
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) % colors.length;
  }
  return colors[Math.abs(hash)];
}
function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}
function RoleEditModal({ isOpen, member, onClose, onConfirm }) {
  const [selectedRole, setSelectedRole] = useState("member");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (member) setSelectedRole(member.role);
  }, [member]);
  if (!isOpen || !member) return null;
  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(member.userId, selectedRole);
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: onClose, children: /* @__PURE__ */ jsxs(
    "div",
    {
      className: "relative w-full max-w-[420px] bg-white rounded-[14px] shadow-2xl",
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-6 py-4 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-normal text-[#101828]", children: "Change Role" }),
          /* @__PURE__ */ jsx("button", { onClick: onClose, className: "ml-auto rounded-[10px] p-2 hover:bg-gray-100", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "px-6 py-5 space-y-4", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-[#4A5565]", children: [
            "Update role for ",
            /* @__PURE__ */ jsx("span", { className: "font-medium text-[#101828]", children: member.user?.fullName ?? member.email })
          ] }),
          ["admin", "member", "viewer"].map((role) => /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setSelectedRole(role),
              className: cn(
                "flex w-full items-center gap-3 rounded-[10px] border-2 p-4 text-left transition-colors capitalize",
                selectedRole === role ? "border-[#2B7FFF] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:border-[#D1D5DC]"
              ),
              children: [
                /* @__PURE__ */ jsx("div", { className: cn(
                  "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                  selectedRole === role ? "border-[#2B7FFF]" : "border-[#D1D5DC]"
                ), children: selectedRole === role && /* @__PURE__ */ jsx("div", { className: "h-2 w-2 rounded-full bg-[#2B7FFF]" }) }),
                /* @__PURE__ */ jsx("span", { className: "text-[14px] text-[#101828] capitalize", children: role })
              ]
            },
            role
          ))
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]", children: [
          /* @__PURE__ */ jsx("button", { onClick: onClose, className: "px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]", children: "Cancel" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleConfirm,
              disabled: saving || selectedRole === member.role,
              className: "px-4 py-2 rounded-[10px] bg-[#2B7FFF] text-[14px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50",
              children: saving ? "Saving…" : "Save Changes"
            }
          )
        ] })
      ]
    }
  ) });
}
const TEAM_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-amber-500"
];
function TeamsTab({ projectPublicId, currentUserRole: initialRole }) {
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(initialRole ?? "member");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState("members");
  const [viewMode, setViewMode] = useState("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [addMemberToTeamId, setAddMemberToTeamId] = useState(null);
  const [roleEditMember, setRoleEditMember] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingTeamAssignments, setPendingTeamAssignments] = useState([]);
  const fetchTeamsRef = useRef(async () => {
  });
  const socket = useAppStore((s) => s.socket);
  const projects = useAppStore((s) => s.projects);
  const currentProjectName = projects.find((p) => String(p.publicId) === projectPublicId)?.name;
  useEffect(() => {
    if (initialRole) return;
    const project = projects.find((p) => String(p.publicId) === projectPublicId);
    if (project?.role) setCurrentUserRole(project.role);
  }, [projects, projectPublicId, initialRole]);
  const canManage = currentUserRole === "admin" || currentUserRole === "owner";
  const canEditRole = (memberRole) => canManage && memberRole !== "admin";
  const canRemove = (memberRole) => canManage && memberRole !== "admin";
  const fetchMembers = useCallback(async () => {
    try {
      const res = await apiFetch("/api/projects/member-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectPublicId })
      });
      if (!res.ok) return;
      const data = await res.json();
      const fetched = Array.isArray(data?.data) ? data.data : [];
      setMembers(fetched);
      setPendingTeamAssignments((pending) => {
        if (pending.length === 0) return pending;
        const remaining = pending.filter(({ email, teamIds }) => {
          const match = fetched.find((m) => m.user?.email === email);
          if (match) {
            Promise.all(teamIds.map(
              (teamId) => apiFetch("/api/teams/members/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, userId: match.userId })
              })
            )).then(() => fetchTeamsRef.current()).catch(() => {
            });
            return false;
          }
          return true;
        });
        return remaining;
      });
    } catch {
    }
  }, [projectPublicId]);
  const fetchInvites = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/invites/invites-list?projectId=${encodeURIComponent(projectPublicId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setPendingInvites(Array.isArray(data?.data) ? data.data : []);
    } catch {
    }
  }, [projectPublicId]);
  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiFetch("/api/teams/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectPublicId })
      });
      if (!res.ok) return;
      const data = await res.json();
      setTeams(Array.isArray(data?.data) ? data.data : []);
    } catch {
    }
  }, [projectPublicId]);
  fetchTeamsRef.current = fetchTeams;
  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMembers(), fetchInvites(), fetchTeams()]);
    setLoading(false);
  }, [fetchMembers, fetchInvites, fetchTeams]);
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useEffect(() => {
    if (!socket) return;
    const handleInviteNew = () => {
      fetchInvites();
    };
    const handleInviteAccepted = () => {
      fetchMembers();
      fetchInvites();
    };
    const handleInviteRevoked = () => {
      fetchInvites();
    };
    socket.on("invite:new", handleInviteNew);
    socket.on("invite:accepted", handleInviteAccepted);
    socket.on("invite:revoked", handleInviteRevoked);
    return () => {
      socket.off("invite:new", handleInviteNew);
      socket.off("invite:accepted", handleInviteAccepted);
      socket.off("invite:revoked", handleInviteRevoked);
    };
  }, [socket, fetchMembers, fetchInvites]);
  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/projects/members/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectPublicId, userId, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to update role");
        return;
      }
      toast.success("Role updated");
      setMembers(
        (prev) => prev.map((m) => m.userId === userId ? { ...m, role: newRole } : m)
      );
    } catch {
      toast.error("Failed to update role");
    } finally {
      setActionLoading(false);
    }
  };
  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/projects/members/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectPublicId, userId: removeTarget.userId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to remove member");
        return;
      }
      toast.success(`${removeTarget.user?.fullName ?? "Member"} removed`);
      setMembers((prev) => prev.filter((m) => m.userId !== removeTarget.userId));
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setActionLoading(false);
      setRemoveTarget(null);
    }
  };
  const handleRevokeInvite = async () => {
    if (!revokeTarget) return;
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/invites/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: revokeTarget.publicId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to revoke invite");
        return;
      }
      toast.success("Invite revoked");
      setPendingInvites((prev) => prev.filter((i) => i.publicId !== revokeTarget.publicId));
    } catch {
      toast.error("Failed to revoke invite");
    } finally {
      setActionLoading(false);
      setRevokeTarget(null);
    }
  };
  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (m.user?.fullName ?? "").toLowerCase().includes(q) || (m.user?.email ?? "").toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
  });
  const filteredInvites = pendingInvites.filter(
    (i) => searchQuery === "" || i.email.toLowerCase().includes(searchQuery.toLowerCase()) || i.role.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const showSkeleton = loading;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Team" }) }),
      canManage && /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => activeView === "teams" ? setIsCreateTeamOpen(true) : setIsAddModalOpen(true),
          className: "inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#155DFC] h-10 w-[136px] text-[14px] font-normal text-white hover:bg-blue-700 transition-colors",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }),
            /* @__PURE__ */ jsx("span", { className: "inline-block min-w-[80px] text-left whitespace-nowrap", children: activeView === "teams" ? "Add Team" : "Add Member" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative w-[331px]", children: [
        /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Search members...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2 pl-10 pr-4 text-[14px] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-[10px] border border-[#E5E7EB] bg-white p-1", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setActiveView("members"),
              className: cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-[14px] transition-colors",
                activeView === "members" ? "bg-[#F3F4F6] text-[#101828] font-medium" : "text-[#4A5565] hover:text-[#101828]"
              ),
              children: [
                /* @__PURE__ */ jsx("span", { children: "Members" }),
                /* @__PURE__ */ jsxs("span", { className: "text-[12px] text-[#6A7282]", children: [
                  "(",
                  members.length,
                  ")"
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setActiveView("teams"),
              className: cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-[14px] transition-colors",
                activeView === "teams" ? "bg-[#F3F4F6] text-[#101828] font-medium" : "text-[#4A5565] hover:text-[#101828]"
              ),
              children: [
                /* @__PURE__ */ jsx("span", { children: "Teams" }),
                /* @__PURE__ */ jsxs("span", { className: "text-[12px] text-[#6A7282]", children: [
                  "(",
                  teams.length,
                  ")"
                ] })
              ]
            }
          ),
          canManage && /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setActiveView("invites"),
              className: cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-[14px] transition-colors",
                activeView === "invites" ? "bg-[#F3F4F6] text-[#101828] font-medium" : "text-[#4A5565] hover:text-[#101828]"
              ),
              children: [
                /* @__PURE__ */ jsx("span", { children: "Invites" }),
                /* @__PURE__ */ jsxs("span", { className: "text-[12px] text-[#6A7282]", children: [
                  "(",
                  pendingInvites.length,
                  ")"
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-[10px] border border-[#E5E7EB] bg-white p-1", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setViewMode("grid"),
              className: cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-[#F3F4F6]" : "hover:bg-gray-50"),
              children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#4A5565]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" }) })
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setViewMode("list"),
              className: cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-[#F3F4F6]" : "hover:bg-gray-50"),
              children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#4A5565]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 10h16M4 14h16M4 18h16" }) })
            }
          )
        ] })
      ] })
    ] }),
    activeView === "members" ? showSkeleton ? /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-4", children: [...Array(6)].map((_, i) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-[#E5E7EB] bg-white p-5 animate-pulse", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 mb-4", children: [
        /* @__PURE__ */ jsx("div", { className: "h-12 w-12 rounded-full bg-gray-200" }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("div", { className: "h-4 bg-gray-200 rounded w-24 mb-2" }),
          /* @__PURE__ */ jsx("div", { className: "h-3 bg-gray-100 rounded w-32" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "h-3 bg-gray-100 rounded w-40 mb-3" }),
      /* @__PURE__ */ jsx("div", { className: "h-5 bg-gray-100 rounded w-16 mb-4" }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-4 pt-3 border-t border-[#F3F4F6]", children: [
        /* @__PURE__ */ jsx("div", { className: "h-3 bg-gray-100 rounded w-16" }),
        /* @__PURE__ */ jsx("div", { className: "h-3 bg-gray-100 rounded w-12" })
      ] })
    ] }, i)) }) : filteredMembers.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "h-16 w-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" }) }) }),
      /* @__PURE__ */ jsx("p", { className: "text-[16px] font-medium text-[#101828] mb-1", children: "No members yet" }),
      /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: canManage ? "Invite team members to get started" : "You will see team members once they join" })
    ] }) : viewMode === "grid" ? /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-4", children: filteredMembers.map((member) => {
      const name = member.user?.fullName ?? member.email ?? "Unknown";
      const email = member.user?.email ?? "";
      const color = getAvatarColor(email);
      const badge = roleBadgeStyles[member.role];
      const memberTeams = teams.filter((t) => t.memberIds.includes(member.userId));
      return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-[#E5E7EB] bg-white p-5 hover:shadow-md transition-shadow", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-medium text-[14px]", color), children: getInitials$1(name) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-medium text-[#101828] truncate", children: name }),
            /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282] truncate capitalize", children: member.role })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#99A1AF] flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" }) }),
          /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#4A5565] truncate", children: email || "—" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: "h-4 w-4 rounded-full border-2 border-[#E5E7EB]" }),
          /* @__PURE__ */ jsx("span", { className: cn("px-2 py-0.5 rounded text-[11px] font-medium capitalize", badge.bg, badge.text), children: member.role })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-3 border-t border-[#F3F4F6]", children: [
          /* @__PURE__ */ jsxs("span", { className: "text-[12px] text-[#6A7282]", children: [
            "Joined ",
            formatDate(member.createdAt)
          ] }),
          memberTeams.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-1", children: memberTeams.map((t) => /* @__PURE__ */ jsx(
            "span",
            {
              className: cn(
                "px-1.5 py-0.5 rounded text-[11px] font-medium text-white truncate max-w-[120px]",
                t.color
              ),
              title: t.name,
              children: t.name
            },
            t.id
          )) }),
          canManage && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
            canEditRole(member.role) && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setRoleEditMember(member),
                className: "p-1 text-[#99A1AF] hover:text-[#4A5565]",
                title: "Edit role",
                children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" }) })
              }
            ),
            canRemove(member.role) && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setRemoveTarget(member),
                className: "p-1 text-[#99A1AF] hover:text-red-500",
                title: "Remove member",
                children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" }) })
              }
            )
          ] })
        ] })
      ] }, member.userId);
    }) }) : /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-[#E5E7EB] bg-white overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.5fr] gap-4 px-6 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium text-[#6A7282] uppercase tracking-wider", children: "Member" }),
        /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium text-[#6A7282] uppercase tracking-wider", children: "Role" }),
        /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium text-[#6A7282] uppercase tracking-wider", children: "Permission" }),
        /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium text-[#6A7282] uppercase tracking-wider", children: "Joined" }),
        /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium text-[#6A7282] uppercase tracking-wider", children: "Actions" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "divide-y divide-[#E5E7EB]", children: filteredMembers.map((member) => {
        const name = member.user?.fullName ?? member.email ?? "Unknown";
        const email = member.user?.email ?? "";
        const color = getAvatarColor(email);
        const badge = roleBadgeStyles[member.role];
        return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.5fr] gap-4 px-6 py-4 items-center hover:bg-[#FAFAFA] transition-colors", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-[13px] font-medium", color), children: getInitials$1(name) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[14px] font-medium text-[#101828]", children: name }),
              /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: email || "—" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "text-[14px] text-[#364153] capitalize", children: member.role }),
          /* @__PURE__ */ jsx("span", { className: cn("px-2.5 py-1 rounded text-[12px] font-medium w-fit capitalize", badge.bg, badge.text), children: member.role }),
          /* @__PURE__ */ jsx("span", { className: "text-[13px] text-[#4A5565]", children: formatDate(member.createdAt) }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
            canEditRole(member.role) && /* @__PURE__ */ jsx("button", { onClick: () => setRoleEditMember(member), className: "p-1 text-[#99A1AF] hover:text-[#4A5565]", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" }) }) }),
            canRemove(member.role) && /* @__PURE__ */ jsx("button", { onClick: () => setRemoveTarget(member), className: "p-1 text-[#99A1AF] hover:text-red-500", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" }) }) })
          ] })
        ] }, member.userId);
      }) })
    ] }) : activeView === "teams" ? (
      /* Teams tab */
      /* @__PURE__ */ jsx("div", { className: "space-y-4", children: teams.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "h-16 w-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" }) }) }),
        /* @__PURE__ */ jsx("p", { className: "text-[16px] font-medium text-[#101828] mb-1", children: "No teams yet" }),
        /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: canManage ? "Create a team to group members by discipline or role" : "Teams will appear here once created by an admin" })
      ] }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-4", children: teams.map((team) => {
        const teamMembers = members.filter((m) => team.memberIds.includes(m.userId));
        return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-[#E5E7EB] bg-white overflow-hidden", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 p-4 border-b border-[#F3F4F6]", children: [
            /* @__PURE__ */ jsx("div", { className: cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", team.color), children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" }) }) }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-medium text-[#101828] truncate", children: team.name }),
              /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282] truncate", children: team.description })
            ] }),
            canManage && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: async () => {
                  if (!confirm(`Delete team "${team.name}"?`)) return;
                  try {
                    const r = await apiFetch("/api/teams/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: team.id }) });
                    const d = await r.json();
                    if (!r.ok) {
                      toast.error(d.message || "Failed to delete team");
                      return;
                    }
                    toast.success(`Team "${team.name}" deleted`);
                    setTeams((prev) => prev.filter((t) => t.id !== team.id));
                  } catch {
                    toast.error("Failed to delete team");
                  }
                },
                className: "p-1 text-[#99A1AF] hover:text-red-500 transition-colors flex-shrink-0",
                title: "Delete team",
                children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "px-4 py-2 bg-[#FAFAFA] border-b border-[#F3F4F6]", children: /* @__PURE__ */ jsxs("span", { className: "text-[12px] font-medium text-[#6A7282]", children: [
            teamMembers.length,
            " Member",
            teamMembers.length !== 1 ? "s" : ""
          ] }) }),
          /* @__PURE__ */ jsx("div", { className: "divide-y divide-[#F3F4F6]", children: teamMembers.map((m) => {
            const name = m.user?.fullName ?? m.user?.email ?? "Unknown";
            const email = m.user?.email ?? "";
            const color = getAvatarColor(email);
            return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-3", children: [
              /* @__PURE__ */ jsx("div", { className: cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-[12px] font-medium flex-shrink-0", color), children: getInitials$1(name) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[13px] font-medium text-[#101828] truncate", children: name }),
                /* @__PURE__ */ jsx("p", { className: "text-[11px] text-[#6A7282] truncate capitalize", children: m.role })
              ] }),
              canManage && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: async () => {
                    try {
                      const r = await apiFetch("/api/teams/members/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: team.id, userId: m.userId }) });
                      const d = await r.json();
                      if (!r.ok) {
                        toast.error(d.message || "Failed to remove member");
                        return;
                      }
                      setTeams((prev) => prev.map(
                        (t) => t.id === team.id ? { ...t, memberIds: t.memberIds.filter((id) => id !== m.userId) } : t
                      ));
                    } catch {
                      toast.error("Failed to remove member");
                    }
                  },
                  className: "p-1 text-[#99A1AF] hover:text-red-500 transition-colors flex-shrink-0",
                  title: "Remove from team",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
                }
              )
            ] }, m.userId);
          }) }),
          canManage && /* @__PURE__ */ jsx("div", { className: "px-4 py-3 border-t border-[#F3F4F6]", children: addMemberToTeamId === team.id ? /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxs(
              "select",
              {
                className: "w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-[#2B7FFF] focus:outline-none",
                defaultValue: "",
                onChange: async (e) => {
                  const userId = e.target.value;
                  if (!userId) return;
                  try {
                    const r = await apiFetch("/api/teams/members/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: team.id, userId }) });
                    const d = await r.json();
                    if (!r.ok) {
                      toast.error(d.message || "Failed to add member");
                      return;
                    }
                    setTeams((prev) => prev.map(
                      (t) => t.id === team.id && !t.memberIds.includes(userId) ? { ...t, memberIds: [...t.memberIds, userId] } : t
                    ));
                  } catch {
                    toast.error("Failed to add member");
                  }
                  setAddMemberToTeamId(null);
                },
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select a member…" }),
                  members.filter((m) => !team.memberIds.includes(m.userId)).map((m) => /* @__PURE__ */ jsx("option", { value: m.userId, children: m.user?.fullName ?? m.user?.email ?? m.userId }, m.userId))
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setAddMemberToTeamId(null),
                className: "text-[12px] text-[#6A7282] hover:text-[#101828]",
                children: "Cancel"
              }
            )
          ] }) : /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setAddMemberToTeamId(team.id),
              className: "flex items-center gap-2 text-[13px] text-[#6A7282] hover:text-[#2B7FFF] transition-colors",
              children: [
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }),
                "Add Member"
              ]
            }
          ) })
        ] }, team.id);
      }) }) })
    ) : (
      /* Invites tab (admin only) */
      showSkeleton ? /* @__PURE__ */ jsx("div", { className: "space-y-3", children: [...Array(3)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-[#E5E7EB] bg-white p-5 animate-pulse", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-full bg-gray-200" }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("div", { className: "h-4 bg-gray-200 rounded w-32 mb-1" }),
          /* @__PURE__ */ jsx("div", { className: "h-3 bg-gray-100 rounded w-48" })
        ] })
      ] }) }, i)) }) : filteredInvites.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[16px] font-medium text-[#101828] mb-1", children: "No pending invites" }),
        /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Sent invitations will appear here" })
      ] }) : /* @__PURE__ */ jsx("div", { className: "space-y-3", children: filteredInvites.map((invite) => {
        const statusStyle = inviteStatusStyles[invite.status] ?? inviteStatusStyles.pending;
        const color = getAvatarColor(invite.email);
        return /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-[#E5E7EB] bg-white p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsx("div", { className: cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-[13px] font-medium flex-shrink-0", color), children: getInitials$1(invite.email) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[14px] font-medium text-[#101828] truncate", children: invite.email }),
              /* @__PURE__ */ jsx("span", { className: cn("px-2 py-0.5 rounded text-[11px] font-medium capitalize flex-shrink-0", statusStyle.bg, statusStyle.text), children: statusStyle.label })
            ] }),
            /* @__PURE__ */ jsxs("p", { className: "text-[12px] text-[#6A7282]", children: [
              "Invited as ",
              /* @__PURE__ */ jsx("span", { className: "capitalize font-medium", children: invite.role }),
              " · Expires ",
              formatDate(invite.expiresAt)
            ] })
          ] }),
          invite.status === "pending" && /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setRevokeTarget(invite),
              className: "px-3 py-1.5 rounded-[8px] border border-[#E5E7EB] text-[13px] text-[#6A7282] hover:border-red-300 hover:text-red-500 transition-colors",
              children: "Revoke"
            }
          )
        ] }) }, invite.publicId);
      }) })
    ),
    /* @__PURE__ */ jsx(
      AddMemberModal,
      {
        projectId: projectPublicId,
        projectName: currentProjectName,
        isOpen: isAddModalOpen,
        onClose: () => setIsAddModalOpen(false),
        teams,
        onSuccess: (assignedTeamIds, invitedEmail) => {
          fetchInvites();
          if (assignedTeamIds?.length && invitedEmail) {
            setPendingTeamAssignments((prev) => [...prev, { email: invitedEmail, teamIds: assignedTeamIds }]);
          }
        }
      }
    ),
    /* @__PURE__ */ jsx(
      RoleEditModal,
      {
        isOpen: !!roleEditMember,
        member: roleEditMember,
        onClose: () => setRoleEditMember(null),
        onConfirm: handleRoleChange
      }
    ),
    removeTarget && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: () => setRemoveTarget(null), children: /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-[400px] bg-white rounded-[14px] shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "px-6 py-5", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-2", children: "Remove Member" }),
        /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-[#4A5565]", children: [
          "Are you sure you want to remove ",
          /* @__PURE__ */ jsx("span", { className: "font-medium", children: removeTarget.user?.fullName ?? removeTarget.email }),
          " from this project? This action cannot be undone."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setRemoveTarget(null), className: "px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]", children: "Cancel" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleRemoveMember,
            disabled: actionLoading,
            className: "px-4 py-2 rounded-[10px] bg-red-500 text-[14px] text-white hover:bg-red-600 transition-colors disabled:opacity-50",
            children: actionLoading ? "Removing…" : "Remove"
          }
        )
      ] })
    ] }) }),
    isCreateTeamOpen && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: () => setIsCreateTeamOpen(false), children: /* @__PURE__ */ jsxs(
      "div",
      {
        className: "relative w-full max-w-[440px] bg-white rounded-[14px] shadow-2xl",
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-6 py-4 border-b border-[#E5E7EB]", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#2B7FFF]", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" }) }) }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
              /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-normal text-[#101828]", children: "Create Team" }),
              /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Group members by discipline or role" })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setIsCreateTeamOpen(false),
                className: "rounded-[10px] p-2 hover:bg-gray-100 transition-colors",
                children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "px-6 py-5 space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-[14px] text-[#364153]", children: "Team Name" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: newTeamName,
                  onChange: (e) => setNewTeamName(e.target.value),
                  placeholder: "e.g. Design, Engineering, QA",
                  autoFocus: true,
                  className: "w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[14px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxs("label", { className: "block text-[14px] text-[#364153]", children: [
                "Description ",
                /* @__PURE__ */ jsx("span", { className: "text-[#99A1AF]", children: "(optional)" })
              ] }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: newTeamDesc,
                  onChange: (e) => setNewTeamDesc(e.target.value),
                  placeholder: "Brief description of this team",
                  className: "w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[14px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-[14px] text-[#364153]", children: "Team Color" }),
              /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: TEAM_COLORS.map((color) => {
                const nextColorForNew = TEAM_COLORS[teams.length % TEAM_COLORS.length];
                return /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: cn(
                      "h-7 w-7 rounded-lg cursor-pointer ring-2 transition-all",
                      color,
                      color === nextColorForNew ? "ring-[#2B7FFF] ring-offset-1" : "ring-transparent"
                    )
                  },
                  color
                );
              }) }),
              /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#99A1AF]", children: "Color is assigned automatically based on creation order" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => {
                  setIsCreateTeamOpen(false);
                  setNewTeamName("");
                  setNewTeamDesc("");
                },
                className: "px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors",
                children: "Cancel"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                disabled: !newTeamName.trim() || actionLoading,
                onClick: async () => {
                  const name = newTeamName.trim();
                  const color = TEAM_COLORS[teams.length % TEAM_COLORS.length];
                  setActionLoading(true);
                  try {
                    const r = await apiFetch("/api/teams/create", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId: projectPublicId, name, description: newTeamDesc.trim(), color })
                    });
                    const d = await r.json();
                    if (!r.ok) {
                      toast.error(d.message || "Failed to create team");
                      return;
                    }
                    setTeams((prev) => [...prev, d.data]);
                    setNewTeamName("");
                    setNewTeamDesc("");
                    setIsCreateTeamOpen(false);
                    toast.success(`Team "${name}" created`);
                  } catch {
                    toast.error("Failed to create team");
                  } finally {
                    setActionLoading(false);
                  }
                },
                className: "px-4 py-2 rounded-[10px] bg-[#2B7FFF] text-[14px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                children: "Create Team"
              }
            )
          ] })
        ]
      }
    ) }),
    revokeTarget && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: () => setRevokeTarget(null), children: /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-[400px] bg-white rounded-[14px] shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "px-6 py-5", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-2", children: "Revoke Invite" }),
        /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-[#4A5565]", children: [
          "Revoke the invitation sent to ",
          /* @__PURE__ */ jsx("span", { className: "font-medium", children: revokeTarget.email }),
          "? They will no longer be able to join the project."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setRevokeTarget(null), className: "px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]", children: "Cancel" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleRevokeInvite,
            disabled: actionLoading,
            className: "px-4 py-2 rounded-[10px] bg-red-500 text-[14px] text-white hover:bg-red-600 transition-colors disabled:opacity-50",
            children: actionLoading ? "Revoking…" : "Revoke Invite"
          }
        )
      ] })
    ] }) })
  ] });
}

const extensions = [
  {
    id: "1",
    name: "Auto Clash Detection",
    category: "Automation",
    description: "Automatically detect clashes and create BCF topics",
    version: "v2.1.0",
    rating: 4.8,
    installed: true,
    enabled: true,
    icon: "puzzle",
    iconColor: "bg-[#DBEAFE] text-[#2563EB]"
  },
  {
    id: "2",
    name: "Revit Sync",
    category: "Integration",
    description: "Real-time synchronization with Autodesk Revit",
    version: "v1.5.2",
    rating: 4.6,
    installed: true,
    enabled: false,
    icon: "sync",
    iconColor: "bg-[#D1FAE5] text-[#059669]"
  },
  {
    id: "3",
    name: "AI Model Checker",
    category: "AI/ML",
    description: "AI-powered model quality and compliance checking",
    version: "v0.9.1",
    rating: 4.5,
    installed: false,
    enabled: false,
    icon: "ai",
    iconColor: "bg-[#F3E8FF] text-[#7C3AED]"
  },
  {
    id: "4",
    name: "IFC Export Pro",
    category: "Export",
    description: "Advanced IFC export with custom property mapping",
    version: "v3.0.0",
    rating: 4.9,
    installed: false,
    enabled: false,
    icon: "puzzle",
    iconColor: "bg-[#DBEAFE] text-[#2563EB]"
  }
];
function ExtensionsTab() {
  const [activeFilter, setActiveFilter] = useState("installed");
  const [searchQuery, setSearchQuery] = useState("");
  const [extensionStates, setExtensionStates] = useState(
    Object.fromEntries(extensions.map((e) => [e.id, e.enabled]))
  );
  const filteredExtensions = extensions.filter((ext) => {
    const matchesFilter = activeFilter === "installed" ? ext.installed : !ext.installed;
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) || ext.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  const toggleExtension = (id) => {
    setExtensionStates((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  const getIcon = (iconType) => {
    switch (iconType) {
      case "puzzle":
        return /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" }) });
      case "sync":
        return /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) });
      case "ai":
        return /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }) });
      case "export":
        return /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" }) });
      default:
        return /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" }) });
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-6", children: [
      /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Extensions" }) }),
      /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors", children: [
        /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }),
        "Browse Marketplace"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 mb-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative flex-1 max-w-md", children: [
        /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Search extensions...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setActiveFilter("installed"),
            className: cn(
              "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
              activeFilter === "installed" ? "bg-[#F0F9FF] text-[#0069A8]" : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
            ),
            children: "Installed"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setActiveFilter("marketplace"),
            className: cn(
              "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
              activeFilter === "marketplace" ? "bg-[#F0F9FF] text-[#0069A8]" : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
            ),
            children: "Marketplace"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-4", children: filteredExtensions.map((ext) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "rounded-xl border border-[#E5E7EB] bg-white p-5 hover:shadow-md transition-shadow",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between mb-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: cn("h-10 w-10 rounded-lg flex items-center justify-center", ext.iconColor), children: getIcon(ext.icon) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-medium text-[#101828]", children: ext.name }),
                /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: ext.category })
              ] })
            ] }),
            ext.installed && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => toggleExtension(ext.id),
                className: cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  extensionStates[ext.id] ? "bg-[#22C55E]" : "bg-[#E5E7EB]"
                ),
                children: /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      extensionStates[ext.id] ? "translate-x-5" : "translate-x-0"
                    )
                  }
                )
              }
            )
          ] }),
          /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#4A5565] mb-4 line-clamp-2", children: ext.description }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#6A7282]", children: ext.version }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#FBBF24]", fill: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { d: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" }) }),
              /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#6A7282]", children: ext.rating })
            ] })
          ] }),
          ext.installed ? /* @__PURE__ */ jsxs("button", { className: "w-full inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white py-2.5 text-[14px] font-normal text-[#364153] hover:bg-gray-50 transition-colors", children: [
            /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
            ] }),
            "Configure"
          ] }) : /* @__PURE__ */ jsxs("button", { className: "w-full inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#155DFC] py-2.5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors", children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }),
            "Install"
          ] }),
          ext.installed && /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium text-[#059669]", children: "Installed" }) })
        ]
      },
      ext.id
    )) }),
    filteredExtensions.length === 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 rounded-xl border border-[#E5E7EB] bg-white", children: [
      /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-[#F0F9FF] mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-[#155DFC]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" }) }) }),
      /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-1", children: "No extensions found" }),
      /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282] mb-4", children: activeFilter === "installed" ? "Browse the marketplace to install extensions" : "No extensions match your search" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setActiveFilter("marketplace"),
          className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2.5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors",
          children: "Browse Marketplace"
        }
      )
    ] })
  ] });
}

const projectTemplates = [
  {
    id: "1",
    name: "Construction & BIM",
    description: "For construction and BIM projects",
    icon: "cube",
    pages: [
      { name: "Overview", icon: "grid" },
      { name: "Packages", icon: "folder" },
      { name: "Documents", icon: "file" },
      { name: "Versions", icon: "git" },
      { name: "Changes", icon: "refresh" },
      { name: "Clashes", icon: "alert" },
      { name: "3D Viewer", icon: "cube" }
    ]
  },
  {
    id: "2",
    name: "Software Development",
    description: "For software and tech projects",
    icon: "code",
    pages: [
      { name: "Overview", icon: "grid" },
      { name: "Code", icon: "code" },
      { name: "Database", icon: "database" },
      { name: "Versions", icon: "git" },
      { name: "Tasks", icon: "refresh" },
      { name: "Team", icon: "users" }
    ]
  },
  {
    id: "3",
    name: "Education & Learning",
    description: "For schools and educational projects",
    icon: "book",
    pages: [
      { name: "Overview", icon: "grid" },
      { name: "Lessons", icon: "book" },
      { name: "Resources", icon: "folder" },
      { name: "Assignments", icon: "refresh" },
      { name: "Students", icon: "users" }
    ]
  },
  {
    id: "4",
    name: "General Project",
    description: "Basic project management",
    icon: "folder",
    pages: [
      { name: "Overview", icon: "grid" },
      { name: "Files", icon: "file" },
      { name: "Tasks", icon: "refresh" },
      { name: "Team", icon: "users" },
      { name: "Analytics", icon: "chart" }
    ]
  }
];
const pageIconOptions = [
  { id: "grid", icon: LayoutGrid },
  { id: "folder", icon: FolderOpen },
  { id: "file", icon: FileText },
  { id: "git", icon: GitCompare },
  { id: "refresh", icon: RefreshCcw },
  { id: "alert", icon: AlertTriangle },
  { id: "puzzle", icon: Puzzle },
  { id: "users", icon: Users },
  { id: "cube", icon: Box },
  { id: "code", icon: Code },
  { id: "database", icon: Database },
  { id: "book", icon: BookOpen },
  { id: "folder2", icon: Folder },
  { id: "chart", icon: BarChart3 },
  { id: "settings", icon: Settings },
  { id: "zap", icon: Zap }
];
const defaultRoles = [
  { id: "1", name: "Project Owner", accessLevel: "full", isSystem: true, memberCount: 1, description: "Full control over the project and all settings", permissions: ["All Permissions"], color: "#8B5CF6" },
  { id: "2", name: "Admin", accessLevel: "high", isSystem: true, memberCount: 2, description: "Can manage project, members, and approve changes", permissions: ["View All", "Edit All", "Delete Content", "Manage Team", "Approve Changes"], color: "#EF4444" },
  { id: "3", name: "Manager", accessLevel: "high", isSystem: true, memberCount: 3, description: "Can manage tasks, approve changes, and assign work", permissions: ["View All", "Edit All", "Approve Changes", "Assign Tasks", "Manage Workflow"], color: "#EF4444" },
  { id: "4", name: "Member", accessLevel: "medium", isSystem: false, memberCount: 5, description: "Can create and edit content, submit changes", permissions: ["View All", "Edit Own", "Create Content", "Submit Changes"], color: "#10B981" },
  { id: "5", name: "Viewer", accessLevel: "minimal", isSystem: false, memberCount: 0, description: "View-only access to project content", permissions: ["View All"], color: "#6B7280" }
];
const permissionCategories = [
  { id: "documents", name: "Documents & Drawings", description: "Access and manage project documents", icon: "file" },
  { id: "versions", name: "Version Control", description: "View and create revisions", icon: "git" },
  { id: "tasks", name: "Tasks & Workflows", description: "Manage tasks and workflows", icon: "list" },
  { id: "packages", name: "Packages", description: "Manage project packages", icon: "package" },
  { id: "clashes", name: "Clash Detection", description: "View and resolve clashes", icon: "alert" },
  { id: "viewer", name: "3D Viewer", description: "Access 3D model viewer", icon: "box" },
  { id: "settings", name: "Project Settings", description: "Modify project settings", icon: "settings" },
  { id: "members", name: "Member Management", description: "Invite and manage members", icon: "users" }
];
const defaultTeamMembers = [
  { id: "1", name: "Nguyen Van An", email: "an.nguyen@orbit.vn", role: "Owner", joinedDate: "Jan 15, 2024" },
  { id: "2", name: "Tran Thi Binh", email: "binh.tran@orbit.vn", role: "Admin", joinedDate: "Feb 20, 2024" },
  { id: "3", name: "Le Van Cuong", email: "cuong.le@orbit.vn", role: "Admin", joinedDate: "Mar 10, 2024" },
  { id: "4", name: "Pham Thi Dung", email: "dung.pham@orbit.vn", role: "Member", joinedDate: "Apr 5, 2024" }
];
const defaultNotifications = [
  { id: "1", category: "Tasks", title: "Task assigned to you", description: "When someone assigns a task to you", email: true, inApp: true, push: true },
  { id: "2", category: "Tasks", title: "Task status changed", description: "When a task you created or assigned changes status", email: true, inApp: true, push: false },
  { id: "3", category: "Tasks", title: "Task comment", description: "When someone comments on your task", email: false, inApp: true, push: true },
  { id: "4", category: "Documents", title: "Document uploaded", description: "When a new document is uploaded to the project", email: true, inApp: true, push: false },
  { id: "5", category: "Documents", title: "Document updated", description: "When a document you follow is updated", email: false, inApp: true, push: false },
  { id: "6", category: "Changes", title: "Change request submitted", description: "When someone submits a change request", email: true, inApp: true, push: true },
  { id: "7", category: "Changes", title: "Change approved/rejected", description: "When your change request is reviewed", email: true, inApp: true, push: true },
  { id: "8", category: "Team", title: "Member joined", description: "When a new member joins the project", email: false, inApp: true, push: false },
  { id: "9", category: "Team", title: "Member role changed", description: "When your role is updated", email: true, inApp: true, push: true }
];
const defaultIntegrations = [
  { id: "1", name: "Google Drive", description: "Sync files and documents with Google Drive", icon: "drive", connected: true, category: "storage" },
  { id: "2", name: "Dropbox", description: "Connect your Dropbox account for file storage", icon: "dropbox", connected: false, category: "storage" },
  { id: "3", name: "OneDrive", description: "Microsoft OneDrive integration", icon: "onedrive", connected: false, category: "storage" },
  { id: "4", name: "Slack", description: "Send notifications to Slack channels", icon: "slack", connected: true, category: "communication" },
  { id: "5", name: "Microsoft Teams", description: "Integrate with Microsoft Teams", icon: "teams", connected: false, category: "communication" },
  { id: "6", name: "Jira", description: "Sync tasks with Jira projects", icon: "jira", connected: false, category: "project" },
  { id: "7", name: "Autodesk BIM 360", description: "Connect to Autodesk BIM 360", icon: "autodesk", connected: true, category: "cad" },
  { id: "8", name: "Revit Cloud", description: "Sync Revit models from cloud", icon: "revit", connected: false, category: "cad" }
];
const defaultTaskTags = [
  { id: "1", name: "structural", description: "Structural engineering tasks", color: "#6366F1" },
  { id: "2", name: "mep", description: "MEP related tasks", color: "#3B82F6" },
  { id: "3", name: "architecture", description: "Architectural design tasks", color: "#10B981" },
  { id: "4", name: "civil", description: "Civil engineering tasks", color: "#6B7280" },
  { id: "5", name: "drawings", description: "Drawing documentation", color: "#14B8A6" },
  { id: "6", name: "clash", description: "Clash resolution tasks", color: "#EF4444" },
  { id: "7", name: "review", description: "Review and approval tasks", color: "#F97316" },
  { id: "8", name: "urgent", description: "High priority urgent tasks", color: "#DC2626" },
  { id: "9", name: "design", description: "Design related tasks", color: "#8B5CF6" },
  { id: "10", name: "coordination", description: "Coordination tasks", color: "#F59E0B" }
];
const defaultNavigationPages = [
  { id: "1", name: "Overview", icon: "grid", isDefault: true, isVisible: true },
  { id: "2", name: "Packages", icon: "folder", isDefault: true, isVisible: true },
  { id: "3", name: "Documents", icon: "file", isDefault: true, isVisible: true },
  { id: "4", name: "Versions", icon: "git", isDefault: true, isVisible: true },
  { id: "5", name: "Changes", icon: "refresh", isDefault: true, isVisible: true },
  { id: "6", name: "Clashes", icon: "alert", isDefault: false, isVisible: true },
  { id: "7", name: "Extensions", icon: "puzzle", isDefault: false, isVisible: true }
];
const settingsMenuItems = [
  { id: "general", label: "General", icon: Settings },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "workflow", label: "Workflow", icon: GitBranch },
  { id: "roles", label: "Roles", icon: Users },
  { id: "permissions", label: "Permissions", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug }
];
function SettingsTab({
  projectName = "Metro Station - Phase 2",
  projectCode = "MS-P2-2025",
  projectDescription = "",
  projectPublicId = ""
}) {
  const [activeMenu, setActiveMenu] = useState("general");
  const [name, setName] = useState(projectName);
  const [code, setCode] = useState(projectCode);
  const [description, setDescription] = useState(projectDescription);
  const [disciplines, setDisciplines] = useState([]);
  const [navigationPages, setNavigationPages] = useState(defaultNavigationPages);
  const [taskTags, setTaskTags] = useState(defaultTaskTags);
  const [isLoadingTaskTags, setIsLoadingTaskTags] = useState(false);
  const [roles, setRoles] = useState(defaultRoles);
  const [teamMembers, setTeamMembers] = useState(defaultTeamMembers);
  const [selectedRole, setSelectedRole] = useState("Admin");
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [integrations, setIntegrations] = useState(defaultIntegrations);
  const [permissionMatrix, setPermissionMatrix] = useState({
    "Owner": { documents: "manage", versions: "manage", tasks: "manage", packages: "manage", clashes: "manage", viewer: "manage", settings: "manage", members: "manage" },
    "Admin": { documents: "manage", versions: "manage", tasks: "manage", packages: "manage", clashes: "edit", viewer: "manage", settings: "edit", members: "edit" },
    "Member": { documents: "edit", versions: "edit", tasks: "edit", packages: "view", clashes: "view", viewer: "view", settings: "none", members: "none" },
    "Viewer": { documents: "view", versions: "view", tasks: "view", packages: "view", clashes: "view", viewer: "view", settings: "none", members: "none" }
  });
  const [showAddDisciplineModal, setShowAddDisciplineModal] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState("");
  const [newDisciplineDescription, setNewDisciplineDescription] = useState("");
  const [newDisciplineColor, setNewDisciplineColor] = useState("#6366f1");
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageIcon, setNewPageIcon] = useState("file");
  const [pagesModified, setPagesModified] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [generalSaveState, setGeneralSaveState] = useState("idle");
  const [disciplineNameError, setDisciplineNameError] = useState(false);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false);
  const [showEditDisciplineModal, setShowEditDisciplineModal] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState(null);
  const [projectThumbnail, setProjectThumbnail] = useState("https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&h=120&fit=crop");
  const fileInputRef = useRef(null);
  const [templateApplied, setTemplateApplied] = useState(null);
  const [showEditPageModal, setShowEditPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editTagName, setEditTagName] = useState("");
  const [editTagDescription, setEditTagDescription] = useState("");
  const [editTagColor, setEditTagColor] = useState("#6366F1");
  const [selectedWorkflow, setSelectedWorkflow] = useState("construction");
  const [workflowSettings, setWorkflowSettings] = useState({
    autoAssign: false,
    notifyStatusChange: false,
    requireApproval: false
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [permissionsSaveState, setPermissionsSaveState] = useState("idle");
  const [invitePermissions, setInvitePermissions] = useState({
    documents: "Edit",
    versions: "Edit",
    tasks: "Edit",
    packages: "Edit"
  });
  const [workflowApplyState, setWorkflowApplyState] = useState("idle");
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366f1");
  const [newRolePermissionLevel, setNewRolePermissionLevel] = useState("medium");
  const [newRoleContentPerms, setNewRoleContentPerms] = useState({
    viewAll: false,
    editOwn: false,
    editAll: false,
    createContent: false,
    deleteContent: false,
    approveChanges: false,
    submitChanges: false
  });
  const [newRoleTeamPerms, setNewRoleTeamPerms] = useState({
    viewTeam: false,
    manageTeam: false,
    assignTasks: false,
    manageRoles: false
  });
  const [newRoleSettingsPerms, setNewRoleSettingsPerms] = useState({
    viewSettings: false,
    manageSettings: false,
    manageWorkflow: false,
    manageIntegrations: false
  });
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366F1");
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [notificationsSaveState, setNotificationsSaveState] = useState("idle");
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [deleteProjectConfirmText, setDeleteProjectConfirmText] = useState("");
  useEffect(() => {
    if (!projectPublicId) return;
    setIsLoadingDisciplines(true);
    apiFetch(`/api/projects/${projectPublicId}/disciplines`).then((res) => res.ok ? res.json() : null).then((data) => {
      if (data?.data) {
        setDisciplines(data.data.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          color: d.color,
          createdBy: d.createdBy,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        })));
      }
    }).catch(() => {
    }).finally(() => setIsLoadingDisciplines(false));
  }, [projectPublicId]);
  const handleDeleteDiscipline = async (id) => {
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/disciplines/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDisciplines((prev) => prev.filter((d) => d.id !== id));
        toast.success("Discipline deleted");
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to delete discipline");
      }
    } catch {
      toast.error("Failed to delete discipline");
    }
  };
  const handleSaveGeneralSettings = async () => {
    setGeneralSaveState("saving");
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    setGeneralSaveState("success");
    setTimeout(() => setGeneralSaveState("idle"), 3e3);
  };
  const handleChangeImage = () => {
    fileInputRef.current?.click();
  };
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProjectThumbnail(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleEditDiscipline = (discipline) => {
    setEditingDiscipline(discipline);
    setNewDisciplineName(discipline.name);
    setNewDisciplineDescription(discipline.description);
    setNewDisciplineColor(discipline.color || "#6366f1");
    setShowEditDisciplineModal(true);
  };
  const handleSaveEditedDiscipline = async () => {
    if (!newDisciplineName.trim()) {
      setDisciplineNameError(true);
      return;
    }
    if (!editingDiscipline) return;
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/disciplines/${editingDiscipline.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDisciplineName.trim(),
          description: newDisciplineDescription.trim(),
          color: newDisciplineColor
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDisciplines((prev) => prev.map(
          (d) => d.id === editingDiscipline.id ? { ...d, name: data.data.name, description: data.data.description, color: data.data.color } : d
        ));
        toast.success("Discipline updated");
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to update discipline");
      }
    } catch {
      toast.error("Failed to update discipline");
    } finally {
      setShowEditDisciplineModal(false);
      setEditingDiscipline(null);
      setNewDisciplineName("");
      setNewDisciplineDescription("");
      setDisciplineNameError(false);
    }
  };
  const handleTogglePageVisibility = (id) => {
    setNavigationPages(navigationPages.map(
      (p) => p.id === id ? { ...p, isVisible: !p.isVisible } : p
    ));
    setPagesModified(true);
  };
  const handleDeletePage = (id) => {
    setNavigationPages(navigationPages.filter((p) => p.id !== id));
    setPagesModified(true);
  };
  const handleEditPage = (page) => {
    setEditingPage(page);
    setNewPageName(page.name);
    setNewPageIcon(page.icon);
    setShowEditPageModal(true);
  };
  const handleSaveEditedPage = () => {
    if (!newPageName.trim()) return;
    if (editingPage) {
      setNavigationPages(navigationPages.map(
        (p) => p.id === editingPage.id ? { ...p, name: newPageName.trim(), icon: newPageIcon } : p
      ));
      setShowEditPageModal(false);
      setEditingPage(null);
      setNewPageName("");
      setNewPageIcon("file");
      setPagesModified(true);
    }
  };
  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagDescription(tag.description);
    setEditTagColor(tag.color);
    setShowEditTagModal(true);
  };
  const handleSaveEditedTag = async () => {
    if (!editingTag || !editTagName.trim()) return;
    const previous = taskTags;
    const next = taskTags.map(
      (tag) => tag.id === editingTag.id ? {
        ...tag,
        name: editTagName.trim().toLowerCase(),
        description: editTagDescription.trim(),
        color: editTagColor
      } : tag
    );
    setTaskTags(next);
    try {
      const ok = await persistTaskTags(next);
      if (!ok) {
        setTaskTags(previous);
        toast.error("Failed to update tag");
        return;
      }
    } catch {
      setTaskTags(previous);
      toast.error("Failed to update tag");
      return;
    }
    setShowEditTagModal(false);
    setEditingTag(null);
    setEditTagName("");
    setEditTagDescription("");
    setEditTagColor("#6366F1");
  };
  const persistTaskTags = async (nextTags) => {
    if (!projectPublicId) return true;
    const response = await apiFetch("/api/projects/workflow/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        projectId: projectPublicId,
        taskTags: nextTags.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          color: t.color
        }))
      })
    });
    return response.ok;
  };
  useEffect(() => {
    let cancelled = false;
    const loadTaskTags = async () => {
      if (!projectPublicId) return;
      setIsLoadingTaskTags(true);
      try {
        const response = await apiFetch("/api/projects/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ projectId: projectPublicId })
        });
        if (!response.ok) return;
        const payload = await response.json();
        const tags = Array.isArray(payload?.data?.taskTags) ? payload.data.taskTags : [];
        if (!cancelled && tags.length > 0) {
          setTaskTags(
            tags.map((t) => ({
              id: String(t.id || Date.now()),
              name: String(t.name || "").toLowerCase(),
              description: String(t.description || ""),
              color: String(t.color || "#6366F1")
            }))
          );
        }
      } catch {
      } finally {
        if (!cancelled) setIsLoadingTaskTags(false);
      }
    };
    loadTaskTags();
    return () => {
      cancelled = true;
    };
  }, [projectPublicId]);
  const handleDeleteTag = async (id) => {
    const previous = taskTags;
    const next = taskTags.filter((t) => t.id !== id);
    setTaskTags(next);
    try {
      const ok = await persistTaskTags(next);
      if (!ok) {
        setTaskTags(previous);
        toast.error("Failed to delete tag");
      }
    } catch {
      setTaskTags(previous);
      toast.error("Failed to delete tag");
    }
  };
  const handleDeleteRole = (id) => {
    setRoles(roles.filter((r) => r.id !== id));
  };
  const handleToggleNotification = (id, channel) => {
    setNotifications(notifications.map(
      (n) => n.id === id ? { ...n, [channel]: !n[channel] } : n
    ));
  };
  const handleToggleIntegration = (id) => {
    setIntegrations(integrations.map(
      (i) => i.id === id ? { ...i, connected: !i.connected } : i
    ));
  };
  const handlePermissionChange = (role, category, level) => {
    setPermissionMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [category]: level }
    }));
  };
  const getAccessLevelBadge = (level) => {
    switch (level) {
      case "full":
        return { text: "Full Access", bg: "bg-purple-100", color: "text-purple-600" };
      case "high":
        return { text: "High Access", bg: "bg-red-100", color: "text-red-600" };
      case "medium":
        return { text: "Medium Access", bg: "bg-blue-100", color: "text-blue-600" };
      case "minimal":
        return { text: "Minimal Access", bg: "bg-gray-100", color: "text-gray-600" };
    }
  };
  const getColorClass = (color) => {
    const colorMap = {
      "#6366f1": "bg-indigo-100 text-indigo-600",
      "#8B5CF6": "bg-purple-100 text-purple-600",
      "#3B82F6": "bg-blue-100 text-blue-600",
      "#10B981": "bg-emerald-100 text-emerald-600",
      "#F97316": "bg-orange-100 text-orange-600",
      "#14B8A6": "bg-teal-100 text-teal-600",
      "#EF4444": "bg-red-100 text-red-600",
      "#F59E0B": "bg-amber-100 text-amber-600",
      "#6B7280": "bg-gray-100 text-gray-600",
      "#EC4899": "bg-pink-100 text-pink-600",
      "#84CC16": "bg-lime-100 text-lime-600",
      "#06B6D4": "bg-cyan-100 text-cyan-600"
    };
    const hex = color.startsWith("#") ? color : `#${color}`;
    return colorMap[hex] || "bg-indigo-100 text-indigo-600";
  };
  const getRoleBadge = (role) => {
    switch (role) {
      case "Owner":
        return { bg: "bg-purple-100", color: "text-purple-600" };
      case "Admin":
        return { bg: "bg-red-100", color: "text-red-600" };
      case "Member":
        return { bg: "bg-blue-100", color: "text-blue-600" };
      case "Viewer":
        return { bg: "bg-gray-100", color: "text-gray-600" };
      default:
        return { bg: "bg-gray-100", color: "text-gray-600" };
    }
  };
  const handleAddDiscipline = async () => {
    if (!newDisciplineName.trim()) {
      setDisciplineNameError(true);
      return;
    }
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/disciplines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDisciplineName.trim(),
          description: newDisciplineDescription.trim(),
          color: newDisciplineColor
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDisciplines((prev) => [...prev, data.data]);
        toast.success("Discipline added");
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to add discipline");
      }
    } catch {
      toast.error("Failed to add discipline");
    } finally {
      setNewDisciplineName("");
      setNewDisciplineDescription("");
      setNewDisciplineColor("#6366f1");
      setDisciplineNameError(false);
      setShowAddDisciplineModal(false);
    }
  };
  const resetAndCloseModal = () => {
    setNewDisciplineName("");
    setNewDisciplineDescription("");
    setNewDisciplineColor("#6366f1");
    setDisciplineNameError(false);
    setShowAddDisciplineModal(false);
    setShowEditDisciplineModal(false);
    setEditingDiscipline(null);
  };
  const handleApplyTemplate = (template) => {
    const newPages = template.pages.map((page, index) => ({
      id: `template-${Date.now()}-${index}`,
      name: page.name,
      icon: page.icon,
      isDefault: index < 4,
      isVisible: true
    }));
    setNavigationPages(newPages);
    setPagesModified(true);
    setTemplateApplied(template.name);
    setTimeout(() => setTemplateApplied(null), 3e3);
    setShowTemplatesModal(false);
  };
  const handleAddPage = () => {
    if (newPageName.trim()) {
      const newPage = {
        id: Date.now().toString(),
        name: newPageName.trim(),
        icon: newPageIcon,
        isDefault: false,
        isVisible: true
      };
      setNavigationPages([...navigationPages, newPage]);
      setNewPageName("");
      setNewPageIcon("file");
      setPagesModified(true);
      setShowAddPageModal(false);
    }
  };
  const handleSavePages = () => {
    setPagesModified(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3e3);
  };
  const getTemplateIcon = (iconName) => {
    switch (iconName) {
      case "cube":
        return Box;
      case "code":
        return Code;
      case "book":
        return BookOpen;
      case "folder":
        return Folder;
      default:
        return Folder;
    }
  };
  const getPageIcon = (iconName) => {
    switch (iconName) {
      case "grid":
        return LayoutGrid;
      case "folder":
        return FolderOpen;
      case "file":
        return FileText;
      case "git":
        return GitCompare;
      case "refresh":
        return RefreshCcw;
      case "alert":
        return AlertTriangle;
      case "puzzle":
        return Puzzle;
      case "users":
        return Users;
      case "cube":
        return Box;
      case "code":
        return Code;
      case "database":
        return Database;
      case "book":
        return BookOpen;
      case "folder2":
        return Folder;
      case "chart":
        return BarChart3;
      case "settings":
        return Settings;
      case "zap":
        return Zap;
      default:
        return FileText;
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    showAddDisciplineModal && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: resetAndCloseModal }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Add New Discipline" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: resetAndCloseModal,
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsxs("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: [
              "Discipline Name ",
              /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: newDisciplineName,
                onChange: (e) => {
                  setNewDisciplineName(e.target.value);
                  if (e.target.value.trim()) setDisciplineNameError(false);
                },
                placeholder: "e.g., Civil Engineering",
                className: cn(
                  "w-full rounded-[10px] border bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1",
                  disciplineNameError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-[#E5E7EB] focus:border-[#155DFC] focus:ring-[#155DFC]"
                )
              }
            ),
            disciplineNameError && /* @__PURE__ */ jsx("p", { className: "text-[13px] text-red-500 mt-1", children: "Discipline name is required" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Description" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: newDisciplineDescription,
                onChange: (e) => setNewDisciplineDescription(e.target.value),
                placeholder: "Brief description of this discipline...",
                rows: 3,
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Color" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "h-12 w-16 rounded-[10px] border border-[#E5E7EB]",
                  style: { backgroundColor: newDisciplineColor }
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: newDisciplineColor,
                  onChange: (e) => setNewDisciplineColor(e.target.value),
                  className: "flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                }
              ),
              /* @__PURE__ */ jsx(
                "label",
                {
                  htmlFor: "color-picker",
                  className: "flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors cursor-pointer",
                  children: "Pick Color"
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "color",
                  value: newDisciplineColor,
                  onChange: (e) => setNewDisciplineColor(e.target.value),
                  className: "sr-only",
                  id: "color-picker"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282] mt-2", children: "Choose a color to represent this discipline" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: resetAndCloseModal,
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleAddDiscipline,
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Add Discipline"
            }
          )
        ] })
      ] })
    ] }),
    showTemplatesModal && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => setShowTemplatesModal(false) }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[600px] max-w-[90vw] max-h-[85vh] flex flex-col", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Project Templates" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setShowTemplatesModal(false),
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "p-6 overflow-y-auto flex-1", children: /* @__PURE__ */ jsx("div", { className: "space-y-4", children: projectTemplates.map((template) => {
          const TemplateIcon = getTemplateIcon(template.icon);
          return /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between mb-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx("div", { className: "h-12 w-12 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]", children: /* @__PURE__ */ jsx(TemplateIcon, { className: "h-6 w-6" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: template.name }),
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: template.description })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => handleApplyTemplate(template),
                  className: "rounded-[10px] bg-[#155DFC] h-9 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
                  children: "Apply"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: template.pages.map((page, index) => {
              const PageIcon = getPageIcon(page.icon);
              return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] text-[13px] text-[#374151]", children: [
                /* @__PURE__ */ jsx(PageIcon, { className: "h-3.5 w-3.5" }),
                page.name
              ] }, index);
            }) })
          ] }, template.id);
        }) }) })
      ] })
    ] }),
    showAddPageModal && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => setShowAddPageModal(false) }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Add New Page" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setShowAddPageModal(false),
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Page Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: newPageName,
                onChange: (e) => setNewPageName(e.target.value),
                placeholder: "e.g., 3D Viewer, Reports, Analytics",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-3", children: "Select Icon" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-4 gap-3", children: pageIconOptions.map((option) => {
              const IconComponent = option.icon;
              return /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setNewPageIcon(option.id),
                  className: cn(
                    "h-16 rounded-[10px] border-2 flex items-center justify-center transition-all",
                    newPageIcon === option.id ? "border-[#155DFC] bg-[#EEF2FF] text-[#155DFC]" : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#9CA3AF]"
                  ),
                  children: /* @__PURE__ */ jsx(IconComponent, { className: "h-6 w-6" })
                },
                option.id
              );
            }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setShowAddPageModal(false),
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleAddPage,
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Add Page"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex h-full", children: [
      /* @__PURE__ */ jsxs("div", { className: "w-[220px] border-r border-[#E5E7EB] bg-[#F9FAFB] flex flex-col fixed left-0 top-[105px] bottom-0 overflow-visible z-10", children: [
        /* @__PURE__ */ jsxs("div", { className: "p-8 flex-1", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-normal text-[#616874] uppercase tracking-wider mb-3", children: "Project Settings" }),
          /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-1", children: settingsMenuItems.map((item) => {
            const Icon = item.icon;
            return /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setActiveMenu(item.id),
                className: cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-normal transition-all duration-150 text-left",
                  activeMenu === item.id ? "bg-white text-[#111827] shadow-sm" : "text-[#616874] hover:bg-white/60 hover:text-[#111827] active:bg-white"
                ),
                children: [
                  /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }),
                  item.label
                ]
              },
              item.id
            );
          }) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "p-8 shrink-0", children: /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setShowDeleteProjectModal(true),
            className: "flex items-center gap-2 text-[14px] font-normal text-red-500 hover:text-red-600 transition-colors",
            children: [
              /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" }),
              "Delete Project"
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto ml-[220px]", children: [
        activeMenu === "general" && /* @__PURE__ */ jsx("div", { className: "py-6 px-6 lg:px-[40px] xl:px-[80px]", children: /* @__PURE__ */ jsxs("div", { className: "max-w-[560px]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828] mb-6", children: "General Settings" }),
          /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-normal text-[#101828] mb-2", children: "Project Thumbnail" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "h-20 w-32 rounded-[10px] border border-[#E5E7EB] bg-gray-100 overflow-hidden", children: /* @__PURE__ */ jsx(
                "img",
                {
                  src: projectThumbnail,
                  alt: "Project thumbnail",
                  className: "h-full w-full object-cover"
                }
              ) }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "file",
                  ref: fileInputRef,
                  onChange: handleImageUpload,
                  accept: "image/*",
                  className: "hidden"
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: handleChangeImage,
                  className: "inline-flex items-center gap-2 text-[14px] text-[#155DFC] hover:underline",
                  children: [
                    /* @__PURE__ */ jsx(Upload, { className: "h-4 w-4" }),
                    "Change image"
                  ]
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-normal text-[#101828] mb-2", children: "Project Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: name,
                onChange: (e) => setName(e.target.value),
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-normal text-[#101828] mb-2", children: "Description" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: description,
                onChange: (e) => setDescription(e.target.value),
                rows: 4,
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-6 pb-6 border-b border-[#E5E7EB]", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-normal text-[#101828] mb-2", children: "Project Code" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: code,
                onChange: (e) => setCode(e.target.value),
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Disciplines" }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setShowAddDisciplineModal(true),
                  className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-9 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap",
                  children: [
                    /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
                    "Add Discipline"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-3", children: [
              isLoadingDisciplines && /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-8", children: /* @__PURE__ */ jsx(Loader2, { className: "h-6 w-6 animate-spin text-[#155DFC]" }) }),
              !isLoadingDisciplines && disciplines.length === 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-8 text-center", children: [
                /* @__PURE__ */ jsx("div", { className: "h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3", children: /* @__PURE__ */ jsx(FileText, { className: "h-6 w-6 text-gray-400" }) }),
                /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282] mb-1", children: "No disciplines yet" }),
                /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#9CA3AF]", children: "Add a discipline to organize change requests" })
              ] }),
              !isLoadingDisciplines && disciplines.map((discipline) => /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "flex items-center justify-between p-4 rounded-[10px] border border-[#E5E7EB] bg-white",
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: cn("h-10 w-10 rounded-lg flex items-center justify-center", getColorClass(discipline.color)), children: /* @__PURE__ */ jsxs("svg", { className: "h-5 w-5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                        /* @__PURE__ */ jsx("path", { d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" }),
                        /* @__PURE__ */ jsx("line", { x1: "7", y1: "7", x2: "7.01", y2: "7" })
                      ] }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: discipline.name }),
                        /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: discipline.description })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          onClick: () => handleEditDiscipline(discipline),
                          className: "p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
                          children: /* @__PURE__ */ jsx(Pencil, { className: "h-4 w-4" })
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          onClick: () => handleDeleteDiscipline(discipline.id),
                          className: "p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors",
                          children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
                        }
                      )
                    ] })
                  ]
                },
                discipline.id
              ))
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-end mt-8", children: [
            generalSaveState === "success" && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mr-4 text-[14px] text-green-600", children: [
              /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }),
              "Settings saved successfully!"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: handleSaveGeneralSettings,
                disabled: generalSaveState === "saving",
                className: cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  generalSaveState === "saving" ? "bg-blue-400 text-white cursor-not-allowed" : "bg-[#155DFC] text-white hover:bg-blue-700"
                ),
                children: generalSaveState === "saving" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }),
                  "Saving..."
                ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                  "Save Changes"
                ] })
              }
            )
          ] })
        ] }) }),
        activeMenu === "pages" && /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828] mb-6", children: "Custom Pages" }),
          showSaveSuccess && /* @__PURE__ */ jsxs("div", { className: "mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[14px] flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }),
            "Pages saved successfully!"
          ] }),
          templateApplied && /* @__PURE__ */ jsxs("div", { className: "mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[14px] flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }),
            'Template "',
            templateApplied,
            '" applied successfully!'
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-1", children: "Quick Start with Templates" }),
              /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Apply a pre-configured page layout based on your project type" })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setShowTemplatesModal(true),
                className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
                children: "Browse Templates"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-5", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Navigation Pages" }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setShowAddPageModal(true),
                  className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-9 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
                  children: [
                    /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
                    "Add Page"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "space-y-0 divide-y divide-[#E5E7EB]", children: navigationPages.map((page) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-4 first:pt-0 last:pb-0", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                /* @__PURE__ */ jsx("button", { className: "text-[#9CA3AF] hover:text-[#6A7282] cursor-grab", children: /* @__PURE__ */ jsx(GripVertical, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-[8px] bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]", children: (() => {
                  const PageIconComponent = getPageIcon(page.icon);
                  return /* @__PURE__ */ jsx(PageIconComponent, { className: "h-5 w-5" });
                })() }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("span", { className: cn("text-[14px] font-medium", page.isVisible ? "text-[#101828]" : "text-[#9CA3AF]"), children: page.name }),
                    page.isDefault && /* @__PURE__ */ jsx("span", { className: "text-[11px] font-medium text-[#10B981] bg-[#D1FAE5] px-2 py-0.5 rounded", children: "Default" }),
                    !page.isVisible && /* @__PURE__ */ jsx("span", { className: "text-[11px] font-medium text-[#6A7282] bg-[#F3F4F6] px-2 py-0.5 rounded", children: "Hidden" })
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: page.isVisible ? "Visible in navigation" : "Hidden from navigation" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => handleTogglePageVisibility(page.id),
                    className: cn(
                      "p-2 rounded-lg transition-colors",
                      page.isVisible ? "text-[#10B981] hover:bg-emerald-50" : "text-[#9CA3AF] hover:bg-gray-100"
                    ),
                    title: page.isVisible ? "Hide page" : "Show page",
                    children: page.isVisible ? /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => handleEditPage(page),
                    className: "p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
                    title: "Edit page",
                    children: /* @__PURE__ */ jsx(Pencil, { className: "h-4 w-4" })
                  }
                ),
                !page.isDefault && /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => handleDeletePage(page.id),
                    className: "p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors",
                    title: "Delete page",
                    children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
                  }
                )
              ] })
            ] }, page.id)) })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 mb-6", children: /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-[#374151]", children: [
            /* @__PURE__ */ jsx("span", { className: "mr-2", children: "💡" }),
            /* @__PURE__ */ jsx("span", { className: "font-medium", children: "Tip:" }),
            " Drag pages to reorder them. Default pages cannot be deleted but can be hidden."
          ] }) }),
          /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleSavePages,
              disabled: !pagesModified,
              className: cn(
                "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                pagesModified ? "bg-[#155DFC] text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              ),
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                "Save Changes"
              ]
            }
          ) })
        ] }),
        activeMenu === "tasks" && /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-6", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Task Tags Management" }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setShowAddTagModal(true),
                className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
                children: [
                  /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
                  "Add Tag"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-3", children: taskTags.map((tag) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "flex items-center justify-between p-4 rounded-[12px] border border-[#E5E7EB] bg-white",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "h-10 w-10 rounded-[8px] flex items-center justify-center",
                      style: { backgroundColor: `${tag.color}15` },
                      children: /* @__PURE__ */ jsx(Tag, { className: "h-5 w-5", style: { color: tag.color } })
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: tag.name }),
                    /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: tag.description })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => handleEditTag(tag),
                      className: "p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
                      title: "Edit tag",
                      children: /* @__PURE__ */ jsx(Pencil, { className: "h-4 w-4" })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => handleDeleteTag(tag.id),
                      className: "p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors",
                      title: "Delete tag",
                      children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ]
            },
            tag.id
          )) })
        ] }),
        activeMenu === "workflow" && /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828] mb-8", children: "Workflow Configuration" }),
          /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282] mb-4", children: "Select Workflow Template" }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  onClick: () => setSelectedWorkflow("construction"),
                  className: cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === "construction" ? "border-[#155DFC] bg-[#F8FAFF]" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                  ),
                  children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6A7282]", children: /* @__PURE__ */ jsx(GitBranch, { className: "h-5 w-5" }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Construction Standard" }),
                        /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282] mb-3", children: "Traditional construction workflow with 5 stages" }),
                        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1 flex-wrap", children: ["Backlog", "To Do", "In Progress", "Review", "Done"].map((stage, idx) => /* @__PURE__ */ jsxs("span", { className: "flex items-center", children: [
                          /* @__PURE__ */ jsx("span", { className: "px-3 py-1 rounded bg-[#F3F4F6] text-[13px] text-[#374151]", children: stage }),
                          idx < 4 && /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4 text-[#9CA3AF] mx-1" })
                        ] }, stage)) })
                      ] })
                    ] }),
                    selectedWorkflow === "construction" && /* @__PURE__ */ jsx(CheckCircle2, { className: "h-5 w-5 text-[#155DFC]" })
                  ] })
                }
              ),
              /* @__PURE__ */ jsx(
                "div",
                {
                  onClick: () => setSelectedWorkflow("agile"),
                  className: cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === "agile" ? "border-[#155DFC] bg-[#F8FAFF]" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                  ),
                  children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6A7282]", children: /* @__PURE__ */ jsx(GitBranch, { className: "h-5 w-5" }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Agile Scrum" }),
                        /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282] mb-3", children: "Scrum-based workflow with sprint planning" }),
                        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1 flex-wrap", children: ["Product Backlog", "Sprint Backlog", "In Progress", "Testing", "Review", "Done"].map((stage, idx) => /* @__PURE__ */ jsxs("span", { className: "flex items-center", children: [
                          /* @__PURE__ */ jsx("span", { className: "px-3 py-1 rounded bg-[#F3F4F6] text-[13px] text-[#374151]", children: stage }),
                          idx < 5 && /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4 text-[#9CA3AF] mx-1" })
                        ] }, stage)) })
                      ] })
                    ] }),
                    selectedWorkflow === "agile" && /* @__PURE__ */ jsx(CheckCircle2, { className: "h-5 w-5 text-[#155DFC]" })
                  ] })
                }
              ),
              /* @__PURE__ */ jsx(
                "div",
                {
                  onClick: () => setSelectedWorkflow("design"),
                  className: cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === "design" ? "border-[#155DFC] bg-[#F8FAFF]" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                  ),
                  children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6A7282]", children: /* @__PURE__ */ jsx(GitBranch, { className: "h-5 w-5" }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Design Review" }),
                        /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282] mb-3", children: "Streamlined design approval process" }),
                        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1 flex-wrap", children: ["Draft", "Review", "Revision", "Approved"].map((stage, idx) => /* @__PURE__ */ jsxs("span", { className: "flex items-center", children: [
                          /* @__PURE__ */ jsx("span", { className: "px-3 py-1 rounded bg-[#F3F4F6] text-[13px] text-[#374151]", children: stage }),
                          idx < 3 && /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4 text-[#9CA3AF] mx-1" })
                        ] }, stage)) })
                      ] })
                    ] }),
                    selectedWorkflow === "design" && /* @__PURE__ */ jsx(CheckCircle2, { className: "h-5 w-5 text-[#155DFC]" })
                  ] })
                }
              ),
              /* @__PURE__ */ jsx(
                "div",
                {
                  onClick: () => setSelectedWorkflow("custom"),
                  className: cn(
                    "rounded-[12px] border-2 p-5 cursor-pointer transition-all",
                    selectedWorkflow === "custom" ? "border-[#155DFC] bg-[#F8FAFF]" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                  ),
                  children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6A7282]", children: /* @__PURE__ */ jsx(GitBranch, { className: "h-5 w-5" }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Custom Workflow" }),
                        /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Create your own workflow stages" })
                      ] })
                    ] }),
                    selectedWorkflow === "custom" && /* @__PURE__ */ jsx(CheckCircle2, { className: "h-5 w-5 text-[#155DFC]" })
                  ] })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-8", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-5", children: "Workflow Settings" }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
              /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-3 cursor-pointer", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: workflowSettings.autoAssign,
                    onChange: (e) => setWorkflowSettings({ ...workflowSettings, autoAssign: e.target.checked }),
                    className: "mt-1 h-4 w-4 rounded border-gray-300 text-[#155DFC] focus:ring-[#155DFC]"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-medium text-[#101828]", children: "Auto-assign tasks" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: "Automatically assign tasks based on team member roles" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-3 cursor-pointer", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: workflowSettings.notifyStatusChange,
                    onChange: (e) => setWorkflowSettings({ ...workflowSettings, notifyStatusChange: e.target.checked }),
                    className: "mt-1 h-4 w-4 rounded border-gray-300 text-[#155DFC] focus:ring-[#155DFC]"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-medium text-[#101828]", children: "Notify on status change" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: "Send notifications when task status changes" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-3 cursor-pointer", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: workflowSettings.requireApproval,
                    onChange: (e) => setWorkflowSettings({ ...workflowSettings, requireApproval: e.target.checked }),
                    className: "mt-1 h-4 w-4 rounded border-gray-300 text-[#155DFC] focus:ring-[#155DFC]"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-medium text-[#101828]", children: "Require approval for completion" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: "Tasks must be approved before marking as done" })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3", children: [
            workflowApplyState === "success" && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[14px] text-green-600", children: [
              /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }),
              "Workflow applied successfully!"
            ] }),
            /* @__PURE__ */ jsx("button", { className: "h-10 px-5 rounded-[10px] text-[14px] font-medium text-[#374151] hover:bg-gray-100 transition-colors", children: "Cancel" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: async () => {
                  setWorkflowApplyState("applying");
                  await new Promise((resolve) => setTimeout(resolve, 1e3));
                  setWorkflowApplyState("success");
                  setTimeout(() => setWorkflowApplyState("idle"), 3e3);
                },
                disabled: workflowApplyState === "applying",
                className: cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  workflowApplyState === "applying" ? "bg-blue-400 text-white cursor-not-allowed" : "bg-[#155DFC] text-white hover:bg-blue-700"
                ),
                children: workflowApplyState === "applying" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }),
                  "Applying..."
                ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                  "Apply Workflow"
                ] })
              }
            )
          ] })
        ] }),
        activeMenu === "permissions" && /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828] mb-6", children: "Permissions & Access Control" }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-medium text-[#6A7282] mb-4", children: "Role Permissions Matrix" }),
            /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2 mb-6 border-b border-[#E5E7EB] pb-4", children: ["Owner", "Admin", "Member", "Viewer"].map((role) => {
              const badge = getRoleBadge(role);
              const count = role === "Owner" ? 1 : role === "Admin" ? 3 : role === "Member" ? 12 : 5;
              return /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setSelectedRole(role),
                  className: cn(
                    "px-3 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5 transition-colors",
                    selectedRole === role ? `${badge.bg} ${badge.color}` : "text-[#6A7282] hover:bg-gray-100"
                  ),
                  children: [
                    role,
                    /* @__PURE__ */ jsxs("span", { className: cn("text-[12px]", selectedRole === role ? badge.color : "text-[#9CA3AF]"), children: [
                      "(",
                      count,
                      ")"
                    ] })
                  ]
                },
                role
              );
            }) }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: cn("px-2 py-0.5 rounded text-[12px] font-medium", getRoleBadge(selectedRole).bg, getRoleBadge(selectedRole).color), children: selectedRole }),
                /* @__PURE__ */ jsx("span", { className: "text-[13px] text-[#6A7282] bg-[#F3F4F6] px-2 py-0.5 rounded", children: "Default Role" })
              ] }),
              /* @__PURE__ */ jsxs("span", { className: "text-[13px] text-[#6A7282]", children: [
                selectedRole === "Admin" ? "3" : selectedRole === "Owner" ? "1" : selectedRole === "Member" ? "12" : "5",
                " members with this role"
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "space-y-0 divide-y divide-[#E5E7EB]", children: permissionCategories.map((category) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "h-9 w-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6A7282]", children: [
                  category.icon === "file" && /* @__PURE__ */ jsx(FileText, { className: "h-4 w-4" }),
                  category.icon === "git" && /* @__PURE__ */ jsx(GitCompare, { className: "h-4 w-4" }),
                  category.icon === "list" && /* @__PURE__ */ jsx(ListTodo, { className: "h-4 w-4" }),
                  category.icon === "package" && /* @__PURE__ */ jsx(FolderOpen, { className: "h-4 w-4" }),
                  category.icon === "alert" && /* @__PURE__ */ jsx(AlertTriangle, { className: "h-4 w-4" }),
                  category.icon === "box" && /* @__PURE__ */ jsx(Box, { className: "h-4 w-4" }),
                  category.icon === "settings" && /* @__PURE__ */ jsx(Settings, { className: "h-4 w-4" }),
                  category.icon === "users" && /* @__PURE__ */ jsx(Users, { className: "h-4 w-4" })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: category.name }),
                  /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: category.description })
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1", children: ["none", "view", "edit", "manage"].map((level) => /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => handlePermissionChange(selectedRole, category.id, level),
                  className: cn(
                    "px-3 py-1.5 rounded text-[13px] font-medium capitalize transition-colors",
                    permissionMatrix[selectedRole]?.[category.id] === level ? level === "manage" ? "bg-orange-100 text-orange-600" : level === "edit" ? "bg-green-100 text-green-600" : level === "view" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600" : "text-[#6A7282] hover:bg-gray-50"
                  ),
                  children: level === "none" ? "None" : level.charAt(0).toUpperCase() + level.slice(1)
                },
                level
              )) })
            ] }, category.id)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-medium text-[#101828]", children: "Team Members" }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setShowInviteModal(true),
                  className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-9 px-4 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
                  children: [
                    /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
                    "Invite"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "space-y-0 divide-y divide-[#E5E7EB]", children: teamMembers.map((member) => {
              const badge = getRoleBadge(member.role);
              return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                  /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-full bg-[#155DFC] flex items-center justify-center text-white text-[14px] font-medium", children: member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: member.name }),
                    /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: member.email })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                  /* @__PURE__ */ jsx("span", { className: cn("px-2 py-0.5 rounded text-[12px] font-medium", badge.bg, badge.color), children: member.role }),
                  /* @__PURE__ */ jsxs("span", { className: "text-[13px] text-[#6A7282]", children: [
                    "Joined ",
                    member.joinedDate
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => setShowInviteModal(true),
                      className: "p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
                      title: "Edit member",
                      children: /* @__PURE__ */ jsx(Pencil, { className: "h-4 w-4" })
                    }
                  ),
                  member.role !== "Owner" && /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => setTeamMembers(teamMembers.filter((m) => m.id !== member.id)),
                      className: "p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors",
                      title: "Remove member",
                      children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ] }, member.id);
            }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-medium text-[#101828] mb-4", children: "Permission Levels" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-8", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("div", { className: "h-3 w-3 rounded-full bg-orange-500" }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-medium text-orange-600", children: "Manage" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: "Full control" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("div", { className: "h-3 w-3 rounded-full bg-green-500" }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-medium text-green-600", children: "Edit" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: "Modify content" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("div", { className: "h-3 w-3 rounded-full bg-blue-500" }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-medium text-blue-600", children: "View" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: "Read-only access" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("div", { className: "h-3 w-3 rounded-full bg-gray-400" }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-medium text-gray-600", children: "None" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: "No access" })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3", children: [
            permissionsSaveState === "success" && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[14px] text-green-600", children: [
              /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }),
              "Permissions saved successfully!"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: async () => {
                  setPermissionsSaveState("saving");
                  await new Promise((resolve) => setTimeout(resolve, 1e3));
                  setPermissionsSaveState("success");
                  setTimeout(() => setPermissionsSaveState("idle"), 3e3);
                },
                disabled: permissionsSaveState === "saving",
                className: cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  permissionsSaveState === "saving" ? "bg-blue-400 text-white cursor-not-allowed" : "bg-[#155DFC] text-white hover:bg-blue-700"
                ),
                children: permissionsSaveState === "saving" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }),
                  "Saving..."
                ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                  "Save Changes"
                ] })
              }
            )
          ] })
        ] }),
        activeMenu === "roles" && /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-6", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Role Management" }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setShowCreateRoleModal(true),
                className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
                children: [
                  /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
                  "Create Role"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-4", children: roles.map((role) => {
            const badge = getAccessLevelBadge(role.accessLevel);
            return /* @__PURE__ */ jsx("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "h-12 w-12 rounded-[10px] flex items-center justify-center",
                    style: { backgroundColor: `${role.color}15` },
                    children: /* @__PURE__ */ jsx(Shield, { className: "h-6 w-6", style: { color: role.color } })
                  }
                ),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
                    /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: role.name }),
                    /* @__PURE__ */ jsx("span", { className: cn("px-2 py-0.5 rounded text-[11px] font-medium", badge.bg, badge.color), children: badge.text }),
                    role.isSystem && /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1 px-2 py-0.5 rounded bg-[#F3F4F6] text-[11px] font-medium text-[#6A7282]", children: [
                      /* @__PURE__ */ jsx(Lock, { className: "h-3 w-3" }),
                      "System Role"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282] mb-3", children: role.description }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
                    role.permissions.slice(0, 5).map((perm, idx) => /* @__PURE__ */ jsx("span", { className: "px-2 py-1 rounded bg-[#F3F4F6] text-[12px] text-[#374151]", children: perm }, idx)),
                    role.permissions.length > 5 && /* @__PURE__ */ jsxs("span", { className: "px-2 py-1 rounded bg-[#F3F4F6] text-[12px] text-[#6A7282]", children: [
                      "+",
                      role.permissions.length - 5,
                      " more"
                    ] })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 text-[#6A7282]", children: [
                  /* @__PURE__ */ jsx(Users, { className: "h-4 w-4" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[14px]", children: role.memberCount })
                ] }),
                !role.isSystem && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("button", { className: "p-2 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors", children: /* @__PURE__ */ jsx(Pencil, { className: "h-4 w-4" }) }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => handleDeleteRole(role.id),
                      className: "p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors",
                      children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ] })
            ] }) }, role.id);
          }) })
        ] }),
        activeMenu === "notifications" && /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828] mb-6", children: "Notification Settings" }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white mb-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-5 border-b border-[#E5E7EB]", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Notification Channels" }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-8", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[13px] text-[#6A7282]", children: [
                  /* @__PURE__ */ jsx(Mail, { className: "h-4 w-4" }),
                  "Email"
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[13px] text-[#6A7282]", children: [
                  /* @__PURE__ */ jsx(Bell, { className: "h-4 w-4" }),
                  "In-App"
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[13px] text-[#6A7282]", children: [
                  /* @__PURE__ */ jsx(MessageSquare, { className: "h-4 w-4" }),
                  "Push"
                ] })
              ] })
            ] }),
            ["Tasks", "Documents", "Changes", "Team"].map((category) => /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB]", children: /* @__PURE__ */ jsx("h4", { className: "text-[13px] font-medium text-[#374151] uppercase tracking-wide", children: category }) }),
              notifications.filter((n) => n.category === category).map((notification) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] last:border-b-0", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: notification.title }),
                  /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: notification.description })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-8", children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => handleToggleNotification(notification.id, "email"),
                      className: cn(
                        "h-5 w-5 rounded-full flex items-center justify-center transition-colors border-2",
                        notification.email ? "bg-[#155DFC] border-[#155DFC] text-white" : "bg-white border-[#D1D5DB]"
                      ),
                      children: notification.email && /* @__PURE__ */ jsx(Check, { className: "h-3 w-3" })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => handleToggleNotification(notification.id, "inApp"),
                      className: cn(
                        "h-5 w-5 rounded-full flex items-center justify-center transition-colors border-2",
                        notification.inApp ? "bg-[#155DFC] border-[#155DFC] text-white" : "bg-white border-[#D1D5DB]"
                      ),
                      children: notification.inApp && /* @__PURE__ */ jsx(Check, { className: "h-3 w-3" })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => handleToggleNotification(notification.id, "push"),
                      className: cn(
                        "h-5 w-5 rounded-full flex items-center justify-center transition-colors border-2",
                        notification.push ? "bg-[#155DFC] border-[#155DFC] text-white" : "bg-white border-[#D1D5DB]"
                      ),
                      children: notification.push && /* @__PURE__ */ jsx(Check, { className: "h-3 w-3" })
                    }
                  )
                ] })
              ] }, notification.id))
            ] }, category))
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5 mb-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]", children: /* @__PURE__ */ jsx(Clock, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "Quiet Hours" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Pause notifications during specific hours" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [
                /* @__PURE__ */ jsx("input", { type: "checkbox", className: "sr-only peer" }),
                /* @__PURE__ */ jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#155DFC]" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 ml-13", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "text-[13px] text-[#6A7282] mb-1 block", children: "From" }),
                /* @__PURE__ */ jsx("input", { type: "time", defaultValue: "22:00", className: "rounded-lg border border-[#E5E7EB] px-3 py-2 text-[14px]" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "text-[13px] text-[#6A7282] mb-1 block", children: "To" }),
                /* @__PURE__ */ jsx("input", { type: "time", defaultValue: "08:00", className: "rounded-lg border border-[#E5E7EB] px-3 py-2 text-[14px]" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3", children: [
            notificationsSaveState === "success" && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[14px] text-green-600", children: [
              /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }),
              "Notification settings saved!"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: async () => {
                  setNotificationsSaveState("saving");
                  await new Promise((resolve) => setTimeout(resolve, 1e3));
                  setNotificationsSaveState("success");
                  setTimeout(() => setNotificationsSaveState("idle"), 3e3);
                },
                disabled: notificationsSaveState === "saving",
                className: cn(
                  "inline-flex items-center gap-2 rounded-[10px] h-10 px-5 text-[14px] font-medium transition-colors",
                  notificationsSaveState === "saving" ? "bg-blue-400 text-white cursor-not-allowed" : "bg-[#155DFC] text-white hover:bg-blue-700"
                ),
                children: notificationsSaveState === "saving" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }),
                  "Saving..."
                ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                  "Save Changes"
                ] })
              }
            )
          ] })
        ] }),
        activeMenu === "integrations" && /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828] mb-6", children: "Integrations" }),
          /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-4", children: "Connected" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-4", children: integrations.filter((i) => i.connected).map((integration) => /* @__PURE__ */ jsx("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "h-12 w-12 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center", children: [
                  integration.icon === "drive" && /* @__PURE__ */ jsx(Globe, { className: "h-6 w-6 text-[#4285F4]" }),
                  integration.icon === "slack" && /* @__PURE__ */ jsx(MessageSquare, { className: "h-6 w-6 text-[#E01E5A]" }),
                  integration.icon === "autodesk" && /* @__PURE__ */ jsx(Box, { className: "h-6 w-6 text-[#0696D7]" })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-[16px] font-medium text-[#101828]", children: integration.name }),
                    /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[11px] font-medium text-green-600", children: [
                      /* @__PURE__ */ jsx("div", { className: "h-1.5 w-1.5 rounded-full bg-green-500" }),
                      "Connected"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: integration.description })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("button", { className: "px-4 py-2 rounded-lg text-[14px] font-medium text-[#374151] hover:bg-gray-100 transition-colors", children: "Configure" }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => handleToggleIntegration(integration.id),
                    className: "px-4 py-2 rounded-lg text-[14px] font-medium text-red-500 hover:bg-red-50 transition-colors",
                    children: "Disconnect"
                  }
                )
              ] })
            ] }) }, integration.id)) })
          ] }),
          ["storage", "communication", "project", "cad"].map((category) => {
            const availableInCategory = integrations.filter((i) => !i.connected && i.category === category);
            if (availableInCategory.length === 0) return null;
            const categoryLabels = {
              storage: "Cloud Storage",
              communication: "Communication",
              project: "Project Management",
              cad: "CAD & BIM Tools"
            };
            return /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-4", children: categoryLabels[category] }),
              /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: availableInCategory.map((integration) => /* @__PURE__ */ jsx("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                  /* @__PURE__ */ jsxs("div", { className: "h-12 w-12 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center", children: [
                    integration.icon === "dropbox" && /* @__PURE__ */ jsx(Box, { className: "h-6 w-6 text-[#0061FF]" }),
                    integration.icon === "onedrive" && /* @__PURE__ */ jsx(Globe, { className: "h-6 w-6 text-[#0078D4]" }),
                    integration.icon === "teams" && /* @__PURE__ */ jsx(Users, { className: "h-6 w-6 text-[#6264A7]" }),
                    integration.icon === "jira" && /* @__PURE__ */ jsx(Zap, { className: "h-6 w-6 text-[#0052CC]" }),
                    integration.icon === "revit" && /* @__PURE__ */ jsx(Box, { className: "h-6 w-6 text-[#0696D7]" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: integration.name }),
                    /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: integration.description })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => handleToggleIntegration(integration.id),
                    className: "inline-flex items-center gap-2 rounded-[10px] border border-[#155DFC] bg-white h-9 px-4 text-[14px] font-medium text-[#155DFC] hover:bg-blue-50 transition-colors",
                    children: [
                      /* @__PURE__ */ jsx(Link2, { className: "h-4 w-4" }),
                      "Connect"
                    ]
                  }
                )
              ] }) }, integration.id)) })
            ] }, category);
          }),
          /* @__PURE__ */ jsx("div", { className: "rounded-[12px] border border-[#E5E7EB] bg-white p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "h-12 w-12 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]", children: /* @__PURE__ */ jsx(Zap, { className: "h-6 w-6" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828]", children: "API Access" }),
                /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Generate API keys to integrate with custom applications" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => {
                  const key = "sk_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
                  setGeneratedApiKey(key);
                  setShowApiKeyModal(true);
                },
                className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
                children: [
                  /* @__PURE__ */ jsx(Key, { className: "h-4 w-4" }),
                  "Generate API Key"
                ]
              }
            )
          ] }) })
        ] })
      ] })
    ] }),
    showEditDisciplineModal && editingDiscipline && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: resetAndCloseModal }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Edit Discipline" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: resetAndCloseModal,
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsxs("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: [
              "Discipline Name ",
              /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: newDisciplineName,
                onChange: (e) => {
                  setNewDisciplineName(e.target.value);
                  if (e.target.value.trim()) setDisciplineNameError(false);
                },
                placeholder: "e.g., Civil Engineering",
                className: cn(
                  "w-full rounded-[10px] border bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1",
                  disciplineNameError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-[#E5E7EB] focus:border-[#155DFC] focus:ring-[#155DFC]"
                )
              }
            ),
            disciplineNameError && /* @__PURE__ */ jsx("p", { className: "text-[13px] text-red-500 mt-1", children: "Discipline name is required" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Description" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: newDisciplineDescription,
                onChange: (e) => setNewDisciplineDescription(e.target.value),
                placeholder: "Brief description of this discipline...",
                rows: 3,
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Color" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "h-10 w-10 rounded-lg flex-shrink-0 border border-[#E5E7EB]",
                  style: { backgroundColor: newDisciplineColor }
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: newDisciplineColor,
                  onChange: (e) => setNewDisciplineColor(e.target.value),
                  className: "flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "color",
                  value: newDisciplineColor,
                  onChange: (e) => setNewDisciplineColor(e.target.value),
                  className: "sr-only",
                  id: "edit-color-picker"
                }
              ),
              /* @__PURE__ */ jsxs(
                "label",
                {
                  htmlFor: "edit-color-picker",
                  className: "flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors cursor-pointer",
                  children: [
                    /* @__PURE__ */ jsx(RefreshCcw, { className: "h-4 w-4" }),
                    "Change Color"
                  ]
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: resetAndCloseModal,
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleSaveEditedDiscipline,
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Save Changes"
            }
          )
        ] })
      ] })
    ] }),
    showEditPageModal && editingPage && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => {
        setShowEditPageModal(false);
        setEditingPage(null);
      } }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Edit Page" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowEditPageModal(false);
                setEditingPage(null);
              },
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Page Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: newPageName,
                onChange: (e) => setNewPageName(e.target.value),
                placeholder: "e.g., 3D Viewer, Reports, Analytics",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-3", children: "Select Icon" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-4 gap-3", children: pageIconOptions.map((option) => {
              const IconComponent = option.icon;
              return /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setNewPageIcon(option.id),
                  className: cn(
                    "h-16 rounded-[10px] border-2 flex items-center justify-center transition-all",
                    newPageIcon === option.id ? "border-[#155DFC] bg-[#EEF2FF] text-[#155DFC]" : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#9CA3AF]"
                  ),
                  children: /* @__PURE__ */ jsx(IconComponent, { className: "h-6 w-6" })
                },
                option.id
              );
            }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowEditPageModal(false);
                setEditingPage(null);
              },
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleSaveEditedPage,
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Save Changes"
            }
          )
        ] })
      ] })
    ] }),
    showEditTagModal && editingTag && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => {
        setShowEditTagModal(false);
        setEditingTag(null);
      } }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Edit Tag" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowEditTagModal(false);
                setEditingTag(null);
              },
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Tag Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: editTagName,
                onChange: (e) => setEditTagName(e.target.value),
                placeholder: "e.g., urgent, review",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Description" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: editTagDescription,
                onChange: (e) => setEditTagDescription(e.target.value),
                placeholder: "Brief description of this tag...",
                rows: 3,
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Color" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "h-12 w-16 rounded-[10px] border border-[#E5E7EB]",
                  style: { backgroundColor: editTagColor }
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "color",
                  value: editTagColor,
                  onChange: (e) => setEditTagColor(e.target.value),
                  className: "h-12 w-16 rounded-[10px] border border-[#E5E7EB] cursor-pointer"
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: editTagColor,
                  onChange: (e) => setEditTagColor(e.target.value),
                  className: "flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowEditTagModal(false);
                setEditingTag(null);
                setEditTagName("");
                setEditTagDescription("");
                setEditTagColor("#6366F1");
              },
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleSaveEditedTag,
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Save Changes"
            }
          )
        ] })
      ] })
    ] }),
    showInviteModal && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => {
        setShowInviteModal(false);
        setInviteEmail("");
        setInviteRole("");
      } }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Invite Team Member" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowInviteModal(false);
                setInviteEmail("");
                setInviteRole("");
              },
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Email Address" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "email",
                value: inviteEmail,
                onChange: (e) => setInviteEmail(e.target.value),
                placeholder: "colleague@company.com",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Role" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: inviteRole,
                onChange: (e) => setInviteRole(e.target.value),
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "Select a role" }),
                  /* @__PURE__ */ jsx("option", { value: "Admin", children: "Admin" }),
                  /* @__PURE__ */ jsx("option", { value: "Manager", children: "Manager" }),
                  /* @__PURE__ */ jsx("option", { value: "Member", children: "Member" }),
                  /* @__PURE__ */ jsx("option", { value: "Viewer", children: "Viewer" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] bg-[#F9FAFB] p-4", children: [
            /* @__PURE__ */ jsx("h4", { className: "text-[13px] font-medium text-[#6A7282] mb-3", children: "Role Permissions:" }),
            /* @__PURE__ */ jsx("div", { className: "space-y-2", children: [
              { key: "documents", label: "Documents & Drawings" },
              { key: "versions", label: "Version Control" },
              { key: "tasks", label: "Tasks & Workflows" },
              { key: "packages", label: "Packages" }
            ].map((permission) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[14px] text-[#101828]", children: permission.label }),
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: invitePermissions[permission.key],
                  onChange: (e) => setInvitePermissions({ ...invitePermissions, [permission.key]: e.target.value }),
                  className: "text-[14px] font-medium text-[#818CF8] bg-transparent border-none focus:outline-none cursor-pointer",
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "View", children: "View" }),
                    /* @__PURE__ */ jsx("option", { value: "Edit", children: "Edit" }),
                    /* @__PURE__ */ jsx("option", { value: "Manage", children: "Manage" }),
                    /* @__PURE__ */ jsx("option", { value: "None", children: "None" })
                  ]
                }
              )
            ] }, permission.key)) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowInviteModal(false);
                setInviteEmail("");
                setInviteRole("");
              },
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                if (inviteEmail && inviteRole) {
                  const newMember = {
                    id: Date.now().toString(),
                    name: inviteEmail.split("@")[0].split(".").map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(" "),
                    email: inviteEmail,
                    role: inviteRole,
                    joinedDate: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  };
                  setTeamMembers([...teamMembers, newMember]);
                  setShowInviteModal(false);
                  setInviteEmail("");
                  setInviteRole("");
                }
              },
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Send Invite"
            }
          )
        ] })
      ] })
    ] }),
    showAddTagModal && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => {
        setShowAddTagModal(false);
        setNewTagName("");
        setNewTagDescription("");
        setNewTagColor("#6366F1");
      } }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Add New Tag" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowAddTagModal(false);
                setNewTagName("");
                setNewTagDescription("");
                setNewTagColor("#6366F1");
              },
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsxs("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: [
              "Tag Name ",
              /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: newTagName,
                onChange: (e) => setNewTagName(e.target.value),
                placeholder: "e.g., urgent, review",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Description" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: newTagDescription,
                onChange: (e) => setNewTagDescription(e.target.value),
                placeholder: "Brief description of this tag...",
                rows: 3,
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Color" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "color",
                  value: newTagColor,
                  onChange: (e) => setNewTagColor(e.target.value),
                  className: "h-12 w-16 rounded-[10px] border border-[#E5E7EB] cursor-pointer"
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: newTagColor,
                  onChange: (e) => setNewTagColor(e.target.value),
                  className: "flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowAddTagModal(false);
                setNewTagName("");
                setNewTagDescription("");
                setNewTagColor("#6366F1");
              },
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: async () => {
                if (!newTagName.trim()) return;
                const newTag = {
                  id: Date.now().toString(),
                  name: newTagName.trim().toLowerCase(),
                  description: newTagDescription.trim(),
                  color: newTagColor
                };
                const previous = taskTags;
                const next = [...taskTags, newTag];
                setTaskTags(next);
                try {
                  const ok = await persistTaskTags(next);
                  if (!ok) {
                    setTaskTags(previous);
                    toast.error("Failed to add tag");
                    return;
                  }
                } catch {
                  setTaskTags(previous);
                  toast.error("Failed to add tag");
                  return;
                }
                setShowAddTagModal(false);
                setNewTagName("");
                setNewTagDescription("");
                setNewTagColor("#6366F1");
              },
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Add Tag"
            }
          )
        ] })
      ] })
    ] }),
    showCreateRoleModal && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => setShowCreateRoleModal(false) }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[600px] max-w-[90vw] my-8 max-h-[90vh] overflow-y-auto", children: [
        /* @__PURE__ */ jsxs("div", { className: "sticky top-0 bg-white flex items-center justify-between p-6 border-b border-[#E5E7EB] z-10", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "Create New Role" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setShowCreateRoleModal(false),
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsxs("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: [
              "Role Name ",
              /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: newRoleName,
                onChange: (e) => setNewRoleName(e.target.value),
                placeholder: "e.g., Senior Architect",
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Description" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: newRoleDescription,
                onChange: (e) => setNewRoleDescription(e.target.value),
                placeholder: "Brief description of this role's responsibilities...",
                rows: 3,
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4 mb-6", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Color" }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "color",
                    value: newRoleColor,
                    onChange: (e) => setNewRoleColor(e.target.value),
                    className: "h-12 w-14 rounded-[10px] border border-[#E5E7EB] cursor-pointer"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    value: newRoleColor,
                    onChange: (e) => setNewRoleColor(e.target.value),
                    className: "flex-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Permission Level" }),
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: newRolePermissionLevel,
                  onChange: (e) => setNewRolePermissionLevel(e.target.value),
                  className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]",
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "full", children: "Full Access" }),
                    /* @__PURE__ */ jsx("option", { value: "high", children: "High Access" }),
                    /* @__PURE__ */ jsx("option", { value: "medium", children: "Medium Access" }),
                    /* @__PURE__ */ jsx("option", { value: "minimal", children: "Minimal Access" })
                  ]
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] bg-[#F9FAFB] p-4 mb-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-4", children: [
              /* @__PURE__ */ jsx(FileText, { className: "h-5 w-5 text-[#6A7282]" }),
              /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: "Content Permissions" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3", children: [
              { key: "viewAll", label: "View All", desc: "View all project content", icon: Eye },
              { key: "editOwn", label: "Edit Own", desc: "Edit own content only", icon: FileText },
              { key: "editAll", label: "Edit All", desc: "Edit all project content", icon: FileText },
              { key: "createContent", label: "Create Content", desc: "Create new content", icon: Plus },
              { key: "deleteContent", label: "Delete Content", desc: "Delete project content", icon: Trash2 },
              { key: "approveChanges", label: "Approve Changes", desc: "Approve change requests", icon: FileText },
              { key: "submitChanges", label: "Submit Changes", desc: "Submit change requests", icon: Circle }
            ].map((perm) => {
              const Icon = perm.icon;
              return /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setNewRoleContentPerms({ ...newRoleContentPerms, [perm.key]: !newRoleContentPerms[perm.key] }),
                  className: cn(
                    "p-3 rounded-[10px] border text-left transition-all",
                    newRoleContentPerms[perm.key] ? "border-[#155DFC] bg-[#EEF2FF]" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                  ),
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
                      /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4 text-[#6A7282]" }),
                      /* @__PURE__ */ jsx("span", { className: "text-[13px] font-medium text-[#101828]", children: perm.label })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: perm.desc })
                  ]
                },
                perm.key
              );
            }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] bg-[#F9FAFB] p-4 mb-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-4", children: [
              /* @__PURE__ */ jsx(Users, { className: "h-5 w-5 text-[#6A7282]" }),
              /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: "Team Permissions" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3", children: [
              { key: "viewTeam", label: "View Team", desc: "View team members", icon: Eye },
              { key: "manageTeam", label: "Manage Team", desc: "Add/remove team members", icon: UserPlus },
              { key: "assignTasks", label: "Assign Tasks", desc: "Assign tasks to members", icon: UserPlus },
              { key: "manageRoles", label: "Manage Roles", desc: "Edit member roles", icon: UserPlus }
            ].map((perm) => {
              const Icon = perm.icon;
              return /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setNewRoleTeamPerms({ ...newRoleTeamPerms, [perm.key]: !newRoleTeamPerms[perm.key] }),
                  className: cn(
                    "p-3 rounded-[10px] border text-left transition-all",
                    newRoleTeamPerms[perm.key] ? "border-[#155DFC] bg-[#EEF2FF]" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                  ),
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
                      /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4 text-[#6A7282]" }),
                      /* @__PURE__ */ jsx("span", { className: "text-[13px] font-medium text-[#101828]", children: perm.label })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: perm.desc })
                  ]
                },
                perm.key
              );
            }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[12px] bg-[#F9FAFB] p-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-4", children: [
              /* @__PURE__ */ jsx(Settings, { className: "h-5 w-5 text-[#6A7282]" }),
              /* @__PURE__ */ jsx("h4", { className: "text-[14px] font-medium text-[#101828]", children: "Settings Permissions" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3", children: [
              { key: "viewSettings", label: "View Settings", desc: "View project settings", icon: Eye },
              { key: "manageSettings", label: "Manage Settings", desc: "Edit project settings", icon: UserPlus },
              { key: "manageWorkflow", label: "Manage Workflow", desc: "Configure workflow", icon: UserPlus },
              { key: "manageIntegrations", label: "Manage Integrations", desc: "Configure integrations", icon: UserPlus }
            ].map((perm) => {
              const Icon = perm.icon;
              return /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setNewRoleSettingsPerms({ ...newRoleSettingsPerms, [perm.key]: !newRoleSettingsPerms[perm.key] }),
                  className: cn(
                    "p-3 rounded-[10px] border text-left transition-all",
                    newRoleSettingsPerms[perm.key] ? "border-[#155DFC] bg-[#EEF2FF]" : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF]"
                  ),
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
                      /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4 text-[#6A7282]" }),
                      /* @__PURE__ */ jsx("span", { className: "text-[13px] font-medium text-[#101828]", children: perm.label })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: perm.desc })
                  ]
                },
                perm.key
              );
            }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "sticky bottom-0 bg-white flex items-center gap-3 p-6 border-t border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setShowCreateRoleModal(false),
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                if (newRoleName.trim()) {
                  const selectedPerms = [];
                  Object.entries(newRoleContentPerms).forEach(([key, val]) => {
                    if (val) selectedPerms.push(key.replace(/([A-Z])/g, " $1").trim());
                  });
                  Object.entries(newRoleTeamPerms).forEach(([key, val]) => {
                    if (val) selectedPerms.push(key.replace(/([A-Z])/g, " $1").trim());
                  });
                  Object.entries(newRoleSettingsPerms).forEach(([key, val]) => {
                    if (val) selectedPerms.push(key.replace(/([A-Z])/g, " $1").trim());
                  });
                  const newRole = {
                    id: Date.now().toString(),
                    name: newRoleName.trim(),
                    accessLevel: newRolePermissionLevel,
                    isSystem: false,
                    memberCount: 0,
                    description: newRoleDescription.trim() || "Custom role",
                    permissions: selectedPerms.length > 0 ? selectedPerms : ["View All"],
                    color: newRoleColor
                  };
                  setRoles([...roles, newRole]);
                  setShowCreateRoleModal(false);
                  setNewRoleName("");
                  setNewRoleDescription("");
                  setNewRoleColor("#6366f1");
                  setNewRolePermissionLevel("medium");
                  setNewRoleContentPerms({ viewAll: false, editOwn: false, editAll: false, createContent: false, deleteContent: false, approveChanges: false, submitChanges: false });
                  setNewRoleTeamPerms({ viewTeam: false, manageTeam: false, assignTasks: false, manageRoles: false });
                  setNewRoleSettingsPerms({ viewSettings: false, manageSettings: false, manageWorkflow: false, manageIntegrations: false });
                }
              },
              className: "flex-1 h-11 rounded-[10px] bg-[#818CF8] text-[14px] font-medium text-white hover:bg-[#6366F1] transition-colors",
              children: "Create Role"
            }
          )
        ] })
      ] })
    ] }),
    showApiKeyModal && generatedApiKey && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => {
        setShowApiKeyModal(false);
        setGeneratedApiKey(null);
      } }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[520px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-[#101828]", children: "API Key Generated" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowApiKeyModal(false);
                setGeneratedApiKey(null);
              },
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-4 rounded-[10px] bg-[#FEF3C7] border border-[#F59E0B] mb-5", children: [
            /* @__PURE__ */ jsx(AlertTriangle, { className: "h-5 w-5 text-[#F59E0B] flex-shrink-0" }),
            /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#92400E]", children: "Make sure to copy your API key now. You won't be able to see it again!" })
          ] }),
          /* @__PURE__ */ jsx("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: "Your API Key" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: generatedApiKey,
                readOnly: true,
                className: "flex-1 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#101828] font-mono"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => {
                  navigator.clipboard.writeText(generatedApiKey);
                },
                className: "h-12 px-4 rounded-[10px] border border-[#E5E7EB] bg-white text-[#374151] hover:bg-gray-50 transition-colors",
                children: /* @__PURE__ */ jsx(Copy, { className: "h-5 w-5" })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-3 p-6 pt-2", children: /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setShowApiKeyModal(false);
              setGeneratedApiKey(null);
            },
            className: "flex-1 h-11 rounded-[10px] bg-[#155DFC] text-[14px] font-medium text-white hover:bg-blue-700 transition-colors",
            children: "Done"
          }
        ) })
      ] })
    ] }),
    showDeleteProjectModal && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30", onClick: () => {
        setShowDeleteProjectModal(false);
        setDeleteProjectConfirmText("");
      } }),
      /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-[16px] shadow-xl w-[480px] max-w-[90vw]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-6 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[20px] font-medium text-red-600", children: "Delete Project" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowDeleteProjectModal(false);
                setDeleteProjectConfirmText("");
              },
              className: "p-1 rounded-lg text-[#6A7282] hover:bg-gray-100 transition-colors",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-4 rounded-[10px] bg-red-50 border border-red-200 mb-5", children: [
            /* @__PURE__ */ jsx(AlertTriangle, { className: "h-5 w-5 text-red-500 flex-shrink-0" }),
            /* @__PURE__ */ jsx("p", { className: "text-[13px] text-red-700", children: "This action cannot be undone. This will permanently delete the project and all associated data." })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block text-[14px] font-medium text-[#374151] mb-2", children: [
            "Type ",
            /* @__PURE__ */ jsx("span", { className: "font-mono text-red-600", children: "DELETE" }),
            " to confirm"
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: deleteProjectConfirmText,
              onChange: (e) => setDeleteProjectConfirmText(e.target.value),
              placeholder: "Type DELETE to confirm",
              className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#101828] placeholder:text-[#9CA3AF] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-6 pt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setShowDeleteProjectModal(false);
                setDeleteProjectConfirmText("");
              },
              className: "flex-1 h-11 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                if (deleteProjectConfirmText === "DELETE") {
                  navigate();
                }
              },
              disabled: deleteProjectConfirmText !== "DELETE",
              className: cn(
                "flex-1 h-11 rounded-[10px] text-[14px] font-medium transition-colors",
                deleteProjectConfirmText === "DELETE" ? "bg-red-600 text-white hover:bg-red-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              ),
              children: "Delete Project"
            }
          )
        ] })
      ] })
    ] })
  ] });
}

const STATUS_CFG = {
  pending: { label: "Pending", bg: "bg-[#FEF3C7]", text: "text-[#B45309]" },
  "in-progress": { label: "In Progress", bg: "bg-[#EEF2FF]", text: "text-[#432DD7]" },
  approved: { label: "Approved", bg: "bg-[#ECFDF5]", text: "text-[#007A55]" },
  completed: { label: "Completed", bg: "bg-[#ECFDF5]", text: "text-[#007A55]" },
  rejected: { label: "Rejected", bg: "bg-[#FEE2E2]", text: "text-[#DC2626]" }
};
const PRIORITY_CFG = {
  urgent: { label: "Urgent", bg: "bg-[#FFF1F2]", text: "text-[#C70036]" },
  high: { label: "High", bg: "bg-[#FFF1F2]", text: "text-[#C70036]" },
  medium: { label: "Medium", bg: "bg-[#F0F9FF]", text: "text-[#0069A8]" },
  low: { label: "Low", bg: "bg-[#F3F4F6]", text: "text-[#364153]" }
};
const ICON_BG = { pending: "bg-[#EEF2FF]", "in-progress": "bg-[#EEF2FF]", approved: "bg-[#ECFDF5]", completed: "bg-[#ECFDF5]", rejected: "bg-[#FEE2E2]" };
const ICON_STROKE = { pending: "#4F39F6", "in-progress": "#4F39F6", approved: "#009966", completed: "#009966", rejected: "#DC2626" };
const MAX_ATTACH_SIZE = 50 * 1024 * 1024;
const MODEL_EXT = /\.(ifc|rvt|dwg|dxf|nwd|nwf|nwc|skp|fbx|obj|3ds|step|stp)$/i;
function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function fmtRel(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 6e4);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function CrIcon({ status }) {
  const s = ICON_STROKE[status];
  return /* @__PURE__ */ jsxs("svg", { className: "h-6 w-6", viewBox: "0 0 24 24", fill: "none", children: [
    /* @__PURE__ */ jsx("path", { d: "M12.659 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8.00001C20.0008 7.68312 19.9388 7.36921 19.8176 7.0764C19.6964 6.78359 19.5185 6.51768 19.294 6.29401L15.706 2.70601C15.4823 2.48153 15.2164 2.30357 14.9236 2.18239C14.6308 2.06122 14.3169 1.99923 14 2.00001H6C5.46957 2.00001 4.96086 2.21072 4.58579 2.58579C4.21071 2.96087 4 3.46957 4 4.00001V13.34", stroke: s, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }),
    /* @__PURE__ */ jsx("path", { d: "M14 2V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H20", stroke: s, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }),
    /* @__PURE__ */ jsx("path", { d: "M10.378 12.6219C10.7762 12.224 11.3162 12.0007 11.8791 12.001C12.442 12.0013 12.9817 12.2251 13.3795 12.6234C13.7773 13.0216 14.0007 13.5615 14.0004 14.1244C14.0001 14.6873 13.7762 15.227 13.378 15.6249L8.36002 20.6369C8.1224 20.8746 7.82869 21.0486 7.50602 21.1429L4.63902 21.9799C4.55298 22.005 4.46176 22.0065 4.37493 21.9842C4.2881 21.962 4.20885 21.9168 4.14547 21.8534C4.08209 21.79 4.03691 21.7108 4.01467 21.6239C3.99242 21.5371 3.99393 21.4459 4.01902 21.3599L4.85502 18.4909C4.9494 18.1686 5.12341 17.8752 5.36102 17.6379L10.378 12.6219Z", stroke: s, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })
  ] });
}
function FileIcon({ className }) {
  return /* @__PURE__ */ jsxs("svg", { className: cn("h-4 w-4", className), viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.33, children: [
    /* @__PURE__ */ jsx("path", { d: "M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z" }),
    /* @__PURE__ */ jsx("path", { d: "M9.33333 1.33333V5.33333H13.3333" })
  ] });
}
function Avatar({ name, color }) {
  const initials = (name || "").split(" ").map((w) => w?.[0]).join("").toUpperCase().slice(0, 2) || "?";
  const bg = color || "#6366f1";
  return /* @__PURE__ */ jsx(
    "span",
    {
      title: name,
      className: "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
      style: { backgroundColor: bg },
      children: initials
    }
  );
}
function MemberPicker({
  label,
  members = [],
  selected,
  onChange
}) {
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
    /* @__PURE__ */ jsx("label", { className: "text-[14px] font-medium text-[#101828]", children: label }),
    !members || members.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#6A7282]", children: "No team members available." }) : /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] max-h-[150px] overflow-y-auto", children: members.map((m) => {
      const checked = selected.includes(m.userId);
      return /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked,
            onChange: () => toggle(m.userId),
            className: "h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]"
          }
        ),
        /* @__PURE__ */ jsx(Avatar, { name: m.user?.fullName }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#101828] truncate", children: m.user?.fullName }),
          /* @__PURE__ */ jsx("p", { className: "text-[11px] text-[#6A7282] truncate", children: m.role })
        ] })
      ] }, m.userId);
    }) }),
    selected.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1", children: selected.map((id) => {
      const m = members.find((x) => x.userId === id);
      return m ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-1 pr-2 py-0.5 text-[11px] text-[#1D4ED8]", children: [
        /* @__PURE__ */ jsx(Avatar, { name: m.user?.fullName, color: "#3B82F6" }),
        m.user?.fullName,
        /* @__PURE__ */ jsx("button", { type: "button", onClick: () => toggle(id), className: "ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold", children: "×" })
      ] }, id) : null;
    }) })
  ] });
}
function AttachPicker({
  files,
  onChange
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const add = (incoming) => {
    if (!incoming) return;
    const valid = [];
    Array.from(incoming).forEach((f) => {
      if (f.size > MAX_ATTACH_SIZE) {
        toast.error(`"${f.name}" exceeds 50 MB limit`);
      } else {
        valid.push(f);
      }
    });
    onChange([...files, ...valid]);
  };
  const remove = (idx) => onChange(files.filter((_, i) => i !== idx));
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
    /* @__PURE__ */ jsxs("label", { className: "text-[14px] font-medium text-[#101828]", children: [
      "Attachments ",
      /* @__PURE__ */ jsx("span", { className: "font-normal text-[#6A7282]", children: "(max 50 MB each)" })
    ] }),
    files.length > 0 && /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] divide-y divide-[#F3F4F6] bg-white", children: files.map((f, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5", children: [
      /* @__PURE__ */ jsx(FileIcon, { className: "shrink-0 text-[#6A7282]" }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#101828] truncate", children: f.name }),
        /* @__PURE__ */ jsx("p", { className: "text-[11px] text-[#6A7282]", children: fmtSize(f.size) })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => remove(i),
          className: "shrink-0 p-1 text-[#99A1AF] hover:text-[#DC2626] transition-colors rounded",
          children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
        }
      )
    ] }, i)) }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        onDragOver: (e) => {
          e.preventDefault();
          setDrag(true);
        },
        onDragLeave: () => setDrag(false),
        onDrop: (e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        },
        onClick: () => inputRef.current?.click(),
        className: cn(
          "flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed py-6 cursor-pointer transition-colors",
          drag ? "border-[#155DFC] bg-[#EFF6FF]" : "border-[#D1D5DC] bg-[#F9FAFB] hover:border-[#155DFC] hover:bg-[#F0F6FF]"
        ),
        children: [
          /* @__PURE__ */ jsxs("svg", { className: "h-8 w-8 text-[#99A1AF]", viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.5, children: [
            /* @__PURE__ */ jsx("path", { d: "M21.333 21.333L16 16L10.667 21.333", strokeLinecap: "round", strokeLinejoin: "round" }),
            /* @__PURE__ */ jsx("path", { d: "M16 16V28", strokeLinecap: "round", strokeLinejoin: "round" }),
            /* @__PURE__ */ jsx("path", { d: "M27.187 24.52C28.458 23.787 29.431 22.63 29.936 21.246C30.441 19.862 30.447 18.34 29.953 16.952C29.459 15.564 28.495 14.399 27.229 13.656C25.964 12.913 24.477 12.641 23.04 12.88H21.467C21.029 11.207 20.207 9.66 19.067 8.368C17.927 7.077 16.502 6.078 14.905 5.454C13.309 4.829 11.586 4.598 9.879 4.778C8.172 4.959 6.531 5.546 5.096 6.489C3.66 7.433 2.471 8.707 1.626 10.207C0.78 11.707 0.304 13.39 0.238 15.114C0.172 16.839 0.519 18.555 1.249 20.117C1.979 21.68 3.069 23.043 4.427 24.093", strokeLinecap: "round", strokeLinejoin: "round" })
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-[#364153]", children: [
            "Drop files here or ",
            /* @__PURE__ */ jsx("span", { className: "text-[#155DFC] font-medium", children: "browse" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: "PDF, DWG, RVT, IFC, JPG, PNG — max 50 MB" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: inputRef,
              type: "file",
              multiple: true,
              className: "hidden",
              onChange: (e) => {
                add(e.target.files);
                e.target.value = "";
              }
            }
          )
        ]
      }
    )
  ] });
}
function CreateModal({ projectPublicId, disciplines, modelFiles, teamMembers, loadingFiles, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [estimatedImpact, setEstimatedImpact] = useState("");
  const [detailedDescription, setDetailedDesc] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [deadline, setDeadline] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [affectedModels, setAffectedModels] = useState([]);
  const [assignedTo, setAssignedTo] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const toggleModel = (id) => setAffectedModels((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!estimatedImpact) {
      toast.error("Estimated Impact is required");
      return;
    }
    setSubmitting(true);
    try {
      let res;
      if (attachments.length > 0) {
        const form = new FormData();
        form.append("title", title.trim());
        form.append("description", description.trim());
        form.append("priority", priority);
        form.append("estimatedImpact", estimatedImpact);
        if (detailedDescription.trim()) form.append("detailedDescription", detailedDescription.trim());
        if (estimatedCost.trim()) form.append("estimatedCost", estimatedCost.trim());
        if (estimatedDuration.trim()) form.append("estimatedDuration", estimatedDuration.trim());
        if (deadline) form.append("deadline", deadline);
        if (disciplineId) form.append("disciplineId", disciplineId);
        affectedModels.forEach((m) => form.append("affectedModels[]", m));
        assignedTo.forEach((a) => form.append("assignedTo[]", a));
        reviewers.forEach((r) => form.append("reviewers[]", r));
        attachments.forEach((f) => form.append("attachments", f));
        res = await apiFetch(`/api/projects/${projectPublicId}/change-requests`, { method: "POST", body: form });
      } else {
        res = await apiFetch(`/api/projects/${projectPublicId}/change-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            priority,
            estimatedImpact,
            detailedDescription: detailedDescription.trim() || void 0,
            estimatedCost: estimatedCost.trim() ? Number(estimatedCost) : void 0,
            estimatedDuration: estimatedDuration.trim() || void 0,
            deadline: deadline || void 0,
            disciplineId: disciplineId || null,
            affectedModels,
            assignedTo,
            reviewers
          })
        });
      }
      const data = await res.json();
      if (data.success) {
        toast.success("Change request created");
        onCreated(data.data);
        onClose();
      } else {
        toast.error(data.message || "Failed to create change request");
      }
    } catch {
      toast.error("Failed to create change request");
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", onClick: onClose, children: [
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30 backdrop-blur-sm" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "relative z-10 w-full max-w-[680px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[92vh] flex flex-col",
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] shrink-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EFF6FF]", children: /* @__PURE__ */ jsxs("svg", { className: "h-5 w-5", viewBox: "0 0 20 20", fill: "none", children: [
                /* @__PURE__ */ jsx("path", { d: "M10 4.16667V15.8333", stroke: "#155DFC", strokeWidth: "1.67", strokeLinecap: "round", strokeLinejoin: "round" }),
                /* @__PURE__ */ jsx("path", { d: "M4.16667 10H15.8333", stroke: "#155DFC", strokeWidth: "1.67", strokeLinecap: "round", strokeLinejoin: "round" })
              ] }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h2", { className: "text-[18px] font-semibold text-[#101828]", children: "Create Change Request" }),
                /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: "Submit a change request for review" })
              ] })
            ] }),
            /* @__PURE__ */ jsx("button", { onClick: onClose, className: "p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto px-6 py-5 space-y-5", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsxs("label", { className: "text-[14px] font-medium text-[#101828]", children: [
                "Title ",
                /* @__PURE__ */ jsx("span", { className: "text-[#FF2056]", children: "*" })
              ] }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  placeholder: "Enter change request title...",
                  value: title,
                  onChange: (e) => setTitle(e.target.value),
                  className: "w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsxs("label", { className: "text-[14px] font-medium text-[#101828]", children: [
                "Priority ",
                /* @__PURE__ */ jsx("span", { className: "text-[#FF2056]", children: "*" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "grid grid-cols-4 gap-2", children: ["low", "medium", "high", "urgent"].map((p) => /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setPriority(p),
                  className: cn(
                    "h-10 rounded-[10px] text-[14px] capitalize transition-colors border",
                    priority === p ? "bg-[#F0F9FF] border-[#155DFC] text-[#0069A8]" : "bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                  ),
                  children: p.charAt(0).toUpperCase() + p.slice(1)
                },
                p
              )) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsxs("label", { className: "text-[14px] font-medium text-[#101828]", children: [
                "Estimated Impact ",
                /* @__PURE__ */ jsx("span", { className: "text-[#FF2056]", children: "*" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-2", children: [
                { val: "low", label: "Low", active: "bg-[#F0FDF4] border-[#22C55E] text-[#15803D]", dot: "bg-[#22C55E]" },
                { val: "medium", label: "Medium", active: "bg-[#FFFBEB] border-[#F59E0B] text-[#B45309]", dot: "bg-[#F59E0B]" },
                { val: "high", label: "High", active: "bg-[#FFF1F2] border-[#F43F5E] text-[#C70036]", dot: "bg-[#F43F5E]" }
              ].map(({ val, label, active, dot }) => /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => setEstimatedImpact(val),
                  className: cn(
                    "h-10 rounded-[10px] text-[14px] font-medium transition-colors border flex items-center justify-center gap-2",
                    estimatedImpact === val ? active : "bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50"
                  ),
                  children: [
                    /* @__PURE__ */ jsx("span", { className: cn("h-2 w-2 rounded-full", estimatedImpact === val ? dot : "bg-[#D1D5DC]") }),
                    label
                  ]
                },
                val
              )) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsxs("label", { className: "text-[14px] font-medium text-[#101828]", children: [
                "Description ",
                /* @__PURE__ */ jsx("span", { className: "text-[#FF2056]", children: "*" })
              ] }),
              /* @__PURE__ */ jsx(
                "textarea",
                {
                  placeholder: "Brief description of the requested change...",
                  value: description,
                  onChange: (e) => setDescription(e.target.value),
                  rows: 2,
                  className: "w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsxs("label", { className: "text-[14px] font-medium text-[#101828]", children: [
                "Detailed Description ",
                /* @__PURE__ */ jsx("span", { className: "text-[12px] font-normal text-[#6A7282]", children: "(optional)" })
              ] }),
              /* @__PURE__ */ jsx(
                "textarea",
                {
                  placeholder: "Provide a thorough explanation of the change, its rationale, and expected outcomes...",
                  value: detailedDescription,
                  onChange: (e) => setDetailedDesc(e.target.value),
                  rows: 4,
                  className: "w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("label", { className: "text-[14px] font-medium text-[#101828]", children: "Estimated Cost" }),
                /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsx("span", { className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#6A7282] select-none", children: "$" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "number",
                      min: 0,
                      placeholder: "0.00",
                      value: estimatedCost,
                      onChange: (e) => setEstimatedCost(e.target.value),
                      className: "w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-7 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("label", { className: "text-[14px] font-medium text-[#101828]", children: "Estimated Duration" }),
                /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6A7282]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "text",
                      placeholder: "e.g. 2 weeks",
                      value: estimatedDuration,
                      onChange: (e) => setEstimatedDuration(e.target.value),
                      className: "w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-9 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                    }
                  )
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("label", { className: "text-[14px] font-medium text-[#101828]", children: "Deadline" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "date",
                    value: deadline,
                    onChange: (e) => setDeadline(e.target.value),
                    className: "w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [color-scheme:light]"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("label", { className: "text-[14px] font-medium text-[#101828]", children: "Discipline" }),
                disciplines.length === 0 ? /* @__PURE__ */ jsxs("p", { className: "text-[13px] text-[#6A7282] mt-1", children: [
                  "No disciplines — add in ",
                  /* @__PURE__ */ jsx("strong", { children: "Settings" }),
                  "."
                ] }) : /* @__PURE__ */ jsxs(
                  "select",
                  {
                    value: disciplineId,
                    onChange: (e) => setDisciplineId(e.target.value),
                    className: "w-full h-[38px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "", children: "Select discipline..." }),
                      disciplines.map((d) => /* @__PURE__ */ jsx("option", { value: d.id, children: d.name }, d.id))
                    ]
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsx(MemberPicker, { label: "Assigned To", members: teamMembers, selected: assignedTo, onChange: setAssignedTo }),
              /* @__PURE__ */ jsx(MemberPicker, { label: "Reviewers", members: teamMembers, selected: reviewers, onChange: setReviewers })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsx("label", { className: "text-[14px] font-medium text-[#101828]", children: "Affected Models" }),
              loadingFiles ? /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]", children: "Loading model files…" }) : modelFiles.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]", children: [
                "No model files found. Upload IFC/RVT/DWG files in the ",
                /* @__PURE__ */ jsx("strong", { children: "Documents" }),
                " tab."
              ] }) : /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto", children: modelFiles.map((f) => /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: affectedModels.includes(f.id),
                    onChange: () => toggleModel(f.id),
                    className: "h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]"
                  }
                ),
                /* @__PURE__ */ jsx(FileIcon, { className: "shrink-0 text-[#6A7282]" }),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#101828] truncate", children: f.name }),
                  f.folderPath && /* @__PURE__ */ jsx("p", { className: "text-[11px] text-[#6A7282] truncate", children: f.folderPath })
                ] })
              ] }, f.id)) }),
              affectedModels.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1", children: affectedModels.map((id) => {
                const f = modelFiles.find((m) => m.id === id);
                return f ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[11px] text-[#1D4ED8]", children: [
                  f.name,
                  /* @__PURE__ */ jsx("button", { type: "button", onClick: () => toggleModel(id), className: "ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold", children: "×" })
                ] }, id) : null;
              }) })
            ] }),
            /* @__PURE__ */ jsx(AttachPicker, { files: attachments, onChange: setAttachments })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] shrink-0", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? "s" : ""} attached` : "" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("button", { onClick: onClose, className: "px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors", children: "Cancel" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: handleSubmit,
                  disabled: submitting,
                  className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-5 py-2 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60",
                  children: submitting ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 animate-spin", fill: "none", viewBox: "0 0 24 24", children: [
                      /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
                      /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })
                    ] }),
                    "Creating…"
                  ] }) : "Create Request"
                }
              )
            ] })
          ] })
        ]
      }
    )
  ] });
}
function DetailModal({
  cr,
  disciplines,
  modelFiles,
  teamMembers,
  onClose,
  onStatusChange
}) {
  const [updating, setUpdating] = useState(false);
  const disc = disciplines.find((d) => d.id === cr.disciplineId);
  const sc = STATUS_CFG[cr.status];
  const pc = PRIORITY_CFG[cr.priority];
  const handleStatus = async (status) => {
    setUpdating(true);
    try {
      const res = await apiFetch("/api/change-requests/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crId: cr.publicId, status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status → ${status}`);
        onStatusChange(cr.publicId, status);
      } else toast.error(data.message || "Failed to update");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", onClick: onClose, children: [
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30 backdrop-blur-sm" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "relative z-10 w-full max-w-[600px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[90vh] flex flex-col",
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between px-6 py-5 border-b border-[#E5E7EB] shrink-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 min-w-0", children: [
              /* @__PURE__ */ jsx("div", { className: cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]", ICON_BG[cr.status]), children: /* @__PURE__ */ jsx(CrIcon, { status: cr.status }) }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-mono text-[13px] text-[#6A7282]", children: cr.crId }),
                  /* @__PURE__ */ jsx("span", { className: cn("rounded px-2 py-0.5 text-[12px]", sc.bg, sc.text), children: sc.label }),
                  /* @__PURE__ */ jsx("span", { className: cn("rounded px-2 py-0.5 text-[12px]", pc.bg, pc.text), children: pc.label })
                ] }),
                /* @__PURE__ */ jsx("h2", { className: "text-[16px] font-semibold text-[#101828] mt-1", children: cr.title })
              ] })
            ] }),
            /* @__PURE__ */ jsx("button", { onClick: onClose, className: "p-2 shrink-0 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto px-6 py-5 space-y-5", children: [
            cr.description && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5", children: "Description" }),
              /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#364153] leading-relaxed", children: cr.description })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              disc && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5", children: "Discipline" }),
                /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium text-white", style: { backgroundColor: disc.color }, children: disc.name })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5", children: "Created" }),
                /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#364153]", children: new Date(cr.createdAt).toLocaleDateString() })
              ] })
            ] }),
            cr.assignedTo.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5", children: "Assigned To" }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: cr.assignedTo.map((id) => {
                const m = teamMembers.find((x) => x.userId === id);
                return m ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-1 pr-2.5 py-0.5 text-[12px] text-[#1D4ED8]", children: [
                  /* @__PURE__ */ jsx(Avatar, { name: m.user?.fullName, color: "#3B82F6" }),
                  m.user?.fullName
                ] }, id) : /* @__PURE__ */ jsx("span", { className: "text-[13px] text-[#6A7282]", children: id }, id);
              }) })
            ] }),
            cr.reviewers.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5", children: "Reviewers" }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: cr.reviewers.map((id) => {
                const m = teamMembers.find((x) => x.userId === id);
                return m ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] pl-1 pr-2.5 py-0.5 text-[12px] text-[#166534]", children: [
                  /* @__PURE__ */ jsx(Avatar, { name: m.user?.fullName, color: "#22C55E" }),
                  m.user?.fullName
                ] }, id) : /* @__PURE__ */ jsx("span", { className: "text-[13px] text-[#6A7282]", children: id }, id);
              }) })
            ] }),
            cr.affectedModels.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5", children: "Affected Models" }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", children: cr.affectedModels.map((id, i) => {
                const f = modelFiles.find((m) => m.id === id);
                return /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-[6px] bg-[#F3F4F6] px-2.5 py-1 text-[12px] text-[#364153]", children: [
                  /* @__PURE__ */ jsx(FileIcon, { className: "text-[#6A7282]" }),
                  f ? f.name : id
                ] }, i);
              }) })
            ] }),
            cr.attachments.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5", children: "Attachments" }),
              /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] divide-y divide-[#F3F4F6]", children: cr.attachments.map((a, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5", children: [
                /* @__PURE__ */ jsx(FileIcon, { className: "shrink-0 text-[#6A7282]" }),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#101828] truncate", children: a.name }),
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] text-[#6A7282]", children: fmtSize(a.size) })
                ] }),
                a.url && /* @__PURE__ */ jsx("a", { href: a.url, target: "_blank", rel: "noopener noreferrer", className: "shrink-0 text-[#155DFC] hover:underline text-[12px]", children: "Download" })
              ] }, i)) })
            ] }),
            cr.status !== "completed" && cr.status !== "rejected" && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-2", children: "Update Status" }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: ["pending", "in-progress", "approved", "completed", "rejected"].filter((s) => s !== cr.status).map((s) => {
                const c = STATUS_CFG[s];
                return /* @__PURE__ */ jsx(
                  "button",
                  {
                    disabled: updating,
                    onClick: () => handleStatus(s),
                    className: cn("rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-transparent transition-colors disabled:opacity-60", c.bg, c.text, "hover:opacity-80"),
                    children: c.label
                  },
                  s
                );
              }) })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex justify-end px-6 py-4 border-t border-[#E5E7EB] shrink-0", children: /* @__PURE__ */ jsx("button", { onClick: onClose, className: "px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]", children: "Close" }) })
        ]
      }
    )
  ] });
}
function ChangesTab({ projectPublicId }) {
  const [changeRequests, setChangeRequests] = useState([]);
  const [loadingCR, setLoadingCR] = useState(true);
  const [disciplines, setDisciplines] = useState([]);
  const [modelFiles, setModelFiles] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailCR, setDetailCR] = useState(null);
  const loadCR = useCallback(async () => {
    setLoadingCR(true);
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/change-requests`);
      if (res.ok) {
        const d = await res.json();
        setChangeRequests(d?.data ?? []);
      }
    } catch {
    } finally {
      setLoadingCR(false);
    }
  }, [projectPublicId]);
  const loadMeta = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const [dRes, docsRes, teamRes] = await Promise.all([
        apiFetch(`/api/projects/${projectPublicId}/disciplines`),
        apiFetch(`/api/projects/packages/documents/list`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: projectPublicId })
        }),
        apiFetch(`/api/projects/member-list`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: projectPublicId })
        })
      ]);
      if (dRes.ok) {
        const d = await dRes.json();
        setDisciplines(d.data || []);
      }
      if (docsRes.ok) {
        const d = await docsRes.json();
        const flatten = (nodes) => {
          const out = [];
          for (const n of nodes ?? []) {
            if (n.type === "file" && MODEL_EXT.test(n.name || "")) out.push({ id: n.id, name: n.name, folderPath: n.folderPath });
            if (n.children) out.push(...flatten(n.children));
          }
          return out;
        };
        const tree = d?.data?.tree;
        if (tree) setModelFiles(flatten(tree.children || []));
      }
      if (teamRes.ok) {
        const d = await teamRes.json();
        setTeamMembers(d?.data || []);
      }
    } catch {
    } finally {
      setLoadingFiles(false);
    }
  }, [projectPublicId]);
  useEffect(() => {
    loadCR();
    loadMeta();
  }, [loadCR, loadMeta]);
  const filtered = changeRequests.filter((cr) => {
    if (filter === "pending" && cr.status !== "pending") return false;
    if (filter === "in-progress" && cr.status !== "in-progress") return false;
    if (filter === "approved" && cr.status !== "approved") return false;
    if (search) {
      const q = search.toLowerCase();
      return cr.title.toLowerCase().includes(q) || cr.crId.toLowerCase().includes(q) || cr.description.toLowerCase().includes(q);
    }
    return true;
  });
  const handleCreated = (cr) => setChangeRequests((p) => [cr, ...p]);
  const handleStatusChange = (id, status) => {
    setChangeRequests((p) => p.map((c) => c.publicId === id ? { ...c, status } : c));
    setDetailCR((p) => p?.publicId === id ? { ...p, status } : p);
  };
  const total = changeRequests.length;
  const pending = changeRequests.filter((c) => c.status === "pending").length;
  const inProgress = changeRequests.filter((c) => c.status === "in-progress").length;
  const approved = changeRequests.filter((c) => c.status === "approved" || c.status === "completed").length;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Change Requests" }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setShowCreate(true),
          className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }),
            "New Request"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-4 gap-4", children: [
      { label: "Total", value: total, color: "text-[#101828]" },
      { label: "Pending", value: pending, color: "text-[#B45309]" },
      { label: "In Progress", value: inProgress, color: "text-[#432DD7]" },
      { label: "Approved", value: approved, color: "text-[#007A55]" }
    ].map((s) => /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282]", children: s.label }),
      /* @__PURE__ */ jsx("p", { className: cn("text-[24px] font-normal mt-1", s.color), children: loadingCR ? "—" : s.value })
    ] }, s.label)) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: ["all", "pending", "in-progress", "approved"].map((f) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setFilter(f),
          className: cn(
            "px-3 py-2 rounded-[10px] text-[12px] transition-colors capitalize",
            filter === f ? "bg-[#F0F9FF] text-[#0069A8]" : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
          ),
          children: f === "all" ? "All" : f === "in-progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)
        },
        f
      )) }),
      /* @__PURE__ */ jsxs("div", { className: "relative flex-1 max-w-sm", children: [
        /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" }) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Search...",
            value: search,
            onChange: (e) => setSearch(e.target.value),
            className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("button", { onClick: loadCR, className: "ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] text-[#364153] hover:bg-gray-50 transition-colors", children: [
        /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" }) }),
        "Refresh"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden", children: loadingCR ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-16", children: /* @__PURE__ */ jsxs("svg", { className: "h-8 w-8 animate-spin text-[#155DFC]", fill: "none", viewBox: "0 0 24 24", children: [
      /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
      /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })
    ] }) }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] mb-3", children: /* @__PURE__ */ jsx("svg", { className: "h-7 w-7 text-[#9CA3AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }) }),
      /* @__PURE__ */ jsx("p", { className: "text-[14px] font-medium text-[#101828]", children: changeRequests.length === 0 ? "No change requests yet" : "No results match the filter" }),
      /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#6A7282] mt-1", children: changeRequests.length === 0 ? "Create your first change request using the button above" : "Try adjusting your search or filter" }),
      changeRequests.length === 0 && /* @__PURE__ */ jsx("button", { onClick: () => setShowCreate(true), className: "mt-4 inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[13px] text-white hover:bg-blue-700 transition-colors", children: "New Request" })
    ] }) : filtered.map((cr, idx) => {
      const sc = STATUS_CFG[cr.status];
      const pc = PRIORITY_CFG[cr.priority];
      const disc = disciplines.find((d) => d.id === cr.disciplineId);
      const assigneeMembers = cr.assignedTo.map((id) => teamMembers.find((m) => m.publicId === id || m.userId === id)).filter(Boolean);
      const reviewerMembers = cr.reviewers.map((id) => teamMembers.find((m) => m.publicId === id || m.userId === id)).filter(Boolean);
      return /* @__PURE__ */ jsxs("div", { className: cn("flex items-start gap-4 px-6 py-5", idx !== filtered.length - 1 && "border-b border-[#E5E7EB]"), children: [
        /* @__PURE__ */ jsx("div", { className: cn("flex h-12 w-12 items-center justify-center rounded-[10px] shrink-0", ICON_BG[cr.status]), children: /* @__PURE__ */ jsx(CrIcon, { status: cr.status }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-1.5", children: [
            /* @__PURE__ */ jsx("span", { className: "font-mono text-[13px] text-[#6A7282]", children: cr.crId }),
            /* @__PURE__ */ jsx("span", { className: cn("rounded px-2 py-0.5 text-[12px]", sc.bg, sc.text), children: sc.label }),
            /* @__PURE__ */ jsx("span", { className: cn("rounded px-2 py-0.5 text-[12px]", pc.bg, pc.text), children: pc.label }),
            disc && /* @__PURE__ */ jsx("span", { className: "rounded px-2 py-0.5 text-[12px] text-white font-medium", style: { backgroundColor: disc.color }, children: disc.name })
          ] }),
          /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-medium text-[#101828] mb-1", children: cr.title }),
          cr.description && /* @__PURE__ */ jsx("p", { className: "text-[13px] text-[#4A5565] mb-3 line-clamp-2", children: cr.description }),
          cr.affectedModels.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 flex-wrap mb-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] text-[#6A7282]", children: "Models:" }),
            cr.affectedModels.slice(0, 3).map((id, i) => {
              const f = modelFiles.find((m) => m.id === id);
              return /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#4A5565]", children: [
                /* @__PURE__ */ jsx(FileIcon, {}),
                f ? f.name : id
              ] }, i);
            }),
            cr.affectedModels.length > 3 && /* @__PURE__ */ jsxs("span", { className: "rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#6A7282]", children: [
              "+",
              cr.affectedModels.length - 3,
              " more"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 text-[12px] text-[#6A7282]", children: [
            assigneeMembers.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
              /* @__PURE__ */ jsx("span", { children: "Assigned:" }),
              /* @__PURE__ */ jsxs("div", { className: "flex -space-x-1.5", children: [
                assigneeMembers.slice(0, 4).map((m) => /* @__PURE__ */ jsx(Avatar, { name: m.user?.fullName, color: "#3B82F6" }, m.userId)),
                assigneeMembers.length > 4 && /* @__PURE__ */ jsxs("span", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E7EB] text-[10px] text-[#4A5565]", children: [
                  "+",
                  assigneeMembers.length - 4
                ] })
              ] })
            ] }),
            reviewerMembers.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
              /* @__PURE__ */ jsx("span", { children: "Review:" }),
              /* @__PURE__ */ jsxs("div", { className: "flex -space-x-1.5", children: [
                reviewerMembers.slice(0, 4).map((m) => /* @__PURE__ */ jsx(Avatar, { name: m.user?.fullName, color: "#22C55E" }, m.userId)),
                reviewerMembers.length > 4 && /* @__PURE__ */ jsxs("span", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E7EB] text-[10px] text-[#4A5565]", children: [
                  "+",
                  reviewerMembers.length - 4
                ] })
              ] })
            ] }),
            cr.attachments.length > 0 && /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" }) }),
              cr.attachments.length,
              " file",
              cr.attachments.length > 1 ? "s" : ""
            ] }),
            /* @__PURE__ */ jsxs("span", { children: [
              "· ",
              fmtRel(cr.createdAt)
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setDetailCR(cr),
            className: "shrink-0 inline-flex items-center rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-gray-50 transition-colors",
            children: "View Details"
          }
        )
      ] }, cr.publicId);
    }) }),
    showCreate && /* @__PURE__ */ jsx(
      CreateModal,
      {
        projectPublicId,
        disciplines,
        modelFiles,
        teamMembers,
        loadingFiles,
        onClose: () => setShowCreate(false),
        onCreated: handleCreated
      }
    ),
    detailCR && /* @__PURE__ */ jsx(
      DetailModal,
      {
        cr: detailCR,
        disciplines,
        modelFiles,
        teamMembers,
        onClose: () => setDetailCR(null),
        onStatusChange: handleStatusChange
      }
    )
  ] });
}

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Overlay,
  {
    ref,
    className: cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    ),
    ...props
  }
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(DialogPortal, { children: [
  /* @__PURE__ */ jsx(DialogOverlay, {}),
  /* @__PURE__ */ jsx(
    DialogPrimitive.Content,
    {
      ref,
      className: cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-lg",
        className
      ),
      ...props,
      children
    }
  )
] }));
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(DialogPrimitive.Title, { ref, className: cn("text-lg font-semibold", className), ...props }));
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(DialogPrimitive.Description, { ref, className: cn("text-sm text-muted-foreground", className), ...props }));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const queryClient = new QueryClient();
const avatarColors = ["bg-pink-500", "bg-emerald-500", "bg-indigo-500", "bg-blue-500", "bg-teal-500", "bg-orange-500"];
const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};
const mockActivities = [
  { id: "1", action: "Version 3.2 approved", user: "Minh Anh", time: "2 hours ago", icon: "check", color: "bg-emerald-100 text-emerald-600" },
  { id: "2", action: "New clash detected", user: "System", time: "3 hours ago", icon: "alert", color: "bg-red-100 text-red-600" },
  { id: "3", action: "Document uploaded", user: "Thu Trang", time: "5 hours ago", icon: "upload", color: "bg-blue-100 text-blue-600" },
  { id: "4", action: "Change request submitted", user: "Tuan Kiet", time: "1 day ago", icon: "edit", color: "bg-purple-100 text-purple-600" }
];
const mockMilestones = [
  { id: "1", name: "Foundation Complete", date: "Jan 15, 2024", status: "completed" },
  { id: "2", name: "Structural Framework", date: "Apr 30, 2024", status: "completed" },
  { id: "3", name: "MEP Installation", date: "Aug 15, 2024", status: "in-progress" },
  { id: "4", name: "Interior Finishing", date: "Nov 30, 2024", status: "upcoming" },
  { id: "5", name: "Final Inspection", date: "Dec 15, 2025", status: "upcoming" }
];
const taskColumns = [
  { id: "backlog", label: "Backlog", icon: "circle" },
  { id: "todo", label: "To Do", icon: "circle" },
  { id: "in-progress", label: "In Progress", icon: "clock" },
  { id: "review", label: "Review", icon: "clock" },
  { id: "done", label: "Done", icon: "check" }
];
const mockVersions = [
  {
    id: "1",
    version: "5.0",
    status: "current",
    filename: "Platform_Level_B2.rvt",
    description: "Updated platform edge doors and passenger safety barriers",
    author: "Minh Anh",
    authorAvatar: "MA",
    authorColor: "bg-emerald-500",
    updatedAt: "3 hours ago",
    revisions: 12,
    fileSize: "45.2 MB",
    discipline: "Architecture",
    format: "Revit",
    reviewers: [
      { name: "Hoang Nam", avatar: "HN", color: "bg-indigo-500" },
      { name: "Thu Trang", avatar: "TT", color: "bg-blue-500" }
    ],
    changes: [
      "Updated platform edge door specifications to meet safety standards",
      "Added passenger safety barriers at platform edges",
      "Revised door control system integration",
      "Updated emergency release mechanisms"
    ],
    affectedElements: ["Doors", "Safety Barriers", "Control Systems", "Emergency Equipment"]
  },
  {
    id: "2",
    version: "4.1",
    status: "approved",
    filename: "Tunnel_Structure_Section_A.ifc",
    description: "Reinforced tunnel lining and waterproofing details",
    author: "Nathan Reed",
    authorAvatar: "NR",
    authorColor: "bg-blue-500",
    updatedAt: "5 hours ago",
    revisions: 8,
    fileSize: "38.7 MB",
    discipline: "Structure",
    format: "IFC",
    reviewers: [
      { name: "Minh Anh", avatar: "MA", color: "bg-emerald-500" }
    ],
    changes: [
      "Enhanced tunnel lining reinforcement",
      "Updated waterproofing membrane specifications",
      "Added drainage system details"
    ],
    affectedElements: ["Tunnel Lining", "Waterproofing", "Drainage"]
  },
  {
    id: "3",
    version: "3.8",
    status: "approved",
    filename: "MEP_Ventilation_System.rvt",
    description: "Emergency ventilation and smoke extraction system optimization",
    author: "Tuan Kiet",
    authorAvatar: "TK",
    authorColor: "bg-teal-500",
    updatedAt: "1 day ago",
    revisions: 15,
    fileSize: "52.1 MB",
    discipline: "MEP",
    format: "Revit",
    reviewers: [
      { name: "Hoang Nam", avatar: "HN", color: "bg-indigo-500" },
      { name: "Thu Trang", avatar: "TT", color: "bg-blue-500" }
    ],
    changes: [
      "Optimized smoke extraction fan capacity",
      "Updated emergency ventilation protocols",
      "Revised ductwork routing for efficiency"
    ],
    affectedElements: ["Ventilation", "Smoke Extraction", "Ductwork"]
  },
  {
    id: "4",
    version: "3.2",
    status: "approved",
    filename: "Station_Entrance_Concourse.rvt",
    description: "Ticketing hall layout and fare gate positioning updated",
    author: "Jacob Harris",
    authorAvatar: "JH",
    authorColor: "bg-purple-500",
    updatedAt: "2 days ago",
    revisions: 10,
    fileSize: "41.3 MB",
    discipline: "Architecture",
    format: "Revit",
    reviewers: [
      { name: "Minh Anh", avatar: "MA", color: "bg-emerald-500" }
    ],
    changes: [
      "Reconfigured ticketing machine layout",
      "Updated fare gate positions for better flow",
      "Added accessibility improvements"
    ],
    affectedElements: ["Ticketing", "Fare Gates", "Accessibility"]
  },
  {
    id: "5",
    version: "2.9",
    status: "approved",
    filename: "Platform_Signage_System.rvt",
    description: "Wayfinding and platform signage system updates",
    author: "Thu Trang",
    authorAvatar: "TT",
    authorColor: "bg-blue-500",
    updatedAt: "3 days ago",
    revisions: 6,
    fileSize: "28.4 MB",
    discipline: "Architecture",
    format: "Revit",
    reviewers: [
      { name: "Hoang Nam", avatar: "HN", color: "bg-indigo-500" }
    ],
    changes: [
      "Updated signage specifications",
      "Added multilingual support",
      "Improved visibility standards"
    ],
    affectedElements: ["Signage", "Wayfinding", "Lighting"]
  }
];
const mockDocuments = {
  id: "root",
  name: "All Files",
  type: "folder",
  children: [
    {
      id: "1",
      name: "Architecture",
      type: "folder",
      children: [
        { id: "1-1", name: "Floor Plans", type: "folder", children: [] },
        { id: "1-2", name: "Elevations", type: "folder", children: [] },
        { id: "1-3", name: "Sections", type: "folder", children: [] },
        { id: "1-4", name: "3D Views", type: "folder", children: [] },
        { id: "1-5", name: "Architecture_Master_Model.rvt", type: "file", category: "Architecture", size: "412 MB", updatedAt: "1 hour ago", author: "Minh Khoa", starred: true },
        { id: "1-6", name: "Facade_Design_Final.rvt", type: "file", category: "Architecture", size: "189 MB", updatedAt: "5 hours ago", author: "Thu Trang" },
        { id: "1-7", name: "Interior_Layouts.rvt", type: "file", category: "Architecture", size: "156 MB", updatedAt: "2 days ago", author: "Hoang Long" }
      ]
    },
    {
      id: "2",
      name: "Structure",
      type: "folder",
      children: [
        { id: "2-1", name: "Structural_Calculations.pdf", type: "file", category: "Structure", size: "2.4 MB", updatedAt: "2 hours ago", author: "Minh Anh" },
        { id: "2-2", name: "Foundation_Plan.dwg", type: "file", category: "Structure", size: "5.1 MB", updatedAt: "5 hours ago", author: "Hoang Nam" }
      ]
    },
    {
      id: "3",
      name: "MEP",
      type: "folder",
      children: [
        { id: "3-1", name: "HVAC Systems", type: "folder", children: [] },
        { id: "3-2", name: "Electrical", type: "folder", children: [] },
        { id: "3-3", name: "Plumbing", type: "folder", children: [] }
      ]
    },
    { id: "4", name: "Coordination", type: "folder", children: [] },
    { id: "5", name: "Drawings", type: "folder", children: [] },
    { id: "6", name: "Reports", type: "folder", children: [] },
    { id: "7", name: "Specifications", type: "folder", children: [] }
  ]
};
const ClockIcon = ({ className = "" }) => /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) });
function ProjectDetailPageContent({ project }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isFavorite, setIsFavorite] = useState(project.isFavorite || false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [clashCount, setClashCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchProjectOverviewData = async () => {
      try {
        const [membersRes, documentsRes, touchRes, clashCountRes] = await Promise.all([
          fetch("/api/projects/member-list", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ projectId: project.publicId })
          }),
          fetch("/api/projects/packages/documents/list", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ projectId: project.publicId })
          }),
          fetch("/api/projects/touch", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ projectId: project.publicId })
          }),
          apiFetch(`/api/projects/${project.publicId}/navisworks/clashes/count`)
        ]);
        if (membersRes.ok) {
          const payload = await membersRes.json();
          const members = Array.isArray(payload?.data) ? payload.data : [];
          const mappedMembers = members.map((m, index) => {
            const name = m?.user?.fullName || m?.user?.name || m?.user?.email || "Unknown";
            return {
              id: m?.userId || String(index),
              name,
              role: m?.role || "member",
              avatar: getInitials(name),
              color: avatarColors[index % avatarColors.length],
              isOnline: m?.status === "accepted"
            };
          });
          if (!cancelled) {
            setTeamMembers(mappedMembers);
            if (payload?.isFavorite !== void 0) {
              setIsFavorite(payload.isFavorite === true);
            }
          }
        }
        if (documentsRes.ok) {
          const payload = await documentsRes.json();
          const total = Number(payload?.data?.total || 0);
          if (!cancelled) {
            setDocumentsCount(Number.isFinite(total) ? total : 0);
          }
        }
        if (clashCountRes.ok) {
          const payload = await clashCountRes.json();
          if (!cancelled) {
            setClashCount(payload?.total || 0);
          }
        }
      } catch {
      }
    };
    fetchProjectOverviewData();
    return () => {
      cancelled = true;
    };
  }, [project.publicId]);
  useEffect(() => {
    const storedTab = sessionStorage.getItem("projectActiveTab");
    if (storedTab) {
      setActiveTab(storedTab);
      sessionStorage.removeItem("projectActiveTab");
    }
  }, []);
  useEffect(() => {
    if (activeTab !== "changes") return;
    let cancelled = false;
    const extractIfcFiles = (nodes) => {
      const files = [];
      for (const node of nodes) {
        if (node.type === "file" && node.isIfc) {
          files.push({ id: node.id, name: node.name });
        }
        if (node.children && Array.isArray(node.children)) {
          files.push(...extractIfcFiles(node.children));
        }
      }
      return files;
    };
    const cacheKey = `orbit-ifc-files-${project.publicId}`;
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(`${cacheKey}-time`);
    const cacheExpiry = 5 * 60 * 1e3;
    const loadIfcFiles = async () => {
      const res = await apiFetch(`/api/projects/packages/documents/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.publicId })
      });
      if (res.ok) {
        const payload = await res.json();
        const tree = payload?.data?.tree;
        if (tree && !cancelled) {
          const ifcFiles = extractIfcFiles(tree.children || []);
          setAvailableIfcFiles(ifcFiles);
          localStorage.setItem(cacheKey, JSON.stringify(ifcFiles));
          localStorage.setItem(`${cacheKey}-time`, String(Date.now()));
        }
      }
    };
    const fetchChangeRequests = async () => {
      setIsLoadingChangeRequests(true);
      setIsLoadingIfcFiles(true);
      try {
        const crRes = await apiFetch(`/api/projects/${project.publicId}/change-requests`);
        if (crRes.ok && !cancelled) {
          const payload = await crRes.json();
          setChangeRequests(payload.data || []);
        }
        if (cachedData && cachedTime && Date.now() - Number(cachedTime) < cacheExpiry) {
          try {
            setAvailableIfcFiles(JSON.parse(cachedData));
          } catch {
            await loadIfcFiles();
          }
        } else {
          await loadIfcFiles();
        }
      } catch {
      } finally {
        if (!cancelled) {
          setIsLoadingChangeRequests(false);
          setIsLoadingIfcFiles(false);
        }
      }
    };
    fetchChangeRequests();
    return () => {
      cancelled = true;
    };
  }, [activeTab, project.publicId]);
  const [docViewMode, setDocViewMode] = useState("list");
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [currentPath, setCurrentPath] = useState(["root"]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isVersionDetailOpen, setIsVersionDetailOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [baseVersion, setBaseVersion] = useState("");
  const [compareVersion, setCompareVersion] = useState("");
  const [isCompareResultOpen, setIsCompareResultOpen] = useState(false);
  const [crFilter, setCrFilter] = useState("all");
  const [crSearchQuery, setCrSearchQuery] = useState("");
  const [changeRequests, setChangeRequests] = useState([]);
  const [isLoadingChangeRequests, setIsLoadingChangeRequests] = useState(false);
  const [availableIfcFiles, setAvailableIfcFiles] = useState([]);
  const [isLoadingIfcFiles, setIsLoadingIfcFiles] = useState(false);
  const [newRequestDetailedDescription, setNewRequestDetailedDescription] = useState("");
  const [newRequestAssignees, setNewRequestAssignees] = useState([]);
  const [newRequestReviewers, setNewRequestReviewers] = useState([]);
  const [newRequestAttachments, setNewRequestAttachments] = useState([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [newRequestDiscipline, setNewRequestDiscipline] = useState("");
  const [newRequestDeadline, setNewRequestDeadline] = useState("");
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newRequestTitle, setNewRequestTitle] = useState("");
  const [newRequestDescription, setNewRequestDescription] = useState("");
  const [newRequestPriority, setNewRequestPriority] = useState("medium");
  const [newRequestAffectedModels, setNewRequestAffectedModels] = useState([]);
  const [tasksViewMode, setTasksViewMode] = useState("board");
  const [tasksSearchQuery, setTasksSearchQuery] = useState("");
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [tasksData, setTasksData] = useState([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [projectTaskTags, setProjectTaskTags] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const getCurrentFolder = () => {
    let current = mockDocuments;
    for (let i = 1; i < currentPath.length; i++) {
      const found = current.children.find((c) => c.id === currentPath[i] && c.type === "folder");
      if (found && found.type === "folder") {
        current = found;
      }
    }
    return current;
  };
  const currentFolder = getCurrentFolder();
  currentFolder.children.filter(
    (item) => item.name.toLowerCase().includes(docSearchQuery.toLowerCase())
  );
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };
  const formatRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = /* @__PURE__ */ new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Just now";
    const diffMins = Math.floor(diffMs / 6e4);
    const diffHours = Math.floor(diffMs / 36e5);
    const diffDays = Math.floor(diffMs / 864e5);
    if (diffMins < 30) return "Just now";
    if (diffHours < 1) return `${diffMins} min ago`;
    if (diffDays < 1) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };
  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-emerald-500";
      case "review":
        return "bg-amber-500";
      case "planning":
        return "bg-gray-500";
      case "paused":
        return "bg-red-500";
      case "completed":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };
  const loadProjectTasks = useCallback(async () => {
    setIsTasksLoading(true);
    try {
      const response = await apiFetch("/api/tasks/list", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ projectId: project.publicId })
      });
      if (response.status === 404) {
        setTasksData([]);
        return;
      }
      if (!response.ok) {
        setTasksData([]);
        return;
      }
      const payload = await response.json();
      const rawTasks = Array.isArray(payload?.data) ? payload.data : [];
      const mapped = rawTasks.map((t) => ({
        id: String(t.publicId || t.id || ""),
        title: String(t.title || "Untitled task"),
        priority: ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium",
        status: ["backlog", "todo", "in-progress", "review", "done"].includes(t.status) ? t.status : "backlog",
        tags: Array.isArray(t.tags) ? t.tags : [],
        linkedItem: t.linkedUrl ? { type: "link", name: t.linkedUrl } : void 0,
        comments: Number(t.commentsCount || 0),
        attachments: Number(t.attachmentsCount || 0),
        dueDate: t.dueDate ? formatDate(t.dueDate) : "",
        assigneeId: String(t.assigneeId || "")
      }));
      setTasksData(mapped);
    } catch {
      setTasksData([]);
    } finally {
      setIsTasksLoading(false);
    }
  }, [project.publicId]);
  useEffect(() => {
    if (activeTab !== "tasks") return;
    loadProjectTasks();
  }, [activeTab, loadProjectTasks]);
  const filteredTasks = useMemo(
    () => tasksData.filter((t) => t.title.toLowerCase().includes(tasksSearchQuery.toLowerCase())),
    [tasksData, tasksSearchQuery]
  );
  useEffect(() => {
    let cancelled = false;
    const loadProjectTaskTags = async () => {
      try {
        const res = await apiFetch("/api/projects/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ projectId: project.publicId })
        });
        if (!res.ok) return;
        const payload = await res.json();
        const tags = Array.isArray(payload?.data?.taskTags) ? payload.data.taskTags : [];
        if (!cancelled) {
          setProjectTaskTags(tags.map((t) => String(t?.name || "").toLowerCase()).filter(Boolean));
        }
      } catch {
      }
    };
    loadProjectTaskTags();
    return () => {
      cancelled = true;
    };
  }, [project.publicId]);
  const projectStats = {
    documents: documentsCount,
    versions: 124,
    teamMembers: teamMembers.length,
    openClashes: clashCount,
    startDate: "Jan 15, 2024",
    deadline: "Dec 15, 2025"
  };
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-background pt-[105px]", children: [
    /* @__PURE__ */ jsx(
      ProjectTopBar,
      {
        projectName: project.name,
        projectSlug: project.publicId,
        activeTab,
        isFavorite,
        onTabChange: setActiveTab,
        onFavoriteChange: setIsFavorite
      }
    ),
    activeTab === "overview" && /* @__PURE__ */ jsxs("div", { className: "relative h-52 flex items-end overflow-hidden", children: [
      project.coverImageUrl ? /* @__PURE__ */ jsx(
        "img",
        {
          src: project.coverImageUrl,
          alt: project.name,
          className: "absolute inset-0 w-full h-full object-cover"
        }
      ) : /* @__PURE__ */ jsx("div", { className: cn(
        "absolute inset-0",
        project.industry === "software" && "bg-gradient-to-r from-indigo-600 to-blue-600",
        project.industry === "design" && "bg-gradient-to-r from-purple-600 to-pink-600",
        project.industry === "construction" && "bg-gradient-to-r from-slate-700 to-slate-900",
        project.industry === "research" && "bg-gradient-to-r from-teal-600 to-emerald-600",
        !project.industry && "bg-gradient-to-r from-gray-600 to-gray-800"
      ), children: /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" }) }),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" }),
      /* @__PURE__ */ jsxs("div", { className: "relative w-full px-[300px] pb-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-white/80 text-sm mb-2", children: [
          /* @__PURE__ */ jsx(ClockIcon, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxs("span", { children: [
            "Last updated ",
            project.lastVisited ? formatRelativeTime(project.lastVisited) : "recently"
          ] })
        ] }),
        /* @__PURE__ */ jsx("h1", { className: "text-3xl font-bold text-white mb-2", children: project.name }),
        /* @__PURE__ */ jsx("p", { className: "text-white/80", children: project.description })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "px-[300px] py-6", children: [
      activeTab === "packages" && /* @__PURE__ */ jsx(PackagesManager, { fixedProjectId: project.publicId, fixedProjectName: project.name }),
      activeTab === "overview" && /* @__PURE__ */ jsxs("div", { className: "py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-4 gap-4 rounded-xl border border-gray-200 bg-white p-4 mb-6", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Status" }),
            /* @__PURE__ */ jsx("p", { className: cn(
              "mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium text-white capitalize",
              getStatusColor(project.status)
            ), children: project.status })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Progress" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex-1 h-2 bg-gray-200 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
                "div",
                {
                  className: "h-full bg-indigo-600 rounded-full transition-all",
                  style: { width: `${project.progress}%` }
                }
              ) }),
              /* @__PURE__ */ jsxs("span", { className: "text-sm font-medium text-foreground", children: [
                project.progress,
                "%"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Start Date" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-medium text-foreground", children: projectStats.startDate })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Deadline" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-medium text-foreground", children: projectStats.deadline })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-4 gap-4 mb-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100", children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold text-foreground", children: projectStats.documents }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Documents" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100", children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6 text-emerald-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" }) }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold text-foreground", children: projectStats.versions }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Versions" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100", children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6 text-indigo-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" }) }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold text-foreground", children: projectStats.teamMembers }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Team Members" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-xl bg-red-100", children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6 text-red-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold text-foreground", children: projectStats.openClashes }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Open Clashes" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-gray-200 bg-white p-5", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-4", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" }) }),
              /* @__PURE__ */ jsx("h3", { className: "font-semibold text-foreground", children: "Team members" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "space-y-3", children: teamMembers.map((member) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsx("div", { className: cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white", member.color), children: member.avatar }),
                member.isOnline && /* @__PURE__ */ jsx("div", { className: "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: member.name }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground capitalize", children: member.role })
              ] })
            ] }, member.id)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-gray-200 bg-white p-5", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-4", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }),
              /* @__PURE__ */ jsx("h3", { className: "font-semibold text-foreground", children: "Recent activity" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "space-y-4", children: mockActivities.map((activity) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", activity.color), children: [
                activity.icon === "check" && /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }),
                activity.icon === "alert" && /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }),
                activity.icon === "upload" && /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" }) }),
                activity.icon === "edit" && /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: activity.action }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
                  activity.user,
                  " • ",
                  activity.time
                ] })
              ] })
            ] }, activity.id)) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 rounded-xl border border-gray-200 bg-white p-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-4", children: [
            /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }),
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-foreground", children: "Project milestones" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-3", children: mockMilestones.map((milestone) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 py-2 border-b border-gray-100 last:border-0", children: [
            /* @__PURE__ */ jsx("div", { className: cn(
              "h-3 w-3 rounded-full",
              milestone.status === "completed" && "bg-emerald-500",
              milestone.status === "in-progress" && "bg-indigo-500",
              milestone.status === "upcoming" && "bg-gray-300"
            ) }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: milestone.name }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: milestone.date })
            ] }),
            /* @__PURE__ */ jsx("span", { className: cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              milestone.status === "completed" && "bg-emerald-100 text-emerald-700",
              milestone.status === "in-progress" && "bg-indigo-100 text-indigo-700",
              milestone.status === "upcoming" && "bg-gray-100 text-gray-600"
            ), children: milestone.status === "completed" ? "completed" : milestone.status === "in-progress" ? "in progress" : "upcoming" })
          ] }, milestone.id)) })
        ] })
      ] }),
      activeTab === "documents" && /* @__PURE__ */ jsx(ProjectDocumentsManager, { projectId: project.publicId }),
      activeTab === "versions" && /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Version Control" }) }),
          mockVersions.length > 0 && /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setIsCompareModalOpen(true),
              className: "inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] font-normal text-[#364153] transition-colors hover:bg-gray-50",
              children: [
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" }) }),
                "Compare Versions"
              ]
            }
          )
        ] }),
        mockVersions.length === 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-16", children: [
          /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" }) }) }),
          /* @__PURE__ */ jsx("h3", { className: "text-lg font-medium text-gray-900 mb-1", children: "This section is under development" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500", children: "Version control features will be available soon" })
        ] }),
        mockVersions.length > 0 && /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute left-[47px] top-[60px] bottom-[60px] w-[2px] bg-[#E5E7EB]" }),
          /* @__PURE__ */ jsx("div", { className: "space-y-0", children: mockVersions.map((version, index) => /* @__PURE__ */ jsx(
            "div",
            {
              className: "relative rounded-[10px] border border-[#E5E7EB] bg-white px-6 py-6 mb-4",
              children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
                /* @__PURE__ */ jsx("div", { className: cn(
                  "relative z-10 flex h-12 w-12 items-center justify-center rounded-full shrink-0",
                  version.status === "current" ? "bg-[#155DFC]" : "bg-[#DCFCE7]"
                ), children: /* @__PURE__ */ jsxs("svg", { className: cn("h-6 w-6", version.status === "current" ? "text-white" : "text-[#00A63E]"), viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, children: [
                  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" }),
                  /* @__PURE__ */ jsx("line", { x1: "3", y1: "12", x2: "9", y2: "12" }),
                  /* @__PURE__ */ jsx("line", { x1: "15", y1: "12", x2: "21", y2: "12" })
                ] }) }),
                /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-2", children: [
                    /* @__PURE__ */ jsxs("h3", { className: "text-[18px] font-normal text-[#101828]", children: [
                      "Version ",
                      version.version
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-normal",
                      version.status === "current" && "bg-[#DBEAFE] text-[#1447E6]",
                      version.status === "approved" && "bg-[#DCFCE7] text-[#008236]",
                      version.status === "pending" && "bg-[#FEF3C7] text-[#B45309]",
                      version.status === "rejected" && "bg-[#FEE2E2] text-[#DC2626]"
                    ), children: version.status })
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#4A5565] mb-1", children: version.filename }),
                  /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#101828] mb-4", children: version.description }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                    /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 text-[12px] text-[#6A7282]", children: [
                      /* @__PURE__ */ jsxs("svg", { className: "h-3 w-3", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1, children: [
                        /* @__PURE__ */ jsx("path", { d: "M6 5.5a2 2 0 100-4 2 2 0 000 4z" }),
                        /* @__PURE__ */ jsx("path", { d: "M2.5 10.5v-1a3.5 3.5 0 017 0v1" })
                      ] }),
                      version.author
                    ] }),
                    /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 text-[12px] text-[#6A7282]", children: [
                      /* @__PURE__ */ jsxs("svg", { className: "h-3 w-3", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1, children: [
                        /* @__PURE__ */ jsx("rect", { x: "1.5", y: "2", width: "9", height: "8.5", rx: "1" }),
                        /* @__PURE__ */ jsx("line", { x1: "4", y1: "1", x2: "4", y2: "3" }),
                        /* @__PURE__ */ jsx("line", { x1: "8", y1: "1", x2: "8", y2: "3" }),
                        /* @__PURE__ */ jsx("line", { x1: "1.5", y1: "5", x2: "10.5", y2: "5" })
                      ] }),
                      version.updatedAt
                    ] }),
                    /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 text-[12px] text-[#6A7282]", children: [
                      /* @__PURE__ */ jsxs("svg", { className: "h-3 w-3", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1, children: [
                        /* @__PURE__ */ jsx("path", { d: "M3 1.5v3m0 0L1.5 3m1.5 1.5L4.5 3" }),
                        /* @__PURE__ */ jsx("path", { d: "M9 10.5v-3m0 0l1.5 1.5M9 7.5L7.5 9" }),
                        /* @__PURE__ */ jsx("path", { d: "M4.5 4.5l3 3" })
                      ] }),
                      version.revisions,
                      " revisions"
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => {
                      setSelectedVersion(version);
                      setIsVersionDetailOpen(true);
                    },
                    className: "inline-flex items-center gap-2 text-[12px] font-normal text-[#155DFC] hover:text-blue-700 shrink-0",
                    children: [
                      /* @__PURE__ */ jsxs("svg", { className: "h-3.5 w-3.5", viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.17, children: [
                        /* @__PURE__ */ jsx("circle", { cx: "7", cy: "7", r: "2.5" }),
                        /* @__PURE__ */ jsx("path", { d: "M1 7c1.5-3.5 3.5-5 6-5s4.5 1.5 6 5c-1.5 3.5-3.5 5-6 5s-4.5-1.5-6-5z" })
                      ] }),
                      "View Details"
                    ]
                  }
                )
              ] })
            },
            version.id
          )) })
        ] })
      ] }),
      activeTab === "changes" && /* @__PURE__ */ jsx(ChangesTab, { projectPublicId: project.publicId }),
      activeTab === "changes_DISABLED_INLINE" && /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h2", { className: "text-[24px] font-normal text-[#101828]", children: "Change Requests" }) }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setIsNewRequestModalOpen(true),
              className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors",
              children: [
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }),
                "New Request"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setCrFilter("all"),
                className: cn(
                  "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
                  crFilter === "all" ? "bg-[#F0F9FF] text-[#0069A8]" : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
                ),
                children: "All"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setCrFilter("pending"),
                className: cn(
                  "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
                  crFilter === "pending" ? "bg-[#F0F9FF] text-[#0069A8]" : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
                ),
                children: "Pending"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setCrFilter("in-progress"),
                className: cn(
                  "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
                  crFilter === "in-progress" ? "bg-[#F0F9FF] text-[#0069A8]" : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50"
                ),
                children: "In Progress"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "relative flex-1 max-w-md", children: [
            /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" }) }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "Search change requests...",
                value: crSearchQuery,
                onChange: (e) => setCrSearchQuery(e.target.value),
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden", children: isLoadingChangeRequests ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-12", children: /* @__PURE__ */ jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) }) : changeRequests.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
          /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }) }),
          /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "No change requests yet" }),
          /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[#9CA3AF] mt-1", children: "Create your first change request" })
        ] }) : changeRequests.filter((cr) => {
          if (crFilter === "pending") return cr.status === "pending";
          if (crFilter === "in-progress") return cr.status === "in-progress";
          return true;
        }).filter(
          (cr) => cr.title.toLowerCase().includes(crSearchQuery.toLowerCase()) || cr.crId.toLowerCase().includes(crSearchQuery.toLowerCase()) || cr.description.toLowerCase().includes(crSearchQuery.toLowerCase())
        ).map((cr, index, arr) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn(
              "flex items-start gap-4 px-6 py-6",
              index !== arr.length - 1 && "border-b border-[#E5E7EB]"
            ),
            children: [
              /* @__PURE__ */ jsx("div", { className: cn(
                "flex h-12 w-12 items-center justify-center rounded-[10px] shrink-0",
                (cr.status === "in-progress" || cr.status === "pending") && "bg-[#EEF2FF]",
                (cr.status === "approved" || cr.status === "completed") && "bg-[#ECFDF5]"
              ), children: /* @__PURE__ */ jsxs(
                "svg",
                {
                  className: "h-6 w-6",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  xmlns: "http://www.w3.org/2000/svg",
                  children: [
                    /* @__PURE__ */ jsx(
                      "path",
                      {
                        d: "M12.659 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8.00001C20.0008 7.68312 19.9388 7.36921 19.8176 7.0764C19.6964 6.78359 19.5185 6.51768 19.294 6.29401L15.706 2.70601C15.4823 2.48153 15.2164 2.30357 14.9236 2.18239C14.6308 2.06122 14.3169 1.99923 14 2.00001H6C5.46957 2.00001 4.96086 2.21072 4.58579 2.58579C4.21071 2.96087 4 3.46957 4 4.00001V13.34",
                        stroke: cr.status === "in-progress" || cr.status === "pending" ? "#4F39F6" : "#009966",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "path",
                      {
                        d: "M14 2V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H20",
                        stroke: cr.status === "in-progress" || cr.status === "pending" ? "#4F39F6" : "#009966",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "path",
                      {
                        d: "M10.378 12.6219C10.7762 12.224 11.3162 12.0007 11.8791 12.001C12.442 12.0013 12.9817 12.2251 13.3795 12.6234C13.7773 13.0216 14.0007 13.5615 14.0004 14.1244C14.0001 14.6873 13.7762 15.227 13.378 15.6249L8.36002 20.6369C8.1224 20.8746 7.82869 21.0486 7.50602 21.1429L4.63902 21.9799C4.55298 22.005 4.46176 22.0065 4.37493 21.9842C4.2881 21.962 4.20885 21.9168 4.14547 21.8534C4.08209 21.79 4.03691 21.7108 4.01467 21.6239C3.99242 21.5371 3.99393 21.4459 4.01902 21.3599L4.85502 18.4909C4.9494 18.1686 5.12341 17.8752 5.36102 17.6379L10.378 12.6219Z",
                        stroke: cr.status === "in-progress" || cr.status === "pending" ? "#4F39F6" : "#009966",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }
                    )
                  ]
                }
              ) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[14px] font-mono text-[#101828]", children: cr.crId }),
                  /* @__PURE__ */ jsx("span", { className: cn(
                    "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                    cr.status === "in-progress" && "bg-[#EEF2FF] text-[#432DD7]",
                    cr.status === "approved" && "bg-[#ECFDF5] text-[#007A55]",
                    cr.status === "completed" && "bg-[#ECFDF5] text-[#007A55]",
                    cr.status === "pending" && "bg-[#FEF3C7] text-[#B45309]",
                    cr.status === "rejected" && "bg-[#FEE2E2] text-[#DC2626]"
                  ), children: cr.status }),
                  /* @__PURE__ */ jsx("span", { className: cn(
                    "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                    cr.priority === "urgent" && "bg-[#FFF1F2] text-[#C70036]",
                    cr.priority === "high" && "bg-[#FFF1F2] text-[#C70036]",
                    cr.priority === "medium" && "bg-[#F0F9FF] text-[#0069A8]",
                    cr.priority === "low" && "bg-[#F3F4F6] text-[#364153]"
                  ), children: cr.priority })
                ] }),
                /* @__PURE__ */ jsx("h3", { className: "text-[14px] font-normal text-[#101828] mb-1", children: cr.title }),
                /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#4A5565] mb-4 line-clamp-2", children: cr.description }),
                cr.affectedModels && cr.affectedModels.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#6A7282]", children: "Affected Models:" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-1", children: [
                    cr.affectedModels.slice(0, 3).map((model, i) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] text-[#4A5565]", children: model }, i)),
                    cr.affectedModels.length > 3 && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] text-[#6A7282]", children: [
                      "+",
                      cr.affectedModels.length - 3,
                      " more"
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-[12px] text-[#6A7282]", children: [
                  cr.assignedTo && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "Assigned to ",
                      cr.assignedTo
                    ] }),
                    /* @__PURE__ */ jsx("span", { children: "•" })
                  ] }),
                  /* @__PURE__ */ jsx("span", { children: new Date(cr.createdAt).toLocaleDateString() })
                ] })
              ] }),
              /* @__PURE__ */ jsx("button", { className: "shrink-0 inline-flex items-center rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-normal text-[#364153] hover:bg-gray-50 transition-colors", children: "View Details" })
            ]
          },
          cr.publicId
        )) })
      ] }),
      activeTab === "tasks" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pb-4 border-b border-[#E5E7EB]", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx(
              WorkflowTemplatesDropdown,
              {
                selectedWorkflow: "construction-standard",
                onSelect: (workflowId) => console.log("Selected workflow:", workflowId),
                onConfigureClick: () => console.log("Configure workflow clicked")
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setIsNewTaskModalOpen(true),
                className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }),
                  "New Task"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 rounded-[10px] bg-[#F3F4F6] p-1", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setTasksViewMode("board"),
                className: cn(
                  "p-1.5 rounded-[8px] transition-colors",
                  tasksViewMode === "board" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                ),
                children: /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 text-[#4A5565]", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.33, children: [
                  /* @__PURE__ */ jsx("rect", { x: "2", y: "2", width: "5", height: "5", rx: "1" }),
                  /* @__PURE__ */ jsx("rect", { x: "9", y: "2", width: "5", height: "5", rx: "1" }),
                  /* @__PURE__ */ jsx("rect", { x: "2", y: "9", width: "5", height: "5", rx: "1" }),
                  /* @__PURE__ */ jsx("rect", { x: "9", y: "9", width: "5", height: "5", rx: "1" })
                ] })
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setTasksViewMode("list"),
                className: cn(
                  "p-1.5 rounded-[8px] transition-colors",
                  tasksViewMode === "list" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                ),
                children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#4A5565]", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.33, children: /* @__PURE__ */ jsx("path", { d: "M2 4h12M2 8h12M2 12h12" }) })
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setTasksViewMode("calendar"),
                className: cn(
                  "p-1.5 rounded-[8px] transition-colors",
                  tasksViewMode === "calendar" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                ),
                children: /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 text-[#4A5565]", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.33, children: [
                  /* @__PURE__ */ jsx("rect", { x: "2", y: "3", width: "12", height: "11", rx: "1" }),
                  /* @__PURE__ */ jsx("path", { d: "M2 6h12M5 1v4M11 1v4" })
                ] })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "relative flex-1 max-w-md", children: [
            /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" }) }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "Search tasks...",
                value: tasksSearchQuery,
                onChange: (e) => setTasksSearchQuery(e.target.value),
                className: "w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#364153] hover:bg-gray-50", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" }) }),
              "Filters"
            ] }),
            /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#364153] hover:bg-gray-50", children: [
              /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.33, children: [
                /* @__PURE__ */ jsx("path", { d: "M8 7.33333C9.47276 7.33333 10.6667 6.13943 10.6667 4.66667C10.6667 3.19391 9.47276 2 8 2C6.52724 2 5.33333 3.19391 5.33333 4.66667C5.33333 6.13943 6.52724 7.33333 8 7.33333Z" }),
                /* @__PURE__ */ jsx("path", { d: "M3.33333 14V12.6667C3.33333 11.9594 3.61428 11.2811 4.11438 10.781C4.61448 10.281 5.29276 10 6 10H10C10.7072 10 11.3855 10.281 11.8856 10.781C12.3857 11.2811 12.6667 11.9594 12.6667 12.6667V14" })
              ] }),
              "Assignee"
            ] }),
            /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#364153] hover:bg-gray-50", children: [
              /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: [
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" }),
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 6h.008v.008H6V6z" })
              ] }),
              "Tags"
            ] })
          ] })
        ] }),
        tasksViewMode === "board" && /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-x-auto", children: isTasksLoading ? /* @__PURE__ */ jsx("div", { className: "py-12 text-center text-[14px] text-[#6A7282]", children: "Loading tasks..." }) : /* @__PURE__ */ jsx("div", { className: "flex gap-4 min-w-max pb-4", children: taskColumns.map((column) => {
          const columnTasks = filteredTasks.filter((t) => t.status === column.id);
          return /* @__PURE__ */ jsxs("div", { className: "w-[280px] flex flex-col", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                column.icon === "circle" && /* @__PURE__ */ jsx("div", { className: "h-4 w-4 rounded-full border-2 border-[#D1D5DC]" }),
                column.icon === "clock" && /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 text-[#6A7282]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: [
                  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
                  /* @__PURE__ */ jsx("path", { d: "M12 6v6l4 2" })
                ] }),
                column.icon === "check" && /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 text-[#009966]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: [
                  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
                  /* @__PURE__ */ jsx("path", { d: "M9 12l2 2 4-4" })
                ] }),
                /* @__PURE__ */ jsx("span", { className: "text-[14px] font-normal text-[#101828]", children: column.label }),
                /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#6A7282] bg-[#F3F4F6] px-1.5 py-0.5 rounded", children: columnTasks.length })
              ] }),
              /* @__PURE__ */ jsx("button", { className: "p-1 hover:bg-gray-100 rounded", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#6A7282]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
              columnTasks.map((task) => {
                const assignee = teamMembers.find((m) => m.id === task.assigneeId);
                return /* @__PURE__ */ jsxs(
                  "div",
                  {
                    onClick: () => setSelectedTaskId(task.id),
                    className: "bg-white rounded-[10px] border border-[#E5E7EB] p-3 hover:shadow-sm transition-shadow cursor-pointer",
                    children: [
                      /* @__PURE__ */ jsx("span", { className: cn(
                        "inline-flex items-center rounded px-2 py-0.5 text-[12px] mb-2",
                        task.priority === "urgent" && "bg-[#FEE2E2] text-[#DC2626]",
                        task.priority === "high" && "bg-[#FEE2E2] text-[#DC2626]",
                        task.priority === "medium" && "bg-[#F0F9FF] text-[#0069A8]",
                        task.priority === "low" && "bg-[#F3F4F6] text-[#364153]"
                      ), children: task.priority }),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: (e) => {
                            e.stopPropagation();
                            setSelectedTaskId(task.id);
                          },
                          className: "text-left text-[14px] font-normal text-[#101828] mb-2 block hover:text-[#155DFC] hover:underline",
                          children: task.title
                        }
                      ),
                      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1 mb-2", children: task.tags.map((tag) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-[6px] bg-[#F3F4F6] px-2 py-0.5 text-[12px] text-[#4A5565]", children: tag }, tag)) }),
                      task.linkedItem && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 mb-3", children: [
                        /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5 text-[#155DFC]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" }) }),
                        /* @__PURE__ */ jsx("span", { className: "text-[12px] text-[#155DFC]", children: task.linkedItem.name })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-[12px] text-[#6A7282]", children: [
                          task.comments > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                            /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" }) }),
                            task.comments
                          ] }),
                          task.attachments > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                            /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" }) }),
                            task.attachments
                          ] }),
                          task.dueDate && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                            /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" }) }),
                            task.dueDate
                          ] })
                        ] }),
                        assignee && /* @__PURE__ */ jsx("div", { className: cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white", assignee.color), children: assignee.avatar })
                      ] })
                    ]
                  },
                  task.id
                );
              }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setIsNewTaskModalOpen(true),
                  className: "w-full py-2 rounded-[10px] border border-dashed border-[#D1D5DC] text-[14px] text-[#6A7282] hover:bg-gray-50 transition-colors",
                  children: "+ Add task"
                }
              )
            ] })
          ] }, column.id);
        }) }) }),
        tasksViewMode === "list" && /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-auto", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[1fr_120px_120px_150px_100px_80px] gap-4 px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[12px] font-medium text-[#6A7282] uppercase tracking-wide", children: [
            /* @__PURE__ */ jsx("div", { children: "Task" }),
            /* @__PURE__ */ jsx("div", { children: "Status" }),
            /* @__PURE__ */ jsx("div", { children: "Priority" }),
            /* @__PURE__ */ jsx("div", { children: "Due Date" }),
            /* @__PURE__ */ jsx("div", { children: "Assignee" }),
            /* @__PURE__ */ jsx("div", {})
          ] }),
          filteredTasks.map((task) => {
            const assignee = teamMembers.find((m) => m.id === task.assigneeId);
            const column = taskColumns.find((c) => c.id === task.status);
            return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[1fr_120px_120px_150px_100px_80px] gap-4 px-4 py-3 border-b border-[#E5E7EB] hover:bg-gray-50 items-center", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelectedTaskId(task.id),
                    className: "text-left text-[14px] text-[#101828] hover:text-[#155DFC] hover:underline",
                    children: task.title
                  }
                ),
                /* @__PURE__ */ jsx("div", { className: "flex gap-1", children: task.tags.map((tag) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-[6px] bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#4A5565]", children: tag }, tag)) })
              ] }),
              /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("span", { className: cn(
                "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                task.status === "done" && "bg-[#ECFDF5] text-[#007A55]",
                task.status === "in-progress" && "bg-[#EFF6FF] text-[#155DFC]",
                task.status === "review" && "bg-[#FEF3C7] text-[#B45309]",
                task.status === "todo" && "bg-[#F3F4F6] text-[#364153]",
                task.status === "backlog" && "bg-[#F3F4F6] text-[#6A7282]"
              ), children: column?.label }) }),
              /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("span", { className: cn(
                "inline-flex items-center rounded px-2 py-0.5 text-[12px]",
                task.priority === "urgent" && "bg-[#FEE2E2] text-[#DC2626]",
                task.priority === "high" && "bg-[#FEE2E2] text-[#DC2626]",
                task.priority === "medium" && "bg-[#F0F9FF] text-[#0069A8]",
                task.priority === "low" && "bg-[#F3F4F6] text-[#364153]"
              ), children: task.priority }) }),
              /* @__PURE__ */ jsx("div", { className: "text-[14px] text-[#6A7282]", children: task.dueDate || "-" }),
              /* @__PURE__ */ jsx("div", { children: assignee && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsx("div", { className: cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white", assignee.color), children: assignee.avatar }) }) }),
              /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("button", { className: "p-1 hover:bg-gray-100 rounded", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-[#6A7282]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" }) }) }) })
            ] }, task.id);
          })
        ] }) }),
        tasksViewMode === "calendar" && /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
          /* @__PURE__ */ jsxs("svg", { className: "h-16 w-16 text-[#D1D5DC] mx-auto mb-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1, children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }),
            /* @__PURE__ */ jsx("path", { d: "M3 10h18M16 2v4M8 2v4" })
          ] }),
          /* @__PURE__ */ jsx("h3", { className: "text-[16px] font-medium text-[#101828] mb-1", children: "Calendar View" }),
          /* @__PURE__ */ jsx("p", { className: "text-[14px] text-[#6A7282]", children: "Calendar view coming soon" })
        ] }) })
      ] }),
      false,
      isCompareModalOpen && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center",
          onClick: () => setIsCompareModalOpen(false),
          children: [
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30 backdrop-blur-sm" }),
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200",
                onClick: (e) => e.stopPropagation(),
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-5 border-b border-gray-100", children: [
                    /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold text-gray-900", children: "Compare Versions" }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsCompareModalOpen(false),
                        className: "p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors",
                        children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "px-6 py-6 space-y-6", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Base Version" }),
                      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                        /* @__PURE__ */ jsxs(
                          "select",
                          {
                            value: baseVersion,
                            onChange: (e) => setBaseVersion(e.target.value),
                            className: "w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                            children: [
                              /* @__PURE__ */ jsx("option", { value: "", children: "Select version..." }),
                              mockVersions.map((v) => /* @__PURE__ */ jsxs("option", { value: v.id, children: [
                                "Version ",
                                v.version,
                                " - ",
                                v.filename
                              ] }, v.id))
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsx("svg", { className: "absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M14 5l7 7m0 0l-7 7m7-7H3" }) }) }),
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Compare With" }),
                      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                        /* @__PURE__ */ jsxs(
                          "select",
                          {
                            value: compareVersion,
                            onChange: (e) => setCompareVersion(e.target.value),
                            className: "w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                            children: [
                              /* @__PURE__ */ jsx("option", { value: "", children: "Select version..." }),
                              mockVersions.filter((v) => v.id !== baseVersion).map((v) => /* @__PURE__ */ jsxs("option", { value: v.id, children: [
                                "Version ",
                                v.version,
                                " - ",
                                v.filename
                              ] }, v.id))
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsx("svg", { className: "absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })
                      ] })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex gap-3 px-6 py-4 border-t border-gray-100", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsCompareModalOpen(false),
                        className: "flex-1 px-4 py-3 text-sm font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors",
                        children: "Cancel"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => {
                          if (baseVersion && compareVersion) {
                            setIsCompareModalOpen(false);
                            setIsCompareResultOpen(true);
                          }
                        },
                        disabled: !baseVersion || !compareVersion,
                        className: "flex-1 px-4 py-3 rounded-lg bg-indigo-400 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                        children: "Compare"
                      }
                    )
                  ] })
                ]
              }
            )
          ]
        }
      ),
      isCompareResultOpen && baseVersion && compareVersion && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center",
          onClick: () => setIsCompareResultOpen(false),
          children: [
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30 backdrop-blur-sm" }),
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "relative z-10 w-full max-w-[1280px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto",
                onClick: (e) => e.stopPropagation(),
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#FAF5FF]", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-[#9810FA]", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" }) }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("h2", { className: "text-lg font-normal text-[#101828]", children: "Version Comparison" }),
                        /* @__PURE__ */ jsxs("p", { className: "text-xs text-[#6A7282]", children: [
                          "Version ",
                          mockVersions.find((v) => v.id === baseVersion)?.version,
                          " vs Version ",
                          mockVersions.find((v) => v.id === compareVersion)?.version
                        ] })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsCompareResultOpen(false),
                        className: "p-2 text-[#6A7282] hover:text-gray-600 rounded-[10px] hover:bg-gray-100 transition-colors",
                        children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "p-6", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-6", children: [
                    (() => {
                      const base = mockVersions.find((v) => v.id === baseVersion);
                      if (!base) return null;
                      return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] bg-[#EFF6FF] border-2 border-[#BEDBFF] p-[18px]", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-1", children: [
                            /* @__PURE__ */ jsxs("h3", { className: "text-base font-normal text-[#101828]", children: [
                              "Version ",
                              base.version
                            ] }),
                            /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded px-2 py-1 text-xs font-normal bg-[#DBEAFE] text-[#1447E6]", children: "Base" })
                          ] }),
                          /* @__PURE__ */ jsx("p", { className: "text-sm text-[#4A5565]", children: base.filename })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white p-4", children: [
                          /* @__PURE__ */ jsx("h4", { className: "text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3", children: "Metadata" }),
                          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Author" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: base.author })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Date" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: base.updatedAt })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "File Size" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: base.fileSize })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Discipline" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: base.discipline })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Revisions" }),
                              /* @__PURE__ */ jsxs("span", { className: "text-sm text-[#101828]", children: [
                                base.revisions,
                                " revisions"
                              ] })
                            ] })
                          ] })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white p-4", children: [
                          /* @__PURE__ */ jsx("h4", { className: "text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3", children: "Changes" }),
                          /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: base.changes.map((change, i) => /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-3 text-sm text-[#4A5565]", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[#155DFC] font-bold", children: "•" }),
                            change
                          ] }, i)) })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white p-4", children: [
                          /* @__PURE__ */ jsx("h4", { className: "text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3", children: "Affected Elements" }),
                          /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: base.affectedElements.map((element, i) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded px-2 py-1 text-xs text-[#364153] bg-[#F3F4F6] border border-[#E5E7EB]", children: element }, i)) })
                        ] })
                      ] });
                    })(),
                    (() => {
                      const compare = mockVersions.find((v) => v.id === compareVersion);
                      if (!compare) return null;
                      return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] bg-[#F0FDF4] border-2 border-[#BBF7D0] p-[18px]", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-1", children: [
                            /* @__PURE__ */ jsxs("h3", { className: "text-base font-normal text-[#101828]", children: [
                              "Version ",
                              compare.version
                            ] }),
                            /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded px-2 py-1 text-xs font-normal bg-[#DCFCE7] text-[#15803D]", children: "Compare" })
                          ] }),
                          /* @__PURE__ */ jsx("p", { className: "text-sm text-[#4A5565]", children: compare.filename })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white p-4", children: [
                          /* @__PURE__ */ jsx("h4", { className: "text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3", children: "Metadata" }),
                          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Author" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: compare.author })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Date" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: compare.updatedAt })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "File Size" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: compare.fileSize })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Discipline" }),
                              /* @__PURE__ */ jsx("span", { className: "text-sm text-[#101828]", children: compare.discipline })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                              /* @__PURE__ */ jsx("span", { className: "text-xs text-[#6A7282]", children: "Revisions" }),
                              /* @__PURE__ */ jsxs("span", { className: "text-sm text-[#101828]", children: [
                                compare.revisions,
                                " revisions"
                              ] })
                            ] })
                          ] })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white p-4", children: [
                          /* @__PURE__ */ jsx("h4", { className: "text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3", children: "Changes" }),
                          /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: compare.changes.map((change, i) => /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-3 text-sm text-[#4A5565]", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[#15803D] font-bold", children: "•" }),
                            change
                          ] }, i)) })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "rounded-[10px] border border-[#E5E7EB] bg-white p-4", children: [
                          /* @__PURE__ */ jsx("h4", { className: "text-xs font-normal text-[#6A7282] uppercase tracking-[0.6px] mb-3", children: "Affected Elements" }),
                          /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: compare.affectedElements.map((element, i) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded px-2 py-1 text-xs text-[#364153] bg-[#F3F4F6] border border-[#E5E7EB]", children: element }, i)) })
                        ] })
                      ] });
                    })()
                  ] }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] bg-white rounded-b-[10px]", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsCompareResultOpen(false),
                        className: "text-sm font-medium text-[#6A7282] hover:text-gray-900 transition-colors",
                        children: "Close"
                      }
                    ),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#364153] transition-colors hover:bg-gray-50", children: [
                        /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }),
                        "Export Report"
                      ] }),
                      /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700", children: [
                        /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" }) }),
                        "View in 3D"
                      ] })
                    ] })
                  ] })
                ]
              }
            )
          ]
        }
      ),
      isVersionDetailOpen && selectedVersion && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center",
          onClick: () => setIsVersionDetailOpen(false),
          children: [
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30 backdrop-blur-sm" }),
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "relative z-10 w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto",
                onClick: (e) => e.stopPropagation(),
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-6 py-4 border-b border-gray-100", children: [
                    /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-blue-100", children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" }) }) }),
                    /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                      /* @__PURE__ */ jsxs("h2", { className: "text-xl font-semibold text-gray-900", children: [
                        "Version ",
                        selectedVersion.version
                      ] }),
                      /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500", children: selectedVersion.filename })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsVersionDetailOpen(false),
                        className: "p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors",
                        children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "px-6 py-5 space-y-6", children: [
                    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
                      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-gray-200 p-4", children: [
                        /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3", children: "Version Information" }),
                        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "Status" }),
                            /* @__PURE__ */ jsx("span", { className: cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              selectedVersion.status === "current" && "bg-blue-100 text-blue-700",
                              selectedVersion.status === "approved" && "bg-green-100 text-green-700"
                            ), children: selectedVersion.status })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "Author" }),
                            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-gray-900", children: selectedVersion.author })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "Date Modified" }),
                            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-gray-900", children: selectedVersion.updatedAt })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "Revisions" }),
                            /* @__PURE__ */ jsxs("span", { className: "text-sm font-medium text-gray-900", children: [
                              selectedVersion.revisions,
                              " revisions"
                            ] })
                          ] })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-gray-200 p-4", children: [
                        /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3", children: "File Details" }),
                        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "File Size" }),
                            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-gray-900", children: selectedVersion.fileSize })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "Discipline" }),
                            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-gray-900", children: selectedVersion.discipline })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "Format" }),
                            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-gray-900", children: selectedVersion.format })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: "Reviewers" }),
                            /* @__PURE__ */ jsxs("span", { className: "text-sm font-medium text-gray-900", children: [
                              selectedVersion.reviewers.length,
                              " people"
                            ] })
                          ] })
                        ] })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-gray-200 p-4", children: [
                      /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3", children: "Detailed Changes" }),
                      /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: selectedVersion.changes.map((change, index) => /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2 text-sm text-gray-700", children: [
                        /* @__PURE__ */ jsx("span", { className: "mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" }),
                        change
                      ] }, index)) })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
                      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-gray-200 p-4", children: [
                        /* @__PURE__ */ jsxs("h3", { className: "flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3", children: [
                          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }),
                          "Affected Elements"
                        ] }),
                        /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: selectedVersion.affectedElements.map((element, index) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700", children: element }, index)) })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-gray-200 p-4", children: [
                        /* @__PURE__ */ jsxs("h3", { className: "flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3", children: [
                          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" }) }),
                          "Reviewers"
                        ] }),
                        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-3", children: selectedVersion.reviewers.map((reviewer, index) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                          /* @__PURE__ */ jsx("div", { className: cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-white", reviewer.color), children: reviewer.avatar }),
                          /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-700", children: reviewer.name })
                        ] }, index)) })
                      ] })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsVersionDetailOpen(false),
                        className: "text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors",
                        children: "Close"
                      }
                    ),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50", children: [
                        /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" }) }),
                        "View in 3D"
                      ] }),
                      /* @__PURE__ */ jsxs("button", { className: "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700", children: [
                        /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }),
                        "Download"
                      ] })
                    ] })
                  ] })
                ]
              }
            )
          ]
        }
      ),
      isNewFolderModalOpen && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center",
          onClick: () => setIsNewFolderModalOpen(false),
          children: [
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30 backdrop-blur-sm" }),
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200",
                onClick: (e) => e.stopPropagation(),
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-gray-100", children: [
                    /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold text-gray-900", children: "Create New Folder" }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsNewFolderModalOpen(false),
                        className: "p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors",
                        children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "px-6 py-5", children: [
                    /* @__PURE__ */ jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1.5", children: [
                      "Folder name ",
                      /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "text",
                        value: newFolderName,
                        onChange: (e) => setNewFolderName(e.target.value),
                        placeholder: "Enter folder name",
                        className: "w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors",
                        autoFocus: true
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsNewFolderModalOpen(false),
                        className: "px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors",
                        children: "Cancel"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => {
                          console.log("Creating folder:", newFolderName);
                          setIsNewFolderModalOpen(false);
                          setNewFolderName("");
                        },
                        disabled: !newFolderName,
                        className: "px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                        children: "Create Folder"
                      }
                    )
                  ] })
                ]
              }
            )
          ]
        }
      ),
      isUploadModalOpen && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center",
          onClick: () => setIsUploadModalOpen(false),
          children: [
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/30 backdrop-blur-sm" }),
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "relative z-10 w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200",
                onClick: (e) => e.stopPropagation(),
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-gray-100", children: [
                    /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold text-gray-900", children: "Upload Files" }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsUploadModalOpen(false),
                        className: "p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors",
                        children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "px-6 py-5", children: /* @__PURE__ */ jsxs("div", { className: "border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group", children: [
                    /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 mb-4 group-hover:bg-indigo-100 transition-colors", children: /* @__PURE__ */ jsx("svg", { className: "h-7 w-7 text-indigo-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" }) }) }),
                    /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-gray-900 mb-1", children: "Click to upload or drag and drop" }),
                    /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500", children: "PDF, DWG, RVT, IFC, NWC or other files up to 500MB" })
                  ] }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsUploadModalOpen(false),
                        className: "px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors",
                        children: "Cancel"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setIsUploadModalOpen(false),
                        className: "px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors",
                        children: "Upload"
                      }
                    )
                  ] })
                ]
              }
            )
          ]
        }
      ),
      activeTab === "clashes" && /* @__PURE__ */ jsx(ClashesTab, { projectPublicId: project.publicId, projectDisplayName: project.name }),
      activeTab === "teams" && /* @__PURE__ */ jsx(TeamsTab, { projectPublicId: project.publicId, currentUserRole: project.role }),
      activeTab === "extensions" && /* @__PURE__ */ jsx(ExtensionsTab, {}),
      activeTab === "settings" && /* @__PURE__ */ jsx(
        SettingsTab,
        {
          projectName: project.name,
          projectCode: project.publicId,
          projectDescription: project.description,
          projectPublicId: project.publicId
        }
      ),
      !["overview", "packages", "documents", "versions", "changes", "tasks", "clashes", "teams", "extensions", "settings"].includes(activeTab) && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" }) }) }),
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2 capitalize", children: activeTab }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "This section is under development" })
      ] }),
      /* @__PURE__ */ jsx(Dialog, { open: !!selectedTaskId, onOpenChange: (open) => !open && setSelectedTaskId(null), children: /* @__PURE__ */ jsx(DialogContent, { className: "max-w-[calc(100%-2rem)] w-[1100px] max-h-[90vh] overflow-y-auto p-0", children: selectedTaskId && /* @__PURE__ */ jsx(TaskDetailPage, { projectPublicId: project.publicId, taskId: selectedTaskId }) }) }),
      /* @__PURE__ */ jsx(
        CreateTaskModal,
        {
          isOpen: isNewTaskModalOpen,
          onClose: () => setIsNewTaskModalOpen(false),
          assigneeOptions: teamMembers.map((m) => ({ id: m.id, name: m.name })),
          tagOptions: projectTaskTags,
          onSubmit: async (task) => {
            try {
              const response = await apiFetch("/api/tasks/create", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                  projectId: project.publicId,
                  title: task.title,
                  status: task.status,
                  priority: task.priority,
                  description: task.description,
                  assigneeId: task.assignee || void 0,
                  dueDate: task.dueDate || void 0,
                  linkedUrl: task.linkedItems || void 0,
                  tags: task.tags
                })
              });
              if (response.status === 404) {
                toast.error("Tasks API is not available yet");
                return;
              }
              if (!response.ok) {
                toast.error("Failed to create task");
                return;
              }
              toast.success("Task created");
              await loadProjectTasks();
            } catch {
              toast.error("Failed to create task");
            }
          }
        }
      )
    ] })
  ] });
}
function ProjectDetailPage({ project }) {
  return /* @__PURE__ */ jsx(QueryClientProvider, { client: queryClient, children: /* @__PURE__ */ jsx(ClashViewerProvider, { children: /* @__PURE__ */ jsx(ProjectDetailPageContent, { project }) }) });
}

const prerender = false;
const $$publicId = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$publicId;
  const backendUrl = "http://localhost:3000";
  const accessToken = Astro2.cookies.get("accessToken")?.value;
  const publicId = Astro2.params.publicId;
  let project = null;
  if (!publicId) {
    return Astro2.redirect("/projects");
  }
  try {
    const res = await fetch(`${backendUrl}/api/projects/me`, {
      headers: {
        Cookie: `accessToken=${accessToken}`,
        Accept: "application/json"
      },
      credentials: "include"
    });
    if (res.ok) {
      const payload = await res.json();
      const projects = Array.isArray(payload?.data) ? payload.data : [];
      project = projects.find((p) => String(p.publicId) === publicId);
    }
  } catch {
  }
  if (!project) {
    return Astro2.redirect("/projects");
  }
  return renderTemplate`${renderComponent($$result, "ProjectLayout", $$ProjectLayout, { "title": `${project.name} - ORBIT`, "projectName": String(project.name), "projectSlug": String(project.publicId) }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "ProjectDetailPage", ProjectDetailPage, { "project": project, "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/ProjectDetailPage", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/projects/[publicId].astro", void 0);
const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/projects/[publicId].astro";
const $$url = "/projects/[publicId]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$publicId,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
