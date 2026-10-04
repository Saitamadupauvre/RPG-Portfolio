import { events } from '../core/events';
import type { PlayerStats, StatId } from '../data/stats';
import { loadJson, saveJson } from './persistence';

export type { PlayerStats, StatId };

export type StatDefinition = {
    id: StatId;
    label: string;
    base: number;
    perLevel: number;
    maxLevel: number;
    baseCost: number;
    costPerLevel: number;
    format: (value: number) => string;
};

export type StatView = {
    definition: StatDefinition;
    level: number;
    value: number;
    nextValue: number | null;
    cost: number | null;
    affordable: boolean;
};

const STORAGE_KEY = 'rpg-portfolio:progress';

export const STAT_DEFINITIONS: StatDefinition[] = [
    {
        id: 'health', label: 'Vitality', base: 100, perLevel: 20, maxLevel: 10,
        baseCost: 15, costPerLevel: 10, format: (value) => `${value} HP`,
    },
    {
        id: 'damage', label: 'Strength', base: 10, perLevel: 4, maxLevel: 10,
        baseCost: 20, costPerLevel: 12, format: (value) => `${value} DMG`,
    },
    {
        id: 'speed', label: 'Agility', base: 4, perLevel: 0.3, maxLevel: 10,
        baseCost: 25, costPerLevel: 15, format: (value) => `${value.toFixed(1)} SPD`,
    },
];

// Lookup by id so callers never scan the array.
const definitionById = new Map<StatId, StatDefinition>(STAT_DEFINITIONS.map((d) => [d.id, d]));

type ProgressState = {
    coins: number;
    levels: Record<StatId, number>;
};

function emptyState(): ProgressState {
    const levels = {} as Record<StatId, number>;
    for (const definition of STAT_DEFINITIONS) levels[definition.id] = 0;
    return { coins: 0, levels };
}

/**
 * Merges whatever was saved onto a fresh state, field by field, instead of
 * accepting or rejecting the save whole. A stat added in a later build is then
 * simply missing from old saves and starts at 0 — rejecting the save would wipe
 * the player's coins and every other level just because the shape grew.
 */
function load(): ProgressState {
    const loaded = emptyState();
    const saved = loadJson(STORAGE_KEY);
    if (typeof saved !== 'object' || saved === null) return loaded;

    const { coins, levels } = saved as { coins?: unknown; levels?: unknown };
    if (typeof coins === 'number' && Number.isFinite(coins)) loaded.coins = Math.max(0, Math.floor(coins));

    if (typeof levels === 'object' && levels !== null) {
        for (const definition of STAT_DEFINITIONS) {
            const level = (levels as Record<string, unknown>)[definition.id];
            if (typeof level !== 'number' || !Number.isFinite(level)) continue;
            loaded.levels[definition.id] = Math.min(definition.maxLevel, Math.max(0, Math.floor(level)));
        }
    }

    return loaded;
}

function save() {
    saveJson(STORAGE_KEY, state);
}

const state: ProgressState = load();

function statValue(definition: StatDefinition, level: number): number {
    return definition.base + definition.perLevel * level;
}

function upgradeCost(definition: StatDefinition, level: number): number | null {
    if (level >= definition.maxLevel) return null;
    return definition.baseCost + definition.costPerLevel * level;
}

export function getCoins(): number {
    return state.coins;
}

export function addCoins(amount: number) {
    if (amount <= 0) return;

    state.coins += amount;
    save();
    events.emit('coinsChanged', state.coins);
}

export function getStatLevel(id: StatId): number {
    return state.levels[id];
}

/** Resolved stat values the game layer feeds into player components. */
export function getPlayerStats(): PlayerStats {
    const stats = {} as PlayerStats;
    for (const definition of STAT_DEFINITIONS) stats[definition.id] = statValue(definition, state.levels[definition.id]);
    return stats;
}

/** One row per stat, everything the book's Level page needs to render. */
export function getStatViews(): StatView[] {
    return STAT_DEFINITIONS.map((definition) => {
        const level = state.levels[definition.id];
        const cost = upgradeCost(definition, level);

        return {
            definition,
            level,
            value: statValue(definition, level),
            nextValue: cost === null ? null : statValue(definition, level + 1),
            cost,
            affordable: cost !== null && state.coins >= cost,
        };
    });
}

export function buyUpgrade(id: StatId): boolean {
    const definition = definitionById.get(id);
    if (!definition) return false;

    const cost = upgradeCost(definition, state.levels[id]);
    if (cost === null || state.coins < cost) return false;

    state.coins -= cost;
    state.levels[id] += 1;
    save();

    events.emit('coinsChanged', state.coins);
    events.emit('playerStatsChanged', getPlayerStats());
    return true;
}

/**
 * Free level, no coin cost — chest loot and other rewards use this instead of
 * `buyUpgrade` so the cost curve stays a shop concern.
 */
export function grantStatLevel(id: StatId): boolean {
    const definition = definitionById.get(id);
    if (!definition || state.levels[id] >= definition.maxLevel) return false;

    state.levels[id] += 1;
    save();

    events.emit('playerStatsChanged', getPlayerStats());
    return true;
}

export function resetProgress() {
    const fresh = emptyState();
    state.coins = fresh.coins;
    state.levels = fresh.levels;
    save();

    events.emit('coinsChanged', state.coins);
    events.emit('playerStatsChanged', getPlayerStats());
}
