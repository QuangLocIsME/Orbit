import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useMemo, useEffect } from 'react';
import { n as navigate } from './router_vN4ZPF0m.mjs';
import { toast } from 'sonner';
import { a as apiFetch } from './api-client_BrBa9f1N.mjs';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { S as Skeleton } from './skeleton_Bm27Yo3I.mjs';
import { Plus, Search, LayoutGrid, List, Users, Calendar } from 'lucide-react';

function PackagesSkeleton() {
  return /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-7 w-32" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-9 w-36 rounded-lg" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-9 flex-1 max-w-sm rounded-lg" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-9 w-28 rounded-lg" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "space-y-3", children: Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border bg-card p-4 flex items-center gap-4", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-12 w-12 rounded-lg flex-shrink-0" }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-2", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-48" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-72" })
      ] }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-6 w-16 rounded-full" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-3 w-20" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-8 w-8 rounded-lg" })
    ] }, i)) })
  ] });
}

const statusBadge = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-emerald-100 text-emerald-700",
  Archived: "bg-orange-100 text-orange-700"
};
const SELECTED_PROJECT_KEY = "orbit:selected-project-id";
function PackagesManager({ fixedProjectId, fixedProjectName }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [packages, setPackages] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [newPackage, setNewPackage] = useState({
    name: "",
    description: "",
    type: "construction",
    initialStatus: "Active",
    dueDate: "",
    teamMemberIds: []
  });
  const selectedProjectName = useMemo(() => {
    if (fixedProjectId) {
      return fixedProjectName || projects.find((p) => p.publicId === fixedProjectId)?.name || "";
    }
    return projects.find((p) => p.publicId === selectedProjectId)?.name || "";
  }, [projects, selectedProjectId, fixedProjectId, fixedProjectName]);
  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (item) => `${item.name} ${item.description || ""} ${item.packageType || ""}`.toLowerCase().includes(q)
    );
  }, [packages, searchQuery]);
  const loadProjects = async () => {
    const res = await apiFetch("/api/projects/me");
    if (!res.ok) throw new Error("Không thể tải project");
    const payload = await res.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const mapped = items.map((p) => ({ publicId: p.publicId, name: p.name }));
    setProjects(mapped);
    if (!mapped.length) {
      setSelectedProjectId("");
      return;
    }
    if (fixedProjectId) {
      const exists = mapped.some((p) => p.publicId === fixedProjectId);
      setSelectedProjectId(exists ? fixedProjectId : "");
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem(SELECTED_PROJECT_KEY) : null;
    const hasSaved = saved && mapped.some((p) => p.publicId === saved);
    const nextProjectId = hasSaved ? String(saved) : mapped[0].publicId;
    setSelectedProjectId(nextProjectId);
  };
  const loadPackages = async (projectId) => {
    if (!projectId) {
      setPackages([]);
      return;
    }
    const res = await apiFetch("/api/projects/packages/list", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ projectId, listType: "active" })
    });
    if (!res.ok) throw new Error("Không thể tải packages");
    const payload = await res.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    setPackages(items);
  };
  const memberColors = ["#EC4899", "#06B6D4", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];
  const toInitials = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  };
  const loadProjectMembers = async (projectId) => {
    if (!projectId) {
      setProjectMembers([]);
      return;
    }
    const res = await apiFetch("/api/projects/member-list", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ projectId })
    });
    if (!res.ok) {
      setProjectMembers([]);
      return;
    }
    const payload = await res.json();
    const members = Array.isArray(payload?.data) ? payload.data : [];
    const mappedMembers = members.filter((m) => m?.status === "accepted" && m?.userId).map((m) => ({
      userId: m.userId,
      name: m?.user?.fullName || m?.user?.email || m.userId,
      role: m.role || "member"
    }));
    setProjectMembers(
      mappedMembers.map((m, index) => ({
        ...m,
        initials: toInitials(m.name),
        color: memberColors[index % memberColors.length]
      }))
    );
  };
  const refreshData = async (projectId) => {
    await Promise.all([loadPackages(projectId), loadProjectMembers(projectId)]);
  };
  useEffect(() => {
    setIsHydrated(true);
    if (fixedProjectId) {
      setSelectedProjectId(fixedProjectId);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProjects().catch((err) => toast.error(err?.message || "Không thể tải dữ liệu")).finally(() => setLoading(false));
  }, [fixedProjectId]);
  useEffect(() => {
    if (!selectedProjectId) return;
    if (!fixedProjectId) {
      localStorage.setItem(SELECTED_PROJECT_KEY, selectedProjectId);
    }
    setLoading(true);
    refreshData(selectedProjectId).catch((err) => toast.error(err?.message || "Không thể tải packages")).finally(() => setLoading(false));
  }, [selectedProjectId, fixedProjectId]);
  const toggleMember = (userId) => {
    setNewPackage((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(userId) ? prev.teamMemberIds.filter((id) => id !== userId) : [...prev.teamMemberIds, userId]
    }));
  };
  const resetCreateForm = () => {
    setNewPackage({ name: "", description: "", type: "construction", initialStatus: "Active", dueDate: "", teamMemberIds: [] });
  };
  const packageTypeOptions = [
    { id: "design", label: "Design", color: "bg-purple-100 text-purple-600" },
    { id: "development", label: "Development", color: "bg-blue-100 text-blue-600" },
    { id: "marketing", label: "Marketing", color: "bg-pink-100 text-pink-600" },
    { id: "construction", label: "Construction", color: "bg-orange-100 text-orange-600" },
    { id: "research", label: "Research", color: "bg-emerald-100 text-emerald-600" },
    { id: "other", label: "Other", color: "bg-gray-100 text-gray-600" }
  ];
  const handleCreatePackage = async () => {
    if (!selectedProjectId) {
      toast.error("Vui lòng chọn project");
      return;
    }
    if (!newPackage.name.trim()) {
      toast.error("Tên package là bắt buộc");
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch("/api/projects/packages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          name: newPackage.name.trim(),
          description: newPackage.description.trim(),
          type: newPackage.type.trim(),
          dueDate: newPackage.dueDate || null,
          teamMemberIds: newPackage.teamMemberIds
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "Tạo package thất bại");
      }
      if (newPackage.initialStatus && newPackage.initialStatus !== "Draft") {
        const createdPackageId = payload?.data?.publicId;
        if (createdPackageId) {
          await apiFetch("/api/projects/packages/update", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              projectId: selectedProjectId,
              packageId: createdPackageId,
              status: newPackage.initialStatus
            })
          });
        }
      }
      toast.success("Tạo package thành công");
      setShowCreateModal(false);
      resetCreateForm();
      await refreshData(selectedProjectId);
    } catch (err) {
      toast.error(err?.message || "Tạo package thất bại");
    } finally {
      setCreating(false);
    }
  };
  if (!isHydrated || loading) return /* @__PURE__ */ jsx(PackagesSkeleton, {});
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-[24px] font-normal text-[#101828]", children: "Packages" }),
        !fixedProjectId && /* @__PURE__ */ jsx(
          "select",
          {
            value: selectedProjectId,
            onChange: (e) => setSelectedProjectId(e.target.value),
            className: "h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm",
            children: projects.map((p) => /* @__PURE__ */ jsx("option", { value: p.publicId, children: p.name }, p.publicId))
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setShowCreateModal(true),
          disabled: !selectedProjectId,
          className: "inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white transition-colors hover:bg-blue-700 disabled:opacity-50",
          children: [
            /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
            "New Package"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative flex-1", children: [
        /* @__PURE__ */ jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Search packages...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className: "w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setViewMode("grid"),
            className: cn("rounded-md p-2", viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400"),
            children: /* @__PURE__ */ jsx(LayoutGrid, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setViewMode("list"),
            className: cn("rounded-md p-2", viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400"),
            children: /* @__PURE__ */ jsx(List, { className: "h-4 w-4" })
          }
        )
      ] })
    ] }),
    filteredPackages.length === 0 ? /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-dashed border-gray-200 bg-gray-50 py-14 text-center", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600", children: selectedProjectId ? `Project "${selectedProjectName}" chưa có package nào.` : "Bạn chưa có project nào để quản lý package." }) }) : viewMode === "grid" ? /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", children: filteredPackages.map((item) => /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => navigate(`/packages/${item.publicId}`),
        className: "w-full rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-300 hover:shadow-lg",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("h3", { className: "truncate font-medium text-gray-900", children: item.name }),
            /* @__PURE__ */ jsx("span", { className: cn("rounded-full px-2.5 py-1 text-xs font-medium", statusBadge[item.status] || statusBadge.Draft), children: item.status })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 line-clamp-2 text-sm text-gray-600", children: item.description || "No description" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center gap-4 text-xs text-gray-500", children: [
            /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1", children: [
              /* @__PURE__ */ jsx(Users, { className: "h-3.5 w-3.5" }),
              item.teamMemberIds?.length || 0
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1", children: [
              /* @__PURE__ */ jsx(Calendar, { className: "h-3.5 w-3.5" }),
              item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "No due date"
            ] })
          ] })
        ]
      },
      item.publicId
    )) }) : /* @__PURE__ */ jsx("div", { className: "space-y-3", children: filteredPackages.map((item) => /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => navigate(`/packages/${item.publicId}`),
        className: "group flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-md",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("p", { className: "truncate font-medium text-gray-900", children: item.name }),
            /* @__PURE__ */ jsx("p", { className: "truncate text-sm text-gray-500", children: item.description || "No description" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsx("span", { className: cn("rounded-full px-2.5 py-1 text-xs font-medium", statusBadge[item.status] || statusBadge.Draft), children: item.status }),
            /* @__PURE__ */ jsxs("span", { className: "text-xs text-gray-500", children: [
              item.teamMemberIds?.length || 0,
              " members"
            ] })
          ] })
        ]
      },
      item.publicId
    )) }),
    showCreateModal && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: () => setShowCreateModal(false), children: /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between p-6 pb-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[40px] font-semibold text-[#1F2937]", children: "Create New Package" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-[16px] text-[#6B7280]", children: "Add a new package to organize project components" })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: () => setShowCreateModal(false), className: "rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700", children: "×" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "border-t border-gray-100" }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-5 p-6", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-2 block text-sm font-medium text-[#1F2937]", children: [
            "Package Name ",
            /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: newPackage.name,
              onChange: (e) => setNewPackage((prev) => ({ ...prev, name: e.target.value })),
              placeholder: "e.g., Architectural Design, MEP Systems...",
              className: "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-2 block text-sm font-medium text-[#1F2937]", children: [
            "Description ",
            /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
          ] }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: newPackage.description,
              onChange: (e) => setNewPackage((prev) => ({ ...prev, description: e.target.value })),
              placeholder: "Describe the package scope, deliverables, and objectives...",
              rows: 4,
              className: "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-2 block text-sm font-medium text-[#1F2937]", children: [
            "Package Type ",
            /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 md:grid-cols-3", children: packageTypeOptions.map((opt) => {
            const active = newPackage.type === opt.id;
            return /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setNewPackage((prev) => ({ ...prev, type: opt.id })),
                className: cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors",
                  active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                ),
                children: [
                  /* @__PURE__ */ jsx("span", { className: cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold", opt.color), children: opt.label.charAt(0) }),
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-[#374151]", children: opt.label })
                ]
              },
              opt.id
            );
          }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("label", { className: "mb-2 block text-sm font-medium text-[#1F2937]", children: [
              "Initial Status ",
              /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: newPackage.initialStatus,
                onChange: (e) => setNewPackage((prev) => ({ ...prev, initialStatus: e.target.value })),
                className: "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "Draft", children: "Draft" }),
                  /* @__PURE__ */ jsx("option", { value: "Active", children: "Active" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("label", { className: "mb-2 block text-sm font-medium text-[#1F2937]", children: [
              "Due Date ",
              /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "date",
                value: newPackage.dueDate,
                onChange: (e) => setNewPackage((prev) => ({ ...prev, dueDate: e.target.value })),
                className: "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-2 block text-sm font-medium text-[#1F2937]", children: [
            "Assign Team Members ",
            /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "*" })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setIsMemberDropdownOpen((v) => !v),
              className: "flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left",
              children: [
                /* @__PURE__ */ jsxs("span", { className: "text-sm text-gray-700", children: [
                  newPackage.teamMemberIds.length,
                  " members selected"
                ] }),
                /* @__PURE__ */ jsx("span", { className: "text-gray-400", children: "⌃" })
              ]
            }
          ),
          isMemberDropdownOpen && /* @__PURE__ */ jsx("div", { className: "absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg", children: projectMembers.length === 0 ? /* @__PURE__ */ jsx("p", { className: "px-4 py-3 text-sm text-gray-500", children: "Không có member nào trong project." }) : projectMembers.map((member) => {
            const checked = newPackage.teamMemberIds.includes(member.userId);
            return /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => toggleMember(member.userId),
                className: "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white",
                      style: { backgroundColor: member.color },
                      children: member.initials
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { className: "flex-1 text-sm text-gray-900", children: member.name }),
                  checked && /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M5 13l4 4L19 7" }) })
                ]
              },
              member.userId
            );
          }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setShowCreateModal(false);
              resetCreateForm();
            },
            className: "px-5 py-2.5 text-sm font-medium text-gray-700",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleCreatePackage,
            disabled: creating || !newPackage.name.trim(),
            className: "rounded-xl bg-[#8FB1FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#7ea4fb] disabled:opacity-50",
            children: creating ? "Creating..." : "Create Package"
          }
        )
      ] })
    ] }) })
  ] });
}

export { PackagesManager as P };
