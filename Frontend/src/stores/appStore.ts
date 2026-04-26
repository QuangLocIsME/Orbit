/**
 * Orbit global application store (Zustand).
 *
 * Provides a reactive, shared state layer for auth, projects, and folders so
 * that page transitions are instantaneous — data is already in memory when the
 * user navigates.
 *
 * Real-time strategy:
 *   - appStore manages a global socket and dispatches project-scoped events
 *     to registered callbacks.
 *   - Components call registerProjectCallback(projectId, event, callback) on mount.
 *   - appStore joins the project:projectId room when the first callback is registered,
 *     and leaves when the last callback is removed.
 */

import { create } from 'zustand';
import { getSocket, type OrbitSocket } from '@/lib/socket';

const PROJECTS_CACHE_KEY = 'orbit:projects:me';
const FOLDERS_CACHE_KEY = 'orbit:folders:me';
const APP_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedPayload<T> = {
  data: T;
  expiresAt: number;
};

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedPayload<T> = {
      data,
      expiresAt: Date.now() + APP_CACHE_TTL_MS,
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota / serialization errors
  }
}

// ── Types ────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  publicId: string;
  fullName: string;
  email: string;
  avatar?: string | null;
  role?: string;
}

export interface ApiProject {
  publicId: string;
  name: string;
  description?: string;
  industry?: string;
  coverImageUrl?: string;
  folderId?: string | null;
  folderIds?: string[];
  role?: string;
  status?: string;
}

export interface ApiMember {
  publicId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'invited' | 'accepted' | 'blocked';
  invitedBy?: string;
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
    avatar?: string | null;
  };
}

export interface PendingInvite {
  publicId: string;
  projectId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface ApiFolder {
  publicId: string;
  name: string;
  color?: string;
  description?: string;
}

export type PrefetchStatus = 'idle' | 'loading' | 'done' | 'error';

// ── Callback registry types ──────────────────────────────────────────────────────

type ProjectEvent =
  | 'documents:refresh'
  | 'package:updated'
  | 'package:archived'
  | 'package:unarchived'
  | 'project:updated'
  | 'project:member:joined'
  | 'project:member:left'
  | 'project:member:role-updated'
  | 'member:removed'
  | 'invite:accepted'
  | 'invite:revoked'
  | 'invite:declined';

type ProjectEventData = {
  'documents:refresh': { projectId: string; packageId: string };
  'package:updated': { packageId: string; projectId: string; changes: Record<string, unknown> };
  'package:archived': { projectId: string; packageId: string };
  'package:unarchived': { projectId: string; packageId: string };
  'project:updated': { projectId: string; changes: Record<string, unknown> };
  'project:member:joined': { projectId: string; userId: string; fullName: string };
  'project:member:left': { projectId: string; userId: string };
  'project:member:role-updated': { projectId: string; userId: string; role: string };
  'member:removed': { projectId: string };
  'invite:accepted': { projectId: string; inviteId: string; acceptedBy: string };
  'invite:revoked': { projectId: string; inviteId: string };
  'invite:declined': { projectId: string; inviteId: string; declinedBy: string };
};

// ── Store ────────────────────────────────────────────────────────────────────────

interface AppState {
  auth: AuthUser | null;
  projects: ApiProject[];
  folders: ApiFolder[];
  teamMembers: Record<string, ApiMember[]>;
  isHydrated: boolean;
  prefetchStatus: PrefetchStatus;
  socket: OrbitSocket | null;

  // Actions
  setAuth: (auth: AuthUser | null) => void;
  updateAuthAvatar: (avatar: string) => void;
  setProjects: (projects: ApiProject[]) => void;
  setFolders: (folders: ApiFolder[]) => void;
  setTeamMembers: (projectPublicId: string, members: ApiMember[]) => void;
  clearTeamMembers: (projectPublicId: string) => void;
  clearAuth: () => void;
  clearProjects: () => void;
  clearFolders: () => void;
  clearAll: () => void;
  hydrate: () => Promise<void>;
  initSocket: () => void;
  destroySocket: () => void;

