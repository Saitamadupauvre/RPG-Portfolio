/**
 * Stat identifiers live in `data/` so map content (chest loot) can reference a
 * stat without importing `domain/` — the layer rule is data -> domain, never back.
 */
export type StatId = 'health' | 'damage' | 'speed';
