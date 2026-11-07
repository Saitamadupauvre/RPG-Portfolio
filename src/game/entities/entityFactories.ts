import type { MapEntity } from '@data/map/MapEntity';
import type { Entity } from './Entity';
import { createEnemy } from './enemies/EnemyFactory';
import { createChest } from './props/ChestFactory';
import { createItem } from './props/ItemFactory';
import { createProp } from './props/PropFactory';
import { createStatue } from './props/StatueFactory';
import { createBonfire } from './props/BonfireFactory';
import { createTrigger } from './props/TriggerFactory';

const entityFactories: { [K in MapEntity['kind']]: (entity: Extract<MapEntity, { kind: K }>) => Entity } = {
    enemy: createEnemy,
    chest: createChest,
    item: createItem,
    prop: createProp,
    statue: createStatue,
    bonfire: createBonfire,
    trigger: createTrigger,
};

export function createMapEntity(mapEntity: MapEntity): Entity {
    const factory = entityFactories[mapEntity.kind] as (entity: MapEntity) => Entity;
    return factory(mapEntity);
}
