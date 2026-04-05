'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type LoadStatus = 'loading' | 'ready' | 'error';

interface IfcViewerPageProps {
  projectId: string;
  fileId: string;
  versionId: string;
}

export default function IfcViewerPage({ projectId, fileId, versionId }: IfcViewerPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState('');

  const modelEndpoint = useMemo(
    () => `/api/projects/packages/viewer/projects/${projectId}/files/${fileId}/versions/${versionId}/model`,
    [projectId, fileId, versionId]
  );

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    const load = async () => {
      try {
        setStatus('loading');
        setError('');

        const res = await apiFetch(modelEndpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.message || 'Model is not ready');
        }

        const modelUrl = payload?.data?.modelUrl;
        if (!modelUrl) {
          throw new Error('Missing model URL');
        }

        const module = await import('@xeokit/xeokit-bim-viewer');
        const BimViewer = (module as any)?.BIMViewer || (module as any)?.default;

        if (!BimViewer || !containerRef.current || !mounted) {
          throw new Error('Unable to initialize xeokit viewer');
        }

        const viewer = new BimViewer({
          containerElement: containerRef.current,
        });

        await viewer.loadModel({
          id: versionId,
          src: modelUrl,
        });

        cleanup = () => {
          try {
            viewer.destroy?.();
          } catch {
            // noop
          }
        };

        if (mounted) {
          setStatus('ready');
        }
      } catch (e: any) {
        if (!mounted) return;
        setStatus('error');
        setError(e?.message || 'Failed to load model');
      }
    };

    load();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [modelEndpoint, versionId]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-[1400px] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">IFC Viewer</h1>
          <span className="text-xs text-gray-300">Project {projectId} · File {fileId} · Version {versionId}</span>
        </div>

        {status === 'loading' && (
          <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-blue-200">
            Model is being prepared and loaded...
          </div>
        )}

        {status === 'error' && (
          <div className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error || 'Model is not ready yet. Please try again later.'}
          </div>
        )}

        <div ref={containerRef} className="h-[78vh] w-full overflow-hidden rounded-xl border border-white/10 bg-black" />
      </div>
    </div>
  );
}
