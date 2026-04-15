import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_CjntUweB.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_BrNsx_xn.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';

const TABS = [
  { id: "general", label: "General" },
  { id: "members", label: "Members" },
  { id: "billing", label: "Billing" }
];
const MEMBERS = [
  { id: 1, name: "Thao Duyen", email: "thaoduyen@example.com", role: "Owner", avatar: "TD" },
  { id: 2, name: "John Smith", email: "john@example.com", role: "Admin", avatar: "JS" },
  { id: 3, name: "Sarah Wilson", email: "sarah@example.com", role: "Member", avatar: "SW" },
  { id: 4, name: "Mike Chen", email: "mike@example.com", role: "Member", avatar: "MC" }
];
function WorkspaceSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [workspaceName, setWorkspaceName] = useState("ORBIT Construction");
  const [workspaceUrl, setWorkspaceUrl] = useState("orbit-construction");
  const [isSaving, setIsSaving] = useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    setIsSaving(false);
  };
  return /* @__PURE__ */ jsx("div", { className: "min-h-full bg-background", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-4xl px-6 py-8", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-foreground", children: "Workspace Settings" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Manage your workspace configuration and team" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mb-8 border-b border-border", children: /* @__PURE__ */ jsx("nav", { className: "flex gap-6", children: TABS.map((tab) => /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setActiveTab(tab.id),
        className: cn(
          "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px",
          activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
        ),
        children: tab.label
      },
      tab.id
    )) }) }),
    activeTab === "general" && /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: "h-20 w-20 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold", children: "OC" }),
          /* @__PURE__ */ jsx("button", { className: "absolute -bottom-1 -right-1 rounded-full bg-card border border-border p-1.5 shadow-sm hover:bg-muted transition-colors", children: /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-foreground", children: "Workspace Logo" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "This will be displayed across the platform" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-3 flex gap-3", children: [
            /* @__PURE__ */ jsx("button", { className: "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors", children: "Upload Logo" }),
            /* @__PURE__ */ jsx("button", { className: "rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors", children: "Remove" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Workspace Name" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: workspaceName,
              onChange: (e) => setWorkspaceName(e.target.value),
              className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Workspace URL" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: "app.orbit.com/" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: workspaceUrl,
                onChange: (e) => setWorkspaceUrl(e.target.value),
                className: "flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Timezone" }),
          /* @__PURE__ */ jsxs("select", { className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors", children: [
            /* @__PURE__ */ jsx("option", { children: "UTC+7 (Bangkok, Hanoi, Jakarta)" }),
            /* @__PURE__ */ jsx("option", { children: "UTC+0 (London, Dublin)" }),
            /* @__PURE__ */ jsx("option", { children: "UTC-5 (New York, Toronto)" }),
            /* @__PURE__ */ jsx("option", { children: "UTC-8 (Los Angeles, Vancouver)" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end pt-4 border-t border-border", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleSave,
          disabled: isSaving,
          className: "inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50",
          children: isSaving ? "Saving..." : "Save Changes"
        }
      ) })
    ] }),
    activeTab === "members" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-card p-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "Invite Team Members" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Add new members to your workspace" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex gap-3", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              placeholder: "Enter email address",
              className: "flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
            }
          ),
          /* @__PURE__ */ jsxs("select", { className: "rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors", children: [
            /* @__PURE__ */ jsx("option", { children: "Member" }),
            /* @__PURE__ */ jsx("option", { children: "Admin" })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors", children: "Send Invite" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-card", children: [
        /* @__PURE__ */ jsx("div", { className: "px-6 py-4 border-b border-border", children: /* @__PURE__ */ jsxs("h3", { className: "text-base font-semibold text-card-foreground", children: [
          "Team Members (",
          MEMBERS.length,
          ")"
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "divide-y divide-border", children: MEMBERS.map((member) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium", children: member.avatar }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: member.name }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: member.email })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsx("span", { className: cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              member.role === "Owner" ? "bg-primary/10 text-primary" : member.role === "Admin" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"
            ), children: member.role }),
            member.role !== "Owner" && /* @__PURE__ */ jsx("button", { className: "text-sm text-muted-foreground hover:text-foreground transition-colors", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" }) }) })
          ] })
        ] }, member.id)) })
      ] })
    ] }),
    activeTab === "billing" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-card p-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "Current Plan" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "You are currently on the Professional plan" })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary", children: "Professional" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold text-foreground", children: "$29" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "per user / month" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold text-foreground", children: "4" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "team members" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold text-foreground", children: "$116" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "monthly total" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 flex gap-3", children: [
          /* @__PURE__ */ jsx("button", { className: "rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors", children: "Upgrade Plan" }),
          /* @__PURE__ */ jsx("button", { className: "rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors", children: "View Invoices" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-card p-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "Payment Method" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center gap-4 rounded-lg border border-border p-4", children: [
          /* @__PURE__ */ jsx("div", { className: "flex h-10 w-14 items-center justify-center rounded bg-blue-600 text-white text-xs font-bold", children: "VISA" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: "Visa ending in 4242" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Expires 12/2025" })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "ml-auto text-sm text-primary hover:underline", children: "Change" })
        ] })
      ] })
    ] })
  ] }) });
}

const prerender = false;
const $$Workspace = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Workspace Settings - ORBIT", "pageTitle": "Settings" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "WorkspaceSettings", WorkspaceSettings, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/WorkspaceSettings", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/settings/workspace.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/settings/workspace.astro";
const $$url = "/settings/workspace";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Workspace,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
