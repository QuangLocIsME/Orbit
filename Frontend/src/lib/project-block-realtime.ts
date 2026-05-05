import { getSocket } from '@/lib/socket';
import {
  getProjectBlockCache,
  setProjectBlockCache,
  type ProjectBlockScope,
} from '@/stores/projectBlockCacheStore';

export const PROJECT_BLOCK_UPDATED_EVENT = 'orbit:project-block-updated';

export interface ProjectBlockUpdateDetail<T = unknown> {
  projectId: string;
  cacheKey: string;
  scope: ProjectBlockScope;
  blockId: string;
  packageId?: string | null;
  data: T;
  updatedAt: number;
}

let installed = false;
const refreshListeners = new Map<string, (detail: ProjectBlockUpdateDetail) => void>();

function makeRefreshKey(cacheKey: string, scope: ProjectBlockScope, blockId: string): string {
  return `${cacheKey}:${scope}:${blockId}`;
}

export function initProjectBlockRealtime(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const socket = getSocket();
  socket.on('cache:block:refresh', async (payload) => {
    if (!payload?.projectId || !payload?.scope || !payload?.blockId) return;

    const cacheKey = typeof payload.cacheKey === 'string' && payload.cacheKey.trim()
      ? payload.cacheKey.trim()
      : payload.projectId;

    const refreshed = await fetchProjectBlock(cacheKey, payload.scope, payload.blockId, {
      projectId: payload.projectId,
      packageId: payload.packageId || null,
      cacheKey,
      force: true,
    });

    const detail: ProjectBlockUpdateDetail = {
      projectId: payload.projectId,
      cacheKey,
      scope: payload.scope,
      blockId: payload.blockId,
      packageId: payload.packageId || null,
      data: refreshed,
      updatedAt: payload.updatedAt || Date.now(),
    };

    const listener = refreshListeners.get(makeRefreshKey(cacheKey, payload.scope, payload.blockId));
    if (listener) {
      listener(detail);
    }
  });
  socket.on('cache:block:update', (payload) => {
    if (!payload?.projectId || !payload?.scope || !payload?.blockId) return;

    const cacheKey = typeof payload.cacheKey === 'string' && payload.cacheKey.trim()
      ? payload.cacheKey.trim()
      : payload.projectId;

    setProjectBlockCache(cacheKey, payload.scope, payload.blockId, payload.data);
    window.dispatchEvent(new CustomEvent<ProjectBlockUpdateDetail>(
      PROJECT_BLOCK_UPDATED_EVENT,
      {
        detail: {
          projectId: payload.projectId,
          cacheKey,
          scope: payload.scope,
          blockId: payload.blockId,
          packageId: payload.packageId || null,
          data: payload.data,
          updatedAt: payload.updatedAt || Date.now(),
        },
      }
    ));
  });
}

export async function fetchProjectBlock<T>(
  projectIdOrCacheKey: string,
  scope: ProjectBlockScope,
  blockId: string,
  options?: { packageId?: string | null; cacheKey?: string; projectId?: string; force?: boolean }
): Promise<T | null> {
  const cacheKey = options?.cacheKey || projectIdOrCacheKey;
  const projectId = options?.projectId || projectIdOrCacheKey;
  const cached = options?.force ? null : getProjectBlockCache<T>(cacheKey, scope, blockId);
  if (cached?.data) return cached.data;

  try {
    const response = await fetch('/api/projects/blocks/get', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        projectId,
        scope,
        blockId,
        packageId: options?.packageId || null,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload?.data) return null;

    setProjectBlockCache(cacheKey, scope, blockId, payload.data.data);
    return payload.data.data as T;
  } catch {
    return null;
  }
}

export function onProjectBlockUpdated<T = unknown>(
  cacheKey: string,
  scope: ProjectBlockScope,
  blockId: string,
  handler: (detail: ProjectBlockUpdateDetail<T>) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ProjectBlockUpdateDetail<T>>).detail;
    if (!detail) return;
    if (detail.cacheKey !== cacheKey) return;
    if (detail.scope !== scope) return;
    if (detail.blockId !== blockId) return;
    handler(detail);
  };

  window.addEventListener(PROJECT_BLOCK_UPDATED_EVENT, listener);
  return () => window.removeEventListener(PROJECT_BLOCK_UPDATED_EVENT, listener);
}

export function onProjectBlockRefresh<T = unknown>(
  cacheKey: string,
  scope: ProjectBlockScope,
  blockId: string,
  handler: (detail: ProjectBlockUpdateDetail<T>) => void
): () => void {
  const key = makeRefreshKey(cacheKey, scope, blockId);
  refreshListeners.set(key, handler as (detail: ProjectBlockUpdateDetail) => void);
  return () => {
    refreshListeners.delete(key);
  };
}
