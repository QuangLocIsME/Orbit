'use client';

import { apiUrl } from '@/config/api';
import { apiFetch } from '@/lib/api-client';
import type {
  BBoxData,
  ObjectPickedCallback,
  UnsubscribeFn,
  Vec3,
  ViewerAdapter,
} from './viewerAdapter';

type XeoKitViewer = {
  scene?: {
    objects?: Record<string, any>;
    pick?: (cfg: { canvasPos: [number, number] }) => { entity?: { id?: string } } | null;
    input?: {
      on?: (event: string, callback: (coords: [number, number]) => void) => string | number | undefined;
      off?: (handle: string | number | undefined) => void;
    };
  };
  cameraFlight?: {
    flyTo?: (cfg: { aabb: number[] }) => void;
  };
  destroy?: () => void;
};

type XeoKitSceneModelCtor = new (scene: unknown, cfg: Record<string, unknown>) => {
  createGeometry: (cfg: {
    id: string;
    primitive: 'triangles';
    positions: number[];
    normals?: number[];
    indices: number[];
    autoNormals?: boolean;
  }) => void;
  createMesh: (cfg: {
    id: string;
    geometryId: string;
    position: number[];
    scale: number[];
    color: number[];
    opacity: number;
  }) => boolean;
  createEntity: (cfg: {
    id: string;
    meshIds: string[];
    isObject: boolean;
    pickable?: boolean;
    highlighted?: boolean;
  }) => void;
  finalize: () => void;
  destroy: () => void;
  aabb?: number[];
};

export type XeoKitSceneObject = {
  id: string;
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number; height: number };
  isPrimary?: boolean;
  isClashObject?: boolean;
  isClashObjectB?: boolean;
  isColliding?: boolean;
  isSelected?: boolean;
  isInTestScope?: boolean;
  isDeEmphasized?: boolean;
  /** Flat triangle array from backend IFC extraction (every 9 floats = 1 triangle, world-space meters, WORLD_SCALE applied). */
  meshPositions?: number[] | null;
};

/** Semi-transparent red volume at the clash intersection (pickable: false). */
export type XeoKitClashZone = {
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number; height: number };
};

const CLASH_ZONE_ENTITY_ID = '__orbit-clash-zone__';

const BOX_GEOMETRY_ID = 'orbit-unit-box';

// Unit cube ([-1..1]) with per-face normals.
const BOX_POSITIONS = [
  1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
  1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1,
  1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1,
  -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1,
  -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
  1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
];

const BOX_NORMALS = [
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
  0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
];

const BOX_INDICES = [
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23,
];

const centerFromAABB = (aabb?: number[] | null): Vec3 | null => {
  if (!Array.isArray(aabb) || aabb.length < 6) return null;
  return [
    (Number(aabb[0]) + Number(aabb[3])) / 2,
    (Number(aabb[1]) + Number(aabb[4])) / 2,
    (Number(aabb[2]) + Number(aabb[5])) / 2,
  ];
};

const bboxFromAABB = (aabb?: number[] | null): BBoxData | null => {
  if (!Array.isArray(aabb) || aabb.length < 6) return null;
  return {
    min: [Number(aabb[0]), Number(aabb[1]), Number(aabb[2])],
    max: [Number(aabb[3]), Number(aabb[4]), Number(aabb[5])],
  };
};

/** xeokit AABB: [xmin, ymin, zmin, xmax, ymax, zmax] */
const unionAABBs = (parts: Array<number[] | undefined | null>): number[] | null => {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of parts) {
    if (!Array.isArray(p) || p.length < 6) continue;
    minX = Math.min(minX, Number(p[0]));
    minY = Math.min(minY, Number(p[1]));
    minZ = Math.min(minZ, Number(p[2]));
    maxX = Math.max(maxX, Number(p[3]));
    maxY = Math.max(maxY, Number(p[4]));
    maxZ = Math.max(maxZ, Number(p[5]));
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return [minX, minY, minZ, maxX, maxY, maxZ];
};

