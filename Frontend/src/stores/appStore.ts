/**
 * Orbit global application store (Zustand).
 *
 * Provides a reactive, shared state layer for auth, projects, and folders so
 * that page transitions are instantaneous — data is already in memory when the
 * user navigates.
 *
 * SW Refresh strategy (v2):
 *   - appStore listens for 'sw:data' events dispatched by DashboardLayout.
 *   - When SW delivers fresh data via postMessage, DashboardLayout parses the
 *     route and dispatches 'sw:data' with { route, data, isStale }.
 *   - appStore.patchFromSW(route, data) patches the relevant state slice directly
 *     — no re-fetch, no loading state, no UI jank.
 *   - Socket events still trigger full refreshes for mutations (CRUD operations),
 *     but the SW pipeline handles passive background refreshes.
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
import {
  invalidateProjectTabsForSocketEvent,
  type ProjectTabInvalidationSource,
} from '@/lib/project-tab-realtime';
import { clearProjectClients } from '@/lib/sw-utils';

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
  sortOrder?: number;
  isFavorite?: boolean;
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
  | 'cache:block:update'
  | 'invite:project-created'
  | 'invite:accepted'
  | 'invite:revoked'
  | 'invite:declined'
  | 'documents:refresh'
  | 'package:created'
  | 'package:updated'
  | 'package:archived'
  | 'package:unarchived'
  | 'package:deleted'
  | 'project:updated'
  | 'project:workflow-updated'
  | 'project:trashed'
  | 'project:restored'
  | 'project:deleted'
  | 'project:member:joined'
  | 'project:member:left'
  | 'project:member:role-updated'
  | 'member:removed'
  | 'teams:changed'
  | 'roles:changed'
  | 'disciplines:changed'
  | 'share-links:changed'
  | 'workflow-template:changed'
  | 'document:conversion-updated'
  | 'approval:new'
  | 'approval:updated'
  | 'approval:deleted'
  | 'approval:comment_added'
  | 'approval:comment_deleted'
  | 'clash:updated'
  | 'cr:created'
  | 'cr:updated'
  | 'cr:status-changed'
  | 'cr:deleted'
  | 'cr:comment_added'
  | 'cr:comment_updated'
  | 'cr:comment_deleted'
  | 'cr:version_created'
  | 'cr:version_updated'
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'task:status-changed'
  | 'task:commented'
  | 'task:comment_updated'
  | 'task:comment_deleted'
  | 'package:task-count-changed';

type ProjectEventData = {
  'cache:block:update': { projectId: string; scope: string; blockId: string; data: unknown; updatedAt: number };
  'invite:project-created': { projectId: string; inviteId: string; email: string; role: string };
  'invite:accepted': { projectId: string; inviteId: string; acceptedBy: string };
  'invite:revoked': { projectId: string; inviteId: string };
  'invite:declined': { projectId: string; inviteId: string; declinedBy: string };
  'documents:refresh': { projectId: string; packageId: string | null; action?: string; documentId?: string; versionGroupId?: string };
  'package:created': { publicId: string; projectId: string; name: string; description: string; packageType: string; status: string; dueDate: string | null; creatorId: string; teamMemberIds: string[]; archivedAt: string | null; createdAt: string; updatedAt: string; actorId: string };
  'package:updated': { packageId: string; projectId: string; changes: Record<string, unknown> };
  'package:archived': { projectId: string; packageId: string };
  'package:unarchived': { projectId: string; packageId: string };
  'package:deleted': { projectId: string; packageId: string };
  'project:updated': { projectId: string; changes: Record<string, unknown> };
  'project:workflow-updated': { projectId: string; workflowTemplateId?: string; workflow?: Record<string, unknown> };
  'project:trashed': { projectId: string };
  'project:restored': { projectId: string };
  'project:deleted': { projectId: string };
  'project:member:joined': { projectId: string; userId: string; fullName: string };
  'project:member:left': { projectId: string; userId: string };
  'project:member:role-updated': { projectId: string; userId: string; role: string };
  'member:removed': { projectId: string };
  'teams:changed': { projectId: string; action: string; teamId?: string; userId?: string; team?: Record<string, unknown> };
  'roles:changed': { projectId: string; action: string; roleId?: string };
  'disciplines:changed': { projectId: string; action: string; disciplineId?: string };
  'share-links:changed': { projectId: string; action: string; shareId?: string; packageId?: string };
  'workflow-template:changed': { action: string; templateId?: string; sourceTemplateId?: string; authorId?: string; userId?: string; isPrivate?: boolean };
  'document:conversion-updated': { projectId: string; packageId: string | null; documentId: string; versionId: string; status: string; conversionStatus: string; conversionError?: string; xktUrl?: string };
  'approval:new': { projectId: string; approvalId: string };
  'approval:updated': { projectId: string; approvalId: string; status: string };
  'approval:deleted': { projectId: string; approvalId: string; documentId?: string; status?: string | null };
  'approval:comment_added': { projectId: string; approvalId: string; comment?: unknown };
  'approval:comment_deleted': { projectId: string; approvalId: string; commentId: string };
  'clash:updated': { projectId: string };
  'cr:created': { projectId: string; crId: string };
  'cr:updated': { projectId: string; crId: string };
  'cr:status-changed': { projectId: string; crId: string; status: string };
  'cr:deleted': { projectId: string; crId: string };
  'cr:comment_added': { projectId: string; crId: string; commentId?: string; comment?: unknown };
  'cr:comment_updated': { projectId: string; crId: string; commentId: string };
  'cr:comment_deleted': { projectId: string; crId: string; commentId: string };
  'cr:version_created': { projectId: string; crId: string; versionId: string; version?: Record<string, unknown> };
  'cr:version_updated': { projectId: string; crId: string; versionId: string; status: string };
  'task:created': { projectId: string; packageId: string | null; taskId: string };
  'task:updated': { projectId: string; packageId: string | null; taskId: string; changes?: Record<string, unknown> };
  'task:deleted': { projectId: string; packageId: string | null; taskId: string };
  'task:status-changed': { projectId: string; packageId: string | null; taskId: string; status: string };
  'task:commented': { projectId: string; packageId: string | null; taskId: string; commentId: string };
  'task:comment_updated': { projectId: string; packageId: string | null; taskId: string; commentId: string };
  'task:comment_deleted': { projectId: string; packageId: string | null; taskId: string; commentId: string };
  'package:task-count-changed': { projectId: string; packageId: string; action: string; taskId?: string; status?: string };
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
  /** Patch state from SW-delivered data — no re-fetch, no jank */
  patchFromSW: (route: string, data: unknown) => void;

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
    socket.emit('project:join', { projectId }, (res: { success: boolean; role?: string; error?: string }) => {
      if (!res?.success && res?.error) {
        console.debug(`[WS] project:join ${res.error} for project ${projectId}`);
      }
    });
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

