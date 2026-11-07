import type { MapEntity } from './MapEntity';
import layout from './mapLayout.json';

/**
 * Every hand-placed entity in the world. The list itself is `mapLayout.json`,
 * written by the editor (F1 > Export map, with `tileMap.json`): drop a new export over that file to
 * change the map. The runtime chunk an entity belongs to is derived from its
 * own position (see `domain/chunks.ts`), so this stays one flat list.
 *
 * Cast through `unknown`: JSON gives `number[]` where `MapEntity` wants
 * `[x, y, z]` tuples, a shape TS cannot read out of a file. The editor is the
 * only writer, and it writes `MapEntity` values.
 */
export const mapLayout = layout as unknown as MapEntity[];
