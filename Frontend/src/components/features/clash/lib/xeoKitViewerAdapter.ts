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

type EntityIdInput = string | string[] | null | undefined;

function entityIdCandidates(input: EntityIdInput): string[] {
  const raw = Array.isArray(input) ? input : [input];
  return Array.from(new Set(raw.map((id) => String(id ?? '').trim()).filter(Boolean)));
}

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

/**
 * Axis-aligned box as triangle soup (viewer-space). Used when clash has bbox metadata but no IFC mesh.
 */
function buildBoxTrianglePositions(
  cx: number,
  cy: number,
  cz: number,
  hw: number,
  hh: number,
  hd: number
): number[] {
  const x0 = cx - hw;
  const x1 = cx + hw;
  const y0 = cy - hh;
  const y1 = cy + hh;
  const z0 = cz - hd;
  const z1 = cz + hd;
  const out: number[] = [];
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number]
  ) => {
    out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    out.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  };
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
  quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]);
  quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
  quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]);
  return out;
}

function trianglePositionsFromSceneObject(o: XeoKitSceneObject): number[] | null {
  if (o.meshPositions && o.meshPositions.length >= 9) return o.meshPositions;
  const s = o.size;
  if (!s || s.width <= 0 || s.depth <= 0 || s.height <= 0) return null;
  const { x, y, z } = o.position;
  return buildBoxTrianglePositions(x, y, z, s.width / 2, s.height / 2, s.depth / 2);
}

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
  // Match XKT clash highlight: A green, B yellow.
  if (object.isClashObjectB) return [1.0, 0.85, 0.0];
  if (object.isClashObject) return [0.12, 0.8, 0.4];
  if (object.isDeEmphasized) return [0.50, 0.58, 0.68];
  if (object.isColliding) return [1.0, 0.85, 0.0];
  if (object.isInTestScope) return [0.24, 0.80, 0.62];
  return object.isSelected ? [0.30, 0.90, 0.72] : [0.24, 0.80, 0.62];
};

export class XeoKitViewerAdapter implements ViewerAdapter {
  /**
   * xeokit `Mesh#set colorize`: falsy value disables tint and restores fragment×material colors.
   * Do **not** assign `color = null` — some entity types fall back to a solid default (often blue).
   */
  private clearEntityMaterialTint(entity: unknown): void {
    if (!entity || typeof entity !== 'object') return;
    try {
      const e = entity as { colorize?: number[] | null };
      e.colorize = null as unknown as number[];
    } catch {
      /* ignore */
    }
  }

  /** Non-standard on Entity; if set, it overrides PBR and kills glazing transparency. */
  private stripInvalidEntityColorProperty(entity: unknown): void {
    if (!entity || typeof entity !== 'object') return;
    try {
      if ('color' in (entity as object)) Reflect.deleteProperty(entity as object, 'color');
    } catch {
      /* ignore */
    }
  }

  /**
   * Undo our isolation dim (≈0.09) or hide (0) by removing the property so xeokit restores fragment/material alpha.
   * Do not set `opacity = 1` — that forces opaque glass.
   */
  private undoOurEntityOpacityIfAny(entity: unknown): void {
    if (!entity || typeof entity !== 'object') return;
    try {
      const o = (entity as { opacity?: number }).opacity;
      if (typeof o === 'number' && (Math.abs(o - 0.09) < 0.025 || o === 0)) {
        Reflect.deleteProperty(entity as object, 'opacity');
      }
    } catch {
      /* ignore */
    }
  }

  /** SceneModel bbox overlay — must not strip tint when resetting XKT (different effect owns those meshes). */
  private static isOrbitOverlayComponentId(id: unknown): boolean {
    return typeof id === 'string' && id.startsWith('orbit-');
  }

