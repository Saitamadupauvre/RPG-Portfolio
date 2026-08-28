import type { ChestLoot } from '../data/MapEntity';
import { events } from '../core/events';
import { discover } from './discovery';
import { addCoins, grantStatLevel, STAT_DEFINITIONS } from './playerProgress';

/**
 * One handler per loot kind. The mapped type over `ChestLoot['kind']` makes TS
 * fail the build if a new union member ships without a handler.
 * Returns the message to show, or null when the entry granted nothing.
 */
type LootHandlers = {
    [K in ChestLoot['kind']]: (loot: Extract<ChestLoot, { kind: K }>) => string | null;
};

const handlers: LootHandlers = {
    coins: (loot) => {
        if (loot.amount <= 0) return null;
        addCoins(loot.amount);
        return `+${loot.amount} coins`;
    },
    project: (loot) => {
        const project = discover(loot.projectId);
        if (!project) return null;

        events.emit('projectDiscovered', project);
        return `Discovered ${project.title}`;
    },
    stat: (loot) => {
        if (!grantStatLevel(loot.statId)) return null;

        const definition = STAT_DEFINITIONS.find((entry) => entry.id === loot.statId);
        return `${definition?.label ?? loot.statId} +1`;
    },
};

/** Applies every entry, dropping the ones that did nothing (already owned / maxed). */
export function applyChestLoot(loot: ChestLoot[]): string[] {
    return loot
        .map((entry) => handlers[entry.kind](entry as never))
        .filter((message): message is string => message !== null);
}