// Module-level SW handler ref so destroySocket can remove the correct listener
let _swDataHandler: ((e: Event) => void) | null = null;

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

  clearAll: () => {
    if (_swDataHandler) {
      window.removeEventListener('sw:data', _swDataHandler);
      _swDataHandler = null;
    }
    // Clear all tracked project clients since we're logging out
    _projectCallbacks.forEach((_, projectId) => clearProjectClients(projectId));
    _projectCallbacks.clear();
    set({ auth: null, projects: [], folders: [], teamMembers: {}, isHydrated: false, prefetchStatus: 'idle' });
  },

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

    // ── SW Data Patching ──────────────────────────────────────────────────────
    // Listen for SW-delivered data dispatched by DashboardLayout.
    // SW fetches in background, delivers via postMessage, we patch state directly.
    // This avoids the full fetch → loading → setState cycle that causes UI jank.
    _swDataHandler = (e: Event) => {
      const { route, data } = (e as CustomEvent<{ route: string; data: unknown; isStale: boolean }>).detail;
      get().patchFromSW(route, data);
    };
    window.addEventListener('sw:data', _swDataHandler);

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
      'cache:block:update',
      'invite:project-created',
      'invite:accepted',
      'invite:revoked',
      'invite:declined',
      'documents:refresh',
      'package:created',
      'package:updated',
      'package:archived',
      'package:unarchived',
      'package:deleted',
      'project:updated',
      'project:workflow-updated',
      'project:trashed',
      'project:restored',
      'project:deleted',
      'project:member:joined',
      'project:member:left',
      'project:member:role-updated',
      'member:removed',
      'teams:changed',
      'roles:changed',
      'disciplines:changed',
      'share-links:changed',
      'workflow-template:changed',
      'document:conversion-updated',
      'approval:new',
      'approval:updated',
      'approval:deleted',
      'approval:comment_added',
      'approval:comment_deleted',
      'clash:updated',
      'cr:created',
      'cr:updated',
      'cr:status-changed',
      'cr:deleted',
      'cr:comment_added',
      'cr:comment_updated',
      'cr:comment_deleted',
      'cr:version_created',
      'cr:version_updated',
      'task:created',
      'task:updated',
      'task:deleted',
      'task:status-changed',
      'task:commented',
      'task:comment_updated',
      'task:comment_deleted',
      'package:task-count-changed',
    ];

    for (const event of projectEvents) {
      (socket.on as (event: string, handler: (data: unknown) => void) => void)(event, (data: unknown) => {
        const payload = data as { projectId?: string };
        if (!payload?.projectId) return;
        if (event !== 'cache:block:update') {
          invalidateProjectTabsForSocketEvent(
            payload.projectId,
            event as ProjectTabInvalidationSource,
            data
          );
        }
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
    }
    if (_swDataHandler) {
      window.removeEventListener('sw:data', _swDataHandler);
      _swDataHandler = null;
    }
    set({ socket: null });
  },

  // ── SW Data Patching ────────────────────────────────────────────────────────
  // Patches state directly from SW-delivered data. This is the key to "no jank" —
  // instead of calling loadProjects() which triggers a full fetch + setState cycle,
  // we receive fresh data from SW via postMessage and patch state in-place.
  // The route is the API path, e.g. '/api/projects/me'
  patchFromSW: (route: string, data: unknown) => {
    if (!data || typeof data !== 'object') return;

    if (route === '/api/projects/me' && Array.isArray(data)) {
      writeCache(PROJECTS_CACHE_KEY, data);
      set((state) => {
        // Merge: update existing, add new, remove stale
        const incomingMap = new Map((data as ApiProject[]).map((p) => [p.publicId, p]));
        const merged = state.projects
          .map((p) => incomingMap.get(p.publicId) ?? p)
          .filter((p) => incomingMap.has(p.publicId));

        const existingIds = new Set(state.projects.map((p) => p.publicId));
        for (const p of data as ApiProject[]) {
          if (!existingIds.has(p.publicId)) merged.push(p);
        }

        return { projects: merged };
      });
      return;
    }

    if (route === '/api/folders/me' && Array.isArray(data)) {
      writeCache(FOLDERS_CACHE_KEY, data);
      set((state) => {
        const incomingMap = new Map((data as ApiFolder[]).map((f) => [f.publicId, f]));
        const merged = state.folders
          .map((f) => incomingMap.get(f.publicId) ?? f)
          .filter((f) => incomingMap.has(f.publicId));

        const existingIds = new Set(state.folders.map((f) => f.publicId));
        for (const f of data as ApiFolder[]) {
          if (!existingIds.has(f.publicId)) merged.push(f);
        }

        return { folders: merged };
      });
      return;
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
        if (s) s.emit('project:leave', { projectId }, () => {});
        clearProjectClients(projectId);
      }
    };
  },
}));

// ── Convenience exports ────────────────────────────────────────────────────────

export const hydrateApp = () => useAppStore.getState().hydrate();
export const initAppSocket = () => useAppStore.getState().initSocket();
export const destroyAppSocket = () => useAppStore.getState().destroySocket();
export const clearAll = () => useAppStore.getState().clearAll();
export const patchFromSW = (route: string, data: unknown) => useAppStore.getState().patchFromSW(route, data);
export const updateAuthAvatar = (avatar: string) => useAppStore.getState().updateAuthAvatar(avatar);
