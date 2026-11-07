import type { EnemyEntity } from '@data/map/MapEntity';
import type { Entity } from '@game/entities/Entity';
import { enemyPool } from './EnemyPool';

export function createEnemy(entity: EnemyEntity): Entity {
    return enemyPool.acquire(entity);
}
