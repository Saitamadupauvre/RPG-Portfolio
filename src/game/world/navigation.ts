import { mapLayout } from '../../data/mapLayout';
import type { MapEntity } from '../../data/MapEntity';
import {
    buildNavGrid,
    colToWorld,
    isBlocked,
    rowToWorld,
    worldToCol,
    worldToRow,
    type NavGrid,
} from '../../domain/pathfinding/NavGrid';

const LANDMARK_FOOTPRINT = 1;

function isBlocking(entity: MapEntity): boolean {
    if (entity.kind === 'prop') return entity.collidable === true;
    return entity.kind === 'statue' || entity.kind === 'bonfire';
}

const GROUND_SIZE = 50;
const CELL_SIZE = 0.5;

let cached: NavGrid | null = null;

export function getNavGrid(): NavGrid {
    if (!cached) cached = build(mapLayout);
    return cached;
}

export function rebuildNavGrid(layout: MapEntity[]) {
    cached = build(layout);
}

const MAX_SPAWN_SEARCH_RINGS = 8;

/**
 * Nearest walkable point to [x, z]. Bonfires block their own cell, so a raw
 * checkpoint position would drop the player inside an obstacle where every
 * slide test fails and movement looks frozen.
 */
export function findFreePoint(x: number, z: number): [number, number] {
    const grid = getNavGrid();
    const col = worldToCol(grid, x);
    const row = worldToRow(grid, z);

    if (!isBlocked(grid, col, row)) return [x, z];

    for (let ring = 1; ring <= MAX_SPAWN_SEARCH_RINGS; ring++) {
        for (let dRow = -ring; dRow <= ring; dRow++) {
            for (let dCol = -ring; dCol <= ring; dCol++) {
                // Only the ring's edge; inner cells were tested in earlier rings.
                if (Math.max(Math.abs(dRow), Math.abs(dCol)) !== ring) continue;
                if (isBlocked(grid, col + dCol, row + dRow)) continue;

                return [colToWorld(grid, col + dCol), rowToWorld(grid, row + dRow)];
            }
        }
    }

    return [x, z];
}

function build(layout: MapEntity[]): NavGrid {
    const obstacles = layout
        .filter(isBlocking)
        .map((entity) => ({
            position: [entity.position[0], entity.position[2]] as [number, number],

            size: [
                (entity.scale?.[0] ?? 1) * LANDMARK_FOOTPRINT,
                (entity.scale?.[2] ?? 1) * LANDMARK_FOOTPRINT,
            ] as [number, number],
        }));

    const half = GROUND_SIZE / 2;
    return buildNavGrid(obstacles, { minX: -half, maxX: half, minZ: -half, maxZ: half }, CELL_SIZE);
}
