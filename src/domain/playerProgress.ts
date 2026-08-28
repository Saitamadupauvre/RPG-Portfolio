import { events } from '../core/events';

export type StatId = 'health' | 'damage' | 'speed';

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

export type PlayerStats = Record<StatId, number>;

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
    return { coins: 0, levels: { health: 0, damage: 0, speed: 0 } };
}

function isProgressState(value: unknown): value is ProgressState {
    if (typeof value !== 'object' || value === null) return false;

    const candidate = value as Partial<ProgressState>;
    if (typeof candidate.coins !== 'number') return false;
    if (typeof candidate.levels !== 'object' || candidate.levels === null) return false;

    return STAT_DEFINITIONS.every((definition) => typeof candidate.levels?.[definition.id] === 'number');
}

function load(): ProgressState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        return isProgressState(parsed) ? parsed : emptyState();
    } catch {
        return emptyState();
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
    }
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
    return {
        health: statValue(definitionById.get('health')!, state.levels.health),
        damage: statValue(definitionById.get('damage')!, state.levels.damage),
        speed: statValue(definitionById.get('speed')!, state.levels.speed),
    };
}

/** One row per stat, everything the upgrade board needs to render. */
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

export function resetProgress() {
    const fresh = emptyState();
    state.coins = fresh.coins;
    state.levels = fresh.levels;
    save();

    events.emit('coinsChanged', state.coins);
    events.emit('playerStatsChanged', getPlayerStats());
}
