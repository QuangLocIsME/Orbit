'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { fetchWithAuth } from '../../lib/auth';

interface IndustryOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  iconId?: string;
  colorId?: string;
  bgColor?: string;
  bgSolid?: string;
}

// Base 6 industries (always visible)
const baseIndustries: IndustryOption[] = [
  {
    id: 'construction',
    name: 'Construction',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: 'text-blue-500',
  },
  {
    id: 'software',
    name: 'Software',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    color: 'text-cyan-500',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    color: 'text-red-500',
  },
  {
    id: 'design',
    name: 'Design',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    color: 'text-purple-500',
  },
  {
    id: 'research',
    name: 'Research',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'text-teal-500',
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
    color: 'text-emerald-500',
  },
];

// Additional industries (shown when expanded)
const extendedIndustries: IndustryOption[] = [
  {
    id: 'education',
    name: 'Education',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    color: 'text-cyan-500',
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    color: 'text-rose-500',
  },
  {
    id: 'legal',
    name: 'Legal',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    color: 'text-emerald-600',
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    color: 'text-blue-500',
  },
  {
    id: 'retail',
    name: 'Retail',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
    color: 'text-pink-500',
  },
  {
    id: 'technology',
    name: 'Technology',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-emerald-500',
  },
  {
    id: 'energy',
    name: 'Energy',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'text-amber-500',
  },
  {
    id: 'food-beverage',
    name: 'Food & Beverage',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-emerald-500',
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    color: 'text-pink-500',
  },
  {
    id: 'media',
    name: 'Media',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-blue-500',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-purple-500',
  },
  {
    id: 'publishing',
    name: 'Publishing',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    color: 'text-emerald-500',
  },
  {
    id: 'startup',
    name: 'Startup',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: 'text-rose-500',
  },
  {
    id: 'other',
    name: 'Other',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    color: 'text-gray-500',
  },
];

// Icons available for custom industry
const iconOptions = [
  { id: 'building', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
  { id: 'code', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
  { id: 'megaphone', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
  { id: 'scale', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg> },
  { id: 'palette', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg> },
  { id: 'chart', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { id: 'bank', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg> },
  { id: 'music', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg> },
  { id: 'cloud', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg> },
  { id: 'heart', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg> },
  { id: 'scissors', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg> },
  { id: 'book', icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
];

// Color options for custom industry
const colorOptions = [
  { id: 'red', bg: 'bg-red-500', text: 'text-red-500' },
  { id: 'orange', bg: 'bg-orange-500', text: 'text-orange-500' },
  { id: 'amber', bg: 'bg-amber-500', text: 'text-amber-500' },
  { id: 'green', bg: 'bg-green-500', text: 'text-green-500' },
  { id: 'teal', bg: 'bg-teal-500', text: 'text-teal-500' },
  { id: 'blue', bg: 'bg-blue-500', text: 'text-blue-500' },
  { id: 'purple', bg: 'bg-purple-500', text: 'text-purple-500' },
  { id: 'pink', bg: 'bg-pink-500', text: 'text-pink-500' },
  { id: 'violet', bg: 'bg-violet-500', text: 'text-violet-500' },
  { id: 'gray', bg: 'bg-gray-500', text: 'text-gray-500' },
  { id: 'yellow', bg: 'bg-yellow-400', text: 'text-yellow-400' },
  { id: 'rose', bg: 'bg-rose-300', text: 'text-rose-300' },
];

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: CreatedProjectPayload) => void;
}

export interface CreatedProjectPayload {
  publicId: string;
  name: string;
  description?: string;
  industry?: string;
  coverImageUrl?: string;
  role?: string;
  status?: string;
  customIndustry?: {
    icon: string;
    color: string;
  };
}

// Custom industries storage key
const CUSTOM_INDUSTRIES_KEY = 'orbit:custom-industries';

// Load custom industries from localStorage
export function loadCustomIndustries(): IndustryOption[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CUSTOM_INDUSTRIES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((item: { id: string; name: string; iconId: string; colorId: string }) => ({
        id: item.id,
        name: item.name,
        icon: getIconById(item.iconId),
        color: `text-${item.colorId}-500`,
        bgColor: `bg-${item.colorId}-50`,
        bgSolid: `bg-${item.colorId}-500`,
      }));
    }
  } catch (e) {
    console.error('Failed to load custom industries:', e);
  }
  return [];
}

// Save custom industry to localStorage
export function saveCustomIndustry(industry: IndustryOption) {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadCustomIndustriesRaw();
    const newIndustry = {
      id: industry.id,
      name: industry.name,
      iconId: industry.iconId || 'building',
      colorId: industry.colorId || 'blue',
    };
    localStorage.setItem(CUSTOM_INDUSTRIES_KEY, JSON.stringify([...existing, newIndustry]));
  } catch (e) {
    console.error('Failed to save custom industry:', e);
  }
}

interface CustomIndustryRaw {
  id: string;
  name: string;
  iconId: string;
  colorId: string;
}

export function loadCustomIndustriesRaw(): CustomIndustryRaw[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CUSTOM_INDUSTRIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get icon SVG by icon ID
function getIconById(iconId: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    building: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    code: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    megaphone: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
    scale: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
    palette: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
    chart: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    bank: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
    music: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
    cloud: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
    heart: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    scissors: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>,
    book: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  };
  return icons[iconId] || icons.building;
}