function waitForXktSceneModelLoaded(
  sceneModel: { once?: (ev: string, fn: () => void) => void; aabb?: number[] },
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve();
    };
    sceneModel.once?.('loaded', finish);
    timeoutId = window.setTimeout(finish, timeoutMs);
    requestAnimationFrame(() => {
      if (Array.isArray(sceneModel.aabb) && sceneModel.aabb.length >= 6) finish();
    });
  });
}

const colorForObject = (object: XeoKitSceneObject): [number, number, number] => {
  if (object.isPrimary) return [0.32, 0.73, 0.98];
  if (object.isClashObjectB) return [0.96, 0.20, 0.18];
  if (object.isClashObject) return [0.32, 0.73, 0.98];
  if (object.isDeEmphasized) return [0.50, 0.58, 0.68];
  if (object.isColliding) return [0.92, 0.22, 0.20];
  if (object.isInTestScope) return [0.24, 0.80, 0.62];
  return object.isSelected ? [0.30, 0.90, 0.72] : [0.24, 0.80, 0.62];
};

export class XeoKitViewerAdapter implements ViewerAdapter {
  private sceneModel: InstanceType<XeoKitSceneModelCtor> | null = null;
  private readonly basePositions = new Map<string, Vec3>();
  private loadedObjectIds: string[] = [];
  private readonly sceneModelCtor?: XeoKitSceneModelCtor;
  private xktLoader: { load: (cfg: Record<string, unknown>) => unknown; destroy?: () => void } | null = null;
  private readonly meshIdToObjectId = new Map<string, string>();
  private loadedXktModelIds: string[] = [];
  private xktSyncGeneration = 0;
  private readonly xktObjectModelMap = new Map<string, string>(); // objectId → modelId

  constructor(
    private readonly viewer: XeoKitViewer,
    sceneModelCtor?: XeoKitSceneModelCtor
  ) {
    if (!viewer) {
      throw new Error('XeoKitViewerAdapter requires a valid XeoKit Viewer instance');
    }
    this.sceneModelCtor = sceneModelCtor;
  }

