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

    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://cdn.jsdelivr.net/npm/@xeokit/xeokit-sdk@2.6.108/dist/xeokit-sdk.es.js';
    script.onload = () => {
      clearTimeout(timeout);
      import(script.src)
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

        console.log('[IfcViewer] Step 1: Fetching model URL', { modelEndpoint });

        // 1. Fetch model URL from backend
        const res = await apiFetch(modelEndpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        console.log('[IfcViewer] Step 2: API response', { status: res.status });

        const payload = await res.json().catch(() => null);
        console.log('[IfcViewer] Step 3: API payload', payload);

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

        console.log('[IfcViewer] Step 4: Got model URL', { modelUrl });
        setModelName(originalName || versionId);

        // 2. Load xeokit SDK from CDN
        const XKT = await loadXeokitSdk();
        console.log('[IfcViewer] Step 5: SDK loaded', { XKT_keys: Object.keys(XKT).slice(0, 10) });

        if (!XKT.Viewer) {
          throw new Error(`xeokit SDK missing Viewer. Keys: ${Object.keys(XKT).slice(0, 5).join(', ')}`);
        }

        if (!mounted || !canvasRef.current) return;

        const canvas = canvasRef.current;

        // Wait until layout has non-zero size (otherwise WebGL buffer stays ~0×0 and fit fails)
        await new Promise<void>((resolve, reject) => {
          const ok = () => canvas.clientWidth > 0 && canvas.clientHeight > 0;
          console.log('[IfcViewer] Canvas size check', { w: canvas.clientWidth, h: canvas.clientHeight, ok: ok() });
          if (ok()) {
            resolve();
            return;
          }
          const t = window.setTimeout(() => {
            ro.disconnect();
            reject(new Error('Viewer canvas has no size — check layout/CSS'));
          }, 10000);
          const ro = new ResizeObserver(() => {
            if (ok()) {
              window.clearTimeout(t);
              ro.disconnect();
              resolve();
            }
          });
          ro.observe(canvas);
          requestAnimationFrame(() => {
            if (ok()) {
              window.clearTimeout(t);
              ro.disconnect();
              resolve();
            }
          });
        });

        if (!mounted || !canvasRef.current) return;

        // 3. Create viewer (opaque canvas so background matches UI even without Tailwind)
        console.log('[IfcViewer] Step 6: Creating viewer');
        const viewer = new XKT.Viewer({
          canvasElement: canvas,
          transparent: false,
          backgroundColor: [0.05, 0.07, 0.125],
        });
        viewerRef.current = viewer;
        console.log('[IfcViewer] Step 7: Viewer created', { viewer });

        // 4. Load the XKT model (load() returns immediately; geometry loads asynchronously)
        console.log('[IfcViewer] Step 8: Loading XKT model', { src: modelUrl });
        const xktLoader = new XKT.XKTLoaderPlugin(viewer);
        console.log('[IfcViewer] XKTLoaderPlugin created', { xktLoader });

        const sceneModel = xktLoader.load({
          id: versionId,
          src: modelUrl,
          edges: true,
          backfaces: true,
        });
        console.log('[IfcViewer] Step 9: sceneModel loaded (async)', { sceneModel });

        await new Promise<void>((resolve, reject) => {
          sceneModel.once('error', (msg: unknown) => {
            console.error('[IfcViewer] sceneModel ERROR event', msg);
            reject(new Error(typeof msg === 'string' ? msg : 'Failed to load XKT model'));
          });
          sceneModel.once('loaded', () => {
            console.log('[IfcViewer] sceneModel LOADED event');
            resolve();
          });
          // Also log progress
          sceneModel.once('progress', (info: unknown) => {
            console.log('[IfcViewer] sceneModel PROGRESS', info);
          });
        });

        if (!mounted) return;

        console.log('[IfcViewer] Step 10: Model loaded, fitting camera');

        // Fit camera to the loaded model after AABB & canvas are stable (avoids default camera "inside" mesh)
        await new Promise<void>((requestAnimationFrameResolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                const aabb = sceneModel.aabb as number[] | undefined;
                console.log('[IfcViewer] Model AABB', aabb);
                const valid =
                  aabb &&
                  aabb.length === 6 &&
                  aabb[3] > aabb[0] &&
                  aabb[4] > aabb[1] &&
                  aabb[5] > aabb[2];
                // jumpTo() ignores params.component; use explicit aabb so fit targets this model only
                if (valid) {
                  console.log('[IfcViewer] jumpTo with AABB', { aabb, fit: true, fitFOV: 50 });
                  viewer.cameraFlight.jumpTo({ aabb, fit: true, fitFOV: 50 });
                } else {
                  console.log('[IfcViewer] jumpTo with scene (fallback)');
                  viewer.cameraFlight.jumpTo(viewer.scene);
                }
              } catch (err) {
                console.error('[IfcViewer] jumpTo error', err);
                viewer.cameraFlight.jumpTo(viewer.scene);
              }
              requestAnimationFrameResolve();
            });
          });
        });

        if (mounted) setStatus('ready');
      } catch (e: unknown) {
        console.error('[IfcViewer] FATAL ERROR', e);
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
