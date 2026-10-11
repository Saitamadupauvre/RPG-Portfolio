import type { MapEntity } from '../../../data/MapEntity';
import {
    BONFIRE_COLLISION_RADIUS,
    CHEST_COLLISION_RADIUS,
    PROP_BASE_FOOTPRINT,
    STATUE_COLLISION_RADIUS,
} from '../../entities/collisionSizes';
import type { GrassBounds } from './GrassSurface';

const MARGIN = 0.3;

export type GrassFootprint =
    | { shape: 'box'; x: number; z: number; cos: number; sin: number; halfX: number; halfZ: number }
    | { shape: 'circle'; x: number; z: number; radius: number };

function circle(entity: MapEntity, radius: number): GrassFootprint {
    const [x, , z] = entity.position;
    const scale = Math.max(entity.scale?.[0] ?? 1, entity.scale?.[2] ?? 1);
    return { shape: 'circle', x, z, radius: radius * scale + MARGIN };
}

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
    enemy: () => null,
    item: () => null,
};

export function buildGrassFootprints(layout: MapEntity[]): GrassFootprint[] {
    const footprints: GrassFootprint[] = [];

    for (const entity of layout) {
        const rule = footprintOf[entity.kind] as (entity: MapEntity) => GrassFootprint | null;
        const footprint = rule(entity);
        if (footprint) footprints.push(footprint);
    }

    return footprints;
}

export function isUnderFootprint(footprints: GrassFootprint[], x: number, z: number): boolean {
    for (const footprint of footprints) {
        const dx = x - footprint.x;
        const dz = z - footprint.z;

        if (footprint.shape === 'circle') {
            if (dx * dx + dz * dz <= footprint.radius * footprint.radius) return true;
            continue;
        }

        const localX = dx * footprint.cos - dz * footprint.sin;
        const localZ = dx * footprint.sin + dz * footprint.cos;
        if (Math.abs(localX) <= footprint.halfX && Math.abs(localZ) <= footprint.halfZ) return true;
    }

    return false;
}

export function footprintsInBounds(footprints: GrassFootprint[], bounds: GrassBounds): GrassFootprint[] {
    return footprints.filter((footprint) => {
        const reach = footprint.shape === 'circle' ? footprint.radius : Math.hypot(footprint.halfX, footprint.halfZ);
        return (
            footprint.x + reach >= bounds.minX &&
            footprint.x - reach <= bounds.maxX &&
            footprint.z + reach >= bounds.minZ &&
            footprint.z - reach <= bounds.maxZ
        );
    });
}
