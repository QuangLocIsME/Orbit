import { apiFetch } from "@/lib/api-client";

export async function getProject(projectId: string) {

  const res = await apiFetch(`/projects/${encodeURIComponent(projectId)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(
      `Failed to fetch project ${projectId}: ${res.status} ${text || res.statusText}`
    );
  }

  return res.json();
}