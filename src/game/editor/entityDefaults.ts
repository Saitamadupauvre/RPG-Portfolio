import type { MapEntity, Vec3 } from '../../data/MapEntity';
import { projects } from '../../data/projects';

const builders: {
    [K in MapEntity['kind']]: (id: string, position: Vec3, variant: string) => Extract<MapEntity, { kind: K }>;
} = {
    enemy: (id, position, variant) => ({
        kind: 'enemy',
        id,
        enemyType: (variant || 'grunt') as 'grunt' | 'elite' | 'boss',
        position,
    }),
    chest: (id, position, variant) => ({
        kind: 'chest',
        id,
        chestTier: (variant || 'wood') as 'wood' | 'silver' | 'gold',
        position,
    }),
    item: (id, position, variant) => ({
        kind: 'item',
        id,
        itemType: variant || 'shard',
        position,
    }),
    prop: (id, position, variant) => ({
        kind: 'prop',
        id,
        propType: variant || 'wall',
        collidable: variant !== 'decor',
        position,
    }),
    statue: (id, position, variant) => ({
        kind: 'statue',
        id,
        projectId: variant || projects[0]?.id || '',
        position,
    }),
    bonfire: (id, position) => ({
        kind: 'bonfire',
        id,
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
