import type { EnemyEntity } from '../../data/MapEntity';
import type { Entity } from './Entity';
import { enemyPool } from './EnemyPool';

export function createEnemy(entity: EnemyEntity): Entity {
    const pooled = enemyPool.acquire(entity);

    return pooled.setDisposer(() => enemyPool.release(pooled, entity.enemyType));
}
