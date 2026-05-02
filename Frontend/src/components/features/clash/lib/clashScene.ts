'use client';

import type { BBox, Clash, ViewerObjectState } from '../types/clashes';

/** Minimal shape for building an overview scene from federated IFC objects */
export type FederatedOverviewObject = {
  id: string;
  type: string;
  category: string;
  boundingBox: BBox;
  sourceModel: string;
  hidden?: boolean;
};

export const WORLD_LIMIT = 220;
/** Scale from meters (IFC world units) to viewer world units.
 *  Backend already normalises all units to metres; a scale of 1 keeps sizes correct. */
export const WORLD_SCALE = 1;
/** Alias for backward compat with useObjectInteraction */
export const PIXELS_TO_WORLD = WORLD_SCALE;
export const DEFAULT_SCENE_Y = 0;

export const clampWorld = (value: number) => Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, value));

export type ScenePosition = { x: number; y: number; z: number };
export type SceneSize = { width: number; depth: number; height: number };

export type SceneObject = {
  id: string;
  label: string;
  position: ScenePosition;
  size: SceneSize;
  /** Origin position in IFC world space (meters) */
  worldPosition?: [number, number, number];
};

// ---------------------------------------------------------------------------
// BBox helpers
// ---------------------------------------------------------------------------

const bboxCenter = (bbox: BBox): [number, number, number] => [
  (bbox.min[0] + bbox.max[0]) / 2,
  (bbox.min[1] + bbox.max[1]) / 2,
  (bbox.min[2] + bbox.max[2]) / 2,
];

const MIN_SIZE = 0.5; // Guard against degenerate zero-size bbox

const bboxSize = (bbox: BBox): SceneSize => ({
  width:  Math.max((bbox.max[0] - bbox.min[0]) * WORLD_SCALE, MIN_SIZE),
  depth:  Math.max((bbox.max[2] - bbox.min[2]) * WORLD_SCALE, MIN_SIZE),
  height: Math.max((bbox.max[1] - bbox.min[1]) * WORLD_SCALE, MIN_SIZE),
});

// ---------------------------------------------------------------------------
// Coordinate helpers (exported for Viewer3D pre-transform)
// ---------------------------------------------------------------------------

export const worldToViewer = (
  worldPos: [number, number, number],
  originWorld: [number, number, number]
): ScenePosition => ({
  x: (worldPos[0] - originWorld[0]) * WORLD_SCALE,
  y: (worldPos[1] - originWorld[1]) * WORLD_SCALE,
  z: (worldPos[2] - originWorld[2]) * WORLD_SCALE,
});

/**
 * Convert a flat IFC-world-space triangle array (every 3 floats = 1 vertex, meters)
 * into viewer-space using the same transform as bounding-box objects.
 * Origin is the scene midpoint (midpoint of A&B for clash, bbox-center for overview).
 */
export function transformMeshPositionsToViewerSpace(
  positions: number[],
  originWorld: [number, number, number]
): number[] {
  const [ox, oy, oz] = originWorld;
  const out = new Array<number>(positions.length);
  for (let i = 0; i + 2 < positions.length; i += 3) {
    out[i]     = (positions[i]     - ox) * WORLD_SCALE;
    out[i + 1] = (positions[i + 1] - oy) * WORLD_SCALE;
    out[i + 2] = (positions[i + 2] - oz) * WORLD_SCALE;
  }
  return out;
}

/**
 * Compute the world-space origin (bbox center of all scene objects with worldPosition).
 * Used to derive the same transform origin as buildOverviewSceneFromFederated.
 */
