'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { useAppStore } from '@/stores/appStore';
import { toast } from '@/components/ui/sonner';
import AddMemberModal from './AddMemberModal';

type MemberRole = 'admin' | 'member' | 'viewer';
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

const roleBadgeStyles: Record<MemberRole, { bg: string; text: string }> = {
  admin: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]' },
  member: { bg: 'bg-[#DBEAFE]', text: 'text-[#2563EB]' },
  viewer: { bg: 'bg-[#F3F4F6]', text: 'text-[#4B5563]' },
};

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

interface RoleEditModalProps {
  isOpen: boolean;
  member: MemberWithUser | null;
  onClose: () => void;
  onConfirm: (memberId: string, newRole: MemberRole) => Promise<void>;
}

function RoleEditModal({ isOpen, member, onClose, onConfirm }: RoleEditModalProps) {
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) setSelectedRole(member.role);
  }, [member]);

  if (!isOpen || !member) return null;

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
          {(['admin', 'member', 'viewer'] as MemberRole[]).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[10px] border-2 p-4 text-left transition-colors capitalize",
                selectedRole === role ? "border-[#2B7FFF] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:border-[#D1D5DC]"
              )}
            >
              <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center",
                selectedRole === role ? "border-[#2B7FFF]" : "border-[#D1D5DC]")}>
                {selectedRole === role && <div className="h-2 w-2 rounded-full bg-[#2B7FFF]" />}
              </div>
              <span className="text-[14px] text-[#101828] capitalize">{role}</span>
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

interface TeamsTabProps {
  projectPublicId: string;
  currentUserRole?: MemberRole;
}

export default function TeamsTab({ projectPublicId, currentUserRole: initialRole }: TeamsTabProps) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<MemberRole>(initialRole ?? 'member');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'members' | 'invites'>('members');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [roleEditMember, setRoleEditMember] = useState<MemberWithUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberWithUser | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PendingInvite | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const socket = useAppStore((s) => s.socket);

  // Sync with store (fallback if prop wasn't provided — e.g. navigation without full hydration)
  const projects = useAppStore((s) => s.projects);
  useEffect(() => {
    if (initialRole) return; // prop takes priority
    const project = projects.find((p) => String(p.publicId) === projectPublicId);
    if (project?.role) setCurrentUserRole(project.role as MemberRole);
  }, [projects, projectPublicId, initialRole]);

  const canManage = currentUserRole === 'admin';
  const canEditRole = (memberRole: MemberRole) => canManage && memberRole !== 'admin';
  const canRemove = (memberRole: MemberRole) => canManage && memberRole !== 'admin';

  const fetchMembers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/projects/member-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMembers(Array.isArray(data?.data) ? data.data : []);
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMembers(), fetchInvites()]);
    setLoading(false);
  }, [fetchMembers, fetchInvites]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleInviteNew = () => { fetchInvites(); };
    const handleInviteAccepted = () => { fetchMembers(); fetchInvites(); };
    const handleInviteRevoked = () => { fetchInvites(); };

    socket.on('invite:new', handleInviteNew);
    socket.on('invite:accepted', handleInviteAccepted);
    socket.on('invite:revoked', handleInviteRevoked);

    return () => {
      socket.off('invite:new', handleInviteNew);
      socket.off('invite:accepted', handleInviteAccepted);
      socket.off('invite:revoked', handleInviteRevoked);
    };
  }, [socket, fetchMembers, fetchInvites]);

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/projects/members/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectPublicId, userId, role: newRole }),
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

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.user?.fullName ?? '').toLowerCase().includes(q) ||
      (m.user?.email ?? '').toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
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
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Member
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

          {activeView === 'members' && (
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
          )}
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
              const badge = roleBadgeStyles[member.role];
              return (
                <div key={member.userId} className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-medium text-[14px]", color)}>
                      {getInitials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-medium text-[#101828] truncate">{name}</h3>
                      <p className="text-[12px] text-[#6A7282] truncate capitalize">{member.role}</p>
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
                    <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium capitalize", badge.bg, badge.text)}>
                      {member.role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                    <span className="text-[12px] text-[#6A7282]">Joined {formatDate(member.createdAt)}</span>
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
                const badge = roleBadgeStyles[member.role];
                return (
                  <div key={member.userId} className="grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.5fr] gap-4 px-6 py-4 items-center hover:bg-[#FAFAFA] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-[13px] font-medium", color)}>
                        {getInitials(name)}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[#101828]">{name}</p>
                        <p className="text-[12px] text-[#6A7282]">{email || '—'}</p>
                      </div>
                    </div>
                    <span className="text-[14px] text-[#364153] capitalize">{member.role}</span>
                    <span className={cn("px-2.5 py-1 rounded text-[12px] font-medium w-fit capitalize", badge.bg, badge.text)}>
                      {member.role}
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
        ) : (
          <div className="space-y-3">
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
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-medium text-[#101828] truncate">{invite.email}</p>
                        <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium capitalize flex-shrink-0", statusStyle.bg, statusStyle.text)}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6A7282]">
                        Invited as <span className="capitalize font-medium">{invite.role}</span> · Expires {formatDate(invite.expiresAt)}
                      </p>
                    </div>
                    {invite.status === 'pending' && (
                      <button
                        onClick={() => setRevokeTarget(invite)}
                        className="px-3 py-1.5 rounded-[8px] border border-[#E5E7EB] text-[13px] text-[#6A7282] hover:border-red-300 hover:text-red-500 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Add Member Modal */}
      <AddMemberModal
        projectId={projectPublicId}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchInvites}
      />

      {/* Role Edit Modal */}
      <RoleEditModal
        isOpen={!!roleEditMember}
        member={roleEditMember}
        onClose={() => setRoleEditMember(null)}
        onConfirm={handleRoleChange}
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
