import type { MapEntity } from '../data/MapEntity';

/** World units per chunk side. */
export const CHUNK_SIZE = 16;

/** `${col},${row}` — a string so chunks can key a plain Map/Set. */
export type ChunkKey = string;

export function chunkCoord(value: number): number {
    return Math.floor(value / CHUNK_SIZE);
}

export function chunkKeyAt(x: number, z: number): ChunkKey {
    return `${chunkCoord(x)},${chunkCoord(z)}`;
}

/**
 * Chunk membership is *derived* from each entity's own position, never authored.
 * Region files can group entities however reads best; an entity therefore cannot
 * be filed in the wrong chunk, and moving one across a border is just new numbers.
 */
export function bucketByChunk(layout: MapEntity[]): Map<ChunkKey, MapEntity[]> {
    const buckets = new Map<ChunkKey, MapEntity[]>();

    for (const entity of layout) {
        const key = chunkKeyAt(entity.position[0], entity.position[2]);
        const bucket = buckets.get(key);

        if (bucket) bucket.push(entity);
        else buckets.set(key, [entity]);
    }

    return buckets;
}

/** The square ring of chunk keys around [x, z], inclusive of its own chunk. */
export function keysInRadius(x: number, z: number, radius: number): ChunkKey[] {
    const centerCol = chunkCoord(x);
    const centerRow = chunkCoord(z);
    const keys: ChunkKey[] = [];

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
        for (let col = centerCol - radius; col <= centerCol + radius; col++) {
            keys.push(`${col},${row}`);
        }
    }

    return keys;
}
