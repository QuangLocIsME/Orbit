import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { B as maybeRenderHead, Q as renderTemplate, a3 as addAttribute, bd as renderTransition, be as createTransitionScope, bc as renderSlot } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { r as renderScript } from './script_Vun3Ou6Q.mjs';
import { $ as $$BaseLayout } from './BaseLayout_CN87elus.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { d as dispatchSignOut, b as dispatchAuthExpired, a as apiFetch } from './api-client_BrBa9f1N.mjs';
import { u as useAppStore } from './appStore_D9wuFrkU.mjs';
import ReactDOM from 'react-dom';
import { h as getSocket, A as AlertDialog, a as AlertDialogContent, b as AlertDialogHeader, c as AlertDialogTitle, d as AlertDialogDescription, e as AlertDialogFooter, f as AlertDialogCancel, g as AlertDialogAction, I as InviteNotificationHandler } from './useInviteNotifications_Dil9UiGe.mjs';
import { toast, Toaster } from 'sonner';
import { c as cn$1 } from './utils_B05Dmz_H.mjs';
import { n as navigate } from './router_vN4ZPF0m.mjs';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function sanitizeStoredUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw;
  if (typeof candidate.id !== "string" || typeof candidate.fullName !== "string" || typeof candidate.email !== "string") {
    return null;
  }
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    email: candidate.email,
    avatar: typeof candidate.avatar === "string" || candidate.avatar === null ? candidate.avatar : null
  };
}
function isAuthenticated() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("orbit_user");
}
function getCurrentUser() {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("orbit_user");
  if (!userStr) return null;
  try {
    const parsed = JSON.parse(userStr);
    const sanitized = sanitizeStoredUser(parsed);
    if (!sanitized) return null;
    localStorage.setItem("orbit_user", JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return null;
  }
}
async function refreshAccessToken() {
  try {
    const res = await fetch("/api/auth/refresh-token", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    if (res.ok) return true;
    localStorage.removeItem("orbit_user");
    dispatchAuthExpired();
    return false;
  } catch {
    localStorage.removeItem("orbit_user");
    dispatchAuthExpired();
    return false;
  }
}
async function fetchWithAuth(url, init) {
  const opts = { ...init, credentials: "include" };
  const res = await fetch(url, opts);
  if (res.status !== 401) return res;
  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return res;
  }
  return fetch(url, opts);
}
async function syncCurrentUser() {
  try {
    const res = await fetchWithAuth("/api/auth/me");
    if (!res.ok) return null;
    const { data } = await res.json();
    if (data) {
      const sanitized = sanitizeStoredUser(data);
      if (!sanitized) return null;
      localStorage.setItem("orbit_user", JSON.stringify(sanitized));
      return sanitized;
    }
    return null;
  } catch {
    return null;
  }
}
async function signOut() {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
  }
  localStorage.removeItem("orbit_user");
  dispatchSignOut();
}

