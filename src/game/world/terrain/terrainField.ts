import type * as THREE from 'three';
import { tileMap, type TileMap } from '../../data/tileMap';
import { createTileGrid, type TileGrid } from '../../domain/terrain/TileGrid';

/**
 * Shared tile-grid accessor, mirroring `navigation.ts`: one lazily built
 * instance every system reads, replaced wholesale when tiles are re-levelled.
 */
let cached: TileGrid | null = null;

export function getTileGrid(): TileGrid {
    if (!cached) cached = createTileGrid(tileMap);
    return cached;
}

export function rebuildTileGrid(map: TileMap): TileGrid {
    cached = createTileGrid(map);
    return cached;
}

/**
 * Seats an object on the ground. `groundOffset` is the distance from the
 * object's origin to its feet — half its height for a centred capsule or box, 0
 * for a group modelled with its base at the origin.
 */
export function snapToGround(object: THREE.Object3D, groundOffset = 0) {
    object.position.y = groundHeight(object.position.x, object.position.z) + groundOffset;
}

export function groundHeight(x: number, z: number): number {
    return getTileGrid().heightAt(x, z);
}
