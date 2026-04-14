import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';

const INTEGRATIONS = [
  {
    id: "slack",
    name: "Slack",
    description: "Get notifications and updates in your Slack channels",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" }) }),
    color: "text-[#E01E5A]",
    connected: true
  },
  {
    id: "github",
    name: "GitHub",
    description: "Link repositories and track code changes",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" }) }),
    color: "text-foreground",
    connected: true
  },
  {
    id: "jira",
    name: "Jira",
    description: "Sync tasks and issues with Jira projects",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.213 5.214h2.129v2.058a5.218 5.218 0 0 0 5.212 5.214V6.758a1.001 1.001 0 0 0-1.004-1zm5.706-5.757h-11.558a5.218 5.218 0 0 0 5.215 5.218h2.129v2.054A5.218 5.218 0 0 0 24 12.486V1.001A1.001 1.001 0 0 0 23 0z" }) }),
    color: "text-[#0052CC]",
    connected: false
  },
  {
    id: "google",
    name: "Google Drive",
    description: "Access and sync files from Google Drive",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M4.433 22.396l4-6.93H24l-4 6.93H4.433zm3.566-6.93L0 3.396h8L15.566 15.466H8zm7.566-12.07L24 3.396 16 15.466l-8.434-.001 7.999-12.069z" }) }),
    color: "text-[#4285F4]",
    connected: false
  },
  {
    id: "figma",
    name: "Figma",
    description: "Embed and preview Figma designs",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zM8.148 24c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.588 4.539zm-.001-7.509a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.019 3.019 1.665 0 3.117-1.355 3.117-3.019v-3.019H8.147zM8.148 8.981c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981H8.148zm-.001-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.355 3.019 3.019 3.019h3.117V1.471H8.147zM8.148 15.02c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.981H8.148zm-.001-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.355 3.019 3.019 3.019h3.117V7.51H8.147zM15.852 15.02h-3.117v-8.98h3.117c2.476 0 4.49 2.013 4.49 4.489s-2.014 4.491-4.49 4.491zm0-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.355 3.019 3.019 3.019 1.665 0 3.019-1.354 3.019-3.019 0-1.665-1.354-3.019-3.019-3.019z" }) }),
    color: "text-[#F24E1E]",
    connected: false
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Sync and share files from Dropbox",
    icon: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6.001-3.822L18 1.807zM0 13.274l6 3.822 6.001-3.822L6 9.452 0 13.274zM18 9.452l-6 3.822 6 3.822 6.001-3.822L18 9.452zM6 18.371l6 3.822 6.001-3.822L12 14.549 6 18.371z" }) }),
    color: "text-[#0061FF]",
    connected: false
  }
];
function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const toggleIntegration = (id) => {
    setIntegrations(
      (prev) => prev.map(
        (item) => item.id === id ? { ...item, connected: !item.connected } : item
      )
    );
  };
  const connectedCount = integrations.filter((i) => i.connected).length;
  return /* @__PURE__ */ jsx("div", { className: "min-h-full bg-background", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-4xl px-6 py-8", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-foreground", children: "Integrations" }),
      /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [
        "Connect your favorite tools to enhance your workflow (",
        connectedCount,
        " connected)"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: integrations.map((integration) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: cn(
          "rounded-xl border bg-card p-6 transition-all",
          integration.connected ? "border-primary/30" : "border-border"
        ),
        children: [
          /* @__PURE__ */ jsx("div", { className: "flex items-start justify-between", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
            /* @__PURE__ */ jsx("div", { className: cn("flex-shrink-0", integration.color), children: integration.icon }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: integration.name }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: integration.description })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx("div", { className: "mt-4 flex items-center justify-between", children: integration.connected ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }),
              "Connected"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => toggleIntegration(integration.id),
                className: "rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors",
                children: "Disconnect"
              }
            )
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: "Not connected" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => toggleIntegration(integration.id),
                className: "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors",
                children: "Connect"
              }
            )
          ] }) })
        ]
      },
      integration.id
    )) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 rounded-xl border border-border bg-card p-6", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-card-foreground", children: "API Access" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Use our API to build custom integrations" }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3", children: [
          /* @__PURE__ */ jsx("code", { className: "text-sm text-foreground font-mono", children: "sk_live_••••••••••••••••" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("button", { className: "text-sm text-primary hover:underline", children: "Copy" }),
            /* @__PURE__ */ jsx("button", { className: "text-sm text-muted-foreground hover:text-foreground", children: "Regenerate" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(
          "a",
          {
            href: "#",
            className: "inline-flex items-center gap-2 text-sm text-primary hover:underline",
            children: [
              "View API Documentation",
              /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) })
            ]
          }
        )
      ] })
    ] })
  ] }) });
}

const prerender = false;
const $$Integrations = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Integrations - ORBIT", "pageTitle": "Settings" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "IntegrationsSettings", IntegrationsSettings, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/IntegrationsSettings", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/settings/integrations.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/settings/integrations.astro";
const $$url = "/settings/integrations";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Integrations,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
