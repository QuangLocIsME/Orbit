'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface ProjectMemberRow {
  projectId: string;
  userId: string;
  role: string;
  status: string;
  invitedBy: string | null;
  createdAt: string;
  fullName: string | null;
  email: string | null;
  avatar: string | null;
  user?: {
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null;
}

async function fetchProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const response = await apiFetch('/api/projects/member-list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ projectId }),
  });
  if (!response.ok) return [];
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row: ProjectMemberRow) => ({
    ...row,
    // Some API responses nest profile fields under `user`.
    fullName: row.fullName ?? row.user?.fullName ?? row.user?.name ?? null,
    email: row.email ?? row.user?.email ?? null,
    avatar: row.avatar ?? row.user?.avatar ?? null,
  }));
}

export function memberLabel(member: ProjectMemberRow): string {
  const name = member.fullName?.trim();
  if (name) return name;
  const email = member.email?.trim();
  if (email) return email;
  return 'Unknown member';
}

export function useProjectMembers(projectId: string | undefined | null) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => fetchProjectMembers(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
