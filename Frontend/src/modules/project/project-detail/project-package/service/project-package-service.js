import { packages } from "@/pages/api/project-package/packages";

/**
 * lấy danh sách packages
 */
export async function getProjectPackages(projectId) {
  return packages;
}

/**
 * lấy thống kê packages
 */
export async function getPackageStats(projectId) {

  const total = packages.length;

  const active = packages.filter(p => p.status === "active").length;
  const completed = packages.filter(p => p.status === "completed").length;
  const onHold = packages.filter(p => p.status === "onHold").length;

  return {
    total,
    active,
    completed,
    onHold
  };
}