import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useEffect, useRef } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { N as NewProjectButton } from './CreateProjectModal_DFqrvB6z.mjs';
import { S as Skeleton } from './skeleton_Bm27Yo3I.mjs';
import { u as useAppStore } from './appStore_D9wuFrkU.mjs';
import { a as apiFetch } from './api-client_BrBa9f1N.mjs';

function DashboardSkeleton() {
  return (
    // Matches HomeDashboard's outer wrapper: space-y-8 py-6 px-6 lg:px-[80px] xl:px-[160px]
    /* @__PURE__ */ jsxs("div", { className: "space-y-8 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-7 w-56" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-9 w-32 rounded-lg" })
      ] }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-12 w-full max-w-2xl rounded-xl" }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-36" }),
          /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-16" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border bg-card overflow-hidden", children: [
          /* @__PURE__ */ jsx(Skeleton, { className: "h-36 w-full rounded-none" }),
          /* @__PURE__ */ jsxs("div", { className: "p-4 space-y-2", children: [
            /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-3/4" }),
            /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-1/2" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-1", children: [
              /* @__PURE__ */ jsx(Skeleton, { className: "h-2 w-full max-w-[120px] rounded-full" }),
              /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-8" })
            ] })
          ] })
        ] }, i)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "rounded-xl border bg-card p-4 space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-36" }),
            /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-16" })
          ] }),
          Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
            /* @__PURE__ */ jsx(Skeleton, { className: "h-10 w-10 rounded-lg flex-shrink-0" }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-1.5 flex-1", children: [
              /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-full" }),
              /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-2/3" }),
              /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-1/3" })
            ] })
          ] }, i))
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-xl border bg-card p-4 space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-28" }),
            /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-16" })
          ] }),
          Array.from({ length: 4 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-4 rounded" }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-1", children: [
              /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-full" }),
              /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-1/2" })
            ] }),
            /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-14 rounded-full" })
          ] }, i))
        ] })
      ] })
    ] })
  );
}

const SearchIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) });
const ClockIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) });
const CalendarIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) });
const TaskIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" }) });
const UsersIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" }) });
const CheckIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) });
const FolderIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" }) });
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = /* @__PURE__ */ new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1e3 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}
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
function HomeDashboard({ userName: initialUserName }) {
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, tasksRes] = await Promise.all([
          apiFetch("/api/projects/me"),
          apiFetch("/api/tasks/list")
        ]);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const mappedProjects = (projectsData.data || []).map((p) => ({
            id: p.publicId,
            slug: p.publicId,
            name: p.name,
            description: p.description,
            thumbnail: p.coverImageUrl || "",
            lastVisited: p.lastVisitedAt ? new Date(p.lastVisitedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
            category: "shared",
            status: p.status || "active",
            projectType: (p.industry || "software").toLowerCase(),
            isFavorite: false
          }));
          setProjects(mappedProjects);
        }
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          const mappedTasks = (tasksData.data || []).map((t) => ({
            id: t._id,
            title: t.title,
            project: t.project?.name || "Unknown Project",
            dueDate: t.dueDate,
            priority: t.priority
          }));
          setTasks(mappedTasks);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  const [displayUserName, setDisplayUserName] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const u = localStorage.getItem("orbit_user");
      return u ? JSON.parse(u).fullName || "" : "";
    } catch {
      return "";
    }
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [completedTasks, setCompletedTasks] = useState(/* @__PURE__ */ new Set());
  const searchRef = useRef(null);
  useEffect(() => {
    setIsHydrated(true);
    const storeAuth = useAppStore.getState().auth;
    if (storeAuth?.fullName) {
      setDisplayUserName(storeAuth.fullName);
      return;
    }
    const u = localStorage.getItem("orbit_user");
    if (u) {
      try {
        setDisplayUserName(JSON.parse(u).fullName || "");
      } catch {
      }
    }
  }, []);
  const recentProjects = [...projects].sort((a, b) => {
    const priorityOrder = ["metro-station-phase-2", "office-complex-tower-a"];
    const aIndex = priorityOrder.indexOf(a.slug);
    const bIndex = priorityOrder.indexOf(b.slug);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime();
  }).slice(0, 7);
  projects.length;
  projects.filter((p) => p.status === "active").length;
  tasks.length;
  const pendingTasks = tasks.length - completedTasks.size;
  events.filter((e) => new Date(e.datetime) >= /* @__PURE__ */ new Date()).length;
  projects.reduce((sum, p) => sum + (p.issues || 0), 0);
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results = [];
    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)) {
        results.push({
          type: "project",
          id: p.id,
          title: p.name,
          subtitle: p.description,
          href: `/projects/${p.slug}`
        });
      }
    });
    tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(query) || t.project.toLowerCase().includes(query)) {
        results.push({
          type: "task",
          id: t.id,
          title: t.title,
          subtitle: `${t.project} - Due ${formatDate(t.dueDate)}`
        });
      }
    });
    events.forEach((e) => {
      if (e.title.toLowerCase().includes(query) || e.project.toLowerCase().includes(query)) {
        results.push({
          type: "event",
          id: e.id,
          title: e.title,
          subtitle: `${e.project} - ${formatDate(e.datetime)}`
        });
      }
    });
    setSearchResults(results.slice(0, 8));
  }, [searchQuery, projects, tasks, events]);
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const toggleTaskComplete = (taskId) => {
    setCompletedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };
  const getPriorityStyles = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-50 text-red-600 border-red-200";
      case "medium":
        return "bg-amber-50 text-amber-600 border-amber-200";
      case "low":
        return "bg-green-50 text-green-600 border-green-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };
  if (!isHydrated || loading) return /* @__PURE__ */ jsx(DashboardSkeleton, {});
  return /* @__PURE__ */ jsxs("div", { className: "space-y-8 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("h1", { className: "text-[24px] font-normal text-[#101828]", children: [
        "Welcome back",
        displayUserName ? `, ${displayUserName.split(" ")[0]}` : ""
      ] }),
      /* @__PURE__ */ jsx(NewProjectButton, {})
    ] }),
    /* @__PURE__ */ jsxs("div", { ref: searchRef, className: "relative max-w-2xl", children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: cn(
            "flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all",
            isSearchFocused ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-gray-200 hover:border-gray-300"
          ),
          children: [
            /* @__PURE__ */ jsx(SearchIcon, {}),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                onFocus: () => setIsSearchFocused(true),
                placeholder: "Search projects, files, tasks, or people ...",
                className: "flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              }
            ),
            searchQuery && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setSearchQuery(""),
                className: "rounded p-1 text-muted-foreground hover:bg-gray-100 hover:text-foreground",
                children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
              }
            )
          ]
        }
      ),
      isSearchFocused && searchResults.length > 0 && /* @__PURE__ */ jsx("div", { className: "absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-gray-200 bg-white shadow-lg", children: /* @__PURE__ */ jsx("div", { className: "max-h-80 overflow-y-auto p-2", children: searchResults.map((result) => /* @__PURE__ */ jsxs(
        "a",
        {
          href: result.href || "#",
          className: "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50",
          onClick: () => setIsSearchFocused(false),
          children: [
            /* @__PURE__ */ jsxs("div", { className: cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              result.type === "project" && "bg-indigo-100 text-indigo-600",
              result.type === "task" && "bg-amber-100 text-amber-600",
              result.type === "event" && "bg-blue-100 text-blue-600"
            ), children: [
              result.type === "project" && /* @__PURE__ */ jsx(FolderIcon, {}),
              result.type === "task" && /* @__PURE__ */ jsx(TaskIcon, {}),
              result.type === "event" && /* @__PURE__ */ jsx(CalendarIcon, {})
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground truncate", children: result.title }),
              result.subtitle && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground truncate", children: result.subtitle })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground capitalize", children: result.type })
          ]
        },
        `${result.type}-${result.id}`
      )) }) }),
      isSearchFocused && searchQuery && searchResults.length === 0 && /* @__PURE__ */ jsx("div", { className: "absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg", children: /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground", children: [
        'No results found for "',
        searchQuery,
        '"'
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center gap-2 text-muted-foreground", children: [
        /* @__PURE__ */ jsx(ClockIcon, {}),
        /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: "Recently visited" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex gap-4 overflow-x-auto scrollbar-hide", children: recentProjects.map((project) => /* @__PURE__ */ jsxs(
        "a",
        {
          href: `/projects/${project.slug}`,
          className: "group w-44 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-gray-300 hover:shadow-lg active:scale-[0.98]",
          children: [
            /* @__PURE__ */ jsxs("div", { className: "aspect-[4/3] relative overflow-hidden", children: [
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
                "flex h-10 w-10 items-center justify-center rounded-lg",
                project.projectType === "software" && "bg-cyan-500 text-white",
                project.projectType === "design" && "bg-purple-500 text-white",
                project.projectType === "construction" && "bg-blue-500 text-white",
                project.projectType === "research" && "bg-teal-500 text-white",
                !project.projectType && "bg-gray-500 text-white"
              ), children: /* @__PURE__ */ jsxs("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                project.projectType === "software" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" }),
                project.projectType === "design" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" }),
                project.projectType === "construction" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }),
                project.projectType === "research" && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }),
                !project.projectType && /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" })
              ] }) }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "p-3", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-foreground line-clamp-1", children: project.name }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: formatRelativeTime(project.lastVisited) })
            ] })
          ]
        },
        project.id
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("section", { children: [
        /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [
            /* @__PURE__ */ jsx(CalendarIcon, {}),
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: "Upcoming events" })
          ] }),
          /* @__PURE__ */ jsx("a", { href: "/events", className: "text-xs text-indigo-600 hover:text-indigo-700", children: "View all" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: events.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-gray-200 bg-white p-6 text-center", children: [
          /* @__PURE__ */ jsx(CalendarIcon, {}),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "No upcoming events" })
        ] }) : events.map((event) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md",
            children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600", children: /* @__PURE__ */ jsx(CalendarIcon, {}) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-foreground", children: event.title }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
                  formatDate(event.datetime),
                  ", ",
                  formatTime(event.datetime)
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs text-muted-foreground", children: [
                  /* @__PURE__ */ jsx("span", { children: event.project }),
                  /* @__PURE__ */ jsx("span", { children: "-" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                    /* @__PURE__ */ jsx(UsersIcon, {}),
                    /* @__PURE__ */ jsx("span", { children: event.attendees })
                  ] })
                ] })
              ] })
            ]
          },
          event.id
        )) })
      ] }),
      /* @__PURE__ */ jsxs("section", { children: [
        /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [
            /* @__PURE__ */ jsx(TaskIcon, {}),
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: "Your tasks" })
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
            pendingTasks,
            " pending"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: tasks.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-gray-200 bg-white p-6 text-center", children: [
          /* @__PURE__ */ jsx(TaskIcon, {}),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "No tasks" })
        ] }) : tasks.map((task) => {
          const isCompleted = completedTasks.has(task.id);
          return /* @__PURE__ */ jsxs(
            "div",
            {
              className: cn(
                "flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md",
                isCompleted && "opacity-60"
              ),
              children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => toggleTaskComplete(task.id),
                    className: cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      isCompleted ? "border-green-500 bg-green-500 text-white" : "border-gray-300 hover:border-indigo-500"
                    ),
                    children: isCompleted && /* @__PURE__ */ jsx(CheckIcon, {})
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ jsx("h3", { className: cn(
                    "text-sm font-medium text-foreground",
                    isCompleted && "line-through"
                  ), children: task.title }),
                  /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
                    task.project,
                    " - ",
                    formatDate(task.dueDate)
                  ] })
                ] }),
                /* @__PURE__ */ jsx("span", { className: cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                  getPriorityStyles(task.priority)
                ), children: task.priority })
              ]
            },
            task.id
          );
        }) })
      ] })
    ] })
  ] });
}

const prerender = false;
const $$Home = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Home - ORBIT", "pageTitle": "Home" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "HomeDashboard", HomeDashboard, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/HomeDashboard", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/home.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/home.astro";
const $$url = "/home";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Home,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
