type CacheScope = 'documents' | 'packages' | 'tasks' | 'changes' | 'versions' | 'teams' | 'activity';

type CacheEnvelope<T> = {
  data: T;
  updatedAt: number;
};

type ProjectCacheShape = Partial<Record<CacheScope, CacheEnvelope<unknown>>>;

const CACHE_PREFIX = 'orbit:project-detail-cache:';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

const memoryCache = new Map<string, ProjectCacheShape>();

function getStorageKey(projectId: string): string {
  return `${CACHE_PREFIX}${projectId}`;
}

function readProjectCache(projectId: string): ProjectCacheShape {
  const fromMemory = memoryCache.get(projectId);
  if (fromMemory) return fromMemory;

  if (typeof window === 'undefined') return {};

  try {
    const raw = sessionStorage.getItem(getStorageKey(projectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProjectCacheShape;
    memoryCache.set(projectId, parsed);
    return parsed;
  } catch {
    return {};
  }
}

function writeProjectCache(projectId: string, cache: ProjectCacheShape): void {
  memoryCache.set(projectId, cache);
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(getStorageKey(projectId), JSON.stringify(cache));
  } catch {
    // ignore quota and serialization issues
  }
}

export function getProjectTabCache<T>(
  projectId: string,
  scope: CacheScope,
  options?: { maxAgeMs?: number }
): CacheEnvelope<T> | null {
  const cache = readProjectCache(projectId);
  const entry = cache[scope] as CacheEnvelope<T> | undefined;
  if (!entry) return null;

  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_TTL_MS;
  if (Date.now() - entry.updatedAt > maxAgeMs) return null;
  return entry;
}

export function setProjectTabCache<T>(projectId: string, scope: CacheScope, data: T): void {
  const cache = readProjectCache(projectId);
  cache[scope] = {
    data,
    updatedAt: Date.now(),
  } satisfies CacheEnvelope<T>;
  writeProjectCache(projectId, cache);
}

export function mergeProjectTabCache<T extends Record<string, unknown>>(
  projectId: string,
  scope: CacheScope,
  patch: T
): void {
  const existing = getProjectTabCache<Record<string, unknown>>(projectId, scope)?.data || {};
  setProjectTabCache(projectId, scope, {
    ...existing,
    ...patch,
  });
}

export function clearProjectTabCache(projectId: string, scope?: CacheScope): void {
  if (!scope) {
    memoryCache.delete(projectId);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(getStorageKey(projectId));
      } catch {
        // ignore
      }
    }
    return;
  }

  const cache = readProjectCache(projectId);
  delete cache[scope];
  writeProjectCache(projectId, cache);
}
