import type { Notification } from '@/lib/socket';

function navigateTo(url: string) {
  window.location.href = url;
}

function getTaskUrlFromNotification(n: Notification): string | null {
  const link = String(n.link || '').trim();
  if (!link) return null;

  const taskPathMatch = link.match(/\/projects\/([^/?#]+)\/tasks\/([^/?#]+)/);
  if (taskPathMatch) {
    const [, projectId, taskId] = taskPathMatch;
    return `/projects/${projectId}?tab=tasks&taskId=${taskId}`;
  }

  const projectPathMatch = link.match(/\/projects\/([^/?#]+)/);
  if (!projectPathMatch) return null;

  const projectId = projectPathMatch[1];
  let taskId = '';
  try {
    const url = new URL(link, window.location.origin);
    taskId = url.searchParams.get('taskId') || '';
  } catch {
    taskId = '';
  }

  return taskId ? `/projects/${projectId}?tab=tasks&taskId=${taskId}` : `/projects/${projectId}?tab=tasks`;
}

function looksLikeTaskNotification(n: Notification): boolean {
  const text = `${n.title || ''} ${n.message || ''} ${n.link || ''}`.toLowerCase();
  return text.includes('/tasks/') || text.includes('task');
}

export function openNotificationTarget(n: Notification) {
  if (n.inviteData || n.id.startsWith('invite:')) {
    if (n.inviteData) {
      window.dispatchEvent(new CustomEvent('orbit:show-invite-dialog', { detail: n.inviteData }));
    }
    return;
  }

  if (looksLikeTaskNotification(n)) {
    const taskUrl = getTaskUrlFromNotification(n);
    if (taskUrl) {
      navigateTo(taskUrl);
      return;
    }
  }

  if (n.link) navigateTo(n.link);
}
