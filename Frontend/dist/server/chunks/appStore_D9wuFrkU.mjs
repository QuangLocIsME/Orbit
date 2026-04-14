import { create } from 'zustand';
import { h as getSocket } from './useInviteNotifications_Dil9UiGe.mjs';

const PROJECTS_CACHE_KEY = "orbit:projects:me";
const FOLDERS_CACHE_KEY = "orbit:folders:me";
const APP_CACHE_TTL_MS = 5 * 60 * 1e3;
function readCache(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
function writeCache(key, data) {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      data,
      expiresAt: Date.now() + APP_CACHE_TTL_MS
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
  }
}
const _projectCallbacks = /* @__PURE__ */ new Map();
const _pendingCallbacks = [];
function _getOrCreate(socket, projectId) {
  if (!_projectCallbacks.has(projectId)) {
    _projectCallbacks.set(projectId, []);
    socket.emit("project:join", { projectId });
  }
  return _projectCallbacks.get(projectId);
}
function _dispatchEvent(projectId, event, data) {
  const cbs = _projectCallbacks.get(projectId);
  if (!cbs) return;
  cbs.forEach((entry) => {
    if (entry.event === event) entry.callback(data);
  });
}
const useAppStore = create((set, get) => ({
  auth: null,
  projects: [],
  folders: [],
  teamMembers: {},
  isHydrated: false,
  prefetchStatus: "idle",
  socket: null,
  setAuth: (auth) => set({ auth }),
  setProjects: (projects) => {
    writeCache(PROJECTS_CACHE_KEY, projects);
    set({ projects });
  },
  setFolders: (folders) => {
    writeCache(FOLDERS_CACHE_KEY, folders);
    set({ folders });
  },
  setTeamMembers: (projectPublicId, members) => set((s) => ({ teamMembers: { ...s.teamMembers, [projectPublicId]: members } })),
  clearTeamMembers: (projectPublicId) => set((s) => {
    const next = { ...s.teamMembers };
    delete next[projectPublicId];
    return { teamMembers: next };
  }),
  clearAuth: () => set({ auth: null, isHydrated: false }),
  clearProjects: () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(PROJECTS_CACHE_KEY);
      } catch {
      }
    }
    set({ projects: [] });
  },
  clearFolders: () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(FOLDERS_CACHE_KEY);
      } catch {
      }
    }
    set({ folders: [] });
  },
  clearAll: () => set({ auth: null, projects: [], folders: [], teamMembers: {}, isHydrated: false, prefetchStatus: "idle" }),
  hydrate: async () => {
    if (typeof window === "undefined") return;
    if (get().prefetchStatus === "loading") return;
    const cachedProjects = readCache(PROJECTS_CACHE_KEY);
    const cachedFolders = readCache(FOLDERS_CACHE_KEY);
    if (cachedProjects || cachedFolders) {
      set((state) => ({
        projects: cachedProjects ?? state.projects,
        folders: cachedFolders ?? state.folders,
        isHydrated: true,
        prefetchStatus: "done"
      }));
    }
    set({ prefetchStatus: "loading" });
    const fetchJson = async (url) => {
      try {
        const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const payload = await res.json();
        return payload?.data ?? payload;
      } catch {
        return null;
      }
    };
    const [auth, projects, folders] = await Promise.all([
      fetchJson("/api/auth/me"),
      fetchJson("/api/projects/me"),
      fetchJson("/api/folders/me")
    ]);
    if (auth) {
      try {
        localStorage.setItem("orbit_user", JSON.stringify(auth));
      } catch {
      }
    }
    if (projects) writeCache(PROJECTS_CACHE_KEY, projects);
    if (folders) writeCache(FOLDERS_CACHE_KEY, folders);
    set({
      auth: auth ?? null,
      projects: projects ?? cachedProjects ?? [],
      folders: folders ?? cachedFolders ?? [],
      isHydrated: true,
      prefetchStatus: "done"
    });
  },
  initSocket: () => {
    if (typeof window === "undefined") return;
    const existing = get().socket;
    if (existing) return;
    const socket = getSocket();
    socket.on("cache:invalidate", (payload) => {
      const { cacheTypes } = payload.data ?? {};
      if (!Array.isArray(cacheTypes)) return;
      const s = get();
      if (cacheTypes.includes("auth")) s.clearAuth();
      if (cacheTypes.includes("projects")) s.clearProjects();
      if (cacheTypes.includes("folders")) s.clearFolders();
      if (cacheTypes.includes("teamMembers")) {
        Object.keys(s.teamMembers).forEach((pid) => s.clearTeamMembers(pid));
      }
    });
    const projectEvents = [
      "documents:refresh",
      "package:updated",
      "package:archived",
      "package:unarchived",
      "project:updated",
      "project:member:joined",
      "project:member:left",
      "project:member:role-updated",
      "member:removed",
      "invite:accepted",
      "invite:revoked",
      "invite:declined"
    ];
    for (const event of projectEvents) {
      socket.on(event, (data) => {
        const payload = data;
        if (!payload?.projectId) return;
        _dispatchEvent(payload.projectId, event, data);
      });
    }
    while (_pendingCallbacks.length > 0) {
      const pending = _pendingCallbacks.shift();
      _getOrCreate(socket, pending._projectId).push(pending);
    }
    set({ socket });
  },
  destroySocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
  // ── Real-time callback registration ─────────────────────────────────────────
  registerProjectCallback: (projectId, event, callback) => {
    const socket = get().socket;
    const entry = {
      event,
      callback,
      _projectId: projectId
    };
    if (!socket) {
      _pendingCallbacks.push(entry);
      return () => {
        const idx = _pendingCallbacks.indexOf(entry);
        if (idx !== -1) _pendingCallbacks.splice(idx, 1);
      };
    }
    _getOrCreate(socket, projectId).push(entry);
    return () => {
      const arr = _projectCallbacks.get(projectId);
      if (!arr) return;
      const idx = arr.indexOf(entry);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) {
        _projectCallbacks.delete(projectId);
        const s = get().socket;
        if (s) s.emit("project:leave", { projectId });
      }
    };
  }
}));

export { useAppStore as u };