  loadSceneObjects(objects: XeoKitSceneObject[], clashZone?: XeoKitClashZone | null): void {
    const scene = this.viewer.scene;
    if (!scene || !this.sceneModelCtor) return;

    this.disposeSceneModel();
    this.basePositions.clear();
    this.meshIdToObjectId.clear();
    this.loadedObjectIds = [];

    if (objects.length === 0) {
      return;
    }

    const model = new this.sceneModelCtor(scene, {
      id: `orbit-clash-${Date.now()}`,
      isModel: true,
      pickable: true,
    });

    model.createGeometry({
      id: BOX_GEOMETRY_ID,
      primitive: 'triangles',
      positions: BOX_POSITIONS,
      normals: BOX_NORMALS,
      indices: BOX_INDICES,
    });

    objects.forEach((object, index) => {
      const meshId = `orbit-mesh-${index}`;
      const hasRealMesh = Boolean(object.meshPositions && object.meshPositions.length >= 9);

      if (hasRealMesh) {
        // Render real mesh geometry (viewer-space, pre-transformed by Viewer3D).
        const pos = object.meshPositions!;
        const vertCount = Math.floor(pos.length / 3);
        const indices: number[] = new Array(vertCount);
        for (let i = 0; i < vertCount; i++) indices[i] = i;

        const geoId = `orbit-geo-real-${index}`;
        model.createGeometry({
          id: geoId,
          primitive: 'triangles',
          positions: Array.from(pos),
          autoNormals: true,
          indices,
        });
        model.createMesh({
          id: meshId,
          geometryId: geoId,
          position: [0, 0, 0],
          scale: [1, 1, 1],
          color: colorForObject(object),
          opacity: 1,
        });
      } else {
        // Fallback: bounding box — semi-transparent so overlap region remains visible.
        // Use real size for detail; use minimum 1 only for truly point-like objects (all dims near 0).
        const hasAnyDimension = object.size.width > 0.01 || object.size.height > 0.01 || object.size.depth > 0.01;
        const sx = hasAnyDimension ? object.size.width / 2 : 1;
        const sy = hasAnyDimension ? object.size.height / 2 : 1;
        const sz = hasAnyDimension ? object.size.depth / 2 : 1;
        model.createMesh({
          id: meshId,
          geometryId: BOX_GEOMETRY_ID,
          position: [object.position.x, object.position.y, object.position.z],
          scale: [sx, sy, sz],
          color: colorForObject(object),
          opacity: 0.25,
        });
      }

      model.createEntity({
        id: object.id,
        meshIds: [meshId],
        isObject: true,
        pickable: true,
        highlighted: Boolean(object.isSelected),
      });

      this.meshIdToObjectId.set(meshId, object.id);
      this.basePositions.set(object.id, [object.position.x, object.position.y, object.position.z]);
      this.loadedObjectIds.push(object.id);
    });

    if (clashZone) {
      const meshId = 'orbit-mesh-clash-zone';
      const sx = Math.max(1, clashZone.size.width / 2);
      const sy = Math.max(1, clashZone.size.height / 2);
      const sz = Math.max(1, clashZone.size.depth / 2);
      model.createMesh({
        id: meshId,
        geometryId: BOX_GEOMETRY_ID,
        position: [clashZone.position.x, clashZone.position.y, clashZone.position.z],
        scale: [sx, sy, sz],
        color: [0.98, 0.12, 0.1],
        opacity: 1,
      });
      model.createEntity({
        id: CLASH_ZONE_ENTITY_ID,
        meshIds: [meshId],
        isObject: false,
        pickable: false,
        highlighted: false,
      });

      // Floating beacon to keep clash marker visible even when overlap volume is occluded.
      const topY = clashZone.position.y + sy + 8;
      const beaconHalf = Math.max(4, Math.min(10, Math.max(sx, sz) * 0.45));
      const beaconMeshId = 'orbit-mesh-clash-zone-beacon';
      model.createMesh({
        id: beaconMeshId,
        geometryId: BOX_GEOMETRY_ID,
        position: [clashZone.position.x, topY, clashZone.position.z],
        scale: [beaconHalf, beaconHalf, beaconHalf],
        color: [1, 0.06, 0.06],
        opacity: 1,
      });
      model.createEntity({
        id: `${CLASH_ZONE_ENTITY_ID}-beacon`,
        meshIds: [beaconMeshId],
        isObject: false,
        pickable: false,
        highlighted: false,
      });
    }

    model.finalize();
    this.sceneModel = model;
    this.flyToModel();
  }