  /**
   * Isolation **All**: clear tint + highlight/xray on every object entity so glazing/interiors match native IFC (see xeokit Scene#setObjectsHighlighted).
   *
   * **Do not** set `opacity = 1` on every entity — xeokit stores opacity in `colorize[3]`; glazing uses alpha &lt; 1 for transparency.
   * Forcing opaque makes IFC windows render as solid bright planes (often blue/cyan). Only undo our Dim isolation (~0.09 opacity).
   */
  private resetNaturalAppearanceForAllMode(): void {
    const scene = this.viewer.scene as {
      objects?: Record<string, unknown>;
      models?: Record<string, { objects?: Record<string, unknown> }>;
      components?: Record<string, { type?: string; id?: string }>;
      highlightedObjectIds?: string[];
      xrayedObjectIds?: string[];
      selectedObjectIds?: string[];
      colorizedObjectIds?: string[];
      setObjectsHighlighted?: (ids: string[], highlighted: boolean) => boolean | void;
      setObjectsXRayed?: (ids: string[], xrayed: boolean) => boolean | void;
      setObjectsSelected?: (ids: string[], selected: boolean) => boolean | void;
      setObjectsColorized?: (ids: string[], colorize: number[] | null) => boolean | void;
    } | undefined;

    /**
     * xeokit keeps parallel maps (highlightedObjects, colorizedObjects, …). Assigning properties only on `scene.objects`
     * can leave DTX / emphasis renderers still drawing highlight fill (blue). Mirror BCF reset:
     * `setObjectsHighlighted(ids,false)`, `setObjectsColorized(ids,null)` (see xeokit Scene).
     */
    if (scene?.setObjectsHighlighted && scene.highlightedObjectIds?.length) {
      scene.setObjectsHighlighted([...scene.highlightedObjectIds], false);
    }
    if (scene?.setObjectsXRayed && scene.xrayedObjectIds?.length) {
      scene.setObjectsXRayed([...scene.xrayedObjectIds], false);
    }
    if (scene?.setObjectsSelected && scene.selectedObjectIds?.length) {
      scene.setObjectsSelected([...scene.selectedObjectIds], false);
    }
    if (scene?.setObjectsColorized && scene.colorizedObjectIds?.length) {
      scene.setObjectsColorized([...scene.colorizedObjectIds], null);
    }

    const touch = (entity: unknown) => {
      if (!entity || typeof entity !== 'object') return;
      try {
        const e = entity as {
          colorize?: unknown;
          highlighted?: boolean;
          xrayed?: boolean;
          selected?: boolean;
          opacity?: number;
          visible?: boolean;
          color?: unknown;
        };
        /** Isolation Dim mistakenly set `.color` on some builds — not a xeokit Node API; remove so materials restore. */
        if ('color' in e) Reflect.deleteProperty(e, 'color');

        e.highlighted = false;
        e.xrayed = false;
        e.selected = false;
        e.visible = true;
        e.colorize = null as unknown as number[];
        /** Undo isolation Dim (~0.09) and Hide (0) — never force opaque `opacity = 1` on glass. */
        const o = e.opacity;
        if (typeof o === 'number' && (Math.abs(o - 0.09) < 0.025 || o === 0)) {
          Reflect.deleteProperty(e as object, 'opacity');
        }
      } catch {
        /* ignore */
      }
    };

    /**
     * XKT + DTX: Dim applies `colorize`/`opacity` on meta-objects; child **Mesh**es also pick up state but are often **not**
     * registered in `scene.colorizedObjectIds` (only `isObject` roots are). Remaining leaf meshes keep dim gray / wrong alpha
     * or emphasis fill → solid blue/cyan panes on glass. Walk every Mesh/Node in `scene.components` (xeokit’s full registry).
     */
    const components = scene?.components;
    if (components) {
      for (const comp of Object.values(components)) {
        if (!comp || typeof comp !== 'object') continue;
        const t = (comp as { type?: string }).type;
        if (t !== 'Mesh' && t !== 'Node') continue;
        if (XeoKitViewerAdapter.isOrbitOverlayComponentId((comp as { id?: string }).id)) continue;
        touch(comp);
      }
    }

    for (const entity of Object.values(scene?.objects ?? {})) {
      touch(entity);
    }
    for (const modelId of this.loadedXktModelIds) {
      const objs = scene?.models?.[modelId]?.objects;
      if (!objs) continue;
      for (const entity of Object.values(objs)) {
        touch(entity);
      }
    }
  }

  private sceneModel: InstanceType<XeoKitSceneModelCtor> | null = null;
  private readonly basePositions = new Map<string, Vec3>();
  private loadedObjectIds: string[] = [];
  private readonly sceneModelCtor?: XeoKitSceneModelCtor;
  private xktLoader: { load: (cfg: Record<string, unknown>) => unknown; destroy?: () => void } | null = null;
  private readonly meshIdToObjectId = new Map<string, string>();
  private loadedXktModelIds: string[] = [];
  private xktSyncGeneration = 0;
  /**
   * Bumps on every `syncXktModels` call (including short path). Pending double-rAF `onLoaded` chains must match the
   * latest value — otherwise switching clashes stacks stale callbacks that still pass `xktSyncGeneration` and overwrite
   * Dim/Hide/highlight with the wrong pair.
   */
  private xktVisualApplySeq = 0;
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

