'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Measurement {
  id: string;
  distance: number;
  from: [number, number, number];
  to: [number, number, number];
  xDistance: number;
  yDistance: number;
  zDistance: number;
}

export interface UseMeasureDistanceOptions {
  /** Shared viewerRef from the parent component. */
  viewerRef: React.MutableRefObject<unknown>;
  units?: string;
}

type XKTMeasurement = {
  id?: string;
  length?: number;
  origin?: { worldPos?: number[] };
  target?: { worldPos?: number[] };
};

type PluginControl = {
  activate: () => void;
  deactivate: () => void;
  readonly active: boolean;
  snapping: boolean;
};

type PluginInstance = {
  createMeasurement: (cfg: {
    id: string;
    origin: { entity: unknown; worldPos: number[] };
    target: { entity: unknown; worldPos: number[] };
    visible?: boolean;
    originVisible?: boolean;
    targetVisible?: boolean;
    wireVisible?: boolean;
    axisVisible?: boolean;
    color?: string;
    labelsOnWires?: boolean;
  }) => XKTMeasurement;
  destroyMeasurement: (id: string) => void;
  clear: () => void;
  get measurements(): Record<string, XKTMeasurement>;
  readonly control: PluginControl;
  on: (event: string, callback: (measurement: XKTMeasurement) => void) => string;
  destroy: () => void;
};

export function useMeasureDistance({ viewerRef, units = 'm' }: UseMeasureDistanceOptions) {
  const [isActive, setIsActive] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isPluginReady, setIsPluginReady] = useState(false);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [viewerVersion, setViewerVersion] = useState(0);

  const pluginRef = useRef<PluginInstance | null>(null);
  /** Store event listener IDs so we can remove them on cleanup. */
  const listenerIdsRef = useRef<string[]>([]);

  const formatDistance = useCallback(
    (meters: number): string => {
      if (meters < 0.01) {
        return `${(meters * 1000).toFixed(2)} mm`;
      }
      if (meters < 1) {
        return `${(meters * 100).toFixed(1)} cm`;
      }
      return `${meters.toFixed(3)} ${units}`;
    },
    [units]
  );

  const syncMeasurements = useCallback((plugin: PluginInstance) => {
    const list = plugin.measurements;
    const items: Measurement[] = Object.entries(list).map(([id, m]) => {
      // plugin.measurements values are DistanceMeasurement class instances.
      // length = direct distance, origin/target.worldPos = world coordinates.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meas = m as any;
      const originPos: [number, number, number] = meas?.origin?.worldPos ?? [0, 0, 0];
      const targetPos: [number, number, number] = meas?.target?.worldPos ?? [0, 0, 0];
      return {
        id: meas?.id ?? id,
        distance: meas?.length ?? 0,
        from: originPos,
        to: targetPos,
        xDistance: Math.abs(originPos[0] - targetPos[0]),
        yDistance: Math.abs(originPos[1] - targetPos[1]),
        zDistance: Math.abs(originPos[2] - targetPos[2]),
      };
    });
    setMeasurements(items);
  }, []);

  const destroyPlugin = useCallback(() => {
    const plugin = pluginRef.current;
    if (!plugin) return;
    try {
      plugin.control?.deactivate?.();
    } catch { /* ignore */ }
    try {
      plugin.clear?.();
    } catch { /* ignore */ }
    try {
      plugin.destroy?.();
    } catch { /* ignore */ }
    pluginRef.current = null;
    listenerIdsRef.current = [];
    setIsPluginReady(false);
  }, []);

  /** Init DistanceMeasurementsPlugin and wire up events. */
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const viewer = viewerRef.current;
      if (!viewer) {
        console.log('[useMeasureDistance] Viewer not ready yet');
        return;
      }

      destroyPlugin();

      try {
        const xeokit = await import('@xeokit/xeokit-sdk');
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ns = xeokit as any;
        const PluginCtor = ns.DistanceMeasurementsPlugin;

        console.log(
          '[useMeasureDistance] Available measure exports:',
          Object.keys(ns).filter((k: string) => k.toLowerCase().includes('measure'))
        );

        if (!PluginCtor) {
          console.error('[useMeasureDistance] DistanceMeasurementsPlugin not found in SDK');
          setPluginError('DistanceMeasurementsPlugin not available');
          return;
        }

        const plugin = new PluginCtor(viewer) as PluginInstance;

        // Wire up events so the results panel stays in sync.
        const ids: string[] = [];
        ids.push(plugin.on('measurementCreated', () => syncMeasurements(plugin)));
        ids.push(plugin.on('measurementEnd', () => syncMeasurements(plugin)));
        ids.push(plugin.on('measurementDestroyed', () => syncMeasurements(plugin)));
        ids.push(plugin.on('measurementCancel', () => syncMeasurements(plugin)));
        listenerIdsRef.current = ids;

        pluginRef.current = plugin;
        console.log('[useMeasureDistance] Plugin created. Keys:', Object.keys(plugin));
        setIsPluginReady(true);
        setPluginError(null);
      } catch (err) {
        console.error('[useMeasureDistance] Init failed:', err);
        setPluginError(String(err));
      }
    };

    void init();

    return () => {
      cancelled = true;
      destroyPlugin();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerVersion]);

  const activateMeasurement = useCallback(() => {
    const plugin = pluginRef.current;
    if (!plugin) {
      console.warn('[useMeasureDistance] Plugin not ready yet');
      return;
    }
    try {
      plugin.control.activate();
      setIsActive(true);
      console.log('[useMeasureDistance] Measurement mode activated');
    } catch (e) {
      console.error('[useMeasureDistance] activate failed:', e);
    }
  }, []);

  const deactivateMeasurement = useCallback(() => {
    const plugin = pluginRef.current;
    if (!plugin) return;
    try {
      plugin.control?.deactivate?.();
      setIsActive(false);
    } catch (e) {
      console.error('[useMeasureDistance] deactivate failed:', e);
    }
  }, []);

  const addMeasurement = useCallback(
    (from: [number, number, number], to: [number, number, number], label?: string) => {
      const plugin = pluginRef.current;
      if (!plugin) return;
      try {
        const id = label ?? `measurement-${Date.now()}`;
        plugin.createMeasurement({
          id,
          origin: { entity: null, worldPos: from },
          target: { entity: null, worldPos: to },
        });
        syncMeasurements(plugin);
      } catch (e) {
        console.error('[useMeasureDistance] addMeasurement failed:', e);
      }
    },
    [syncMeasurements]
  );

  const removeMeasurement = useCallback(
    (id: string) => {
      const plugin = pluginRef.current;
      if (!plugin) return;
      try {
        plugin.destroyMeasurement(id);
        syncMeasurements(plugin);
      } catch (e) {
        console.error('[useMeasureDistance] removeMeasurement failed:', e);
      }
    },
    [syncMeasurements]
  );

  const clearAllMeasurements = useCallback(() => {
    const plugin = pluginRef.current;
    if (!plugin) return;
    try {
      plugin.clear();
      setMeasurements([]);
    } catch (e) {
      console.error('[useMeasureDistance] clearAllMeasurements failed:', e);
    }
  }, []);

  return {
    isActive,
    isPluginReady,
    pluginError,
    measurements,
    activateMeasurement,
    deactivateMeasurement,
    addMeasurement,
    removeMeasurement,
    clearAllMeasurements,
    formatDistance,
    pluginRef,
    /** Call this in the parent after writing viewerRef.current = viewer */
    onViewerReady: () => setViewerVersion((v) => v + 1),
  };
}
