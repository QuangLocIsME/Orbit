'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from '@/components/ui/sonner';

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
    id: 'member',
    label: 'Member',
    description: 'Can create and edit content, submit changes for review',
    badgeBg: 'bg-[#F0FDF4]',
    badgeBorder: 'border-[#B9F8CF]',
    badgeText: 'text-[#008236]',
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

export interface TeamOption {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface AddMemberModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assignedTeamIds?: string[], invitedEmail?: string) => void;
  teams?: TeamOption[];
}

export default function AddMemberModal({
  projectId,
  isOpen,
  onClose,
  onSuccess,
  teams = [],
}: AddMemberModalProps) {
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('member');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleClose = () => {
    setEmail('');
    setJobTitle('');
    setSelectedPermission('member');
    setSelectedTeams([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          email: email.trim(),
          role: selectedPermission,
          jobTitle: jobTitle.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Failed to send invitation');
        return;
      }

      toast.success(`Invitation sent to ${email.trim()}`);
      onSuccess(selectedTeams.length > 0 ? selectedTeams : undefined, email.trim());
      handleClose();
    } catch {
      toast.error('Failed to send invitation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="relative flex w-full max-w-[480px] max-h-[90vh] flex-col bg-white rounded-[14px] shadow-2xl"
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
            <p className="text-[14px] text-[#6A7282]">Send an invitation to join this project</p>
          </div>
          <button onClick={handleClose} className="rounded-[10px] p-2 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Email Address */}
          <div className="space-y-2">
            <label className="block text-[14px] text-[#364153]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. john.doe@example.com"
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[16px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
            />
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <label className="block text-[14px] text-[#364153]">Job Title <span className="text-[#99A1AF]">(optional)</span></label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Project Manager, Lead Architect"
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[14px] placeholder:text-[#10182880] focus:border-[#2B7FFF] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
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
                      selectedPermission === permission.id ? "border-[#2B7FFF]" : "border-[#D1D5DC]"
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
          {teams.length > 0 && (
            <div className="space-y-3">
              <label className="block text-[14px] text-[#364153]">Assign to Teams <span className="text-[#99A1AF]">(optional)</span></label>
              <div className="space-y-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[10px] border-2 p-3.5 text-left transition-colors",
                      selectedTeams.includes(team.id)
                        ? "border-[#2B7FFF] bg-[#EFF6FF]"
                        : "border-[#E5E7EB] hover:border-[#D1D5DC]"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                      selectedTeams.includes(team.id) ? "border-[#2B7FFF] bg-[#2B7FFF]" : "border-[#D1D5DC]"
                    )}>
                      {selectedTeams.includes(team.id) && (
                        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", team.color)}>
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#101828] truncate">{team.name}</p>
                      <p className="text-[12px] text-[#6A7282] truncate">{team.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[14px]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!email.trim() || isSubmitting}
            className="px-4 py-2 rounded-[10px] bg-[#2B7FFF] text-[14px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending…' : 'Invite Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