  loadSceneObjects(objects: XeoKitSceneObject[]): void {
    const scene = this.viewer.scene;
    if (!scene || !this.sceneModelCtor) return;

    this.disposeSceneModel();
    this.basePositions.clear();
    this.meshIdToObjectId.clear();
    this.loadedObjectIds = [];

    const renderList: { object: XeoKitSceneObject; positions: number[]; bboxFallback: boolean }[] = [];
    for (const o of objects) {
      const positions = trianglePositionsFromSceneObject(o);
      if (!positions || positions.length < 9) continue;
      const bboxFallback = !(o.meshPositions && o.meshPositions.length >= 9);
      renderList.push({ object: o, positions, bboxFallback });
    }
    if (renderList.length === 0) {
      return;
    }

    const model = new this.sceneModelCtor(scene, {
      id: `orbit-clash-${Date.now()}`,
      isModel: true,
      pickable: true,
    });

    renderList.forEach(({ object, positions, bboxFallback }, index) => {
      const meshId = `orbit-mesh-${index}`;
      const vertCount = Math.floor(positions.length / 3);
      const indices: number[] = new Array(vertCount);
      for (let i = 0; i < vertCount; i++) indices[i] = i;

      const geoId = `orbit-geo-real-${index}`;
      model.createGeometry({
        id: geoId,
        primitive: 'triangles',
        positions: Array.from(positions),
        autoNormals: true,
        indices,
      });
      model.createMesh({
        id: meshId,
        geometryId: geoId,
        position: [0, 0, 0],
        scale: [1, 1, 1],
        color: colorForObject(object),
        opacity: bboxFallback ? 0.5 : 1,
      });

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

    model.finalize();
    this.sceneModel = model;
    this.flyToModel();
  }

  /**
   * Load or refresh XKT models (authenticated fetch).
   * Calls onLoaded callback after all models are ready (for post-load operations like recolor).
   * @param options.skipCameraFit — when true, do not fly the camera to the full XKT union (clash detail frames on clash AABB instead).
   */
  async syncXktModels(
    projectSlug: string,
    modelIds: string[],
    onLoaded?: (loadedIds: string[]) => void,
    options?: { skipCameraFit?: boolean }
  ): Promise<void> {
    const applySeq = ++this.xktVisualApplySeq;
    /** Bumps on every sync — aborts in-flight full loads that haven’t finished yet (short-path clash switches must cancel stale HTTP loops). */
    const gen = ++this.xktSyncGeneration;
    const sortKey = (ids: string[]) => [...ids].sort().join('\0');
    if (
      modelIds.length > 0 &&
      this.loadedXktModelIds.length === modelIds.length &&
      sortKey(modelIds) === sortKey(this.loadedXktModelIds)
    ) {
      /** Same XKT set already in scene — avoid destroy/reload (fixes bbox flash / blue glitch when switching clashes). */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (applySeq !== this.xktVisualApplySeq) return;
          /**
           * Do **not** call `forceClearLoadedXktVisualState` here. The clash-detail React effect runs after this
           * `syncXktModels` call in the same commit and applies Dim/Hide + recolor; a late force-clear was wiping
           * that state on the next animation frames and produced “all dimmed” / missing pair emphasis until another toggle.
           */
          if (!options?.skipCameraFit) {
            this.fitCameraToXktModels(applySeq, [...this.loadedXktModelIds]);
          }
          onLoaded?.([...this.loadedXktModelIds]);
        });
      });
      return;
    }

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
        dtxEnabled: false,
        edges: false,
        backfaces: true,
      }) as { aabb?: number[]; once?: (ev: string, fn: () => void) => void };

      await waitForXktSceneModelLoaded(sceneModel, 20000);
      if (gen !== this.xktSyncGeneration) return;

      this.loadedXktModelIds.push(id);
      loadedIds.push(id);
    }

    if (loadedIds.length === 0) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (applySeq !== this.xktVisualApplySeq) return;
        if (gen !== this.xktSyncGeneration) return;
        this.forceClearLoadedXktVisualState();
        /**
         * Do NOT call loadSceneObjects([]) here. Viewer3D owns SceneModel bbox overlay and only clears it
         * when skipBboxOverlayBecauseXkt is true. Clearing unconditionally removed bbox after XKT load while
         * skip stayed false — React effect did not re-run (deps unchanged) → ~1s correct view then wrong.
         */
        if (!options?.skipCameraFit) {
          this.fitCameraToXktModels(applySeq, loadedIds);
        }
        onLoaded?.(loadedIds);
      });
    });
  }

  /**
   * Hard reset any lingering visual overrides on currently loaded XKT entities.
   * Needed because previous clash passes (dim/hide/highlight/colorize) can leave stale state on leaf meshes.
   */
  forceClearLoadedXktVisualState(): void {
    const scene = this.viewer.scene as {
      models?: Record<string, { objects?: Record<string, unknown> }>;
      objects?: Record<string, unknown>;
      setObjectsHighlighted?: (ids: string[], highlighted: boolean) => boolean | void;
      setObjectsXRayed?: (ids: string[], xrayed: boolean) => boolean | void;
      setObjectsSelected?: (ids: string[], selected: boolean) => boolean | void;
      setObjectsColorized?: (ids: string[], colorize: number[] | null) => boolean | void;
    } | undefined;
    if (!scene?.models) return;

    const loadedEntityIds = new Set<string>();
    for (const modelId of this.loadedXktModelIds) {
      const objects = scene.models?.[modelId]?.objects;
      if (!objects) continue;
      for (const objectId of Object.keys(objects)) {
        loadedEntityIds.add(objectId);
      }
    }
    const ids = [...loadedEntityIds];
    if (ids.length === 0) return;

    scene.setObjectsHighlighted?.(ids, false);
    scene.setObjectsXRayed?.(ids, false);
    scene.setObjectsSelected?.(ids, false);
    scene.setObjectsColorized?.(ids, null);

    const clearEntity = (entity: unknown) => {
      if (!entity || typeof entity !== 'object') return;
      const e = entity as {
        color?: unknown;
        colorize?: unknown;
        highlighted?: boolean;
        xrayed?: boolean;
        selected?: boolean;
        visible?: boolean;
        opacity?: number;
      };
      try {
        if ('color' in e) Reflect.deleteProperty(e, 'color');
        e.colorize = null as unknown as number[];
        /**
         * Dim/Hide isolation sets `opacity` to ~0.09 / 0. If we only flip `visible` when switching clashes, the new
         * clash pair can stay invisible (still opacity 0). Strip **only** those isolation values — not arbitrary glass alpha.
         */
        const o = e.opacity;
        if (typeof o === 'number' && (Math.abs(o - 0.09) < 0.025 || o === 0)) {
          Reflect.deleteProperty(e as object, 'opacity');
        }
        e.highlighted = false;
        e.xrayed = false;
        e.selected = false;
        e.visible = true;
      } catch {
        // ignore per-entity reset errors
      }
    };

    for (const modelId of this.loadedXktModelIds) {
      const objects = scene.models?.[modelId]?.objects;
      if (!objects) continue;
      for (const entity of Object.values(objects)) {
        clearEntity(entity);
      }
    }
    const globalObjects = scene.objects ?? {};
    for (const id of ids) {
      clearEntity(globalObjects[id]);
    }

    /**
     * Dim/Hide sets `colorize`/`opacity` on meta-objects; xeokit often propagates to **Mesh** leaves that are not in
     * `scene.models[id].objects` maps — switching clashes left leaf geometry stuck dimmed until `resetNaturalAppearance`.
     */
    const sceneWithComponents = this.viewer.scene as { components?: Record<string, { type?: string; id?: string }> } | undefined;
    const components = sceneWithComponents?.components;
    if (components) {
      for (const comp of Object.values(components)) {
        if (!comp || typeof comp !== 'object') continue;
        const t = (comp as { type?: string }).type;
        if (t !== 'Mesh' && t !== 'Node') continue;
        if (XeoKitViewerAdapter.isOrbitOverlayComponentId((comp as { id?: string }).id)) continue;
        clearEntity(comp);
      }
    }
  }

  /**
   * Fit camera to the union of loaded XKT models (and SceneModel overlay if any).
   * Use as fallback when clash world AABB is unavailable.
   */
  fitCameraToLoadedXktUnion(): void {
    const seq = this.xktVisualApplySeq;
    this.fitCameraToXktModels(seq, [...this.loadedXktModelIds]);
  }

  /** Fit viewer camera to union AABB of loaded XKT models (+ optional bbox overlay SceneModel). */
  private fitCameraToXktModels(expectedApplySeq: number, xktIds: string[]): void {
    if (!this.viewer || expectedApplySeq !== this.xktVisualApplySeq) return;
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
    const scene = this.viewer.scene as {
      objects?: Record<string, { highlighted?: boolean; selected?: boolean }>;
      highlightedObjectIds?: string[];
      selectedObjectIds?: string[];
      setObjectsHighlighted?: (ids: string[], highlighted: boolean) => boolean | void;
      setObjectsSelected?: (ids: string[], selected: boolean) => boolean | void;
    } | undefined;
    const sceneObjects = scene?.objects;
    if (!sceneObjects) return;
    /** xeokit emphasis pass — clear via Scene API so DTX stays in sync (matches resetNaturalAppearanceForAllMode). */
    if (ids.length === 0) {
      if (scene.setObjectsHighlighted && scene.highlightedObjectIds?.length) {
        scene.setObjectsHighlighted([...scene.highlightedObjectIds], false);
      }
      if (scene.setObjectsSelected && scene.selectedObjectIds?.length) {
        scene.setObjectsSelected([...scene.selectedObjectIds], false);
      }
      return;
    }
    Object.keys(sceneObjects).forEach((objectId) => {
      const object = sceneObjects[objectId];
      if (!object) return;
      const on = ids.some((raw) => {
        const r = (raw ?? '').trim();
        return Boolean(r && (r === objectId || this.clashUidMatchesSceneEntityId(r, objectId)));
      });
      object.highlighted = on;
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

  getObjectBoundingBox(id: EntityIdInput): BBoxData | null {
    for (const candidate of entityIdCandidates(id)) {
      const fromXkt = this.findEntityInXktModels(candidate);
      if (fromXkt) {
        const entity = fromXkt.entity as { aabb?: number[] } | undefined;
        const bb = bboxFromAABB(entity?.aabb);
        if (bb) return bb;
      }
    }
    const object = entityIdCandidates(id)
      .map((candidate) => this.viewer.scene?.objects?.[candidate])
      .find(Boolean);
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
      if (!objectId) return;
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
    this.xktVisualApplySeq += 1;
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

  /** True if an entity with this IFC / federated id exists in any loaded XKT model. */
  hasXktEntity(objectId: EntityIdInput): boolean {
    return entityIdCandidates(objectId).some((id) => this.findEntityInXktModels(id) !== null);
  }

  /**
   * IFC / Navis ids vs xeokit scene keys: braces, `$` (STEP encoding), path prefixes, casing.
   */
  private normalizeIfcGuidForMatch(s: string): string {
    return s
      .trim()
      .replace(/[{}]/g, '')
      .replace(/\$/g, '')
      .replace(/-/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  /**
   * Higher = stronger match. Used to pick the best XKT entity for a clash id and to avoid false “first key” hits.
   */
  private clashIdToSceneKeyMatchScore(clashUid: string | null | undefined, sceneEntityId: string): number {
    const raw = (clashUid ?? '').trim();
    if (!raw || !sceneEntityId) return 0;
    const cand = sceneEntityId.trim();
    if (cand === raw) return 100;
    if (cand.toLowerCase() === raw.toLowerCase()) return 95;
    const na = this.normalizeIfcGuidForMatch(raw);
    const nb = this.normalizeIfcGuidForMatch(cand);
    if (na.length >= 10 && nb.length >= 10 && na === nb) return 85;
    if (cand.endsWith(`/${raw}`)) return 75;
    if (cand.endsWith(`:${raw}`)) return 75;
    if (cand.endsWith(`#${raw}`)) return 75;
    const debrace = (s: string) => s.replace(/[{}]/g, '').toLowerCase();
    if (debrace(cand) === debrace(raw)) return 70;
    const rl = raw.toLowerCase();
    const cl = cand.toLowerCase();
    /** Suffix-only match is weaker — two elements can share a suffix; prefer only when no stronger key exists. */
    if (rl.length >= 12 && cl.endsWith(rl)) return 55;
    return 0;
  }

  /**
   * Clash tests store IFC / Navis element ids; xeokit XKT keys are often prefixed or braced differently.
   * Must match flexibly or Dim/Hide isolation treats zero entities as the clash pair and dims everything.
   */
  private clashUidMatchesSceneEntityId(clashUid: string | null | undefined, sceneEntityId: string): boolean {
    return this.clashIdToSceneKeyMatchScore(clashUid, sceneEntityId) > 0;
  }

  /**
   * Some XKT exports remap IFC ids (prefix/suffix path, scoped ids, etc.).
   * Resolve all candidate entity ids that likely represent the same object.
   */
  private resolveMatchingEntityIds(objectId: string): string[] {
    const normalized = (objectId || '').trim();
    if (!normalized) return [];
    const scene = this.viewer.scene as
      | {
          objects?: Record<string, unknown>;
          models?: Record<string, { objects?: Record<string, unknown> }>;
        }
      | undefined;
    const matches = new Set<string>([normalized]);
    if (!scene) return Array.from(matches);

    const allKeys = new Set<string>();
    for (const id of Object.keys(scene.objects ?? {})) allKeys.add(id);
    for (const model of Object.values(scene.models ?? {})) {
      for (const id of Object.keys(model.objects ?? {})) allKeys.add(id);
    }

    let best = 0;
    for (const id of allKeys) {
      best = Math.max(best, this.clashIdToSceneKeyMatchScore(normalized, id));
    }
    if (best > 0) {
      for (const id of allKeys) {
        if (this.clashIdToSceneKeyMatchScore(normalized, id) === best) matches.add(id);
      }
    }
    return Array.from(matches);
  }

  /** Force visibility for specific object ids across XKT model entities and global scene objects. */
  setEntitiesVisibility(objectIds: string[], visible: boolean): void {
    if (!objectIds.length) return;
    const scene = this.viewer.scene as
      | {
          objects?: Record<string, { visible?: boolean; opacity?: number }>;
          models?: Record<string, { objects?: Record<string, { visible?: boolean; opacity?: number }> }>;
        }
      | undefined;
    if (!scene) return;

    for (const objectId of objectIds) {
      const candidates = this.resolveMatchingEntityIds(objectId);
      for (const candidateId of candidates) {
        const found = this.findEntityInXktModels(candidateId);
        if (found) {
          const entity = found.entity as { visible?: boolean; opacity?: number };
          entity.visible = visible;
          if (visible) {
            Reflect.deleteProperty(entity as object, 'opacity');
          } else {
            entity.opacity = 0;
          }
        }
        const globalEntity = scene.objects?.[candidateId];
        if (globalEntity) {
          globalEntity.visible = visible;
          if (visible) {
            Reflect.deleteProperty(globalEntity as object, 'opacity');
          } else {
            globalEntity.opacity = 0;
          }
        }
      }
    }
  }

  /**
   * Search all loaded XKT scene models for an entity with the given objectId.
   * XKT objects have isObject=true and id=objectId. We walk meshes → their parent entity.
   */
  private findEntityInXktModels(objectId: string): { entity: unknown; modelId: string } | null {
    const scene = this.viewer.scene as {
      models?: Record<string, { objects?: Record<string, unknown> }>;
      objects?: Record<string, unknown>;
    } | undefined;
    if (!scene?.models) return null;

    const fallbackModelId = this.loadedXktModelIds[0] ?? '';

    for (const modelId of this.loadedXktModelIds) {
      const model = scene.models?.[modelId];
      const objects = model?.objects;
      if (!objects) continue;
      const entity = objects[objectId];
      if (entity) return { entity, modelId };
    }

    let best: { score: number; entity: unknown; modelId: string } | null = null;
    for (const modelId of this.loadedXktModelIds) {
      const objects = scene.models?.[modelId]?.objects;
      if (!objects) continue;
      for (const key of Object.keys(objects)) {
        const s = this.clashIdToSceneKeyMatchScore(objectId, key);
        if (s > 0 && (!best || s > best.score)) {
          best = { score: s, entity: objects[key], modelId };
        }
      }
    }

    /** xeokit sometimes mirrors meta-object roots only under `scene.objects`. */
    const globals = scene.objects;
    if (globals && fallbackModelId) {
      const direct = globals[objectId];
      if (direct) {
        best = { score: 100, entity: direct, modelId: fallbackModelId };
      } else {
        for (const key of Object.keys(globals)) {
          const s = this.clashIdToSceneKeyMatchScore(objectId, key);
          if (s > 0 && (!best || s > best.score)) {
            best = { score: s, entity: globals[key], modelId: fallbackModelId };
          }
        }
      }
    }

    return best ? { entity: best.entity, modelId: best.modelId } : null;
  }

  /**
   * Recolors XKT objects (overview) or restores native IFC materials on the clash pair (clash detail).
   *
   * Overview mode tints visible objects to match the bbox overlay scheme.
   * Clash detail clears tint on objectA/objectB so true IFC colors show; dim/hide isolation provides emphasis.
   */
  recolorXktObjects(
    objectA: EntityIdInput,
    objectB: EntityIdInput,
    allClashObjectIds: string[],
    visibleObjectIds?: string[],
    sceneObjects?: XeoKitSceneObject[]
  ): void {
    const scene = this.viewer.scene as {
      objects?: Record<string, unknown>;
      models?: Record<string, { objects?: Record<string, unknown> }>;
      setObjectsColorized?: (ids: string[], colorize: number[] | null) => boolean | void;
    } | undefined;

    const visibleSet = new Set(visibleObjectIds ?? []);

    // Reset previously-highlighted XKT objects that are no longer in scope.
    for (const [objId, modelId] of this.xktObjectModelMap) {
      if (!allClashObjectIds.includes(objId)) {
        const model = scene?.models?.[modelId];
        const entity = model?.objects?.[objId];
        const globalEntity = scene?.objects?.[objId];
        scene?.setObjectsColorized?.([objId], null);
        if (entity) {
          this.clearEntityMaterialTint(entity);
          this.stripInvalidEntityColorProperty(entity);
          this.undoOurEntityOpacityIfAny(entity);
        }
        if (globalEntity) {
          this.clearEntityMaterialTint(globalEntity);
          this.stripInvalidEntityColorProperty(globalEntity);
          this.undoOurEntityOpacityIfAny(globalEntity);
        }
        this.xktObjectModelMap.delete(objId);
      }
    }

    /**
     * Overview requests (`visibleObjectIds` + `sceneObjects`) formerly filled `colorMap`.
     * We no longer tint XKT in overview — assigning `entity.color` / `entity.colorize` + `opacity = 1` overrides
     * IFC glazing and reads as solid cyan blocks. Keep native materials.
     */
    const colorMap: Record<string, [number, number, number]> = {};

    const isOverviewPass = visibleSet.size > 0 && Boolean(sceneObjects);

    if (!isOverviewPass) {
      // Clash detail: restore native appearance on the pair (no synthetic RGB on entities).
      for (const id of [...entityIdCandidates(objectA), ...entityIdCandidates(objectB)]) {
        const candidates = this.resolveMatchingEntityIds(id);
        for (const cand of candidates) {
          const found = this.findEntityInXktModels(cand);
          const globalEntity = scene?.objects?.[cand];
          scene?.setObjectsColorized?.([cand], null);
          if (found) {
            const entity = found.entity;
            this.clearEntityMaterialTint(entity);
            this.stripInvalidEntityColorProperty(entity);
            this.undoOurEntityOpacityIfAny(entity);
            const e = entity as { visible?: boolean; highlighted?: boolean };
            e.visible = true;
            e.highlighted = false;
          }
          if (globalEntity) {
            this.clearEntityMaterialTint(globalEntity);
            this.stripInvalidEntityColorProperty(globalEntity);
            this.undoOurEntityOpacityIfAny(globalEntity);
            const g = globalEntity as { visible?: boolean; highlighted?: boolean };
            g.visible = true;
            g.highlighted = false;
          }
          this.xktObjectModelMap.delete(cand);
        }
      }
    }

    // Optional future: Scene-level tint only via `setObjectsColorized` (never `entity.color` / `entity.opacity = 1`).
    for (const [objId, color] of Object.entries(colorMap)) {
      scene?.setObjectsColorized?.([objId], [color[0], color[1], color[2], 1]);
      const found = this.findEntityInXktModels(objId);
      if (found) this.xktObjectModelMap.set(objId, found.modelId);
    }
  }

  private destroyXktModels(): void {
    this.clearClashSectionBox();
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

  /**
   * Dim, hide, or reset XKT entities.
   *
   * - **All (off)**: full model, default materials.
   * - **Dim / Hide**: If clash ids resolve in XKT, keep only those entities sharp; rest dim/hide.
   *   If ids do **not** resolve in XKT, dim/hide **all** XKT geometry (so only bbox proxy meshes —
   *   SceneModel entities whose ids equal clash objectA/objectB — remain the visible “two objects”).
   */
  applyClashPairIsolation(
    mode: 'off' | 'dim' | 'hide',
    objectA: EntityIdInput,
    objectB: EntityIdInput
  ): void {
    if (mode === 'off') {
      this.resetNaturalAppearanceForAllMode();
      return;
    }

    const objectAIds = entityIdCandidates(objectA);
    const objectBIds = entityIdCandidates(objectB);
    const hasResolvedA = objectAIds.some((id) => this.findEntityInXktModels(id));
    const hasResolvedB = objectBIds.some((id) => this.findEntityInXktModels(id));
    const anyPairInXkt = hasResolvedA || hasResolvedB;

    /**
     * If neither clash id maps to an XKT entity, treating "non-pair" as everything would dim/hide the **entire**
     * scene (and with bbox overlay skipped for dual-XKT pairs → empty/black viewport). Abort isolation and show full model.
     */
    if (!anyPairInXkt) {
      this.resetNaturalAppearanceForAllMode();
      return;
    }

    const scene = this.viewer.scene as
      | {
          objects?: Record<string, { colorize?: number[]; opacity?: number; visible?: boolean }>;
          models?: Record<string, { objects?: Record<string, { colorize?: number[]; opacity?: number; visible?: boolean }> }>;
        }
      | undefined;

    /** SceneModel clash proxies — match clash ids flexibly (IFC GlobalId casing / prefixes). */
    const isBboxProxyEntityId = (sceneObjId: string) =>
      objectAIds.some((id) => this.clashUidMatchesSceneEntityId(id, sceneObjId)) ||
      objectBIds.some((id) => this.clashUidMatchesSceneEntityId(id, sceneObjId));

    /** Best match score per clash id across all XKT keys — only those keys participate in the “pair” (avoids weak suffix matches). */
    let maxScoreA = 0;
    let maxScoreB = 0;
    for (const modelId of this.loadedXktModelIds) {
      const objects = scene?.models?.[modelId]?.objects;
      if (!objects) continue;
      for (const key of Object.keys(objects)) {
        for (const id of objectAIds) maxScoreA = Math.max(maxScoreA, this.clashIdToSceneKeyMatchScore(id, key));
        for (const id of objectBIds) maxScoreB = Math.max(maxScoreB, this.clashIdToSceneKeyMatchScore(id, key));
      }
    }
    const globalObjectsForMax = scene?.objects ?? {};
    for (const key of Object.keys(globalObjectsForMax)) {
      for (const id of objectAIds) maxScoreA = Math.max(maxScoreA, this.clashIdToSceneKeyMatchScore(id, key));
      for (const id of objectBIds) maxScoreB = Math.max(maxScoreB, this.clashIdToSceneKeyMatchScore(id, key));
    }

    const isKeptXktPairMember = (sceneObjId: string) => {
      if (!anyPairInXkt) return false;
      const sa = Math.max(0, ...objectAIds.map((id) => this.clashIdToSceneKeyMatchScore(id, sceneObjId)));
      const sb = Math.max(0, ...objectBIds.map((id) => this.clashIdToSceneKeyMatchScore(id, sceneObjId)));
      return (maxScoreA > 0 && sa === maxScoreA) || (maxScoreB > 0 && sb === maxScoreB);
    };

    const COL_DIM: [number, number, number] = [0.42, 0.45, 0.5];

    const applyToEntity = (
      entity: { visible?: boolean; opacity?: number; colorize?: number[] },
      globalEntity:
        | { visible?: boolean; opacity?: number; colorize?: number[] }
        | undefined
    ) => {
      if (mode === 'dim') {
        entity.visible = true;
        entity.opacity = 0.09;
        entity.colorize = [...COL_DIM];
        if (globalEntity) {
          globalEntity.visible = true;
          globalEntity.opacity = 0.09;
          globalEntity.colorize = [...COL_DIM];
        }
      } else {
        entity.visible = false;
        entity.opacity = 0;
        if (globalEntity) {
          globalEntity.visible = false;
          globalEntity.opacity = 0;
        }
      }
    };

    for (const modelId of this.loadedXktModelIds) {
      const objects = scene?.models?.[modelId]?.objects;
      if (!objects) continue;
      for (const objId of Object.keys(objects)) {
        if (isKeptXktPairMember(objId)) continue;
        const entity = objects[objId];
        const globalEntity = scene?.objects?.[objId];
        if (!entity) continue;
        applyToEntity(entity, globalEntity);
      }
    }

    const globalObjects = scene?.objects ?? {};
    for (const objId of Object.keys(globalObjects)) {
      /** SceneModel clash proxies — never apply isolation tint here (also fixes “All” washing overlay colors). */
      if (isBboxProxyEntityId(objId)) continue;
      if (anyPairInXkt && isKeptXktPairMember(objId)) continue;
      const entity = globalObjects[objId];
      if (!entity) continue;
      if (mode === 'dim') {
        entity.visible = true;
        entity.opacity = 0.09;
        entity.colorize = [...COL_DIM];
      } else {
        entity.visible = false;
        entity.opacity = 0;
      }
    }
  }

  /** Fly camera to a world-space AABB [xmin,ymin,zmin,xmax,ymax,zmax] with padding (never slam near-plane into surfaces). */
  flyCameraToWorldAabb(aabb: number[], paddingRatio = 0.42): void {
    if (!Array.isArray(aabb) || aabb.length < 6) return;
    const [x0, y0, z0, x1, y1, z1] = aabb;
    const dx = Math.max(x1 - x0, 1e-6);
    const dy = Math.max(y1 - y0, 1e-6);
    const dz = Math.max(z1 - z0, 1e-6);
    const span = Math.max(dx, dy, dz);
    const ratioPad = span * paddingRatio;
    /** BIM metres — avoids clipping inside geometry when the framed box is thin or flat. */
    const minAbsPad = Math.min(3.5, Math.max(1.15, span * 0.06));
    const pad = Math.max(ratioPad, minAbsPad);
    const padded: number[] = [x0 - pad, y0 - pad, z0 - pad, x1 + pad, y1 + pad, z1 + pad];
    this.viewer.cameraFlight?.flyTo?.({ aabb: padded });
  }

  /** Remove all section planes created for clash cropping. */
  clearClashSectionBox(): void {
    const scene = this.viewer.scene as { clearSectionPlanes?: () => void } | undefined;
    scene?.clearSectionPlanes?.();
  }

  /**
   * Clip the scene to a padded world-space box around the clash (six SectionPlanes).
   * Pass `null` to clear.
   */
  async setClashSectionBoxWorldAabb(aabb: number[] | null, paddingRatio = 0.12): Promise<void> {
    this.clearClashSectionBox();
    if (!aabb || aabb.length < 6) return;

    const [x0, y0, z0, x1, y1, z1] = aabb;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const span = Math.max(dx, dy, dz, 1e-6);
    const pad = span * paddingRatio;
    const X0 = x0 - pad;
    const Y0 = y0 - pad;
    const Z0 = z0 - pad;
    const X1 = x1 + pad;
    const Y1 = y1 + pad;
    const Z1 = z1 + pad;
    const cx = (X0 + X1) / 2;
    const cy = (Y0 + Y1) / 2;
    const cz = (Z0 + Z1) / 2;

    const scene = this.viewer.scene as {
      clearSectionPlanes?: () => void;
      numCachedSectionPlanes?: number;
    } | undefined;
    if (!scene) return;

    try {
      const xeokit = await import('@xeokit/xeokit-sdk');
      const SectionPlane = (
        xeokit as { SectionPlane?: new (owner: unknown, cfg: Record<string, unknown>) => unknown }
      ).SectionPlane;
      if (!SectionPlane) return;

      if (typeof scene.numCachedSectionPlanes === 'number') {
        scene.numCachedSectionPlanes = Math.max(scene.numCachedSectionPlanes, 6);
      }

      // SectionPlane discards geometry in the half-space along `dir` from `pos` (see xeokit SectionPlane docs).
      const configs: Array<{ pos: [number, number, number]; dir: [number, number, number] }> = [
        { pos: [X0, cy, cz], dir: [-1, 0, 0] },
        { pos: [X1, cy, cz], dir: [1, 0, 0] },
        { pos: [cx, Y0, cz], dir: [0, -1, 0] },
        { pos: [cx, Y1, cz], dir: [0, 1, 0] },
        { pos: [cx, cy, Z0], dir: [0, 0, -1] },
        { pos: [cx, cy, Z1], dir: [0, 0, 1] },
      ];
      for (let i = 0; i < configs.length; i++) {
        const c = configs[i];
        new SectionPlane(scene, {
          id: `orbit-clash-section-${Date.now()}-${i}`,
          pos: c.pos,
          dir: c.dir,
          active: true,
        });
      }
    } catch {
      // SDK build without SectionPlane or non-browser context
    }
  }
}

