import { events } from '../core/events';
import { getPlayerStats, type PlayerStats } from '../domain/playerProgress';
import type { Entity } from './entities/Entity';

/** Push domain-owned stat values onto the player's Three-aware components. */
export function applyPlayerStats(player: Entity, stats: PlayerStats = getPlayerStats()) {
    player.getComponent('health')?.setMaxHp(stats.health);
    player.getComponent('attack')?.setBaseDamage(stats.damage);
    player.getComponent('movement')?.setSpeed(stats.speed);
}

/** Keep the player in sync with every later upgrade purchase. */
export function bindPlayerStats(player: Entity) {
    applyPlayerStats(player);
    events.on('playerStatsChanged', (stats) => applyPlayerStats(player, stats));
}
