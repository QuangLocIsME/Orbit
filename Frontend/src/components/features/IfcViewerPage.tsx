'use client';

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api-client';
import { useMeasureDistance } from '@/hooks/useMeasureDistance';

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

class IfcViewerErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[IfcViewerPage]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0B1220] text-white p-6">
          <h1 className="text-lg font-semibold">Viewer failed to load</h1>
          <p className="mt-2 text-sm text-red-200">{this.state.error.message}</p>
          <p className="mt-4 text-xs text-slate-400">
            Try a hard refresh (Ctrl+Shift+R). If this persists, unregister the site Service Worker in browser
            DevTools → Application.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function IfcViewerPage(props: IfcViewerPageProps) {
  return (
    <IfcViewerErrorBoundary>
      <IfcViewerPageInner {...props} />
    </IfcViewerErrorBoundary>
  );
}

function IfcViewerPageInner({ projectId, fileId, versionId }: IfcViewerPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<unknown>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState('');
  const [modelName, setModelName] = useState('');
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);

  const {
    isActive: measureActive,
    measurements,
    activateMeasurement,
    deactivateMeasurement,
    clearAllMeasurements,
    removeMeasurement,
    formatDistance,
    onViewerReady,
  } = useMeasureDistance({ viewerRef });

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
        onViewerReady();

        const xktLoader = new XKT.XKTLoaderPlugin(viewer);

        const sceneModel = xktLoader.load({
          id: versionId,
          src: modelUrl,
          edges: true,
          backfaces: true,
        });

        await new Promise<void>((resolve, reject) => {
          sceneModel.once('error', (msg: unknown) => {
            reject(new Error(typeof msg === 'string' ? msg : 'Failed to load XKT model'));
          });
          sceneModel.once('loaded', () => resolve());
        });

        if (!mounted) return;

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

  const toggleMeasure = () => {
    if (measureActive) {
      deactivateMeasurement();
    } else {
      activateMeasurement();
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && measureActive) {
      deactivateMeasurement();
    }
  }, [measureActive, deactivateMeasurement]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-[1600px] p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{modelName || 'IFC Viewer'}</h1>
            <p className="text-xs text-gray-400">Project {projectId}</p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMeasure}
              disabled={status !== 'ready'}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${measureActive
                  ? 'bg-[#4F39F6] text-white shadow-sm'
                  : 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/20'
                }
                ${status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title="Click two points on the model to measure distance"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
              </svg>
              {measureActive ? 'Measuring...' : 'Measure Distance'}
            </button>

            {measureActive && (
              <button
                onClick={deactivateMeasurement}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition-all"
              >
                Cancel
              </button>
            )}

            <button
              onClick={() => setShowMeasurePanel((v) => !v)}
              disabled={status !== 'ready'}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${showMeasurePanel
                  ? 'bg-[#4F39F6]/20 text-[#A5B4FC] border border-[#4F39F6]/40'
                  : 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/20'
                }
                ${status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              Results
              {measurements.length > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#4F39F6] text-white text-[10px]">
                  {measurements.length}
                </span>
              )}
            </button>

            {measurements.length > 0 && (
              <button
                onClick={clearAllMeasurements}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 border border-white/20 text-red-300 hover:bg-red-500/20 transition-all"
              >
                Clear All
              </button>
            )}

            <div className="ml-4 flex items-center gap-4 text-xs text-gray-400">
              <span>Orbit: Left click + drag</span>
              <span>Pan: Right click + drag</span>
              <span>Zoom: Scroll</span>
            </div>
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

        {/* Canvas + Measurement Panel Layout */}
        <div className="flex gap-3">
          {/* 3D Canvas */}
          <canvas
            ref={canvasRef}
            style={{
              flex: 1,
              height: '78vh',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'block',
            }}
          />

          {/* Measurement Results Panel */}
          {showMeasurePanel && status === 'ready' && (
            <div className="w-72 bg-[#131a2b] rounded-xl border border-white/10 overflow-y-auto shrink-0">
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="text-[13px] font-semibold text-white">Measurement Results</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {measurements.length > 0
                    ? `${measurements.length} measurement${measurements.length > 1 ? 's' : ''}`
                    : 'No measurements yet'
                  }
                </p>
              </div>

              {measurements.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <svg className="h-10 w-10 text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                  <p className="text-[12px] text-gray-400 font-medium">No measurements yet</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Click the Measure Distance button, then click two points on the model.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {measurements.map((m, i) => (
                    <div key={m.id} className="px-4 py-3 hover:bg-white/5 transition-colors group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium text-[#A5B4FC] bg-[#4F39F6]/20 px-2 py-0.5 rounded">
                          #{i + 1}
                        </span>
                        <button
                          onClick={() => removeMeasurement(m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-red-300"
                          title="Remove this measurement"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-[18px] font-bold text-white">{formatDistance(m.distance)}</span>
                        <span className="text-[11px] text-gray-400">total distance</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="flex flex-col items-center p-1.5 bg-white/5 rounded">
                          <span className="text-[10px] text-gray-500">X</span>
                          <span className="text-[11px] font-medium text-red-400">{formatDistance(m.xDistance)}</span>
                        </div>
                        <div className="flex flex-col items-center p-1.5 bg-white/5 rounded">
                          <span className="text-[10px] text-gray-500">Y</span>
                          <span className="text-[11px] font-medium text-green-400">{formatDistance(m.yDistance)}</span>
                        </div>
                        <div className="flex flex-col items-center p-1.5 bg-white/5 rounded">
                          <span className="text-[10px] text-gray-500">Z</span>
                          <span className="text-[11px] font-medium text-blue-400">{formatDistance(m.zDistance)}</span>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500 font-mono">
                        <div><span className="text-red-400/70">From X:</span> {m.from[0].toFixed(3)}</div>
                        <div><span className="text-red-400/70">To X:</span> {m.to[0].toFixed(3)}</div>
                        <div><span className="text-green-400/70">From Y:</span> {m.from[1].toFixed(3)}</div>
                        <div><span className="text-green-400/70">To Y:</span> {m.to[1].toFixed(3)}</div>
                        <div><span className="text-blue-400/70">From Z:</span> {m.from[2].toFixed(3)}</div>
                        <div><span className="text-blue-400/70">To Z:</span> {m.to[2].toFixed(3)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {measurements.length > 1 && (
                <div className="px-4 py-3 border-t border-white/10 bg-white/5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Total measurements</span>
                    <span className="font-semibold text-white">{measurements.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-gray-400">Longest</span>
                    <span className="font-semibold text-white">
                      {formatDistance(Math.max(...measurements.map((m) => m.distance)))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-gray-400">Shortest</span>
                    <span className="font-semibold text-white">
                      {formatDistance(Math.min(...measurements.map((m) => m.distance)))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
