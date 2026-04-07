'use client';

import type {
  BBoxData,
  ObjectPickedCallback,
  UnsubscribeFn,
  Vec3,
  ViewerAdapter,
} from './viewerAdapter';
import { bimStyleForIfcType } from './clashScene';

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
    flyTo?: (cfg: { aabb: number[]; fitFOV?: number }) => void;
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
    metallic?: number;
    roughness?: number;
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
  /** When true, do not fallback to bbox if mesh is unavailable. */
  meshOnly?: boolean;
  /** IfcWall / clash category — drives BIM-like fill colors (cf. Sortdesk-style viewers). */
  ifcType?: string;
};

/** Semi-transparent red volume at the clash intersection (pickable: false). */
export type XeoKitClashZone = {
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number; height: number };
};

const CLASH_ZONE_ENTITY_ID = '__orbit-clash-zone__';

const BOX_GEOMETRY_ID = 'orbit-unit-box';
/** Keep vertex count per geometry under common 16-bit index limits to avoid scrambled triangles. */
const MAX_VERTS_PER_GEOMETRY = 60000; // must be divisible by 3 for triangles
const MAX_FLOATS_PER_GEOMETRY = MAX_VERTS_PER_GEOMETRY * 3;
const toTriangleVertexCount = (vertexCount: number) => Math.floor(vertexCount / 3) * 3;

/** xeokit default ~45°; higher → camera ends closer (tighter framing). */
const CAMERA_FIT_FOV_DEG = 58;
const CAMERA_AABB_MARGIN_MIN = 1.25;
const CAMERA_AABB_MARGIN_DIAG_FRAC = 0.14;

const expandAabbMargin = (aabb: number[], margin: number): number[] => [
  aabb[0] - margin,
  aabb[1] - margin,
  aabb[2] - margin,
  aabb[3] + margin,
  aabb[4] + margin,
  aabb[5] + margin,
];

const aabbDiagonalLen = (aabb: number[]): number => {
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * Remove broken/outlier triangles that can appear from imperfect IFC tessellation/index streams.
 * Outliers manifest visually as giant stretched sheets across the scene.
 */
const sanitizeMeshTriangles = (
  positions: number[],
  _object: Pick<XeoKitSceneObject, 'position' | 'size'>
): number[] => {
  const validLen = Math.floor(positions.length / 9) * 9;
  if (validLen < 9) return [];

  const out: number[] = [];
  for (let i = 0; i < validLen; i += 9) {
    const x1 = positions[i];
    const y1 = positions[i + 1];
    const z1 = positions[i + 2];
    const x2 = positions[i + 3];
    const y2 = positions[i + 4];
    const z2 = positions[i + 5];
    const x3 = positions[i + 6];
    const y3 = positions[i + 7];
    const z3 = positions[i + 8];

    if (
      !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(z1) ||
      !Number.isFinite(x2) || !Number.isFinite(y2) || !Number.isFinite(z2) ||
      !Number.isFinite(x3) || !Number.isFinite(y3) || !Number.isFinite(z3)
    ) {
      continue;
    }

    const abx = x2 - x1;
    const aby = y2 - y1;
    const abz = z2 - z1;
    const acx = x3 - x1;
    const acy = y3 - y1;
    const acz = z3 - z1;
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    const areaSq = cx * cx + cy * cy + cz * cz;
    // Keep only non-degenerate triangles; avoid clipping by object bbox to prevent missing parts.
    if (areaSq < 1e-18) {
      continue;
    }

    out.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
  }
  return out;
};

const validateTriangleGeometry = (
  positions: number[],
  indices: number[]
): { valid: boolean; reason?: string } => {
  if (positions.length < 9) return { valid: false, reason: 'positions<9' };
  if (positions.length % 3 !== 0) return { valid: false, reason: 'positions%3!=0' };
  if (indices.length < 3) return { valid: false, reason: 'indices<3' };
  if (indices.length % 3 !== 0) return { valid: false, reason: 'indices%3!=0' };

  const vertCount = positions.length / 3;
  let minIdx = Number.POSITIVE_INFINITY;
  let maxIdx = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < indices.length; i += 1) {
    const idx = indices[i];
    if (!Number.isInteger(idx)) return { valid: false, reason: 'index-not-integer' };
    if (idx < minIdx) minIdx = idx;
    if (idx > maxIdx) maxIdx = idx;
  }
  if (minIdx < 0) return { valid: false, reason: 'index<0' };
  if (maxIdx >= vertCount) return { valid: false, reason: 'index>=vertCount' };

  return { valid: true };
};

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

