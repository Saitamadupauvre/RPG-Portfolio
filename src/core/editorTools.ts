import type { MapEntity } from '../data/MapEntity';

/** A rectangle in client pixels, as the box-select overlay draws it. */
export type ScreenRect = { left: number; top: number; width: number; height: number };

/** One kind of object the scatter brush drops, with the random ranges it rolls per copy. */
export type ScatterEntry = {
    kind: MapEntity['kind'];
    /** Same meaning as a palette variant: "tree" is any tree model, "rock-3-q" exactly that one. */
    variant: string;
    /** How many copies each stamp tries to drop. */
    count: number;
    /** Heading range, in degrees. */
    rotationMin: number;
    rotationMax: number;
    /** Largest lean off vertical, in degrees, in a random direction. */
    tilt: number;
    /** Uniform scale range. */
    scaleMin: number;
    scaleMax: number;
};

export type ScatterSettings = {
    /** Brush radius, in world units. */
    radius: number;
    /** No two objects closer than this, counting the ones already on the map. */
    minDistance: number;
    /** Distance the cursor travels between two stamps while dragging. */
    stampSpacing: number;
    entries: ScatterEntry[];
};

export const DEFAULT_SCATTER: ScatterSettings = {
    radius: 4,
    minDistance: 1.5,
    stampSpacing: 2,
    entries: [
        { kind: 'prop', variant: 'tree', count: 2, rotationMin: 0, rotationMax: 360, tilt: 4, scaleMin: 0.8, scaleMax: 1.3 },
    ],
};

export const DEFAULT_TILE_BRUSH_RADIUS = 2;
