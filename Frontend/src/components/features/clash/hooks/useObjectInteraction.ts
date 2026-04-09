'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Clash, ViewerObjectState } from '../types/clashes';
import { useClashViewerStore } from '../state/clashStore';
import {
  applyCollisionFlags,
  buildViewerObjects,
  clampWorld,
  PIXELS_TO_WORLD,
  type SceneObject,
} from '../lib/clashScene';

interface DragStartState {
  pointerX: number;
  pointerY: number;
  objectPosition: { x: number; y: number; z: number };
}

export function useObjectInteraction(
  clash: Clash | null,
  selectedObjectId: string | null,
  options?: { overviewScene?: SceneObject[] | null; allowObjectDrag?: boolean }
) {
  const overviewScene = options?.overviewScene ?? null;
  const allowObjectDrag = options?.allowObjectDrag !== false;
  const clashStore = useClashViewerStore();
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  const [collisionMessage, setCollisionMessage] = useState<string | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; z: number } | null>(null);
  const lastValidPositionsRef = useRef<Record<string, { x: number; y: number; z: number }>>({});
  const dragStartRef = useRef<DragStartState | null>(null);

  useEffect(() => {
    if (!clash) return;
    clashStore.ensureSceneForClash(clash);
  }, [clash, clashStore]);

  useEffect(() => {
    // Reset only transient drag UI when switching clash; never reset positions in the shared store.
    setDraggingObjectId(null);
    dragStartRef.current = null;
    setCollisionMessage(null);
    setDragPreviewPosition(null);
    lastValidPositionsRef.current = {};
  }, [clash?.id]);

  const objects = useMemo<ViewerObjectState[]>(() => {
    if (clash) {
      const scene = clashStore.getScene(clash.id);
      if (!scene) return [];
      return buildViewerObjects(scene, selectedObjectId);
    }
    if (overviewScene?.length) {
      return buildViewerObjects(overviewScene, selectedObjectId, { skipCollision: true });
    }
    return [];
  }, [clash, clashStore, overviewScene, selectedObjectId]);

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  const hasCollision = useMemo(() => objects.some((object) => object.isColliding), [objects]);

  const selectObject = useCallback((objectId: string) => {
    // Selection is controlled by the parent via `selectedObjectId`.
    void objectId;
  }, []);

  const beginDrag = useCallback((objectId: string, pointerX: number, pointerY: number) => {
    if (!allowObjectDrag || !clash) return;
    const scene = clashStore.getScene(clash.id);
    const obj = scene?.find((entry) => entry.id === objectId);
    if (!obj) return;

    dragStartRef.current = { pointerX, pointerY, objectPosition: obj.position };
    setDraggingObjectId(objectId);
    setCollisionMessage(null);
    setDragPreviewPosition({ x: obj.position.x, z: obj.position.z });
    // Seed snap-back baseline immediately from the shared scene.
    lastValidPositionsRef.current[objectId] = obj.position;
  }, [allowObjectDrag, clash, clashStore, selectObject]);

  const updateDrag = useCallback((pointerX: number, pointerY: number) => {
    if (!allowObjectDrag || !clash || !draggingObjectId || !dragStartRef.current) {
      return;
    }

    const deltaX = (pointerX - dragStartRef.current.pointerX) * PIXELS_TO_WORLD;
    const deltaZ = (pointerY - dragStartRef.current.pointerY) * PIXELS_TO_WORLD;
    const nextPosition = {
      x: clampWorld(dragStartRef.current.objectPosition.x + deltaX),
      y: dragStartRef.current.objectPosition.y,
      z: clampWorld(dragStartRef.current.objectPosition.z + deltaZ),
    };

    setDragPreviewPosition({ x: nextPosition.x, z: nextPosition.z });

    // Collision feedback should feel immediate; compute from the next drop position, too.
    const movedObjects: ViewerObjectState[] = objects.map((object) =>
      object.id === draggingObjectId
        ? { ...object, position: { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z } }
        : object
    );
    const collidedObjects: ViewerObjectState[] = applyCollisionFlags(movedObjects);
    const draggedObject = collidedObjects.find((object: ViewerObjectState) => object.id === draggingObjectId);

    if (draggedObject && !draggedObject.isColliding) {
      lastValidPositionsRef.current[draggingObjectId] = nextPosition;
      setCollisionMessage(null);
    } else if (draggedObject?.isColliding) {
      setCollisionMessage('Cannot resolve clash while objects are still intersecting');
    }

    clashStore.updateObjectPosition(clash.id, draggingObjectId, nextPosition);
  }, [allowObjectDrag, clash, clashStore, draggingObjectId, objects]);

  const endDrag = useCallback(() => {
    if (!allowObjectDrag || !clash || !draggingObjectId) {
      return;
    }

    // Use the latest scene from the store — `objects` from the last render can be one frame
    // behind the final UPDATE_OBJECT_POSITION from the last pointermove, which caused false
    // "still colliding" snap-back and left the parent stuck on viewerHasCollision === true.
    const scene = clashStore.getScene(clash.id);
    if (scene) {
      const viewerObjects = buildViewerObjects(scene, selectedObjectId);
      const draggedObject = viewerObjects.find((object) => object.id === draggingObjectId);
      if (draggedObject?.isColliding) {
        const lastValid = lastValidPositionsRef.current[draggingObjectId];
        if (lastValid) {
          clashStore.updateObjectPosition(clash.id, draggingObjectId, lastValid);
        }
      }
    }

    dragStartRef.current = null;
    setDraggingObjectId(null);
    setCollisionMessage(null);
    setDragPreviewPosition(null);
  }, [allowObjectDrag, clash, clashStore, draggingObjectId, selectedObjectId]);

  return {
    objects,
    selectedObject,
    draggingObjectId,
    hasCollision,
    collisionMessage,
    dragPreviewPosition,
    lastValidPosition:
      draggingObjectId
        ? (() => {
            const v = lastValidPositionsRef.current[draggingObjectId];
            return v ? { x: v.x, z: v.z } : null;
          })()
        : null,
    selectObject,
    beginDrag,
    updateDrag,
    endDrag,
  };
}
