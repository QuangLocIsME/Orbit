'use client';

import { useState, useEffect } from 'react';
import ProjectTopBar from './ProjectTopBar';

interface TabItem {
  id: string;
  label: string;
}

interface GuestAccess {
  projectId: string;
  packageIds: string[];
  shareType: string;
  allowedPages: string[];
  allowedRoles: string[];
  isGuest: boolean;
  token: string;
}

interface ProjectTopBarWrapperProps {
  projectName: string;
  projectSlug: string;
  packageName?: string;
  packageId?: string;
  activeTab?: string;
  isFavorite?: boolean;
  onTabChange?: (tabId: string) => void;
  onFavoriteChange?: (isFavorite: boolean) => void;
  projectRole?: 'owner' | 'admin' | 'member' | 'viewer';
  tabs?: TabItem[];
  isGuest?: boolean;
}

export default function ProjectTopBarWrapper(props: ProjectTopBarWrapperProps) {
  const [guestAccess, setGuestAccess] = useState<{
    allowedPages: string[];
    allowedRoles: string[];
    isGuest: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('orbit_guest_access');
      if (stored) {
        const parsed: GuestAccess = JSON.parse(stored);
        if (parsed.projectId === props.projectSlug) {
          setGuestAccess({
            allowedPages: parsed.allowedPages,
            allowedRoles: parsed.allowedRoles,
            isGuest: parsed.isGuest || props.isGuest || false,
          });
        }
      } else if (props.isGuest) {
        setGuestAccess({
          allowedPages: [],
          allowedRoles: ['guest'],
          isGuest: true,
        });
      }
    } catch { /* ignore */ }
  }, [props.projectSlug, props.isGuest]);

  return (
    <ProjectTopBar
      {...props}
      guestAccess={guestAccess || undefined}
    />
  );
}
