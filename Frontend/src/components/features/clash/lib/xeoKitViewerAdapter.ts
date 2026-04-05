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

const colorForObject = (object: XeoKitSceneObject): [number, number, number] => {
  if (object.isClashObject) return [0.96, 0.20, 0.18];
  if (object.isDeEmphasized) return [0.50, 0.58, 0.68];
  if (object.isColliding) return [0.92, 0.22, 0.20];
  if (object.isPrimary) return [0.32, 0.73, 0.98];
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
      const color = colorForObject(object);
      const opacity = object.isDeEmphasized ? 0.62 : object.isClashObject ? 0.92 : object.isColliding ? 0.78 : 0.86;

      if (object.meshPositions && object.meshPositions.length >= 9) {
        // Render real mesh geometry (viewer-space, pre-transformed by Viewer3D).
        // meshPositions: flat [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] already in viewer-space.
        const pos = object.meshPositions;
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
          color,
          opacity,
        });
      } else {
        // Fallback: bounding box
        const sx = Math.max(1, object.size.width / 2);
        const sy = Math.max(1, object.size.height / 2);
        const sz = Math.max(1, object.size.depth / 2);
        model.createMesh({
          id: meshId,
          geometryId: BOX_GEOMETRY_ID,
          position: [object.position.x, object.position.y, object.position.z],
          scale: [sx, sy, sz],
          color,
          opacity,
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
   */
  async syncXktModels(projectSlug: string, modelIds: string[]): Promise<void> {
    const gen = ++this.xktSyncGeneration;
    this.destroyXktModels();

    if (modelIds.length === 0) return;

    const xeokit = await import('@xeokit/xeokit-sdk');
    const XKTLoaderPlugin = (xeokit as unknown as { XKTLoaderPlugin: new (viewer: unknown) => { load: (c: Record<string, unknown>) => unknown; destroy?: () => void } }).XKTLoaderPlugin;
    if (!XKTLoaderPlugin || !this.viewer) return;

    if (!this.xktLoader) {
      this.xktLoader = new XKTLoaderPlugin(this.viewer);
    }

    let flew = false;
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

      this.loadedXktModelIds.push(id);

      sceneModel.once?.('loaded', () => {
        if (gen !== this.xktSyncGeneration) return;
        if (flew) return;
        const aabb = sceneModel.aabb;
        if (Array.isArray(aabb) && aabb.length >= 6) {
          flew = true;
          this.viewer.cameraFlight?.flyTo?.({ aabb });
        }
      });
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
    const input = this.viewer.scene?.input;
    const pick = this.viewer.scene?.pick;
    if (!input?.on || !input?.off || !pick) return () => {};

    const handle = input.on('mouseclicked', (coords: [number, number]) => {
      const hit = pick({ canvasPos: coords });
      const objectId = hit?.entity?.id;
      if (objectId) callback(objectId);
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
    // Defer one animation frame so xeokit finishes computing the AABB after finalize().
    requestAnimationFrame(() => {
      const aabb = this.sceneModel?.aabb;
      if (!Array.isArray(aabb) || aabb.length < 6) return;
      this.viewer.cameraFlight?.flyTo?.({ aabb });
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

  private destroyXktModels(): void {
    const scene = this.viewer.scene as { models?: Record<string, { destroy?: () => void }> } | undefined;
    if (!scene?.models) {
      this.loadedXktModelIds = [];
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
  }
}

