import type { TileMap } from '../../data/tileMap';

/** A tile's four corner heights, in world units, ordered -X-Z, +X-Z, -X+Z, +X+Z. */
export type TileCorners = [number, number, number, number];

/**
 * Read-only queries over a `TileMap`.
 *
 * Height is derived, never authored. A tile you raise keeps its full flat top;
 * it is the *lower* neighbour that ramps up to meet it, sloping across its own
 * face. So a one-level difference reads as a walkable ramp, while two or more
 * stays a sheer rock cliff — and raising a tile is always a local edit that
 * cannot deform the tile you raised.
 */
export type TileGrid = {
    readonly map: TileMap;
    /** Difference in levels that stops being walkable and becomes a cliff. */
    readonly maxStep: number;
    levelAt(col: number, row: number): number;
    corners(col: number, row: number): TileCorners;
    /** Ground height in world units, interpolated across the tile's corners. */
    heightAt(x: number, z: number): number;
    /** True when a walker can cross from one tile to the other. */
    canStep(fromCol: number, fromRow: number, toCol: number, toRow: number): boolean;
    contains(col: number, row: number): boolean;
    colAt(x: number): number;
    rowAt(z: number): number;
    tileCenterX(col: number): number;
    tileCenterZ(row: number): number;
    index(col: number, row: number): number;
    readonly minX: number;
    readonly minZ: number;
};

/** A step of more than one level is a cliff: unwalkable, and drawn as rock. */
const MAX_STEP = 1;

export function createTileGrid(map: TileMap): TileGrid {
    const { cols, rows, tileSize, levelHeight } = map;
    const minX = (-cols * tileSize) / 2;
    const minZ = (-rows * tileSize) / 2;

    const contains = (col: number, row: number) => col >= 0 && col < cols && row >= 0 && row < rows;
    const clampCol = (col: number) => Math.max(0, Math.min(cols - 1, col));
    const clampRow = (row: number) => Math.max(0, Math.min(rows - 1, row));
    const colAt = (x: number) => clampCol(Math.floor((x - minX) / tileSize));
    const rowAt = (z: number) => clampRow(Math.floor((z - minZ) / tileSize));
    const index = (col: number, row: number) => clampRow(row) * cols + clampCol(col);

    /** Levels outside the grid mirror the edge tile, so the border has no phantom cliff. */
    const levelAt = (col: number, row: number) => map.levels[index(col, row)] ?? 0;

    /**
     * Height of one corner of a tile, given the diagonal it sits on.
     *
     * The corner lifts to the neighbouring level only when that neighbour is
     * exactly one step up: that is the ramp. A neighbour two or more levels
     * above is a cliff, so the corner stays down and a wall gets built against
     * it. Only lower tiles ever move, which is what keeps a raised tile flat.
     */
    function cornerHeight(col: number, row: number, dx: number, dz: number): number {
        const own = levelAt(col, row);
        const touching = [
            levelAt(col + dx, row),
            levelAt(col, row + dz),
            levelAt(col + dx, row + dz),
        ];

        const ramped = touching.some((level) => level === own + 1);
        return (ramped ? own + 1 : own) * levelHeight;
    }

    function corners(col: number, row: number): TileCorners {
        return [
            cornerHeight(col, row, -1, -1),
            cornerHeight(col, row, 1, -1),
            cornerHeight(col, row, -1, 1),
            cornerHeight(col, row, 1, 1),
        ];
    }

    function heightAt(x: number, z: number): number {
        const col = colAt(x);
        const row = rowAt(z);
        const [c00, c10, c01, c11] = corners(col, row);

        // Position inside the tile, 0..1 per axis, then a bilinear blend of its
        // corners — the exact surface its two triangles draw, so a walker rides
        // a ramp instead of hovering over it.
        const tx = Math.min(1, Math.max(0, (x - (minX + col * tileSize)) / tileSize));
        const tz = Math.min(1, Math.max(0, (z - (minZ + row * tileSize)) / tileSize));

        const front = c00 * (1 - tx) + c10 * tx;
        const back = c01 * (1 - tx) + c11 * tx;
        return front * (1 - tz) + back * tz;
    }

    return {
        map,
        maxStep: MAX_STEP,
        levelAt,
        corners,
        heightAt,
        canStep: (fromCol, fromRow, toCol, toRow) =>
            Math.abs(levelAt(toCol, toRow) - levelAt(fromCol, fromRow)) <= MAX_STEP,
        contains,
        colAt,
        rowAt,
        tileCenterX: (col) => minX + (col + 0.5) * tileSize,
        tileCenterZ: (row) => minZ + (row + 0.5) * tileSize,
        index,
        minX,
        minZ,
    };
}
