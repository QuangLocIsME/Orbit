import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { S as Skeleton } from './skeleton_Bm27Yo3I.mjs';

function SettingsSkeleton() {
  return /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-6 max-w-2xl space-y-8", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-5", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-20 w-20 rounded-full flex-shrink-0" }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-36" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-48" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-8 w-28 rounded-lg" })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Skeleton, { className: "h-px w-full" }),
    Array.from({ length: 4 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-24" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-10 w-full rounded-lg" })
    ] }, i)),
    /* @__PURE__ */ jsx(Skeleton, { className: "h-10 w-32 rounded-lg" })
  ] });
}

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" }
];
function ProfileSettings() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState("Thao Duyen");
  const [email, setEmail] = useState("thaoduyen@example.com");
  const [bio, setBio] = useState("");
  const [jobTitle, setJobTitle] = useState("Project Manager");
  const [company, setCompany] = useState("ORBIT Construction");
  const [isSaving, setIsSaving] = useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    setIsSaving(false);
  };
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  if (!isHydrated) return /* @__PURE__ */ jsx(SettingsSkeleton, {});
  return /* @__PURE__ */ jsx("div", { className: "min-h-full bg-background", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-4xl px-6 py-8", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-foreground", children: "Profile Settings" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Manage your personal information and preferences" })
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
    activeTab === "profile" && /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: "h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-semibold", children: "TD" }),
          /* @__PURE__ */ jsx("button", { className: "absolute bottom-0 right-0 rounded-full bg-card border border-border p-1.5 shadow-sm hover:bg-muted transition-colors", children: /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
            /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
            /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-foreground", children: "Profile Photo" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "JPG, PNG or GIF. Max size 2MB." }),
          /* @__PURE__ */ jsxs("div", { className: "mt-3 flex gap-3", children: [
            /* @__PURE__ */ jsx("button", { className: "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors", children: "Upload Photo" }),
            /* @__PURE__ */ jsx("button", { className: "rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors", children: "Remove" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-6 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Full Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: name,
                onChange: (e) => setName(e.target.value),
                className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Email Address" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "email",
                value: email,
                onChange: (e) => setEmail(e.target.value),
                className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-6 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Job Title" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: jobTitle,
                onChange: (e) => setJobTitle(e.target.value),
                className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Company" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: company,
                onChange: (e) => setCompany(e.target.value),
                className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Bio" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: bio,
              onChange: (e) => setBio(e.target.value),
              rows: 4,
              placeholder: "Tell us about yourself...",
              className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end pt-4 border-t border-border", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleSave,
          disabled: isSaving,
          className: "inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50",
          children: isSaving ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 animate-spin", fill: "none", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
              /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
            ] }),
            "Saving..."
          ] }) : "Save Changes"
        }
      ) })
    ] }),
    activeTab === "account" && /* @__PURE__ */ jsx("div", { className: "space-y-6", children: /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-card p-6", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "Account Information" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Manage your account details and preferences" }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-3 border-b border-border", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: "Account ID" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "usr_2kJf8sLm4nPq" })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "text-sm text-primary hover:underline", children: "Copy" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between py-3 border-b border-border", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: "Account Created" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "March 15, 2024" })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: "Plan" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Professional" })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors", children: "Upgrade" })
        ] })
      ] })
    ] }) }),
    activeTab === "notifications" && /* @__PURE__ */ jsx("div", { className: "space-y-6", children: /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-card p-6", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "Notification Preferences" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Choose how you want to be notified" }),
      /* @__PURE__ */ jsx("div", { className: "mt-6 space-y-4", children: [
        { id: "email", label: "Email notifications", description: "Receive updates via email" },
        { id: "push", label: "Push notifications", description: "Receive push notifications in browser" },
        { id: "project", label: "Project updates", description: "Get notified when projects are updated" },
        { id: "mentions", label: "Mentions", description: "Get notified when you are mentioned" }
      ].map((item) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-3 border-b border-border last:border-0", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: item.label }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: item.description })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "relative h-6 w-11 rounded-full bg-primary transition-colors", children: /* @__PURE__ */ jsx("span", { className: "absolute right-1 top-1 h-4 w-4 rounded-full bg-primary-foreground transition-transform" }) })
      ] }, item.id)) })
    ] }) }),
    activeTab === "security" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-card p-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "Password" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Update your password to keep your account secure" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Current Password" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "password",
                placeholder: "Enter current password",
                className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "New Password" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "password",
                placeholder: "Enter new password",
                className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-foreground", children: "Confirm New Password" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "password",
                placeholder: "Confirm new password",
                className: "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              }
            )
          ] }),
          /* @__PURE__ */ jsx("button", { className: "rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors", children: "Update Password" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-destructive", children: "Danger Zone" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Permanently delete your account and all data" }),
        /* @__PURE__ */ jsx("button", { className: "mt-4 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors", children: "Delete Account" })
      ] })
    ] })
  ] }) });
}

const prerender = false;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Profile Settings - ORBIT", "pageTitle": "Settings" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "ProfileSettings", ProfileSettings, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/ProfileSettings", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/settings/index.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/settings/index.astro";
const $$url = "/settings";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
