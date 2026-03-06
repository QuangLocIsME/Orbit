import React from "react";
import type { ProjectModel } from "../../../services/projectService";

type Props = {
  project: ProjectModel;
};

export default function ProjectHeader({ project }: Props) {
  return (
    <header className="w-full mb-6">
      <div className="bg-gray-100 rounded-lg overflow-hidden">
        <div className="relative h-64 w-full">
          <img
            src={(project as any).cover ?? "/images/sample.jpg"}
            alt={project.projectName}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <div className="absolute left-6 bottom-6 text-white max-w-3xl">
            <div className="flex items-center gap-3 text-sm text-white/90 mb-2">
              <img src="/icons/clock.svg" alt="meta" className="w-4 h-4" />
              <span>{`Last updated: ${project.startDate ?? "-"}`}</span>
            </div>

            <h1 className="text-3xl font-semibold leading-tight">{project.projectName}</h1>
            <p className="text-base text-white/90 mt-1">{project.description}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
