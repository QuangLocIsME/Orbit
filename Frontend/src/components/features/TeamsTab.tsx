'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import AddMemberModal from './AddMemberModal';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  initials: string;
  avatarColor: string;
  badge: 'Owner' | 'Admin' | 'Manager' | 'Member';
  joinedDate: string;
  teamsCount: number;
  teams?: string[];
}

interface Team {
  id: string;
  name: string;
  description: string;
  icon: 'architecture' | 'structural' | 'mep' | 'bim';
  iconColor: string;
  iconBg: string;
  lead: TeamMember;
  members: TeamMember[];
}

const mockTeamMembers: TeamMember[] = [
  { id: '1', name: 'Thao Duyen', role: 'Project Owner', email: 'thao.duyen@company.com', initials: 'TD', avatarColor: 'bg-gray-200', badge: 'Owner', joinedDate: 'Jan 2024', teamsCount: 2, teams: ['Architecture', 'BIM'] },
  { id: '2', name: 'Minh Anh', role: 'Project Manager', email: 'minh.anh@orbit.vn', initials: 'MA', avatarColor: 'bg-[#EC4899]', badge: 'Admin', joinedDate: 'Jan 2024', teamsCount: 1, teams: ['Architecture'] },
  { id: '3', name: 'Hoàng Nam', role: 'Lead Architect', email: 'hoang.nam@orbit.vn', initials: 'HN', avatarColor: 'bg-[#14B8A6]', badge: 'Manager', joinedDate: 'Feb 2024', teamsCount: 1, teams: ['Architecture'] },
  { id: '4', name: 'Thu Trang', role: 'Structural Engineer', email: 'thu.trang@orbit.vn', initials: 'TT', avatarColor: 'bg-[#3B82F6]', badge: 'Manager', joinedDate: 'Feb 2024', teamsCount: 1, teams: ['Structural'] },
  { id: '5', name: 'Tuấn Kiệt', role: 'MEP Engineer', email: 'tuan.kiet@orbit.vn', initials: 'TK', avatarColor: 'bg-[#8B5CF6]', badge: 'Manager', joinedDate: 'Feb 2024', teamsCount: 1, teams: ['MEP'] },
  { id: '6', name: 'Olivia Turner', role: 'BIM Coordinator', email: 'olivia.turner@company.com', initials: 'OT', avatarColor: 'bg-[#6B7280]', badge: 'Manager', joinedDate: 'Mar 2024', teamsCount: 1, teams: ['BIM'] },
  { id: '7', name: 'Jacob Harris', role: 'Architect', email: 'jacob.harris@company.com', initials: 'JH', avatarColor: 'bg-[#3B82F6]', badge: 'Member', joinedDate: 'Mar 2024', teamsCount: 1, teams: ['Architecture'] },
  { id: '8', name: 'Ava Collins', role: 'MEP Engineer', email: 'ava.collins@company.com', initials: 'AC', avatarColor: 'bg-[#F472B6]', badge: 'Member', joinedDate: 'Apr 2024', teamsCount: 1, teams: ['MEP'] },
  { id: '9', name: 'Nathan Reed', role: 'Structural Engineer', email: 'nathan.reed@company.com', initials: 'NR', avatarColor: 'bg-[#10B981]', badge: 'Member', joinedDate: 'Apr 2024', teamsCount: 1, teams: ['Structural'] },
  { id: '10', name: 'Ethan Parker', role: 'Junior Architect', email: 'ethan.parker@company.com', initials: 'EP', avatarColor: 'bg-[#F59E0B]', badge: 'Member', joinedDate: 'Mar 2024', teamsCount: 1, teams: ['Architecture'] },
  { id: '11', name: 'Sarah Chen', role: 'MEP Designer', email: 'sarah.chen@company.com', initials: 'SC', avatarColor: 'bg-[#EC4899]', badge: 'Member', joinedDate: 'Mar 2024', teamsCount: 1, teams: ['MEP'] },
];

