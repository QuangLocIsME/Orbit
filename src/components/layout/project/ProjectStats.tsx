import React from "react";
import type { ProjectModel } from "../../../services/projectService";

type Props = {
  project: ProjectModel;
};

export default function ProjectStats({ project }: Props) {
  const stats = [
    { label: "Progress", value: `${project.progress ?? 0}%` },
    { label: "Documents", value: project.documentsCount ?? 0 },
    { label: "Versions", value: project.versionsCount ?? 0 },
    { label: "Members", value: project.membersCount ?? 0 },
    { label: "Open Clashes", value: project.openClashes ?? 0 },
  ];

  return (
    <section className="w-full grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">{s.label}</div>
          <div className="text-xl font-semibold mt-1">{s.value}</div>
        </div>
      ))}
    </section>
  );
}
