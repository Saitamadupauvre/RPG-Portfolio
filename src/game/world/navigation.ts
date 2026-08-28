import { mapLayout } from '../../data/mapLayout';
import type { MapEntity, PropEntity } from '../../data/MapEntity';
import { buildNavGrid, type NavGrid } from '../../domain/pathfinding/NavGrid';

function isCollidableProp(entity: MapEntity): entity is PropEntity {
    return entity.kind === 'prop' && entity.collidable === true;
}

const GROUND_SIZE = 50;
const CELL_SIZE = 0.5;

let cached: NavGrid | null = null;

// Built lazily from the current layout and cached, because enemies never move obstacles
// at runtime. The editor is the one thing that invalidates it — hence rebuildNavGrid.
export function getNavGrid(): NavGrid {
    if (!cached) cached = build(mapLayout);
    return cached;
}

export function rebuildNavGrid(layout: MapEntity[]) {
    cached = build(layout);
}

function build(layout: MapEntity[]): NavGrid {
    const obstacles = layout
        .filter(isCollidableProp)
        .map((entity) => ({
            position: [entity.position[0], entity.position[2]] as [number, number],
            // Props are unit boxes, so XZ scale *is* the footprint.
            size: [entity.scale?.[0] ?? 1, entity.scale?.[2] ?? 1] as [number, number],
        }));

    const half = GROUND_SIZE / 2;
    return buildNavGrid(obstacles, { minX: -half, maxX: half, minZ: -half, maxZ: half }, CELL_SIZE);
}