const resolveDisplayStyle = (
  object: XeoKitSceneObject
): { color: [number, number, number]; opacity: number } => {
  if (object.isSelected) {
    return { color: [0.98, 0.9, 0.35], opacity: 1 };
  }
  if (object.isDeEmphasized) {
    return { color: [0.45, 0.5, 0.58], opacity: 0.22 };
  }
  // BIM palette must win over test-scope tint — otherwise every scoped object becomes the same cyan/teal.
  const t = object.ifcType?.trim();
  if (t) {
    return bimStyleForIfcType(t);
  }
  if (object.isInTestScope) {
    return { color: [0.22, 0.82, 0.68], opacity: 1 };
  }
  if (object.isClashObject) return { color: [0.92, 0.35, 0.22], opacity: 1 };
  if (object.isColliding) return { color: [0.86, 0.3, 0.2], opacity: 1 };
  if (object.isPrimary) return { color: [0.36, 0.82, 0.98], opacity: 1 };
  return { color: [0.56, 0.53, 0.5], opacity: 1 };
};

export class XeoKitViewerAdapter implements ViewerAdapter {
  private sceneModel: InstanceType<XeoKitSceneModelCtor> | null = null;
  private fitAABB: number[] | null = null;
  private disposed = false;
  private readonly basePositions = new Map<string, Vec3>();
  private loadedObjectIds: string[] = [];
  private readonly sceneModelCtor?: XeoKitSceneModelCtor;
  private readonly meshIdToObjectId = new Map<string, string>();

  constructor(
    private readonly viewer: XeoKitViewer,
    sceneModelCtor?: XeoKitSceneModelCtor
  ) {
    if (!viewer) {
      throw new Error('XeoKitViewerAdapter requires a valid XeoKit Viewer instance');
    }
    this.disposed = false;
    this.sceneModelCtor = sceneModelCtor;
  }

