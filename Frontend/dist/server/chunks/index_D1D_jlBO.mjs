import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSensors, useSensor, PointerSensor, DndContext, closestCenter, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { toast } from 'sonner';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { N as NewProjectButton } from './CreateProjectModal_DFqrvB6z.mjs';
import { S as Skeleton } from './skeleton_Bm27Yo3I.mjs';
import { u as useAppStore } from './appStore_D9wuFrkU.mjs';

function ProjectsSkeleton() {
  return /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-8", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-7 w-28" }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-9 w-24 rounded-lg" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-9 w-32 rounded-lg" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-20" }),
      /* @__PURE__ */ jsx("div", { className: "flex gap-3", children: Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border bg-card p-3 flex items-center gap-2 min-w-[140px]", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-8 w-8 rounded-lg flex-shrink-0" }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-1 flex-1", children: [
          /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-full" }),
          /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-2/3" })
        ] })
      ] }, i)) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: Array.from({ length: 4 }).map((_, i) => /* @__PURE__ */ jsx(Skeleton, { className: "h-8 w-20 rounded-full" }, i)) }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-32" }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border bg-card overflow-hidden", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-36 w-full rounded-none" }),
        /* @__PURE__ */ jsxs("div", { className: "p-4 space-y-3", children: [
          /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-3/4" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-16" }),
            /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-12" })
          ] }),
          /* @__PURE__ */ jsx(Skeleton, { className: "h-1.5 w-full rounded-full" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("div", { className: "flex -space-x-1", children: Array.from({ length: 3 }).map((_2, j) => /* @__PURE__ */ jsx(Skeleton, { className: "h-6 w-6 rounded-full ring-2 ring-background" }, j)) }),
            /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-16 rounded-full" })
          ] })
        ] })
      ] }, i)) })
    ] })
  ] });
}

