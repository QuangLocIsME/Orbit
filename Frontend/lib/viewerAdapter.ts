/**
 * ViewerAdapter — interface chuẩn cho tất cả 3D viewer.
 *
 * Mục đích:
 *   - MockViewerAdapter (implement bằng Viewer3D/Viewer2D hiện tại)
 *   - XeoKitViewerAdapter (implement khi xeokit viewer hoàn thành)
 *   - ClashesTab chỉ phụ thuộc vào interface này, không phụ thuộc viewer cụ thể
 *
 * Khi nối xeokit:
 *   1. Implement XeoKitViewerAdapter (đã có skeleton ở xeoKitViewerAdapter.ts)
 *   2. Truyền instance vào <Viewer3D adapter={xeoKitAdapter} />
 *   3. Không cần thay đổi ClashesTab hay clashStore
 */

export type Vec3 = [number, number, number];

export type BBoxData = {
  min: Vec3;
  max: Vec3;
};

export type ObjectPickedCallback = (objectId: string) => void;
export type UnsubscribeFn = () => void;

export interface ViewerAdapter {
  /**
   * Highlight một hoặc nhiều objects trong viewer (vd: khi chọn clash trong list).
   * @param ids - Danh sách object IDs cần highlight. Empty array = bỏ highlight tất cả.
   */
  highlightObjects(ids: string[]): void;

  /**
   * Di chuyển camera để focus vào object.
   * @param id - Object ID cần focus.
   */
  focusObject(id: string): void;

  /**
   * Lấy world position (tọa độ IFC meters) của object từ model.
   * @returns Vec3 [x, y, z] hoặc null nếu object không tồn tại.
   */
  getObjectWorldPosition(id: string): Vec3 | null;

  /**
   * Override world position của object trong viewer (dùng khi user kéo object).
   * Không thay đổi model gốc — chỉ thay đổi render position.
   * @param id - Object ID.
   * @param position - Tọa độ mới [x, y, z] tính bằng meters.
   */
  setObjectWorldPosition(id: string, position: Vec3): void;

  /**
   * Lấy bounding box của object từ model.
   * @returns BBoxData hoặc null nếu object không tồn tại.
   */
  getObjectBoundingBox(id: string): BBoxData | null;

  /**
   * Đăng ký callback được gọi khi user click/pick một object trong viewer.
   * @param callback - Hàm nhận objectId vừa được chọn.
   * @returns Hàm unsubscribe để hủy đăng ký.
   */
  onObjectPicked(callback: ObjectPickedCallback): UnsubscribeFn;

  /**
   * Reset tất cả position overrides về vị trí gốc trong model.
   */
  resetAllPositions(): void;

  /**
   * Lấy tất cả object IDs hiện đang được load trong viewer.
   */
  getLoadedObjectIds(): string[];

  /**
   * Cleanup resources khi viewer unmount.
   */
  dispose(): void;
}
