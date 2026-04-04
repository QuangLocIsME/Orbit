'use client';

import { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { type InviteNotification } from '@/lib/socket';
import { apiFetch } from '@/lib/api-client';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PendingInvite extends InviteNotification {
  dismissed: boolean;
}

/**
 * InviteNotificationHandler — renders the invite AlertDialog via a portal.
 *
 * Flow:
 *   1. useNotifications receives invite:new → shows Sonner toast
 *   2. User clicks "View" on Sonner → dispatches 'orbit:show-invite-dialog'
 *   3. This component listens for that event → shows AlertDialog
 *   4. User clicks Accept → POST /api/invites/accept (uses token)
 *   5. User clicks Decline → POST /api/invites/revoke (uses inviteId)
 */
export default function InviteNotificationHandler() {
  const [activeInvite, setActiveInvite] = useState<PendingInvite | null>(null);
  const [mounted, setMounted] = useState(false);

  // Keep a ref so event handlers always read the latest state
  const activeInviteRef = useRef<PendingInvite | null>(null);
  useEffect(() => { activeInviteRef.current = activeInvite; }, [activeInvite]);

  useEffect(() => { setMounted(true); }, []);

  // Listen for the custom event dispatched from the Sonner action
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<InviteNotification>).detail;
      setActiveInvite({ ...data, dismissed: false });
    };
    window.addEventListener('orbit:show-invite-dialog', handler);
    return () => window.removeEventListener('orbit:show-invite-dialog', handler);
  }, []);

  const handleAccept = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      const res = await apiFetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.token || invite.inviteId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Failed to accept invite'); return; }
      toast.success(`You joined "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch { toast.error('Failed to accept invite'); }
  };

  const handleReject = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      await apiFetch('/api/invites/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.inviteId }),
      });
      toast.info(`Declined invite to "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch { toast.error('Failed to decline invite'); }
  };

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <AlertDialog
      open={!!activeInvite}
      onOpenChange={(open) => { if (!open) { setActiveInvite(null); activeInviteRef.current = null; } }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {activeInvite?.inviterName} invited you to join
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 pt-1">
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                <p className="text-sm font-medium text-[#101828]">{activeInvite?.projectName}</p>
                <p className="text-xs text-[#6A7282] mt-0.5">
                  Role: <span className="capitalize font-medium">{activeInvite?.role}</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Would you like to accept this invitation?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleReject}>
            Decline
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAccept}
            className="bg-[#155DFC] text-white hover:bg-blue-700"
          >
            Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
    document.body
  );
}