const PROJECTS_CACHE_KEY = "orbit:projects:me";
const FOLDERS_CACHE_KEY = "orbit:folders:me";
const PROJECTS_CACHE_TTL_MS = 3e4;
const FOLDERS_CACHE_TTL_MS = 45e3;
const FOLDER_COLORS = [
  { id: "blue", bg: "bg-blue-100", icon: "text-blue-500", border: "border-blue-200" },
  { id: "red", bg: "bg-red-100", icon: "text-red-500", border: "border-red-200" },
  { id: "orange", bg: "bg-orange-100", icon: "text-orange-500", border: "border-orange-200" },
  { id: "pink", bg: "bg-pink-100", icon: "text-pink-500", border: "border-pink-200" },
  { id: "purple", bg: "bg-purple-100", icon: "text-purple-500", border: "border-purple-200" },
  { id: "green", bg: "bg-green-100", icon: "text-green-500", border: "border-green-200" },
  { id: "indigo", bg: "bg-indigo-100", icon: "text-indigo-500", border: "border-indigo-200" },
  { id: "violet", bg: "bg-violet-100", icon: "text-violet-500", border: "border-violet-200" },
  { id: "rose", bg: "bg-rose-100", icon: "text-rose-500", border: "border-rose-200" },
  { id: "yellow", bg: "bg-yellow-100", icon: "text-yellow-600", border: "border-yellow-200" },
  { id: "cyan", bg: "bg-cyan-100", icon: "text-cyan-500", border: "border-cyan-200" },
  { id: "gray", bg: "bg-gray-100", icon: "text-gray-500", border: "border-gray-200" }
];
const TYPE_CONFIG = {
  construction: {
    color: "text-blue-600",
    bg: "bg-blue-50",
    label: "Construction",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }) })
  },
  design: {
    color: "text-purple-600",
    bg: "bg-purple-50",
    label: "Design",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" }) })
  },
  software: {
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    label: "Software",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" }) })
  },
  research: {
    color: "text-teal-600",
    bg: "bg-teal-50",
    label: "Research",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }) })
  }
};
const STATUS_COLORS = {
  active: { bg: "bg-green-500", text: "text-white" },
  review: { bg: "bg-amber-500", text: "text-white" },
  paused: { bg: "bg-gray-500", text: "text-white" },
  planning: { bg: "bg-gray-400", text: "text-white" },
  completed: { bg: "bg-blue-500", text: "text-white" }
};
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
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
}
function toSlug(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}
function mapApiProjectToUiProject(project) {
  return {
    id: project.publicId,
    name: project.name,
    slug: toSlug(project.name || project.publicId),
    thumbnail: project.coverImageUrl || "",
    lastVisited: project.lastVisitedAt ? new Date(project.lastVisitedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
    category: "shared",
    description: project.description || "",
    progress: 0,
    teamMembers: 0,
    issues: 0,
    status: project.status === "accepted" ? "active" : "planning",
    projectType: (project.industry || "software").toLowerCase(),
    isFavorite: false,
    folderIds: Array.isArray(project.folderIds) ? project.folderIds : [],
    role: project.role
  };
}
function mapApiFolderToUiFolder(folder, projects) {
  return {
    id: folder.publicId,
    name: folder.name,
    color: folder.color || "blue",
    description: folder.description || "",
    projectCount: projects.filter((project) => (project.folderIds || []).includes(folder.publicId)).length
  };
}
function mapCreatedProjectToUiProject(project) {
  return mapApiProjectToUiProject({
    publicId: project.publicId,
    name: project.name,
    description: project.description,
    industry: project.industry,
    coverImageUrl: project.coverImageUrl,
    role: project.role,
    status: project.status
  });
}
function FolderIcon({ className }) {
  return /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" }) });
}
function CreateFolderModal({
  isOpen,
  onClose,
  onCreateFolder
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setSelectedColor("blue");
    }
  }, [isOpen]);
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateFolder({ name: name.trim(), description: description.trim(), color: selectedColor });
    onClose();
  };
  if (!isOpen) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
    /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm", onClick: onClose }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-50 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-6 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100", children: /* @__PURE__ */ jsx(FolderIcon, { className: "h-5 w-5 text-blue-500" }) }),
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Create New Folder" })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: onClose, className: "rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600", children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mb-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-2 block text-sm font-medium text-gray-700", children: [
            "Folder Name ",
            /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: name,
              onChange: (e) => setName(e.target.value),
              placeholder: "e.g., Marketing Campaigns",
              className: "h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20",
              autoFocus: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "mb-2 block text-sm font-medium text-gray-700", children: "Description" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: description,
              onChange: (e) => setDescription(e.target.value),
              placeholder: "Add a description for this folder...",
              rows: 3,
              className: "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "mb-3 block text-sm font-medium text-gray-700", children: "Folder Color" }),
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-6 gap-2", children: FOLDER_COLORS.map((color) => /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setSelectedColor(color.id),
              className: cn(
                "relative flex h-12 w-full items-center justify-center rounded-lg border-2 transition-all",
                color.bg,
                selectedColor === color.id ? "border-blue-500" : "border-transparent hover:border-gray-300"
              ),
              children: [
                /* @__PURE__ */ jsx(FolderIcon, { className: cn("h-6 w-6", color.icon) }),
                selectedColor === color.id && /* @__PURE__ */ jsx("div", { className: "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500", children: /* @__PURE__ */ jsx("svg", { className: "h-3 w-3 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) }) })
              ]
            },
            color.id
          )) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3 pt-4", children: [
          /* @__PURE__ */ jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors", children: "Cancel" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "submit",
              disabled: !name.trim(),
              className: "flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed",
              children: "Create Folder"
            }
          )
        ] })
      ] })
    ] })
  ] });
}
function FolderCard({
  folder,
  onClick
}) {
  const colorConfig = FOLDER_COLORS.find((c) => c.id === folder.color) || FOLDER_COLORS[0];
  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: "folder", folderId: folder.id }
  });
  return /* @__PURE__ */ jsxs(
    "button",
    {
      ref: setNodeRef,
      onClick,
      className: cn(
        "group flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left transition-all hover:border-gray-200 hover:shadow-sm",
        isOver ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-100"
      ),
      children: [
        /* @__PURE__ */ jsx("div", { className: cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", colorConfig.bg), children: /* @__PURE__ */ jsx(FolderIcon, { className: cn("h-5 w-5", colorConfig.icon) }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsx("h3", { className: "truncate text-sm font-medium text-gray-900", children: folder.name }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500", children: [
            folder.projectCount,
            " projects"
          ] })
        ] })
      ]
    }
  );
}
function ProjectListItem({ project, isDragging = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: `project:${project.id}`,
    data: { type: "project", projectId: project.id }
  });
  const type = TYPE_CONFIG[project.projectType || "software"] || TYPE_CONFIG.software;
  const status = STATUS_COLORS[project.status || "active"] || STATUS_COLORS.active;
  const progress = project.progress || 0;
  return /* @__PURE__ */ jsxs(
    motion.a,
    {
      ref: setNodeRef,
      href: `/projects/${project.id}`,
      ...attributes,
      ...listeners,
      layout: true,
      transition: { type: "spring", stiffness: 140, damping: 24, mass: 1.1 },
      style: {
        transform: CSS.Transform.toString(transform),
        transition: transition ? transition.replace(/\d+(\.\d+)?ms/g, "260ms") : void 0
      },
      className: cn(
        "group flex items-center gap-4 rounded-xl border border-gray-100 bg-white transition-[transform,opacity] duration-200",
        (isDragging || isSortableDragging) && "scale-[0.98] opacity-80 pointer-events-none"
      ),
      children: [
        /* @__PURE__ */ jsx("div", { className: cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", type.bg), children: /* @__PURE__ */ jsx("span", { className: type.color, children: type.icon }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-medium text-gray-900", children: project.name }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 line-clamp-1", children: project.description }),
          /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("div", { className: "h-1.5 w-16 overflow-hidden rounded-full bg-gray-100", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-blue-500", style: { width: `${progress}%` } }) }),
              /* @__PURE__ */ jsxs("span", { className: "font-medium text-gray-700", children: [
                progress,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" }) }),
              project.teamMembers || 0
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }),
              project.issues || 0
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
              formatRelativeTime(project.lastVisited)
            ] }),
            /* @__PURE__ */ jsx("span", { className: cn("rounded-full px-2 py-0.5 text-xs font-medium", type.bg, type.color), children: type.label })
          ] })
        ] }),
        /* @__PURE__ */ jsx("span", { className: cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", status.bg, status.text), children: project.status })
      ]
    }
  );
}
function ProjectGridCard({ project, isDragging = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: `project:${project.id}`,
    data: { type: "project", projectId: project.id }
  });
  const type = TYPE_CONFIG[project.projectType || "software"] || TYPE_CONFIG.software;
  const status = STATUS_COLORS[project.status || "active"] || STATUS_COLORS.active;
  const progress = project.progress || 0;
  return /* @__PURE__ */ jsxs(
    motion.a,
    {
      ref: setNodeRef,
      href: `/projects/${project.id}`,
      ...attributes,
      ...listeners,
      layout: true,
      transition: { type: "spring", stiffness: 150, damping: 26, mass: 1.05 },
      style: {
        transform: CSS.Transform.toString(transform),
        transition
      },
      className: cn(
        "group flex h-full min-h-[340px] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white transition-[transform,opacity] duration-200",
        (isDragging || isSortableDragging) && "scale-[0.98] opacity-40 pointer-events-none"
      ),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "relative h-36 overflow-hidden", children: [
          project.thumbnail ? /* @__PURE__ */ jsx(
            "img",
            {
              src: project.thumbnail,
              alt: "",
              className: "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
              onError: (e) => {
                const target = e.target;
                target.style.display = "none";
                target.nextElementSibling?.classList.remove("hidden");
              }
            }
          ) : null,
          /* @__PURE__ */ jsx("div", { className: cn(
            "absolute inset-0 flex items-center justify-center",
            project.thumbnail ? "hidden" : "",
            project.projectType === "software" && "bg-gradient-to-br from-cyan-50 to-cyan-100",
            project.projectType === "design" && "bg-gradient-to-br from-purple-50 to-purple-100",
            project.projectType === "construction" && "bg-gradient-to-br from-blue-50 to-blue-100",
            project.projectType === "research" && "bg-gradient-to-br from-teal-50 to-teal-100",
            !project.projectType && "bg-gradient-to-br from-gray-50 to-gray-100"
          ), children: /* @__PURE__ */ jsx("div", { className: cn(
            "flex h-14 w-14 items-center justify-center rounded-xl",
            project.projectType === "software" && "bg-cyan-500 text-white",
            project.projectType === "design" && "bg-purple-500 text-white",
            project.projectType === "construction" && "bg-blue-500 text-white",
            project.projectType === "research" && "bg-teal-500 text-white",
            !project.projectType && "bg-gray-500 text-white"
          ), children: /* @__PURE__ */ jsxs("svg", { className: "h-7 w-7", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
            project.projectType === "software" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" }),
            project.projectType === "design" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" }),
            project.projectType === "construction" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }),
            project.projectType === "research" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }),
            !project.projectType && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" })
          ] }) }) }),
          project.isFavorite && /* @__PURE__ */ jsx("div", { className: "absolute left-3 top-3", children: /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-white", fill: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" }) }) }) }),
          /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-3", children: /* @__PURE__ */ jsx("span", { className: cn("rounded-full px-2.5 py-1 text-xs font-medium", status.bg, status.text), children: project.status }) }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-3 left-3", children: /* @__PURE__ */ jsxs("span", { className: cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", type.bg, type.color), children: [
            type.icon,
            type.label
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-1 flex-col p-4", children: [
          /* @__PURE__ */ jsx("h3", { className: "mb-1 font-medium text-gray-900 line-clamp-1", children: project.name }),
          /* @__PURE__ */ jsx("p", { className: "mb-3 text-xs text-gray-500 line-clamp-1", children: project.description }),
          /* @__PURE__ */ jsxs("div", { className: "mb-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-xs", children: [
              /* @__PURE__ */ jsx("span", { className: "text-gray-500", children: "Progress" }),
              /* @__PURE__ */ jsxs("span", { className: "font-medium text-gray-900", children: [
                progress,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-blue-500", style: { width: `${progress}%` } }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 text-xs text-gray-500", children: [
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" }) }),
              project.teamMembers || 0
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }),
              project.issues || 0
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
              formatRelativeTime(project.lastVisited)
            ] })
          ] })
        ] })
      ]
    }
  );
}
function ProjectsManager(_props) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [folders, setFolders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isMovingProject, setIsMovingProject] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const projectsCacheRef = useRef(null);
  const foldersCacheRef = useRef(null);
  const filterRef = useRef(null);
  const socketRef = useRef(null);
  const loadProjectsRef = useRef(
    async () => []
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );
  const getProjectsForFolder = (folderId) => {
    return projects.filter((p) => (p.folderIds || []).includes(folderId));
  };
  const filteredFolders = folders.filter(
    (f) => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const currentFolderProjects = currentFolder ? getProjectsForFolder(currentFolder.id).filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).filter((p) => !filterStatus || p.status === filterStatus) : [];
  const priorityProjects = projects.filter((p) => p.status === "active" || p.status === "review").filter((p) => !filterStatus || p.status === filterStatus).filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => {
    const priorityOrder = ["metro-station-phase-2", "office-complex-tower-a"];
    const aIndex = priorityOrder.indexOf(a.slug);
    const bIndex = priorityOrder.indexOf(b.slug);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });
  const handleCreateFolder = async (folderData) => {
    const requestPromise = (async () => {
      const response = await fetch("/api/folders/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(folderData)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Create folder failed");
      }
      const updatedProjects = await loadProjects(false, { force: true });
      await loadFolders(updatedProjects, { force: true });
      return folderData;
    })();
    await toast.promise(requestPromise, {
      loading: "Creating folder...",
      success: (data) => `${data.name} đã được tạo thành công`,
      error: (err) => err?.message || "Không thể tạo folder"
    });
  };
  const upsertProject = useCallback((nextProject) => {
    setProjects((prev) => {
      const exists = prev.some((item) => item.id === nextProject.id);
      if (exists) {
        return prev.map((item) => item.id === nextProject.id ? { ...item, ...nextProject } : item);
      }
      return [nextProject, ...prev];
    });
  }, []);
  const handleProjectCreated = async (project) => {
    upsertProject(mapCreatedProjectToUiProject(project));
    const updatedProjects = await loadProjects(false, { force: true });
    await loadFolders(updatedProjects, { force: true });
  };
  const loadProjects = useCallback(async (showLoading = false, options) => {
    const shouldForce = options?.force === true;
    if (!shouldForce && projectsCacheRef.current && projectsCacheRef.current.expiresAt > Date.now()) {
      const cached = projectsCacheRef.current.data;
      setProjects(cached);
      return cached;
    }
    const storeProjects = useAppStore.getState().projects;
    if (!shouldForce && storeProjects.length > 0) {
      const nextProjects = storeProjects.map(mapApiProjectToUiProject);
      setProjects(nextProjects);
      return nextProjects;
    }
    if (!shouldForce && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(PROJECTS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.expiresAt > Date.now() && Array.isArray(parsed.data)) {
            projectsCacheRef.current = parsed;
            setProjects(parsed.data);
            return parsed.data;
          }
        }
      } catch {
      }
    }
    if (showLoading) setIsProjectsLoading(true);
    try {
      const response = await fetch("/api/projects/me", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) return [];
      const payload = await response.json();
      const apiProjects = Array.isArray(payload?.data) ? payload.data : [];
      const nextProjects = apiProjects.map(mapApiProjectToUiProject);
      const cacheValue = { data: nextProjects, expiresAt: Date.now() + PROJECTS_CACHE_TTL_MS };
      projectsCacheRef.current = cacheValue;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(cacheValue));
      }
      useAppStore.getState().setProjects(apiProjects);
      setProjects(nextProjects);
      return nextProjects;
    } catch {
      return [];
    } finally {
      if (showLoading) setIsProjectsLoading(false);
    }
  }, []);
  loadProjectsRef.current = loadProjects;
  const loadFolders = useCallback(async (projectsSource, options) => {
    const shouldForce = options?.force === true;
    if (!shouldForce && foldersCacheRef.current && foldersCacheRef.current.expiresAt > Date.now()) {
      setFolders(foldersCacheRef.current.data.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
      return;
    }
    const storeFolders = useAppStore.getState().folders;
    if (!shouldForce && storeFolders.length > 0) {
      setFolders(storeFolders.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
      return;
    }
    if (!shouldForce && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(FOLDERS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.expiresAt > Date.now() && Array.isArray(parsed.data)) {
            foldersCacheRef.current = parsed;
            setFolders(parsed.data.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
            return;
          }
        }
      } catch {
      }
    }
    try {
      const response = await fetch("/api/folders/me", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) return;
      const payload = await response.json();
      const apiFolders = Array.isArray(payload?.data) ? payload.data : [];
      const cacheValue = { data: apiFolders, expiresAt: Date.now() + FOLDERS_CACHE_TTL_MS };
      foldersCacheRef.current = cacheValue;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(FOLDERS_CACHE_KEY, JSON.stringify(cacheValue));
      }
      useAppStore.getState().setFolders(apiFolders);
      setFolders(apiFolders.map((folder) => mapApiFolderToUiFolder(folder, projectsSource)));
    } catch {
    }
  }, []);
  const handleDropProjectToFolder = async (projectId, folderId) => {
    if (isMovingProject) return;
    setIsMovingProject(true);
    try {
      const response = await fetch("/api/projects/move-folder", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ projectId, folderId })
      });
      if (!response.ok) {
        return;
      }
      const updatedProjects = await loadProjects(false, { force: true });
      await loadFolders(updatedProjects, { force: true });
    } finally {
      setIsMovingProject(false);
    }
  };
  const handleDragStart = (event) => {
    const id = String(event.active.id);
    if (!id.startsWith("project:")) return;
    setActiveProjectId(id.replace("project:", ""));
  };
  const handleDragEnd = async (event) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveProjectId(null);
    if (!activeId.startsWith("project:")) return;
    const draggedProjectId = activeId.replace("project:", "");
    if (overId?.startsWith("folder:")) {
      const folderId = overId.replace("folder:", "");
      await handleDropProjectToFolder(draggedProjectId, folderId);
      return;
    }
    if (overId?.startsWith("project:") && overId !== activeId) {
      const activeIndex = projects.findIndex((p) => p.id === draggedProjectId);
      const overProjectId = overId.replace("project:", "");
      const overIndex = projects.findIndex((p) => p.id === overProjectId);
      if (activeIndex >= 0 && overIndex >= 0) {
        setProjects((prev) => arrayMove(prev, activeIndex, overIndex));
      }
    }
  };
  const storeProjectsLen = useAppStore((s) => s.projects.length);
  useEffect(() => {
    const storeProjects = useAppStore.getState().projects;
    if (storeProjects.length > 0) {
      const mapped = storeProjects.map(mapApiProjectToUiProject);
      setProjects(mapped);
      setIsProjectsLoading(false);
      loadProjects(false, { force: true }).then((fresh) => {
        const source = fresh.length > 0 ? fresh : mapped;
        if (source.length > 0) loadFolders(source, { force: true });
      });
      return;
    }
    loadProjects(true, { force: true }).then((fetched) => {
      if (fetched.length > 0) loadFolders(fetched, { force: true });
    });
  }, [storeProjectsLen]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  useEffect(() => {
    const storeSocket = useAppStore.getState().socket;
    if (storeSocket) socketRef.current = storeSocket;
    const handleCreated = (payload) => {
      const incoming = "publicId" in payload ? payload : payload.project || payload.data;
      if (!incoming?.publicId) return;
      upsertProject(mapCreatedProjectToUiProject(incoming));
    };
    const handleUpdated = (payload) => {
      const incoming = "publicId" in payload ? payload : payload.project || payload.data;
      if (!incoming?.publicId) return;
      upsertProject(mapCreatedProjectToUiProject(incoming));
    };
    const socket = storeSocket ?? socketRef.current;
    if (!socket) return;
    socket.on("project:created", handleCreated);
    socket.on("project:updated", handleUpdated);
    const handleCacheInvalidate = (payload) => {
      const { cacheTypes } = payload.data ?? {};
      if (!Array.isArray(cacheTypes)) return;
      if (cacheTypes.includes("projects")) {
        projectsCacheRef.current = null;
        loadProjectsRef.current(false, { force: true });
      }
    };
    const handleMemberRemoved = (payload) => {
      if (!payload?.projectId) return;
      setProjects((prev) => prev.filter((p) => p.id !== payload.projectId));
      projectsCacheRef.current = null;
      loadProjectsRef.current(false, { force: true });
    };
    socket.on("cache:invalidate", handleCacheInvalidate);
    socket.on("member:removed", handleMemberRemoved);
    return () => {
      socket.off("project:created", handleCreated);
      socket.off("project:updated", handleUpdated);
      socket.off("cache:invalidate", handleCacheInvalidate);
      socket.off("member:removed", handleMemberRemoved);
    };
  }, []);
  if (!isHydrated || isProjectsLoading) return /* @__PURE__ */ jsx(ProjectsSkeleton, {});
  const activeProject = activeProjectId ? projects.find((project) => project.id === activeProjectId) || null : null;
  return /* @__PURE__ */ jsx(
    DndContext,
    {
      sensors,
      collisionDetection: closestCenter,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      children: /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
          /* @__PURE__ */ jsx(NewProjectButton, { onProjectCreated: handleProjectCreated }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setShowFolderModal(true),
              className: "flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]",
              children: [
                /* @__PURE__ */ jsx(FolderIcon, { className: "h-4 w-4" }),
                "New Folder"
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "flex-1 max-w-sm", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsx("svg", { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                placeholder: "Search projects...",
                className: "h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxs("div", { ref: filterRef, className: "relative", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setShowFilterMenu(!showFilterMenu),
                  className: cn(
                    "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                    filterStatus ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  ),
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" }) }),
                    "Filter"
                  ]
                }
              ),
              showFilterMenu && /* @__PURE__ */ jsxs("div", { className: "absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-100 bg-white py-1 shadow-lg", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => {
                      setFilterStatus(null);
                      setShowFilterMenu(false);
                    },
                    className: cn("flex w-full items-center px-3 py-2 text-sm", !filterStatus ? "bg-gray-50 text-gray-900" : "text-gray-700 hover:bg-gray-50"),
                    children: "All Projects"
                  }
                ),
                ["active", "review", "paused", "planning", "completed"].map((status) => /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => {
                      setFilterStatus(status);
                      setShowFilterMenu(false);
                    },
                    className: cn("flex w-full items-center px-3 py-2 text-sm capitalize", filterStatus === status ? "bg-gray-50 text-gray-900" : "text-gray-700 hover:bg-gray-50"),
                    children: status
                  },
                  status
                ))
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-lg border border-gray-200 bg-white p-1", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setViewMode("list"),
                  className: cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
                  ),
                  children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) })
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setViewMode("grid"),
                  className: cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
                  ),
                  children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" }) })
                }
              )
            ] })
          ] })
        ] }),
        currentFolder && /* @__PURE__ */ jsxs("nav", { className: "flex items-center gap-2 text-sm", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setCurrentFolder(null),
              className: "text-gray-500 hover:text-gray-900 transition-colors",
              children: "Projects"
            }
          ),
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }),
          /* @__PURE__ */ jsx("span", { className: "font-medium text-gray-900", children: currentFolder.name })
        ] }),
        !currentFolder ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx("h2", { className: "mb-4 text-sm font-medium text-gray-900", children: "Folders" }),
            filteredFolders.length > 0 ? /* @__PURE__ */ jsx("div", { className: "grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]", children: filteredFolders.map((folder) => /* @__PURE__ */ jsx(
              FolderCard,
              {
                folder,
                onClick: () => setCurrentFolder(folder)
              },
              folder.id
            )) }) : /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center", children: [
              /* @__PURE__ */ jsx(FolderIcon, { className: "mx-auto h-10 w-10 text-gray-300" }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-gray-500", children: "No folders found" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx("h2", { className: "mb-4 text-sm font-medium text-gray-900", children: "Priority Projects" }),
            priorityProjects.length > 0 ? /* @__PURE__ */ jsx(
              SortableContext,
              {
                items: priorityProjects.map((project) => `project:${project.id}`),
                strategy: viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy,
                children: /* @__PURE__ */ jsx("div", { className: cn(
                  viewMode === "grid" ? "grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]" : "space-y-3"
                ), children: priorityProjects.map((project) => viewMode === "grid" ? /* @__PURE__ */ jsx(ProjectGridCard, { project, isDragging: activeProjectId === project.id }, project.id) : /* @__PURE__ */ jsx(ProjectListItem, { project, isDragging: activeProjectId === project.id }, project.id)) })
              }
            ) : /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center", children: [
              /* @__PURE__ */ jsx("svg", { className: "mx-auto h-10 w-10 text-gray-300", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-gray-500", children: "No projects match your filters" })
            ] })
          ] })
        ] }) : (
          /* Folder Detail View */
          /* @__PURE__ */ jsx("section", { children: currentFolderProjects.length > 0 ? /* @__PURE__ */ jsx(
            SortableContext,
            {
              items: currentFolderProjects.map((project) => `project:${project.id}`),
              strategy: viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy,
              children: /* @__PURE__ */ jsx("div", { className: cn(
                viewMode === "grid" ? "grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]" : "space-y-3"
              ), children: currentFolderProjects.map((project) => viewMode === "grid" ? /* @__PURE__ */ jsx(ProjectGridCard, { project, isDragging: activeProjectId === project.id }, project.id) : /* @__PURE__ */ jsx(ProjectListItem, { project, isDragging: activeProjectId === project.id }, project.id)) })
            }
          ) : (
            /* Empty Folder State */
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-4", children: /* @__PURE__ */ jsx(FolderIcon, { className: "h-10 w-10 text-gray-400" }) }),
              /* @__PURE__ */ jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "This folder is empty" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 mb-6 text-center max-w-sm", children: "Start adding projects to organize your work. Projects in this folder will appear here." }),
              /* @__PURE__ */ jsx(NewProjectButton, {})
            ] })
          ) })
        ),
        /* @__PURE__ */ jsx(
          CreateFolderModal,
          {
            isOpen: showFolderModal,
            onClose: () => setShowFolderModal(false),
            onCreateFolder: handleCreateFolder
          }
        ),
        /* @__PURE__ */ jsx(
          DragOverlay,
          {
            modifiers: [snapCenterToCursor],
            dropAnimation: {
              duration: 320,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)"
            },
            children: activeProject ? viewMode === "grid" ? /* @__PURE__ */ jsx("div", { className: "w-[280px] opacity-80", children: /* @__PURE__ */ jsx(ProjectGridCard, { project: activeProject }) }) : /* @__PURE__ */ jsx("div", { className: "w-full max-w-[760px] opacity-80", children: /* @__PURE__ */ jsx(ProjectListItem, { project: activeProject }) }) : null
          }
        )
      ] })
    }
  );
}

const prerender = false;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Projects - ORBIT", "pageTitle": "Project" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "ProjectsManager", ProjectsManager, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/ProjectsManager", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/projects/index.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/projects/index.astro";
const $$url = "/projects";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
