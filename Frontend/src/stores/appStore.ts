/**
 * Orbit global application store (Zustand).
 *
 * Provides a reactive, shared state layer for auth, projects, and folders so
 * that page transitions are instantaneous — data is already in memory when the
 * user navigates.
 *
 * Hydration strategy:
 *   1. DashboardLayout calls `hydrateApp()` on mount (via Astro <script>).
 *   2. That fires concurrent API calls and writes results into the store.
 *   3. Components read from the store — no loading state needed for cached data.
 *   4. On cache invalidation (socket `cache:invalidate` event), the affected
 *      slice is cleared so the next read fetches fresh data.
 */

import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
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

interface AppState {
  auth: AuthUser | null;
  projects: ApiProject[];
  folders: ApiFolder[];
  teamMembers: Record<string, ApiMember[]>;
  isHydrated: boolean;
  prefetchStatus: PrefetchStatus;
  socket: Socket | null;

  // Actions
  setAuth: (auth: AuthUser | null) => void;
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
}

// ── Store ────────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  auth: null,
  projects: [],
  folders: [],
  teamMembers: {},
  isHydrated: false,
  prefetchStatus: 'idle',
  socket: null,

  setAuth: (auth) => set({ auth }),

  setProjects: (projects) => set({ projects }),

  setFolders: (folders) => set({ folders }),

  setTeamMembers: (projectPublicId, members) =>
    set((s) => ({ teamMembers: { ...s.teamMembers, [projectPublicId]: members } })),

  clearTeamMembers: (projectPublicId) =>
    set((s) => {
      const next = { ...s.teamMembers };
      delete next[projectPublicId];
      return { teamMembers: next };
    }),

  clearAuth: () => set({ auth: null, isHydrated: false }),

  clearProjects: () => set({ projects: [] }),

  clearFolders: () => set({ folders: [] }),

  clearAll: () =>
    set({ auth: null, projects: [], folders: [], teamMembers: {}, isHydrated: false, prefetchStatus: 'idle' }),

  hydrate: async () => {
    if (typeof window === 'undefined') return;
    if (get().prefetchStatus === 'loading') return;
    set({ prefetchStatus: 'loading' });

    const fetchJson = async <T,>(url: string): Promise<T | null> => {
      try {
        const res = await apiFetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
        if (res.status === 401) {
          // Token expired during hydration — trigger one refresh then retry
          const refreshed = await import('@/lib/auth').then(m => m.refreshAccessToken());
          if (refreshed) {
            const retry = await apiFetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
            if (!retry.ok) return null;
            const payload = await retry.json();
            return (payload?.data ?? payload) as T;
          }
          return null;
        }
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

    // Always update localStorage + set hydrated=true if ANY response came back
    if (auth) {
      try { localStorage.setItem('orbit_user', JSON.stringify(auth)); } catch { /* ignore */ }
    }

    set({
      auth: auth ?? null,
      projects: projects ?? [],
      folders: folders ?? [],
      isHydrated: true,
      prefetchStatus: 'done',
    });
  },

  initSocket: () => {
    if (typeof window === 'undefined') return;
    const existing = get().socket;
    if (existing) return;

    const socket = io(import.meta.env.PUBLIC_BACKEND_WS_URL ?? 'http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

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

    socket.on('disconnect', () => {
      // Socket.io auto-reconnects; no action needed
    });

    set({ socket });
  },

  destroySocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));

// ── Convenience exports (no hook overhead when you just need to call actions) ─────

export const hydrateApp = () => useAppStore.getState().hydrate();
export const initAppSocket = () => useAppStore.getState().initSocket();
export const destroyAppSocket = () => useAppStore.getState().destroySocket();
