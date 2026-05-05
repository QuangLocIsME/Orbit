import { invalidateRoute } from '@/lib/sw-utils';
import {
  clearProjectTabCache,
  type CacheScope,
} from '@/stores/projectDetailCacheStore';

export const PROJECT_TAB_INVALIDATED_EVENT = 'orbit:project-tab-cache-invalidated';

export type ProjectTabInvalidationSource =
  | 'invite:project-created'
  | 'invite:accepted'
  | 'invite:revoked'
  | 'invite:declined'
  | 'documents:refresh'
  | 'document:conversion-updated'
  | 'package:created'
  | 'package:updated'
  | 'package:archived'
  | 'package:unarchived'
  | 'package:deleted'
  | 'approval:new'
  | 'approval:updated'
  | 'approval:deleted'
  | 'approval:comment_added'
  | 'approval:comment_deleted'
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
  | 'package:task-count-changed'
  | 'project:updated'
  | 'project:workflow-updated'
  | 'project:member:joined'
  | 'project:member:left'
  | 'project:member:role-updated'
  | 'member:removed'
  | 'teams:changed'
  | 'roles:changed'
  | 'disciplines:changed'
  | 'clash:updated';

export interface ProjectTabInvalidationDetail {
  projectId: string;
  scopes: CacheScope[];
  source: ProjectTabInvalidationSource | string;
  payload?: unknown;
  at: number;
}

export const PROJECT_TAB_EVENT_SCOPES: Record<ProjectTabInvalidationSource, CacheScope[]> = {
  'invite:project-created': ['teams'],
  'invite:accepted': ['teams'],
  'invite:revoked': ['teams'],
  'invite:declined': ['teams'],
  'documents:refresh': ['documents', 'changes', 'tasks', 'activity'],
  'document:conversion-updated': ['documents', 'versions', 'activity'],
  'package:created': ['packages', 'documents', 'activity'],
  'package:updated': ['packages', 'documents', 'activity'],
  'package:archived': ['packages', 'documents', 'activity'],
  'package:unarchived': ['packages', 'documents', 'activity'],
  'package:deleted': ['packages', 'documents', 'activity'],
  'approval:new': ['versions', 'activity'],
  'approval:updated': ['versions', 'documents', 'activity'],
  'approval:deleted': ['versions', 'activity'],
  'approval:comment_added': ['versions'],
  'approval:comment_deleted': ['versions'],
  'cr:created': ['changes', 'tasks', 'versions', 'activity'],
  'cr:updated': ['changes', 'tasks', 'versions', 'activity'],
  'cr:status-changed': ['changes', 'tasks', 'versions', 'activity'],
  'cr:deleted': ['changes', 'tasks', 'versions', 'activity'],
  'cr:comment_added': ['changes', 'tasks'],
  'cr:comment_updated': ['changes', 'tasks'],
  'cr:comment_deleted': ['changes', 'tasks'],
  'cr:version_created': ['changes', 'versions', 'documents', 'activity'],
  'cr:version_updated': ['changes', 'versions', 'documents', 'activity'],
  'task:created': ['tasks', 'changes', 'activity'],
  'task:updated': ['tasks', 'changes', 'activity'],
  'task:deleted': ['tasks', 'changes', 'activity'],
  'task:status-changed': ['tasks', 'activity'],
  'task:commented': ['tasks'],
  'task:comment_updated': ['tasks'],
  'task:comment_deleted': ['tasks'],
  'package:task-count-changed': ['tasks', 'packages', 'activity'],
  'project:updated': ['changes', 'tasks', 'teams', 'activity'],
  'project:workflow-updated': ['changes', 'tasks', 'activity'],
  'project:member:joined': ['teams', 'packages', 'changes', 'tasks', 'activity'],
  'project:member:left': ['teams', 'packages', 'changes', 'tasks', 'activity'],
  'project:member:role-updated': ['teams', 'changes', 'tasks', 'activity'],
  'member:removed': ['teams', 'activity'],
  'teams:changed': ['teams', 'packages', 'changes', 'tasks', 'activity'],
  'roles:changed': ['teams', 'settings'],
  'disciplines:changed': ['changes', 'activity'],
  'clash:updated': ['clashes', 'activity'],
};

function uniqueScopes(scopes: CacheScope[]): CacheScope[] {
  return Array.from(new Set(scopes));
}

function invalidateKnownSwRoutes(projectId: string, scopes: CacheScope[]): void {
  if (projectId.includes(':package:')) return;

  if (scopes.includes('changes')) {
    invalidateRoute(`/api/projects/${projectId}/change-requests`);
  }

  if (scopes.includes('activity')) {
    invalidateRoute(`/api/projects/${projectId}/activities`);
  }
}

export function invalidateProjectTabScopes(
  projectId: string,
  scopes: CacheScope[],
  source: ProjectTabInvalidationSource | string,
  payload?: unknown
): void {
  if (!projectId || scopes.length === 0) return;

  const nextScopes = uniqueScopes(scopes);
  nextScopes.forEach((scope) => clearProjectTabCache(projectId, scope));
  invalidateKnownSwRoutes(projectId, nextScopes);

  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent<ProjectTabInvalidationDetail>(
    PROJECT_TAB_INVALIDATED_EVENT,
    {
      detail: {
        projectId,
        scopes: nextScopes,
        source,
        payload,
        at: Date.now(),
      },
    }
  ));
}

export function invalidateProjectTabsForSocketEvent(
  projectId: string,
  source: ProjectTabInvalidationSource,
  payload?: unknown
): void {
  const scopes = PROJECT_TAB_EVENT_SCOPES[source] || [];
  invalidateProjectTabScopes(projectId, scopes, source, payload);

  const packageId =
    typeof payload === 'object' && payload !== null && 'packageId' in payload
      ? String((payload as { packageId?: string | null }).packageId || '')
      : '';

  if (packageId) {
    invalidateProjectTabScopes(`${projectId}:package:${packageId}`, scopes, source, payload);
  }
}

export function onProjectTabInvalidated(
  projectId: string,
  scopes: CacheScope[],
  handler: (detail: ProjectTabInvalidationDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const wantedScopes = new Set(scopes);
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ProjectTabInvalidationDetail>).detail;
    if (!detail || detail.projectId !== projectId) return;
    if (!detail.scopes.some((scope) => wantedScopes.has(scope))) return;
    handler(detail);
  };

  window.addEventListener(PROJECT_TAB_INVALIDATED_EVENT, listener);
  return () => window.removeEventListener(PROJECT_TAB_INVALIDATED_EVENT, listener);
}
