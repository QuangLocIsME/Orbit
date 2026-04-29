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

  // Guest page: don't trigger refresh → redirect. Just return the 401 as-is.
  if (typeof window !== 'undefined') {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : '';
    const isGuestPage = new URL(url, window.location.origin).searchParams.get('guest') === '1'
      || window.location.search.includes('guest=1');
    if (isGuestPage) return response;
  }

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

export async function uploadProjectAvatar(projectId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('projectId', projectId);

  const response = await apiFetch('/api/projects/upload-avatar', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Failed to upload avatar');
  }

  const data = await response.json();
  return data.data.coverImageUrl;
}

export async function deleteProjectAvatar(projectId: string): Promise<void> {
  const response = await apiFetch('/api/projects/delete-avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Delete failed' }));
    throw new Error(error.message || 'Failed to delete avatar');
  }
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

/**
 * Get all roles for a project
 */
export async function fetchProjectRoles(projectId: string): Promise<any[]> {
  const response = await apiFetch('/api/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch roles' }));
    throw new Error(error.message || 'Failed to fetch roles');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Create a new role
 */
export async function createProjectRole(
  projectId: string,
  roleData: {
    name: string;
    description?: string;
    color?: string;
    accessLevel?: string;
    permissions?: string[];
  }
): Promise<any> {
  const response = await apiFetch('/api/roles/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, ...roleData }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create role' }));
    throw new Error(error.message || 'Failed to create role');
  }

  return (await response.json()).data;
}

/**
 * Update a role
 */
export async function updateProjectRole(
  roleId: string,
  roleData: {
    name: string;
    description?: string;
    color?: string;
    accessLevel?: string;
    permissions?: string[];
  }
): Promise<any> {
  const response = await apiFetch(`/api/roles/${roleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roleData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update role' }));
    throw new Error(error.message || 'Failed to update role');
  }

  return (await response.json()).data;
}

/**
 * Delete a role
 */
export async function deleteProjectRole(roleId: string): Promise<void> {
  const response = await apiFetch(`/api/roles/${roleId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete role' }));
    throw new Error(error.message || 'Failed to delete role');
  }
}
