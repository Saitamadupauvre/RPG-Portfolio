import { createPersistentSet } from './persistence';

const slain = createPersistentSet('rpg-portfolio:slain-enemies');

export function isEnemySlain(enemyId: string): boolean {
    return slain.has(enemyId);
}

/**
 * A regular enemy stays dead until the player next rests or dies, through chunk
 * reloads and page reloads alike. Bosses are recorded in `defeatedBosses` instead,
 * since nothing brings them back.
 */
export function slayEnemy(enemyId: string) {
    slain.add(enemyId);
}

export function reviveEnemies() {
    slain.clear();
}
