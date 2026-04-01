export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  thumbnail: string;
  lastVisited: string;
  category: 'favorites' | 'shared' | 'private';
  description?: string;
  progress?: number;
  teamMembers?: number;
  issues?: number;
  status?: 'active' | 'review' | 'paused' | 'completed';
  projectType?: 'construction' | 'design' | 'software' | 'research';
  isFavorite?: boolean;
  coverImage?: string;
}

export interface Folder {
  id: string;
  name: string;
  color: 'blue' | 'cyan' | 'orange' | 'purple' | 'green' | 'pink' | 'gray' | 'red';
  projectCount: number;
}

export interface Event {
  id: string;
  title: string;
  datetime: string;
  project: string;
  attendees: number;
}

export interface Task {
  id: string;
  title: string;
  project: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
}

export interface NavItem {
  title: string;
  href: string;
  icon: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}
