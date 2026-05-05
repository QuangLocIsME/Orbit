/**
 * ORBIT Socket.io client — singleton connection manager.
 *
 * Usage:
 *   import { getSocket, disconnectSocket } from '@/lib/socket';
 *   const socket = getSocket();               // connects (once) and returns socket
 *   socket.on('notification:new', handler);
 *   disconnectSocket();                       // call on logout
 */

import { io, type Socket } from 'socket.io-client';
import type { ProjectBlockScope } from '@/stores/projectBlockCacheStore';

// Server-emitted events (typed for intellisense)
export interface ServerToClientEvents {
  'cache:block:refresh': (data: { projectId: string; cacheKey?: string; scope: ProjectBlockScope; blockId: string; packageId?: string | null; updatedAt?: number }) => void;
  'cache:block:update': (data: { projectId: string; scope: ProjectBlockScope; blockId: string; data: unknown; updatedAt: number }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string }) => void;
  'user:avatar:updated': (data: { userId: string; avatar: string }) => void;
  'notification:new': (data: Notification) => void;
  'invite:new': (data: InviteNotification) => void;
  'invite:accepted': (data: { projectId: string; inviteId: string; acceptedBy: string }) => void;
  'invite:revoked': (data: { projectId: string; inviteId: string }) => void;
  'invite:declined': (data: { projectId: string; inviteId: string; declinedBy: string }) => void;
  'project:updated': (data: { projectId: string; changes: Record<string, unknown> }) => void;
  'project:created': (data: { project?: Record<string, unknown>; data?: Record<string, unknown> }) => void;
  'project:favorite-toggled': (data: { projectId: string; userId: string; isFavorite: boolean }) => void;
  'project:workflow-updated': (data: { projectId: string; workflowTemplateId?: string; workflow?: Record<string, unknown> }) => void;
  'project:trashed': (data: { projectId: string }) => void;
  'project:restored': (data: { projectId: string }) => void;
  'project:deleted': (data: { projectId: string }) => void;
  'cache:invalidate': (data: { data: { cacheTypes: string[]; userId: string } }) => void;
  'project:member:joined': (data: { projectId: string; userId: string; fullName: string }) => void;
  'project:member:left': (data: { projectId: string; userId: string }) => void;
  'project:member:role-updated': (data: { projectId: string; userId: string; role: string }) => void;
  'member:removed': (data: { projectId: string }) => void;
  'teams:changed': (data: { projectId: string; action: string; teamId?: string; userId?: string; team?: Record<string, unknown> }) => void;
  'roles:changed': (data: { projectId: string; action: string; roleId?: string }) => void;
  'disciplines:changed': (data: { projectId: string; action: string; disciplineId?: string }) => void;
  'share-links:changed': (data: { projectId: string; action: string; shareId?: string; packageId?: string }) => void;
  'workflow-template:changed': (data: { action: string; templateId?: string; sourceTemplateId?: string; authorId?: string; userId?: string; isPrivate?: boolean }) => void;
  'package:created': (data: { publicId: string; projectId: string; name: string; description: string; packageType: string; status: string; dueDate: string | null; creatorId: string; teamMemberIds: string[]; archivedAt: string | null; createdAt: string; updatedAt: string; actorId: string }) => void;
  'package:updated': (data: { packageId: string; projectId: string; changes: Record<string, unknown> }) => void;
  'package:archived': (data: { projectId: string; packageId: string }) => void;
  'package:unarchived': (data: { projectId: string; packageId: string }) => void;
  'package:deleted': (data: { projectId: string; packageId: string }) => void;
  'documents:refresh': (data: { projectId: string; packageId: string | null; action?: string; documentId?: string; versionGroupId?: string }) => void;
  'document:conversion-updated': (data: { projectId: string; packageId: string | null; documentId: string; versionId: string; status: string; conversionStatus: string; conversionError?: string; xktUrl?: string }) => void;
  'task:assigned': (data: { taskId: string; projectId: string; assignedTo: string; title: string }) => void;
  'task:completed': (data: { taskId: string; projectId: string; completedBy: string }) => void;
  'task:status-changed': (data: { projectId: string; packageId: string | null; taskId: string; status: string }) => void;
  'task:created': (data: { projectId: string; packageId: string | null; taskId: string }) => void;
  'task:updated': (data: { projectId: string; packageId: string | null; taskId: string; changes?: Record<string, unknown> }) => void;
  'task:deleted': (data: { projectId: string; packageId: string | null; taskId: string }) => void;
  'task:commented': (data: { projectId: string; packageId: string | null; taskId: string; commentId: string }) => void;
  'task:comment_updated': (data: { projectId: string; packageId: string | null; taskId: string; commentId: string }) => void;
  'task:comment_deleted': (data: { projectId: string; packageId: string | null; taskId: string; commentId: string }) => void;
  'package:task-count-changed': (data: { projectId: string; packageId: string; action: string; taskId?: string; status?: string }) => void;
  'approval:new': (data: { projectId: string; approvalId: string }) => void;
  'approval:updated': (data: { projectId: string; approvalId: string; status: string }) => void;
  'approval:deleted': (data: { projectId: string; approvalId: string; documentId?: string; status?: string }) => void;
  'approval:comment_added': (data: { projectId: string; approvalId: string; comment: { publicId: string; approvalId: string; content: string; author: { id: string; name: string; email: string; avatar: string | null } | null; createdAt: string; updatedAt: string } }) => void;
  'approval:comment_deleted': (data: { projectId: string; approvalId: string; commentId: string }) => void;
  'clash:updated': (data: { projectId: string }) => void;
  'cr:created': (data: { projectId: string; crId: string }) => void;
  'cr:updated': (data: { projectId: string; crId: string }) => void;
  'cr:status-changed': (data: { projectId: string; crId: string; status: string }) => void;
  'cr:deleted': (data: { projectId: string; crId: string }) => void;
  'cr:comment_added': (data: { projectId: string; crId: string; commentId?: string; comment?: { publicId: string; authorId: string; authorName: string; avatar?: string | null; content: string; createdAt: string; updatedAt?: string; isEdited?: boolean } }) => void;
  'cr:comment_updated': (data: { projectId: string; crId: string; commentId: string }) => void;
  'cr:comment_deleted': (data: { projectId: string; crId: string; commentId: string }) => void;
  'cr:version_created': (data: { projectId: string; crId: string; versionId: string; version?: Record<string, unknown> }) => void;
  'cr:version_updated': (data: { projectId: string; crId: string; versionId: string; status: string }) => void;
}

