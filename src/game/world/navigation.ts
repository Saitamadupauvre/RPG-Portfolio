import { mapLayout } from '../../data/mapLayout';
import type { MapEntity } from '../../data/MapEntity';
import { buildNavGrid, type NavGrid } from '../../domain/pathfinding/NavGrid';

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