export function computeWorldOriginFromScene(
  scene: SceneObject[]
): [number, number, number] | null {
  const pts = scene.filter((o) => o.worldPosition);
  if (pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const o of pts) {
    const [wx, wy, wz] = o.worldPosition!;
    if (wx < minX) minX = wx;  if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;  if (wy > maxY) maxY = wy;
    if (wz < minZ) minZ = wz;  if (wz > maxZ) maxZ = wz;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build scene objects from a clash.
 * - If the clash has objectABBox/objectBBBox, use real coordinates from the IFC model.
 * - Otherwise fall back to a mock layout (backward compatible with older data).
 */
export const buildSceneObjectsFromClash = (clash: Clash): SceneObject[] => {
  const bboxA = clash.objectABBox;
  const bboxB = clash.objectBBBox;

  if (bboxA && bboxB) {
    const centerA = bboxCenter(bboxA);
    const centerB = bboxCenter(bboxB);
    const originWorld: [number, number, number] = [
      (centerA[0] + centerB[0]) / 2,
      (centerA[1] + centerB[1]) / 2,
      (centerA[2] + centerB[2]) / 2,
    ];

    return [
      {
        id: clash.objectA,
        label: clash.element1?.category ?? clash.objectA,
        position: worldToViewer(centerA, originWorld),
        size: bboxSize(bboxA),
        worldPosition: centerA,
      },
      {
        id: clash.objectB,
        label: clash.element2?.category ?? clash.objectB,
        position: worldToViewer(centerB, originWorld),
        size: bboxSize(bboxB),
        worldPosition: centerB,
      },
    ];
  }

  // Fallback mock
  return [
    {
      id: clash.objectA,
      label: clash.element1?.category ?? clash.objectA,
      position: { x: -58, y: DEFAULT_SCENE_Y, z: -12 },
      size: { width: 96, depth: 84, height: 96 },
    },
    {
      id: clash.objectB,
      label: clash.element2?.category ?? clash.objectB,
      position: { x: 34, y: DEFAULT_SCENE_Y, z: 18 },
      size: { width: 108, depth: 80, height: 84 },
    },
  ];
};

// ---------------------------------------------------------------------------
// Collision detection (2D X/Z plane) — used for viewer drag
// ---------------------------------------------------------------------------

/** Footprint overlap on XZ only — can miss real 3D clashes (e.g. different levels). */
export const intersects2D = (a: ViewerObjectState, b: ViewerObjectState) => {
  const halfWA = a.size.width / 2;
  const halfDA = a.size.depth / 2;
  const halfWB = b.size.width / 2;
  const halfDB = b.size.depth / 2;

  return (
    Math.abs(a.position.x - b.position.x) < halfWA + halfWB &&
    Math.abs(a.position.z - b.position.z) < halfDA + halfDB
  );
};

/** Axis-aligned box overlap in full viewer space (x=width, y=height, z=depth). */
export const intersects3D = (a: ViewerObjectState, b: ViewerObjectState) => {
  const halfXA = a.size.width / 2;
  const halfYA = a.size.height / 2;
  const halfZA = a.size.depth / 2;
  const halfXB = b.size.width / 2;
  const halfYB = b.size.height / 2;
  const halfZB = b.size.depth / 2;

  return (
    Math.abs(a.position.x - b.position.x) < halfXA + halfXB &&
    Math.abs(a.position.y - b.position.y) < halfYA + halfYB &&
    Math.abs(a.position.z - b.position.z) < halfZA + halfZB
  );
};

/**
 * Intersection AABB of two viewer boxes (for red clash volume / 2D footprint).
 * Returns null if separated. Very thin overlaps are expanded slightly for visibility.
 */
export function computeViewerAabbIntersection(
  a: Pick<ViewerObjectState, 'position' | 'size'>,
  b: Pick<ViewerObjectState, 'position' | 'size'>
): { position: ScenePosition; size: SceneSize } | null {
  const hax = a.size.width / 2;
  const hay = a.size.height / 2;
  const haz = a.size.depth / 2;
  const hbx = b.size.width / 2;
  const hby = b.size.height / 2;
  const hbz = b.size.depth / 2;

  const minX = Math.max(a.position.x - hax, b.position.x - hbx);
  const maxX = Math.min(a.position.x + hax, b.position.x + hbx);
  const minY = Math.max(a.position.y - hay, b.position.y - hby);
  const maxY = Math.min(a.position.y + hay, b.position.y + hby);
  const minZ = Math.max(a.position.z - haz, b.position.z - hbz);
  const maxZ = Math.min(a.position.z + haz, b.position.z + hbz);

  if (minX >= maxX || minY >= maxY || minZ >= maxZ) return null;

  const w = maxX - minX;
  const h = maxY - minY;
  const d = maxZ - minZ;
  const MIN_VIS = 1;
  return {
    position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    size: {
      width: Math.max(w, MIN_VIS),
      height: Math.max(h, MIN_VIS),
      depth: Math.max(d, MIN_VIS),
    },
  };
}

const viewerOriginFromScenePair = (
  scene: SceneObject[],
  objectA: string,
  objectB: string
): [number, number, number] | null => {
  const sa = scene.find((o) => o.id === objectA);
  const sb = scene.find((o) => o.id === objectB);
  if (!sa?.worldPosition || !sb?.worldPosition) return null;
  return [
    (sa.worldPosition[0] + sb.worldPosition[0]) / 2,
    (sa.worldPosition[1] + sb.worldPosition[1]) / 2,
    (sa.worldPosition[2] + sb.worldPosition[2]) / 2,
  ];
};

/**
 * Red marker volume for xeokit: real AABB intersection, else clash point in IFC space, else midpoint between A/B.
 */
export function resolveClashZoneForViewer(
  clash: Pick<Clash, 'objectA' | 'objectB' | 'position'>,
  viewerObjects: ViewerObjectState[],
  scene: SceneObject[] | null
): { position: ScenePosition; size: SceneSize } | null {
  const objA = viewerObjects.find((o) => o.id === clash.objectA);
  const objB = viewerObjects.find((o) => o.id === clash.objectB);
  if (!objA || !objB) return null;

  const inter = computeViewerAabbIntersection(objA, objB);
  if (inter) return inter;

  const originWorld = viewerOriginFromScenePair(scene ?? [], clash.objectA, clash.objectB);
  const MARKER = 22;
  if (originWorld) {
    const pt = worldToViewer(clash.position, originWorld);
    return {
      position: pt,
      size: { width: MARKER, height: MARKER, depth: MARKER },
    };
  }

  return {
    position: {
      x: (objA.position.x + objB.position.x) / 2,
      y: (objA.position.y + objB.position.y) / 2,
      z: (objA.position.z + objB.position.z) / 2,
    },
    size: { width: MARKER, height: MARKER, depth: MARKER },
  };
}

export const applyCollisionFlags = (objects: ViewerObjectState[]) =>
  objects.map((obj, _, all) => ({
    ...obj,
    isColliding: all.some((other) => other.id !== obj.id && intersects3D(obj, other)),
  }));

export const buildViewerObjects = (
  scene: SceneObject[],
  selectedObjectId: string | null,
  options?: { skipCollision?: boolean }
): ViewerObjectState[] => {
  const mapped: ViewerObjectState[] = scene.map((obj) => ({
    id: obj.id,
    label: obj.label,
    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    size: obj.size,
    isSelected: selectedObjectId === obj.id,
    isColliding: false,
  }));

  if (options?.skipCollision) {
    return mapped;
  }
  return applyCollisionFlags(mapped);
};

const typeShortLabel = (type: string, category: string) => {
  const c = (category || '').trim();
  if (c) return c;
  return type.replace(/^Ifc/, '') || 'Object';
};

/**
 * Scene centered on the union bounding box — used when there is no clash to still show the model (no clash highlighting).
 */
export function buildOverviewSceneFromFederated(
  objects: FederatedOverviewObject[],
  opts: { hiddenModelIds: string[]; hiddenCategories: string[]; maxObjects?: number }
): SceneObject[] {
  const max = opts.maxObjects ?? objects.length;
  const visible = objects.filter((o) => {
    if (o.hidden) return false;
    if (opts.hiddenModelIds.includes(o.sourceModel)) return false;
    const catKey = (o.category || o.type.replace(/^Ifc/, '')).trim();
    if (opts.hiddenCategories.length && opts.hiddenCategories.includes(catKey)) return false;
    return true;
  });

  // Sort by sourceModel then category then id so that when a hard cap is applied
  // (e.g. performance fallback), each model/category is represented evenly.
  const sorted = [...visible].sort((a, b) => {
    const m = a.sourceModel.localeCompare(b.sourceModel);
    if (m !== 0) return m;
    const c = (a.category || '').localeCompare(b.category || '');
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });
  const capped = max >= sorted.length ? sorted : sorted.slice(0, max);
  if (capped.length === 0) return [];

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const o of capped) {
    const b = o.boundingBox;
    minX = Math.min(minX, b.min[0]);
    minY = Math.min(minY, b.min[1]);
    minZ = Math.min(minZ, b.min[2]);
    maxX = Math.max(maxX, b.max[0]);
    maxY = Math.max(maxY, b.max[1]);
    maxZ = Math.max(maxZ, b.max[2]);
  }
  const originWorld: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];

  return capped.map((o) => {
    const bbox = o.boundingBox;
    const center = bboxCenter(bbox);
    return {
      id: o.id,
      label: typeShortLabel(o.type, o.category),
      position: worldToViewer(center, originWorld),
      size: bboxSize(bbox),
      worldPosition: center,
    };
  });
}
