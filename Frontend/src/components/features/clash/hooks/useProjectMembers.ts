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
  return Array.isArray(payload?.data) ? payload.data : [];
}

export function memberLabel(member: ProjectMemberRow): string {
  const name = member.fullName?.trim();
  if (name) return name;
  const email = member.email?.trim();
  if (email) return email;
  return member.userId;
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
