import type { ScatterEntry, ScatterSettings } from '../../core/editorTools';
import type { MapEntity } from '../../data/MapEntity';
import { isPropModel, isPropModelKind, PROP_MODELS } from '../../data/propModels';
import { createDefaultEntity } from './entityDefaults';

/** Tries per copy before a crowded stamp gives up on it. */
const ATTEMPTS_PER_COPY = 8;
const DEGREES = Math.PI / 180;

function between(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/**
 * Drops one stamp of every entry around (x, z) and appends the new entities
 * to `layout`. Appending as it goes is what lets the spacing check and the
 * unique ids both see the copies this same stamp already made.
 */
export function scatterStamp(x: number, z: number, settings: ScatterSettings, layout: MapEntity[]): MapEntity[] {
    const minDistanceSq = settings.minDistance ** 2;
    const reach = settings.radius + settings.minDistance;
    // Only entities that can be in range are worth checking against.
    const neighbours = layout
        .filter((entity) => distanceSq(entity, x, z) <= reach * reach)
        .map((entity): [number, number] => [entity.position[0], entity.position[2]]);

    const placed: MapEntity[] = [];

    for (const entry of settings.entries) {
        for (let copy = 0; copy < entry.count; copy++) {
            for (let attempt = 0; attempt < ATTEMPTS_PER_COPY; attempt++) {
                // sqrt spreads the points evenly over the disc; a plain random
                // radius would bunch them up at the centre.
                const radius = settings.radius * Math.sqrt(Math.random());
                const angle = Math.random() * Math.PI * 2;
                const px = x + Math.cos(angle) * radius;
                const pz = z + Math.sin(angle) * radius;

                const crowded = neighbours.some(([nx, nz]) => (nx - px) ** 2 + (nz - pz) ** 2 < minDistanceSq);
                if (crowded) continue;

                const entity = createDefaultEntity(entry.kind, entry.variant, [px, 0, pz], layout);
                Object.assign(entity, randomTransform(entry));
                layout.push(entity);
                placed.push(entity);
                neighbours.push([px, pz]);
                break;
            }
        }
    }

    return placed;
}

/** Ids of the entities inside the brush that one of its entries would have placed. */
export function eraseStamp(x: number, z: number, settings: ScatterSettings, layout: MapEntity[]): string[] {
    const radiusSq = settings.radius ** 2;

    return layout
        .filter((entity) => distanceSq(entity, x, z) <= radiusSq)
        .filter((entity) => settings.entries.some((entry) => matchesEntry(entity, entry)))
        .map((entity) => entity.id);
}

/**
 * Erasing only what the brush paints keeps a forest brush from wiping out the
 * statue standing in the middle of the forest.
 */
function matchesEntry(entity: MapEntity, entry: ScatterEntry): boolean {
    if (entity.kind !== entry.kind) return false;

    if (entity.kind === 'prop') {
        if (isPropModelKind(entry.variant)) {
            return isPropModel(entity.propType) && PROP_MODELS[entity.propType].kind === entry.variant;
        }
        return entity.propType === entry.variant;
    }
    if (entity.kind === 'enemy') return entity.enemyType === (entry.variant || 'grunt');

    return true;
}

function randomTransform(entry: ScatterEntry): Pick<MapEntity, 'rotation' | 'scale'> {
    const heading = between(entry.rotationMin, entry.rotationMax) * DEGREES;
    const lean = Math.random() * entry.tilt * DEGREES;
    const leanDirection = Math.random() * Math.PI * 2;
    const size = between(entry.scaleMin, entry.scaleMax);

    return {
        rotation: [Math.cos(leanDirection) * lean, heading, Math.sin(leanDirection) * lean],
        scale: [size, size, size],
    };
}

function distanceSq(entity: MapEntity, x: number, z: number): number {
    return (entity.position[0] - x) ** 2 + (entity.position[2] - z) ** 2;
}
