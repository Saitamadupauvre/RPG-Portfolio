import type { MapEntity } from './MapEntity';
import { spawnValley } from './chunks/spawnValley';
import { northReach } from './chunks/northReach';

/**
 * Index of the hand-authored region files. Region files group entities the way
 * level design reads; the runtime chunk an entity belongs to is derived from its
 * own position (see `domain/chunks.ts`), so this stays a plain flat concat.
 */
export const mapLayout: MapEntity[] = [
    ...spawnValley,
    ...northReach,
];
