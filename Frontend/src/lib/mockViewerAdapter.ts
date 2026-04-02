/**
 * MockViewerAdapter
 *
 * Implement ViewerAdapter bằng clashStore + clashScene (mock viewer hiện tại).
 * Dùng cho: Viewer3D/Viewer2D hiện tại, không cần thay đổi viewer component.
 *
 * Khi XeoKit sẵn sàng: swap class này bằng XeoKitViewerAdapter.
 */
import type {
  BBoxData,
  ObjectPickedCallback,
  UnsubscribeFn,
  Vec3,
  ViewerAdapter,
} from '../../lib/viewerAdapter';

type ScenePosition = { x: number; y: number; z: number };
type SceneSize = { width: number; depth: number; height: number };
type SceneObject = { id: string; label: string; position: ScenePosition; size: SceneSize };

type ClashStoreRef = {
  getScene: (clashId: string) => SceneObject[] | null;
  getSceneObjectPositionVec3: (clashId: string, objectId: string) => Vec3 | null;
  updateObjectPosition: (clashId: string, objectId: string, position: ScenePosition) => void;
};

export class MockViewerAdapter implements ViewerAdapter {
  private readonly pickedCallbacks: Set<ObjectPickedCallback> = new Set();

  constructor(
    private readonly clashId: string,
    private readonly store: ClashStoreRef
  ) {}

  highlightObjects(_ids: string[]): void {
    // Mock viewer hiện tại handle highlight qua isSelected trong useObjectInteraction
    // Không cần action thêm; được quản lý qua selectedObjectId state trong ClashesTab
  }

  focusObject(_id: string): void {
    // Mock viewer hiện tại handle focus qua onFocusClash callback
  }

  getObjectWorldPosition(id: string): Vec3 | null {
    return this.store.getSceneObjectPositionVec3(this.clashId, id);
  }

  setObjectWorldPosition(id: string, position: Vec3): void {
    this.store.updateObjectPosition(this.clashId, id, {
      x: position[0],
      y: position[1],
      z: position[2],
    });
  }

  getObjectBoundingBox(id: string): BBoxData | null {
    const scene = this.store.getScene(this.clashId);
    if (!scene) return null;
    const obj = scene.find((o) => o.id === id);
    if (!obj) return null;

    const hw = obj.size.width / 2;
    const hd = obj.size.depth / 2;
    const hh = obj.size.height / 2;

    return {
      min: [obj.position.x - hw, obj.position.y - hh, obj.position.z - hd],
      max: [obj.position.x + hw, obj.position.y + hh, obj.position.z + hd],
    };
  }

  onObjectPicked(callback: ObjectPickedCallback): UnsubscribeFn {
    this.pickedCallbacks.add(callback);
    return () => this.pickedCallbacks.delete(callback);
  }

  /**
   * Gọi từ Viewer component khi user click chọn object.
   * Mock viewer hiện tại gọi trực tiếp onSelectObject prop;
   * adapter này dùng khi viewer được refactor để delegate qua adapter.
   */
  notifyObjectPicked(id: string): void {
    this.pickedCallbacks.forEach((cb) => cb(id));
  }

  resetAllPositions(): void {
    // Được handle bởi discardClashScene trong clashStore
  }

  getLoadedObjectIds(): string[] {
    const scene = this.store.getScene(this.clashId);
    return scene ? scene.map((o) => o.id) : [];
  }

  dispose(): void {
    this.pickedCallbacks.clear();
  }
}