let sidebarUserCache = null;
let sidebarCollapsedCache = false;
const mainNavItems = [
  { title: "Home", href: "/home", icon: "home" },
  { title: "Projects", href: "/projects", icon: "folder" },
  { title: "Workflow Templates", href: "/templates", icon: "template" },
  { title: "Trash", href: "/trash", icon: "trash" }
];
const IconMap = {
  home: ({ className }) => /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" }) }),
  folder: ({ className }) => /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" }) }),
  template: ({ className }) => /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" }) }),
  trash: ({ className }) => /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }),
  project: ({ className }) => /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" }) }),
  chevronRight: ({ className }) => /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }),
  star: ({ className }) => /* @__PURE__ */ jsx("svg", { className, fill: "currentColor", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" }) })
};
function Sidebar({ currentPath }) {
  const [isCollapsed, setIsCollapsed] = useState(sidebarCollapsedCache);
  const [activePath, setActivePath] = useState(
    () => typeof window === "undefined" ? currentPath : window.location.pathname
  );
  const [authUser, setAuthUser] = useState(
    () => typeof window === "undefined" ? null : getCurrentUser()
  );
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window === "undefined") return "system";
    return localStorage.getItem("orbit-theme") || "system";
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("account");
  const userMenuRef = useRef(null);
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiFetch("/api/projects/me");
        if (res.ok) {
          const data = await res.json();
          const mappedProjects = (data.data || []).map((p) => ({
            id: p.publicId,
            slug: p.publicId,
            name: p.name,
            description: p.description,
            category: "shared",
            isFavorite: p.isFavorite === true,
            coverImageUrl: p.coverImageUrl,
            role: p.role
          }));
          setProjects(mappedProjects);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      }
    };
    fetchProjects();
  }, []);
  useEffect(() => {
    if (sidebarUserCache) {
      setAuthUser(sidebarUserCache);
    } else {
      const cached = getCurrentUser();
      if (cached) {
        sidebarUserCache = cached;
        setAuthUser(cached);
      }
    }
    syncCurrentUser().then((user) => {
      if (user) {
        sidebarUserCache = user;
        setAuthUser(user);
      }
    }).catch(() => {
    });
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (currentTheme === "dark") {
      root.classList.add("dark");
    } else if (currentTheme === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.remove("dark");
    }
    localStorage.setItem("orbit-theme", currentTheme);
  }, [currentTheme]);
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    const handleToggle = () => {
      setIsCollapsed((prev) => {
        const next = !prev;
        sidebarCollapsedCache = next;
        return next;
      });
    };
    window.addEventListener("toggle-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-sidebar", handleToggle);
  }, []);
  useEffect(() => {
    const syncPath = () => setActivePath(window.location.pathname);
    syncPath();
    window.addEventListener("popstate", syncPath);
    document.addEventListener("astro:page-load", syncPath);
    return () => {
      window.removeEventListener("popstate", syncPath);
      document.removeEventListener("astro:page-load", syncPath);
    };
  }, []);
  const displayName = authUser?.fullName || "Workspace";
  const displayInitials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ;
  const favorites = projects.filter((p) => p.isFavorite === true);
  const myProjects = projects.filter((p) => p.role === "admin" && !p.isFavorite);
  const shared = projects.filter((p) => p.role !== "admin" && !p.isFavorite);
  return /* @__PURE__ */ jsxs(
    "aside",
    {
      className: cn(
        "orbit-sidebar-shell flex h-full flex-col border-r border-sidebar-border bg-sidebar",
        isCollapsed ? "w-16" : "w-64"
      ),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "relative border-b border-sidebar-border", ref: userMenuRef, children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => !isCollapsed && setIsUserMenuOpen(!isUserMenuOpen),
              className: cn(
                "flex h-14 w-full items-center justify-between px-4 transition-colors hover:bg-sidebar-accent",
                isCollapsed && "justify-center"
              ),
              children: [
                /* @__PURE__ */ jsxs("div", { className: cn("flex items-center gap-3", isCollapsed && "hidden"), children: [
                  /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white flex-shrink-0", children: displayInitials }),
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-sidebar-foreground truncate", children: displayName })
                ] }),
                !isCollapsed && /* @__PURE__ */ jsx(
                  "svg",
                  {
                    className: cn("h-4 w-4 text-muted-foreground transition-transform flex-shrink-0", isUserMenuOpen && "rotate-180"),
                    fill: "none",
                    stroke: "currentColor",
                    viewBox: "0 0 24 24",
                    children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
                  }
                ),
                isCollapsed && /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white", children: displayInitials })
              ]
            }
          ),
          isUserMenuOpen && !isCollapsed && /* @__PURE__ */ jsxs("div", { className: "absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 shadow-lg", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-gray-100 dark:border-zinc-700 px-4 pb-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white", children: displayInitials }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      setIsUserMenuOpen(false);
                      setIsSettingsOpen(true);
                    },
                    className: "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700",
                    children: /* @__PURE__ */ jsx("svg", { className: "h-3 w-3 text-gray-600 dark:text-zinc-300", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: displayName }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: authUser?.email || "" })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "py-1 border-b border-gray-100 dark:border-zinc-700", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setIsThemeSubmenuOpen(!isThemeSubmenuOpen),
                  className: "flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-foreground",
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" }) }),
                      /* @__PURE__ */ jsx("span", { children: "Theme" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground capitalize", children: currentTheme }),
                      /* @__PURE__ */ jsx("svg", { className: cn("h-4 w-4 transition-transform", isThemeSubmenuOpen && "rotate-90"), fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })
                    ] })
                  ]
                }
              ),
              isThemeSubmenuOpen && /* @__PURE__ */ jsx("div", { className: "bg-gray-50 dark:bg-zinc-800 py-1", children: ["light", "dark", "system"].map((theme) => /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => {
                    setCurrentTheme(theme);
                    setIsThemeSubmenuOpen(false);
                  },
                  className: "flex w-full items-center justify-between px-8 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-foreground",
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "capitalize", children: theme }),
                    currentTheme === theme && /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-indigo-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) })
                  ]
                },
                theme
              )) })
            ] }) }),
            /* @__PURE__ */ jsxs("div", { className: "py-1 border-b border-gray-100 dark:border-zinc-700", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => {
                    setIsUserMenuOpen(false);
                    setIsSettingsOpen(true);
                  },
                  className: "flex w-full items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-foreground",
                  children: [
                    /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
                      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
                    ] }),
                    /* @__PURE__ */ jsx("span", { children: "Settings" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  className: "flex w-full items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-foreground",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
                    /* @__PURE__ */ jsx("span", { children: "Create workspace profile" })
                  ]
                }
              )
            ] }),
            authUser && /* @__PURE__ */ jsxs("div", { className: "py-1 border-b border-gray-100 dark:border-zinc-700", children: [
              /* @__PURE__ */ jsx("p", { className: "px-4 py-1 text-xs font-medium text-muted-foreground uppercase", children: "Logged in as" }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-2", children: [
                /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white", children: displayInitials }),
                /* @__PURE__ */ jsxs("div", { className: "text-left min-w-0", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground truncate", children: authUser.fullName }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground truncate", children: authUser.email })
                ] }),
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-indigo-600 shrink-0 ml-auto", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "pt-1", children: /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => signOut(),
                className: "flex w-full items-center justify-between px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }) }),
                    /* @__PURE__ */ jsx("span", { children: "Log out" })
                  ] }),
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })
                ]
              }
            ) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("nav", { className: "flex-1 overflow-y-auto p-3", children: [
          /* @__PURE__ */ jsx("ul", { className: "space-y-1", children: mainNavItems.map((item) => {
            const Icon = IconMap[item.icon];
            const isActive = activePath === item.href || item.href !== "/home" && activePath.startsWith(item.href);
            return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
              "a",
              {
                href: item.href,
                className: cn(
                  "orbit-nav-item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  isActive ? "bg-white dark:bg-zinc-700 text-foreground shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-500/20" : "text-muted-foreground hover:bg-white/60 dark:hover:bg-zinc-700/60 hover:text-foreground active:bg-white dark:active:bg-zinc-700 active:shadow-sm"
                ),
                children: [
                  /* @__PURE__ */ jsx(Icon, { className: "h-5 w-5 shrink-0" }),
                  !isCollapsed && /* @__PURE__ */ jsx("span", { children: item.title })
                ]
              }
            ) }, item.href);
          }) }),
          !isCollapsed && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(ProjectGroup, { title: "FAVORITES", projects: favorites, currentPath }),
            /* @__PURE__ */ jsx(ProjectGroup, { title: "MY PROJECTS", projects: myProjects, currentPath }),
            /* @__PURE__ */ jsx(ProjectGroup, { title: "SHARED", projects: shared, currentPath })
          ] })
        ] }),
        isSettingsOpen && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/50", onClick: () => setIsSettingsOpen(false), children: /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden", onClick: (e) => e.stopPropagation(), children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 px-6 py-4", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-foreground", children: "Settings" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setIsSettingsOpen(false),
                className: "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-foreground",
                children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex border-b border-gray-200 dark:border-zinc-700 px-6", children: ["account", "community", "notifications", "security"].map((tab) => /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setSettingsTab(tab),
              className: cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
                settingsTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-muted-foreground hover:text-foreground"
              ),
              children: tab
            },
            tab
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "overflow-y-auto max-h-[calc(90vh-120px)] p-6", children: [
            settingsTab === "account" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-xl font-medium text-white", children: displayInitials }),
                  /* @__PURE__ */ jsx("button", { className: "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700", children: /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5 text-gray-600 dark:text-zinc-300", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) }) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-2", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Name" }),
                      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: displayName })
                    ] }),
                    /* @__PURE__ */ jsx("button", { className: "text-xs text-indigo-600 hover:underline", children: "Change" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Email" }),
                      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: authUser?.email || "" })
                    ] }),
                    /* @__PURE__ */ jsx("button", { className: "text-xs text-indigo-600 hover:underline", children: "Change" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "User ID" }),
                      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: authUser?.id || "" })
                    ] }),
                    /* @__PURE__ */ jsx("button", { className: "text-xs text-indigo-600 hover:underline", children: "View" })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4", children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-indigo-900 dark:text-indigo-300", children: "Upgrade ORBIT plan" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-indigo-700 dark:text-indigo-400 mt-1", children: "Get access to premium features and unlimited projects." }),
                /* @__PURE__ */ jsx("button", { className: "mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700", children: "Upgrade now" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-foreground mb-3", children: "Your workspaces" }),
                /* @__PURE__ */ jsx("div", { className: "space-y-2", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border border-gray-200 dark:border-zinc-700 p-3", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                    /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium text-sm", children: "W" }),
                    /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: "Main Workspace" })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: "Owner" })
                ] }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: "Language" }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Select your preferred language" })
                ] }),
                /* @__PURE__ */ jsxs("select", { className: "rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-foreground px-3 py-2 text-sm", children: [
                  /* @__PURE__ */ jsx("option", { children: "English" }),
                  /* @__PURE__ */ jsx("option", { children: "Vietnamese" }),
                  /* @__PURE__ */ jsx("option", { children: "Japanese" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: "Theme" }),
                    /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Customize appearance" })
                  ] }),
                  /* @__PURE__ */ jsxs(
                    "select",
                    {
                      value: currentTheme,
                      onChange: (e) => setCurrentTheme(e.target.value),
                      className: "rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-foreground px-3 py-2 text-sm",
                      children: [
                        /* @__PURE__ */ jsx("option", { value: "system", children: "System" }),
                        /* @__PURE__ */ jsx("option", { value: "light", children: "Light" }),
                        /* @__PURE__ */ jsx("option", { value: "dark", children: "Dark" })
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-3 ml-4", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: "Enhance contrast" }),
                  /* @__PURE__ */ jsx("button", { className: "relative h-5 w-9 rounded-full bg-gray-200 dark:bg-zinc-700 transition-colors", children: /* @__PURE__ */ jsx("span", { className: "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" }) })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-foreground mb-3", children: "New features" }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Closed captions" }),
                    /* @__PURE__ */ jsx("span", { className: "rounded bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400", children: "Beta" })
                  ] }),
                  /* @__PURE__ */ jsx("button", { className: "relative h-5 w-9 rounded-full bg-gray-200 dark:bg-zinc-700 transition-colors", children: /* @__PURE__ */ jsx("span", { className: "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" }) })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: "Library settings" }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Manage your content library" })
                ] }),
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: "View history preferences" }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Control your viewing history" })
                ] }),
                /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "border-t border-gray-200 dark:border-zinc-700 pt-6", children: /* @__PURE__ */ jsx("button", { className: "text-sm text-red-600 hover:underline", children: "Delete account" }) })
            ] }),
            settingsTab === "community" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" }) }) }),
              /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Community Settings" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "Manage your community preferences" })
            ] }),
            settingsTab === "notifications" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" }) }) }),
              /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Notification Settings" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "Control your notification preferences" })
            ] }),
            settingsTab === "security" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 mb-4", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" }) }) }),
              /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Security Settings" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "Manage your security options" })
            ] })
          ] })
        ] }) })
      ]
    }
  );
}
function ProjectGroup({ title, projects, currentPath }) {
  if (projects.length === 0) return null;
  return /* @__PURE__ */ jsxs("div", { className: "mt-6", children: [
    /* @__PURE__ */ jsx("h3", { className: "mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: title }),
    /* @__PURE__ */ jsx("ul", { className: "space-y-1", children: projects.map((project) => {
      const isActive = currentPath === `/projects/${project.slug}`;
      return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
        "a",
        {
          href: `/projects/${project.slug}`,
          className: cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
            isActive ? "bg-gray-100 dark:bg-zinc-700 text-foreground font-medium" : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-foreground active:bg-gray-200 dark:active:bg-zinc-600"
          ),
          children: [
            /* @__PURE__ */ jsx(IconMap.project, { className: "h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsx("span", { className: "truncate flex-1", children: project.name }),
            project.isFavorite && /* @__PURE__ */ jsx(IconMap.star, { className: "h-4 w-4 shrink-0 text-yellow-500" })
          ]
        }
      ) }, project.id);
    }) })
  ] });
}

