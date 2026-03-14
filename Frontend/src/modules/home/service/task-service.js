import { apiFetch } from "@/lib/api-client";

export async function getUserTasks() {
  try {
    const res = await apiFetch("/dashboard/tasks");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
