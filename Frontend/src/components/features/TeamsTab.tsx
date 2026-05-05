'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { useAppStore } from '@/stores/appStore';
import { toast } from '@/components/ui/sonner';
import AddMemberModal, { type TeamOption } from './AddMemberModal';
import { getProjectTabCache, setProjectTabCache } from '@/stores/projectDetailCacheStore';
import { fetchProjectBlock, initProjectBlockRealtime, onProjectBlockUpdated } from '@/lib/project-block-realtime';

type MemberRole = 'admin' | 'owner' | 'member' | 'viewer';
type MemberStatus = 'invited' | 'accepted' | 'blocked';
type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

interface MemberUser {
  fullName: string;
  email: string;
  avatar?: string | null;
}

interface MemberWithUser {
  publicId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  invitedBy?: string;
  createdAt: string;
  user?: MemberUser;
}

interface PendingInvite {
  publicId: string;
  projectId: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

const inviteStatusStyles: Record<InviteStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-[#FEF9C3]', text: 'text-[#A16207]', label: 'Pending' },
  accepted: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Accepted' },
  revoked: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', label: 'Revoked' },
  expired: { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', label: 'Expired' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(email: string): string {
  const colors = [
    'bg-[#EC4899]', 'bg-[#14B8A6]', 'bg-[#3B82F6]',
    'bg-[#8B5CF6]', 'bg-[#6B7280]', 'bg-[#10B981]',
    'bg-[#F59E0B]', 'bg-[#F97316]',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) % colors.length;
  }
  return colors[Math.abs(hash)];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface Role {
  id: string;
  name: string;
  color: string;
  roleKey: string;
}

interface RoleEditModalProps {
  isOpen: boolean;
  member: MemberWithUser | null;
  onClose: () => void;
  onConfirm: (memberId: string, newRole: MemberRole) => Promise<void>;
  roles: Role[];
  canManage: boolean;
}

function RoleEditModal({ isOpen, member, onClose, onConfirm, roles, canManage }: RoleEditModalProps) {
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) setSelectedRole(member.role);
  }, [member]);

  if (!isOpen || !member) return null;

  // Owner cannot be edited, admin can only be edited by owner
  const canEditThisMember = member.role !== 'owner' && (member.role === 'admin' ? canManage : true);

  // Filter roles: exclude owner, exclude admin if can't manage
  const availableRoles = roles.filter(r => {
    if (r.roleKey === 'owner') return false;
    if (r.roleKey === 'admin' && !canEditThisMember) return false;
    return true;
  });

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(member.userId, selectedRole);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-[420px] bg-white rounded-[14px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-[18px] font-normal text-[#101828]">Change Role</h2>
          <button onClick={onClose} className="ml-auto rounded-[10px] p-2 hover:bg-gray-100">
            <svg className="h-5 w-5 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-[14px] text-[#4A5565]">
            Update role for <span className="font-medium text-[#101828]">{member.user?.fullName ?? member.email}</span>
          </p>
          {availableRoles.map((role) => (
            <button
              key={role.roleKey}
              onClick={() => setSelectedRole(role.roleKey as MemberRole)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[10px] border-2 p-4 text-left transition-colors",
                selectedRole === role.roleKey ? "border-[#2B7FFF] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:border-[#D1D5DC]"
              )}
            >
              <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center",
                selectedRole === role.roleKey ? "border-[#2B7FFF]" : "border-[#D1D5DC]")}>
                {selectedRole === role.roleKey && <div className="h-2 w-2 rounded-full bg-[#2B7FFF]" />}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-white"
                  style={{ backgroundColor: role.color }}
                >
                  {role.name}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]">
          <button onClick={onClose} className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={saving || selectedRole === member.role}
            className="px-4 py-2 rounded-[10px] bg-[#2B7FFF] text-[14px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Team extends TeamOption {
  memberIds: string[];
}

interface TeamsRosterBlock {
  members: MemberWithUser[];
  invites: PendingInvite[];
  roles: Role[];
  teams: Team[];
}

const TEAM_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500',
  'bg-teal-500', 'bg-pink-500', 'bg-indigo-500', 'bg-amber-500',
];

interface TeamsTabProps {
  projectPublicId: string;
  currentUserRole?: MemberRole;
}