const teams: Team[] = [
  {
    id: '1',
    name: 'Architecture Team',
    description: 'Building design, layouts, and aesthetics',
    icon: 'architecture',
    iconColor: 'text-white',
    iconBg: 'bg-[#3B82F6]',
    lead: mockTeamMembers[2], // Hoàng Nam
    members: [mockTeamMembers[0], mockTeamMembers[1], mockTeamMembers[2], mockTeamMembers[6], mockTeamMembers[9]],
  },
  {
    id: '2',
    name: 'Structural Team',
    description: 'Structural engineering and analysis',
    icon: 'structural',
    iconColor: 'text-white',
    iconBg: 'bg-[#10B981]',
    lead: mockTeamMembers[3], // Thu Trang
    members: [mockTeamMembers[3], mockTeamMembers[8]],
  },
  {
    id: '3',
    name: 'MEP Team',
    description: 'Mechanical, Electrical & Plumbing',
    icon: 'mep',
    iconColor: 'text-white',
    iconBg: 'bg-[#F59E0B]',
    lead: mockTeamMembers[4], // Tuấn Kiệt
    members: [mockTeamMembers[4], mockTeamMembers[7], mockTeamMembers[10]],
  },
  {
    id: '4',
    name: 'BIM Team',
    description: 'BIM coordination and model management',
    icon: 'bim',
    iconColor: 'text-white',
    iconBg: 'bg-[#F97316]',
    lead: mockTeamMembers[5], // Olivia Turner
    members: [mockTeamMembers[5]],
  },
];

const badgeStyles = {
  Owner: 'bg-[#FEF3C7] text-[#B45309]',
  Admin: 'bg-[#DCFCE7] text-[#16A34A]',
  Manager: 'bg-[#DBEAFE] text-[#2563EB]',
  Member: 'bg-[#F3F4F6] text-[#4B5563]',
};

const TeamIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'architecture':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      );
    case 'structural':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      );
    case 'mep':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
    case 'bim':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      );
    default:
      return null;
  }
};

interface ApiProjectMember {
  projectId: string;
  userId: string;
  role: string;
  status: string;
  invitedBy: string | null;
  createdAt: string;
  fullName?: string;
  email?: string;
  avatar?: string;
}

interface TeamsTabProps {
  projectId?: string;
  projectName?: string;
  teamMembers?: ApiProjectMember[];
}

