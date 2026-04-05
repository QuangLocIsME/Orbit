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
/** Scale from meters (IFC world units) to viewer world units */
export const WORLD_SCALE = 30;
/** Alias for backward compat with useObjectInteraction */
export const PIXELS_TO_WORLD = WORLD_SCALE;
export const DEFAULT_SCENE_Y = 0;

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

export const clampWorld = (value: number) => Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, value));

// ---------------------------------------------------------------------------
// BBox helpers
// ---------------------------------------------------------------------------

const bboxCenter = (bbox: BBox): [number, number, number] => [
  (bbox.min[0] + bbox.max[0]) / 2,
  (bbox.min[1] + bbox.max[1]) / 2,
  (bbox.min[2] + bbox.max[2]) / 2,
];

const bboxSize = (bbox: BBox): SceneSize => ({
  width:  Math.max((bbox.max[0] - bbox.min[0]) * WORLD_SCALE, 20),
  depth:  Math.max((bbox.max[2] - bbox.min[2]) * WORLD_SCALE, 20),
  height: Math.max((bbox.max[1] - bbox.min[1]) * WORLD_SCALE, 20),
});

/**
 * Convert world coordinates (meters) to viewer X/Z screen coordinates.
 * Centered on origin (midpoint of the two objects for clash scenes).
 */
const worldToViewer = (
  worldPos: [number, number, number],
  originWorld: [number, number, number]
): ScenePosition => ({
  x: clampWorld((worldPos[0] - originWorld[0]) * WORLD_SCALE),
  y: worldPos[1] * WORLD_SCALE,
  z: clampWorld((worldPos[2] - originWorld[2]) * WORLD_SCALE),
});

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

export const applyCollisionFlags = (objects: ViewerObjectState[]) =>
  objects.map((obj, _, all) => ({
    ...obj,
    isColliding: all.some((other) => other.id !== obj.id && intersects2D(obj, other)),
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
  const max = opts.maxObjects ?? 400;
  const visible = objects.filter((o) => {
    if (o.hidden) return false;
    if (opts.hiddenModelIds.includes(o.sourceModel)) return false;
    const catKey = (o.category || o.type.replace(/^Ifc/, '')).trim();
    if (opts.hiddenCategories.length && opts.hiddenCategories.includes(catKey)) return false;
    return true;
  });

  const sorted = [...visible].sort((a, b) => a.id.localeCompare(b.id));
  const capped = sorted.slice(0, max);
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
