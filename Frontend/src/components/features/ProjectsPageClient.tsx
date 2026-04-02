'use client';

import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import ProjectsManager from '@/components/features/ProjectsManager';

export default function ProjectsPageClient() {
  return (
    <ReactQueryProvider>
      <ProjectsManager />
    </ReactQueryProvider>
  );
}
