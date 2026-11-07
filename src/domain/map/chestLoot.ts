import type { Message } from '../data/locale';
import type { ChestLoot } from '../data/MapEntity';
import { events } from '../core/events';
import { discover } from './discovery';
import { addCoins, grantStatLevel } from './playerProgress';

/**
 * One handler per loot kind. The mapped type over `ChestLoot['kind']` makes TS
 * fail the build if a new union member ships without a handler.
 * Returns the message to show (translated by the interface), or null when the entry granted nothing.
 */
type LootHandlers = {
    [K in ChestLoot['kind']]: (loot: Extract<ChestLoot, { kind: K }>) => Message | null;
};

const handlers: LootHandlers = {
    coins: (loot) => {
        if (loot.amount <= 0) return null;
        addCoins(loot.amount);
        return { key: 'loot.coins', params: { count: loot.amount } };
    },
    project: (loot) => {
        const project = discover(loot.projectId);
        if (!project) return null;

        events.emit('projectDiscovered', project);
        events.emit('projectShown', project);
        return { key: 'loot.project', params: { title: project.title } };
    },
    stat: (loot) => {
        if (!grantStatLevel(loot.statId)) return null;
        return { key: 'loot.stat', params: { stat: { key: `stat.${loot.statId}.name` } } };
    },
};

/** Applies every entry, dropping the ones that did nothing (already owned / maxed). */
export function applyChestLoot(loot: ChestLoot[]): Message[] {
    return loot
        .map((entry) => handlers[entry.kind](entry as never))
        .filter((message): message is Message => message !== null);
}
