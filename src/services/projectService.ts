export async function getProject(projectId: string, baseUrl?: string) {
  const origin = baseUrl ? baseUrl.replace(/\/$/, "") : "";
  const url = origin + `/api/projects/${encodeURIComponent(projectId)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(`Failed to fetch project ${projectId}: ${res.status} ${text || res.statusText}`);
  }

  const data = await res.json();
  return data;
}

export type ProjectDTO = {
  projectId: string;
  projectName: string;
  description?: string;
  status?: string;
  progress?: number;
  startDate?: string;
  deadline?: string;
  documentsCount?: number;
  versionsCount?: number;
  membersCount?: number;
  openClashes?: number;
};
