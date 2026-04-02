'use client';

import type { BBox, Clash, ViewerObjectState } from '@/data/clashes';

export const WORLD_LIMIT = 220;
/** Scale từ meter (IFC world unit) sang viewer world unit */
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
  /** Tọa độ gốc trong IFC world (meters) */
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
 * Chuyển world coordinates (meters) sang viewer X/Z screen coords.
 * Căn chỉnh quanh origin (midpoint của 2 object).
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
 * Xây dựng scene objects từ clash.
 * - Nếu clash có objectABBox/objectBBBox → dùng tọa độ thật từ IFC model.
 * - Nếu không có → fallback về mock layout (backward compat với dữ liệu cũ).
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
// Collision detection (2D X/Z plane) — dùng cho viewer drag
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

export const buildViewerObjects = (scene: SceneObject[], selectedObjectId: string | null): ViewerObjectState[] => {
  const mapped: ViewerObjectState[] = scene.map((obj) => ({
    id: obj.id,
    label: obj.label,
    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    size: obj.size,
    isSelected: selectedObjectId === obj.id,
    isColliding: false,
  }));

  return applyCollisionFlags(mapped);
};
