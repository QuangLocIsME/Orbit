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

// Server-emitted events (typed for intellisense)
export interface ServerToClientEvents {
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string }) => void;
  'user:avatar:updated': (data: { userId: string; avatar: string }) => void;
  'notification:new': (data: Notification) => void;
  'invite:new': (data: InviteNotification) => void;
  'invite:accepted': (data: { projectId: string; inviteId: string; acceptedBy: string }) => void;
  'invite:revoked': (data: { projectId: string; inviteId: string }) => void;
  'invite:declined': (data: { projectId: string; inviteId: string; declinedBy: string }) => void;
  'project:updated': (data: { projectId: string; changes: Record<string, unknown> }) => void;
  'project:member:joined': (data: { projectId: string; userId: string; fullName: string }) => void;
  'project:member:left': (data: { projectId: string; userId: string }) => void;
  'project:member:role-updated': (data: { projectId: string; userId: string; role: string }) => void;
  'member:removed': (data: { projectId: string }) => void;
  'package:updated': (data: { packageId: string; projectId: string; changes: Record<string, unknown> }) => void;
  'package:archived': (data: { projectId: string; packageId: string }) => void;
  'package:unarchived': (data: { projectId: string; packageId: string }) => void;
  'documents:refresh': (data: { projectId: string; packageId: string }) => void;
  'task:assigned': (data: { taskId: string; projectId: string; assignedTo: string; title: string }) => void;
  'task:completed': (data: { taskId: string; projectId: string; completedBy: string }) => void;
  'task:status-changed': (data: { projectId: string; packageId: string | null; taskId: string; status: string }) => void;
  'task:created': (data: { projectId: string; packageId: string | null; taskId: string }) => void;
  'task:deleted': (data: { projectId: string; packageId: string | null; taskId: string }) => void;
  'task:commented': (data: { projectId: string; packageId: string | null; taskId: string; commentId: string }) => void;
  'package:task-count-changed': (data: { projectId: string; packageId: string; action: string; taskId?: string; status?: string }) => void;
  'approval:new': (data: { projectId: string; approvalId: string }) => void;
  'approval:updated': (data: { projectId: string; approvalId: string; status: string }) => void;
  'approval:deleted': (data: { projectId: string; approvalId: string }) => void;
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

const BACKEND_WS_URL =
  (typeof import.meta !== 'undefined' && (import.meta.env?.PUBLIC_BACKEND_WS_URL as string | undefined)) ||
  'http://localhost:3000';

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

  socket = io(BACKEND_WS_URL, {
    // Cookies are sent automatically because of `withCredentials`
    withCredentials: true,
    transports: ['websocket', 'polling'],
    // Don't auto-connect — we call connect() manually after we know user is authed
    autoConnect: true,
  }) as OrbitSocket;

  socket.on('connect', () => {
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
