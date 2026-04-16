/**
 * ORBIT API Client — fetch wrapper with automatic JWT refresh on 401.
 * Uses httpOnly cookies for auth tokens.
 */

import { dispatchAuthExpired } from './auth-helpers';

let isRefreshing = false;
let waitQueue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

function drainQueue(error: Error | null) {
  waitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  waitQueue = [];
}

async function attemptRefresh(): Promise<void> {
  const res = await fetch('/api/auth/refresh-token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Refresh failed');
}

/**
 * Drop-in replacement for fetch() with auto-refresh on 401.
 *
 * Usage:
 *   const res = await apiFetch('/api/auth/me');
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: 'include' };

  let response = await fetch(input, opts);

  if (response.status !== 401) return response;

  // Already on the login page — don't trigger refresh → infinite redirect loop
  if (typeof window !== 'undefined' && window.location.pathname === '/login') return response;

  // ── 401 received — try to refresh the access token ──────────────────────
  if (isRefreshing) {
    // Another request is already refreshing — wait for it to finish, then retry
    await new Promise<void>((resolve, reject) => {
      waitQueue.push({ resolve, reject });
    });
    return fetch(input, opts);
  }

  isRefreshing = true;
  try {
    await attemptRefresh();
    drainQueue(null);
    response = await fetch(input, opts); // retry original request
  } catch (err) {
    drainQueue(err as Error);
    // Refresh failed — user must log in again.
    // Dispatch an event instead of window.location.href so Astro's ClientRouter
    // handles the redirect and the View Transitions pipeline stays intact.
    localStorage.removeItem('orbit_user');
    dispatchAuthExpired();
  } finally {
    isRefreshing = false;
  }

  return response;
}

/**
 * Upload project thumbnail lên Supabase Storage.
 * @param projectId - Public ID của project
 * @param file - File ảnh (File object từ input[type=file])
 * @returns Promise với public URL của ảnh đã upload
 */
export async function uploadProjectThumbnail(projectId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('thumbnail', file);
  formData.append('projectId', projectId);

  const response = await apiFetch('/api/projects/upload-thumbnail', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Failed to upload thumbnail');
  }

  const data = await response.json();
  return data.data.coverImageUrl;
}

/**
 * Update project settings (name, description, industry, coverImageUrl).
 * @param projectId - Public ID của project
 * @param updates - Object chứa các fields cần update
 */
export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    description?: string;
    industry?: string;
    coverImageUrl?: string;
  }
): Promise<void> {
  const response = await apiFetch('/api/projects/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, ...updates }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Update failed' }));
    throw new Error(error.message || 'Failed to update project');
  }
}