export default function TeamsTab({ projectPublicId, currentUserRole: initialRole }: TeamsTabProps) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<MemberRole>(initialRole ?? 'member');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'members' | 'teams' | 'invites'>('members');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [addMemberToTeamId, setAddMemberToTeamId] = useState<string | null>(null);
  const [roleEditMember, setRoleEditMember] = useState<MemberWithUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberWithUser | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PendingInvite | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // Pending team assignments: when an invite is sent with team IDs, store by email so we can
  // apply them once the member accepts and appears in the members list.
  const [pendingTeamAssignments, setPendingTeamAssignments] = useState<{ email: string; teamIds: string[] }[]>([]);

  const fetchTeamsRef = useRef<() => Promise<void>>(async () => {});
  const socket = useAppStore((s) => s.socket);

  // Always sync role from Zustand store (most up-to-date source of truth for the user's project role)
  const projects = useAppStore((s) => s.projects);
  const currentProjectName = projects.find((p) => String(p.publicId) === projectPublicId)?.name;
  useEffect(() => {
    const project = projects.find((p) => String(p.publicId) === projectPublicId);
    if (project?.role) setCurrentUserRole(project.role as MemberRole);
  }, [projects, projectPublicId]);

  const canManage = currentUserRole === 'admin' || currentUserRole === 'owner';
  const canEditRole = (memberRole: MemberRole) => {
    if (memberRole === 'owner') return false;
    if (memberRole === 'admin') return currentUserRole === 'owner';
    return canManage;
  };
  const canRemove = (memberRole: MemberRole) => {
    if (memberRole === 'owner') return false;
    if (memberRole === 'admin') return currentUserRole === 'owner'; // Only owner can remove admin
    return canManage;
  };

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiFetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setRoles(Array.isArray(data?.data) ? data.data : []);
    } catch { /* network error */ }
  }, [projectPublicId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/projects/member-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const fetched: MemberWithUser[] = Array.isArray(data?.data) ? data.data : [];
      setMembers(fetched);
      // Apply any pending team assignments via API once the invited member appears
      setPendingTeamAssignments((pending) => {
        if (pending.length === 0) return pending;
        const remaining = pending.filter(({ email, teamIds }) => {
          const match = fetched.find((m) => m.user?.email === email);
          if (match) {
            Promise.all(teamIds.map((teamId) =>
              apiFetch('/api/teams/members/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId, userId: match.userId }),
              })
            )).then(() => fetchTeamsRef.current()).catch(() => {});
            return false;
          }
          return true;
        });
        return remaining;
      });
    } catch { /* network error — leave stale data */ }
  }, [projectPublicId]);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/invites/invites-list?projectId=${encodeURIComponent(projectPublicId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setPendingInvites(Array.isArray(data?.data) ? data.data : []);
    } catch { /* network error */ }
  }, [projectPublicId]);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiFetch('/api/teams/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setTeams(Array.isArray(data?.data) ? data.data : []);
    } catch { /* network error */ }
  }, [projectPublicId]);
  // Keep ref in sync so fetchMembers can call fetchTeams without circular deps
  fetchTeamsRef.current = fetchTeams;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMembers(), fetchInvites(), fetchTeams(), fetchRoles()]);
    setLoading(false);
  }, [fetchMembers, fetchInvites, fetchRoles, fetchTeams]);

  // Helper: get role info by roleKey
  const getRoleInfo = (roleKey: string): { name: string; color: string } => {
    const role = roles.find(r => r.roleKey === roleKey);
    return role ? { name: role.name, color: role.color } : { name: roleKey, color: '#6B7280' };
  };

  useEffect(() => {
    initProjectBlockRealtime();
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchProjectBlock<TeamsRosterBlock>(projectPublicId, 'teams', 'roster').then((block) => {
      if (cancelled || !block) return;
      setMembers(block.members || []);
      setPendingInvites(block.invites || []);
      setRoles(block.roles || []);
      setTeams(block.teams || []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [projectPublicId]);

  useEffect(() => {
    return onProjectBlockUpdated<TeamsRosterBlock>(projectPublicId, 'teams', 'roster', ({ data }) => {
      if (!data) return;
      setMembers(data.members || []);
      setPendingInvites(data.invites || []);
      setRoles(data.roles || []);
      setTeams(data.teams || []);
      setLoading(false);
    });
  }, [projectPublicId]);

  useEffect(() => {
    const cached = getProjectTabCache<{
      members?: MemberWithUser[];
      pendingInvites?: PendingInvite[];
      roles?: Role[];
      teams?: Team[];
      currentUserRole?: MemberRole;
    }>(projectPublicId, 'teams');

    if (cached?.data) {
      if (cached.data.members) setMembers(cached.data.members);
      if (cached.data.pendingInvites) setPendingInvites(cached.data.pendingInvites);
      if (cached.data.roles) setRoles(cached.data.roles);
      if (cached.data.teams) setTeams(cached.data.teams);
      if (cached.data.currentUserRole) setCurrentUserRole(cached.data.currentUserRole);
      setLoading(false);
      fetchAll().catch(() => {});
      return;
    }

    fetchAll();
  }, [fetchAll, projectPublicId]);

  useEffect(() => {
    setProjectTabCache(projectPublicId, 'teams', {
      members,
      pendingInvites,
      roles,
      teams,
      currentUserRole,
    });
  }, [currentUserRole, members, pendingInvites, projectPublicId, roles, teams]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('project:join', { projectId: projectPublicId });

    const isThisProject = (payload?: { projectId?: string }) => payload?.projectId === projectPublicId;
    const handleInviteNew = (payload?: { projectId?: string }) => { if (isThisProject(payload)) fetchInvites(); };
    const handleProjectInviteCreated = (payload?: { projectId?: string }) => { if (isThisProject(payload)) fetchInvites(); };
    const handleInviteAccepted = (payload?: { projectId?: string }) => { if (isThisProject(payload)) { fetchMembers(); fetchInvites(); fetchTeams(); fetchRoles(); } };
    const handleInviteRevoked = (payload?: { projectId?: string }) => { if (isThisProject(payload)) fetchInvites(); };
    const handleMemberChanged = (payload?: { projectId?: string }) => { if (isThisProject(payload)) { fetchMembers(); fetchTeams(); fetchRoles(); } };
    const handleTeamsChanged = (payload?: { projectId?: string }) => { if (isThisProject(payload)) fetchTeams(); };
    const handleRolesChanged = (payload?: { projectId?: string }) => { if (isThisProject(payload)) fetchRoles(); };

    socket.on('invite:new', handleInviteNew);
    socket.on('invite:project-created', handleProjectInviteCreated);
    socket.on('invite:accepted', handleInviteAccepted);
    socket.on('invite:revoked', handleInviteRevoked);
    socket.on('project:member:joined', handleMemberChanged);
    socket.on('project:member:left', handleMemberChanged);
    socket.on('project:member:role-updated', handleMemberChanged);
    socket.on('member:removed', handleMemberChanged);
    socket.on('teams:changed', handleTeamsChanged);
    socket.on('roles:changed', handleRolesChanged);

    return () => {
      socket.off('invite:new', handleInviteNew);
      socket.off('invite:project-created', handleProjectInviteCreated);
      socket.off('invite:accepted', handleInviteAccepted);
      socket.off('invite:revoked', handleInviteRevoked);
      socket.off('project:member:joined', handleMemberChanged);
      socket.off('project:member:left', handleMemberChanged);
      socket.off('project:member:role-updated', handleMemberChanged);
      socket.off('member:removed', handleMemberChanged);
      socket.off('teams:changed', handleTeamsChanged);
      socket.off('roles:changed', handleRolesChanged);
      socket.emit('project:leave', { projectId: projectPublicId });
    };
  }, [socket, projectPublicId, fetchMembers, fetchInvites, fetchTeams, fetchRoles]);

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/projects/members/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId, targetUserId: userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to update role');
        return;
      }
      toast.success('Role updated');
      setMembers((prev) =>
        prev.map((m) => m.userId === userId ? { ...m, role: newRole } : m)
      );
    } catch {
      toast.error('Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/projects/members/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId, userId: removeTarget.userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to remove member');
        return;
      }
      toast.success(`${removeTarget.user?.fullName ?? 'Member'} removed`);
      setMembers((prev) => prev.filter((m) => m.userId !== removeTarget.userId));
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setActionLoading(false);
      setRemoveTarget(null);
    }
  };

  const handleRevokeInvite = async () => {
    if (!revokeTarget) return;
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/invites/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: revokeTarget.publicId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to revoke invite');
        return;
      }
      toast.success('Invite revoked');
      setPendingInvites((prev) => prev.filter((i) => i.publicId !== revokeTarget.publicId));
    } catch {
      toast.error('Failed to revoke invite');
    } finally {
      setActionLoading(false);
      setRevokeTarget(null);
    }
  };

  const filteredMembers = members
    .filter((m) => {
      const q = searchQuery.toLowerCase();
      return (
        (m.user?.fullName ?? '').toLowerCase().includes(q) ||
        (m.user?.email ?? '').toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      return 0;
    });

  const filteredInvites = pendingInvites.filter((i) =>
    searchQuery === '' ||
    i.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showSkeleton = loading;

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[24px] font-normal text-[#101828]">Team</h2>
        </div>
        {canManage && (
          <button
            onClick={() => activeView === 'teams' ? setIsCreateTeamOpen(true) : setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#155DFC] h-10 w-[136px] text-[14px] font-normal text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="inline-block min-w-[80px] text-left whitespace-nowrap">{activeView === 'teams' ? 'Add Team' : 'Add Member'}</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="relative w-[331px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2 pl-10 pr-4 text-[14px] placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex items-center rounded-[10px] border border-[#E5E7EB] bg-white p-1">
            <button
              onClick={() => setActiveView('members')}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-[14px] transition-colors",
                activeView === 'members'
                  ? "bg-[#F3F4F6] text-[#101828] font-medium"
                  : "text-[#4A5565] hover:text-[#101828]"
              )}
            >
              <span>Members</span>
              <span className="text-[12px] text-[#6A7282]">({members.length})</span>
            </button>
            <button
              onClick={() => setActiveView('teams')}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-[14px] transition-colors",
                activeView === 'teams'
                  ? "bg-[#F3F4F6] text-[#101828] font-medium"
                  : "text-[#4A5565] hover:text-[#101828]"
              )}
            >
              <span>Teams</span>
              <span className="text-[12px] text-[#6A7282]">({teams.length})</span>
            </button>
            {canManage && (
              <button
                onClick={() => setActiveView('invites')}
                className={cn(
                  "flex items-center gap-1 px-4 py-2 rounded-lg text-[14px] transition-colors",
                  activeView === 'invites'
                    ? "bg-[#F3F4F6] text-[#101828] font-medium"
                    : "text-[#4A5565] hover:text-[#101828]"
                )}
              >
                <span>Invites</span>
                <span className="text-[12px] text-[#6A7282]">({pendingInvites.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center rounded-[10px] border border-[#E5E7EB] bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn("p-1.5 rounded transition-colors", viewMode === 'grid' ? "bg-[#F3F4F6]" : "hover:bg-gray-50")}
              >
                <svg className="h-4 w-4 text-[#4A5565]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn("p-1.5 rounded transition-colors", viewMode === 'list' ? "bg-[#F3F4F6]" : "hover:bg-gray-50")}
              >
                <svg className="h-4 w-4 text-[#4A5565]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
        </div>
      </div>

      {/* Content */}
      {activeView === 'members' ? (
        showSkeleton ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-[#E5E7EB] bg-white p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-gray-200" />
                  <div className="flex-1"><div className="h-4 bg-gray-200 rounded w-24 mb-2" /><div className="h-3 bg-gray-100 rounded w-32" /></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-40 mb-3" />
                <div className="h-5 bg-gray-100 rounded w-16 mb-4" />
                <div className="flex gap-4 pt-3 border-t border-[#F3F4F6]"><div className="h-3 bg-gray-100 rounded w-16" /><div className="h-3 bg-gray-100 rounded w-12" /></div>
              </div>
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-[16px] font-medium text-[#101828] mb-1">No members yet</p>
            <p className="text-[14px] text-[#6A7282]">
              {canManage ? 'Invite team members to get started' : 'You will see team members once they join'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {filteredMembers.map((member) => {
              const name = member.user?.fullName ?? member.email ?? 'Unknown';
              const email = member.user?.email ?? '';
              const color = getAvatarColor(email);
              const roleInfo = getRoleInfo(member.role);
              const memberTeams = teams.filter((t) => t.memberIds.includes(member.userId));
              return (
                <div key={member.userId} className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    {member.user?.avatar ? (
                      <img src={member.user.avatar} alt={name} className="h-12 w-12 rounded-full object-cover flex items-center justify-center text-white font-medium text-[14px]" style={{ backgroundColor: color }} />
                    ) : (
                      <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-medium text-[14px]", color)}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-medium text-[#101828] truncate">{name}</h3>
                      <p className="text-[12px] text-[#6A7282]">{roleInfo.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-4 w-4 text-[#99A1AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span className="text-[12px] text-[#4A5565] truncate">{email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-4 w-4 rounded-full border-2 border-[#E5E7EB]" />
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-white"
                      style={{ backgroundColor: roleInfo.color }}
                    >
                      {roleInfo.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                    <span className="text-[12px] text-[#6A7282]">Joined {formatDate(member.createdAt)}</span>
                    {memberTeams.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        {memberTeams.map((t) => (
                          <span
                            key={t.id}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[11px] font-medium text-white truncate max-w-[120px]",
                              t.color
                            )}
                            title={t.name}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {canManage && (
                      <div className="flex items-center gap-1">
                        {canEditRole(member.role) && (
                          <button
                            onClick={() => setRoleEditMember(member)}
                            className="p-1 text-[#99A1AF] hover:text-[#4A5565]"
                            title="Edit role"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        )}
                        {canRemove(member.role) && (
                          <button
                            onClick={() => setRemoveTarget(member)}
                            className="p-1 text-[#99A1AF] hover:text-red-500"
                            title="Remove member"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.5fr] gap-4 px-6 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]">
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Member</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Role</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Permission</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Joined</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Actions</span>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {filteredMembers.map((member) => {
                const name = member.user?.fullName ?? member.email ?? 'Unknown';
                const email = member.user?.email ?? '';
                const color = getAvatarColor(email);
                const roleInfo = getRoleInfo(member.role);
                return (
                  <div key={member.userId} className="grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.5fr] gap-4 px-6 py-4 items-center hover:bg-[#FAFAFA] transition-colors">
                      <div className="flex items-center gap-3">
                        {member.user?.avatar ? (
                          <img src={member.user.avatar} alt={name} className="h-10 w-10 rounded-full object-cover flex items-center justify-center text-white text-[13px] font-medium" style={{ backgroundColor: color }} />
                        ) : (
                          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-[13px] font-medium", color)}>
                            {getInitials(name)}
                          </div>
                        )}
                      <div>
                        <p className="text-[14px] font-medium text-[#101828]">{name}</p>
                        <p className="text-[12px] text-[#6A7282]">{email || '—'}</p>
                      </div>
                    </div>
                    <span className="text-[14px] text-[#364153]">{roleInfo.name}</span>
                    <span
                      className="px-2.5 py-1 rounded text-[12px] font-medium text-white w-fit"
                      style={{ backgroundColor: roleInfo.color }}
                    >
                      {roleInfo.name}
                    </span>
                    <span className="text-[13px] text-[#4A5565]">{formatDate(member.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      {canEditRole(member.role) && (
                        <button onClick={() => setRoleEditMember(member)} className="p-1 text-[#99A1AF] hover:text-[#4A5565]">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                      )}
                      {canRemove(member.role) && (
                        <button onClick={() => setRemoveTarget(member)} className="p-1 text-[#99A1AF] hover:text-red-500">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : activeView === 'teams' ? (
        /* Teams tab */
        <div className="space-y-4">
          {teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <p className="text-[16px] font-medium text-[#101828] mb-1">No teams yet</p>
              <p className="text-[14px] text-[#6A7282]">
                {canManage ? 'Create a team to group members by discipline or role' : 'Teams will appear here once created by an admin'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4">
              {teams.map((team) => {
                const teamMembers = members.filter((m) => team.memberIds.includes(m.userId));
                return (
                  <div key={team.id} className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
                    {/* Team Header */}
                    <div className="flex items-start gap-3 p-4 border-b border-[#F3F4F6]">
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", team.color)}>
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-medium text-[#101828] truncate">{team.name}</h3>
                        <p className="text-[12px] text-[#6A7282] truncate">{team.description}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete team "${team.name}"?`)) return;
                            try {
                              const r = await apiFetch('/api/teams/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: team.id }) });
                              const d = await r.json();
                              if (!r.ok) { toast.error(d.message || 'Failed to delete team'); return; }
                              toast.success(`Team "${team.name}" deleted`);
                              setTeams((prev) => prev.filter((t) => t.id !== team.id));
                            } catch { toast.error('Failed to delete team'); }
                          }}
                          className="p-1 text-[#99A1AF] hover:text-red-500 transition-colors flex-shrink-0"
                          title="Delete team"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Members count */}
                    <div className="px-4 py-2 bg-[#FAFAFA] border-b border-[#F3F4F6]">
                      <span className="text-[12px] font-medium text-[#6A7282]">{teamMembers.length} Member{teamMembers.length !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Member list */}
                    <div className="divide-y divide-[#F3F4F6]">
                      {teamMembers.map((m) => {
                        const name = m.user?.fullName ?? m.user?.email ?? 'Unknown';
                        const email = m.user?.email ?? '';
                        const color = getAvatarColor(email);
                        return (
                          <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                            {m.user?.avatar ? (
                              <img src={m.user.avatar} alt={name} className="h-8 w-8 rounded-full object-cover flex items-center justify-center text-white text-[12px] font-medium flex-shrink-0" style={{ backgroundColor: color }} />
                            ) : (
                              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-[12px] font-medium flex-shrink-0", color)}>
                                {getInitials(name)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-[#101828] truncate">{name}</p>
                              <p className="text-[11px] text-[#6A7282] truncate capitalize">{m.role}</p>
                            </div>
                            {canManage && (
                              <button
                                onClick={async () => {
                                  try {
                                    const r = await apiFetch('/api/teams/members/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: team.id, userId: m.userId }) });
                                    const d = await r.json();
                                    if (!r.ok) { toast.error(d.message || 'Failed to remove member'); return; }
                                    setTeams((prev) => prev.map((t) =>
                                      t.id === team.id ? { ...t, memberIds: t.memberIds.filter((id) => id !== m.userId) } : t
                                    ));
                                  } catch { toast.error('Failed to remove member'); }
                                }}
                                className="p-1 text-[#99A1AF] hover:text-red-500 transition-colors flex-shrink-0"
                                title="Remove from team"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Add member to team */}
                    {canManage && (
                      <div className="px-4 py-3 border-t border-[#F3F4F6]">
                        {addMemberToTeamId === team.id ? (
                          <div className="space-y-2">
                            <select
                              className="w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-[#2B7FFF] focus:outline-none"
                              defaultValue=""
                              onChange={async (e) => {
                                const userId = e.target.value;
                                if (!userId) return;
                                try {
                                  const r = await apiFetch('/api/teams/members/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: team.id, userId }) });
                                  const d = await r.json();
                                  if (!r.ok) { toast.error(d.message || 'Failed to add member'); return; }
                                  setTeams((prev) => prev.map((t) =>
                                    t.id === team.id && !t.memberIds.includes(userId)
                                      ? { ...t, memberIds: [...t.memberIds, userId] }
                                      : t
                                  ));
                                } catch { toast.error('Failed to add member'); }
                                setAddMemberToTeamId(null);
                              }}
                            >
                              <option value="" disabled>Select a member…</option>
                              {members
                                .filter((m) => !team.memberIds.includes(m.userId))
                                .map((m) => (
                                  <option key={m.userId} value={m.userId}>
                                    {m.user?.fullName ?? m.user?.email ?? m.userId}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => setAddMemberToTeamId(null)}
                              className="text-[12px] text-[#6A7282] hover:text-[#101828]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddMemberToTeamId(team.id)}
                            className="flex items-center gap-2 text-[13px] text-[#6A7282] hover:text-[#2B7FFF] transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add Member
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => {
                const teamMembers = members.filter((m) => team.memberIds.includes(m.userId));
                return (
                  <div key={team.id} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", team.color)}>
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[#101828]">{team.name}</p>
                        <p className="truncate text-[12px] text-[#6A7282]">{team.description || 'No description'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] text-[#6A7282]">Members</p>
                        <p className="text-[14px] font-medium text-[#101828]">{teamMembers.length}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => setAddMemberToTeamId(team.id)}
                          className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] text-[#4A5565] hover:border-[#D1D5DC]"
                        >
                          Add member
                        </button>
                      )}
                    </div>
                    {canManage && addMemberToTeamId === team.id && (
                      <div className="mt-3 space-y-2 border-t border-[#F3F4F6] pt-3">
                        <select
                          className="w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-[#2B7FFF] focus:outline-none"
                          defaultValue=""
                          onChange={async (e) => {
                            const userId = e.target.value;
                            if (!userId) return;
                            try {
                              const r = await apiFetch('/api/teams/members/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: team.id, userId }) });
                              const d = await r.json();
                              if (!r.ok) { toast.error(d.message || 'Failed to add member'); return; }
                              setTeams((prev) => prev.map((t) =>
                                t.id === team.id && !t.memberIds.includes(userId)
                                  ? { ...t, memberIds: [...t.memberIds, userId] }
                                  : t
                              ));
                            } catch { toast.error('Failed to add member'); }
                            setAddMemberToTeamId(null);
                          }}
                        >
                          <option value="" disabled>Select a member…</option>
                          {members
                            .filter((m) => !team.memberIds.includes(m.userId))
                            .map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.user?.fullName ?? m.user?.email ?? m.userId}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => setAddMemberToTeamId(null)}
                          className="text-[12px] text-[#6A7282] hover:text-[#101828]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Invites tab (admin only) */
        showSkeleton ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-[#E5E7EB] bg-white p-5 animate-pulse">
                <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-gray-200" /><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-32 mb-1" /><div className="h-3 bg-gray-100 rounded w-48" /></div></div>
              </div>
            ))}
          </div>
        ) : filteredInvites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[16px] font-medium text-[#101828] mb-1">No pending invites</p>
            <p className="text-[14px] text-[#6A7282]">Sent invitations will appear here</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredInvites.map((invite) => {
              const statusStyle = inviteStatusStyles[invite.status] ?? inviteStatusStyles.pending;
              const color = getAvatarColor(invite.email);
              return (
                <div key={invite.publicId} className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center gap-4">
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-[13px] font-medium flex-shrink-0", color)}>
                      {getInitials(invite.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="truncate text-[14px] font-medium text-[#101828]">{invite.email}</p>
                        <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium capitalize flex-shrink-0", statusStyle.bg, statusStyle.text)}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6A7282]">
                        Invited as <span className="capitalize font-medium">{invite.role}</span> · Expires {formatDate(invite.expiresAt)}
                      </p>
                    </div>
                    {canManage && invite.status === 'pending' && (
                      <button
                        onClick={() => setRevokeTarget(invite)}
                        className="rounded-[8px] border border-[#E5E7EB] px-3 py-1.5 text-[13px] text-[#6A7282] hover:border-red-300 hover:text-red-500 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            <div className="grid grid-cols-[2fr_0.8fr_1fr_0.6fr] gap-4 border-b border-[#E5E7EB] bg-[#FAFAFA] px-6 py-3">
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#6A7282]">Email</span>
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#6A7282]">Role</span>
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#6A7282]">Status</span>
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#6A7282]">Actions</span>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {filteredInvites.map((invite) => {
                const statusStyle = inviteStatusStyles[invite.status] ?? inviteStatusStyles.pending;
                return (
                  <div key={invite.publicId} className="grid grid-cols-[2fr_0.8fr_1fr_0.6fr] items-center gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[#101828]">{invite.email}</p>
                      <p className="text-[12px] text-[#6A7282]">Expires {formatDate(invite.expiresAt)}</p>
                    </div>
                    <span className="text-[13px] capitalize text-[#364153]">{invite.role}</span>
                    <span className={cn("w-fit rounded px-2 py-0.5 text-[11px] font-medium capitalize", statusStyle.bg, statusStyle.text)}>
                      {statusStyle.label}
                    </span>
                    <div>
                      {canManage && invite.status === 'pending' && (
                        <button
                          onClick={() => setRevokeTarget(invite)}
                          className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] text-[#6A7282] hover:border-red-300 hover:text-red-500 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Add Member Modal */}
      <AddMemberModal
        projectId={projectPublicId}
        projectName={currentProjectName}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        teams={teams}
        onSuccess={(assignedTeamIds, invitedEmail) => {
          fetchInvites();
          if (assignedTeamIds?.length && invitedEmail) {
            setPendingTeamAssignments((prev) => [...prev, { email: invitedEmail, teamIds: assignedTeamIds }]);
          }
        }}
      />

      {/* Role Edit Modal */}
      <RoleEditModal
        isOpen={!!roleEditMember}
        member={roleEditMember}
        onClose={() => setRoleEditMember(null)}
        onConfirm={handleRoleChange}
        roles={roles}
        canManage={canManage}
      />

      {/* Remove Member Confirmation */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRemoveTarget(null)}>
          <div className="relative w-full max-w-[400px] bg-white rounded-[14px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5">
              <h3 className="text-[16px] font-medium text-[#101828] mb-2">Remove Member</h3>
              <p className="text-[14px] text-[#4A5565]">
                Are you sure you want to remove <span className="font-medium">{removeTarget.user?.fullName ?? removeTarget.email}</span> from this project? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]">
              <button onClick={() => setRemoveTarget(null)} className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]">Cancel</button>
              <button
                onClick={handleRemoveMember}
                disabled={actionLoading}
                className="px-4 py-2 rounded-[10px] bg-red-500 text-[14px] text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsCreateTeamOpen(false)}>
          <div
            className="relative w-full max-w-[440px] bg-white rounded-[14px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#2B7FFF]">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-[18px] font-normal text-[#101828]">Create Team</h2>
                <p className="text-[14px] text-[#6A7282]">Group members by discipline or role</p>
              </div>
              <button
                onClick={() => setIsCreateTeamOpen(false)}
                className="rounded-[10px] p-2 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <label className="block text-[14px] text-[#364153]">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Design, Engineering, QA"
                  autoFocus
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[14px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[14px] text-[#364153]">Description <span className="text-[#99A1AF]">(optional)</span></label>
                <input
                  type="text"
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="Brief description of this team"
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[14px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                />
              </div>
              {/* Color preview */}
              <div className="space-y-2">
                <label className="block text-[14px] text-[#364153]">Team Color</label>
                <div className="flex items-center gap-2">
                  {TEAM_COLORS.map((color) => {
                    const nextColorForNew = TEAM_COLORS[teams.length % TEAM_COLORS.length];
                    return (
                      <div
                        key={color}
                        className={cn(
                          "h-7 w-7 rounded-lg cursor-pointer ring-2 transition-all",
                          color,
                          color === nextColorForNew ? "ring-[#2B7FFF] ring-offset-1" : "ring-transparent"
                        )}
                      />
                    );
                  })}
                </div>
                <p className="text-[12px] text-[#99A1AF]">Color is assigned automatically based on creation order</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]">
              <button
                onClick={() => { setIsCreateTeamOpen(false); setNewTeamName(''); setNewTeamDesc(''); }}
                className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!newTeamName.trim() || actionLoading}
                onClick={async () => {
                  const name = newTeamName.trim();
                  const color = TEAM_COLORS[teams.length % TEAM_COLORS.length];
                  setActionLoading(true);
                  try {
                    const r = await apiFetch('/api/teams/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectId: projectPublicId, name, description: newTeamDesc.trim(), color }),
                    });
                    const d = await r.json();
                    if (!r.ok) { toast.error(d.message || 'Failed to create team'); return; }
                    setTeams((prev) => [...prev, d.data]);
                    setNewTeamName('');
                    setNewTeamDesc('');
                    setIsCreateTeamOpen(false);
                    toast.success(`Team "${name}" created`);
                  } catch { toast.error('Failed to create team'); }
                  finally { setActionLoading(false); }
                }}
                className="px-4 py-2 rounded-[10px] bg-[#2B7FFF] text-[14px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Invite Confirmation */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRevokeTarget(null)}>
          <div className="relative w-full max-w-[400px] bg-white rounded-[14px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5">
              <h3 className="text-[16px] font-medium text-[#101828] mb-2">Revoke Invite</h3>
              <p className="text-[14px] text-[#4A5565]">
                Revoke the invitation sent to <span className="font-medium">{revokeTarget.email}</span>? They will no longer be able to join the project.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]">
              <button onClick={() => setRevokeTarget(null)} className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]">Cancel</button>
              <button
                onClick={handleRevokeInvite}
                disabled={actionLoading}
                className="px-4 py-2 rounded-[10px] bg-red-500 text-[14px] text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Revoking…' : 'Revoke Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
