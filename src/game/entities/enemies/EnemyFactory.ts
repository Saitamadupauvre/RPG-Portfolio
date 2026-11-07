import type { EnemyEntity } from '../../data/MapEntity';
import type { Entity } from './Entity';
import { enemyPool } from './EnemyPool';

export function createEnemy(entity: EnemyEntity): Entity {
    return enemyPool.acquire(entity);
}
