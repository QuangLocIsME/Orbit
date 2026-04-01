'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'members', label: 'Members' },
  { id: 'billing', label: 'Billing' },
];

const MEMBERS = [
  { id: 1, name: 'Thao Duyen', email: 'thaoduyen@example.com', role: 'Owner', avatar: 'TD' },
  { id: 2, name: 'John Smith', email: 'john@example.com', role: 'Admin', avatar: 'JS' },
  { id: 3, name: 'Sarah Wilson', email: 'sarah@example.com', role: 'Member', avatar: 'SW' },
  { id: 4, name: 'Mike Chen', email: 'mike@example.com', role: 'Member', avatar: 'MC' },
];

export default function WorkspaceSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [workspaceName, setWorkspaceName] = useState('ORBIT Construction');
  const [workspaceUrl, setWorkspaceUrl] = useState('orbit-construction');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Workspace Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your workspace configuration and team</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-border">
          <nav className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-8">
            {/* Workspace Logo */}
            <div className="flex items-start gap-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                  OC
                </div>
                <button className="absolute -bottom-1 -right-1 rounded-full bg-card border border-border p-1.5 shadow-sm hover:bg-muted transition-colors">
                  <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">Workspace Logo</h3>
                <p className="mt-1 text-sm text-muted-foreground">This will be displayed across the platform</p>
                <div className="mt-3 flex gap-3">
                  <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    Upload Logo
                  </button>
                  <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    Remove
                  </button>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Workspace Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Workspace URL</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">app.orbit.com/</span>
                  <input
                    type="text"
                    value={workspaceUrl}
                    onChange={(e) => setWorkspaceUrl(e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Timezone</label>
                <select className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors">
                  <option>UTC+7 (Bangkok, Hanoi, Jakarta)</option>
                  <option>UTC+0 (London, Dublin)</option>
                  <option>UTC-5 (New York, Toronto)</option>
                  <option>UTC-8 (Los Angeles, Vancouver)</option>
                </select>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-border">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Invite Section */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-card-foreground">Invite Team Members</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add new members to your workspace</p>
              <div className="mt-4 flex gap-3">
                <input
                  type="email"
                  placeholder="Enter email address"
                  className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                />
                <select className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors">
                  <option>Member</option>
                  <option>Admin</option>
                </select>
                <button className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  Send Invite
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="rounded-lg border border-border bg-card">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-semibold text-card-foreground">Team Members ({MEMBERS.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {MEMBERS.map((member) => (
                  <div key={member.id} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                        {member.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        member.role === 'Owner' ? "bg-primary/10 text-primary" :
                        member.role === 'Admin' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {member.role}
                      </span>
                      {member.role !== 'Owner' && (
                        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-card-foreground">Current Plan</h3>
                  <p className="mt-1 text-sm text-muted-foreground">You are currently on the Professional plan</p>
                </div>
                <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                  Professional
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-2xl font-bold text-foreground">$29</p>
                  <p className="text-sm text-muted-foreground">per user / month</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-2xl font-bold text-foreground">4</p>
                  <p className="text-sm text-muted-foreground">team members</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-2xl font-bold text-foreground">$116</p>
                  <p className="text-sm text-muted-foreground">monthly total</p>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  Upgrade Plan
                </button>
                <button className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  View Invoices
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-card-foreground">Payment Method</h3>
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-border p-4">
                <div className="flex h-10 w-14 items-center justify-center rounded bg-blue-600 text-white text-xs font-bold">
                  VISA
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Visa ending in 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                </div>
                <button className="ml-auto text-sm text-primary hover:underline">Change</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
