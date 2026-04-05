'use client';

import NavisworksClashWorkspace from './NavisworksClashWorkspace';

interface ClashesTabProps {
  /** Mongo publicId (when mapped), disk folder key, or dev sample. Empty = no API calls. */
  projectPublicId: string;
  projectDisplayName?: string;
}

export default function ClashesTab({ projectPublicId, projectDisplayName }: ClashesTabProps) {
  if (!projectPublicId.trim()) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12 text-center">
        <p className="text-base font-semibold text-[#101828]">No server project linked</p>
        <p className="mt-2 text-sm leading-relaxed text-[#6A7282]">
          There is no workspace key to call the API. After you map a project in the backend, this tab will use the
          correct publicId. Go to{' '}
          <a href="/projects" className="font-medium text-[#155DFC] underline-offset-2 hover:underline">
            Projects
          </a>{' '}
          and open a project you are a member of, or create a new project and open it from there.
        </p>
        {projectDisplayName ? (
          <p className="mt-4 text-xs text-[#99A1AF]">Viewing (demo/UI): {projectDisplayName}</p>
        ) : null}
      </div>
    );
  }

  return <NavisworksClashWorkspace projectSlug={projectPublicId} />;
}
