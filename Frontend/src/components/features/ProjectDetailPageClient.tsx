'use client';

import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import ProjectDetailPage from '@/components/features/ProjectDetailPage';
import type { Project } from '@/types';

interface ProjectDetailPageClientProps {
  project: Project;
}

export default function ProjectDetailPageClient({ project }: ProjectDetailPageClientProps) {
  return (
    <ReactQueryProvider>
      <ProjectDetailPage project={project} />
    </ReactQueryProvider>
  );
}
