import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { bb as renderHead, bc as renderSlot, Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { r as renderScript } from './script_Vun3Ou6Q.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Toaster, toast } from 'sonner';
import { I as InviteNotificationHandler } from './useInviteNotifications_Dil9UiGe.mjs';
import { useState, useEffect, useMemo } from 'react';
import { a as apiFetch } from './api-client_BrBa9f1N.mjs';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { Clock, User, Calendar, Briefcase, MessageSquare, Send } from 'lucide-react';

const $$ProjectLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$ProjectLayout;
  const {
    title = "ORBIT - Project Management",
    projectName,
    projectSlug
  } = Astro2.props;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><title>${title}</title>${renderHead()}</head> <body class="min-h-screen font-sans bg-background"> ${renderScript($$result, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/layouts/ProjectLayout.astro?astro&type=script&index=0&lang.ts")} <!-- Main Content (no sidebar, top bar is inside React component) --> <main> ${renderSlot($$result, $$slots["default"])} </main> ${renderComponent($$result, "Toaster", Toaster, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/ui/sonner", "client:component-export": "Toaster" })} ${renderComponent($$result, "InviteNotificationHandler", InviteNotificationHandler, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/hooks/useInviteNotifications", "client:component-export": "default" })}</body></html>`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/layouts/ProjectLayout.astro", void 0);

const statusToneById = {
  backlog: "bg-slate-100 text-slate-600",
  todo: "bg-blue-50 text-blue-600",
  "in-progress": "bg-amber-50 text-amber-600",
  review: "bg-orange-50 text-orange-600",
  done: "bg-emerald-50 text-emerald-600",
  approved: "bg-emerald-50 text-emerald-600",
  draft: "bg-slate-100 text-slate-600",
  revision: "bg-purple-50 text-purple-600",
  testing: "bg-cyan-50 text-cyan-600"
};
const priorityConfig = {
  low: { label: "Low", color: "bg-teal-50 text-teal-700" },
  medium: { label: "Medium", color: "bg-amber-50 text-amber-700" },
  high: { label: "High", color: "bg-red-50 text-red-700" },
  urgent: { label: "Urgent", color: "bg-red-50 text-red-700" }
};
const fallbackStages = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" }
];
const normalizeStageId = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
const toDisplayTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};
function TaskDetailPage({ projectPublicId, taskId }) {
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [projectRole, setProjectRole] = useState("member");
  const [workflowStages, setWorkflowStages] = useState(fallbackStages);
  const [updatingStage, setUpdatingStage] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [detailRes, commentsRes, projectsRes, workflowRes] = await Promise.all([
          apiFetch("/api/tasks/detail", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ projectId: projectPublicId, taskId })
          }),
          apiFetch("/api/tasks/comments/list", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ projectId: projectPublicId, taskId })
          }),
          apiFetch("/api/projects/me", {
            method: "GET",
            headers: { Accept: "application/json" }
          }),
          apiFetch("/api/projects/workflow", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ projectId: projectPublicId })
          })
        ]);
        if (detailRes.ok) {
          const payload = await detailRes.json();
          const t = payload?.data;
          if (!cancelled && t) {
            setTask({
              id: String(t.publicId || t.id || taskId),
              title: String(t.title || "Untitled task"),
              description: String(t.description || ""),
              status: normalizeStageId(String(t.status || "backlog")),
              priority: ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium",
              assigneeName: t.assigneeName || t.assignee?.fullName || "",
              dueDate: t.dueDate || "",
              tags: Array.isArray(t.tags) ? t.tags : [],
              linkedUrl: t.linkedUrl || ""
            });
          }
        } else if (!cancelled) {
          toast.error("Failed to load task detail");
        }
        if (commentsRes.ok) {
          const payload = await commentsRes.json();
          const list = Array.isArray(payload?.data) ? payload.data : [];
          if (!cancelled) {
            setComments(
              list.map((c) => ({
                id: String(c.publicId || c.id || Math.random()),
                author: String(c.authorName || c.author?.fullName || "Unknown"),
                content: String(c.content || ""),
                createdAt: String(c.createdAt || ""),
                avatar: c.author?.avatar || ""
              }))
            );
          }
        }
        if (projectsRes.ok) {
          const payload = await projectsRes.json();
          const list = Array.isArray(payload?.data) ? payload.data : [];
          const currentProject = list.find((p) => String(p.publicId) === String(projectPublicId));
          const role = String(currentProject?.role || "member");
          if (!cancelled) setProjectRole(role);
        }
        if (workflowRes.ok) {
          const payload = await workflowRes.json();
          const stagesRaw = Array.isArray(payload?.data?.stages) ? payload.data.stages : [];
          const stages = stagesRaw.map((s) => {
            const rawId = String(s.id || s.key || s.name || "").trim();
            if (!rawId) return null;
            return { id: normalizeStageId(rawId), label: String(s.label || s.name || rawId) };
          }).filter(Boolean);
          if (!cancelled && stages.length > 0) setWorkflowStages(stages);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load task detail");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectPublicId, taskId]);
  const dueDateLabel = useMemo(() => {
    if (!task?.dueDate) return "No due date";
    const d = new Date(task.dueDate);
    if (Number.isNaN(d.getTime())) return task.dueDate;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [task?.dueDate]);
  const canReviewAndMoveStage = projectRole === "admin" || projectRole === "owner";
  const currentStage = useMemo(
    () => workflowStages.find((s) => s.id === normalizeStageId(task?.status || "")),
    [workflowStages, task?.status]
  );
  const submitComment = async () => {
    const content = commentInput.trim();
    if (!content) return;
    try {
      const res = await apiFetch("/api/tasks/comments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ projectId: projectPublicId, taskId, content })
      });
      if (!res.ok) {
        toast.error("Failed to post comment");
        return;
      }
      const payload = await res.json();
      const c = payload?.data;
      setComments((prev) => [
        {
          id: String(c?.publicId || c?.id || `${Date.now()}`),
          author: String(c?.authorName || c?.author?.fullName || "You"),
          content: String(c?.content || content),
          createdAt: String(c?.createdAt || (/* @__PURE__ */ new Date()).toISOString()),
          avatar: c?.author?.avatar || ""
        },
        ...prev
      ]);
      setCommentInput("");
    } catch {
      toast.error("Failed to post comment");
    }
  };
  const updateStage = async (nextStageId) => {
    if (!task || !canReviewAndMoveStage || task.status === nextStageId) return;
    setUpdatingStage(true);
    try {
      const res = await apiFetch("/api/tasks/change-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          projectId: projectPublicId,
          taskId,
          status: nextStageId
        })
      });
      if (!res.ok) {
        toast.error("Failed to update task stage");
        return;
      }
      setTask((prev) => prev ? { ...prev, status: nextStageId } : prev);
      toast.success("Task stage updated");
    } catch {
      toast.error("Failed to update task stage");
    } finally {
      setUpdatingStage(false);
    }
  };
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "p-6 text-sm text-muted-foreground", children: "Loading task detail..." });
  }
  if (!task) {
    return /* @__PURE__ */ jsx("div", { className: "p-6 text-sm text-muted-foreground", children: "Task not found." });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-5 p-6", children: [
    /* @__PURE__ */ jsx("div", { className: "space-y-3 pb-2", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold text-foreground", children: task.title }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: task.description || "No description." })
      ] }),
      /* @__PURE__ */ jsx("span", { className: cn("shrink-0 rounded-md border-0 px-2.5 py-1 text-xs font-medium", priorityConfig[task.priority].color), children: priorityConfig[task.priority].label })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm", children: /* @__PURE__ */ jsx(Clock, { className: "h-3.5 w-3.5 text-muted-foreground" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] text-muted-foreground", children: "Status" }),
          /* @__PURE__ */ jsx("p", { className: cn("text-sm font-medium", statusToneById[task.status] || "text-foreground"), children: currentStage?.label || task.status })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm", children: /* @__PURE__ */ jsx(User, { className: "h-3.5 w-3.5 text-muted-foreground" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] text-muted-foreground", children: "Assignee" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: task.assigneeName || "Unassigned" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm", children: /* @__PURE__ */ jsx(Calendar, { className: "h-3.5 w-3.5 text-muted-foreground" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] text-muted-foreground", children: "Due Date" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: dueDateLabel })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm", children: /* @__PURE__ */ jsx(Briefcase, { className: "h-3.5 w-3.5 text-muted-foreground" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] text-muted-foreground", children: "Role" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium capitalize", children: projectRole })
        ] })
      ] })
    ] }),
    canReviewAndMoveStage ? /* @__PURE__ */ jsxs("div", { className: "space-y-2.5", children: [
      /* @__PURE__ */ jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-muted-foreground", children: "Review & Stage Control" }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: workflowStages.map((stage) => /* @__PURE__ */ jsx(
        "button",
        {
          disabled: updatingStage || task.status === stage.id,
          onClick: () => updateStage(stage.id),
          className: cn(
            "h-8 rounded-md border px-3 text-xs transition-all",
            task.status === stage.id ? "bg-foreground text-background shadow-sm" : "border-border bg-background hover:bg-muted",
            (updatingStage || task.status === stage.id) && "cursor-not-allowed opacity-70"
          ),
          children: stage.label
        },
        stage.id
      )) })
    ] }) : /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Only Admin/Owner can review and move stage." }),
    (task.tags.length > 0 || task.linkedUrl) && /* @__PURE__ */ jsx("div", { className: "h-px bg-border" }),
    task.tags.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: task.tags.map((tag) => /* @__PURE__ */ jsx("span", { className: "rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5565]", children: tag }, tag)) }),
    task.linkedUrl && /* @__PURE__ */ jsx("a", { href: task.linkedUrl, target: "_blank", rel: "noreferrer", className: "inline-flex text-sm text-[#155DFC] hover:underline", children: "Linked Drawing / Model" }),
    /* @__PURE__ */ jsx("div", { className: "h-px bg-border" }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(MessageSquare, { className: "h-4 w-4 text-muted-foreground" }),
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold", children: "Comments" }),
        comments.length > 0 && /* @__PURE__ */ jsx("span", { className: "ml-auto inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px]", children: comments.length })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2.5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary", children: "Y" }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-1 flex-col gap-2", children: [
          /* @__PURE__ */ jsx(
            "textarea",
            {
              placeholder: "Write a comment...",
              value: commentInput,
              onChange: (e) => setCommentInput(e.target.value),
              className: "min-h-[70px] resize-none rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring",
              onKeyDown: (e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  submitComment();
                }
              }
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: submitComment,
              disabled: !commentInput.trim(),
              className: "inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs text-background disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Send, { className: "h-3 w-3" }),
                "Post"
              ]
            }
          ) })
        ] })
      ] }),
      comments.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-6 text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-muted", children: /* @__PURE__ */ jsx(MessageSquare, { className: "h-5 w-5 text-muted-foreground" }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "No comments yet." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "space-y-3 pt-1", children: comments.map((comment) => /* @__PURE__ */ jsxs("div", { className: "flex gap-2.5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary", children: String(comment.author || "U").charAt(0).toUpperCase() }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-0.5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: comment.author }),
            /* @__PURE__ */ jsx("span", { className: "text-[11px] text-muted-foreground", children: toDisplayTime(comment.createdAt) })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-foreground/80", children: comment.content })
        ] })
      ] }, comment.id)) })
    ] })
  ] });
}

export { $$ProjectLayout as $, TaskDetailPage as T };