function toInitials(input: string): string {
  const value = input.trim();
  if (!value) return 'U';
  const parts = value.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export default function TeamsTab({ projectId, projectName = 'Metro Station - Phase 2', teamMembers = [] }: TeamsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'members' | 'teams'>('members');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  const resolvedMembers = useMemo<TeamMember[]>(() => {
    if (!teamMembers.length) return mockTeamMembers;

    return teamMembers.map((member, index) => {
      const roleName = member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Viewer';
      const normalizedBadge =
        member.role === 'owner'
          ? 'Owner'
          : member.role === 'admin'
            ? 'Admin'
            : member.role === 'manager'
              ? 'Manager'
              : 'Member';

      const displayName = member.fullName?.trim() || `User ${member.userId.slice(0, 6)}`;
      const displayEmail = member.email?.trim() || `${member.userId}@orbit.local`;

      return {
        id: `${member.userId}-${index}`,
        name: displayName,
        role: roleName,
        email: displayEmail,
        initials: toInitials(displayName),
        avatarColor: index % 2 === 0 ? 'bg-[#3B82F6]' : 'bg-[#14B8A6]',
        badge: normalizedBadge,
        joinedDate: member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A',
        teamsCount: 1,
        teams: ['Project Team'],
      };
    });
  }, [teamMembers]);

  const resolvedTeams = useMemo<Team[]>(() => {
    if (!teamMembers.length) return teams;

    return [
      {
        id: projectId || 'project-team',
        name: `${projectName} Team`,
        description: 'Project members synced from server',
        icon: 'bim',
        iconColor: 'text-white',
        iconBg: 'bg-[#155DFC]',
        lead: resolvedMembers[0],
        members: resolvedMembers,
      },
    ];
  }, [teamMembers.length, projectId, projectName, resolvedMembers]);

  // Teams data for modal
  const modalTeams = resolvedTeams.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    color: 'blue',
    memberCount: t.members.length,
  }));

  const filteredMembers = resolvedMembers.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeams = resolvedTeams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[24px] font-normal text-[#101828]">Team</h2>
        </div>
        <button 
          onClick={() => setIsAddMemberModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Member
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        {/* Search */}
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

        {/* Tabs and View Toggle */}
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
              <span className="text-[12px] text-[#6A7282]">({resolvedMembers.length})</span>
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
              <span className="text-[12px] text-[#6A7282]">({resolvedTeams.length})</span>
            </button>
          </div>

          {/* View Mode Toggle (only for members view) */}
          {activeView === 'members' && (
            <div className="flex items-center rounded-[10px] border border-[#E5E7EB] bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'grid' ? "bg-[#F3F4F6]" : "hover:bg-gray-50"
                )}
              >
                <svg className="h-4 w-4 text-[#4A5565]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'list' ? "bg-[#F3F4F6]" : "hover:bg-gray-50"
                )}
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
        /* All Members View */
        viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-medium", member.avatarColor)}>
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-medium text-[#101828] truncate">{member.name}</h3>
                    <p className="text-[12px] text-[#6A7282] truncate">{member.role}</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-4 w-4 text-[#99A1AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <span className="text-[12px] text-[#4A5565] truncate">{member.email}</span>
                </div>

                {/* Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-4 w-4 rounded-full border-2 border-[#E5E7EB]" />
                  <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium", badgeStyles[member.badge])}>
                    {member.badge}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] text-[#6A7282]">Joined</span>
                    <span className="text-[12px] font-medium text-[#101828]">{member.joinedDate}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] text-[#6A7282]">Teams</span>
                    <span className="text-[12px] font-medium text-[#101828]">{member.teamsCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_0.5fr] gap-4 px-6 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]">
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Member</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Role</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Permission</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Teams</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Joined</span>
              <span className="text-[12px] font-medium text-[#6A7282] uppercase tracking-wider">Actions</span>
            </div>
            {/* Table Body */}
            <div className="divide-y divide-[#E5E7EB]">
              {filteredMembers.map((member) => (
                <div key={member.id} className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_0.5fr] gap-4 px-6 py-4 items-center hover:bg-[#FAFAFA] transition-colors">
                  {/* Member */}
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-[13px] font-medium", member.avatarColor)}>
                      {member.initials}
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-[#101828]">{member.name}</p>
                      <p className="text-[12px] text-[#6A7282]">{member.email}</p>
                    </div>
                  </div>
                  {/* Role */}
                  <span className="text-[14px] text-[#364153]">{member.role}</span>
                  {/* Permission */}
                  <span className={cn("px-2.5 py-1 rounded text-[12px] font-medium w-fit", badgeStyles[member.badge])}>
                    {member.badge}
                  </span>
                  {/* Teams */}
                  <div className="flex flex-wrap gap-1">
                    {member.teams?.slice(0, 2).map((team, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#F3F4F6] text-[11px] text-[#364153]">
                        {team}
                      </span>
                    ))}
                  </div>
                  {/* Joined */}
                  <span className="text-[13px] text-[#4A5565]">{member.joinedDate}</span>
                  {/* Actions */}
                  <button className="p-1 text-[#99A1AF] hover:text-[#4A5565]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* Project Teams View */
        <div className="grid grid-cols-2 gap-6">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden"
            >
              {/* Team Header */}
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-start gap-3">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", team.iconBg)}>
                      <TeamIcon type={team.icon} className={cn("h-5 w-5", team.iconColor)} />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-medium text-[#101828]">{team.name}</h3>
                      <p className="text-[13px] text-[#6A7282]">{team.description}</p>
                    </div>
                  </div>
                  <button className="p-1 text-[#99A1AF] hover:text-[#4A5565]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>

                {/* Lead */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F3F4F6]">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#6A7282]">Lead:</span>
                    <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[10px] text-white font-medium", team.lead.avatarColor)}>
                      {team.lead.initials}
                    </div>
                    <span className="text-[13px] text-[#101828]">{team.lead.name}</span>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium", badgeStyles.Manager)}>
                    Manager
                  </span>
                </div>
              </div>

              {/* Members List */}
              <div className="border-t border-[#E5E7EB] bg-[#FAFAFA]">
                <div className="px-5 py-3 border-b border-[#E5E7EB]">
                  <span className="text-[13px] font-medium text-[#4A5565]">{team.members.length} Members</span>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {team.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[11px] text-white font-medium", member.avatarColor)}>
                        {member.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#101828] truncate">{member.name}</p>
                        <p className="text-[11px] text-[#6A7282] truncate">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Member */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E7EB]">
                  <button className="flex items-center gap-2 text-[13px] text-[#4A5565] hover:text-[#101828]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Add Member
                  </button>
                  <button className="p-1 text-[#99A1AF] hover:text-[#4A5565]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        projectName={projectName}
        teams={modalTeams}
        onSubmit={async (data) => {
          if (!projectId) {
            toast.error('Missing project id');
            return;
          }

          const request = apiFetch('/api/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              email: data.email,
              role: data.permission,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const payload = await res.json().catch(() => null);
              throw new Error(payload?.message || 'Invite member failed');
            }
            return res.json();
          });

          await toast.promise(request, {
            loading: 'Inviting member...',
            success: 'Invitation sent',
            error: (err) => err?.message || 'Invite member failed',
          });

          setIsAddMemberModalOpen(false);
        }}
      />
    </div>
  );
}
