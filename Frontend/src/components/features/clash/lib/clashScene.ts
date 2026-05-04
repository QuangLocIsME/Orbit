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
  /** When present, mesh vertex mean gives a truer world position than bbox (avoids stacked 2D cards if bbox metadata is generic). */
  clashMesh?: { positions: number[] } | null;
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

/**
 * World-space origin (meters) for shifting clash-detail IFC meshes into viewer space.
 * Does not depend solely on Zustand `getScene` — that can be empty on the first render or lack
 * `worldPosition` when bboxes were missing at scene build time.
 */
export function computeClashDetailMeshOriginWorld(
  clash: Clash,
  objectMeshPositions: Record<string, number[]>,
  scene: SceneObject[] | null | undefined
): [number, number, number] | null {
  const sa = scene?.find((o) => o.id === clash.objectA);
  const sb = scene?.find((o) => o.id === clash.objectB);
  if (sa?.worldPosition && sb?.worldPosition) {
    return [
      (sa.worldPosition[0] + sb.worldPosition[0]) / 2,
      (sa.worldPosition[1] + sb.worldPosition[1]) / 2,
      (sa.worldPosition[2] + sb.worldPosition[2]) / 2,
    ];
  }

  const bboxA = clash.objectABBox;
  const bboxB = clash.objectBBBox;
  if (bboxA && bboxB) {
    const ca = bboxCenter(bboxA);
    const cb = bboxCenter(bboxB);
    return [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2];
  }
  if (bboxA) return bboxCenter(bboxA);
  if (bboxB) return bboxCenter(bboxB);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let any = false;
  for (const id of [clash.objectA, clash.objectB]) {
    const pos = objectMeshPositions[id];
    if (!pos?.length) continue;
    for (let i = 0; i + 2 < pos.length; i += 3) {
      any = true;
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }
  if (any) return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];

  if (Array.isArray(clash.position) && clash.position.length >= 3) {
    return [Number(clash.position[0]), Number(clash.position[1]), Number(clash.position[2])];
  }

  return null;
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
  /** Keep tiny overlaps visible without inflating the red volume to a huge block. */
  const MIN_VIS = 0.25;
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
  /** Fallback marker at clash point — keep small so it does not dominate the view. */
  const MARKER = 5;
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
 * Mean vertex position in IFC world space (m). Subsamples long buffers for performance.
 */
function meshMeanCenterWorld(positions: number[] | undefined | null): [number, number, number] | null {
  if (!positions || positions.length < 9) return null;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  const step = positions.length > 30_000 ? 24 : 3;
  for (let i = 0; i + 2 < positions.length; i += step) {
    const x = Number(positions[i]);
    const y = Number(positions[i + 1]);
    const z = Number(positions[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    sx += x;
    sy += y;
    sz += z;
    n += 1;
  }
  if (n === 0) return null;
  return [sx / n, sy / n, sz / n];
}

/**
 * World-space center for an overview object: prefer mesh mean, else bbox center.
 */
function overviewObjectWorldCenter(o: FederatedOverviewObject): [number, number, number] {
  const fromMesh = meshMeanCenterWorld(o.clashMesh?.positions ?? null);
  if (fromMesh) return fromMesh;
  return bboxCenter(o.boundingBox);
}

/** Golden-angle sunflower (Phyllotaxis) — even density on a disk, monotonic radius. */
function sunflowerPositions2d(count: number, spacing: number): Array<{ x: number; z: number }> {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < count; i++) {
    const r = spacing * Math.sqrt(i + 1);
    const t = i * golden;
    out.push({ x: r * Math.cos(t), z: r * Math.sin(t) });
  }
  return out;
}

/**
 * After normalisation, merge markers that still fall in the same screen cell (float noise / tiny offsets).
 */
function spreadBinnedPlanOverlaps(
  scene: SceneObject[],
  cellPx: number,
  sunflowerSpacing: number
): SceneObject[] {
  if (scene.length <= 1) return scene;
  const cell = Math.max(cellPx, 24);
  const keyOf = (x: number, z: number) =>
    `${Math.floor(x / cell)},${Math.floor(z / cell)}`;

  const groups = new Map<string, SceneObject[]>();
  for (const o of scene) {
    const k = keyOf(o.position.x, o.position.z);
    const list = groups.get(k);
    if (list) list.push(o);
    else groups.set(k, [o]);
  }

  const nextById = new Map<string, ScenePosition>();
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    let ax = 0;
    let az = 0;
    for (const g of group) {
      ax += g.position.x;
      az += g.position.z;
    }
    ax /= group.length;
    az /= group.length;
    const sun = sunflowerPositions2d(group.length, sunflowerSpacing * 0.55);
    group.forEach((g, i) => {
      nextById.set(g.id, {
        ...g.position,
        x: ax + sun[i].x,
        z: az + sun[i].z,
      });
    });
  }

  return scene.map((o) => {
    const np = nextById.get(o.id);
    if (!np) return o;
    return { ...o, position: np };
  });
}

const PLAN_LAYOUT_TARGET_EXTENT = 680;
const PLAN_DEGENERATE_SPAN_M = 1e-5;
const PLAN_BIN_CELL_PX = 46;
const PLAN_SUNFLOWER_SPACING = 38;

/**
 * Viewer2D places `position.x` / `position.z` as **CSS px** from centre (`calc(50% + xpx)`).
 * Raw metre offsets are therefore far too small vs `MIN_RENDER_BOX_SIZE` (42px) — elements look stacked.
 * This pass scales real-world layout into plan “pixels”, sunflowers truly coincident sets, and separates bins.
 * Does not alter `worldPosition` (IFC truth). Use only for the 2D overview pipeline.
 */
export function layoutOverviewMarkersFor2DPlan(scene: SceneObject[]): SceneObject[] {
  if (scene.length === 0) return scene;

  const xs = scene.map((o) => o.position.x);
  const zs = scene.map((o) => o.position.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const degenerate = spanX < PLAN_DEGENERATE_SPAN_M && spanZ < PLAN_DEGENERATE_SPAN_M;

  if (degenerate) {
    const sun = sunflowerPositions2d(scene.length, PLAN_SUNFLOWER_SPACING);
    return scene.map((o, i) => ({
      ...o,
      position: { ...o.position, x: sun[i].x, z: sun[i].z },
      size: {
        width: Math.max(o.size.width, 10),
        depth: Math.max(o.size.depth, 10),
        height: o.size.height,
      },
    }));
  }

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(spanX, spanZ, PLAN_DEGENERATE_SPAN_M);
  let normFactor = PLAN_LAYOUT_TARGET_EXTENT / span;
  normFactor = Math.min(Math.max(normFactor, 0.002), 800);

  let scaled: SceneObject[] = scene.map((o) => ({
    ...o,
    position: {
      ...o.position,
      x: (o.position.x - cx) * normFactor,
      z: (o.position.z - cz) * normFactor,
    },
    size: {
      width: Math.max(o.size.width * normFactor, 8),
      depth: Math.max(o.size.depth * normFactor, 8),
      height: Math.max(o.size.height * normFactor, 4),
    },
  }));

  scaled = spreadBinnedPlanOverlaps(scaled, PLAN_BIN_CELL_PX, PLAN_SUNFLOWER_SPACING);
  return scaled;
}

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
    const wc = overviewObjectWorldCenter(o);
    minX = Math.min(minX, wc[0]);
    minY = Math.min(minY, wc[1]);
    minZ = Math.min(minZ, wc[2]);
    maxX = Math.max(maxX, wc[0]);
    maxY = Math.max(maxY, wc[1]);
    maxZ = Math.max(maxZ, wc[2]);
  }
  const originWorld: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];

  const mapped = capped.map((o) => {
    const bbox = o.boundingBox;
    const center = overviewObjectWorldCenter(o);
    return {
      id: o.id,
      label: typeShortLabel(o.type, o.category),
      position: worldToViewer(center, originWorld),
      size: bboxSize(bbox),
      worldPosition: center,
    };
  });

  return mapped;
}
