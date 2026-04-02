export type Vector3Tuple = [number, number, number];

export interface BoundingBox {
  min: Vector3Tuple;
  max: Vector3Tuple;
}

/**
 * Canonical backend object contract for clash detection.
 * Coordinates use a right-handed system and meters as the base unit.
 * The object `id` must remain aligned with the future viewer entity id.
 */
export interface ClashObject {
  id: string;
  type: string;
  bbox: BoundingBox;
}

export type ClashSeverity = 'low' | 'medium' | 'high';

export interface ClashResult {
  id: string;
  objectA: string;
  objectB: string;
  position: Vector3Tuple;
  severity: ClashSeverity;
  intersectionVolume?: number;
  distance?: number;
  groupKey?: string;
}

export interface ClashGroup {
  id: string;
  name: string;
  count: number;
  items: ClashResult[];
}