  /**
   * Load or refresh XKT models (authenticated fetch). Box overlay from loadSceneObjects is unchanged.
   * Calls onLoaded callback after all models are ready (for post-load operations like recolor).
   */
  async syncXktModels(
    projectSlug: string,
    modelIds: string[],
    onLoaded?: (loadedIds: string[]) => void
  ): Promise<void> {
    const gen = ++this.xktSyncGeneration;
    this.destroyXktModels();

    if (modelIds.length === 0) return;

    const xeokit = await import('@xeokit/xeokit-sdk');
    const XKTLoaderPlugin = (xeokit as unknown as { XKTLoaderPlugin: new (viewer: unknown) => { load: (c: Record<string, unknown>) => unknown; destroy?: () => void } }).XKTLoaderPlugin;
    if (!XKTLoaderPlugin || !this.viewer) return;

    if (!this.xktLoader) {
      this.xktLoader = new XKTLoaderPlugin(this.viewer);
    }

    const loadedIds: string[] = [];

    for (const id of modelIds) {
      if (gen !== this.xktSyncGeneration) return;
      const url = apiUrl(
        `/projects/${encodeURIComponent(projectSlug)}/navisworks/models/${encodeURIComponent(id)}/xkt`
      );
      const res = await apiFetch(url);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (gen !== this.xktSyncGeneration) return;

      const sceneModel = this.xktLoader.load({
        id,
        xkt: buf,
        dtxEnabled: true,
        edges: false,
      }) as { aabb?: number[]; once?: (ev: string, fn: () => void) => void };

      await waitForXktSceneModelLoaded(sceneModel, 20000);
      if (gen !== this.xktSyncGeneration) return;

      this.loadedXktModelIds.push(id);
      loadedIds.push(id);

      // Debug: log all entity IDs from this model via viewer scene
      const viewerScene = this.viewer.scene as { models?: Record<string, { objects?: Record<string, unknown> }> } | undefined;
      const objects = viewerScene?.models?.[id]?.objects ?? {};
      const allKeys = Object.keys(objects);
      console.log(`[XeoKitAdapter] Model "${id}" loaded, ${allKeys.length} entities. First 20:`, allKeys.slice(0, 20));
      // Debug: inspect first entity to find any ID-like properties
      const firstEntity = objects[allKeys[0]];
      if (firstEntity) {
        console.log(`[XeoKitAdapter] First entity props:`, Object.keys(firstEntity));
      }
    }

    if (loadedIds.length === 0) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gen !== this.xktSyncGeneration) return;
        this.fitCameraToXktModels(gen, loadedIds);
        onLoaded?.(loadedIds);
      });
    });
  }

  /** Fit viewer camera to union AABB of loaded XKT models (+ optional bbox overlay SceneModel). */
  private fitCameraToXktModels(gen: number, xktIds: string[]): void {
    if (!this.viewer || gen !== this.xktSyncGeneration) return;
    const scene = this.viewer.scene as { models?: Record<string, { aabb?: number[] }> } | undefined;
    const pieces: number[][] = [];
    for (const id of xktIds) {
      const aabb = scene?.models?.[id]?.aabb;
      if (Array.isArray(aabb) && aabb.length >= 6) pieces.push(aabb);
    }
    const overlayAabb = this.sceneModel?.aabb;
    if (Array.isArray(overlayAabb) && overlayAabb.length >= 6) {
      pieces.push(overlayAabb);
    }
    const merged = unionAABBs(pieces);
    if (merged) {
      this.viewer.cameraFlight?.flyTo?.({ aabb: merged });
    }
  }

  highlightObjects(ids: string[]): void {
    const sceneObjects = this.viewer.scene?.objects;
    if (!sceneObjects) return;
    const active = new Set(ids);
    Object.keys(sceneObjects).forEach((objectId) => {
      if (objectId === CLASH_ZONE_ENTITY_ID) return;
      const object = sceneObjects[objectId];
      if (!object) return;
      object.highlighted = active.has(objectId);
      // Keep base object color; xeokit selected material can wash it out.
      object.selected = false;
    });
  }

  focusObject(id: string): void {
    const object = this.viewer.scene?.objects?.[id];
    const aabb = object?.aabb;
    if (!Array.isArray(aabb) || aabb.length < 6) return;
    this.viewer.cameraFlight?.flyTo?.({ aabb });
  }

  getObjectWorldPosition(id: string): Vec3 | null {
    const object = this.viewer.scene?.objects?.[id];
    if (!object) return null;
    if (Array.isArray(object.position) && object.position.length >= 3) {
      return [Number(object.position[0]), Number(object.position[1]), Number(object.position[2])];
    }
    return centerFromAABB(object.aabb);
  }

  setObjectWorldPosition(id: string, position: Vec3): void {
    const object = this.viewer.scene?.objects?.[id];
    if (!object) return;
    object.position = [position[0], position[1], position[2]];
  }

  getObjectBoundingBox(id: string): BBoxData | null {
    const object = this.viewer.scene?.objects?.[id];
    if (!object) return null;
    return bboxFromAABB(object.aabb);
  }

  onObjectPicked(callback: ObjectPickedCallback): UnsubscribeFn {
    const scene = this.viewer.scene;
    const input = scene?.input;
    const pick = scene?.pick;
    if (!scene || !input?.on || !input?.off || !pick) return () => {};

    const handle = input.on('mouseclicked', (coords: [number, number] | undefined) => {
      if (!scene || !coords || !pick) return;
      let objectId: string | undefined;
      try {
        const hit = pick({ canvasPos: coords });
        objectId = hit?.entity?.id;
      } catch {
        return;
      }
      if (!objectId || objectId.startsWith(CLASH_ZONE_ENTITY_ID)) return;
      callback(objectId);
    });

    return () => input.off?.(handle);
  }

  resetAllPositions(): void {
    this.basePositions.forEach((position, id) => {
      this.setObjectWorldPosition(id, position);
    });
  }

  getLoadedObjectIds(): string[] {
    return [...this.loadedObjectIds];
  }

  dispose(): void {
    this.xktSyncGeneration += 1;
    this.destroyXktModels();
    this.xktLoader?.destroy?.();
    this.xktLoader = null;
    this.disposeSceneModel();
    this.viewer.destroy?.();
  }

  private flyToModel(): void {
    requestAnimationFrame(() => {
      const overlayAabb = this.sceneModel?.aabb;
      if (!Array.isArray(overlayAabb) || overlayAabb.length < 6) return;

      const scene = this.viewer.scene as { models?: Record<string, { aabb?: number[] }> } | undefined;
      const pieces: number[][] = [overlayAabb];

      for (const id of this.loadedXktModelIds) {
        const aabb = scene?.models?.[id]?.aabb;
        if (Array.isArray(aabb) && aabb.length >= 6) pieces.push(aabb);
      }

      const merged = unionAABBs(pieces);
      if (!merged) return;

      const spanX = merged[3] - merged[0];
      const spanY = merged[4] - merged[1];
      const spanZ = merged[5] - merged[2];
      const maxSpan = Math.max(spanX, spanY, spanZ);
      const padding = Math.max(maxSpan * 0.15, 20);

      const padded: number[] = [
        merged[0] - padding,
        merged[1] - padding,
        merged[2] - padding,
        merged[3] + padding,
        merged[4] + padding,
        merged[5] + padding,
      ];

      this.viewer.cameraFlight?.flyTo?.({ aabb: padded });
    });
  }

  private disposeSceneModel(): void {
    if (!this.sceneModel) return;
    try {
      this.sceneModel.destroy();
    } catch {
      // ignore cleanup errors
    }
    this.sceneModel = null;
  }

  /**
   * Search all loaded XKT scene models for an entity with the given objectId.
   * XKT objects have isObject=true and id=objectId. We walk meshes → their parent entity.
   */
  private findEntityInXktModels(objectId: string): { entity: unknown; modelId: string } | null {
    const scene = this.viewer.scene as {
      models?: Record<string, { objects?: Record<string, unknown> }>;
    } | undefined;
    if (!scene?.models) return null;

    for (const modelId of this.loadedXktModelIds) {
      const model = scene.models?.[modelId];
      const objects = model?.objects;
      if (!objects) continue;
      const entity = objects[objectId];
      if (entity) return { entity, modelId };
    }
    // Log sample entity keys from first model for debugging
    const firstModelId = this.loadedXktModelIds[0];
    const firstModel = scene.models?.[firstModelId];
    const keys = firstModel?.objects ? Object.keys(firstModel.objects).slice(0, 10) : [];
    console.warn(`[XeoKitAdapter] "${objectId}" not found. Sample entities in model "${firstModelId}":`, keys);
    return null;
  }

  /**
   * Recolors XKT objects.
   *
   * Clash detail mode: colors objectA (green) and objectB (yellow); resets all others to default.
   * Overview mode: colors every visible object with the same scheme as the bbox overlay,
   *   falling back to default for objects not in the sceneObjects map.
   *
   * Previously-colored objects not in the new scope are reset to default.
   */
  recolorXktObjects(
    objectA: string | null,
    objectB: string | null,
    allClashObjectIds: string[],
    visibleObjectIds?: string[],
    sceneObjects?: XeoKitSceneObject[]
  ): void {
    const COL_CLA = [0.12, 0.80, 0.40] as [number, number, number]; // Object A - green
    const COL_CLS = [1.0, 0.85, 0.0] as [number, number, number]; // Object B - yellow
    const COL_SELECTED = [0.30, 0.90, 0.72] as [number, number, number];
    const COL_TEST_SCOPE = [0.24, 0.80, 0.62] as [number, number, number];
    const COL_DEFAULT = [0.68, 0.70, 0.76] as [number, number, number];

    const scene = this.viewer.scene as {
      objects?: Record<string, { color?: number[]; opacity?: number }>;
      models?: Record<string, { objects?: Record<string, unknown> }>;
    } | undefined;

    const visibleSet = new Set(visibleObjectIds ?? []);

    // Reset previously-highlighted XKT objects that are no longer in scope.
    for (const [objId, modelId] of this.xktObjectModelMap) {
      if (!allClashObjectIds.includes(objId)) {
        const model = scene?.models?.[modelId];
        const entity = model?.objects?.[objId] as { color?: number[]; opacity?: number } | undefined;
        if (entity) {
          entity.color = [...COL_DEFAULT];
          entity.opacity = 1;
        }
        this.xktObjectModelMap.delete(objId);
      }
    }

    // Build full color map for all visible objects (overview mode) or just clash pair (clash detail).
    const colorMap: Record<string, [number, number, number]> = {};
    if (visibleSet.size > 0 && sceneObjects) {
      // Overview mode: color every visible object using the same scheme as the bbox overlay.
      for (const obj of sceneObjects) {
        if (!visibleSet.has(obj.id)) continue;
        let color: [number, number, number];
        if (obj.isSelected) {
          color = COL_SELECTED;
        } else if (obj.isClashObjectB) {
          color = COL_CLS;
        } else if (obj.isClashObject) {
          color = COL_CLA;
        } else if (obj.isDeEmphasized) {
          color = COL_DEFAULT;
        } else if (obj.isColliding) {
          color = COL_CLS;
        } else if (obj.isInTestScope) {
          color = COL_TEST_SCOPE;
        } else {
          color = COL_DEFAULT;
        }
        colorMap[obj.id] = color;
      }
    } else {
      // Clash detail mode: color only objectA and objectB.
      if (objectA) colorMap[objectA] = COL_CLA;
      if (objectB) colorMap[objectB] = COL_CLS;
    }

    // Apply colors to XKT entities.
    for (const [objId, color] of Object.entries(colorMap)) {
      const found = this.findEntityInXktModels(objId);
      if (!found) {
        console.warn(`[XeoKitAdapter] Object not found in XKT models: "${objId}"`);
        continue;
      }

      this.xktObjectModelMap.set(objId, found.modelId);
      const entity = found.entity as { color?: number[]; opacity?: number; highlighted?: boolean };
      entity.color = [...color];
      entity.opacity = 1;
      entity.highlighted = false;
    }
  }

  private destroyXktModels(): void {
    const scene = this.viewer.scene as { models?: Record<string, { destroy?: () => void }> } | undefined;
    if (!scene?.models) {
      this.loadedXktModelIds = [];
      this.xktObjectModelMap.clear();
      return;
    }
    for (const id of this.loadedXktModelIds) {
      try {
        scene.models[id]?.destroy?.();
      } catch {
        // ignore
      }
    }
    this.loadedXktModelIds = [];
    this.xktObjectModelMap.clear();
  }
}