export default function CreateProjectModal({ isOpen, onClose, onProjectCreated }: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [showMoreIndustries, setShowMoreIndustries] = useState(false);
  const [showCustomIndustry, setShowCustomIndustry] = useState(false);
  const [customIndustries, setCustomIndustries] = useState<IndustryOption[]>(() => {
    // Load custom industries from localStorage on initial mount
    return loadCustomIndustries();
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom industry form state
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('building');
  const [customColor, setCustomColor] = useState('pink'); // Default to pink for better visibility

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = projectName.trim();
    if (!trimmedName) return;

    const selectedIndustryName = allIndustries.find((industry) => industry.id === selectedIndustry)?.name;

    const requestPromise = (async () => {
      setIsSubmitting(true);
      try {
        const response = await fetchWithAuth('/api/projects/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
            description: '',
            industry: selectedIndustryName || null,
            coverImageUrl: coverImageUrl.trim() || null,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.message || 'Create project failed');
        }

        // Get custom industry data if this is a custom industry
        // First check in state, then in localStorage
        let customIndustryData: { icon: string; color: string } | undefined;
        
        const selectedCustomIndustry = customIndustries.find((i) => i.id === selectedIndustry);
        if (selectedCustomIndustry) {
          customIndustryData = {
            icon: selectedCustomIndustry.iconId || 'building',
            color: selectedCustomIndustry.colorId || 'blue',
          };
        } else if (selectedIndustry?.startsWith('custom-')) {
          // Try to find in localStorage if not in state (e.g., page refresh)
          const storedCustoms = loadCustomIndustriesRaw();
          const stored = storedCustoms.find((c) => c.id === selectedIndustry);
          if (stored) {
            customIndustryData = {
              icon: stored.iconId,
              color: stored.colorId,
            };
          }
        }

        const createdProject: CreatedProjectPayload = {
          ...payload.data,
          customIndustry: customIndustryData,
        };
        
        onProjectCreated?.(createdProject);

        onClose();
        setProjectName('');
        setSelectedIndustry(null);
        setCoverImageUrl('');

        return createdProject;
      } finally {
        setIsSubmitting(false);
      }
    })();

    await toast.promise(requestPromise, {
      loading: 'Creating project...',
      success: (data) => `${data.name} has been created successfully`,
      error: (error) => error?.message || 'Failed to create project',
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAddCustomIndustry = () => {
    if (!customName.trim()) return;
    
    const selectedIcon = iconOptions.find(i => i.id === customIcon);
    const selectedColorOption = colorOptions.find(c => c.id === customColor);
    
    const newIndustry: IndustryOption = {
      id: `custom-${Date.now()}`,
      name: customName,
      icon: selectedIcon?.icon || iconOptions[0].icon,
      color: selectedColorOption?.text || 'text-blue-500',
      iconId: customIcon,
      colorId: customColor,
      bgColor: `bg-${customColor}-50`,
      bgSolid: `bg-${customColor}-500`,
    };
    
    // Save to localStorage for persistence
    saveCustomIndustry(newIndustry);
    
    setCustomIndustries([...customIndustries, newIndustry]);
    setSelectedIndustry(newIndustry.id);
    setCustomName('');
    setCustomIcon('building');
    setCustomColor('blue');
    setShowCustomIndustry(false);
  };

  const allIndustries = showMoreIndustries 
    ? [...baseIndustries, ...extendedIndustries, ...customIndustries] 
    : [...baseIndustries, ...customIndustries];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white rounded-t-xl">
          <h2 className="text-xl font-semibold text-gray-900">Create New Project</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form id="create-project-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Project name <span className="text-red-500">*</span>
            </label>
            <textarea
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              required
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Industry Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Industry</label>
            <div className="grid grid-cols-3 gap-2">
              {allIndustries.map((industry) => (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => setSelectedIndustry(industry.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                    selectedIndustry === industry.id
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={industry.color}>{industry.icon}</span>
                  <span className="text-sm text-gray-700 truncate">{industry.name}</span>
                </button>
              ))}
            </div>

            {/* Show more industries toggle */}
            <button
              type="button"
              onClick={() => setShowMoreIndustries(!showMoreIndustries)}
              className="flex items-center gap-1 mt-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showMoreIndustries ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showMoreIndustries ? 'Show less' : 'Show more industries'}
            </button>

            {/* Add custom industry button */}
            <button
              type="button"
              onClick={() => setShowCustomIndustry(!showCustomIndustry)}
              className="flex items-center gap-1.5 mt-3 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom industry
            </button>

            {/* Custom Industry Panel */}
            {showCustomIndustry && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-white">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Create Custom Industry</h3>
                
                {/* Industry Name Input */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1.5">Industry Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g., Real Estate, Agriculture"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                  />
                </div>

                {/* Icon and Color Selection */}
                <div className="flex gap-6">
                  {/* Icon Selection */}
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-2">Icon</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {iconOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setCustomIcon(option.id)}
                          className={`p-2 rounded-lg border transition-all ${
                            customIcon === option.id
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {option.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Selection */}
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-2">Color</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {colorOptions.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => setCustomColor(color.id)}
                          className={`h-8 w-8 rounded-lg ${color.bg} transition-all ${
                            customColor === color.id
                              ? 'ring-2 ring-offset-2 ring-indigo-500'
                              : 'hover:opacity-80'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom Industry Actions */}
                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomIndustry(false);
                      setCustomName('');
                      setCustomIcon('building');
                      setCustomColor('blue');
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomIndustry}
                    disabled={!customName.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Industry
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cover Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cover Image URL (optional)
            </label>
            <input
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-project-form"
            disabled={isSubmitting || !projectName.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}

// Wrapper component for Astro pages
interface NewProjectButtonProps {
  onProjectCreated?: (project: CreatedProjectPayload) => void;
}

export function NewProjectButton({ onProjectCreated }: NewProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Project
      </button>
      <CreateProjectModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onProjectCreated={onProjectCreated}
      />
    </>
  );
}