// Client-emitted events
export interface ClientToServerEvents {
  'project:join': (data: { projectId: string }) => void;
  'project:leave': (data: { projectId: string }) => void;
  'package:join': (data: { packageId: string }) => void;
  'package:leave': (data: { packageId: string }) => void;
  'ping': (cb: (data: { ts: number }) => void) => void;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  link?: string;
  inviteData?: InviteNotification;
  createdAt: string;
  read: boolean;
  seen: boolean;
}

export interface InviteNotification {
  inviteId: string;
  token?: string; // raw token — needed for accept endpoint
  projectId: string;
  projectName: string;
  projectAvatar?: string; // coverImageUrl from project
  role: string;
  inviterName: string;
  acceptUrl?: string;
  createdAt: string;
}

export type OrbitSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ── Singleton ─────────────────────────────────────────────────────────────────
let socket: OrbitSocket | null = null;
let rawEmit: ((event: string, ...args: any[]) => OrbitSocket) | null = null;
const projectRoomRefs = new Map<string, number>();
const packageRoomRefs = new Map<string, number>();

const BACKEND_WS_URL =
  (typeof import.meta !== 'undefined' && (import.meta.env?.PUBLIC_BACKEND_WS_URL as string | undefined)) ||
  'http://localhost:3000';

function incrementRoomRef(map: Map<string, number>, id: string): boolean {
  const next = (map.get(id) ?? 0) + 1;
  map.set(id, next);
  return next === 1;
}

