/**
 * Prefetch singleton — fires auth, projects, and folders API calls
 * as early as possible and caches the results in sessionStorage so
 * downstream components can read them without a network round-trip.
 *
 * Runs at most once per page session (guarded by the `started` flag).
 * All errors are non-fatal — callers always fall back to their own
 * loading / fetching logic.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const CACHE_KEYS = {
  auth: 'orbit:prefetch:auth',
  projects: 'orbit:prefetch:projects',
  folders: 'orbit:prefetch:folders',
} as const;

let started = false;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // sessionStorage may be unavailable (e.g. third-party iframes) — ignore
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.data ?? payload ?? null;
  } catch {
    return null;
  }
}

export async function triggerPrefetch(): Promise<void> {
  if (started || typeof window === 'undefined') return;
  started = true;

  const [auth, projects, folders] = await Promise.all([
    fetchJson('/api/auth/me'),
    fetchJson('/api/projects/me'),
    fetchJson('/api/folders/me'),
  ]);

  if (auth !== null) writeCache(CACHE_KEYS.auth, auth);
  if (projects !== null) writeCache(CACHE_KEYS.projects, projects);
  if (folders !== null) writeCache(CACHE_KEYS.folders, folders);
}

// ── Read helpers (used by consuming components) ─────────────────────────────────

export function readPrefetchCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.expiresAt < Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function clearPrefetchCache(): void {
  Object.values(CACHE_KEYS).forEach((key) => {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  });
  started = false;
}