  // Real-time callbacks
  registerProjectCallback: <E extends ProjectEvent>(
    projectId: string,
    event: E,
    callback: (data: ProjectEventData[E]) => void
  ) => () => void;
}

// Internal registry: projectId → event → callbacks[]
type CallbackEntry = {
  event: ProjectEvent;
  callback: (data: unknown) => void;
  _projectId: string;
};
const _projectCallbacks: Map<string, CallbackEntry[]> = new Map();

// Pending callbacks queued before socket is initialized
const _pendingCallbacks: CallbackEntry[] = [];

function _getOrCreate(socket: OrbitSocket, projectId: string): CallbackEntry[] {
  if (!_projectCallbacks.has(projectId)) {
    _projectCallbacks.set(projectId, []);
    socket.emit('project:join', { projectId });
  }
  return _projectCallbacks.get(projectId)!;
}

function _dispatchEvent(projectId: string, event: ProjectEvent, data: unknown) {
  const cbs = _projectCallbacks.get(projectId);
  if (!cbs) return;
  cbs.forEach((entry) => {
    if (entry.event === event) entry.callback(data);
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  auth: null,
  projects: [],
  folders: [],
  teamMembers: {},
  isHydrated: false,
  prefetchStatus: 'idle',
  socket: null as OrbitSocket | null,

  setAuth: (auth) => set({ auth }),

  updateAuthAvatar: (avatar) => {
    set((s) => {
      if (!s.auth) return s;
      const updated = { ...s.auth, avatar };
      try { localStorage.setItem('orbit_user', JSON.stringify(updated)); } catch { /* ignore */ }
      return { auth: updated };
    });
  },

  setProjects: (projects) => {
    writeCache(PROJECTS_CACHE_KEY, projects);
    set({ projects });
  },

  setFolders: (folders) => {
    writeCache(FOLDERS_CACHE_KEY, folders);
    set({ folders });
  },

  setTeamMembers: (projectPublicId, members) =>
    set((s) => ({ teamMembers: { ...s.teamMembers, [projectPublicId]: members } })),

  clearTeamMembers: (projectPublicId) =>
    set((s) => {
      const next = { ...s.teamMembers };
      delete next[projectPublicId];
      return { teamMembers: next };
    }),

  clearAuth: () => set({ auth: null, isHydrated: false }),

  clearProjects: () => {
    if (typeof window !== 'undefined') {
      try { sessionStorage.removeItem(PROJECTS_CACHE_KEY); } catch { /* ignore */ }
    }
    set({ projects: [] });
  },

  clearFolders: () => {
    if (typeof window !== 'undefined') {
      try { sessionStorage.removeItem(FOLDERS_CACHE_KEY); } catch { /* ignore */ }
    }
    set({ folders: [] });
  },

  clearAll: () =>
    set({ auth: null, projects: [], folders: [], teamMembers: {}, isHydrated: false, prefetchStatus: 'idle' }),

  hydrate: async () => {
    if (typeof window === 'undefined') return;
    if (get().prefetchStatus === 'loading') return;

    // Fast path: hydrate from session cache first (instant UI on navigation)
    const cachedProjects = readCache<ApiProject[]>(PROJECTS_CACHE_KEY);
    const cachedFolders = readCache<ApiFolder[]>(FOLDERS_CACHE_KEY);
    if (cachedProjects || cachedFolders) {
      set((state) => ({
        projects: cachedProjects ?? state.projects,
        folders: cachedFolders ?? state.folders,
        isHydrated: true,
        prefetchStatus: 'done',
      }));
    }

    set({ prefetchStatus: 'loading' });

    const fetchJson = async <T,>(url: string): Promise<T | null> => {
      try {
        const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
        if (!res.ok) return null;
        const payload = await res.json();
        return (payload?.data ?? payload) as T;
      } catch {
        return null;
      }
    };

    const [auth, projects, folders] = await Promise.all([
      fetchJson<AuthUser>('/api/auth/me'),
      fetchJson<ApiProject[]>('/api/projects/me'),
      fetchJson<ApiFolder[]>('/api/folders/me'),
    ]);

    if (auth) {
      try { localStorage.setItem('orbit_user', JSON.stringify(auth)); } catch { /* ignore */ }
    }

    if (projects) writeCache(PROJECTS_CACHE_KEY, projects);
    if (folders) writeCache(FOLDERS_CACHE_KEY, folders);

    set({
      auth: auth ?? null,
      projects: projects ?? cachedProjects ?? [],
      folders: folders ?? cachedFolders ?? [],
      isHydrated: true,
      prefetchStatus: 'done',
    });
  },

  initSocket: () => {
    if (typeof window === 'undefined') return;
    const existing = get().socket;
    if (existing) return;

    const socket = getSocket();

    // ── Global events ──────────────────────────────────────────────────────────
    socket.on('cache:invalidate', (payload: { data: { cacheTypes: string[]; userId: string } }) => {
      const { cacheTypes } = payload.data ?? {};
      if (!Array.isArray(cacheTypes)) return;
      const s = get();
      if (cacheTypes.includes('auth')) s.clearAuth();
      if (cacheTypes.includes('projects')) s.clearProjects();
      if (cacheTypes.includes('folders')) s.clearFolders();
      if (cacheTypes.includes('teamMembers')) {
        Object.keys(s.teamMembers).forEach((pid) => s.clearTeamMembers(pid));
      }
    });

    socket.on('user:avatar:updated', (payload: { userId: string; avatar: string }) => {
      const s = get();
      if (s.auth?.publicId === payload.userId) {
        s.updateAuthAvatar(payload.avatar);
      }
    });

    // ── Project-scoped events — dispatch to registered callbacks ───────────────
    const projectEvents: ProjectEvent[] = [
      'documents:refresh',
      'package:updated',
      'package:archived',
      'package:unarchived',
      'project:updated',
      'project:member:joined',
      'project:member:left',
      'project:member:role-updated',
      'member:removed',
      'invite:accepted',
      'invite:revoked',
      'invite:declined',
    ];

    for (const event of projectEvents) {
      (socket.on as (event: string, handler: (data: unknown) => void) => void)(event, (data: unknown) => {
        const payload = data as { projectId?: string };
        if (!payload?.projectId) return;
        _dispatchEvent(payload.projectId, event, data);
      });
    }

    // Drain any callbacks registered before socket was ready
    while (_pendingCallbacks.length > 0) {
      const pending = _pendingCallbacks.shift()!;
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

    const entry: CallbackEntry = {
      event,
      callback: callback as (data: unknown) => void,
      _projectId: projectId,
    };

    if (!socket) {
      // Queue until socket is initialized
      _pendingCallbacks.push(entry);
      return () => {
        const idx = _pendingCallbacks.indexOf(entry);
        if (idx !== -1) _pendingCallbacks.splice(idx, 1);
      };
    }

    _getOrCreate(socket, projectId).push(entry);

    // Return cleanup function
    return () => {
      const arr = _projectCallbacks.get(projectId);
      if (!arr) return;
      const idx = arr.indexOf(entry);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) {
        _projectCallbacks.delete(projectId);
        const s = get().socket;
        if (s) s.emit('project:leave', { projectId });
      }
    };
  },
}));

// ── Convenience exports ────────────────────────────────────────────────────────

export const hydrateApp = () => useAppStore.getState().hydrate();
export const initAppSocket = () => useAppStore.getState().initSocket();
export const destroyAppSocket = () => useAppStore.getState().destroySocket();
export const clearAll = () => useAppStore.getState().clearAll();
export const updateAuthAvatar = (avatar: string) => useAppStore.getState().updateAuthAvatar(avatar);