const STORAGE_KEY = "orbit_notifications";
const MAX_NOTIFICATIONS = 50;
function loadFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveToStorage(notifications) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
  }
}
function useNotifications() {
  const [notifications, setNotifications] = useState(loadFromStorage);
  const [inviteUnreadCount, setInviteUnreadCount] = useState(0);
  const projects = useAppStore((s) => s.projects);
  const setInviteCountRef = useRef(setInviteUnreadCount);
  useEffect(() => {
    setInviteCountRef.current = setInviteUnreadCount;
  }, []);
  const push = useCallback((n) => {
    setNotifications((prev) => {
      if (prev.some((x) => x.id === n.id)) return prev;
      const next = [n, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(next);
      return next;
    });
  }, []);
  const handleInviteNew = useCallback((data) => {
    const id = `invite:${data.inviteId}`;
    const resolvedProjectName = data.projectName && data.projectName !== "a project" ? data.projectName : projects.find((p) => String(p.publicId) === String(data.projectId))?.name || "a project";
    setNotifications((prev) => {
      if (prev.some((x) => x.id === id)) return prev;
      const normalizedInviteData = {
        ...data,
        projectName: resolvedProjectName
      };
      const n = {
        id,
        type: "info",
        title: `${data.inviterName} invited you`,
        message: `Join "${resolvedProjectName}" as ${data.role}`,
        link: data.acceptUrl,
        inviteData: normalizedInviteData,
        createdAt: data.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        read: false
      };
      const next = [n, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(next);
      return next;
    });
    setInviteUnreadCount((prev) => prev + 1);
  }, [projects]);
  useEffect(() => {
    if (!isAuthenticated()) return;
    setNotifications((prev) => {
      const next = prev.map((n) => {
        if (!n.id.startsWith("invite:")) return n;
        const invite = n.inviteData;
        const resolvedFromStore = invite?.projectId ? projects.find((p) => String(p.publicId) === String(invite.projectId))?.name : void 0;
        const currentNameFromMessage = n.message?.match(/Join\s+"([^"]+)"/)?.[1];
        const shouldReplace = currentNameFromMessage === "a project" || invite?.projectName === "a project";
        if (!shouldReplace || !resolvedFromStore) return n;
        const updatedInvite = invite ? { ...invite, projectName: resolvedFromStore } : invite;
        return {
          ...n,
          message: n.message?.replace(/Join\s+"[^"]+"/, `Join "${resolvedFromStore}"`),
          inviteData: updatedInvite
        };
      });
      saveToStorage(next);
      return next;
    });
    const socket = getSocket();
    const handler = (n) => {
      push(n);
    };
    const inviteHandler = (data) => {
      handleInviteNew(data);
      toast(
        `${data.inviterName} invited you to join "${data.projectName}"`,
        {
          duration: Infinity,
          action: {
            label: "View",
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent("orbit:show-invite-dialog", { detail: data })
              );
            }
          }
        }
      );
    };
    socket.on("notification:new", handler);
    socket.on("invite:new", inviteHandler);
    return () => {
      socket.off("notification:new", handler);
      socket.off("invite:new", inviteHandler);
    };
  }, [push, handleInviteNew]);
  const markRead = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.map((n) => n.id === id ? { ...n, read: true } : n);
      saveToStorage(next);
      return next;
    });
    if (id.startsWith("invite:")) {
      setInviteUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);
  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(next);
      return next;
    });
    setInviteUnreadCount(0);
  }, []);
  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([]);
    setInviteUnreadCount(0);
  }, []);
  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount, inviteUnreadCount, markRead, markAllRead, clearAll };
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1e3);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function HeaderActions() {
  const [theme, setTheme] = useState("light");
  const [activeInvite, setActiveInvite] = useState(null);
  const activeInviteRef = useRef(null);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("orbit-theme", next);
  };
  useEffect(() => {
    const saved = localStorage.getItem("orbit-theme");
    const initial = saved === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const notificationRef = useRef(null);
  const settingsRef = useRef(null);
  const { notifications, unreadCount, inviteUnreadCount, markRead, markAllRead } = useNotifications();
  const totalUnread = unreadCount + inviteUnreadCount;
  useEffect(() => {
    activeInviteRef.current = activeInvite;
  }, [activeInvite]);
  const resolveInviteFromNotification = (n) => {
    const fallbackInviteId = n.id.replace("invite:", "");
    const fallbackPayload = {
      inviteId: fallbackInviteId,
      token: void 0,
      projectId: "",
      projectName: n.message?.match(/Join\s+"([^"]+)"/)?.[1] || "a project",
      role: n.message?.match(/as\s+(.+)$/)?.[1] || "member",
      inviterName: n.title?.replace(/\s+invited you$/i, "") || "Someone",
      acceptUrl: n.link,
      createdAt: n.createdAt,
      dismissed: false
    };
    return { ...n.inviteData ?? fallbackPayload, dismissed: false };
  };
  const handleAcceptInvite = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      const res = await apiFetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invite.token || invite.inviteId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to accept invite");
        return;
      }
      toast.success(`You joined "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch {
      toast.error("Failed to accept invite");
    }
  };
  const handleDeclineInvite = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      const res = await apiFetch("/api/invites/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: invite.inviteId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || "Failed to decline invite");
        return;
      }
      toast.info(`Declined invite to "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch {
      toast.error("Failed to decline invite");
    }
  };
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: toggleTheme,
        className: "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        "aria-label": `Switch to ${theme === "light" ? "dark" : "light"} mode`,
        title: `Switch to ${theme === "light" ? "dark" : "light"} mode`,
        children: theme === "light" ? /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" }) }) : /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" }) })
      }
    ),
    /* @__PURE__ */ jsxs("div", { ref: notificationRef, className: "relative", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => {
            setShowNotifications(!showNotifications);
            setShowSettings(false);
          },
          className: "relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          "aria-label": "Notifications",
          title: "Notifications",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" }) }),
            totalUnread > 0 && /* @__PURE__ */ jsx("span", { className: "absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white", children: totalUnread > 9 ? "9+" : totalUnread })
          ]
        }
      ),
      showNotifications && ReactDOM.createPortal(/* @__PURE__ */ jsxs(
        "div",
        {
          className: "fixed right-6 top-14 w-80 rounded-xl border border-border bg-card shadow-xl z-[99999]",
          style: { position: "fixed", right: "1.5rem", top: "3.5rem" },
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-border px-4 py-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-card-foreground", children: "Notifications" }),
                totalUnread > 0 && /* @__PURE__ */ jsxs("span", { className: "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600", children: [
                  totalUnread,
                  " new"
                ] })
              ] }),
              totalUnread > 0 && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: markAllRead,
                  className: "text-xs text-indigo-600 hover:underline",
                  children: "Mark all read"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "max-h-80 overflow-y-auto", children: notifications.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 opacity-30", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx(
                "path",
                {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 1.5,
                  d: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                }
              ) }),
              /* @__PURE__ */ jsx("p", { className: "text-sm", children: "No notifications" })
            ] }) : notifications.map((n) => /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => {
                  markRead(n.id);
                  if (n.id.startsWith("invite:")) {
                    setActiveInvite(resolveInviteFromNotification(n));
                    setShowNotifications(false);
                    return;
                  }
                  if (n.link) window.location.href = n.link;
                },
                className: cn$1(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                  !n.read && "bg-indigo-50/50"
                ),
                children: [
                  /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600", children: n.type === "success" ? "✓" : n.type === "warning" ? "⚠" : n.type === "error" ? "✕" : "ℹ" }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ jsx("p", { className: cn$1("text-sm truncate", !n.read && "font-medium text-foreground"), children: n.title }),
                    n.message && /* @__PURE__ */ jsx("p", { className: "mt-0.5 truncate text-xs text-muted-foreground", children: n.message }),
                    /* @__PURE__ */ jsx("p", { className: "mt-1 text-[10px] text-muted-foreground", children: timeAgo(n.createdAt) })
                  ] }),
                  !n.read && /* @__PURE__ */ jsx("span", { className: "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" })
                ]
              },
              n.id
            )) })
          ]
        }
      ), document.body)
    ] }),
    /* @__PURE__ */ jsx(
      AlertDialog,
      {
        open: !!activeInvite,
        onOpenChange: (open) => {
          if (!open) {
            setActiveInvite(null);
            activeInviteRef.current = null;
          }
        },
        children: /* @__PURE__ */ jsxs(AlertDialogContent, { children: [
          /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
            /* @__PURE__ */ jsxs(AlertDialogTitle, { children: [
              activeInvite?.inviterName,
              " invited you to join"
            ] }),
            /* @__PURE__ */ jsx(AlertDialogDescription, { asChild: true, children: /* @__PURE__ */ jsxs("div", { className: "space-y-2 pt-1", children: [
              /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: activeInvite?.projectName || "Project" }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-[#6A7282] mt-0.5", children: [
                  "Role: ",
                  /* @__PURE__ */ jsx("span", { className: "capitalize font-medium", children: activeInvite?.role || "member" })
                ] })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Would you like to accept this invitation?" })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
            /* @__PURE__ */ jsx(AlertDialogCancel, { onClick: handleDeclineInvite, children: "Decline" }),
            /* @__PURE__ */ jsx(
              AlertDialogAction,
              {
                onClick: handleAcceptInvite,
                className: "bg-[#155DFC] text-white hover:bg-blue-700",
                children: "Accept"
              }
            )
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsxs("div", { ref: settingsRef, className: "relative", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => {
            setShowSettings(!showSettings);
            setShowNotifications(false);
          },
          className: "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          "aria-label": "Settings",
          title: "Settings",
          children: /* @__PURE__ */ jsxs("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.5, children: [
            /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" }),
            /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
          ] })
        }
      ),
      showSettings && /* @__PURE__ */ jsx("div", { className: "absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-lg z-50", children: /* @__PURE__ */ jsxs("div", { className: "py-2", children: [
        /* @__PURE__ */ jsxs("a", { href: "/settings", className: "flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
          "Profile Settings"
        ] }),
        /* @__PURE__ */ jsxs("a", { href: "/settings/workspace", className: "flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }) }),
          "Workspace Settings"
        ] }),
        /* @__PURE__ */ jsxs("a", { href: "/settings/integrations", className: "flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" }) }),
          "Integrations"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "my-1 border-t border-border" }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: toggleTheme,
            className: "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors",
            children: [
              theme === "light" ? /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" }) }) : /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" }) }),
              theme === "light" ? "Dark Mode" : "Light Mode"
            ]
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "my-1 border-t border-border" }),
        /* @__PURE__ */ jsxs("a", { href: "/help", className: "flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors", children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
          "Help & Support"
        ] })
      ] }) })
    ] })
  ] });
}