  loadSceneObjects(objects: XeoKitSceneObject[], clashZone?: XeoKitClashZone | null): void {
    const scene = this.viewer.scene;
    if (!scene || !this.sceneModelCtor) return;

    this.disposeSceneModel();
    this.fitAABB = null;
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
      dtxEnabled: false,
      pbrEnabled: true,
    });

    model.createGeometry({
      id: BOX_GEOMETRY_ID,
      primitive: 'triangles',
      positions: BOX_POSITIONS,
      normals: BOX_NORMALS,
      indices: BOX_INDICES,
    });

    // Logical bbox (viewer-space) — can be huge vs. real mesh extent; used alone it keeps the camera far away.
    let lMinX = Number.POSITIVE_INFINITY;
    let lMinY = Number.POSITIVE_INFINITY;
    let lMinZ = Number.POSITIVE_INFINITY;
    let lMaxX = Number.NEGATIVE_INFINITY;
    let lMaxY = Number.NEGATIVE_INFINITY;
    let lMaxZ = Number.NEGATIVE_INFINITY;
    for (const object of objects) {
      const hx = Math.max(1, object.size.width / 2);
      const hy = Math.max(1, object.size.height / 2);
      const hz = Math.max(1, object.size.depth / 2);
      const x = object.position.x;
      const y = object.position.y;
      const z = object.position.z;
      if (x - hx < lMinX) lMinX = x - hx;
      if (y - hy < lMinY) lMinY = y - hy;
      if (z - hz < lMinZ) lMinZ = z - hz;
      if (x + hx > lMaxX) lMaxX = x + hx;
      if (y + hy > lMaxY) lMaxY = y + hy;
      if (z + hz > lMaxZ) lMaxZ = z + hz;
    }
    const logicalValid =
      Number.isFinite(lMinX) &&
      Number.isFinite(lMinY) &&
      Number.isFinite(lMinZ) &&
      Number.isFinite(lMaxX) &&
      Number.isFinite(lMaxY) &&
      Number.isFinite(lMaxZ);

    // Sanitized mesh vertices in viewer space — tight fit for clash detail (both real meshes).
    let mMinX = Number.POSITIVE_INFINITY;
    let mMinY = Number.POSITIVE_INFINITY;
    let mMinZ = Number.POSITIVE_INFINITY;
    let mMaxX = Number.NEGATIVE_INFINITY;
    let mMaxY = Number.NEGATIVE_INFINITY;
    let mMaxZ = Number.NEGATIVE_INFINITY;
    let meshVertCount = 0;
    for (const object of objects) {
      if (!object.meshPositions || object.meshPositions.length < 9) continue;
      const pos = sanitizeMeshTriangles(object.meshPositions, object);
      for (let i = 0; i + 2 < pos.length; i += 3) {
        const x = pos[i];
        const y = pos[i + 1];
        const z = pos[i + 2];
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        meshVertCount += 1;
        if (x < mMinX) mMinX = x;
        if (y < mMinY) mMinY = y;
        if (z < mMinZ) mMinZ = z;
        if (x > mMaxX) mMaxX = x;
        if (y > mMaxY) mMaxY = y;
        if (z > mMaxZ) mMaxZ = z;
      }
    }
    const meshValid =
      meshVertCount > 0 &&
      Number.isFinite(mMinX) &&
      Number.isFinite(mMinY) &&
      Number.isFinite(mMinZ) &&
      Number.isFinite(mMaxX) &&
      Number.isFinite(mMaxY) &&
      Number.isFinite(mMaxZ);

    const allObjectsHaveMesh =
      objects.length > 0 &&
      objects.every((o) => o.meshPositions && o.meshPositions.length >= 9);

    let minX: number;
    let minY: number;
    let minZ: number;
    let maxX: number;
    let maxY: number;
    let maxZ: number;

    if (allObjectsHaveMesh && meshValid) {
      minX = mMinX;
      minY = mMinY;
      minZ = mMinZ;
      maxX = mMaxX;
      maxY = mMaxY;
      maxZ = mMaxZ;
    } else if (logicalValid && meshValid) {
      minX = Math.min(lMinX, mMinX);
      minY = Math.min(lMinY, mMinY);
      minZ = Math.min(lMinZ, mMinZ);
      maxX = Math.max(lMaxX, mMaxX);
      maxY = Math.max(lMaxY, mMaxY);
      maxZ = Math.max(lMaxZ, mMaxZ);
    } else if (logicalValid) {
      minX = lMinX;
      minY = lMinY;
      minZ = lMinZ;
      maxX = lMaxX;
      maxY = lMaxY;
      maxZ = lMaxZ;
    } else if (meshValid) {
      minX = mMinX;
      minY = mMinY;
      minZ = mMinZ;
      maxX = mMaxX;
      maxY = mMaxY;
      maxZ = mMaxZ;
    } else {
      minX = Number.NaN;
      minY = Number.NaN;
      minZ = Number.NaN;
      maxX = Number.NaN;
      maxY = Number.NaN;
      maxZ = Number.NaN;
    }

    if (
      Number.isFinite(minX) &&
      Number.isFinite(minY) &&
      Number.isFinite(minZ) &&
      Number.isFinite(maxX) &&
      Number.isFinite(maxY) &&
      Number.isFinite(maxZ)
    ) {
      let box = [minX, minY, minZ, maxX, maxY, maxZ] as number[];
      const diag = aabbDiagonalLen(box);
      const margin = Math.max(CAMERA_AABB_MARGIN_MIN, diag * CAMERA_AABB_MARGIN_DIAG_FRAC);
      box = expandAabbMargin(box, margin);
      this.fitAABB = box;
    }

    objects.forEach((object, index) => {
      const { color, opacity } = resolveDisplayStyle(object);
      const objectMeshIds: string[] = [];

      if (object.meshPositions && object.meshPositions.length >= 9) {
        // Render real mesh geometry (viewer-space, pre-transformed by Viewer3D).
        // meshPositions: flat [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] already in viewer-space.
        const pos = sanitizeMeshTriangles(object.meshPositions, object);
        const totalFloats = Math.floor(pos.length / 9) * 9; // complete triangles only
        let chunkIndex = 0;

        for (let start = 0; start < totalFloats; start += MAX_FLOATS_PER_GEOMETRY) {
          const end = Math.min(start + MAX_FLOATS_PER_GEOMETRY, totalFloats);
          const rawChunk = pos.slice(start, end);
          if (rawChunk.length < 9) continue;

          const rawVertCount = Math.floor(rawChunk.length / 3);
          const vertCount = toTriangleVertexCount(rawVertCount);
          if (vertCount < 3) continue;

          // Keep strict triangle-list layout: positions count and indices count are both multiples of 3.
          const chunk = rawChunk.slice(0, vertCount * 3);
          const indices: number[] = new Array(vertCount);
          for (let i = 0; i < vertCount; i += 1) {
            indices[i] = i;
          }

          const validation = validateTriangleGeometry(chunk, indices);
          if (!validation.valid) {
            // Skip malformed chunk to prevent stretched/exploded meshes in xeokit.
            // Keep warning concise but actionable for debugging object-specific data.
            console.warn(
              `[xeokit-mesh] drop invalid chunk object=${object.id} chunk=${chunkIndex} reason=${validation.reason} positions=${chunk.length} indices=${indices.length}`
            );
            continue;
          }

          const geoId = `orbit-geo-real-${index}-${chunkIndex}`;
          const meshId = `orbit-mesh-${index}-${chunkIndex}`;
          chunkIndex += 1;

          model.createGeometry({
            id: geoId,
            primitive: 'triangles',
            positions: Array.from(chunk),
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
            metallic: 0.06,
            roughness: 0.88,
          });
          objectMeshIds.push(meshId);
        }
      } else if (!object.meshOnly) {
        // Fallback: bounding box
        const meshId = `orbit-mesh-${index}`;
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
          metallic: 0.06,
          roughness: 0.88,
        });
        objectMeshIds.push(meshId);
      }

      if (objectMeshIds.length === 0) {
        // Mesh-only object without valid mesh: skip entity entirely (avoid bbox flash/fallback).
        return;
      }

      model.createEntity({
        id: object.id,
        meshIds: objectMeshIds,
        isObject: true,
        pickable: true,
        highlighted: Boolean(object.isSelected),
      });

      objectMeshIds.forEach((meshId) => this.meshIdToObjectId.set(meshId, object.id));
      this.basePositions.set(object.id, [object.position.x, object.position.y, object.position.z]);
      this.loadedObjectIds.push(object.id);
    });

    if (clashZone) {
      const sx = Math.max(1, clashZone.size.width / 2);
      const sy = Math.max(1, clashZone.size.height / 2);
      const sz = Math.max(1, clashZone.size.depth / 2);

      // Keep clash indication compact to avoid occluding objects from steep camera angles.
      const coreHalf = Math.max(2, Math.min(7, Math.min(sx, sy, sz) * 0.16));
      const coreMeshId = 'orbit-mesh-clash-zone-core';
      model.createMesh({
        id: coreMeshId,
        geometryId: BOX_GEOMETRY_ID,
        position: [clashZone.position.x, clashZone.position.y, clashZone.position.z],
        scale: [coreHalf, coreHalf, coreHalf],
        color: [1, 0.05, 0.05],
        opacity: 0.88,
      });
      model.createEntity({
        id: CLASH_ZONE_ENTITY_ID,
        meshIds: [coreMeshId],
        isObject: false,
        pickable: false,
        highlighted: false,
      });

      // Floating beacon to keep clash marker visible even when overlap volume is occluded.
      const topY = clashZone.position.y + sy + 8;
      const beaconHalf = Math.max(3, Math.min(8, Math.max(sx, sz) * 0.18));
      const beaconMeshId = 'orbit-mesh-clash-zone-beacon';
      model.createMesh({
        id: beaconMeshId,
        geometryId: BOX_GEOMETRY_ID,
        position: [clashZone.position.x, topY, clashZone.position.z],
        scale: [beaconHalf, beaconHalf, beaconHalf],
        color: [1, 0.08, 0.08],
        opacity: 0.6,
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
    this.viewer.cameraFlight?.flyTo?.({ aabb, fitFOV: CAMERA_FIT_FOV_DEG });
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
    if (!input?.on || !input?.off) return () => {};

    const handle = input.on('mouseclicked', (coords: [number, number]) => {
      if (this.disposed) return;
      try {
        const scene = this.viewer.scene;
        const pick = scene?.pick;
        if (!pick) return;
        const hit = pick({ canvasPos: coords });
        const objectId = hit?.entity?.id;
        if (!objectId || objectId.startsWith(CLASH_ZONE_ENTITY_ID)) return;
        callback(objectId);
      } catch {
        // Ignore pick errors during teardown/race with unmount.
      }
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
    this.disposed = true;
    this.disposeSceneModel();
    this.viewer.destroy?.();
  }

  private flyToModel(): void {
    // Defer one animation frame so xeokit finishes computing the AABB after finalize().
    requestAnimationFrame(() => {
      if (this.disposed) return;
      const aabb = this.fitAABB ?? this.sceneModel?.aabb;
      if (!Array.isArray(aabb) || aabb.length < 6) return;
      const cameraFlight = this.viewer.cameraFlight;
      if (!cameraFlight?.flyTo) return;
      try {
        cameraFlight.flyTo({ aabb, fitFOV: CAMERA_FIT_FOV_DEG });
      } catch {
        // Ignore race when camera is already destroyed.
      }
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
}

