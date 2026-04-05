'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type LoadStatus = 'loading' | 'ready' | 'error';

interface IfcViewerPageProps {
  projectId: string;
  fileId: string;
  versionId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XKTExports = any;

/** Load xeokit SDK from CDN and resolve with the module namespace. */
async function loadXeokitSdk(): Promise<XKTExports> {
  const win = window as Window & { XKT?: XKTExports };
  if (win.XKT) return win.XKT;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('SDK load timed out after 20s'));
    }, 20000);

    const SDK_URL = 'https://cdn.jsdelivr.net/npm/@xeokit/xeokit-sdk@2.6.108/dist/xeokit-sdk.es.js';
    const script = document.createElement('script');
    script.type = 'module';
    script.src = SDK_URL;
    script.onload = () => {
      clearTimeout(timeout);
      // Suppress Vite dynamic-import-vars warning — URL is fixed at runtime
      import(/* @vite-ignore */ SDK_URL)
        .then((mod) => {
          if (mod && typeof mod === 'object' && Object.keys(mod).length > 0) {
            win.XKT = mod as XKTExports;
            resolve(win.XKT);
          } else {
            reject(new Error('SDK import returned empty module'));
          }
        })
        .catch((err) => reject(new Error(`SDK import failed: ${err?.message || String(err)}`)));
    };
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('SDK script failed to load from CDN'));
    };
    document.head.appendChild(script);
  });
}

export default function IfcViewerPage({ projectId, fileId, versionId }: IfcViewerPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<unknown>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState('');
  const [modelName, setModelName] = useState('');

  const modelEndpoint = useMemo(
    () => `/api/projects/packages/viewer/projects/${projectId}/files/${fileId}/versions/${versionId}/model`,
    [projectId, fileId, versionId]
  );

  useEffect(() => {
    let mounted = true;

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
          const msg = payload?.message || `API error ${res.status}`;
          if (res.status === 401 || res.status === 403) {
            throw new Error('Session expired. Please log in to view this model.');
          }
          throw new Error(msg);
        }

        const modelUrl: string = payload?.data?.modelUrl;
        const originalName: string = payload?.data?.originalName;
        if (!modelUrl) throw new Error('Missing model URL from backend');

        setModelName(originalName || versionId);

        const XKT = await loadXeokitSdk();

        if (!XKT.Viewer) {
          throw new Error('Failed to load 3D viewer library');
        }

        if (!mounted || !canvasRef.current) return;
        const canvas = canvasRef.current;

        // Wait until layout has non-zero size (otherwise WebGL buffer stays ~0×0 and fit fails)
        await new Promise<void>((resolve, reject) => {
          if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            resolve();
            return;
          }
          const t = window.setTimeout(() => {
            ro.disconnect();
            reject(new Error('Viewer canvas has no size — check layout/CSS'));
          }, 10000);
          const ro = new ResizeObserver(() => {
            if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
              window.clearTimeout(t);
              ro.disconnect();
              resolve();
            }
          });
          ro.observe(canvas);
          requestAnimationFrame(() => {
            if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
              window.clearTimeout(t);
              ro.disconnect();
              resolve();
            }
          });
        });

        if (!mounted || !canvasRef.current) return;

        const viewer = new XKT.Viewer({
          canvasElement: canvas,
          transparent: false,
          backgroundColor: [0.05, 0.07, 0.125],
        });
        viewerRef.current = viewer;

        const xktLoader = new XKT.XKTLoaderPlugin(viewer);

        const sceneModel = xktLoader.load({
          id: versionId,
          src: modelUrl,
          edges: true,
          backfaces: true,
        });

        // Wait for geometry to load before fitting camera
        await new Promise<void>((resolve, reject) => {
          sceneModel.once('error', (msg: unknown) => {
            reject(new Error(typeof msg === 'string' ? msg : 'Failed to load XKT model'));
          });
          sceneModel.once('loaded', () => resolve());
        });

        if (!mounted) return;

        // Fit camera to model
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                const aabb = sceneModel.aabb as number[] | undefined;
                const valid =
                  aabb &&
                  aabb.length === 6 &&
                  aabb[3] > aabb[0] &&
                  aabb[4] > aabb[1] &&
                  aabb[5] > aabb[2];
                if (valid) {
                  viewer.cameraFlight.jumpTo({ aabb, fit: true, fitFOV: 50 });
                } else {
                  viewer.cameraFlight.jumpTo(viewer.scene);
                }
              } catch {
                viewer.cameraFlight.jumpTo(viewer.scene);
              }
              resolve();
            });
          });
        });

        if (mounted) setStatus('ready');
      } catch (e: unknown) {
        if (!mounted) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Failed to load model');
      }
    };

    load();

    return () => {
      mounted = false;
      if (viewerRef.current) {
        try {
          const v = viewerRef.current as { destroy?: () => void };
          v.destroy?.();
        } catch {
          // noop
        }
        viewerRef.current = null;
      }
    };
  }, [modelEndpoint, versionId]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-[1600px] p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{modelName || 'IFC Viewer'}</h1>
            <p className="text-xs text-gray-400">Project {projectId}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Orbit: Left click + drag</span>
            <span>Pan: Right click + drag</span>
            <span>Zoom: Scroll</span>
          </div>
        </div>

        {/* Status banner */}
        {status === 'loading' && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Loading model from Supabase...
          </div>
        )}

        {status === 'error' && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error || 'Model is not ready yet. Please try again later.'}
          </div>
        )}

        {/* 3D Canvas */}
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '78vh',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}
