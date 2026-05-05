export type ProjectBlockScope =
  | 'packages'
  | 'documents'
  | 'tasks'
  | 'changes'
  | 'versions'
  | 'teams'
  | 'activity'
  | 'clashes'
  | 'settings';

export interface ProjectBlockEnvelope<T> {
  blockId: string;
  data: T;
  updatedAt: number;
}

type ProjectBlocksShape = Partial<Record<ProjectBlockScope, Record<string, ProjectBlockEnvelope<unknown>>>>;

const CACHE_PREFIX = 'orbit:project-block-cache:';
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map<string, ProjectBlocksShape>();

function getStorageKey(projectId: string): string {
  return `${CACHE_PREFIX}${projectId}`;
}

function readProjectBlocks(projectId: string): ProjectBlocksShape {
  const fromMemory = memoryCache.get(projectId);
  if (fromMemory) return fromMemory;

  if (typeof window === 'undefined') return {};

  try {
    const raw = sessionStorage.getItem(getStorageKey(projectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProjectBlocksShape;
    memoryCache.set(projectId, parsed);
    return parsed;
  } catch {
    return {};
  }
}

function writeProjectBlocks(projectId: string, cache: ProjectBlocksShape): void {
  memoryCache.set(projectId, cache);
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(getStorageKey(projectId), JSON.stringify(cache));
  } catch {
    // ignore quota and serialization issues
  }
}

export function getProjectBlockCache<T>(
  projectId: string,
  scope: ProjectBlockScope,
  blockId: string,
  options?: { maxAgeMs?: number }
): ProjectBlockEnvelope<T> | null {
  const cache = readProjectBlocks(projectId);
  const entry = cache[scope]?.[blockId] as ProjectBlockEnvelope<T> | undefined;
  if (!entry) return null;

  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_TTL_MS;
  if (Date.now() - entry.updatedAt > maxAgeMs) return null;
  return entry;
}

export function setProjectBlockCache<T>(
  projectId: string,
  scope: ProjectBlockScope,
  blockId: string,
  data: T
): void {
  const cache = readProjectBlocks(projectId);
  const scopeEntries = cache[scope] || {};
  cache[scope] = {
    ...scopeEntries,
    [blockId]: {
      blockId,
      data,
      updatedAt: Date.now(),
    },
  };
  writeProjectBlocks(projectId, cache);
}

export function clearProjectBlockCache(
  projectId: string,
  scope?: ProjectBlockScope,
  blockId?: string
): void {
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

  const cache = readProjectBlocks(projectId);
  if (!blockId) {
    delete cache[scope];
    writeProjectBlocks(projectId, cache);
    return;
  }

  const scopeEntries = cache[scope];
  if (!scopeEntries) return;
  delete scopeEntries[blockId];
  cache[scope] = { ...scopeEntries };
  writeProjectBlocks(projectId, cache);
}
