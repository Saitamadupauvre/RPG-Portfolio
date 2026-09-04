/**
 * The world floor, as a grid of tiles at integer levels.
 *
 * Height is never a free-floating number: a tile sits at a whole level, and the
 * shape between two tiles is derived from their difference — one level apart
 * ramps, two or more is a cliff. That rule lives in
 * `domain/terrain/TileGrid.ts`, not in the data.
 */
export type TileMap = {
    /** Tiles per side. The grid is centred on the origin. */
    cols: number;
    rows: number;
    /** World units per tile edge. */
    tileSize: number;
    /** World units per level step. */
    levelHeight: number;
    /** Integer level per tile, row-major from the -X/-Z corner. */
    levels: number[];
};

const COLS = 60;
const ROWS = 60;

export const tileMap: TileMap = {
    cols: COLS,
    rows: ROWS,
    tileSize: 2,
    levelHeight: 1,
    levels: new Array<number>(COLS * ROWS).fill(0),
};

/**
 * Grows or shrinks the grid around the same centre, keeping the tiles that
 * survive. Levels are indexed by column and row, so a raw array copy would
 * shear the map sideways every time the width changed.
 */
export function resizeTileMap(map: TileMap, cols: number, rows: number): TileMap {
    const levels = new Array<number>(cols * rows).fill(0);
    // Offsets keep the old grid centred in the new one rather than pinned to a
    // corner, so growing the map adds a border on every side.
    const offsetCol = Math.round((cols - map.cols) / 2);
    const offsetRow = Math.round((rows - map.rows) / 2);

    for (let row = 0; row < map.rows; row++) {
        for (let col = 0; col < map.cols; col++) {
            const targetCol = col + offsetCol;
            const targetRow = row + offsetRow;
            if (targetCol < 0 || targetCol >= cols || targetRow < 0 || targetRow >= rows) continue;

            levels[targetRow * cols + targetCol] = map.levels[row * map.cols + col] ?? 0;
        }
    }

    return { ...map, cols, rows, levels };
}
