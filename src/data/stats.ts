/**
 * Stat identifiers live in `data/` so map content (chest loot) can reference a
 * stat without importing `domain/` — the layer rule is data -> domain, never back.
 */
export type StatId = 'health' | 'damage' | 'speed';

/** Resolved value per stat. Here rather than in `domain/` so `core/events.ts` can name it without importing upward. */
export type PlayerStats = Record<StatId, number>;
