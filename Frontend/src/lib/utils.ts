import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function isToday(date: string | Date): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function isTomorrow(date: string | Date): boolean {
  const d = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

export function getRelativeDate(date: string | Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return formatDate(date);
}
