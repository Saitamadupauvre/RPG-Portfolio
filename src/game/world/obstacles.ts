import { mapLayout } from '../../data/mapLayout';
import type { MapEntity } from '../../data/MapEntity';
import { BONFIRE_MODELS, DEFAULT_BONFIRE_MODEL, isBonfireModel } from '../../data/bonfireModels';
import { isPropModel, PROP_MODELS } from '../../data/propModels';
import { BONFIRE_COLLISION_RADIUS, STATUE_COLLISION_RADIUS, STATUE_HEIGHT } from '../entities/collisionSizes';

/**
 * A solid body of the static world as an upright cylinder: the same circle the entity's
 * factory gives it to bump into, from `bottom` to `top` above the ground under it.
 */
export type Obstacle = { x: number; z: number; radius: number; bottom: number; top: number };

/**
 * Trunks, rocks, statues and bonfires, for what flies through the world: arrows. The nav
 * grid answers "can a walker step here" in half-unit cells, too coarse for "did this arrow
 * touch the trunk" — stopped by cells, arrows hung in the air beside thin trees. Heights
 * count too, so a shot passes over a low rock or a plain campfire.
 *
 * Built from the whole layout, like the nav grid, and rebuilt with it.
 */
const BUCKET_SIZE = 2;
const NONE: readonly Obstacle[] = [];

let buckets: Map<number, Obstacle[]> | null = null;

export function rebuildObstacles(layout: MapEntity[]) {
    buckets = build(layout);
}

/** Whether a point `above` the ground at (x, z) is inside a trunk, a rock or a landmark. */
export function isInsideObstacle(x: number, z: number, above: number): boolean {
    buckets ??= build(mapLayout);
    for (const obstacle of buckets.get(keyOf(bucketOf(x), bucketOf(z))) ?? NONE) {
        if (above < obstacle.bottom || above > obstacle.top) continue;
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        if (dx * dx + dz * dz < obstacle.radius * obstacle.radius) return true;
    }
    return false;
}

/**
 * Whether a point `above` the ground at (x, z) comes within `margin` of an obstacle: for the
 * camera, which must keep clear of a crown wider than the trunk. Searches the neighbouring
 * buckets too, since the margin reaches past the point's own (an obstacle listed in several
 * of them is just tested again).
 */
export function isNearObstacle(x: number, z: number, above: number, margin: number): boolean {
    buckets ??= build(mapLayout);
    for (let column = bucketOf(x - margin); column <= bucketOf(x + margin); column++) {
        for (let row = bucketOf(z - margin); row <= bucketOf(z + margin); row++) {
            for (const obstacle of buckets.get(keyOf(column, row)) ?? NONE) {
                if (above < obstacle.bottom - margin || above > obstacle.top + margin) continue;
                const reach = obstacle.radius + margin;
                const dx = x - obstacle.x;
                const dz = z - obstacle.z;
                if (dx * dx + dz * dz < reach * reach) return true;
            }
        }
    }
    return false;
}

function bucketOf(coordinate: number): number {
    return Math.floor(coordinate / BUCKET_SIZE);
}

/** A number, not a string: this is looked up for every sample of every arrow. */
function keyOf(column: number, row: number): number {
    return (column + 32768) * 65536 + (row + 32768);
}

/** Lists each obstacle in every bucket its circle overlaps, so one lookup is enough. */
function build(layout: MapEntity[]): Map<number, Obstacle[]> {
    const result = new Map<number, Obstacle[]>();
    for (const entity of layout) {
        const obstacle = toObstacle(entity);
        if (!obstacle) continue;

        const { x, z, radius } = obstacle;
        for (let column = bucketOf(x - radius); column <= bucketOf(x + radius); column++) {
            for (let row = bucketOf(z - radius); row <= bucketOf(z + radius); row++) {
                const key = keyOf(column, row);
                const bucket = result.get(key);
                if (bucket) bucket.push(obstacle);
                else result.set(key, [obstacle]);
            }
        }
    }
    return result;
}

function toObstacle(entity: MapEntity): Obstacle | null {
    const [x, , z] = entity.position;
    const [sx, sy, sz] = entity.scale ?? [1, 1, 1];
    const bottom = entity.heightOffset ?? 0;

    switch (entity.kind) {
        case 'prop': {
            // A radius of 0 is a bush: walked through, shot through.
            if (!isPropModel(entity.propType) || PROP_MODELS[entity.propType].radius <= 0) return null;
            const { radius, height } = PROP_MODELS[entity.propType];
            return { x, z, radius: radius * Math.max(sx, sz), bottom, top: bottom + height * sy };
        }
        case 'statue':
            return { x, z, radius: STATUE_COLLISION_RADIUS, bottom, top: bottom + STATUE_HEIGHT * sy };
        case 'bonfire': {
            const model = BONFIRE_MODELS[entity.model && isBonfireModel(entity.model) ? entity.model : DEFAULT_BONFIRE_MODEL];
            return { x, z, radius: BONFIRE_COLLISION_RADIUS, bottom, top: bottom + model.height * sy };
        }
        default:
            return null;
    }
}
