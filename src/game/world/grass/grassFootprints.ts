import type { MapEntity } from '../../../data/MapEntity';
import { PROP_BASE_FOOTPRINT } from '../../entities/PropFactory';
import { CHEST_COLLISION_RADIUS } from '../../entities/ChestFactory';
import { BONFIRE_COLLISION_RADIUS } from '../../entities/BonfireFactory';
import { STATUE_COLLISION_RADIUS } from '../../entities/StatueFactory';
import type { GrassBounds } from './GrassSurface';

/**
 * Extra bare ground around each object, in world units. Blades lean and sway,
 * so a root planted right against a wall would still tip through it, and a
 * visible ring of short bare ground reads as the object sitting on the soil.
 */
const MARGIN = 0.3;

/**
 * The ground a static object stands on, where no grass should grow.
 * A box keeps its rotation (as cos/sin of its yaw), so a wall placed at an
 * angle clears a strip along itself instead of a big axis-aligned square
 * around it.
 */
export type GrassFootprint =
    | { shape: 'box'; x: number; z: number; cos: number; sin: number; halfX: number; halfZ: number }
    | { shape: 'circle'; x: number; z: number; radius: number };

/** A round footprint at the entity's position, its radius grown by its widest scale. */
function circle(entity: MapEntity, radius: number): GrassFootprint {
    const [x, , z] = entity.position;
    const scale = Math.max(entity.scale?.[0] ?? 1, entity.scale?.[2] ?? 1);
    return { shape: 'circle', x, z, radius: radius * scale + MARGIN };
}

/**
 * One rule per entity kind. The mapped type over `MapEntity['kind']` makes TS
 * fail the build if a new kind ships without deciding whether it clears grass,
 * the same guarantee as `entityFactories`. A switch would silently skip it.
 */
const footprintOf: { [K in MapEntity['kind']]: (entity: Extract<MapEntity, { kind: K }>) => GrassFootprint | null } = {
    prop: (entity) => {
        const [x, , z] = entity.position;
        const yaw = entity.rotation?.[1] ?? 0;
        return {
            shape: 'box',
            x,
            z,
            cos: Math.cos(yaw),
            sin: Math.sin(yaw),
            halfX: (PROP_BASE_FOOTPRINT * (entity.scale?.[0] ?? 1)) / 2 + MARGIN,
            halfZ: (PROP_BASE_FOOTPRINT * (entity.scale?.[2] ?? 1)) / 2 + MARGIN,
        };
    },
    chest: (entity) => circle(entity, CHEST_COLLISION_RADIUS),
    statue: (entity) => circle(entity, STATUE_COLLISION_RADIUS),
    bonfire: (entity) => circle(entity, BONFIRE_COLLISION_RADIUS),
    // Enemies move and part the grass through the shader instead; items are
    // small floating pickups with nothing on the ground.
    enemy: () => null,
    item: () => null,
};

/**
 * Built from the map layout, not from spawned entities: entities stream in by
 * chunk, and grass grows further out than they do, so a patch could be grown
 * before the chest standing on it exists. The layout is always all there.
 */
export function buildGrassFootprints(layout: MapEntity[]): GrassFootprint[] {
    const footprints: GrassFootprint[] = [];

    for (const entity of layout) {
        const rule = footprintOf[entity.kind] as (entity: MapEntity) => GrassFootprint | null;
        const footprint = rule(entity);
        if (footprint) footprints.push(footprint);
    }

    return footprints;
}

/** True when [x, z] is on bare ground under any of `footprints`. */
export function isUnderFootprint(footprints: GrassFootprint[], x: number, z: number): boolean {
    for (const footprint of footprints) {
        const dx = x - footprint.x;
        const dz = z - footprint.z;

        if (footprint.shape === 'circle') {
            if (dx * dx + dz * dz <= footprint.radius * footprint.radius) return true;
            continue;
        }

        // Into the box's own axes: the inverse of three's Y rotation, which maps
        // local (x, z) to world (x cos + z sin, -x sin + z cos).
        const localX = dx * footprint.cos - dz * footprint.sin;
        const localZ = dx * footprint.sin + dz * footprint.cos;
        if (Math.abs(localX) <= footprint.halfX && Math.abs(localZ) <= footprint.halfZ) return true;
    }

    return false;
}

/**
 * The footprints that can reach into `bounds`. A patch tests each of its
 * thousands of blades against this short list instead of the whole map's.
 */
export function footprintsInBounds(footprints: GrassFootprint[], bounds: GrassBounds): GrassFootprint[] {
    return footprints.filter((footprint) => {
        // Bounding circle: the box's half-diagonal covers it at any yaw.
        const reach = footprint.shape === 'circle' ? footprint.radius : Math.hypot(footprint.halfX, footprint.halfZ);
        return (
            footprint.x + reach >= bounds.minX &&
            footprint.x - reach <= bounds.maxX &&
            footprint.z + reach >= bounds.minZ &&
            footprint.z - reach <= bounds.maxZ
        );
    });
}
