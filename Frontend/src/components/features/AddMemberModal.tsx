'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  memberCount: number;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  teams: Team[];
  onSubmit: (data: {
    email: string;
    jobTitle: string;
    permission: string;
    teamIds: string[];
  }) => void;
}

const permissions = [
  {
    id: 'admin',
    label: 'Admin',
    description: 'Can manage project, members, and approve changes',
    badgeBg: 'bg-[#FEF2F2]',
    badgeBorder: 'border-[#FFC9C9]',
    badgeText: 'text-[#C10007]',
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Can manage tasks, approve changes, and assign work',
    badgeBg: 'bg-[#EFF6FF]',
    badgeBorder: 'border-[#BEDBFF]',
    badgeText: 'text-[#1447E6]',
  },
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'View-only access to project content',
    badgeBg: 'bg-[#F9FAFB]',
    badgeBorder: 'border-[#E5E7EB]',
    badgeText: 'text-[#364153]',
  },
];

export default function AddMemberModal({
  isOpen,
  onClose,
  projectName,
  teams,
  onSubmit,
}: AddMemberModalProps) {
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('viewer');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({
      email,
      jobTitle,
      permission: selectedPermission,
      teamIds: selectedTeams,
    });
    // Reset form
    setEmail('');
    setJobTitle('');
    setSelectedPermission('viewer');
    setSelectedTeams([]);
    onClose();
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const getTeamIcon = (color: string) => {
    switch (color) {
      case 'blue':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#2B7FFF]">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
        );
      case 'green':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#00BC7D]">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
        );
      case 'yellow':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F59E0B]">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
          </div>
        );
      case 'orange':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F97316]">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#6B7280]">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative flex w-full max-w-[672px] max-h-[90vh] flex-col bg-white rounded-[14px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#2B7FFF]">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-[18px] font-normal text-[#101828]">Invite Member</h2>
            <p className="text-[14px] text-[#6A7282]">Add a new member to {projectName}</p>
          </div>
          <button onClick={onClose} className="rounded-[10px] p-2 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Email Address */}
          <div className="space-y-2">
            <label className="block text-[14px] text-[#364153]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john.doe@example.com"
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[16px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
            />
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <label className="block text-[14px] text-[#364153]">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Architect"
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[16px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
            />
          </div>

          {/* Project Permission */}
          <div className="space-y-3">
            <label className="block text-[14px] text-[#364153]">Project Permission</label>
            <div className="space-y-2">
              {permissions.map((permission) => (
                <button
                  key={permission.id}
                  type="button"
                  onClick={() => setSelectedPermission(permission.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[10px] border-2 p-4 text-left transition-colors",
                    selectedPermission === permission.id
                      ? "border-[#2B7FFF] bg-[#EFF6FF]"
                      : "border-[#E5E7EB] hover:border-[#D1D5DC]"
                  )}
                >
                  <div className="pt-0.5">
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                      selectedPermission === permission.id
                        ? "border-[#2B7FFF]"
                        : "border-[#D1D5DC]"
                    )}>
                      {selectedPermission === permission.id && (
                        <div className="h-2 w-2 rounded-full bg-[#2B7FFF]" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full border text-[12px]",
                        permission.badgeBg,
                        permission.badgeBorder,
                        permission.badgeText
                      )}>
                        {permission.label}
                      </span>
                      {selectedPermission === permission.id && (
                        <svg className="h-4 w-4 text-[#155DFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <p className="text-[12px] text-[#4A5565]">{permission.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Assign to Teams */}
          <div className="space-y-3">
            <label className="block text-[14px] text-[#364153]">Assign to Teams</label>
            <div className="space-y-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[10px] border px-3 py-3 text-left transition-colors",
                    selectedTeams.includes(team.id)
                      ? "border-[#2B7FFF] bg-[#EFF6FF]"
                      : "border-[#E5E7EB] hover:border-[#D1D5DC]"
                  )}
                >
                  {/* Checkbox */}
                  <div className={cn(
                    "h-4 w-4 rounded border-2 flex items-center justify-center",
                    selectedTeams.includes(team.id)
                      ? "border-[#2B7FFF] bg-[#2B7FFF]"
                      : "border-[#D1D5DC]"
                  )}>
                    {selectedTeams.includes(team.id) && (
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Team Icon */}
                  {getTeamIcon(team.color)}

                  {/* Team Info */}
                  <div className="flex-1">
                    <p className="text-[14px] text-[#101828]">{team.name}</p>
                    <p className="text-[12px] text-[#6A7282]">{team.description}</p>
                  </div>

                  {/* Member Count */}
                  <span className="text-[12px] text-[#6A7282]">{team.memberCount} members</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!email}
            className="px-4 py-2 rounded-[10px] bg-[#2B7FFF] text-[14px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Invite Member
          </button>
        </div>
      </div>
    </div>
  );
}
