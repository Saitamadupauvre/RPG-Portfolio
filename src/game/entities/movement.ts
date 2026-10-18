import type * as THREE from 'three';
import { canTraverse, isBlocked, isInsideBounds, worldToCol, worldToRow } from '../../domain/pathfinding/NavGrid';
import { getNavGrid } from '../world/navigation';
import { getTileGrid, groundHeight } from '../world/terrainField';

/** Widest gap a leap clears, in tiles. */
const MAX_GAP_TILES = 1;
/** How far past the far edge the leap lands, so the feet are fully on the ledge. */
const LANDING_MARGIN = 0.4;
/** Distance between two samples along the leap line; well under a tile so none is skipped. */
const SAMPLE_STEP = 0.1;

export type GapLeap = {
    /** Ground distance from takeoff to landing. */
    distance: number;
    takeoffY: number;
    landingY: number;
};

/**
 * Whether a dash from (x, z) along `direction` should leap a gap instead of
 * stopping at its edge. It must find, in this order: walkable ground up to an
 * edge the normal dash would reach, a drop of more than one step (the gap),
 * at most `MAX_GAP_TILES` tiles of it, then ground the takeoff tile could step
 * onto, free of obstacles. Anything else (a wall, a wide gap, a tree on the
 * landing) returns null and the dash stays an ordinary dash.
 */
export function planGapLeap(x: number, z: number, direction: THREE.Vector3, dashDistance: number): GapLeap | null {
    const tiles = getTileGrid();
    const nav = getNavGrid();
    const maxDistance = dashDistance + MAX_GAP_TILES * tiles.map.tileSize + LANDING_MARGIN;

    let walkedTile = tiles.index(tiles.colAt(x), tiles.rowAt(z));
    let walkedLevel = tiles.levelAt(tiles.colAt(x), tiles.rowAt(z));
    const gapTiles = new Set<number>();

    for (let travelled = SAMPLE_STEP; travelled <= maxDistance; travelled += SAMPLE_STEP) {
        const px = x + direction.x * travelled;
        const pz = z + direction.z * travelled;
        if (!isInsideBounds(nav, px, pz)) return null;

        const col = tiles.colAt(px);
        const row = tiles.rowAt(pz);
        const tile = tiles.index(col, row);
        const level = tiles.levelAt(col, row);
        const reachable = Math.abs(level - walkedLevel) <= tiles.maxStep;

        if (gapTiles.size === 0) {
            if (tile === walkedTile) continue;
            if (reachable) {
                // Still on walkable ground (a ramp included): keep following it.
                walkedTile = tile;
                walkedLevel = level;
                continue;
            }
            // A wall going up is not a gap, and an edge past the normal dash
            // range is one the player would never have reached.
            if (level > walkedLevel || travelled > dashDistance) return null;
            gapTiles.add(tile);
            continue;
        }

        if (!reachable) {
            gapTiles.add(tile);
            if (gapTiles.size > MAX_GAP_TILES) return null;
            continue;
        }

        // Across: land a little past the edge, and only on free ground.
        const distance = travelled + LANDING_MARGIN;
        const landX = x + direction.x * distance;
        const landZ = z + direction.z * distance;
        const landCol = tiles.colAt(landX);
        const landRow = tiles.rowAt(landZ);
        if (Math.abs(tiles.levelAt(landCol, landRow) - walkedLevel) > tiles.maxStep) return null;
        if (!isInsideBounds(nav, landX, landZ) || isWorldBlocked(nav, landX, landZ)) return null;

        return { distance, takeoffY: groundHeight(x, z), landingY: groundHeight(landX, landZ) };
    }

    return null;
}

type Grid = ReturnType<typeof getNavGrid>;

function isWorldBlocked(grid: Grid, x: number, z: number): boolean {
    return isBlocked(grid, worldToCol(grid, x), worldToRow(grid, z));
}

/** Off the map, blocked destination, or a step too tall to climb — all three stop a walker. */
function cannotReach(grid: Grid, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    if (!isInsideBounds(grid, toX, toZ)) return true;
    return !canTraverse(
        grid,
        worldToCol(grid, fromX),
        worldToRow(grid, fromZ),
        worldToCol(grid, toX),
        worldToRow(grid, toZ),
    );
}

export function slideMove(mesh: THREE.Object3D, direction: THREE.Vector3, distance: number) {
    const grid = getNavGrid();
    const { x, z } = mesh.position;

    // Standing inside a blocked cell (respawn on a landmark, an obstacle added
    // by the editor) would fail every test below and pin the player forever.
    // Let them walk out instead.
    // The escape hatch still respects the map border.
    if (isWorldBlocked(grid, x, z)) {
        const nextX = x + direction.x * distance;
        const nextZ = z + direction.z * distance;
        if (!isInsideBounds(grid, nextX, nextZ)) return;
        mesh.position.x = nextX;
        mesh.position.z = nextZ;
        return;
    }

    const full = { x: x + direction.x * distance, z: z + direction.z * distance };
    if (!cannotReach(grid, x, z, full.x, full.z)) {
        mesh.position.x = full.x;
        mesh.position.z = full.z;
        return;
    }

    // Blocked head-on: keep whichever single axis still works, so the walker
    // slides along the wall or cliff face instead of sticking to it.
    if (!cannotReach(grid, x, z, full.x, z)) {
        mesh.position.x = full.x;
    } else if (!cannotReach(grid, x, z, x, full.z)) {
        mesh.position.z = full.z;
    }
}