function decrementRoomRef(map: Map<string, number>, id: string): boolean {
  const current = map.get(id) ?? 0;
  if (current <= 1) {
    map.delete(id);
    return true;
  }
  map.set(id, current - 1);
  return false;
}

function replayRoomSubscriptions(): void {
  if (!rawEmit) return;

  for (const projectId of projectRoomRefs.keys()) {
    rawEmit('project:join', { projectId });
  }

  for (const packageId of packageRoomRefs.keys()) {
    rawEmit('package:join', { packageId });
  }
}

/**
 * Get (or lazily create) the singleton socket connection.
 * Safe to call multiple times — returns the same socket.
 */
export function getSocket(): OrbitSocket {
  if (socket && socket.connected) return socket;

  if (socket) {
    // Re-connect if it was previously disconnected
    socket.connect();
    return socket;
  }

  const nextSocket = io(BACKEND_WS_URL, {
    // Cookies are sent automatically because of `withCredentials`
    withCredentials: true,
    transports: ['websocket', 'polling'],
    // Don't auto-connect — we call connect() manually after we know user is authed
    autoConnect: true,
  }) as OrbitSocket;

  const originalEmit = nextSocket.emit.bind(nextSocket) as ((event: string, ...args: any[]) => OrbitSocket);
  rawEmit = originalEmit;

  (nextSocket as any).emit = ((event: string, ...args: any[]) => {
    const payload = args[0];

    if (event === 'project:join') {
      const projectId = payload?.projectId;
      if (projectId && incrementRoomRef(projectRoomRefs, projectId)) {
        originalEmit(event, payload);
      }
      return nextSocket;
    }

    if (event === 'project:leave') {
      const projectId = payload?.projectId;
      if (projectId && decrementRoomRef(projectRoomRefs, projectId)) {
        originalEmit(event, payload);
      }
      return nextSocket;
    }

    if (event === 'package:join') {
      const packageId = payload?.packageId;
      if (packageId && incrementRoomRef(packageRoomRefs, packageId)) {
        originalEmit(event, payload);
      }
      return nextSocket;
    }

    if (event === 'package:leave') {
      const packageId = payload?.packageId;
      if (packageId && decrementRoomRef(packageRoomRefs, packageId)) {
        originalEmit(event, payload);
      }
      return nextSocket;
    }

    return originalEmit(event, ...args);
  }) as OrbitSocket['emit'];

  socket = nextSocket;

  socket.on('connect', () => {
    replayRoomSubscriptions();
    console.debug('[WS] Connected', socket?.id);
  });

  socket.on('connect_error', (err) => {
    if (err.message === 'NO_TOKEN' || err.message === 'INVALID_TOKEN') {
      console.debug('[WS] Not authenticated — socket disabled');
      socket?.disconnect();
    } else {
      console.warn('[WS] Connection error:', err.message);
    }
  });

  socket.on('disconnect', (reason) => {
    console.debug('[WS] Disconnected:', reason);
  });

  return socket;
}

/**
 * Disconnect and destroy the singleton (call on logout).
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  rawEmit = null;
  projectRoomRefs.clear();
  packageRoomRefs.clear();
}

/**
 * Join a project room to receive project-scoped events.
 */
export function joinProject(projectId: string): void {
  getSocket().emit('project:join', { projectId });
}

/**
 * Leave a project room.
 */
export function leaveProject(projectId: string): void {
  getSocket().emit('project:leave', { projectId });
}

/**
 * Join a package room.
 */
export function joinPackage(packageId: string): void {
  getSocket().emit('package:join', { packageId });
}

/**
 * Leave a package room.
 */
export function leavePackage(packageId: string): void {
  getSocket().emit('package:leave', { packageId });
}

/**
 * Measure round-trip latency (ms).
 */
export function measureLatency(): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    getSocket().emit('ping', () => {
      resolve(Date.now() - start);
    });
  });
}
