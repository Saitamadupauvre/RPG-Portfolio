import { mapLayout } from '../../data/mapLayout';
import type { PropEntity } from '../../data/MapEntity';
import { buildNavGrid, type NavGrid } from '../../domain/pathfinding/NavGrid';

function isCollidableProp(entity: (typeof mapLayout)[number]): entity is PropEntity {
    return entity.kind === 'prop' && entity.collidable === true;
}

const GROUND_SIZE = 50;
const CELL_SIZE = 0.5;

let cached: NavGrid | null = null;

// Static nav grid built once from collidable props in mapLayout. Enemies never move
// obstacles at runtime, so a single shared grid is safe to reuse across all pathfinders.
export function getNavGrid(): NavGrid {
    if (cached) return cached;

    const obstacles = mapLayout
        .filter(isCollidableProp)
        .map((entity) => ({
            position: [entity.position[0], entity.position[2]] as [number, number],
            size: entity.size ?? [0.7, 0.7],
        }));

    const half = GROUND_SIZE / 2;
    cached = buildNavGrid(obstacles, { minX: -half, maxX: half, minZ: -half, maxZ: half }, CELL_SIZE);
    return cached;
}
