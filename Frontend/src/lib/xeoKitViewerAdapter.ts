/**
 * XeoKitViewerAdapter
 *
 * Skeleton cho XeoKit viewer adapter.
 * Implement đầy đủ khi xeokit viewer được hoàn thành bởi team member.
 *
 * Cách dùng (sau khi xeokit viewer xong):
 * ```ts
 * import { XeoKitViewerAdapter } from '@/lib/xeoKitViewerAdapter';
 *
 * // Trong component, sau khi xeokit Viewer instance được khởi tạo:
 * const adapter = new XeoKitViewerAdapter(viewer);
 * <Viewer3D adapter={adapter} clash={clash} ... />
 * ```
 *
 * Tham chiếu XeoKit API:
 * - https://xeokit.github.io/xeokit-sdk/docs/
 * - viewer.scene.objects[id] — SceneObject
 * - viewer.cameraFlight.flyTo({ aabb }) — Camera animation
 * - viewer.scene.input.on('mouseclicked', ...) — Object picking
 */
import type {
  BBoxData,
  ObjectPickedCallback,
  UnsubscribeFn,
  Vec3,
  ViewerAdapter,
} from '../../lib/viewerAdapter';

/**
 * XeoKit Viewer type — sẽ import từ @xeokit/xeokit-sdk khi tích hợp thật.
 * Hiện khai báo là unknown để tránh lỗi TypeScript.
 */
type XeoKitViewer = unknown;

export class XeoKitViewerAdapter implements ViewerAdapter {
  /**
   * @param viewer - XeoKit Viewer instance
   *   (import { Viewer } from '@xeokit/xeokit-sdk')
   */
  constructor(private readonly viewer: XeoKitViewer) {
    if (!viewer) {
      throw new Error('XeoKitViewerAdapter requires a valid XeoKit Viewer instance');
    }
  }

  // --------------------------------------------------------------------------
  // Highlight
  // --------------------------------------------------------------------------

  highlightObjects(ids: string[]): void {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * const scene = (this.viewer as any).scene;
     *
     * // Bỏ highlight tất cả
     * for (const id of Object.keys(scene.objects)) {
     *   scene.objects[id].highlighted = false;
     * }
     *
     * // Highlight ids được chỉ định
     * for (const id of ids) {
     *   if (scene.objects[id]) {
     *     scene.objects[id].highlighted = true;
     *   }
     * }
     */
    console.warn('[XeoKitViewerAdapter] highlightObjects not yet implemented', ids);
  }

  // --------------------------------------------------------------------------
  // Camera focus
  // --------------------------------------------------------------------------

  focusObject(id: string): void {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * const scene = (this.viewer as any).scene;
     * const obj = scene.objects[id];
     * if (!obj) return;
     *
     * (this.viewer as any).cameraFlight.flyTo(
     *   { aabb: obj.aabb },
     *   () => {} // onComplete callback (optional)
     * );
     */
    console.warn('[XeoKitViewerAdapter] focusObject not yet implemented', id);
  }

  // --------------------------------------------------------------------------
  // Position queries
  // --------------------------------------------------------------------------

  getObjectWorldPosition(id: string): Vec3 | null {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * const scene = (this.viewer as any).scene;
     * const obj = scene.objects[id];
     * if (!obj) return null;
     *
     * // Tâm của AABB
     * const [x1, y1, z1, x2, y2, z2] = obj.aabb;
     * return [(x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2];
     */
    console.warn('[XeoKitViewerAdapter] getObjectWorldPosition not yet implemented', id);
    return null;
  }

  setObjectWorldPosition(id: string, position: Vec3): void {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * const scene = (this.viewer as any).scene;
     * const obj = scene.objects[id];
     * if (!obj) return;
     *
     * // Tính offset từ position hiện tại đến position mới
     * const currentCenter = this.getObjectWorldPosition(id);
     * if (!currentCenter) return;
     *
     * const [dx, dy, dz] = [
     *   position[0] - currentCenter[0],
     *   position[1] - currentCenter[1],
     *   position[2] - currentCenter[2],
     * ];
     *
     * // Di chuyển tất cả mesh trong object
     * obj.meshes.forEach((mesh: any) => {
     *   const [px, py, pz] = mesh.position;
     *   mesh.position = [px + dx, py + dy, pz + dz];
     * });
     */
    console.warn('[XeoKitViewerAdapter] setObjectWorldPosition not yet implemented', id, position);
  }

  // --------------------------------------------------------------------------
  // Bounding box
  // --------------------------------------------------------------------------

  getObjectBoundingBox(id: string): BBoxData | null {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * const scene = (this.viewer as any).scene;
     * const obj = scene.objects[id];
     * if (!obj) return null;
     *
     * // XeoKit AABB format: [minX, minY, minZ, maxX, maxY, maxZ]
     * const [x1, y1, z1, x2, y2, z2] = obj.aabb;
     * return { min: [x1, y1, z1], max: [x2, y2, z2] };
     */
    console.warn('[XeoKitViewerAdapter] getObjectBoundingBox not yet implemented', id);
    return null;
  }

  // --------------------------------------------------------------------------
  // Object picking
  // --------------------------------------------------------------------------

  onObjectPicked(callback: ObjectPickedCallback): UnsubscribeFn {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * const input = (this.viewer as any).scene.input;
     * const sub = input.on('mouseclicked', (coords: [number, number]) => {
     *   const hit = (this.viewer as any).scene.pick({ canvasPos: coords });
     *   if (hit && hit.entity) {
     *     callback(hit.entity.id);
     *   }
     * });
     *
     * return () => input.off(sub);
     */
    console.warn('[XeoKitViewerAdapter] onObjectPicked not yet implemented');
    return () => {};
  }

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  resetAllPositions(): void {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     * Reload model hoặc reset transforms về giá trị ban đầu.
     */
    console.warn('[XeoKitViewerAdapter] resetAllPositions not yet implemented');
  }

  getLoadedObjectIds(): string[] {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * const scene = (this.viewer as any).scene;
     * return Object.keys(scene.objects);
     */
    return [];
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    /**
     * TODO: Implement khi XeoKit viewer sẵn sàng.
     *
     * (this.viewer as any).destroy();
     */
    console.warn('[XeoKitViewerAdapter] dispose not yet implemented');
  }
}
