'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useMeasureDistance, type Measurement } from '@/hooks/useMeasureDistance';

type LoadStatus = 'loading' | 'ready' | 'error';

interface XktViewerDialogProps {
  projectId: string;
  fileId: string;
  versionId: string;
  fileName: string;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XKTExports = any;

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

export default function XktViewerDialog({ projectId, fileId, versionId, fileName, onClose }: XktViewerDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<unknown>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState('');
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);

  const {
    isActive: measureActive,
    isPluginReady: measurePluginReady,
    pluginError,
    measurements,
    activateMeasurement,
    deactivateMeasurement,
    clearAllMeasurements,
    removeMeasurement,
    formatDistance,
    onViewerReady,
  } = useMeasureDistance({ viewerRef });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setStatus('loading');
        setError('');

        const res = await apiFetch(
          `/api/projects/packages/viewer/projects/${projectId}/files/${fileId}/versions/${versionId}/model`,
          { method: 'GET', headers: { Accept: 'application/json' } }
        );
        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload?.success) {
          const msg = payload?.message || `API error ${res.status}`;
          if (res.status === 401 || res.status === 403) {
            throw new Error('Session expired. Please log in to view this model.');
          }
          throw new Error(msg);
        }

        const modelUrl: string = payload?.data?.modelUrl;
        if (!modelUrl) throw new Error('Missing model URL from backend');

        const XKT = await loadXeokitSdk();
        if (!XKT.Viewer) throw new Error('Failed to load 3D viewer library');
        if (!mounted || !canvasRef.current) return;

        const canvas = canvasRef.current;

        await new Promise<void>((resolve, reject) => {
          if (canvas.clientWidth > 0 && canvas.clientHeight > 0) { resolve(); return; }
          const t = window.setTimeout(() => { ro.disconnect(); reject(new Error('Canvas has no size')); }, 10000);
          const ro = new ResizeObserver(() => {
            if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
              window.clearTimeout(t); ro.disconnect(); resolve();
            }
          });
          ro.observe(canvas);
          requestAnimationFrame(() => {
            if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
              window.clearTimeout(t); ro.disconnect(); resolve();
            }
          });
        });

        if (!mounted || !canvasRef.current) return;

        const viewer = new XKT.Viewer({ canvasElement: canvas, transparent: false, backgroundColor: [0.05, 0.07, 0.125] });
        viewerRef.current = viewer;
        onViewerReady();

        const xktLoader = new XKT.XKTLoaderPlugin(viewer);
        const sceneModel = xktLoader.load({ id: versionId, src: modelUrl, edges: true, backfaces: true });

        await new Promise<void>((resolve, reject) => {
          sceneModel.once('error', (msg: unknown) => reject(new Error(typeof msg === 'string' ? msg : 'Failed to load XKT')));
          sceneModel.once('loaded', () => resolve());
        });

        if (!mounted) return;

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                const aabb = sceneModel.aabb as number[] | undefined;
                const valid = aabb && aabb.length === 6 && aabb[3] > aabb[0] && aabb[4] > aabb[1] && aabb[5] > aabb[2];
                if (valid) viewer.cameraFlight.jumpTo({ aabb, fit: true, fitFOV: 50 });
                else viewer.cameraFlight.jumpTo(viewer.scene);
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
        } catch { /* noop */ }
        viewerRef.current = null;
      }
    };
  }, [projectId, fileId, versionId]);

  const toggleMeasure = () => {
    if (measureActive) {
      deactivateMeasurement();
    } else {
      activateMeasurement();
    }
  };

  const toggleMeasurePanel = () => {
    setShowMeasurePanel((v) => !v);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="relative z-10 flex flex-col bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] mx-4"
        style={{ width: 'min(1100px, 95vw)', height: 'min(800px, 90vh)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] shrink-0 rounded-t-[10px] bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF2FF]">
              <svg className="h-4 w-4 text-[#4F39F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold text-[#101828] truncate">{fileName}</h2>
              <p className="text-[12px] text-[#6A7282]">3D Model Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-4 text-[11px] text-[#9CA3AF]">
              <span>Orbit: Left click + drag</span>
              <span>Pan: Right click + drag</span>
              <span>Zoom: Scroll</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-[#E5E7EB] bg-[#F9FAFB] shrink-0">
          {/* Measure Distance Toggle */}
          <button
            onClick={toggleMeasure}
            disabled={status !== 'ready'}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
              ${measureActive
                ? 'bg-[#4F39F6] text-white shadow-sm'
                : 'bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]'
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6] transition-all"
            >
              Cancel
            </button>
          )}

          {/* Measurement Panel Toggle */}
          <button
            onClick={toggleMeasurePanel}
            disabled={status !== 'ready'}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
              ${showMeasurePanel
                ? 'bg-[#EEF2FF] text-[#4F39F6] border border-[#4F39F6]/30'
                : 'bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]'
              }
              ${status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title="Toggle measurement results panel"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white border border-[#D1D5DB] text-[#DC2626] hover:bg-red-50 transition-all"
            >
              Clear All
            </button>
          )}

          <div className="ml-auto text-[11px] text-[#9CA3AF]">
            {measureActive && <span className="text-[#4F39F6] font-medium">Click first point, then second point to measure</span>}
          </div>
        </div>

        {/* Status banner */}
        {status === 'loading' && (
          <div className="flex items-center gap-3 px-5 py-3 bg-[#EEF2FF] border-b border-[#E5E7EB]">
            <svg className="h-4 w-4 animate-spin text-[#4F39F6]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-[13px] text-[#4F39F6]">Loading model from Supabase...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-2 px-5 py-4 bg-[#FEE2E2] border-b border-[#FCA5A5]">
            <div className="flex items-start gap-3">
              <svg className="h-4 w-4 text-[#DC2626] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <div>
                <p className="text-[13px] font-medium text-[#DC2626]">Failed to load 3D model</p>
                <p className="text-[12px] text-[#B91C1C] mt-1">{error}</p>
                <p className="text-[12px] text-[#991B1B] mt-1">
                  The model may still be converting or the file has not been approved yet.
                  {error.includes('document ID does not exist') && ' Try re-uploading the file.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <div className="flex items-center gap-3 px-5 py-2 bg-[#ECFDF5] border-b border-[#A7F3D0]">
            <svg className="h-4 w-4 text-[#007A55]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-[12px] text-[#007A55]">
              Model loaded — use mouse to orbit, pan, and zoom
              {measureActive && <span className="ml-2 font-medium text-[#4F39F6]">| Click two points to measure</span>}
            </span>
          </div>
        )}

        {/* Canvas + Measurement Panel */}
        <div className="flex flex-1 min-h-0">
          {/* 3D Canvas */}
          <div className="flex-1 min-h-0 bg-[#0B1220] rounded-bl-[10px]" style={{ borderRadius: showMeasurePanel ? '0 0 0 10px' : undefined }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ display: 'block', borderRadius: showMeasurePanel ? '0 0 0 10px' : '0 0 10px 10px' }}
            />
          </div>

          {/* Measurement Results Panel */}
          {showMeasurePanel && status === 'ready' && (
            <div className="w-72 border-l border-[#E5E7EB] bg-white overflow-y-auto shrink-0">
              <div className="px-4 py-3 border-b border-[#E5E7EB]">
                <h3 className="text-[13px] font-semibold text-[#101828]">Measurement Results</h3>
                <p className="text-[11px] text-[#6A7282] mt-0.5">
                  {measurements.length > 0
                    ? `${measurements.length} measurement${measurements.length > 1 ? 's' : ''}`
                    : 'No measurements yet'
                  }
                </p>
              </div>

              {measurements.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <svg className="h-10 w-10 text-[#D1D5DB] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                  <p className="text-[12px] text-[#6A7282] font-medium">No measurements yet</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    Click the Measure Distance button, then click two points on the model.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {measurements.map((m, i) => (
                    <div key={m.id} className="px-4 py-3 hover:bg-[#F9FAFB] transition-colors group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium text-[#4F39F6] bg-[#EEF2FF] px-2 py-0.5 rounded">
                          #{i + 1}
                        </span>
                        <button
                          onClick={() => removeMeasurement(m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-[#DC2626]"
                          title="Remove this measurement"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>

                      {/* Main distance */}
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-[18px] font-bold text-[#101828]">{formatDistance(m.distance)}</span>
                        <span className="text-[11px] text-[#6A7282]">total distance</span>
                      </div>

                      {/* Axis distances */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="flex flex-col items-center p-1.5 bg-[#F3F4F6] rounded">
                          <span className="text-[10px] text-[#9CA3AF]">X</span>
                          <span className="text-[11px] font-medium text-[#DC2626]">{formatDistance(m.xDistance)}</span>
                        </div>
                        <div className="flex flex-col items-center p-1.5 bg-[#F3F4F6] rounded">
                          <span className="text-[10px] text-[#9CA3AF]">Y</span>
                          <span className="text-[11px] font-medium text-[#22C55E]">{formatDistance(m.yDistance)}</span>
                        </div>
                        <div className="flex flex-col items-center p-1.5 bg-[#F3F4F6] rounded">
                          <span className="text-[10px] text-[#9CA3AF]">Z</span>
                          <span className="text-[11px] font-medium text-[#3B82F6]">{formatDistance(m.zDistance)}</span>
                        </div>
                      </div>

                      {/* Coordinate details */}
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-[#9CA3AF] font-mono">
                        <div>
                          <span className="text-[#DC2626]">From X:</span> {m.from[0].toFixed(3)}
                        </div>
                        <div>
                          <span className="text-[#DC2626]">To X:</span> {m.to[0].toFixed(3)}
                        </div>
                        <div>
                          <span className="text-[#22C55E]">From Y:</span> {m.from[1].toFixed(3)}
                        </div>
                        <div>
                          <span className="text-[#22C55E]">To Y:</span> {m.to[1].toFixed(3)}
                        </div>
                        <div>
                          <span className="text-[#3B82F6]">From Z:</span> {m.from[2].toFixed(3)}
                        </div>
                        <div>
                          <span className="text-[#3B82F6]">To Z:</span> {m.to[2].toFixed(3)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {measurements.length > 1 && (
                <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#6A7282]">Total measurements</span>
                    <span className="font-semibold text-[#101828]">{measurements.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-[#6A7282]">Longest</span>
                    <span className="font-semibold text-[#101828]">
                      {formatDistance(Math.max(...measurements.map((m) => m.distance)))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-[#6A7282]">Shortest</span>
                    <span className="font-semibold text-[#101828]">
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
