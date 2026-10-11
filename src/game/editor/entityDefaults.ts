import type { MapEntity, Vec3 } from '../../data/MapEntity';
import { randomBonfireModel } from '../../data/bonfireModels';
import { projects } from '../../data/projects';
import { isPropModel, isPropModelKind, PROP_MODELS, randomModelOfKind } from '../../data/propModels';

const chestCoins: Record<'wood' | 'silver' | 'gold', number> = { wood: 25, silver: 60, gold: 120 };

function randomPropTransform(): { rotation: Vec3; scale: Vec3 } {
    const size = 0.7 + Math.random() * 0.8;
    return { rotation: [0, Math.random() * Math.PI * 2, 0], scale: [size, size, size] };
}

const builders: {
    [K in MapEntity['kind']]: (id: string, position: Vec3, variant: string) => Extract<MapEntity, { kind: K }>;
} = {
    enemy: (id, position, variant) => ({
        kind: 'enemy',
        id,
        enemyType: (variant || 'grunt') as 'grunt' | 'elite' | 'boss',
        position,
    }),
    chest: (id, position, variant) => {
        const chestTier = (variant || 'wood') as 'wood' | 'silver' | 'gold';
        return {
            kind: 'chest',
            id,
            chestTier,
            // Editor-placed chests must still be valid content; hand-edit the loot
            // array in the exported JSON for anything richer than coins.
            loot: [{ kind: 'coins', amount: chestCoins[chestTier] }],
            position,
        };
    },
    item: (id, position, variant) => ({
        kind: 'item',
        id,
        itemType: variant || 'shard',
        position,
    }),
    prop: (id, position, variant) => {
        // "tree", "bush" or "rock" place a random model of that kind; a model id places exactly that one.
        const propType = isPropModelKind(variant) ? randomModelOfKind(variant) : variant;
        const model = isPropModel(propType) ? PROP_MODELS[propType] : undefined;

        return {
            kind: 'prop',
            id,
            propType,
            position,
            // Every model placed gets its own heading and size, so a copse never looks stamped.
            ...(model && randomPropTransform()),
            ...(model?.kind === 'rock' && { material: 'stone' as const }),
        };
    },
    statue: (id, position, variant) => ({
        kind: 'statue',
        id,
        projectId: variant || projects[0]?.id || '',
        position,
    }),
    bonfire: (id, position) => ({
        kind: 'bonfire',
        id,
        model: randomBonfireModel(),
        position,
    }),
};

export function uniqueId(kind: string, layout: MapEntity[]): string {
    let index = 1;
    while (layout.some((entity) => entity.id === `${kind}-${index}`)) index++;
    return `${kind}-${index}`;
}

export function createDefaultEntity(
    kind: MapEntity['kind'],
    variant: string,
    position: Vec3,
    layout: MapEntity[],
): MapEntity {
    return builders[kind](uniqueId(kind, layout), position, variant);
}
