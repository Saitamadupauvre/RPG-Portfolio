import { createPersistentSet } from './persistence';

const defeated = createPersistentSet('rpg-portfolio:bosses');

export function isBossDefeated(bossId: string): boolean {
    return defeated.has(bossId);
}

/**
 * Regular enemies come back when their chunk reloads; a boss must not. The kill
 * is recorded here rather than on the Entity, which is pooled and reused.
 */
export function defeatBoss(bossId: string) {
    defeated.add(bossId);
}

export function resetBosses() {
    defeated.clear();
}
