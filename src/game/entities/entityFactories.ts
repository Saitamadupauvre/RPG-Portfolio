import type { MapEntity } from '../../data/MapEntity';
import type { Entity } from './Entity';
import { createEnemy } from './EnemyFactory';
import { createChest } from './ChestFactory';
import { createItem } from './ItemFactory';
import { createProp } from './PropFactory';
import { createStatue } from './StatueFactory';
import { createBonfire } from './BonfireFactory';

const entityFactories: { [K in MapEntity['kind']]: (entity: Extract<MapEntity, { kind: K }>) => Entity } = {
    enemy: createEnemy,
    chest: createChest,
    item: createItem,
    prop: createProp,
    statue: createStatue,
    bonfire: createBonfire,
};

export function createMapEntity(mapEntity: MapEntity): Entity {
    const factory = entityFactories[mapEntity.kind] as (entity: MapEntity) => Entity;
    return factory(mapEntity);
}
