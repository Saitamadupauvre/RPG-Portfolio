import type { MapEntity } from './MapEntity';

/**
 * Every hand-placed entity in the world. Empty by default: with no map
 * authored, the game boots on the flat `tileMap` floor with only the player.
 * Build the level in the editor (F1) and commit its export here. The runtime
 * chunk an entity belongs to is derived from its own position (see
 * `domain/chunks.ts`), so this stays one flat list.
 */
export const mapLayout: MapEntity[] = [];