const $$Header = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Header;
  const { pageTitle } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<header class="flex h-14 items-center justify-between border-b border-border bg-card px-6"> <div class="flex items-center gap-3"> <!-- Back/Forward navigation arrows (replacing hamburger menu) --> <div class="flex items-center gap-0.5"> <button id="nav-back-btn" class="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Go back"> <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path> </svg> </button> <button id="nav-forward-btn" class="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100" aria-label="Go forward"> <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path> </svg> </button> </div> <span class="text-sm font-medium text-foreground">${pageTitle}</span> </div> ${renderComponent($$result, "HeaderActions", HeaderActions, { "client:load": true, "client:component-hydration": "load", "client:component-path": "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/components/layout/HeaderActions", "client:component-export": "default" })} </header> ${renderScript($$result, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/components/layout/Header.astro?astro&type=script&index=0&lang.ts")}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/components/layout/Header.astro", void 0);

function TopBar({ currentPage, currentPath }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openProjects, setOpenProjects] = useState([]);
  const isProjectPage = currentPath.includes("/projects/");
  const currentProjectSlug = isProjectPage ? currentPath.split("/projects/")[1]?.split("/")[0] : null;
  useEffect(() => {
    const stored = localStorage.getItem("orbit-open-projects");
    if (stored) {
      setOpenProjects(JSON.parse(stored));
    }
    if (isProjectPage && currentProjectSlug) {
      setOpenProjects((prev) => {
        const exists = prev.some((p) => p.id === currentProjectSlug);
        if (!exists) {
          const newProjects = [...prev, {
            id: currentProjectSlug,
            title: currentPage,
            path: currentPath
          }];
          localStorage.setItem("orbit-open-projects", JSON.stringify(newProjects));
          return newProjects;
        }
        return prev;
      });
    }
  }, [isProjectPage, currentProjectSlug, currentPage, currentPath]);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    window.dispatchEvent(new CustomEvent("toggle-sidebar"));
  };
  const closeProject = (projectId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const newProjects = openProjects.filter((p) => p.id !== projectId);
    setOpenProjects(newProjects);
    localStorage.setItem("orbit-open-projects", JSON.stringify(newProjects));
    if (projectId === currentProjectSlug) {
      navigate();
    }
  };
  const addNewTab = () => {
    navigate();
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex h-11 items-center border-b border-border bg-gray-50 px-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("a", { href: "/home", className: "flex items-center", children: /* @__PURE__ */ jsxs("svg", { width: "28", height: "24", viewBox: "0 0 29 25", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [
        /* @__PURE__ */ jsx("path", { d: "M15.0464 21.9802C20.5435 21.9802 24.9997 17.5239 24.9997 12.0269C24.9997 6.52984 20.5435 2.07361 15.0464 2.07361C9.54937 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 17.5239 9.54937 21.9802 15.0464 21.9802Z", stroke: "#1F4CB1", strokeWidth: "4.1472" }),
        /* @__PURE__ */ jsx("path", { d: "M16.5772 16.0603C23.718 11.9375 28.4215 6.71548 27.0826 4.39653C25.7438 2.07758 18.8696 3.53988 11.7288 7.66266C4.58789 11.7854 -0.115579 17.0075 1.22327 19.3265C2.56211 21.6454 9.43628 20.1831 16.5772 16.0603Z", stroke: "#C1C7CD", strokeWidth: "1.99066", strokeLinecap: "round" }),
        /* @__PURE__ */ jsx("path", { d: "M23.6281 6.98166C21.8976 4.04448 18.7022 2.07361 15.0464 2.07361C9.54938 2.07361 5.09314 6.52984 5.09314 12.0269C5.09314 13.4725 5.40133 14.8461 5.95558 16.0857", stroke: "#1F4CB1", strokeWidth: "4.1472" })
      ] }) }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: toggleSidebar,
          className: "flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200",
          "aria-label": "Toggle sidebar",
          children: /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", strokeWidth: "2" }),
            /* @__PURE__ */ jsx("path", { strokeWidth: "2", d: "M9 3v18" })
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mx-3 h-5 w-px bg-gray-300" }),
    openProjects.length > 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-1 items-center gap-1 overflow-x-auto", children: [
      openProjects.map((project) => /* @__PURE__ */ jsxs(
        "a",
        {
          href: project.path,
          className: `group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${project.id === currentProjectSlug ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:bg-gray-100"}`,
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" }) }),
            /* @__PURE__ */ jsx("span", { className: "truncate max-w-[120px]", children: project.title }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: (e) => closeProject(project.id, e),
                className: `ml-1 flex h-4 w-4 items-center justify-center rounded transition-colors ${project.id === currentProjectSlug ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100" : "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"}`,
                "aria-label": "Close tab",
                children: /* @__PURE__ */ jsx("svg", { className: "h-3 w-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
              }
            )
          ]
        },
        project.id
      )),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: addNewTab,
          className: "flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600",
          "aria-label": "Open new project",
          children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) })
        }
      )
    ] }) : /* @__PURE__ */ jsx("div", { className: "flex-1" }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1", children: /* @__PURE__ */ jsx(
      "button",
      {
        className: "flex h-7 w-7 items-center justify-center rounded text-[#4A5565] transition-colors hover:bg-gray-100",
        "aria-label": "Close",
        children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
      }
    ) })
  ] });
}

const $$DashboardLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$DashboardLayout;
  const { title, pageTitle = "Home" } = Astro2.props;
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": title }, { "default": ($$result2) => renderTemplate` ${renderScript($$result2, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/layouts/DashboardLayout.astro?astro&type=script&index=0&lang.ts")} ${maybeRenderHead()}<div class="flex h-screen flex-col overflow-hidden"${addAttribute(renderTransition($$result2, "k47fd6fj"), "data-astro-transition-scope")}> <!-- Top Navigation Bar --> <div${addAttribute(renderTransition($$result2, "mgss4tlr"), "data-astro-transition-scope")}${addAttribute(createTransitionScope($$result2, "mgss4tlr"), "data-astro-transition-persist")}> ${renderComponent($$result2, "TopBar", TopBar, { "client:load": true, "currentPage": pageTitle, "currentPath": Astro2.url.pathname, "client:component-hydration": "load", "client:component-path": "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/components/layout/TopBar", "client:component-export": "default" })} </div> <div class="flex flex-1 overflow-hidden"${addAttribute(renderTransition($$result2, "m5vsi7mq"), "data-astro-transition-scope")}> <aside${addAttribute(renderTransition($$result2, "z6ndvedk"), "data-astro-transition-scope")}${addAttribute(createTransitionScope($$result2, "z6ndvedk"), "data-astro-transition-persist")}> ${renderComponent($$result2, "Sidebar", Sidebar, { "client:load": true, "currentPath": Astro2.url.pathname, "client:component-hydration": "load", "client:component-path": "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/components/layout/Sidebar", "client:component-export": "default" })} </aside> <div class="flex flex-1 flex-col overflow-hidden"${addAttribute(renderTransition($$result2, "zkchsvui"), "data-astro-transition-scope")}> <header${addAttribute(renderTransition($$result2, "qvedaind"), "data-astro-transition-scope")}${addAttribute(createTransitionScope($$result2, "qvedaind"), "data-astro-transition-persist")}> ${renderComponent($$result2, "Header", $$Header, { "pageTitle": pageTitle })} </header> <main class="orbit-main-scroll flex-1 overflow-y-auto bg-background"${addAttribute(renderTransition($$result2, "brcrxlrg"), "data-astro-transition-scope")}> ${renderSlot($$result2, $$slots["default"])} </main> </div> </div> </div> ${renderComponent($$result2, "Toaster", Toaster, { "client:load": true, "client:component-hydration": "load", "client:component-path": "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/components/ui/sonner", "client:component-export": "Toaster" })} ${renderComponent($$result2, "InviteNotificationHandler", InviteNotificationHandler, { "client:load": true, "client:component-hydration": "load", "client:component-path": "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/hooks/useInviteNotifications", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/layouts/DashboardLayout.astro", "self");

export { $$DashboardLayout as $, fetchWithAuth as f };
